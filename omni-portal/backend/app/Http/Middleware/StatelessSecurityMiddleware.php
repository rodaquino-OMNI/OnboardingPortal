<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Helpers\RequestHelper;
use Carbon\Carbon;

class StatelessSecurityMiddleware
{
    /**
     * Handle an incoming request with stateless security checks.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Skip security checks for API health endpoints
        if ($this->shouldSkipSecurity($request)) {
            return $next($request);
        }

        // Generate request fingerprint
        $fingerprint = RequestHelper::getClientFingerprint($request);
        
        // Validate request integrity
        if (!$this->validateRequestIntegrity($request, $fingerprint)) {
            return $this->rejectRequest($request, 'Request integrity check failed');
        }
        
        // Check for suspicious patterns
        if ($this->isSuspiciousRequest($request, $fingerprint)) {
            return $this->rejectRequest($request, 'Suspicious activity detected');
        }
        
        // Rate limiting based on client fingerprint
        if ($this->isRateLimited($request, $fingerprint)) {
            return $this->rejectRequest($request, 'Rate limit exceeded', 429);
        }
        
        // Add security headers to request for downstream processing
        $request->headers->set('X-Client-Fingerprint', $fingerprint);
        $request->headers->set('X-Request-Timestamp', now()->timestamp);
        
        $response = $next($request);
        
        // Set security headers on response
        $this->setSecurityHeaders($response);
        
        // Log successful request
        $this->logSecureRequest($request, $fingerprint);
        
        return $response;
    }

    /**
     * Check if security should be skipped for this request
     */
    private function shouldSkipSecurity(Request $request): bool
    {
        $skipPaths = [
            'api/health',
            'api/status',
            'api/ping'
        ];

        foreach ($skipPaths as $path) {
            if (str_contains($request->path(), $path)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate request integrity using client fingerprinting
     */
    private function validateRequestIntegrity(Request $request, string $fingerprint): bool
    {
        // Check if request has required headers for security
        $requiredHeaders = ['User-Agent', 'Accept'];
        
        foreach ($requiredHeaders as $header) {
            if (!$request->hasHeader($header)) {
                Log::warning('Missing required header for security', [
                    'header' => $header,
                    'ip' => $request->ip(),
                    'path' => $request->path()
                ]);
                return false;
            }
        }

        // Validate timestamp if provided
        if ($timestamp = $request->header('X-Timestamp')) {
            $requestTime = Carbon::createFromTimestamp($timestamp);
            $now = now();
            
            // Reject requests more than 5 minutes old
            if ($now->diffInMinutes($requestTime) > 5) {
                Log::warning('Request timestamp too old', [
                    'timestamp' => $timestamp,
                    'current' => $now->timestamp,
                    'ip' => $request->ip()
                ]);
                return false;
            }
        }

        return true;
    }

    /**
     * Check for suspicious request patterns
     */
    private function isSuspiciousRequest(Request $request, string $fingerprint): bool
    {
        $cacheKey = "suspicious_activity:{$fingerprint}";
        $suspiciousCount = Cache::get($cacheKey, 0);

        // Check for rapid fire requests
        $rateLimitKey = "request_count:{$fingerprint}:" . now()->format('Y-m-d-H-i');
        $requestCount = Cache::get($rateLimitKey, 0);
        
        if ($requestCount > 100) { // More than 100 requests per minute
            Cache::put($cacheKey, $suspiciousCount + 1, 3600); // Track for 1 hour
            
            Log::warning('Suspicious rapid requests detected', [
                'fingerprint' => $fingerprint,
                'count' => $requestCount,
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
            
            return $suspiciousCount >= 3; // Block after 3 suspicious activities
        }

        // Check for malicious patterns in request
        $maliciousPatterns = [
            'script', '<script', 'javascript:', 'vbscript:',
            'SELECT * FROM', 'UNION SELECT', 'DROP TABLE',
            '../../../', '....//....//..../',
            'cmd.exe', '/bin/bash', 'eval('
        ];

        $requestData = json_encode([
            'url' => $request->fullUrl(),
            'body' => $request->all(),
            'headers' => $request->headers->all()
        ]);

        foreach ($maliciousPatterns as $pattern) {
            if (stripos($requestData, $pattern) !== false) {
                Cache::put($cacheKey, $suspiciousCount + 5, 3600); // Higher penalty
                
                Log::alert('Malicious pattern detected in request', [
                    'pattern' => $pattern,
                    'fingerprint' => $fingerprint,
                    'ip' => $request->ip(),
                    'url' => $request->url()
                ]);
                
                return true;
            }
        }

        return false;
    }

    /**
     * Check if request should be rate limited
     */
    private function isRateLimited(Request $request, string $fingerprint): bool
    {
        $rateLimitKey = "rate_limit:{$fingerprint}:" . now()->format('Y-m-d-H-i');
        $currentCount = Cache::get($rateLimitKey, 0);
        
        // Different limits for different types of requests
        $limit = $this->getRateLimitForRequest($request);
        
        if ($currentCount >= $limit) {
            Log::warning('Rate limit exceeded', [
                'fingerprint' => $fingerprint,
                'limit' => $limit,
                'current' => $currentCount,
                'ip' => $request->ip()
            ]);
            return true;
        }
        
        // Increment counter
        Cache::put($rateLimitKey, $currentCount + 1, 60); // Reset every minute
        
        return false;
    }

    /**
     * Get rate limit based on request type
     */
    private function getRateLimitForRequest(Request $request): int
    {
        // Higher limits for read operations, lower for write operations
        if ($request->isMethod('GET')) {
            return 60; // 60 requests per minute for GET
        }
        
        if ($request->isMethod('POST')) {
            // Stricter limits for sensitive endpoints
            if (str_contains($request->path(), 'auth') || 
                str_contains($request->path(), 'register') ||
                str_contains($request->path(), 'password')) {
                return 5; // Only 5 auth attempts per minute
            }
            return 20; // 20 POST requests per minute
        }
        
        return 30; // Default limit
    }

    /**
     * Reject request with appropriate response
     */
    private function rejectRequest(Request $request, string $reason, int $status = 403)
    {
        Log::warning('Request rejected by stateless security middleware', [
            'reason' => $reason,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'path' => $request->path(),
            'method' => $request->method()
        ]);

        return response()->json([
            'error' => 'Security violation',
            'message' => 'Request rejected for security reasons',
            'code' => 'SECURITY_VIOLATION'
        ], $status);
    }

    /**
     * Set security headers on response
     */
    private function setSecurityHeaders($response)
    {
        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'X-XSS-Protection' => '1; mode=block',
            'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Content-Security-Policy' => "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        ];

        foreach ($headers as $key => $value) {
            $response->headers->set($key, $value);
        }
    }

    /**
     * Log successful secure request
     */
    private function logSecureRequest(Request $request, string $fingerprint)
    {
        Log::info('Secure request processed', [
            'fingerprint' => substr($fingerprint, 0, 16) . '...',
            'method' => $request->method(),
            'path' => $request->path(),
            'ip' => $request->ip(),
            'timestamp' => now()->toISOString()
        ]);
    }
}