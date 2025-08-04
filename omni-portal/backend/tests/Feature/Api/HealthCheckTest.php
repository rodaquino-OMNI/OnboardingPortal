<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Queue;

class HealthCheckTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test basic health check endpoint
     */
    public function test_health_endpoint_returns_success_when_healthy()
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'healthy',
                'timestamp' => now()->toISOString()
            ])
            ->assertJsonStructure([
                'status',
                'timestamp',
                'services' => [
                    'database',
                    'cache',
                    'queue',
                    'storage'
                ]
            ]);
    }

    /**
     * Test detailed status endpoint
     */
    public function test_status_endpoint_returns_detailed_information()
    {
        $response = $this->getJson('/api/status');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'version',
                'environment',
                'timestamp',
                'uptime',
                'services' => [
                    'database' => [
                        'status',
                        'connection',
                        'response_time'
                    ],
                    'cache' => [
                        'status',
                        'driver',
                        'response_time'
                    ],
                    'queue' => [
                        'status',
                        'driver',
                        'jobs_pending',
                        'jobs_failed'
                    ],
                    'storage' => [
                        'status',
                        'disk',
                        'available_space'
                    ],
                    'redis' => [
                        'status',
                        'connection',
                        'response_time'
                    ]
                ],
                'system' => [
                    'php_version',
                    'laravel_version',
                    'memory_usage',
                    'cpu_usage'
                ]
            ]);

        // Verify basic values
        $this->assertEquals('healthy', $response->json('status'));
        $this->assertEquals(config('app.env'), $response->json('environment'));
        $this->assertNotEmpty($response->json('version'));
    }

    /**
     * Test metrics endpoint
     */
    public function test_metrics_endpoint_returns_application_metrics()
    {
        // Create some test data for metrics
        \App\Models\User::factory()->count(5)->create();
        \App\Models\Document::factory()->count(10)->create();

        $response = $this->getJson('/api/metrics');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'timestamp',
                'metrics' => [
                    'users' => [
                        'total',
                        'active',
                        'new_today',
                        'new_this_week',
                        'new_this_month'
                    ],
                    'documents' => [
                        'total',
                        'pending',
                        'approved',
                        'rejected',
                        'processing_today'
                    ],
                    'performance' => [
                        'avg_response_time',
                        'requests_per_minute',
                        'error_rate',
                        'cache_hit_rate'
                    ],
                    'system' => [
                        'memory_usage_mb',
                        'memory_usage_percentage',
                        'disk_usage_gb',
                        'disk_usage_percentage',
                        'cpu_load_average'
                    ],
                    'queue' => [
                        'jobs_processed_today',
                        'jobs_failed_today',
                        'avg_job_processing_time',
                        'current_queue_size'
                    ]
                ]
            ]);

        // Verify counts
        $this->assertEquals(5, $response->json('metrics.users.total'));
        $this->assertEquals(10, $response->json('metrics.documents.total'));
    }

    /**
     * Test health check detects database issues
     */
    public function test_health_check_detects_database_issues()
    {
        // Mock database connection failure
        DB::shouldReceive('connection')->andThrow(new \Exception('Database connection failed'));

        $response = $this->getJson('/api/health');

        $response->assertStatus(503)
            ->assertJson([
                'status' => 'unhealthy',
                'services' => [
                    'database' => [
                        'status' => 'down',
                        'error' => 'Database connection failed'
                    ]
                ]
            ]);
    }

    /**
     * Test health check includes response times
     */
    public function test_health_check_includes_service_response_times()
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200);

        $services = $response->json('services');

        // Verify response times are numeric and reasonable
        $this->assertIsNumeric($services['database']['response_time_ms']);
        $this->assertLessThan(1000, $services['database']['response_time_ms']);

        $this->assertIsNumeric($services['cache']['response_time_ms']);
        $this->assertLessThan(100, $services['cache']['response_time_ms']);
    }

    /**
     * Test status endpoint includes version information
     */
    public function test_status_endpoint_includes_version_information()
    {
        $response = $this->getJson('/api/status');

        $response->assertStatus(200);

        $system = $response->json('system');

        // Verify PHP version
        $this->assertEquals(PHP_VERSION, $system['php_version']);

        // Verify Laravel version
        $this->assertEquals(app()->version(), $system['laravel_version']);
    }

    /**
     * Test metrics endpoint includes error rates
     */
    public function test_metrics_endpoint_includes_error_rates()
    {
        // Simulate some errors in cache
        Cache::put('app.errors.4xx', 10);
        Cache::put('app.errors.5xx', 5);
        Cache::put('app.requests.total', 1000);

        $response = $this->getJson('/api/metrics');

        $response->assertStatus(200);

        $performance = $response->json('metrics.performance');

        // Verify error rate calculation
        $expectedErrorRate = (15 / 1000) * 100; // 1.5%
        $this->assertEquals($expectedErrorRate, $performance['error_rate']);
    }

    /**
     * Test health check is publicly accessible
     */
    public function test_health_endpoints_are_publicly_accessible()
    {
        // Health endpoint
        $response = $this->getJson('/api/health');
        $response->assertStatus(200);

        // Status endpoint
        $response = $this->getJson('/api/status');
        $response->assertStatus(200);

        // Metrics endpoint
        $response = $this->getJson('/api/metrics');
        $response->assertStatus(200);
    }

    /**
     * Test health check includes all critical services
     */
    public function test_health_check_monitors_all_critical_services()
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200);

        $services = $response->json('services');

        // Verify all critical services are monitored
        $this->assertArrayHasKey('database', $services);
        $this->assertArrayHasKey('cache', $services);
        $this->assertArrayHasKey('queue', $services);
        $this->assertArrayHasKey('storage', $services);

        // If Redis is configured, it should be monitored
        if (config('database.redis.default')) {
            $this->assertArrayHasKey('redis', $services);
        }
    }

    /**
     * Test status endpoint includes uptime information
     */
    public function test_status_endpoint_includes_uptime()
    {
        $response = $this->getJson('/api/status');

        $response->assertStatus(200);

        $uptime = $response->json('uptime');

        $this->assertArrayHasKey('seconds', $uptime);
        $this->assertArrayHasKey('human_readable', $uptime);
        
        // Verify uptime is positive
        $this->assertGreaterThan(0, $uptime['seconds']);
        
        // Verify human readable format
        $this->assertMatchesRegularExpression('/\d+\s+(second|minute|hour|day)s?/', $uptime['human_readable']);
    }

    /**
     * Test metrics endpoint includes cache statistics
     */
    public function test_metrics_endpoint_includes_cache_statistics()
    {
        // Simulate cache hits and misses
        Cache::put('cache.hits', 850);
        Cache::put('cache.misses', 150);

        $response = $this->getJson('/api/metrics');

        $response->assertStatus(200);

        $cacheHitRate = $response->json('metrics.performance.cache_hit_rate');

        // Verify cache hit rate calculation
        $expectedHitRate = (850 / (850 + 150)) * 100; // 85%
        $this->assertEquals($expectedHitRate, $cacheHitRate);
    }

    /**
     * Test health check response format follows standards
     */
    public function test_health_check_follows_standard_format()
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/json')
            ->assertHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        // Verify timestamp is ISO 8601 format
        $timestamp = $response->json('timestamp');
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $timestamp);
    }

    /**
     * Test metrics endpoint includes queue performance
     */
    public function test_metrics_endpoint_includes_queue_performance()
    {
        // Simulate queue metrics
        Cache::put('queue.processed', 1000);
        Cache::put('queue.failed', 50);
        Cache::put('queue.processing_time', 2500); // milliseconds
        Queue::size(); // Ensure queue is initialized

        $response = $this->getJson('/api/metrics');

        $response->assertStatus(200);

        $queueMetrics = $response->json('metrics.queue');

        $this->assertArrayHasKey('jobs_processed_today', $queueMetrics);
        $this->assertArrayHasKey('jobs_failed_today', $queueMetrics);
        $this->assertArrayHasKey('avg_job_processing_time', $queueMetrics);
        $this->assertArrayHasKey('current_queue_size', $queueMetrics);

        // Verify values
        $this->assertEquals(1000, $queueMetrics['jobs_processed_today']);
        $this->assertEquals(50, $queueMetrics['jobs_failed_today']);
        $this->assertEquals(2.5, $queueMetrics['avg_job_processing_time']); // seconds
    }
}