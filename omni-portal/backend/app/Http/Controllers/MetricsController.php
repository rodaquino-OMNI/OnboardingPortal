<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Exceptions\HttpResponseException;

class MetricsController extends Controller
{
    /**
     * Default whitelisted IP addresses for metrics access
     */
    private const METRICS_DEFAULT_ALLOWED_IPS = [
        '127.0.0.1',
        '::1',
        'localhost',
    ];

    public function __construct()
    {
        // Apply authentication middleware for metrics endpoint
        $this->middleware('auth:sanctum')->except([]);
        $this->middleware(function ($request, $next) {
            $this->validateMetricsAccess($request);
            return $next($request);
        });
    }

    /**
     * Validate metrics access with IP whitelisting and rate limiting
     */
    private function validateMetricsAccess(Request $request): void
    {
        $clientIp = $request->ip();
        
        // Rate limiting for metrics endpoint
        $rateLimit = config('auth_security.metrics.rate_limit', 10);
        $rateLimitKey = 'metrics:' . $clientIp;
        if (RateLimiter::tooManyAttempts($rateLimitKey, $rateLimit)) {
            throw new HttpResponseException(
                response('Too Many Requests', 429)
                    ->header('Retry-After', RateLimiter::availableIn($rateLimitKey))
            );
        }
        RateLimiter::hit($rateLimitKey, 60); // Per minute
        
        // Environment-based IP validation
        if (app()->environment('production')) {
            $allowedIps = array_merge(
                self::METRICS_DEFAULT_ALLOWED_IPS,
                config('auth_security.metrics.allowed_ips', [])
            );
            
            if (!in_array($clientIp, $allowedIps, true)) {
                throw new HttpResponseException(
                    response('Forbidden - Access denied from IP: ' . $clientIp, 403)
                );
            }
        }
    }

    public function index(Request $request): Response
    {
        $metrics = [];
        
        // Application info
        $metrics[] = '# HELP laravel_info Laravel application information';
        $metrics[] = '# TYPE laravel_info gauge';
        $metrics[] = sprintf('laravel_info{version="%s",environment="%s"} 1', 
            config('app.version', '1.0.0'),
            app()->environment()
        );
        
        // Memory usage
        $metrics[] = '# HELP php_memory_usage_bytes Current memory usage';
        $metrics[] = '# TYPE php_memory_usage_bytes gauge';
        $metrics[] = sprintf('php_memory_usage_bytes %d', memory_get_usage(true));
        
        // OPcache metrics
        if (function_exists('opcache_get_status')) {
            $opcacheStatus = opcache_get_status(false);
            if ($opcacheStatus) {
                $metrics[] = '# HELP php_opcache_memory_used_bytes OPcache memory used';
                $metrics[] = '# TYPE php_opcache_memory_used_bytes gauge';
                $metrics[] = sprintf('php_opcache_memory_used_bytes %d', 
                    $opcacheStatus['memory_usage']['used_memory'] ?? 0
                );
            }
        }
        
        return response(implode("\n", $metrics), 200)
            ->header('Content-Type', 'text/plain; version=0.0.4')
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('X-Content-Type-Options', 'nosniff')
            ->header('X-Frame-Options', 'DENY')
            ->header('X-XSS-Protection', '1; mode=block');
    }
}
