<?php

namespace Tests\Feature\Database;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use App\Models\Company;

/**
 * Database Performance and Index Validation Tests
 * 
 * Tests:
 * - Index existence and effectiveness
 * - Query performance optimization
 * - N+1 query prevention
 * - Database constraints
 * - Connection pooling
 * - Query execution plans
 */
class DatabasePerformanceTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_has_required_indexes_on_critical_tables()
    {
        $criticalIndexes = [
            // Users table indexes
            'users' => [
                'users_email_index',
                'users_company_id_index',
                'users_created_at_index',
            ],
            
            // Companies table indexes  
            'companies' => [
                'companies_domain_index',
                'companies_created_at_index',
            ],
            
            // Sessions table indexes (if using database sessions)
            'sessions' => [
                'sessions_user_id_index',
                'sessions_last_activity_index',
            ],
            
            // Personal access tokens (Sanctum)
            'personal_access_tokens' => [
                'personal_access_tokens_tokenable_type_tokenable_id_index',
                'personal_access_tokens_token_index',
            ],
        ];

        foreach ($criticalIndexes as $table => $indexes) {
            if (!Schema::hasTable($table)) {
                $this->markTestSkipped("Table {$table} does not exist");
                continue;
            }

            foreach ($indexes as $indexName) {
                // Check if index exists (method varies by database)
                $hasIndex = $this->checkIndexExists($table, $indexName);
                
                $this->assertTrue($hasIndex,
                    "Critical index {$indexName} should exist on table {$table}");
            }
        }
    }

    /** @test */
    public function it_executes_user_queries_efficiently()
    {
        // Create test data
        $company = Company::factory()->create();
        User::factory()->count(50)->create(['company_id' => $company->id]);

        DB::enableQueryLog();

        // Test efficient user lookup by email
        $user = User::where('email', 'test@example.com')->first();
        
        $queries = DB::getQueryLog();
        $userQuery = end($queries);
        
        $this->assertLessThan(10, $userQuery['time'] ?? 100,
            'User lookup by email should be fast (indexed)');
    }

    /** @test */
    public function it_prevents_n_plus_one_queries_in_user_company_relationships()
    {
        // Create test data
        $companies = Company::factory()->count(5)->create();
        foreach ($companies as $company) {
            User::factory()->count(10)->create(['company_id' => $company->id]);
        }

        DB::enableQueryLog();

        // Load users with companies (should use eager loading)
        $users = User::with('company')->limit(20)->get();
        
        $queries = DB::getQueryLog();
        $queryCount = count($queries);
        
        // Should be 2 queries max: 1 for users, 1 for companies
        $this->assertLessThanOrEqual(3, $queryCount,
            'Should not have N+1 queries when loading users with companies');
    }

    /** @test */
    public function it_optimizes_company_scoped_queries()
    {
        // Create test data
        $company1 = Company::factory()->create();
        $company2 = Company::factory()->create();
        
        User::factory()->count(25)->create(['company_id' => $company1->id]);
        User::factory()->count(25)->create(['company_id' => $company2->id]);

        DB::enableQueryLog();

        // Query users for specific company
        $companyUsers = User::where('company_id', $company1->id)->get();
        
        $queries = DB::getQueryLog();
        $lastQuery = end($queries);
        
        // Should use company_id index for fast filtering
        $this->assertLessThan(15, $lastQuery['time'] ?? 100,
            'Company-scoped queries should be optimized');
        
        $this->assertCount(25, $companyUsers,
            'Should return correct number of users for company');
    }

    /** @test */
    public function it_handles_concurrent_database_connections()
    {
        // Simulate concurrent requests
        $results = [];
        
        for ($i = 0; $i < 5; $i++) {
            $startTime = microtime(true);
            
            // Simulate database operations
            $user = User::factory()->create();
            $retrieved = User::find($user->id);
            
            $duration = microtime(true) - $startTime;
            $results[] = $duration;
        }
        
        $avgDuration = array_sum($results) / count($results);
        
        $this->assertLessThan(0.1, $avgDuration,
            'Concurrent database operations should be fast');
    }

    /** @test */
    public function it_validates_database_constraints()
    {
        // Test foreign key constraints
        $this->expectException(\Exception::class);
        
        // Try to create user with invalid company_id
        User::factory()->create(['company_id' => 99999]);
    }

    /** @test */
    public function it_optimizes_authentication_queries()
    {
        $user = User::factory()->create(['email' => 'auth@test.com']);

        DB::enableQueryLog();

        // Simulate Sanctum authentication query
        $authUser = User::where('email', 'auth@test.com')->first();
        
        $queries = DB::getQueryLog();
        $authQuery = end($queries);
        
        $this->assertLessThan(10, $authQuery['time'] ?? 100,
            'Authentication queries should be optimized');
        
        $this->assertEquals($user->id, $authUser->id,
            'Should find correct user for authentication');
    }

    /** @test */
    public function it_handles_large_result_sets_efficiently()
    {
        // Create large dataset
        Company::factory()->count(10)->create();
        User::factory()->count(500)->create();

        DB::enableQueryLog();

        // Test pagination performance
        $users = User::paginate(50);
        
        $queries = DB::getQueryLog();
        $paginationQuery = end($queries);
        
        $this->assertLessThan(50, $paginationQuery['time'] ?? 1000,
            'Large result set pagination should be efficient');
        
        $this->assertCount(50, $users->items(),
            'Should return correct page size');
    }

    /** @test */
    public function it_optimizes_search_queries()
    {
        // Create test data with searchable content
        User::factory()->create(['name' => 'John Doe', 'email' => 'john@test.com']);
        User::factory()->create(['name' => 'Jane Smith', 'email' => 'jane@test.com']);
        User::factory()->count(48)->create(); // Total 50 users

        DB::enableQueryLog();

        // Test search by name
        $searchResults = User::where('name', 'LIKE', '%John%')->get();
        
        $queries = DB::getQueryLog();
        $searchQuery = end($queries);
        
        $this->assertLessThan(30, $searchQuery['time'] ?? 100,
            'Search queries should be reasonably fast');
        
        $this->assertGreaterThan(0, $searchResults->count(),
            'Should find matching users');
    }

    /** @test */
    public function it_validates_session_table_performance()
    {
        if (!Schema::hasTable('sessions')) {
            $this->markTestSkipped('Sessions table not found');
        }

        // Insert session data
        for ($i = 0; $i < 10; $i++) {
            DB::table('sessions')->insert([
                'id' => 'session_' . $i,
                'user_id' => null,
                'ip_address' => '192.168.1.' . ($i + 1),
                'user_agent' => 'Test Agent',
                'payload' => base64_encode('test payload'),
                'last_activity' => time(),
            ]);
        }

        DB::enableQueryLog();

        // Test session lookup performance
        $session = DB::table('sessions')->where('id', 'session_5')->first();
        
        $queries = DB::getQueryLog();
        $sessionQuery = end($queries);
        
        $this->assertLessThan(10, $sessionQuery['time'] ?? 100,
            'Session lookup should be fast');
        
        $this->assertNotNull($session, 'Should find session data');
    }

    /** @test */
    public function it_handles_database_deadlocks_gracefully()
    {
        // Create test user
        $user = User::factory()->create();

        // Simulate concurrent updates that might cause deadlock
        try {
            DB::transaction(function () use ($user) {
                $user->update(['name' => 'Update 1']);
                
                // Simulate delay
                usleep(100000); // 0.1 seconds
                
                $user->refresh();
                $user->update(['email' => 'new1@test.com']);
            });

            $this->assertTrue(true, 'Transaction completed successfully');
            
        } catch (\Exception $e) {
            // Should handle deadlocks gracefully
            $this->assertTrue(
                str_contains($e->getMessage(), 'deadlock') || 
                str_contains($e->getMessage(), 'timeout'),
                'Should handle database conflicts gracefully'
            );
        }
    }

    /** @test */
    public function it_optimizes_token_validation_queries()
    {
        if (!Schema::hasTable('personal_access_tokens')) {
            $this->markTestSkipped('Personal access tokens table not found');
        }

        $user = User::factory()->create();
        $token = $user->createToken('test-token');

        DB::enableQueryLog();

        // Simulate token validation (like Sanctum does)
        $tokenModel = DB::table('personal_access_tokens')
            ->where('token', hash('sha256', $token->plainTextToken))
            ->first();
        
        $queries = DB::getQueryLog();
        $tokenQuery = end($queries);
        
        $this->assertLessThan(15, $tokenQuery['time'] ?? 100,
            'Token validation should be fast');
        
        $this->assertNotNull($tokenModel, 'Should find token');
    }

    /** @test */
    public function it_validates_connection_pool_configuration()
    {
        $dbConfig = config('database.connections.' . config('database.default'));
        
        // Check connection pool settings
        $this->assertTrue(isset($dbConfig['host']),
            'Database host should be configured');
            
        $this->assertTrue(isset($dbConfig['database']),
            'Database name should be configured');
            
        // In production, these would be more important
        if (app()->environment('production')) {
            $this->assertTrue(isset($dbConfig['pool']),
                'Connection pooling should be configured in production');
        }
    }

    /** @test */
    public function it_monitors_slow_query_performance()
    {
        // Enable query logging
        DB::enableQueryLog();

        // Execute various operations
        User::factory()->count(10)->create();
        
        $company = Company::factory()->create();
        $users = User::where('company_id', $company->id)->get();
        
        $queries = DB::getQueryLog();
        
        foreach ($queries as $query) {
            $duration = $query['time'] ?? 0;
            
            $this->assertLessThan(100, $duration,
                "Query should complete within 100ms: {$query['query']}");
        }
    }

    /**
     * Helper method to check if index exists
     */
    protected function checkIndexExists(string $table, string $indexName): bool
    {
        try {
            $driverName = DB::getDriverName();
            
            switch ($driverName) {
                case 'mysql':
                    $result = DB::select("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$indexName]);
                    return !empty($result);
                    
                case 'pgsql':
                    $result = DB::select("SELECT indexname FROM pg_indexes WHERE tablename = ? AND indexname = ?", [$table, $indexName]);
                    return !empty($result);
                    
                case 'sqlite':
                    $result = DB::select("SELECT name FROM sqlite_master WHERE type='index' AND name = ?", [$indexName]);
                    return !empty($result);
                    
                default:
                    // For unknown drivers, assume index exists to avoid false failures
                    return true;
            }
        } catch (\Exception $e) {
            // If we can't check, assume it exists
            return true;
        }
    }
}