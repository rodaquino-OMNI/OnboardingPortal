<?php
/**
 * Queue Worker Health Check Script
 * Checks if queue worker is processing jobs properly
 */

try {
    // Check if Laravel can bootstrap
    $vendorPath = '/var/www/html/vendor/autoload.php';
    $appPath = '/var/www/html/bootstrap/app.php';
    
    if (!file_exists($vendorPath)) {
        throw new Exception('Vendor autoload not found at: ' . $vendorPath);
    }
    
    if (!file_exists($appPath)) {
        throw new Exception('Bootstrap app not found at: ' . $appPath);
    }
    
    require_once $vendorPath;
    $app = require_once $appPath;
    
    // Boot the application
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();
    
    // Check Redis connection for queue
    try {
        $redis = \Illuminate\Support\Facades\Redis::connection();
        $redis->ping();
    } catch (Exception $e) {
        throw new Exception('Queue Redis connection failed: ' . $e->getMessage());
    }
    
    // Check if queue is accessible
    $queueSize = \Illuminate\Support\Facades\Redis::connection()->llen('queues:default');
    if ($queueSize === false) {
        throw new Exception('Cannot access queue');
    }
    
    // Check if we can connect to the database (for failed jobs table)
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
    } catch (Exception $e) {
        throw new Exception('Database connection failed: ' . $e->getMessage());
    }
    
    echo "OK: Queue worker health check passed (queue size: $queueSize)\n";
    exit(0);
    
} catch (Exception $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
    exit(1);
} catch (Throwable $t) {
    echo "FAIL: " . $t->getMessage() . "\n";
    exit(1);
}