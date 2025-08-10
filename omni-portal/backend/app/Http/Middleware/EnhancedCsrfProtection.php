<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Session\TokenMismatchException;

class EnhancedCsrfProtection
{
    /**
     * Routes that should be excluded from CSRF protection
     */
    protected $except = [
        'api/auth/*/callback', // Social auth callbacks
        'api/webhooks/*', // Webhook endpoints
    ];
    
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Skip CSRF for read-only requests
        if ($this->isReadOnly($request)) {
            return $next($request);
        }
        
        // Skip for excluded routes
        if ($this->shouldSkip($request)) {
            return $next($request);
        }
        
        // For API routes, implement double submit cookie pattern
        if ($request->is('api/*')) {
            return $this->handleApiCsrf($request, $next);
        }
        
        // For web routes, use standard Laravel CSRF
        return $this->handleWebCsrf($request, $next);
    }
    
    /**
     * Handle CSRF protection for API routes
     */
    protected function handleApiCsrf(Request $request, Closure $next)
    {
        // Implement double submit cookie pattern
        if (!$this->verifyDoubleCsrfToken($request)) {
            $this->logCsrfFailure($request, 'double_submit');
            throw new TokenMismatchException('CSRF token mismatch.');
        }
        
        // Verify origin header
        if (!$this->verifyOrigin($request)) {
            $this->logCsrfFailure($request, 'origin');
            throw new TokenMismatchException('Origin verification failed.');
        }
        
        // Verify referer header
        if (!$this->verifyReferer($request)) {
            $this->logCsrfFailure($request, 'referer');
            throw new TokenMismatchException('Referer verification failed.');
        }
        
        // Generate new token for response
        $response = $next($request);
        
        // Add CSRF token to response header
        if (method_exists($response, 'header')) {
            $token = $this->generateCsrfToken();
            $response->header('X-CSRF-Token', $token);
            
            // Set secure cookie with token
            $response->cookie(
                'XSRF-TOKEN',
                $token,
                120, // 2 hours
                '/',
                null,
                config('session.secure', false),
                false, // Not httpOnly so JS can read it
                false,
                'strict'
            );
        }
        
        return $response;
    }
    
    /**
     * Handle CSRF protection for web routes
     */
    protected function handleWebCsrf(Request $request, Closure $next)
    {
        // Use Laravel's built-in CSRF verification
        if (!$this->tokensMatch($request)) {
            $this->logCsrfFailure($request, 'token');
            throw new TokenMismatchException('CSRF token mismatch.');
        }
        
        return $next($request);
    }
    
    /**
     * Verify double submit CSRF token
     */
    protected function verifyDoubleCsrfToken(Request $request): bool
    {
        $headerToken = $request->header('X-CSRF-Token') ?? $request->header('X-XSRF-Token');
        $cookieToken = $request->cookie('XSRF-TOKEN');
        
        // Both must be present
        if (!$headerToken || !$cookieToken) {
            return false;
        }
        
        // Tokens must match
        if (!hash_equals($headerToken, $cookieToken)) {
            return false;
        }
        
        // Verify token format and age
        if (!$this->isValidTokenFormat($headerToken)) {
            return false;
        }
        
        // Check if token has been used recently (replay attack prevention)
        if ($this->isTokenRecentlyUsed($headerToken, $request)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Verify origin header
     */
    protected function verifyOrigin(Request $request): bool
    {
        $origin = $request->header('Origin');
        
        // If no origin header, check referer
        if (!$origin) {
            return true; // Will be checked by referer validation
        }
        
        $allowedOrigins = $this->getAllowedOrigins();
        
        return in_array($origin, $allowedOrigins, true);
    }
    
    /**
     * Verify referer header
     */
    protected function verifyReferer(Request $request): bool
    {
        $referer = $request->header('Referer');
        
        // Some browsers don't send referer
        if (!$referer) {
            // Strict mode: reject if no referer
            if (config('security.csrf_strict_referer', false)) {
                return false;
            }
            return true;
        }
        
        $allowedHosts = $this->getAllowedHosts();
        $refererHost = parse_url($referer, PHP_URL_HOST);
        
        return in_array($refererHost, $allowedHosts, true);
    }
    
    /**
     * Check if request is read-only
     */
    protected function isReadOnly(Request $request): bool
    {
        return in_array($request->method(), ['GET', 'HEAD', 'OPTIONS']);
    }
    
    /**
     * Check if request should skip CSRF
     */
    protected function shouldSkip(Request $request): bool
    {
        foreach ($this->except as $except) {
            if ($request->is($except)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Verify Laravel CSRF tokens match
     */
    protected function tokensMatch(Request $request): bool
    {
        $token = $this->getTokenFromRequest($request);
        $sessionToken = $request->session()->token();
        
        return is_string($sessionToken) &&
               is_string($token) &&
               hash_equals($sessionToken, $token);
    }
    
    /**
     * Get token from request
     */
    protected function getTokenFromRequest(Request $request): ?string
    {
        $token = $request->input('_token') ?: $request->header('X-CSRF-TOKEN');
        
        if (!$token && $header = $request->header('X-XSRF-TOKEN')) {
            $token = $header;
        }
        
        return $token;
    }
    
    /**
     * Generate CSRF token
     */
    protected function generateCsrfToken(): string
    {
        return Str::random(40);
    }
    
    /**
     * Validate token format
     */
    protected function isValidTokenFormat(string $token): bool
    {
        // Token should be 40 characters alphanumeric
        return preg_match('/^[a-zA-Z0-9]{40}$/', $token) === 1;
    }
    
    /**
     * Check if token was recently used
     */
    protected function isTokenRecentlyUsed(string $token, Request $request): bool
    {
        $key = 'csrf_token_used:' . hash('sha256', $token);
        
        if (Cache::has($key)) {
            // Token was used recently
            return true;
        }
        
        // Mark token as used
        Cache::put($key, [
            'ip' => $request->ip(),
            'user_id' => auth()->id(),
            'timestamp' => now()->toIso8601String(),
        ], now()->addMinutes(5));
        
        return false;
    }
    
    /**
     * Get allowed origins
     */
    protected function getAllowedOrigins(): array
    {
        $origins = config('cors.allowed_origins', []);
        
        // Add current application URL
        $appUrl = config('app.url');
        if ($appUrl) {
            $origins[] = rtrim($appUrl, '/');
        }
        
        // Add localhost for development
        if (config('app.env') === 'local') {
            $origins[] = 'http://localhost:3000';
            $origins[] = 'http://localhost:8080';
            $origins[] = 'http://127.0.0.1:3000';
        }
        
        return array_unique($origins);
    }
    
    /**
     * Get allowed hosts
     */
    protected function getAllowedHosts(): array
    {
        $hosts = [];
        
        // Extract hosts from allowed origins
        foreach ($this->getAllowedOrigins() as $origin) {
            $host = parse_url($origin, PHP_URL_HOST);
            if ($host) {
                $hosts[] = $host;
            }
        }
        
        // Add sanctum stateful domains
        $statefulDomains = config('sanctum.stateful', []);
        foreach ($statefulDomains as $domain) {
            $hosts[] = $domain;
        }
        
        return array_unique($hosts);
    }
    
    /**
     * Log CSRF failure
     */
    protected function logCsrfFailure(Request $request, string $reason): void
    {
        Log::warning('CSRF protection failure', [
            'reason' => $reason,
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'ip' => $request->ip(),
            'user_id' => auth()->id(),
            'user_agent' => $request->userAgent(),
            'origin' => $request->header('Origin'),
            'referer' => $request->header('Referer'),
        ]);
        
        // Increment failure counter
        $ip = $request->ip();
        $key = "csrf_failures:{$ip}";
        $failures = Cache::increment($key);
        Cache::put($key, $failures, now()->addHours(1)); // Set TTL to 1 hour
        
        // Block IP after too many failures
        if ($failures > 20) {
            Cache::put("csrf_blocked:{$ip}", true, now()->addHours(1));
            Log::critical('IP blocked for excessive CSRF failures', [
                'ip' => $ip,
                'failures' => $failures,
            ]);
        }
    }
    
    /**
     * Additional protection for sensitive operations
     */
    public function requireFreshToken(Request $request): void
    {
        $token = $this->getTokenFromRequest($request);
        
        if (!$token) {
            throw new TokenMismatchException('CSRF token required for this operation.');
        }
        
        // Check if token is fresh (generated within last 5 minutes)
        $tokenAge = Cache::get("csrf_token_age:{$token}");
        
        if (!$tokenAge || now()->diffInMinutes($tokenAge) > 5) {
            throw new TokenMismatchException('Fresh CSRF token required for this operation.');
        }
    }
}