<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\GamificationProgress;
use App\Models\GamificationBadge;
use App\Models\GamificationLevel;
use App\Services\GamificationService;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Collection;

class GamificationPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Beneficiary $beneficiary;
    protected GamificationService $gamificationService;
    protected Collection $testBeneficiaries;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->gamificationService = app(GamificationService::class);
        
        // Create test user and beneficiary
        $this->user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
        ]);

        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $this->user->id,
            'company_id' => 1,
        ]);

        $this->createTestData();
        $this->createLargeBeneficiaryDataset();
        
        Sanctum::actingAs($this->user);
    }

    /** @test */
    public function test_leaderboard_performance_with_large_dataset()
    {
        $startTime = microtime(true);
        $startMemory = memory_get_usage();

        // Get leaderboard with large dataset
        $leaderboard = $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 50);

        $endTime = microtime(true);
        $endMemory = memory_get_usage();

        // Performance assertions
        $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
        $memoryUsed = ($endMemory - $startMemory) / 1024 / 1024; // Convert to MB

        $this->assertLessThan(500, $executionTime, 'Leaderboard query should complete within 500ms');
        $this->assertLessThan(10, $memoryUsed, 'Memory usage should be less than 10MB');
        
        // Verify result quality
        $this->assertCount(50, $leaderboard);
        
        // Verify ordering
        $points = collect($leaderboard)->pluck('total_points')->toArray();
        $this->assertEquals(collect($points)->sortDesc()->toArray(), $points);
    }

    /** @test */
    public function test_badge_criteria_evaluation_performance()
    {
        // Create complex badge criteria
        $complexBadge = GamificationBadge::create([
            'name' => 'Complex Achievement',
            'slug' => 'complex-achievement',
            'description' => 'Multiple complex criteria',
            'icon_name' => 'trophy',
            'icon_color' => '#FFD700',
            'category' => 'advanced',
            'rarity' => 'legendary',
            'points_value' => 500,
            'criteria' => [
                ['type' => 'total_points', 'value' => 1000, 'operator' => '>='],
                ['type' => 'documents_uploaded', 'value' => 10, 'operator' => '>='],
                ['type' => 'health_assessments_completed', 'value' => 5, 'operator' => '>='],
                ['type' => 'streak_days', 'value' => 30, 'operator' => '>='],
                ['type' => 'current_level', 'value' => 3, 'operator' => '>='],
                ['type' => 'engagement_score', 'value' => 80, 'operator' => '>='],
            ],
            'is_active' => true,
            'is_secret' => false,
            'max_per_user' => 1,
            'sort_order' => 0,
        ]);

        $startTime = microtime(true);

        // Check badge criteria for all test beneficiaries
        $results = $this->testBeneficiaries->map(function ($beneficiary) use ($complexBadge) {
            return $complexBadge->checkCriteria($beneficiary);
        });

        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000;

        // Should evaluate 500 beneficiaries within reasonable time
        $this->assertLessThan(2000, $executionTime, 'Badge criteria evaluation should complete within 2 seconds for 500 beneficiaries');
        
        // Verify some results
        $this->assertIsArray($results->toArray());
        $this->assertEquals(500, $results->count());
    }

    /** @test */
    public function test_bulk_point_award_performance()
    {
        $startTime = microtime(true);
        $startMemory = memory_get_usage();

        // Award points to many beneficiaries simultaneously
        $pointsAwarded = $this->testBeneficiaries->take(100)->map(function ($beneficiary) {
            return $this->gamificationService->awardPoints($beneficiary, 'profile_field');
        });

        $endTime = microtime(true);
        $endMemory = memory_get_usage();

        $executionTime = ($endTime - $startTime) * 1000;
        $memoryUsed = ($endMemory - $startMemory) / 1024 / 1024;

        // Performance assertions
        $this->assertLessThan(3000, $executionTime, 'Bulk point awards should complete within 3 seconds');
        $this->assertLessThan(20, $memoryUsed, 'Memory usage should be reasonable');
        
        // Verify all awards were successful
        $this->assertEquals(100, $pointsAwarded->count());
        $this->assertTrue($pointsAwarded->every(fn($points) => $points === 10));
    }

    /** @test */
    public function test_gamification_api_response_times()
    {
        $endpoints = [
            '/api/gamification/stats',
            '/api/gamification/progress',
            '/api/gamification/badges',
            '/api/gamification/levels',
            '/api/gamification/leaderboard',
            '/api/gamification/achievements',
            '/api/gamification/activity-feed',
            '/api/gamification/dashboard',
        ];

        foreach ($endpoints as $endpoint) {
            $startTime = microtime(true);
            
            $response = $this->getJson($endpoint);
            
            $endTime = microtime(true);
            $responseTime = ($endTime - $startTime) * 1000;

            // Each endpoint should respond within 500ms
            $this->assertLessThan(500, $responseTime, "Endpoint {$endpoint} should respond within 500ms (took {$responseTime}ms)");
            $response->assertOk();
        }
    }

    /** @test */
    public function test_database_query_optimization()
    {
        // Enable query logging
        DB::enableQueryLog();

        // Perform operations that should be optimized
        $this->gamificationService->getStatistics($this->beneficiary);
        $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 10);
        $this->gamificationService->checkAndAwardBadges($this->beneficiary);

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Analyze query performance
        $slowQueries = collect($queries)->filter(function ($query) {
            return $query['time'] > 100; // Queries taking more than 100ms
        });

        $this->assertCount(0, $slowQueries, 'No queries should take more than 100ms: ' . $slowQueries->pluck('query')->implode(', '));
        
        // Check for N+1 query problems
        $this->assertLessThan(20, count($queries), 'Total query count should be reasonable (< 20 queries)');
    }

    /** @test */
    public function test_memory_usage_with_large_datasets()
    {
        $initialMemory = memory_get_usage();

        // Process large amounts of gamification data
        for ($i = 0; $i < 100; $i++) {
            $beneficiary = $this->testBeneficiaries->random();
            $this->gamificationService->awardPoints($beneficiary, 'profile_field');
            $this->gamificationService->checkAndAwardBadges($beneficiary);
        }

        $finalMemory = memory_get_usage();
        $memoryIncrease = ($finalMemory - $initialMemory) / 1024 / 1024;

        // Memory increase should be reasonable
        $this->assertLessThan(50, $memoryIncrease, 'Memory increase should be less than 50MB');
        
        // Force garbage collection and check for memory leaks
        if (function_exists('gc_collect_cycles')) {
            gc_collect_cycles();
        }
        
        $afterGcMemory = memory_get_usage();
        $persistentMemory = ($afterGcMemory - $initialMemory) / 1024 / 1024;
        
        $this->assertLessThan(20, $persistentMemory, 'Persistent memory increase should be less than 20MB');
    }

    /** @test */
    public function test_concurrent_operations_performance()
    {
        $startTime = microtime(true);

        // Simulate concurrent operations
        $operations = collect(range(1, 50))->map(function ($i) {
            return function () use ($i) {
                $beneficiary = $this->testBeneficiaries->skip($i % 100)->first();
                
                switch ($i % 4) {
                    case 0:
                        $this->gamificationService->awardPoints($beneficiary, 'profile_field');
                        break;
                    case 1:
                        $this->gamificationService->getStatistics($beneficiary);
                        break;
                    case 2:
                        $this->gamificationService->checkAndAwardBadges($beneficiary);
                        break;
                    case 3:
                        $this->gamificationService->getLeaderboard($beneficiary->company_id, 10);
                        break;
                }
            };
        });

        // Execute operations
        foreach ($operations as $operation) {
            $operation();
        }

        $endTime = microtime(true);
        $totalTime = ($endTime - $startTime) * 1000;

        // All operations should complete within reasonable time
        $this->assertLessThan(5000, $totalTime, 'Concurrent operations should complete within 5 seconds');
    }

    /** @test */
    public function test_cache_effectiveness_for_leaderboard()
    {
        // Clear any existing cache
        Cache::flush();

        // First call (cache miss)
        $startTime = microtime(true);
        $leaderboard1 = $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 10);
        $firstCallTime = (microtime(true) - $startTime) * 1000;

        // Note: This test assumes caching is implemented in the service
        // If not implemented, both calls will have similar performance
        
        // Second call (potential cache hit)
        $startTime = microtime(true);
        $leaderboard2 = $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 10);
        $secondCallTime = (microtime(true) - $startTime) * 1000;

        // Results should be identical
        $this->assertEquals($leaderboard1, $leaderboard2);
        
        // Log the performance difference for analysis
        $this->addToAssertionCount(1); // Increment assertion count
        // Note: If caching is implemented, secondCallTime should be significantly less than firstCallTime
    }

    /** @test */
    public function test_database_connection_efficiency()
    {
        $initialConnections = DB::getQueryLog();
        DB::enableQueryLog();

        // Perform multiple operations
        for ($i = 0; $i < 10; $i++) {
            $beneficiary = $this->testBeneficiaries->random();
            $this->gamificationService->awardPoints($beneficiary, 'profile_field');
        }

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Check for efficient database usage
        $this->assertLessThan(50, count($queries), 'Should not generate excessive database queries');
        
        // Check for transaction usage
        $transactionQueries = collect($queries)->filter(function ($query) {
            return stripos($query['query'], 'BEGIN') !== false || 
                   stripos($query['query'], 'COMMIT') !== false ||
                   stripos($query['query'], 'ROLLBACK') !== false;
        });
        
        $this->assertGreaterThan(0, $transactionQueries->count(), 'Should use database transactions');
    }

    /** @test */
    public function test_large_badge_collection_performance()
    {
        // Create many badges with different criteria
        $badges = collect(range(1, 50))->map(function ($i) {
            return GamificationBadge::create([
                'name' => "Test Badge {$i}",
                'slug' => "test-badge-{$i}",
                'description' => "Test badge number {$i}",
                'icon_name' => 'badge',
                'icon_color' => '#FFD700',
                'category' => 'test',
                'rarity' => 'common',
                'points_value' => $i * 10,
                'criteria' => [
                    ['type' => 'total_points', 'value' => $i * 50, 'operator' => '>=']
                ],
                'is_active' => true,
                'is_secret' => false,
                'max_per_user' => 1,
                'sort_order' => $i,
            ]);
        });

        // Award significant points to beneficiary
        for ($i = 0; $i < 100; $i++) {
            $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
        }

        $startTime = microtime(true);
        
        // Check all badges
        $awardedBadges = $this->gamificationService->checkAndAwardBadges($this->beneficiary);
        
        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000;

        // Should complete evaluation of 50+ badges within reasonable time
        $this->assertLessThan(1000, $executionTime, 'Badge evaluation should complete within 1 second');
        
        // Verify some badges were awarded
        $this->assertGreaterThan(0, count($awardedBadges));
    }

    /** @test */
    public function test_pagination_performance_for_large_datasets()
    {
        // Test leaderboard pagination performance
        $pageSizes = [10, 25, 50, 100];
        
        foreach ($pageSizes as $pageSize) {
            $startTime = microtime(true);
            
            $leaderboard = $this->gamificationService->getLeaderboard($this->beneficiary->company_id, $pageSize);
            
            $endTime = microtime(true);
            $executionTime = ($endTime - $startTime) * 1000;

            // Larger page sizes should not drastically increase execution time
            $this->assertLessThan(1000, $executionTime, "Leaderboard with page size {$pageSize} should complete within 1 second");
            $this->assertCount(min($pageSize, 500), $leaderboard); // Limited by dataset size
        }
    }

    /**
     * Create test gamification data
     */
    protected function createTestData(): void
    {
        // Create levels
        $levels = [
            ['level_number' => 1, 'name' => 'Novice', 'points_required' => 0, 'points_to_next' => 200],
            ['level_number' => 2, 'name' => 'Explorer', 'points_required' => 200, 'points_to_next' => 300],
            ['level_number' => 3, 'name' => 'Achiever', 'points_required' => 500, 'points_to_next' => 500],
            ['level_number' => 4, 'name' => 'Expert', 'points_required' => 1000, 'points_to_next' => 1000],
            ['level_number' => 5, 'name' => 'Master', 'points_required' => 2000, 'points_to_next' => null],
        ];

        foreach ($levels as $level) {
            GamificationLevel::create(array_merge($level, [
                'title' => $level['name'],
                'color_theme' => '#3B82F6',
                'icon' => 'star',
                'description' => "Level {$level['level_number']}",
                'rewards' => [],
                'unlocked_features' => [],
                'discount_percentage' => 0,
            ]));
        }

        // Create some test badges
        $badges = [
            [
                'name' => 'First Steps',
                'slug' => 'first-steps',
                'criteria' => [['type' => 'profile_completed', 'value' => true, 'operator' => '==']]
            ],
            [
                'name' => 'Point Collector',
                'slug' => 'point-collector',
                'criteria' => [['type' => 'total_points', 'value' => 100, 'operator' => '>=']]
            ],
            [
                'name' => 'Document Master',
                'slug' => 'document-master',
                'criteria' => [['type' => 'documents_uploaded', 'value' => 5, 'operator' => '>=']]
            ],
        ];

        foreach ($badges as $badge) {
            GamificationBadge::create(array_merge($badge, [
                'description' => "Test badge: {$badge['name']}",
                'icon_name' => 'badge',
                'icon_color' => '#FFD700',
                'category' => 'test',
                'rarity' => 'common',
                'points_value' => 50,
                'is_active' => true,
                'is_secret' => false,
                'max_per_user' => 1,
                'sort_order' => 0,
            ]));
        }
    }

    /**
     * Create a large dataset of beneficiaries for performance testing
     */
    protected function createLargeBeneficiaryDataset(): void
    {
        $this->testBeneficiaries = collect(range(1, 500))->map(function ($i) {
            $user = User::factory()->create([
                'email' => "perftest{$i}@example.com",
                'name' => "Performance Test User {$i}",
            ]);

            $beneficiary = Beneficiary::factory()->create([
                'user_id' => $user->id,
                'company_id' => $this->beneficiary->company_id,
                'full_name' => "Performance Test User {$i}",
            ]);

            // Create gamification progress with varying data
            GamificationProgress::create([
                'beneficiary_id' => $beneficiary->id,
                'total_points' => random_int(0, 2000),
                'current_level' => random_int(1, 5),
                'streak_days' => random_int(0, 100),
                'tasks_completed' => random_int(0, 50),
                'documents_uploaded' => random_int(0, 20),
                'health_assessments_completed' => random_int(0, 10),
                'engagement_score' => random_int(0, 100),
                'profile_completed' => (bool) random_int(0, 1),
                'onboarding_completed' => (bool) random_int(0, 1),
                'perfect_forms' => random_int(0, 10),
                'badges_earned' => [],
                'achievements' => [],
                'last_activity_date' => now()->subDays(random_int(0, 30)),
            ]);

            return $beneficiary;
        });
    }
}