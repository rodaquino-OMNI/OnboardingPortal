<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Services\PerformanceOptimizationService;
use Symfony\Component\HttpFoundation\Response;

/**
 * ApiPerformanceMiddleware
 * 
 * Optimizes API performance through:
 * - Response caching
 * - Database connection optimization
 * - Request/response monitoring
 * - Memory optimization
 */
class ApiPerformanceMiddleware
{
    protected $performanceService;

    public function __construct(PerformanceOptimizationService $performanceService)
    {
        $this->performanceService = $performanceService;
    }

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $startTime = microtime(true);
        $startMemory = memory_get_usage();

        // Generate unique request ID for tracking
        $requestId = uniqid('req_', true);
        $request->attributes->set('request_id', $requestId);

        // Check for cached response (GET requests only)
        if ($request->isMethod('GET') && $this->isCacheableEndpoint($request)) {
            $cachedResponse = $this->getCachedResponse($request);
            if ($cachedResponse) {
                return $this->buildCachedResponse($cachedResponse, $startTime, $requestId);
            }
        }

        // Optimize database connection before processing (with fallback)
        try {
            $this->performanceService->optimizeDatabaseConnection();
        } catch (\Exception $e) {
            Log::warning('Database optimization failed: ' . $e->getMessage());
        }

        // Process the request
        $response = $next($request);

        // Calculate performance metrics
        $executionTime = (microtime(true) - $startTime) * 1000; // ms
        $memoryUsed = memory_get_usage() - $startMemory;

        // Cache successful GET responses
        if ($request->isMethod('GET') && 
            $response->getStatusCode() === 200 && 
            $this->isCacheableEndpoint($request)) {
            $this->cacheResponse($request, $response);
        }

        // Add performance headers
        $response->headers->set('X-Request-ID', $requestId);
        $response->headers->set('X-Response-Time', round($executionTime, 2) . 'ms');
        $response->headers->set('X-Memory-Usage', $this->formatBytes($memoryUsed));

        // Log performance metrics for slow requests
        if ($executionTime > 1000) { // Log requests over 1 second
            $this->logSlowRequest($request, $executionTime, $memoryUsed, $requestId);
        }

        // Log all auth endpoints for monitoring
        if ($this->isAuthEndpoint($request)) {
            $this->logAuthRequest($request, $executionTime, $response->getStatusCode(), $requestId);
        }

        return $response;
    }

    /**
     * Check if endpoint is cacheable
     */
    private function isCacheableEndpoint(Request $request): bool
    {
        $cacheableEndpoints = [
            'api/health',
            'api/gamification/badges',
            'api/gamification/progress',
            'api/auth/user',
        ];

        $path = ltrim($request->path(), '/');
        
        foreach ($cacheableEndpoints as $endpoint) {
            if (str_starts_with($path, $endpoint)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get cached response
     */
    private function getCachedResponse(Request $request): ?array
    {
        try {
            $cacheKey = $this->generateCacheKey($request);
            return Cache::get($cacheKey);
        } catch (\Exception $e) {
            Log::error('Failed to get cached response', [
                'error' => $e->getMessage(),
                'request' => $request->path()
            ]);
            return null;
        }
    }

    /**
     * Cache response
     */
    private function cacheResponse(Request $request, Response $response): void
    {
        try {
            $cacheKey = $this->generateCacheKey($request);
            $cacheData = [
                'content' => $response->getContent(),
                'status' => $response->getStatusCode(),
                'headers' => $response->headers->all(),
                'cached_at' => time()
            ];

            $ttl = $this->getCacheTTL($request);
            Cache::put($cacheKey, $cacheData, $ttl);

            Log::debug('Response cached', [
                'cache_key' => $cacheKey,
                'ttl' => $ttl,
                'endpoint' => $request->path()
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to cache response', [
                'error' => $e->getMessage(),
                'request' => $request->path()
            ]);
        }
    }

    /**
     * Build cached response
     */
    private function buildCachedResponse(array $cachedData, float $startTime, string $requestId): Response
    {
        $response = response($cachedData['content'], $cachedData['status']);
        
        // Add original headers
        foreach ($cachedData['headers'] as $name => $values) {
            if (!in_array(strtolower($name), ['date', 'cache-control', 'expires'])) {
                $response->headers->set($name, $values);
            }
        }

        // Add cache and performance headers
        $executionTime = (microtime(true) - $startTime) * 1000;
        $response->headers->set('X-Cache', 'HIT');
        $response->headers->set('X-Cache-Age', time() - $cachedData['cached_at']);
        $response->headers->set('X-Request-ID', $requestId);
        $response->headers->set('X-Response-Time', round($executionTime, 2) . 'ms');
        $response->headers->set('Cache-Control', 'public, max-age=300');

        return $response;
    }

    /**
     * Generate cache key for request
     */
    private function generateCacheKey(Request $request): string
    {
        $key = 'api_cache:' . $request->path();
        
        // Include query parameters in cache key
        if ($request->query()) {
            $key .= ':' . md5(serialize($request->query()));
        }

        // Include user ID for user-specific endpoints
        if ($request->user()) {
            $key .= ':user_' . $request->user()->id;
        }

        return $key;
    }

    /**
     * Get cache TTL based on endpoint
     */
    private function getCacheTTL(Request $request): int
    {
        $path = $request->path();

        // Different TTLs for different endpoints
        if (str_contains($path, 'health')) {
            return 60; // Health endpoints: 1 minute
        }
        
        if (str_contains($path, 'auth/user')) {
            return 300; // User data: 5 minutes
        }

        if (str_contains($path, 'gamification')) {
            return 600; // Gamification data: 10 minutes
        }

        return 300; // Default: 5 minutes
    }

    /**
     * Check if endpoint is authentication related
     */
    private function isAuthEndpoint(Request $request): bool
    {
        return str_starts_with($request->path(), 'api/auth/');
    }

    /**
     * Log slow request
     */
    private function logSlowRequest(Request $request, float $executionTime, int $memoryUsed, string $requestId): void
    {
        Log::warning('Slow API request detected', [
            'request_id' => $requestId,
            'method' => $request->method(),
            'path' => $request->path(),
            'execution_time' => round($executionTime, 2) . 'ms',
            'memory_used' => $this->formatBytes($memoryUsed),
            'user_id' => $request->user()?->id,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'query_params' => $request->query(),
        ]);
    }

    /**
     * Log auth request
     */
    private function logAuthRequest(Request $request, float $executionTime, int $statusCode, string $requestId): void
    {
        Log::info('Auth API request', [
            'request_id' => $requestId,
            'method' => $request->method(),
            'path' => $request->path(),
            'status_code' => $statusCode,
            'execution_time' => round($executionTime, 2) . 'ms',
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'success' => $statusCode === 200,
        ]);
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes . ' B';
        } elseif ($bytes < 1048576) {
            return round($bytes / 1024, 2) . ' KB';
        } else {
            return round($bytes / 1048576, 2) . ' MB';
        }
    }
}