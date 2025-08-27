<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Artisan;

class HealthController extends Controller
{
    /**
     * Comprehensive health check endpoint
     */
    public function health()
    {
        try {
            $checks = [];
            $overallHealthy = true;

            // Database health check
            $dbStart = microtime(true);
            try {
                DB::connection()->getPdo();
                DB::select('SELECT 1');
                $driver = config('database.default');
                $connectionConfig = config('database.connections.' . $driver);
                
                $checks['database'] = [
                    'status' => 'healthy',
                    'response_time' => round((microtime(true) - $dbStart) * 1000, 2) . 'ms',
                    'driver' => $driver
                ];
                
                // Add connection-specific details
                if ($driver === 'sqlite') {
                    $checks['database']['database'] = $connectionConfig['database'] ?? 'N/A';
                } else {
                    $checks['database']['host'] = $connectionConfig['host'] ?? 'N/A';
                    $checks['database']['port'] = $connectionConfig['port'] ?? 'N/A';
                }
            } catch (\Exception $e) {
                $checks['database'] = [
                    'status' => 'unhealthy',
                    'error' => $e->getMessage()
                ];
                $overallHealthy = false;
            }

            // Redis health check (optional in development)
            $redisStart = microtime(true);
            try {
                if (class_exists('\Redis') && extension_loaded('redis')) {
                    Redis::ping();
                    $checks['redis'] = [
                        'status' => 'healthy',
                        'response_time' => round((microtime(true) - $redisStart) * 1000, 2) . 'ms',
                        'host' => config('database.redis.default.host'),
                        'port' => config('database.redis.default.port')
                    ];
                } else {
                    $checks['redis'] = [
                        'status' => 'unavailable',
                        'message' => 'Redis extension not installed - using file cache'
                    ];
                }
            } catch (\Exception $e) {
                $checks['redis'] = [
                    'status' => 'unavailable',
                    'error' => $e->getMessage(),
                    'message' => 'Redis unavailable - using fallback cache'
                ];
                // Don't mark overall health as unhealthy for Redis in development
                if (config('app.env') === 'production') {
                    $overallHealthy = false;
                }
            }

            // Storage health check
            $storageWritable = is_writable(storage_path());
            $checks['storage'] = [
                'status' => $storageWritable ? 'healthy' : 'unhealthy',
                'writable' => $storageWritable,
                'path' => storage_path(),
                'free_space' => $this->formatBytes(disk_free_space(storage_path()))
            ];
            if (!$storageWritable) {
                $overallHealthy = false;
            }

            // Application health check
            $checks['application'] = [
                'status' => 'healthy',
                'laravel_version' => app()->version(),
                'php_version' => PHP_VERSION,
                'environment' => config('app.env'),
                'debug' => config('app.debug')
            ];

            // Memory usage check
            $memoryUsage = memory_get_usage(true);
            $memoryPeak = memory_get_peak_usage(true);
            $checks['memory'] = [
                'status' => 'healthy',
                'current' => $this->formatBytes($memoryUsage),
                'peak' => $this->formatBytes($memoryPeak),
                'limit' => ini_get('memory_limit')
            ];

            return response()->json([
                'status' => $overallHealthy ? 'healthy' : 'unhealthy',
                'timestamp' => now()->toISOString(),
                'checks' => $checks
            ], $overallHealthy ? 200 : 503);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'unhealthy',
                'timestamp' => now()->toISOString(),
                'error' => $e->getMessage(),
                'trace' => config('app.debug') ? $e->getTraceAsString() : null
            ], 503);
        }
    }

    /**
     * Simple liveness check - no external dependencies
     */
    public function live()
    {
        return response()->json([
            'status' => 'alive',
            'timestamp' => now()->toISOString(),
            'service' => 'omni-portal-backend',
            'version' => config('app.version', '1.0.0'),
            'uptime' => $this->getUptime()
        ], 200);
    }

    /**
     * Readiness check - verifies all dependencies are working
     */
    public function ready()
    {
        try {
            // Quick checks for essential services
            DB::select('SELECT 1');
            
            // Only check Redis if available
            if (class_exists('\Redis') && extension_loaded('redis')) {
                try {
                    Redis::ping();
                } catch (\Exception $e) {
                    // Redis check failed but don't fail readiness in development
                    if (config('app.env') === 'production') {
                        throw $e;
                    }
                }
            }

            return response()->json([
                'status' => 'ready',
                'timestamp' => now()->toISOString()
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'not_ready',
                'timestamp' => now()->toISOString(),
                'error' => $e->getMessage()
            ], 503);
        }
    }

    /**
     * Get application uptime
     */
    private function getUptime()
    {
        $uptime = file_exists('/proc/uptime') ? 
            floatval(explode(' ', file_get_contents('/proc/uptime'))[0]) : 
            null;
        
        return $uptime ? round($uptime, 2) . 's' : 'unknown';
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes($bytes, $precision = 2)
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision) . ' ' . $units[$i];
    }
}