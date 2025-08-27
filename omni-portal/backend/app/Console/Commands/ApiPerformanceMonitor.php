<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Http;
use App\Models\HealthQuestionnaire;
use App\Models\User;

class ApiPerformanceMonitor extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'api:monitor {--duration=60 : Monitor duration in seconds} {--interval=5 : Check interval in seconds}';

    /**
     * The description of the command.
     */
    protected $description = 'Monitor API performance metrics including response times, query counts, and cache hit rates';

    /**
     * Performance metrics storage
     */
    private $metrics = [];
    private $startTime;
    private $apiBaseUrl;

    public function handle(): int
    {
        $duration = (int) $this->option('duration');
        $interval = (int) $this->option('interval');
        
        $this->startTime = now();
        $this->apiBaseUrl = config('app.url') . '/api';
        
        $this->info("🚀 Starting API Performance Monitor");
        $this->info("Duration: {$duration} seconds, Interval: {$interval} seconds");
        $this->info("API Base URL: {$this->apiBaseUrl}");
        $this->newLine();
        
        // Initialize metrics
        $this->metrics = [
            'start_time' => $this->startTime->toISOString(),
            'duration' => $duration,
            'interval' => $interval,
            'snapshots' => [],
            'summary' => []
        ];
        
        $iterations = (int) ceil($duration / $interval);
        
        $this->withProgressBar($iterations, function () use ($interval) {
            for ($i = 0; $i < $iterations; $i++) {
                $snapshot = $this->captureSnapshot();
                $this->metrics['snapshots'][] = $snapshot;
                
                if ($i < $iterations - 1) {
                    sleep($interval);
                }
            }
        });
        
        $this->newLine(2);
        
        // Generate summary
        $this->generateSummary();
        $this->displayResults();
        $this->saveMetrics();
        
        return Command::SUCCESS;
    }

    /**
     * Capture performance snapshot
     */
    private function captureSnapshot(): array
    {
        $timestamp = now();
        
        // Database metrics
        $dbMetrics = $this->getDatabaseMetrics();
        
        // Cache metrics
        $cacheMetrics = $this->getCacheMetrics();
        
        // API response time metrics
        $apiMetrics = $this->getApiResponseMetrics();
        
        // Memory metrics
        $memoryMetrics = $this->getMemoryMetrics();
        
        return [
            'timestamp' => $timestamp->toISOString(),
            'elapsed_seconds' => $timestamp->diffInSeconds($this->startTime),
            'database' => $dbMetrics,
            'cache' => $cacheMetrics,
            'api_responses' => $apiMetrics,
            'memory' => $memoryMetrics
        ];
    }

    /**
     * Get database performance metrics
     */
    private function getDatabaseMetrics(): array
    {
        $startTime = microtime(true);
        
        // Enable query logging
        DB::enableQueryLog();
        
        // Test various database operations
        $userCount = User::count();
        $activeUsersCount = User::where('is_active', true)->count();
        $questionnaireCount = HealthQuestionnaire::count();
        $recentQuestionnaireCount = HealthQuestionnaire::where('created_at', '>=', now()->subDay())->count();
        
        $queries = DB::getQueryLog();
        $queryTime = microtime(true) - $startTime;
        
        // Test connection time
        $connectionStart = microtime(true);
        DB::select('SELECT 1');
        $connectionTime = microtime(true) - $connectionStart;
        
        // Check for slow queries
        $slowQueries = array_filter($queries, function($query) {
            return $query['time'] > 100; // Queries over 100ms
        });
        
        DB::flushQueryLog();
        
        return [
            'connection_time_ms' => round($connectionTime * 1000, 2),
            'total_query_time_ms' => round($queryTime * 1000, 2),
            'query_count' => count($queries),
            'slow_query_count' => count($slowQueries),
            'avg_query_time_ms' => count($queries) > 0 ? round(($queryTime * 1000) / count($queries), 2) : 0,
            'counts' => [
                'users' => $userCount,
                'active_users' => $activeUsersCount,
                'questionnaires' => $questionnaireCount,
                'recent_questionnaires' => $recentQuestionnaireCount
            ]
        ];
    }

    /**
     * Get cache performance metrics
     */
    private function getCacheMetrics(): array
    {
        $cacheTests = [];
        
        // Test cache write performance
        $key = 'monitor_test_' . time();
        $testData = ['test' => 'data', 'timestamp' => now()->toISOString()];
        
        $writeStart = microtime(true);
        Cache::put($key, $testData, 300);
        $writeTime = microtime(true) - $writeStart;
        
        // Test cache read performance
        $readStart = microtime(true);
        $cachedData = Cache::get($key);
        $readTime = microtime(true) - $readStart;
        
        // Test cache miss
        $missStart = microtime(true);
        Cache::get('non_existent_key_' . time(), 'default');
        $missTime = microtime(true) - $missStart;
        
        // Clean up test key
        Cache::forget($key);
        
        // Try to get Redis info if available
        $redisInfo = [];
        try {
            if (config('cache.default') === 'redis') {
                $redis = Redis::connection();
                $info = $redis->info();
                $redisInfo = [
                    'connected_clients' => $info['connected_clients'] ?? 'N/A',
                    'used_memory' => $info['used_memory_human'] ?? 'N/A',
                    'keyspace_hits' => $info['keyspace_hits'] ?? 'N/A',
                    'keyspace_misses' => $info['keyspace_misses'] ?? 'N/A',
                    'hit_rate' => isset($info['keyspace_hits'], $info['keyspace_misses']) 
                        ? round(($info['keyspace_hits'] / ($info['keyspace_hits'] + $info['keyspace_misses'])) * 100, 2) 
                        : 'N/A'
                ];
            }
        } catch (\Exception $e) {
            $redisInfo = ['error' => 'Could not connect to Redis'];
        }
        
        return [
            'cache_driver' => config('cache.default'),
            'write_time_ms' => round($writeTime * 1000, 2),
            'read_time_ms' => round($readTime * 1000, 2),
            'miss_time_ms' => round($missTime * 1000, 2),
            'data_integrity' => $cachedData === $testData,
            'redis_info' => $redisInfo
        ];
    }

    /**
     * Get API response time metrics
     */
    private function getApiResponseMetrics(): array
    {
        $endpoints = [
            'health' => '/health',
            'health_ready' => '/health/ready',
            'metrics' => '/metrics'
        ];
        
        $results = [];
        
        foreach ($endpoints as $name => $endpoint) {
            $startTime = microtime(true);
            
            try {
                $response = Http::timeout(10)->get($this->apiBaseUrl . $endpoint);
                $responseTime = (microtime(true) - $startTime) * 1000;
                
                $results[$name] = [
                    'response_time_ms' => round($responseTime, 2),
                    'status_code' => $response->status(),
                    'success' => $response->successful(),
                    'size_bytes' => strlen($response->body())
                ];
            } catch (\Exception $e) {
                $responseTime = (microtime(true) - $startTime) * 1000;
                
                $results[$name] = [
                    'response_time_ms' => round($responseTime, 2),
                    'status_code' => 0,
                    'success' => false,
                    'error' => $e->getMessage()
                ];
            }
        }
        
        return $results;
    }

    /**
     * Get memory usage metrics
     */
    private function getMemoryMetrics(): array
    {
        return [
            'current_usage_mb' => round(memory_get_usage(true) / 1024 / 1024, 2),
            'peak_usage_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
            'memory_limit' => ini_get('memory_limit'),
            'opcache_stats' => function_exists('opcache_get_status') ? opcache_get_status() : 'Not available'
        ];
    }

    /**
     * Generate performance summary
     */
    private function generateSummary(): void
    {
        if (empty($this->metrics['snapshots'])) {
            return;
        }
        
        $snapshots = $this->metrics['snapshots'];
        
        // API Response Time Summary
        $healthTimes = array_column(array_column($snapshots, 'api_responses'), 'health');
        $healthResponseTimes = array_filter(array_column($healthTimes, 'response_time_ms'));
        
        // Database Performance Summary
        $dbMetrics = array_column($snapshots, 'database');
        $connectionTimes = array_column($dbMetrics, 'connection_time_ms');
        $queryTimes = array_column($dbMetrics, 'total_query_time_ms');
        $queryCounts = array_column($dbMetrics, 'query_count');
        
        // Cache Performance Summary
        $cacheMetrics = array_column($snapshots, 'cache');
        $cacheReadTimes = array_column($cacheMetrics, 'read_time_ms');
        $cacheWriteTimes = array_column($cacheMetrics, 'write_time_ms');
        
        // Memory Usage Summary
        $memoryMetrics = array_column($snapshots, 'memory');
        $memoryUsages = array_column($memoryMetrics, 'current_usage_mb');
        
        $this->metrics['summary'] = [
            'api_performance' => [
                'health_endpoint' => [
                    'avg_response_time_ms' => !empty($healthResponseTimes) ? round(array_sum($healthResponseTimes) / count($healthResponseTimes), 2) : 0,
                    'min_response_time_ms' => !empty($healthResponseTimes) ? min($healthResponseTimes) : 0,
                    'max_response_time_ms' => !empty($healthResponseTimes) ? max($healthResponseTimes) : 0
                ]
            ],
            'database_performance' => [
                'avg_connection_time_ms' => round(array_sum($connectionTimes) / count($connectionTimes), 2),
                'avg_query_time_ms' => round(array_sum($queryTimes) / count($queryTimes), 2),
                'avg_query_count' => round(array_sum($queryCounts) / count($queryCounts), 2),
                'max_query_time_ms' => max($queryTimes),
                'min_connection_time_ms' => min($connectionTimes)
            ],
            'cache_performance' => [
                'avg_read_time_ms' => round(array_sum($cacheReadTimes) / count($cacheReadTimes), 2),
                'avg_write_time_ms' => round(array_sum($cacheWriteTimes) / count($cacheWriteTimes), 2),
                'max_read_time_ms' => max($cacheReadTimes),
                'max_write_time_ms' => max($cacheWriteTimes)
            ],
            'memory_usage' => [
                'avg_usage_mb' => round(array_sum($memoryUsages) / count($memoryUsages), 2),
                'max_usage_mb' => max($memoryUsages),
                'min_usage_mb' => min($memoryUsages)
            ]
        ];
    }

    /**
     * Display performance results
     */
    private function displayResults(): void
    {
        $summary = $this->metrics['summary'];
        
        $this->info('📊 Performance Monitoring Results');
        $this->table(
            ['Metric', 'Average', 'Min', 'Max'],
            [
                ['API Health Response Time (ms)', $summary['api_performance']['health_endpoint']['avg_response_time_ms'], $summary['api_performance']['health_endpoint']['min_response_time_ms'], $summary['api_performance']['health_endpoint']['max_response_time_ms']],
                ['DB Connection Time (ms)', $summary['database_performance']['avg_connection_time_ms'], $summary['database_performance']['min_connection_time_ms'], '-'],
                ['DB Query Time (ms)', $summary['database_performance']['avg_query_time_ms'], '-', $summary['database_performance']['max_query_time_ms']],
                ['Cache Read Time (ms)', $summary['cache_performance']['avg_read_time_ms'], '-', $summary['cache_performance']['max_read_time_ms']],
                ['Cache Write Time (ms)', $summary['cache_performance']['avg_write_time_ms'], '-', $summary['cache_performance']['max_write_time_ms']],
                ['Memory Usage (MB)', $summary['memory_usage']['avg_usage_mb'], $summary['memory_usage']['min_usage_mb'], $summary['memory_usage']['max_usage_mb']]
            ]
        );

        // Performance Assessment
        $this->newLine();
        $this->info('🎯 Performance Assessment');
        
        $healthAvg = $summary['api_performance']['health_endpoint']['avg_response_time_ms'];
        $dbAvg = $summary['database_performance']['avg_connection_time_ms'];
        $cacheReadAvg = $summary['cache_performance']['avg_read_time_ms'];
        
        if ($healthAvg < 200) {
            $this->info('✅ API Response Time: Excellent (< 200ms)');
        } elseif ($healthAvg < 500) {
            $this->comment('⚠️  API Response Time: Good (200-500ms)');
        } else {
            $this->error('❌ API Response Time: Needs Improvement (> 500ms)');
        }
        
        if ($dbAvg < 50) {
            $this->info('✅ Database Connection: Excellent (< 50ms)');
        } elseif ($dbAvg < 100) {
            $this->comment('⚠️  Database Connection: Good (50-100ms)');
        } else {
            $this->error('❌ Database Connection: Needs Improvement (> 100ms)');
        }
        
        if ($cacheReadAvg < 10) {
            $this->info('✅ Cache Performance: Excellent (< 10ms)');
        } elseif ($cacheReadAvg < 50) {
            $this->comment('⚠️  Cache Performance: Good (10-50ms)');
        } else {
            $this->error('❌ Cache Performance: Needs Improvement (> 50ms)');
        }
    }

    /**
     * Save metrics to file
     */
    private function saveMetrics(): void
    {
        $filename = storage_path('logs/api_performance_monitor_' . date('Y-m-d_H-i-s') . '.json');
        
        file_put_contents($filename, json_encode($this->metrics, JSON_PRETTY_PRINT));
        
        $this->info("📁 Detailed metrics saved to: {$filename}");
    }
}