<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response as ResponseAlias;

class ApiRateLimiter
{
    protected $limiter;

    public function __construct(RateLimiter $limiter)
    {
        $this->limiter = $limiter;
    }

    /**
     * Handle an incoming request with comprehensive rate limiting
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @param  string|null  $maxAttempts
     * @param  int  $decayMinutes
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next, $maxAttempts = null, $decayMinutes = 1): ResponseAlias
    {
        // Security: Enhanced request signature for better tracking
        $key = $this->resolveRequestSignature($request);
        
        // Get appropriate limits based on endpoint and user status
        $maxAttempts = $maxAttempts ?? $this->getMaxAttempts($request);
        $decayMinutes = $this->getDecayMinutes($request);

        // Check if rate limit exceeded
        if ($this->limiter->tooManyAttempts($key, $maxAttempts)) {
            // Log suspicious activity
            $this->logRateLimitViolation($request, $key, $maxAttempts);
            
            return $this->buildFailedResponse($key, $maxAttempts, $decayMinutes);
        }

        // Track the request
        $this->limiter->hit($key, $decayMinutes * 60);

        $response = $next($request);

        // Add rate limit headers only, security headers handled by SecurityHeadersMiddleware
        return $this->addRateLimitHeaders(
            $response,
            $maxAttempts,
            $this->calculateRemainingAttempts($key, $maxAttempts),
            $decayMinutes
        );
    }

    /**
     * Enhanced request signature resolution for security
     */
    protected function resolveRequestSignature(Request $request): string
    {
        $components = [
            // User identification (authenticated vs anonymous)
            $request->user()?->id ?? 'anonymous',
            // IP address with X-Forwarded-For consideration
            $this->getClientIp($request),
            // Route/endpoint identification
            $request->route()?->getName() ?? $request->path(),
            // HTTP method
            $request->method(),
            // User agent fingerprint (partial for basic bot detection)
            substr(md5($request->userAgent() ?? ''), 0, 8)
        ];
        
        return 'api_rate_limit:' . sha1(implode('|', $components));
    }

    /**
     * Get real client IP considering proxies
     */
    protected function getClientIp(Request $request): string
    {
        // Security: Check for real IP behind proxies/load balancers
        $ip = $request->header('X-Forwarded-For');
        if ($ip) {
            // Take first IP in comma-separated list
            $ip = explode(',', $ip)[0];
            $ip = trim($ip);
        }
        
        return $ip ?: $request->ip();
    }

    /**
     * Intelligent rate limiting based on endpoint sensitivity and user status
     */
    protected function getMaxAttempts(Request $request): int
    {
        $endpoint = $request->route()?->getName() ?? '';
        $path = $request->path();
        $isAuthenticated = $request->user() !== null;

        // Security-critical endpoints (stricter limits)
        if ($this->isCriticalEndpoint($endpoint, $path)) {
            return $isAuthenticated ? 30 : 15; // Authenticated: 30/min, Anonymous: 15/min
        }

        // Authentication endpoints (moderate limits)
        if ($this->isAuthEndpoint($endpoint, $path)) {
            return $isAuthenticated ? 40 : 20; // Authenticated: 40/min, Anonymous: 20/min
        }

        // Data submission endpoints (careful limits)
        if ($this->isSubmissionEndpoint($endpoint, $path)) {
            return $isAuthenticated ? 50 : 25; // Authenticated: 50/min, Anonymous: 25/min
        }

        // Public read endpoints (generous limits)
        if ($this->isReadOnlyEndpoint($endpoint, $path)) {
            return $isAuthenticated ? 100 : 60; // Authenticated: 100/min, Anonymous: 60/min
        }

        // Default API limits
        return $isAuthenticated ? 60 : 30; // Authenticated: 60/min, Anonymous: 30/min
    }

