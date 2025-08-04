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
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Collection;

class GamificationConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Beneficiary $beneficiary;
    protected GamificationService $gamificationService;

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
        Sanctum::actingAs($this->user);
    }

    /** @test */
    public function test_concurrent_point_accumulation_maintains_consistency()
    {
        // Create multiple concurrent point award operations
        $operations = collect(range(1, 20))->map(function ($i) {
            return function () {
                DB::transaction(function () {
                    $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
                });
            };
        });

        // Execute operations concurrently (simulate with rapid succession)
        foreach ($operations as $operation) {
            $operation();
        }

        // Verify final state
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->refresh();
        
        // Should have exactly 200 points (20 operations * 10 points each)
        $this->assertEquals(200, $progress->total_points);
        
        // Verify no duplicate records were created
        $progressCount = GamificationProgress::where('beneficiary_id', $this->beneficiary->id)->count();
        $this->assertEquals(1, $progressCount);
    }

    /** @test */
    public function test_concurrent_badge_awards_prevent_duplicates()
    {
        // Setup badge criteria
        $badge = GamificationBadge::where('slug', 'first-steps')->first();
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->profile_completed = true;
        $progress->save();

        // Create multiple concurrent badge award attempts
        $awardAttempts = collect(range(1, 10))->map(function () use ($badge) {
            return function () use ($badge) {
                try {
                    DB::transaction(function () use ($badge) {
                        if ($badge->checkCriteria($this->beneficiary)) {
                            $this->gamificationService->awardBadge($this->beneficiary, $badge);
                        }
                    });
                } catch (\Exception $e) {
                    // Expected due to constraints
                }
            };
        });

        // Execute concurrent attempts
        foreach ($awardAttempts as $attempt) {
            $attempt();
        }

        // Verify only one badge was awarded
        $badgeCount = $this->beneficiary->badges()->where('gamification_badge_id', $badge->id)->count();
        $this->assertEquals(1, $badgeCount);
    }

    /** @test */
    public function test_concurrent_leaderboard_updates_maintain_correct_rankings()
    {
        // Create multiple beneficiaries
        $beneficiaries = collect(range(1, 10))->map(function ($i) {
            $user = User::factory()->create([
                'email' => "user{$i}@example.com",
            ]);
            
            return Beneficiary::factory()->create([
                'user_id' => $user->id,
                'company_id' => $this->beneficiary->company_id,
            ]);
        });

        // Add our main beneficiary
        $beneficiaries->push($this->beneficiary);

        // Concurrent point awards to all beneficiaries
        $operations = $beneficiaries->flatMap(function ($beneficiary, $index) {
            return collect(range(1, $index + 1))->map(function () use ($beneficiary) {
                return function () use ($beneficiary) {
                    DB::transaction(function () use ($beneficiary) {
                        $this->gamificationService->awardPoints($beneficiary, 'profile_field');
                    });
                };
            });
        });

        // Execute all operations
        foreach ($operations as $operation) {
            $operation();
        }

        // Get leaderboard
        $leaderboard = $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 20);

        // Verify rankings are correct (highest points first)
        $points = collect($leaderboard)->pluck('total_points')->toArray();
        $sortedPoints = collect($points)->sortDesc()->toArray();
        $this->assertEquals($sortedPoints, $points);

        // Verify all beneficiaries are included
        $this->assertCount(11, $leaderboard); // 10 + main beneficiary

        // Verify no duplicate entries
        $beneficiaryIds = collect($leaderboard)->pluck('beneficiary_id')->toArray();
        $uniqueIds = array_unique($beneficiaryIds);
        $this->assertEquals(count($beneficiaryIds), count($uniqueIds));
    }

    /** @test */
    public function test_concurrent_level_progression_consistency()
    {
        Event::fake();

        // Award points that should trigger level up
        $pointOperations = collect(range(1, 25))->map(function () {
            return function () {
                DB::transaction(function () {
                    $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
                });
            };
        });

        // Execute operations concurrently
        foreach ($pointOperations as $operation) {
            $operation();
        }

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->refresh();

        // Should be at level 2 with 250 points (25 * 10)
        $this->assertEquals(250, $progress->total_points);
        $this->assertEquals(2, $progress->current_level);

        // Verify only one level up event per level
        Event::assertDispatchedTimes(\App\Events\UserAction::class, function ($event) {
            return $event->action === 'level_up';
        }, 1); // Should only level up once from 1 to 2
    }

    /** @test */
    public function test_concurrent_streak_updates_maintain_accuracy()
    {
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        
        // Set initial streak
        $progress->streak_days = 5;
        $progress->last_activity_date = now()->subDay();
        $progress->save();

        // Concurrent streak updates (same day activities)
        $streakOperations = collect(range(1, 10))->map(function () {
            return function () {
                DB::transaction(function () {
                    $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');
                });
            };
        });

        foreach ($streakOperations as $operation) {
            $operation();
        }

        $progress->refresh();
        
        // Streak should be 6 (incremented once) regardless of multiple daily_login calls
        $this->assertEquals(6, $progress->streak_days);
        
        // Points should reflect all operations (10 * 5 points each)
        $this->assertEquals(50, $progress->total_points);
    }

    /** @test */
    public function test_concurrent_achievement_tracking_integrity()
    {
        // Setup for multiple achievement criteria
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        
        // Concurrent operations that trigger different achievements
        $operations = [
            // Profile completion operations
            ...collect(range(1, 5))->map(function () {
                return function () {
                    DB::transaction(function () {
                        $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
                        
                        $progress = $this->beneficiary->getOrCreateGamificationProgress();
                        $progress->profile_completed = true;
                        $progress->save();
                    });
                };
            }),
            
            // Document upload operations
            ...collect(range(1, 3))->map(function () {
                return function () {
                    DB::transaction(function () {
                        $this->gamificationService->awardPoints($this->beneficiary, 'document_upload', ['is_required' => true]);
                        
                        $progress = $this->beneficiary->getOrCreateGamificationProgress();
                        $progress->increment('documents_uploaded');
                    });
                };
            }),
        ];

        // Execute all operations
        foreach ($operations as $operation) {
            $operation();
        }

        $progress->refresh();

        // Verify achievement consistency
        $this->assertTrue($progress->profile_completed);
        $this->assertEquals(3, $progress->documents_uploaded);
        
        // Check achievements endpoint for consistency
        $response = $this->getJson('/api/gamification/achievements');
        $response->assertOk();
        
        $achievements = $response->json('data.achievements');
        $this->assertTrue($achievements['onboarding']['profile_completed']);
        $this->assertTrue($achievements['onboarding']['documents_uploaded']);
    }

    /** @test */
    public function test_high_frequency_api_requests_maintain_data_integrity()
    {
        // Simulate high-frequency API calls
        $responses = collect(range(1, 50))->map(function ($i) {
            // Alternate between different endpoints
            $endpoints = [
                '/api/gamification/stats',
                '/api/gamification/progress',
                '/api/gamification/badges',
                '/api/gamification/leaderboard',
                '/api/gamification/achievements'
            ];
            
            $endpoint = $endpoints[$i % count($endpoints)];
            return $this->getJson($endpoint);
        });

        // All requests should succeed
        foreach ($responses as $response) {
            $response->assertOk();
        }

        // Verify data consistency across all responses
        $statsResponse = $this->getJson('/api/gamification/stats');
        $progressResponse = $this->getJson('/api/gamification/progress');
        
        $statsData = $statsResponse->json('data');
        $progressData = $progressResponse->json('data');
        
        // Points should be consistent across endpoints
        $this->assertEquals($statsData['total_points'], $progressData['total_points']);
        $this->assertEquals($statsData['current_level']['number'], $progressData['current_level']['number']);
    }

    /** @test */
    public function test_database_constraint_violations_are_handled_gracefully()
    {
        $badge = GamificationBadge::where('slug', 'first-steps')->first();
        
        // Setup conditions for badge
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->profile_completed = true;
        $progress->save();

        // First award should succeed
        $this->gamificationService->awardBadge($this->beneficiary, $badge);
        $this->assertEquals(1, $this->beneficiary->badges()->count());

        // Second award should fail gracefully (badge has max_per_user = 1)
        $this->gamificationService->awardBadge($this->beneficiary, $badge);
        $this->assertEquals(1, $this->beneficiary->badges()->count()); // Should not increase

        // Multiple concurrent attempts should not cause errors
        for ($i = 0; $i < 5; $i++) {
            try {
                DB::transaction(function () use ($badge) {
                    $this->gamificationService->awardBadge($this->beneficiary, $badge);
                });
            } catch (\Exception $e) {
                // Expected - constraint violations should be handled
            }
        }

        // Final count should still be 1
        $this->assertEquals(1, $this->beneficiary->badges()->count());
    }

    /** @test */
    public function test_memory_and_performance_under_concurrent_load()
    {
        $initialMemory = memory_get_usage();
        
        // Create large number of concurrent operations
        $operations = collect(range(1, 100))->map(function ($i) {
            return function () use ($i) {
                // Vary the operations to test different code paths
                switch ($i % 4) {
                    case 0:
                        $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
                        break;
                    case 1:
                        $this->gamificationService->getStatistics($this->beneficiary);
                        break;
                    case 2:
                        $this->gamificationService->checkAndAwardBadges($this->beneficiary);
                        break;
                    case 3:
                        $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 10);
                        break;
                }
            };
        });

        $startTime = microtime(true);

        // Execute all operations
        foreach ($operations as $operation) {
            $operation();
        }

        $endTime = microtime(true);
        $finalMemory = memory_get_usage();

        // Performance assertions
        $executionTime = $endTime - $startTime;
        $this->assertLessThan(10, $executionTime, 'Operations should complete within 10 seconds');

        $memoryIncrease = $finalMemory - $initialMemory;
        $this->assertLessThan(50 * 1024 * 1024, $memoryIncrease, 'Memory increase should be less than 50MB');

        // Verify data integrity after load test
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->refresh();
        
        $this->assertGreaterThan(0, $progress->total_points);
        $this->assertGreaterThanOrEqual(1, $progress->current_level);
    }

    /** @test */
    public function test_transaction_rollback_scenarios()
    {
        $initialPoints = $this->beneficiary->getOrCreateGamificationProgress()->total_points;

        // Test transaction rollback on error
        try {
            DB::transaction(function () {
                $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
                
                // Force an error after point award
                throw new \Exception('Simulated error');
            });
        } catch (\Exception $e) {
            // Expected
        }

        // Points should not have been awarded due to rollback
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->refresh();
        $this->assertEquals($initialPoints, $progress->total_points);

        // Test successful transaction
        DB::transaction(function () {
            $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
        });

        $progress->refresh();
        $this->assertEquals($initialPoints + 10, $progress->total_points);
    }

    /**
     * Create test data for gamification
     */
    protected function createTestData(): void
    {
        // Create levels
        $levels = [
            ['level_number' => 1, 'name' => 'Novice', 'points_required' => 0, 'points_to_next' => 200],
            ['level_number' => 2, 'name' => 'Explorer', 'points_required' => 200, 'points_to_next' => 300],
            ['level_number' => 3, 'name' => 'Achiever', 'points_required' => 500, 'points_to_next' => 500],
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

        // Create badges
        GamificationBadge::create([
            'name' => 'First Steps',
            'slug' => 'first-steps',
            'description' => 'Complete your profile',
            'icon_name' => 'badge',
            'icon_color' => '#FFD700',
            'category' => 'onboarding',
            'rarity' => 'common',
            'points_value' => 50,
            'criteria' => [
                ['type' => 'profile_completed', 'value' => true, 'operator' => '==']
            ],
            'is_active' => true,
            'is_secret' => false,
            'max_per_user' => 1,
            'sort_order' => 0,
        ]);
    }
}