<?php

/**
 * Standalone script to run comprehensive tests
 * 
 * Usage:
 *   php tests/Scripts/run-comprehensive-tests.php
 * 
 * Or from Laravel:
 *   php artisan tinker
 *   require_once 'tests/Scripts/run-comprehensive-tests.php';
 */

// Determine if we're running from Laravel context or standalone
if (!function_exists('base_path')) {
    // Standalone execution - bootstrap Laravel
    require_once __DIR__ . '/../../vendor/autoload.php';
    
    $app = require_once __DIR__ . '/../../bootstrap/app.php';
    $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
}

// Ensure we're in testing environment
if (!app()->environment('testing', 'local')) {
    echo "⚠️  Warning: Not in testing environment. Some tests may affect live data.\n";
    echo "Current environment: " . app()->environment() . "\n";
    echo "Continue? (y/N): ";
    
    $handle = fopen("php://stdin", "r");
    $line = fgets($handle);
    fclose($handle);
    
    if (strtolower(trim($line)) !== 'y') {
        echo "Test execution cancelled.\n";
        exit(1);
    }
}

try {
    // Import the test runner
    require_once __DIR__ . '/ComprehensiveTestRunner.php';
    
    // Create and run the comprehensive test suite
    $runner = new \Tests\Scripts\ComprehensiveTestRunner();
    $results = $runner->runAllTests();
    
    // Exit with appropriate code
    $hasFailures = array_filter($results, fn($result) => $result['status'] === 'FAILED' || $result['status'] === 'ERROR');
    exit(empty($hasFailures) ? 0 : 1);
    
} catch (\Exception $e) {
    echo "\n❌ Fatal error running comprehensive tests:\n";
    echo $e->getMessage() . "\n";
    echo "\nStack trace:\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}