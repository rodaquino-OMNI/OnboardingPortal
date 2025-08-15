<?php
/**
 * Laravel Health Check Script for Docker
 * Checks database, cache, and application status
 */

try {
    // Check if Laravel can bootstrap
    require_once __DIR__ . '/../vendor/autoload.php';
    $app = require_once __DIR__ . '/../bootstrap/app.php';
    
    // Boot the application
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();
    
    // Check database connection
    $pdo = DB::connection()->getPdo();
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }
    
    // Simple database query
    $result = DB::select('SELECT 1 as test');
    if (empty($result) || $result[0]->test !== 1) {
        throw new Exception('Database query failed');
    }
    
    // Check Redis connection
    try {
        $redis = \Illuminate\Support\Facades\Redis::connection();
        $redis->ping();
    } catch (Exception $e) {
        throw new Exception('Redis connection failed: ' . $e->getMessage());
    }
    
    // Check if storage directory is writable
    $storageDir = storage_path();
    if (!is_writable($storageDir)) {
        throw new Exception('Storage directory not writable');
    }
    
    // Check if cache directory is writable
    $cacheDir = storage_path('framework/cache');
    if (!is_writable($cacheDir)) {
        throw new Exception('Cache directory not writable');
    }
    
    echo "OK: All health checks passed\n";
    exit(0);
    
} catch (Exception $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
    exit(1);
} catch (Throwable $t) {
    echo "FAIL: " . $t->getMessage() . "\n";
    exit(1);
}