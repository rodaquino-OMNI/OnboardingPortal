<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

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
        
        // Check database
        $dbStart = microtime(true);
        DB::select('SELECT 1');
        $checks['database'] = [
            'status' => 'ok',
            'response_time' => round((microtime(true) - $dbStart) * 1000, 2) . 'ms'
        ];
        
        // Check Redis
        $redisStart = microtime(true);
        Redis::ping();
        $checks['cache'] = [
            'status' => 'ok',
            'response_time' => round((microtime(true) - $redisStart) * 1000, 2) . 'ms'
        ];
        
        // Check storage
        $storageWritable = is_writable(storage_path());
        $checks['storage'] = [
            'status' => $storageWritable ? 'ok' : 'fail',
            'writable' => $storageWritable
        ];
        
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'checks' => $checks
        ], 200);
        
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'unhealthy',
            'timestamp' => now()->toISOString(),
            'error' => $e->getMessage()
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

Route::get('/health/live', function () {
    // Simple liveness check - just return OK if Laravel is running
    return response()->json([
        'status' => 'alive',
        'timestamp' => now()->toISOString()
    ], 200);
});