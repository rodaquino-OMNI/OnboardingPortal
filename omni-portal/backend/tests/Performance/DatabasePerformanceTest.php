<?php

namespace Tests\Performance;

use App\Models\User;
use App\Models\Beneficiary;
use App\Models\HealthQuestionnaire;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class DatabasePerformanceTest extends TestCase
{
    use DatabaseTransactions;

    private $metrics = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->metrics = [];
        DB::enableQueryLog();
    }

    /**
     * Test database connection performance
     */
    public function test_database_connection_performance()
    {
        $connections = ['mysql', 'sqlite'];
        
        foreach ($connections as $connection) {
            if (!config("database.connections.{$connection}")) {
                continue;
            }
            
            $startTime = microtime(true);
            
            try {
                DB::connection($connection)->select('SELECT 1');
                $endTime = microtime(true);
                $connectionTime = ($endTime - $startTime) * 1000;
                
                $this->recordMetrics("db_connection_{$connection}", [
                    'connection_time' => $connectionTime,
                    'status' => 'success'
                ]);
                
                $this->assertLessThan(100, $connectionTime, "{$connection} connection should be under 100ms");
                
            } catch (\Exception $e) {
                $this->recordMetrics("db_connection_{$connection}", [
                    'status' => 'failed',
                    'error' => $e->getMessage()
                ]);
            }
        }
    }

    /**
     * Test query performance with indexes
     */
    public function test_query_performance_with_indexes()
    {
        // Create test data
        $users = User::factory()->count(100)->create();
        $beneficiaries = [];
        
        foreach ($users as $user) {
            $beneficiaries[] = Beneficiary::factory()->create(['user_id' => $user->id]);
        }

        // Test indexed queries
        $testQueries = [
            'user_by_email' => function() use ($users) {
                return User::where('email', $users->first()->email)->first();
            },
            'user_by_cpf' => function() use ($users) {
                return User::where('cpf', $users->first()->cpf)->first();
            },
            'beneficiary_by_user_id' => function() use ($users) {
                return Beneficiary::where('user_id', $users->first()->id)->first();
            },
            'active_users' => function() {
                return User::where('is_active', true)->count();
            }
        ];

        foreach ($testQueries as $queryName => $queryFn) {
            DB::flushQueryLog();
            $startTime = microtime(true);
            
            $result = $queryFn();
            
            $endTime = microtime(true);
            $queries = DB::getQueryLog();
            $queryTime = ($endTime - $startTime) * 1000;
            
            $this->recordMetrics("query_performance_{$queryName}", [
                'query_time' => $queryTime,
                'query_count' => count($queries),
                'result_found' => !is_null($result),
                'query_details' => $queries[0] ?? null
            ]);
            
            $this->assertLessThan(50, $queryTime, "{$queryName} should execute in under 50ms");
            $this->assertEquals(1, count($queries), "{$queryName} should use exactly 1 query");
        }
    }

    /**
     * Test bulk operations performance
     */
    public function test_bulk_operations_performance()
    {
        // Test bulk insert
        $startTime = microtime(true);
        $users = User::factory()->count(100)->make()->map(function($user) {
            return $user->toArray();
        })->toArray();
        
        foreach (array_chunk($users, 10) as $chunk) {
            User::insert($chunk);
        }
        
        $endTime = microtime(true);
        $bulkInsertTime = ($endTime - $startTime) * 1000;
        
        $this->recordMetrics('bulk_insert_users', [
            'insert_time' => $bulkInsertTime,
            'records_inserted' => count($users),
            'avg_time_per_record' => $bulkInsertTime / count($users)
        ]);
        
        $this->assertLessThan(2000, $bulkInsertTime, 'Bulk insert of 100 users should complete in under 2 seconds');

        // Test bulk select with pagination
        DB::flushQueryLog();
        $startTime = microtime(true);
        
        $paginatedUsers = User::paginate(20);
        
        $endTime = microtime(true);
        $paginationTime = ($endTime - $startTime) * 1000;
        
        $this->recordMetrics('pagination_performance', [
            'pagination_time' => $paginationTime,
            'total_records' => $paginatedUsers->total(),
            'per_page' => $paginatedUsers->perPage(),
            'query_count' => count(DB::getQueryLog())
        ]);
        
        $this->assertLessThan(200, $paginationTime, 'Pagination should execute in under 200ms');
        $this->assertEquals(2, count(DB::getQueryLog()), 'Pagination should use exactly 2 queries (count + select)');
    }

    /**
     * Test cache performance
     */
    public function test_cache_performance()
    {
        $cacheKey = 'test_cache_performance';
        $testData = ['test' => 'data', 'timestamp' => now()->toISOString()];
        
        // Test cache write
        $startTime = microtime(true);
        Cache::put($cacheKey, $testData, 300);
        $endTime = microtime(true);
        $cacheWriteTime = ($endTime - $startTime) * 1000;
        
        // Test cache read
        $startTime = microtime(true);
        $cachedData = Cache::get($cacheKey);
        $endTime = microtime(true);
        $cacheReadTime = ($endTime - $startTime) * 1000;
        
        // Test cache hit vs miss
        $startTime = microtime(true);
        Cache::get('non_existent_key', 'default');
        $endTime = microtime(true);
        $cacheMissTime = ($endTime - $startTime) * 1000;
        
        $this->recordMetrics('cache_performance', [
            'cache_write_time' => $cacheWriteTime,
            'cache_read_time' => $cacheReadTime,
            'cache_miss_time' => $cacheMissTime,
            'data_retrieved' => $cachedData === $testData
        ]);
        
        $this->assertLessThan(50, $cacheWriteTime, 'Cache write should be under 50ms');
        $this->assertLessThan(10, $cacheReadTime, 'Cache read should be under 10ms');
        $this->assertEquals($testData, $cachedData, 'Cached data should match original');
        
        // Clean up
        Cache::forget($cacheKey);
    }

    /**
     * Test health questionnaire query optimization
     */
    public function test_health_questionnaire_query_optimization()
    {
        // Create test data
        $user = User::factory()->create();
        $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);
        
        $questionnaires = HealthQuestionnaire::factory()->count(10)->create([
            'beneficiary_id' => $beneficiary->id
        ]);
        
        // Test eager loading
        DB::flushQueryLog();
        $startTime = microtime(true);
        
        $result = HealthQuestionnaire::with(['beneficiary', 'template'])
            ->where('beneficiary_id', $beneficiary->id)
            ->get();
        
        $endTime = microtime(true);
        $eagerLoadTime = ($endTime - $startTime) * 1000;
        $eagerLoadQueries = count(DB::getQueryLog());
        
        // Test without eager loading (N+1 scenario)
        DB::flushQueryLog();
        $startTime = microtime(true);
        
        $questionnairesWithoutEager = HealthQuestionnaire::where('beneficiary_id', $beneficiary->id)->get();
        foreach ($questionnairesWithoutEager as $q) {
            $q->beneficiary; // This will trigger N+1
        }
        
        $endTime = microtime(true);
        $n1Time = ($endTime - $startTime) * 1000;
        $n1Queries = count(DB::getQueryLog());
        
        $this->recordMetrics('questionnaire_query_optimization', [
            'eager_load_time' => $eagerLoadTime,
            'eager_load_queries' => $eagerLoadQueries,
            'n1_time' => $n1Time,
            'n1_queries' => $n1Queries,
            'performance_improvement' => $n1Time / $eagerLoadTime,
            'query_reduction' => $n1Queries / $eagerLoadQueries
        ]);
        
        $this->assertLessThan($n1Time, $eagerLoadTime, 'Eager loading should be faster than N+1 queries');
        $this->assertLessThan($n1Queries, $eagerLoadQueries, 'Eager loading should use fewer queries');
    }

    /**
     * Test database transaction performance
     */
    public function test_transaction_performance()
    {
        $transactionOperations = [
            'simple_transaction' => function() {
                return DB::transaction(function() {
                    return User::factory()->create();
                });
            },
            'complex_transaction' => function() {
                return DB::transaction(function() {
                    $user = User::factory()->create();
                    $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);
                    $questionnaire = HealthQuestionnaire::factory()->create(['beneficiary_id' => $beneficiary->id]);
                    return [$user, $beneficiary, $questionnaire];
                });
            },
            'rollback_transaction' => function() {
                try {
                    DB::transaction(function() {
                        User::factory()->create();
                        throw new \Exception('Forced rollback');
                    });
                } catch (\Exception $e) {
                    return 'rolled_back';
                }
            }
        ];

        foreach ($transactionOperations as $operationName => $operation) {
            DB::flushQueryLog();
            $startTime = microtime(true);
            
            $result = $operation();
            
            $endTime = microtime(true);
            $transactionTime = ($endTime - $startTime) * 1000;
            
            $this->recordMetrics("transaction_{$operationName}", [
                'transaction_time' => $transactionTime,
                'query_count' => count(DB::getQueryLog()),
                'result_type' => gettype($result)
            ]);
            
            $this->assertLessThan(1000, $transactionTime, "{$operationName} should complete in under 1 second");
        }
    }

    /**
     * Record performance metrics
     */
    private function recordMetrics(string $operation, array $data)
    {
        $this->metrics[$operation] = array_merge($data, [
            'timestamp' => now()->toISOString(),
            'memory_usage' => memory_get_usage(true),
            'peak_memory' => memory_get_peak_usage(true)
        ]);
        
        echo "\n=== DATABASE METRICS: {$operation} ===\n";
        echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
    }

    protected function tearDown(): void
    {
        // Store final metrics
        file_put_contents(
            storage_path('logs/database_performance_metrics_' . date('Y-m-d_H-i-s') . '.json'),
            json_encode($this->metrics, JSON_PRETTY_PRINT)
        );
        
        parent::tearDown();
    }
}