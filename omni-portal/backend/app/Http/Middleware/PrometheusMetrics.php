<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class PrometheusMetrics
{
    private static $metrics = [];
    private static $startTime;

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        self::$startTime = microtime(true);
        
        $response = $next($request);
        
        $this->recordMetrics($request, $response);
        
        return $response;
    }

    /**
     * Record metrics for the request
     */
    private function recordMetrics(Request $request, Response $response): void
    {
        $duration = microtime(true) - self::$startTime;
        $route = $request->route()?->getName() ?? 'unknown';
        $method = $request->method();
        $status = $response->getStatusCode();
        
        // Store metrics in static array for later export
        self::$metrics[] = [
            'name' => 'laravel_http_requests_total',
            'type' => 'counter',
            'value' => 1,
            'labels' => [
                'method' => $method,
                'route' => $route,
                'status' => $status
            ]
        ];
        
        self::$metrics[] = [
            'name' => 'laravel_http_request_duration_seconds',
            'type' => 'histogram',
            'value' => $duration,
            'labels' => [
                'method' => $method,
                'route' => $route
            ]
        ];
        
        // Memory usage
        self::$metrics[] = [
            'name' => 'laravel_memory_usage_bytes',
            'type' => 'gauge',
            'value' => memory_get_peak_usage(true),
            'labels' => []
        ];
    }

    /**
     * Get all collected metrics in Prometheus format
     */
    public static function getMetrics(): string
    {
        $output = [];
        
        // Add application metrics
        $output[] = self::formatMetrics();
        
        // Add database metrics
        $output[] = self::getDatabaseMetrics();
        
        // Add cache metrics
        $output[] = self::getCacheMetrics();
        
        // Add queue metrics
        $output[] = self::getQueueMetrics();
        
        // Add active users metric
        $output[] = self::getActiveUsersMetric();
        
        return implode("\n", array_filter($output));
    }

    /**
     * Format metrics array into Prometheus format
     */
    private static function formatMetrics(): string
    {
        $grouped = [];
        
        foreach (self::$metrics as $metric) {
            $key = $metric['name'] . '_' . $metric['type'];
            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'name' => $metric['name'],
                    'type' => $metric['type'],
                    'help' => self::getMetricHelp($metric['name']),
                    'values' => []
                ];
            }
            $grouped[$key]['values'][] = $metric;
        }
        
        $output = [];
        foreach ($grouped as $metric) {
            $output[] = "# HELP {$metric['name']} {$metric['help']}";
            $output[] = "# TYPE {$metric['name']} {$metric['type']}";
            
            foreach ($metric['values'] as $value) {
                $labels = '';
                if (!empty($value['labels'])) {
                    $labelPairs = [];
                    foreach ($value['labels'] as $key => $val) {
                        $labelPairs[] = $key . '="' . addslashes($val) . '"';
                    }
                    $labels = '{' . implode(',', $labelPairs) . '}';
                }
                $output[] = "{$metric['name']}{$labels} {$value['value']}";
            }
        }
        
        return implode("\n", $output);
    }

    /**
     * Get database connection metrics
     */
    private static function getDatabaseMetrics(): string
    {
        try {
            $connectionCount = count(DB::getConnections());
            $output = [];
            
            $output[] = "# HELP laravel_database_connections Database connections count";
            $output[] = "# TYPE laravel_database_connections gauge";
            $output[] = "laravel_database_connections {$connectionCount}";
            
            // Test database connectivity
            DB::connection()->getPdo();
            $output[] = "# HELP laravel_database_up Database connectivity status";
            $output[] = "# TYPE laravel_database_up gauge";
            $output[] = "laravel_database_up 1";
            
            return implode("\n", $output);
        } catch (\Exception $e) {
            return "laravel_database_up 0";
        }
    }

    /**
     * Get cache metrics
     */
    private static function getCacheMetrics(): string
    {
        try {
            $output = [];
            
            // Test cache connectivity
            Cache::put('prometheus_test', 'test', 1);
            $testValue = Cache::get('prometheus_test');
            $cacheUp = $testValue === 'test' ? 1 : 0;
            
            $output[] = "# HELP laravel_cache_up Cache connectivity status";
            $output[] = "# TYPE laravel_cache_up gauge";
            $output[] = "laravel_cache_up {$cacheUp}";
            
            return implode("\n", $output);
        } catch (\Exception $e) {
            return "laravel_cache_up 0";
        }
    }

    /**
     * Get queue metrics
     */
    private static function getQueueMetrics(): string
    {
        try {
            $output = [];
            
            // Basic queue metrics (would need Horizon for detailed metrics)
            $output[] = "# HELP laravel_queue_jobs_pending Pending queue jobs";
            $output[] = "# TYPE laravel_queue_jobs_pending gauge";
            $output[] = "laravel_queue_jobs_pending 0";  // Placeholder
            
            $output[] = "# HELP laravel_queue_jobs_processed_total Total processed queue jobs";
            $output[] = "# TYPE laravel_queue_jobs_processed_total counter";
            $output[] = "laravel_queue_jobs_processed_total 0";  // Placeholder
            
            $output[] = "# HELP laravel_queue_jobs_failed_total Total failed queue jobs";
            $output[] = "# TYPE laravel_queue_jobs_failed_total counter";
            $output[] = "laravel_queue_jobs_failed_total 0";  // Placeholder
            
            return implode("\n", $output);
        } catch (\Exception $e) {
            return "";
        }
    }

    /**
     * Get active users metric
     */
    private static function getActiveUsersMetric(): string
    {
        try {
            // Count unique users in the last 5 minutes based on session activity
            $activeUsers = DB::table('sessions')
                ->where('last_activity', '>', time() - 300)
                ->distinct()
                ->count('user_id');
            
            $output = [];
            $output[] = "# HELP laravel_active_users_total Currently active users";
            $output[] = "# TYPE laravel_active_users_total gauge";
            $output[] = "laravel_active_users_total {$activeUsers}";
            
            return implode("\n", $output);
        } catch (\Exception $e) {
            return "laravel_active_users_total 0";
        }
    }

    /**
     * Get help text for metric names
     */
    private static function getMetricHelp(string $name): string
    {
        $helps = [
            'laravel_http_requests_total' => 'Total number of HTTP requests',
            'laravel_http_request_duration_seconds' => 'HTTP request duration in seconds',
            'laravel_memory_usage_bytes' => 'Memory usage in bytes',
        ];
        
        return $helps[$name] ?? 'Application metric';
    }

    /**
     * Clear collected metrics
     */
    public static function clearMetrics(): void
    {
        self::$metrics = [];
    }
}