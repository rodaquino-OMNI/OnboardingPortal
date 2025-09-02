<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\PrometheusMetrics;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Exceptions\HttpResponseException;

class MetricsController extends Controller
{
    /**
     * Default whitelisted IP addresses for metrics access in production
     */
    private const METRICS_DEFAULT_ALLOWED_IPS = [
        '127.0.0.1',
        '::1',
        'localhost',
    ];

    public function __construct()
    {
        // Apply authentication middleware for ALL metrics endpoints
        $this->middleware('auth:sanctum');
        $this->middleware('admin.access'); // Require admin access
        $this->middleware(function ($request, $next) {
            $this->validateMetricsAccess($request);
            return $next($request);
        });
    }

    /**
     * Validate metrics access with IP whitelisting and additional rate limiting
     */
    private function validateMetricsAccess(Request $request): void
    {
        $clientIp = $request->ip();
        
        // Additional rate limiting for metrics endpoint (more restrictive than route-level)
        $rateLimit = config('auth_security.metrics.rate_limit', 5);
        $rateLimitKey = 'api_metrics:' . $clientIp;
        if (RateLimiter::tooManyAttempts($rateLimitKey, $rateLimit)) {
            throw new HttpResponseException(
                response()->json([
                    'error' => 'Too Many Requests to Metrics Endpoint',
                    'retry_after' => RateLimiter::availableIn($rateLimitKey),
                    'client_ip' => $clientIp
                ], 429)->header('Retry-After', RateLimiter::availableIn($rateLimitKey))
            );
        }
        RateLimiter::hit($rateLimitKey, 60); // Per minute
        
        // Environment-based IP validation for production
        if (app()->environment('production')) {
            $allowedIps = array_merge(
                self::METRICS_DEFAULT_ALLOWED_IPS,
                config('auth_security.metrics.allowed_ips', [])
            );
            
            if (!empty($allowedIps) && !in_array($clientIp, $allowedIps, true)) {
                \Log::warning('Unauthorized metrics access attempt', [
                    'ip' => $clientIp,
                    'user_agent' => $request->userAgent(),
                    'timestamp' => now()
                ]);
                
                throw new HttpResponseException(
                    response()->json([
                        'error' => 'Forbidden - Access denied',
                        'message' => 'Metrics access is restricted in production'
                    ], 403)
                );
            }
        }
    }

    /**
     * Export Prometheus metrics - SECURED
     */
    public function metrics(): Response
    {
        $metrics = PrometheusMetrics::getMetrics();
        
        return response($metrics, 200, [
            'Content-Type' => 'text/plain; version=0.0.4; charset=utf-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'X-XSS-Protection' => '1; mode=block'
        ]);
    }

    /**
     * Application health endpoint
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'version' => config('app.version', '1.0.0'),
            'environment' => config('app.env'),
            'uptime' => $this->getUptime(),
            'checks' => [
                'database' => $this->checkDatabase(),
                'cache' => $this->checkCache(),
                'storage' => $this->checkStorage(),
            ]
        ]);
    }

    /**
     * Detailed status endpoint
     */
    public function status(): JsonResponse
    {
        return response()->json([
            'application' => [
                'name' => config('app.name'),
                'version' => config('app.version', '1.0.0'),
                'environment' => config('app.env'),
                'debug' => config('app.debug'),
                'timezone' => config('app.timezone'),
                'locale' => config('app.locale'),
            ],
            'system' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'memory_usage' => memory_get_usage(true),
                'memory_peak' => memory_get_peak_usage(true),
                'uptime' => $this->getUptime(),
            ],
            'services' => [
                'database' => $this->getDatabaseStatus(),
                'cache' => $this->getCacheStatus(),
                'queue' => $this->getQueueStatus(),
                'storage' => $this->getStorageStatus(),
            ],
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * Get application uptime
     */
    private function getUptime(): int
    {
        $uptimeFile = storage_path('framework/uptime');
        
        if (!file_exists($uptimeFile)) {
            file_put_contents($uptimeFile, time());
        }
        
        $startTime = (int) file_get_contents($uptimeFile);
        return time() - $startTime;
    }

    /**
     * Check database connectivity
     */
    private function checkDatabase(): array
    {
        try {
            \DB::connection()->getPdo();
            return [
                'status' => 'healthy',
                'connection' => 'ok',
                'driver' => config('database.default'),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check cache connectivity
     */
    private function checkCache(): array
    {
        try {
            \Cache::put('health_check', 'test', 5);
            $value = \Cache::get('health_check');
            
            return [
                'status' => $value === 'test' ? 'healthy' : 'unhealthy',
                'driver' => config('cache.default'),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check storage accessibility
     */
    private function checkStorage(): array
    {
        try {
            $testFile = storage_path('health_check.tmp');
            file_put_contents($testFile, 'test');
            $content = file_get_contents($testFile);
            unlink($testFile);
            
            return [
                'status' => $content === 'test' ? 'healthy' : 'unhealthy',
                'writable' => is_writable(storage_path()),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get detailed database status
     */
    private function getDatabaseStatus(): array
    {
        try {
            $connection = \DB::connection();
            $pdo = $connection->getPdo();
            
            return [
                'status' => 'connected',
                'driver' => $connection->getDriverName(),
                'database' => $connection->getDatabaseName(),
                'server_version' => $pdo->getAttribute(\PDO::ATTR_SERVER_VERSION),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'disconnected',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get cache status
     */
    private function getCacheStatus(): array
    {
        try {
            $driver = config('cache.default');
            \Cache::put('status_check', time(), 1);
            
            return [
                'status' => 'connected',
                'driver' => $driver,
                'prefix' => config("cache.stores.{$driver}.prefix"),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'disconnected',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get queue status
     */
    private function getQueueStatus(): array
    {
        try {
            return [
                'status' => 'running',
                'driver' => config('queue.default'),
                'connection' => config('queue.connections.' . config('queue.default')),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get storage status
     */
    private function getStorageStatus(): array
    {
        try {
            $storagePath = storage_path();
            $publicPath = public_path();
            
            return [
                'status' => 'accessible',
                'storage_writable' => is_writable($storagePath),
                'public_writable' => is_writable($publicPath),
                'disk_space' => [
                    'free' => disk_free_space($storagePath),
                    'total' => disk_total_space($storagePath),
                ],
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'error' => $e->getMessage(),
            ];
        }
    }
}