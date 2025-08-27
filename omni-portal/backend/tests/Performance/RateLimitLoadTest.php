<?php

namespace Tests\Performance;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

class RateLimitLoadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Config::set('cache.default', 'array');
    }

    /**
     * Test concurrent request handling with rate limiting
     */
    public function test_concurrent_requests_with_rate_limiting()
    {
        $results = [];
        $concurrentRequests = 50;
        
        // Simulate concurrent requests
        for ($i = 0; $i < $concurrentRequests; $i++) {
            $response = $this->getJson('/api/health');
            $results[] = [
                'status' => $response->status(),
                'has_rate_limit_headers' => $response->headers->has('X-RateLimit-Limit'),
                'remaining' => $response->headers->get('X-RateLimit-Remaining', 0)
            ];
        }
        
        // Analyze results
        $successCount = count(array_filter($results, fn($r) => $r['status'] === 200));
        $rateLimitedCount = count(array_filter($results, fn($r) => $r['status'] === 429));
        $headersPresent = count(array_filter($results, fn($r) => $r['has_rate_limit_headers']));
        
        // Assertions
        $this->assertGreaterThan(0, $successCount, 'Some requests should succeed');
        $this->assertEquals($concurrentRequests, $headersPresent, 'All responses should have rate limit headers');
        
        // Log performance metrics
        echo "\n=== Rate Limiting Load Test Results ===\n";
        echo "Total Requests: {$concurrentRequests}\n";
        echo "Successful: {$successCount}\n";
        echo "Rate Limited: {$rateLimitedCount}\n";
        echo "Success Rate: " . round(($successCount / $concurrentRequests) * 100, 2) . "%\n";
    }

    /**
     * Test different endpoint rate limiting under load
     */
    public function test_endpoint_specific_rate_limiting()
    {
        $user = User::factory()->create();
        $endpoints = [
            '/api/health' => 'general',
            '/api/auth/check-email' => 'auth',
            '/api/gamification/progress' => 'general'
        ];
        
        $results = [];
        
        foreach ($endpoints as $endpoint => $type) {
            $endpointResults = [];
            
            for ($i = 0; $i < 40; $i++) {
                if ($type === 'auth') {
                    $response = $this->postJson($endpoint, ['email' => "test{$i}@example.com"]);
                } else {
                    $response = $this->actingAs($user, 'sanctum')->getJson($endpoint);
                }
                
                $endpointResults[] = $response->status();
            }
            
            $results[$endpoint] = [
                'success_count' => count(array_filter($endpointResults, fn($s) => in_array($s, [200, 422]))),
                'rate_limited_count' => count(array_filter($endpointResults, fn($s) => $s === 429)),
                'total_requests' => count($endpointResults)
            ];
        }
        
        // Log results
        echo "\n=== Endpoint-Specific Rate Limiting Results ===\n";
        foreach ($results as $endpoint => $data) {
            echo "Endpoint: {$endpoint}\n";
            echo "  Success: {$data['success_count']}/{$data['total_requests']}\n";
            echo "  Rate Limited: {$data['rate_limited_count']}/{$data['total_requests']}\n";
            echo "  Success Rate: " . round(($data['success_count'] / $data['total_requests']) * 100, 2) . "%\n\n";
        }
    }

    /**
     * Test rate limiting with different user types
     */
    public function test_rate_limiting_by_user_type()
    {
        $user = User::factory()->create();
        $requests = 70;
        
        // Test anonymous user limits
        $anonymousResults = [];
        for ($i = 0; $i < $requests; $i++) {
            $response = $this->getJson('/api/health');
            $anonymousResults[] = $response->status();
        }
        
        Cache::flush(); // Reset rate limits
        
        // Test authenticated user limits
        $authResults = [];
        for ($i = 0; $i < $requests; $i++) {
            $response = $this->actingAs($user, 'sanctum')->getJson('/api/health');
            $authResults[] = $response->status();
        }
        
        $anonymousSuccess = count(array_filter($anonymousResults, fn($s) => $s === 200));
        $authSuccess = count(array_filter($authResults, fn($s) => $s === 200));
        
        // Authenticated users should have higher success rate
        $this->assertGreaterThan($anonymousSuccess, $authSuccess, 
            'Authenticated users should have higher rate limits');
        
        echo "\n=== User Type Rate Limiting Results ===\n";
        echo "Anonymous Success: {$anonymousSuccess}/{$requests} (" . 
             round(($anonymousSuccess / $requests) * 100, 2) . "%)\n";
        echo "Authenticated Success: {$authSuccess}/{$requests} (" . 
             round(($authSuccess / $requests) * 100, 2) . "%)\n";
    }

    /**
     * Test rate limiting performance impact
     */
    public function test_rate_limiting_performance_impact()
    {
        $iterations = 100;
        $startTime = microtime(true);
        
        for ($i = 0; $i < $iterations; $i++) {
            $response = $this->getJson('/api/health');
            
            // Ensure we're getting proper responses
            $this->assertTrue(in_array($response->status(), [200, 429]));
            $this->assertTrue($response->headers->has('X-RateLimit-Limit'));
        }
        
        $endTime = microtime(true);
        $totalTime = $endTime - $startTime;
        $avgTime = $totalTime / $iterations;
        
        // Performance should be reasonable (less than 100ms per request on average)
        $this->assertLessThan(0.1, $avgTime, 
            'Rate limiting should not significantly impact performance');
        
        echo "\n=== Performance Impact Results ===\n";
        echo "Total Time: " . round($totalTime, 3) . " seconds\n";
        echo "Average Time per Request: " . round($avgTime * 1000, 2) . " ms\n";
        echo "Requests per Second: " . round($iterations / $totalTime, 2) . "\n";
    }

    /**
     * Test memory usage during rate limiting
     */
    public function test_rate_limiting_memory_usage()
    {
        $startMemory = memory_get_usage(true);
        $requests = 500;
        
        for ($i = 0; $i < $requests; $i++) {
            $response = $this->getJson('/api/health');
            
            // Check memory every 100 requests
            if ($i % 100 === 0) {
                $currentMemory = memory_get_usage(true);
                $memoryIncrease = $currentMemory - $startMemory;
                
                // Memory increase should be reasonable (less than 50MB)
                $this->assertLessThan(50 * 1024 * 1024, $memoryIncrease,
                    'Rate limiting should not cause excessive memory usage');
            }
        }
        
        $endMemory = memory_get_usage(true);
        $totalMemoryUsed = $endMemory - $startMemory;
        
        echo "\n=== Memory Usage Results ===\n";
        echo "Start Memory: " . round($startMemory / 1024 / 1024, 2) . " MB\n";
        echo "End Memory: " . round($endMemory / 1024 / 1024, 2) . " MB\n";
        echo "Total Memory Used: " . round($totalMemoryUsed / 1024 / 1024, 2) . " MB\n";
        echo "Memory per Request: " . round($totalMemoryUsed / $requests / 1024, 2) . " KB\n";
    }
}