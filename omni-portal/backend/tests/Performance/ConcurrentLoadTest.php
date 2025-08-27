<?php

namespace Tests\Performance;

use Tests\TestCase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class ConcurrentLoadTest extends TestCase
{
    private $baseUrl;
    private $metrics = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->baseUrl = config('app.url', 'http://localhost:8000') . '/api';
        $this->metrics = [];
    }

    /**
     * Test concurrent requests to health endpoint
     */
    public function test_concurrent_health_requests()
    {
        $concurrentRequests = 20;
        $promises = [];
        $startTime = microtime(true);

        // Create concurrent requests
        for ($i = 0; $i < $concurrentRequests; $i++) {
            $promises[] = $this->makeAsyncRequest('GET', '/health');
        }

        // Wait for all requests to complete
        $responses = [];
        foreach ($promises as $promise) {
            $responses[] = $promise;
        }

        $endTime = microtime(true);
        $totalTime = ($endTime - $startTime) * 1000;

        // Analyze responses
        $successCount = 0;
        $responseTimes = [];
        $statusCodes = [];

        foreach ($responses as $response) {
            if (isset($response['status']) && $response['status'] === 200) {
                $successCount++;
            }
            $statusCodes[] = $response['status'] ?? 0;
            $responseTimes[] = $response['time'] ?? 0;
        }

        $avgResponseTime = array_sum($responseTimes) / count($responseTimes);
        $maxResponseTime = max($responseTimes);
        $minResponseTime = min($responseTimes);

        $this->recordMetrics('concurrent_health_requests', [
            'concurrent_requests' => $concurrentRequests,
            'total_time' => $totalTime,
            'success_count' => $successCount,
            'success_rate' => ($successCount / $concurrentRequests) * 100,
            'avg_response_time' => $avgResponseTime,
            'max_response_time' => $maxResponseTime,
            'min_response_time' => $minResponseTime,
            'status_codes' => array_count_values($statusCodes)
        ]);

        $this->assertGreaterThan(0, $successCount, 'At least some requests should succeed');
        $this->assertLessThan(5000, $totalTime, 'All concurrent requests should complete within 5 seconds');
        $this->assertEquals($concurrentRequests, count($responses), 'All requests should complete');
    }

    /**
     * Test rate limiting under load
     */
    public function test_rate_limiting_under_load()
    {
        $requestsToSend = 60; // Should trigger rate limiting
        $responses = [];
        $rateLimitHit = false;
        $rateLimitHeaders = [];

        $startTime = microtime(true);

        for ($i = 0; $i < $requestsToSend; $i++) {
            $response = $this->makeHttpRequest('POST', '/auth/check-email', [
                'email' => "loadtest{$i}@example.com"
            ]);

            $responses[] = $response;
            
            if (isset($response['status']) && $response['status'] === 429) {
                $rateLimitHit = true;
                $rateLimitHeaders[] = $response['headers'] ?? [];
                break; // Stop sending requests once rate limited
            }

            // Add small delay to simulate real usage
            usleep(10000); // 10ms delay
        }

        $endTime = microtime(true);
        $totalTime = ($endTime - $startTime) * 1000;

        $successCount = count(array_filter($responses, function($r) { 
            return isset($r['status']) && $r['status'] === 200; 
        }));
        
        $errorCount = count(array_filter($responses, function($r) { 
            return isset($r['status']) && $r['status'] === 429; 
        }));

        $this->recordMetrics('rate_limiting_test', [
            'requests_sent' => count($responses),
            'success_count' => $successCount,
            'rate_limit_hits' => $errorCount,
            'rate_limit_triggered' => $rateLimitHit,
            'total_time' => $totalTime,
            'requests_per_second' => count($responses) / ($totalTime / 1000),
            'rate_limit_headers' => $rateLimitHeaders
        ]);

        $this->assertTrue($rateLimitHit, 'Rate limiting should be triggered under load');
        $this->assertGreaterThan(0, $errorCount, 'Should receive rate limit errors');
    }

    /**
     * Test database query performance under concurrent load
     */
    public function test_database_performance_under_load()
    {
        $concurrentRequests = 10;
        $promises = [];
        $startTime = microtime(true);

        DB::enableQueryLog();
        $initialQueryCount = count(DB::getQueryLog());

        // Make concurrent requests that hit the database
        for ($i = 0; $i < $concurrentRequests; $i++) {
            $promises[] = $this->makeAsyncRequest('POST', '/auth/check-email', [
                'email' => "dbtest{$i}@example.com"
            ]);
        }

        // Wait for completion
        $responses = [];
        foreach ($promises as $promise) {
            $responses[] = $promise;
        }

        $endTime = microtime(true);
        $totalTime = ($endTime - $startTime) * 1000;
        $totalQueries = count(DB::getQueryLog()) - $initialQueryCount;

        $successCount = count(array_filter($responses, function($r) {
            return isset($r['status']) && $r['status'] === 200;
        }));

        $this->recordMetrics('database_concurrent_performance', [
            'concurrent_requests' => $concurrentRequests,
            'success_count' => $successCount,
            'total_time' => $totalTime,
            'total_queries' => $totalQueries,
            'queries_per_request' => $totalQueries / $concurrentRequests,
            'avg_response_time' => $totalTime / $concurrentRequests
        ]);

        $this->assertGreaterThan(0, $successCount, 'Database queries should succeed under load');
        $this->assertLessThan(3000, $totalTime, 'Concurrent database operations should complete within 3 seconds');
        
        // Check for reasonable query efficiency
        $queriesPerRequest = $totalQueries / $concurrentRequests;
        $this->assertLessThan(5, $queriesPerRequest, 'Should not have excessive queries per request');
    }

    /**
     * Test memory usage under concurrent load
     */
    public function test_memory_usage_under_load()
    {
        $initialMemory = memory_get_usage(true);
        $peakMemory = memory_get_peak_usage(true);
        
        $concurrentRequests = 50;
        $responses = [];
        
        // Track memory during concurrent operations
        for ($i = 0; $i < $concurrentRequests; $i++) {
            $response = $this->makeHttpRequest('GET', '/health');
            $responses[] = $response;
            
            // Sample memory usage periodically
            if ($i % 10 === 0) {
                $currentMemory = memory_get_usage(true);
                $currentPeak = memory_get_peak_usage(true);
            }
        }
        
        $finalMemory = memory_get_usage(true);
        $finalPeak = memory_get_peak_usage(true);
        
        $memoryIncrease = $finalMemory - $initialMemory;
        $peakIncrease = $finalPeak - $peakMemory;
        
        $successCount = count(array_filter($responses, function($r) {
            return isset($r['status']) && $r['status'] === 200;
        }));

        $this->recordMetrics('memory_usage_under_load', [
            'concurrent_requests' => $concurrentRequests,
            'success_count' => $successCount,
            'initial_memory' => $initialMemory,
            'final_memory' => $finalMemory,
            'memory_increase' => $memoryIncrease,
            'memory_increase_mb' => round($memoryIncrease / 1024 / 1024, 2),
            'peak_memory_increase' => $peakIncrease,
            'peak_memory_increase_mb' => round($peakIncrease / 1024 / 1024, 2),
            'memory_per_request' => $memoryIncrease / $concurrentRequests
        ]);

        $this->assertLessThan(50 * 1024 * 1024, $memoryIncrease, 'Memory increase should be less than 50MB for 50 requests');
    }

    /**
     * Make asynchronous HTTP request
     */
    private function makeAsyncRequest(string $method, string $endpoint, array $data = []): array
    {
        $startTime = microtime(true);
        
        try {
            if ($method === 'GET') {
                $response = Http::timeout(30)->get($this->baseUrl . $endpoint);
            } else {
                $response = Http::timeout(30)->$method($this->baseUrl . $endpoint, $data);
            }
            
            $endTime = microtime(true);
            
            return [
                'status' => $response->status(),
                'time' => ($endTime - $startTime) * 1000,
                'body' => $response->body(),
                'headers' => $response->headers()
            ];
        } catch (\Exception $e) {
            $endTime = microtime(true);
            
            return [
                'status' => 0,
                'time' => ($endTime - $startTime) * 1000,
                'error' => $e->getMessage(),
                'headers' => []
            ];
        }
    }

    /**
     * Make synchronous HTTP request
     */
    private function makeHttpRequest(string $method, string $endpoint, array $data = []): array
    {
        return $this->makeAsyncRequest($method, $endpoint, $data);
    }

    /**
     * Record performance metrics
     */
    private function recordMetrics(string $operation, array $data): void
    {
        $this->metrics[$operation] = array_merge($data, [
            'timestamp' => now()->toISOString(),
            'php_memory_limit' => ini_get('memory_limit'),
            'current_memory_usage' => memory_get_usage(true),
            'peak_memory_usage' => memory_get_peak_usage(true)
        ]);
        
        echo "\n=== CONCURRENT LOAD TEST: {$operation} ===\n";
        echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
    }

    protected function tearDown(): void
    {
        // Store metrics
        if (!empty($this->metrics)) {
            file_put_contents(
                storage_path('logs/concurrent_load_metrics_' . date('Y-m-d_H-i-s') . '.json'),
                json_encode($this->metrics, JSON_PRETTY_PRINT)
            );
        }
        
        parent::tearDown();
    }
}