    /**
     * Check if endpoint is security-critical
     */
    protected function isCriticalEndpoint(string $endpoint, string $path): bool
    {
        $criticalPatterns = [
            'admin',
            'password',
            'reset',
            'logout',
            'delete',
            'remove',
            'destroy',
            'emergency',
            'critical'
        ];

        foreach ($criticalPatterns as $pattern) {
            if (str_contains($endpoint, $pattern) || str_contains($path, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if endpoint is authentication-related
     */
    protected function isAuthEndpoint(string $endpoint, string $path): bool
    {
        $authPatterns = ['auth', 'login', 'register', 'verify', 'token'];

        foreach ($authPatterns as $pattern) {
            if (str_contains($endpoint, $pattern) || str_contains($path, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if endpoint involves data submission
     */
    protected function isSubmissionEndpoint(string $endpoint, string $path): bool
    {
        $submissionPatterns = ['submit', 'create', 'store', 'upload', 'post', 'save'];

        foreach ($submissionPatterns as $pattern) {
            if (str_contains($endpoint, $pattern) || str_contains($path, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if endpoint is read-only
     */
    protected function isReadOnlyEndpoint(string $endpoint, string $path): bool
    {
        $readPatterns = ['get', 'show', 'index', 'list', 'search', 'browse', 'view'];

        foreach ($readPatterns as $pattern) {
            if (str_contains($endpoint, $pattern) || str_contains($path, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get decay window based on endpoint sensitivity
     */
    protected function getDecayMinutes(Request $request): int
    {
        $endpoint = $request->route()?->getName() ?? '';
        $path = $request->path();

        // Critical endpoints: longer cooldown
        if ($this->isCriticalEndpoint($endpoint, $path)) {
            return 5; // 5-minute window
        }

        // Auth endpoints: moderate cooldown
        if ($this->isAuthEndpoint($endpoint, $path)) {
            return 2; // 2-minute window
        }

        return 1; // Default: 1-minute window
    }

    /**
     * Log rate limit violations for security monitoring
     */
    protected function logRateLimitViolation(Request $request, string $key, int $maxAttempts): void
    {
        Log::warning('API Rate Limit Exceeded', [
            'ip' => $this->getClientIp($request),
            'user_id' => $request->user()?->id,
            'endpoint' => $request->route()?->getName() ?? $request->path(),
            'method' => $request->method(),
            'user_agent' => $request->userAgent(),
            'max_attempts' => $maxAttempts,
            'key' => $key,
            'timestamp' => now()->toISOString()
        ]);
    }

    /**
     * Build comprehensive failed response
     */
    protected function buildFailedResponse(string $key, int $maxAttempts, int $decayMinutes): ResponseAlias
    {
        $retryAfter = $this->limiter->availableIn($key);
        
        return response()->json([
            'success' => false,
            'error' => 'RATE_LIMIT_EXCEEDED',
            'message' => 'Too many requests. Please slow down and try again later.',
            'details' => [
                'max_attempts_per_window' => $maxAttempts,
                'window_minutes' => $decayMinutes,
                'retry_after_seconds' => $retryAfter,
                'current_time' => now()->toISOString()
            ]
        ], 429)->withHeaders([
            'Retry-After' => $retryAfter,
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => 0,
            'X-RateLimit-Reset' => now()->addSeconds($retryAfter)->getTimestamp(),
        ]);
    }

    /**
     * Calculate remaining attempts
     */
    protected function calculateRemainingAttempts(string $key, int $maxAttempts): int
    {
        return max(0, $this->limiter->retriesLeft($key, $maxAttempts));
    }

    /**
     * Add rate limit headers only
     */
    protected function addRateLimitHeaders(ResponseAlias $response, int $maxAttempts, int $remainingAttempts, int $decayMinutes): ResponseAlias
    {
        $headers = [
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => $remainingAttempts,
            'X-RateLimit-Reset' => now()->addMinutes($decayMinutes)->getTimestamp(),
        ];

        $response->headers->add($headers);
        return $response;
    }
}