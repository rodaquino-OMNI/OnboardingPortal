<?php
/**
 * Scheduler Health Check Script
 * Checks if scheduler can run and access required resources
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
    
    // Check database connection
    try {
        $pdo = \Illuminate\Support\Facades\DB::connection()->getPdo();
        if (!$pdo) {
            throw new Exception('Database connection failed');
        }
    } catch (Exception $e) {
        throw new Exception('Database connection failed: ' . $e->getMessage());
    }
    
    // Check if schedule:list command works (basic scheduler functionality)
    try {
        $exitCode = \Illuminate\Support\Facades\Artisan::call('schedule:list');
        if ($exitCode !== 0) {
            throw new Exception('Schedule command failed with exit code: ' . $exitCode);
        }
    } catch (Exception $e) {
        throw new Exception('Scheduler test failed: ' . $e->getMessage());
    }
    
    // Check cache access
    try {
        \Illuminate\Support\Facades\Cache::put('scheduler_health_check', time(), 60);
        $value = \Illuminate\Support\Facades\Cache::get('scheduler_health_check');
        if (!$value) {
            throw new Exception('Cache access failed');
        }
    } catch (Exception $e) {
        throw new Exception('Cache check failed: ' . $e->getMessage());
    }
    
    echo "OK: Scheduler health check passed\n";
    exit(0);
    
} catch (Exception $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
    exit(1);
} catch (Throwable $t) {
    echo "FAIL: " . $t->getMessage() . "\n";
    exit(1);
}