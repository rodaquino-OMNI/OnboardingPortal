<?php

namespace Tests\Performance;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class AdminPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected $adminUser;
    protected $performanceThresholds = [
        'user_list_load_time' => 2.0, // seconds
        'bulk_operation_time' => 30.0, // seconds
        'report_generation_time' => 60.0, // seconds
        'search_response_time' => 1.0, // seconds
        'dashboard_load_time' => 3.0, // seconds
    ];

    protected function setUp(): void
    {
        parent::setUp();

        // Create admin user with permissions
        $adminRole = Role::create(['name' => 'admin']);
        $permissions = [
            'manage-users', 'view-users', 'edit-users', 'delete-users',
            'manage-roles', 'view-roles', 'manage-system', 'view-reports',
            'export-data', 'audit-logs', 'bulk-operations'
        ];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        $adminRole->givePermissionTo($permissions);

        $this->adminUser = User::factory()->create(['registration_step' => 'completed']);
        $this->adminUser->assignRole('admin');
    }

    /** @test */
    public function admin_user_list_loads_within_acceptable_time()
    {
        Sanctum::actingAs($this->adminUser);

        // Create test dataset
        User::factory()->count(1000)->create();

        $startTime = microtime(true);
        $response = $this->getJson('/api/admin/users?page=1&limit=50');
        $endTime = microtime(true);

        $loadTime = $endTime - $startTime;

        $response->assertStatus(200);
        $this->assertLessThan(
            $this->performanceThresholds['user_list_load_time'], 
            $loadTime,
            "User list should load within {$this->performanceThresholds['user_list_load_time']} seconds, took {$loadTime} seconds"
        );

        // Verify query efficiency
        $queryCount = count(DB::getQueryLog());
        $this->assertLessThan(10, $queryCount, 'Should use efficient queries to load user list');
    }

    /** @test */
    public function admin_user_search_performance()
    {
        Sanctum::actingAs($this->adminUser);

        // Create diverse test dataset
        User::factory()->count(5000)->create();
        
        $searchTerms = ['john', 'admin', 'test', 'user@example.com'];

        foreach ($searchTerms as $term) {
            DB::flushQueryLog();
            $startTime = microtime(true);
            
            $response = $this->getJson("/api/admin/users?search={$term}&limit=20");
            
            $endTime = microtime(true);
            $searchTime = $endTime - $startTime;

            $response->assertStatus(200);
            $this->assertLessThan(
                $this->performanceThresholds['search_response_time'],
                $searchTime,
                "Search for '{$term}' should complete within {$this->performanceThresholds['search_response_time']} seconds"
            );

            // Verify search uses database indexes efficiently
            $queries = DB::getQueryLog();
            $hasFullTableScan = false;
            
            foreach ($queries as $query) {
                if (stripos($query['query'], 'LIKE') !== false && 
                    stripos($query['query'], 'INDEX') === false) {
                    // This is a basic check - in real implementation you'd analyze EXPLAIN output
                    $hasFullTableScan = true;
                }
            }

            $this->assertFalse($hasFullTableScan, "Search should use database indexes, not full table scans");
        }
    }

    /** @test */
    public function admin_bulk_operations_performance()
    {
        Sanctum::actingAs($this->adminUser);

        // Create test users
        $users = User::factory()->count(1000)->create();
        $userIds = $users->pluck('id')->toArray();

        // Test bulk role assignment
        $managerRole = Role::create(['name' => 'manager']);
        
        $startTime = microtime(true);
        $response = $this->postJson('/api/admin/users/bulk/assign-role', [
            'user_ids' => array_slice($userIds, 0, 100), // Limit to 100 for test
            'role' => 'manager'
        ]);
        $endTime = microtime(true);

        $bulkTime = $endTime - $startTime;
        
        $response->assertStatus(200);
        $this->assertLessThan(
            $this->performanceThresholds['bulk_operation_time'],
            $bulkTime,
            "Bulk role assignment should complete within {$this->performanceThresholds['bulk_operation_time']} seconds"
        );

        // Test bulk export performance
        $startTime = microtime(true);
        $response = $this->postJson('/api/admin/users/bulk/export', [
            'user_ids' => array_slice($userIds, 0, 500),
            'format' => 'csv'
        ]);
        $endTime = microtime(true);

        $exportTime = $endTime - $startTime;
        
        $response->assertStatus(200);
        $this->assertLessThan(
            $this->performanceThresholds['bulk_operation_time'],
            $exportTime,
            "Bulk export should complete within {$this->performanceThresholds['bulk_operation_time']} seconds"
        );
    }

    /** @test */
    public function admin_dashboard_metrics_performance()
    {
        Sanctum::actingAs($this->adminUser);

        // Create comprehensive test data
        User::factory()->count(2000)->create();
        
        $startTime = microtime(true);
        $response = $this->getJson('/api/admin/dashboard/metrics');
        $endTime = microtime(true);

        $metricsTime = $endTime - $startTime;

        $response->assertStatus(200);
        $this->assertLessThan(
            $this->performanceThresholds['dashboard_load_time'],
            $metricsTime,
            "Dashboard metrics should load within {$this->performanceThresholds['dashboard_load_time']} seconds"
        );

        $metricsData = $response->json('data');
        
        // Verify essential metrics are present
        $this->assertArrayHasKey('total_users', $metricsData);
        $this->assertArrayHasKey('active_users', $metricsData);
        $this->assertArrayHasKey('new_registrations_today', $metricsData);
        $this->assertArrayHasKey('system_health', $metricsData);
    }

    /** @test */
    public function admin_report_generation_performance()
    {
        Sanctum::actingAs($this->adminUser);

        // Create test data with timestamps for reports
        User::factory()->count(1500)->create([
            'created_at' => now()->subDays(rand(1, 30))
        ]);

        // Test user activity report generation
        $startTime = microtime(true);
        $response = $this->postJson('/api/admin/reports/user-activity', [
            'date_range' => [
                'start' => now()->subDays(30)->format('Y-m-d'),
                'end' => now()->format('Y-m-d')
            ],
            'format' => 'json'
        ]);
        $endTime = microtime(true);

        $reportTime = $endTime - $startTime;

        $response->assertStatus(200);
        $this->assertLessThan(
            $this->performanceThresholds['report_generation_time'],
            $reportTime,
            "Report generation should complete within {$this->performanceThresholds['report_generation_time']} seconds"
        );

        // Test system performance report
        $startTime = microtime(true);
        $response = $this->postJson('/api/admin/reports/system-performance', [
            'metrics' => ['response_time', 'error_rate', 'throughput'],
            'period' => 'last_7_days'
        ]);
        $endTime = microtime(true);

        $perfReportTime = $endTime - $startTime;

        $response->assertStatus(200);
        $this->assertLessThan(
            $this->performanceThresholds['report_generation_time'],
            $perfReportTime,
            "Performance report should complete within {$this->performanceThresholds['report_generation_time']} seconds"
        );
    }

    /** @test */
    public function admin_concurrent_operations_performance()
    {
        Sanctum::actingAs($this->adminUser);

        // Create test data
        User::factory()->count(500)->create();

        // Simulate concurrent admin operations
        $operations = [];
        $startTime = microtime(true);

        // Simulate multiple admins performing operations
        for ($i = 0; $i < 5; $i++) {
            $token = $this->adminUser->createToken("concurrent-{$i}")->plainTextToken;
            
            $operations[] = [
                'token' => $token,
                'operation' => 'user_list',
                'start_time' => microtime(true)
            ];
        }

        // Execute operations concurrently (simulated)
        $responses = [];
        foreach ($operations as $op) {
            $response = $this->withHeaders(['Authorization' => "Bearer {$op['token']}"])
                             ->getJson('/api/admin/users?limit=50');
            
            $op['end_time'] = microtime(true);
            $op['response'] = $response;
            $responses[] = $op;
        }

        $endTime = microtime(true);
        $totalTime = $endTime - $startTime;

        // All operations should complete successfully
        foreach ($responses as $op) {
            $op['response']->assertStatus(200);
            
            $operationTime = $op['end_time'] - $op['start_time'];
            $this->assertLessThan(5.0, $operationTime, 'Concurrent operations should not significantly degrade performance');
        }

        // Total time should be reasonable for concurrent operations
        $this->assertLessThan(10.0, $totalTime, 'Concurrent operations should complete within reasonable time');
    }

    /** @test */
    public function admin_memory_usage_optimization()
    {
        Sanctum::actingAs($this->adminUser);

        // Create large dataset
        User::factory()->count(2000)->create();

        // Monitor memory usage during large operations
        $memoryBefore = memory_get_usage(true);

        // Load large user dataset
        $response = $this->getJson('/api/admin/users?limit=1000');
        $response->assertStatus(200);

        $memoryAfter = memory_get_usage(true);
        $memoryUsed = $memoryAfter - $memoryBefore;

        // Memory usage should be reasonable (less than 50MB for this operation)
        $this->assertLessThan(50 * 1024 * 1024, $memoryUsed, 
            'Memory usage should be optimized for large datasets');

        // Test memory cleanup after bulk operations
        $memoryBeforeBulk = memory_get_usage(true);
        
        $userIds = User::pluck('id')->toArray();
        $response = $this->postJson('/api/admin/users/bulk/export', [
            'user_ids' => array_slice($userIds, 0, 500),
            'format' => 'csv'
        ]);
        
        $response->assertStatus(200);
        
        // Force garbage collection
        gc_collect_cycles();
        
        $memoryAfterBulk = memory_get_usage(true);
        $bulkMemoryIncrease = $memoryAfterBulk - $memoryBeforeBulk;

        // Memory should not increase excessively after bulk operations
        $this->assertLessThan(100 * 1024 * 1024, $bulkMemoryIncrease,
            'Bulk operations should not cause excessive memory usage');
    }

    /** @test */
    public function admin_database_query_optimization()
    {
        Sanctum::actingAs($this->adminUser);

        // Create related test data
        $users = User::factory()->count(100)->create();
        foreach ($users as $user) {
            Beneficiary::factory()->create(['user_id' => $user->id]);
        }

        // Enable query logging
        DB::flushQueryLog();
        
        // Load users with relationships
        $response = $this->getJson('/api/admin/users?include=beneficiary,roles&limit=50');
        $response->assertStatus(200);

        $queries = DB::getQueryLog();

        // Should use efficient eager loading, not N+1 queries
        $this->assertLessThan(5, count($queries), 
            'Should use eager loading to minimize database queries');

        // Check for potential N+1 query patterns
        $selectQueries = array_filter($queries, function($query) {
            return stripos($query['query'], 'SELECT') === 0;
        });

        $this->assertLessThan(3, count($selectQueries), 
            'Should avoid N+1 query problems with proper eager loading');
    }

    /** @test */
    public function admin_caching_effectiveness()
    {
        Sanctum::actingAs($this->adminUser);

        // Clear cache to start fresh
        Cache::flush();

        // First request should populate cache
        $startTime = microtime(true);
        $response1 = $this->getJson('/api/admin/dashboard/metrics');
        $firstRequestTime = microtime(true) - $startTime;
        $response1->assertStatus(200);

        // Second request should use cache
        $startTime = microtime(true);
        $response2 = $this->getJson('/api/admin/dashboard/metrics');
        $secondRequestTime = microtime(true) - $startTime;
        $response2->assertStatus(200);

        // Cached request should be significantly faster
        $this->assertLessThan($firstRequestTime * 0.5, $secondRequestTime,
            'Cached requests should be significantly faster than uncached requests');

        // Responses should be identical
        $this->assertEquals($response1->json(), $response2->json(),
            'Cached responses should match original responses');
    }

    /** @test */
    public function admin_pagination_performance()
    {
        Sanctum::actingAs($this->adminUser);

        // Create large dataset
        User::factory()->count(5000)->create();

        $pageSizes = [10, 25, 50, 100];
        
        foreach ($pageSizes as $pageSize) {
            DB::flushQueryLog();
            $startTime = microtime(true);
            
            $response = $this->getJson("/api/admin/users?page=1&limit={$pageSize}");
            
            $endTime = microtime(true);
            $pageTime = $endTime - $startTime;

            $response->assertStatus(200);
            
            // Pagination should be efficient regardless of page size
            $this->assertLessThan(2.0, $pageTime,
                "Pagination with {$pageSize} items should complete within 2 seconds");

            // Should use LIMIT and OFFSET efficiently
            $queries = DB::getQueryLog();
            $hasLimitQuery = false;
            
            foreach ($queries as $query) {
                if (stripos($query['query'], 'LIMIT') !== false) {
                    $hasLimitQuery = true;
                    break;
                }
            }
            
            $this->assertTrue($hasLimitQuery, 
                "Pagination should use LIMIT clause for efficiency");
        }
    }

    /** @test */
    public function admin_real_time_updates_performance()
    {
        Sanctum::actingAs($this->adminUser);

        // Test WebSocket/SSE performance for real-time admin updates
        $startTime = microtime(true);
        
        // Simulate creating user and checking real-time update
        $newUser = User::factory()->create();
        
        // Check if admin dashboard would receive real-time update
        $response = $this->getJson('/api/admin/realtime/updates');
        
        $endTime = microtime(true);
        $updateTime = $endTime - $startTime;

        $response->assertStatus(200);
        
        // Real-time updates should be very fast
        $this->assertLessThan(0.5, $updateTime,
            'Real-time updates should be delivered within 500ms');

        $updates = $response->json('data');
        
        // Should include the new user creation event
        $hasNewUserUpdate = false;
        foreach ($updates as $update) {
            if ($update['type'] === 'user_created' && $update['user_id'] === $newUser->id) {
                $hasNewUserUpdate = true;
                break;
            }
        }
        
        $this->assertTrue($hasNewUserUpdate, 
            'Real-time updates should include new user creation events');
    }

    /** @test */
    public function admin_export_performance_large_datasets()
    {
        Sanctum::actingAs($this->adminUser);

        // Create large dataset for export testing
        User::factory()->count(10000)->create();

        $exportFormats = ['csv', 'excel', 'pdf'];
        
        foreach ($exportFormats as $format) {
            $startTime = microtime(true);
            
            $response = $this->postJson('/api/admin/users/bulk/export', [
                'format' => $format,
                'limit' => 5000 // Large but reasonable export size
            ]);
            
            $endTime = microtime(true);
            $exportTime = $endTime - $startTime;

            $response->assertStatus(200);
            
            // Export should complete within reasonable time
            $maxTime = $format === 'pdf' ? 120.0 : 60.0; // PDF takes longer
            $this->assertLessThan($maxTime, $exportTime,
                "Export in {$format} format should complete within {$maxTime} seconds");

            // Response should include download URL or file data
            $exportData = $response->json('data');
            $this->assertTrue(
                isset($exportData['download_url']) || isset($exportData['file_content']),
                'Export response should include download URL or file content'
            );
        }
    }

    protected function measureExecutionTime(callable $operation): float
    {
        $startTime = microtime(true);
        $operation();
        return microtime(true) - $startTime;
    }

    protected function assertDatabaseQueryCount(int $expectedCount, string $message = ''): void
    {
        $queryCount = count(DB::getQueryLog());
        $this->assertEquals($expectedCount, $queryCount, 
            $message ?: "Expected {$expectedCount} database queries, got {$queryCount}");
    }

    protected function assertMemoryUsageBelow(int $maxBytes, string $operation): void
    {
        $memoryUsage = memory_get_peak_usage(true);
        $this->assertLessThan($maxBytes, $memoryUsage,
            "Memory usage for {$operation} should be below " . 
            number_format($maxBytes / (1024 * 1024), 2) . "MB");
    }
}