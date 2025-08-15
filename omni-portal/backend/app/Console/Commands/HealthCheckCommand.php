<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;

class HealthCheckCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'health:check {--format=json}';

    /**
     * The console command description.
     */
    protected $description = 'Check the health of the application and its dependencies';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $checks = [];
        $overallHealthy = true;

        // Check database connectivity
        try {
            $start = microtime(true);
            DB::connection()->getPdo();
            DB::select('SELECT 1');
            $checks['database'] = [
                'status' => 'healthy',
                'response_time' => round((microtime(true) - $start) * 1000, 2) . 'ms',
                'driver' => config('database.default')
            ];
        } catch (\Exception $e) {
            $checks['database'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage()
            ];
            $overallHealthy = false;
        }

        // Check Redis connectivity
        try {
            $start = microtime(true);
            Redis::ping();
            $checks['redis'] = [
                'status' => 'healthy',
                'response_time' => round((microtime(true) - $start) * 1000, 2) . 'ms'
            ];
        } catch (\Exception $e) {
            $checks['redis'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage()
            ];
            $overallHealthy = false;
        }

        // Check storage
        $storageWritable = is_writable(storage_path());
        $checks['storage'] = [
            'status' => $storageWritable ? 'healthy' : 'unhealthy',
            'writable' => $storageWritable,
            'path' => storage_path()
        ];
        if (!$storageWritable) {
            $overallHealthy = false;
        }

        // Check critical directories
        $directories = [
            'logs' => storage_path('logs'),
            'app' => storage_path('app'),
            'framework' => storage_path('framework'),
            'cache' => storage_path('framework/cache')
        ];

        $directoryStatus = [];
        foreach ($directories as $name => $path) {
            $exists = is_dir($path);
            $writable = $exists && is_writable($path);
            $directoryStatus[$name] = [
                'exists' => $exists,
                'writable' => $writable,
                'path' => $path
            ];
            if (!$exists || !$writable) {
                $overallHealthy = false;
            }
        }
        $checks['directories'] = [
            'status' => $overallHealthy ? 'healthy' : 'unhealthy',
            'details' => $directoryStatus
        ];

        // Memory usage check
        $memoryUsage = memory_get_usage(true);
        $memoryPeak = memory_get_peak_usage(true);
        $memoryLimit = ini_get('memory_limit');
        
        $checks['memory'] = [
            'status' => 'healthy',
            'current' => $this->formatBytes($memoryUsage),
            'peak' => $this->formatBytes($memoryPeak),
            'limit' => $memoryLimit
        ];

        $result = [
            'status' => $overallHealthy ? 'healthy' : 'unhealthy',
            'timestamp' => now()->toISOString(),
            'checks' => $checks
        ];

        if ($this->option('format') === 'json') {
            $this->line(json_encode($result, JSON_PRETTY_PRINT));
        } else {
            $this->info('Health Check Results:');
            $this->info('Overall Status: ' . $result['status']);
            foreach ($checks as $service => $check) {
                $this->line("$service: " . $check['status']);
            }
        }

        return $overallHealthy ? 0 : 1;
    }

    private function formatBytes($bytes, $precision = 2)
    {
        $units = array('B', 'KB', 'MB', 'GB', 'TB');

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision) . ' ' . $units[$i];
    }
}