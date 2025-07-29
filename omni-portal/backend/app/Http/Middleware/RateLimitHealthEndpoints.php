<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as ResponseAlias;

class RateLimitHealthEndpoints
{
    protected $limiter;

    public function __construct(RateLimiter $limiter)
    {
        $this->limiter = $limiter;
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next): ResponseAlias
    {
        // Enhanced rate limiting for health endpoints
        $key = $this->resolveRequestSignature($request);
        
        // Different limits based on endpoint sensitivity
        $maxAttempts = $this->getMaxAttempts($request);
        $decayMinutes = $this->getDecayMinutes($request);

        if ($this->limiter->tooManyAttempts($key, $maxAttempts)) {
            return $this->buildFailedResponse($key, $maxAttempts);
        }

        $this->limiter->hit($key, $decayMinutes * 60);

        $response = $next($request);

        return $this->addHeaders(
            $response,
            $maxAttempts,
            $this->calculateRemainingAttempts($key, $maxAttempts)
        );
    }

    /**
     * Resolve the request signature for rate limiting
     */
    protected function resolveRequestSignature(Request $request): string
    {
        $userId = $request->user()?->id ?? 'anonymous';
        $ip = $request->ip();
        $endpoint = $request->route()?->getName() ?? $request->path();
        
        return sha1($userId . '|' . $ip . '|' . $endpoint);
    }

    /**
     * Get max attempts based on endpoint sensitivity
     */
    protected function getMaxAttempts(Request $request): int
    {
        $endpoint = $request->route()?->getName() ?? '';
        
        // Stricter limits for sensitive health operations
        if (str_contains($endpoint, 'emergency') || str_contains($endpoint, 'critical')) {
            return 10; // Emergency endpoints: 10 requests per minute
        }
        
        if (str_contains($endpoint, 'submit') || str_contains($endpoint, 'complete')) {
            return 20; // Submission endpoints: 20 requests per minute
        }
        
        if (str_contains($endpoint, 'health')) {
            return 60; // General health endpoints: 60 requests per minute
        }
        
        return 100; // Default: 100 requests per minute
    }

    /**
     * Get decay minutes based on endpoint
     */
    protected function getDecayMinutes(Request $request): int
    {
        $endpoint = $request->route()?->getName() ?? '';
        
        // Longer cooldown for emergency endpoints
        if (str_contains($endpoint, 'emergency')) {
            return 5; // 5 minute cooldown
        }
        
        return 1; // Default: 1 minute window
    }

    /**
     * Build the failed response
     */
    protected function buildFailedResponse(string $key, int $maxAttempts): Response
    {
        $retryAfter = $this->limiter->availableIn($key);
        
        return response()->json([
            'success' => false,
            'message' => 'Too many requests to health endpoints. Please wait before trying again.',
            'retry_after' => $retryAfter,
            'max_attempts' => $maxAttempts
        ], 429)->withHeaders([
            'Retry-After' => $retryAfter,
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => 0,
        ]);
    }

    /**
     * Calculate remaining attempts
     */
    protected function calculateRemainingAttempts(string $key, int $maxAttempts): int
    {
        return $this->limiter->retriesLeft($key, $maxAttempts);
    }

    /**
     * Add rate limit headers to response
     */
    protected function addHeaders(ResponseAlias $response, int $maxAttempts, int $remainingAttempts): ResponseAlias
    {
        $response->headers->add([
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => $remainingAttempts,
        ]);

        return $response;
    }
}