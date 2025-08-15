<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use App\Http\Controllers\Api\HealthController;

/*
|--------------------------------------------------------------------------
| Health Check Routes
|--------------------------------------------------------------------------
|
| Simple health check endpoints for Docker health checks and monitoring
|
*/

Route::get('/health', function (Request $request) {
    try {
        $checks = [];
        $overallHealthy = true;
        
        // Check database with connection details
        $dbStart = microtime(true);
        try {
            DB::connection()->getPdo();
            DB::select('SELECT 1');
            $checks['database'] = [
                'status' => 'healthy',
                'response_time' => round((microtime(true) - $dbStart) * 1000, 2) . 'ms',
                'driver' => config('database.default'),
                'host' => config('database.connections.' . config('database.default') . '.host')
            ];
        } catch (\Exception $e) {
            $checks['database'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage()
            ];
            $overallHealthy = false;
        }
        
        // Check Redis with detailed connection info
        $redisStart = microtime(true);
        try {
            Redis::ping();
            $checks['redis'] = [
                'status' => 'healthy',
                'response_time' => round((microtime(true) - $redisStart) * 1000, 2) . 'ms',
                'host' => config('database.redis.default.host'),
                'port' => config('database.redis.default.port')
            ];
        } catch (\Exception $e) {
            $checks['redis'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage()
            ];
            $overallHealthy = false;
        }
        
        // Check storage with more details
        $storageWritable = is_writable(storage_path());
        $checks['storage'] = [
            'status' => $storageWritable ? 'healthy' : 'unhealthy',
            'writable' => $storageWritable,
            'path' => storage_path(),
            'disk_space' => disk_free_space(storage_path())
        ];
        if (!$storageWritable) {
            $overallHealthy = false;
        }
        
        // Check PHP-FPM status
        $checks['php_fpm'] = [
            'status' => 'healthy',
            'version' => PHP_VERSION,
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time')
        ];
        
        // Check application
        $checks['application'] = [
            'status' => 'healthy',
            'laravel_version' => app()->version(),
            'environment' => config('app.env'),
            'debug' => config('app.debug')
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
});

Route::get('/health/ready', function () {
    try {
        // Quick readiness check
        DB::select('SELECT 1');
        Redis::ping();
        
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
});

// Use dedicated health controller for better organization
Route::get('/health/detailed', [HealthController::class, 'health']);
Route::get('/health/live', [HealthController::class, 'live']);
Route::get('/health/ready', [HealthController::class, 'ready']);