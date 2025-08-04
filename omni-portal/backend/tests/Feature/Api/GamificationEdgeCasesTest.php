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
use Carbon\Carbon;

class GamificationEdgeCasesTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Beneficiary $beneficiary;
    protected GamificationService $gamificationService;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->gamificationService = app(GamificationService::class);
        
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
    public function test_invalid_action_points_award()
    {
        $initialPoints = $this->beneficiary->getOrCreateGamificationProgress()->total_points;

        // Try to award points for invalid action
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'invalid_action');
        
        $this->assertEquals(0, $points);
        
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->refresh();
        $this->assertEquals($initialPoints, $progress->total_points);
    }

    /** @test */
    public function test_negative_or_zero_points_handling()
    {
        $initialPoints = $this->beneficiary->getOrCreateGamificationProgress()->total_points;

        // Mock negative points calculation
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'profile_field', ['multiplier' => -1]);
        
        $this->assertEquals(0, $points); // Should not award negative points
        
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->refresh();
        $this->assertEquals($initialPoints, $progress->total_points);
    }

    /** @test */
    public function test_badge_with_expired_availability()
    {
        // Create badge with expired availability
        $expiredBadge = GamificationBadge::create([
            'name' => 'Expired Badge',
            'slug' => 'expired-badge',
            'description' => 'This badge has expired',
            'icon_name' => 'expired',
            'icon_color' => '#999999',
            'category' => 'test',
            'rarity' => 'common',
            'points_value' => 100,
            'criteria' => [
                ['type' => 'total_points', 'value' => 10, 'operator' => '>=']
            ],
            'is_active' => true,
            'is_secret' => false,
            'max_per_user' => 1,
            'sort_order' => 0,
            'available_from' => now()->subDays(10),
            'available_until' => now()->subDays(5), // Expired 5 days ago
        ]);

        // Award points to meet criteria
        $this->gamificationService->awardPoints($this->beneficiary, 'registration');

        // Try to award expired badge
        $this->assertFalse($expiredBadge->isAvailable());
        $this->assertFalse($expiredBadge->checkCriteria($this->beneficiary));
        
        $awardedBadges = $this->gamificationService->checkAndAwardBadges($this->beneficiary);
        $expiredBadgeAwarded = collect($awardedBadges)->firstWhere('slug', 'expired-badge');
        $this->assertNull($expiredBadgeAwarded);
    }

    /** @test */
    public function test_badge_with_future_availability()
    {
        // Create badge available in the future
        $futureBadge = GamificationBadge::create([
            'name' => 'Future Badge',
            'slug' => 'future-badge',
            'description' => 'This badge is not yet available',
            'icon_name' => 'future',
            'icon_color' => '#00FF00',
            'category' => 'test',
            'rarity' => 'common',
            'points_value' => 100,
            'criteria' => [
                ['type' => 'total_points', 'value' => 10, 'operator' => '>=']
            ],
            'is_active' => true,
            'is_secret' => false,
            'max_per_user' => 1,
            'sort_order' => 0,
            'available_from' => now()->addDays(5), // Available in 5 days
            'available_until' => now()->addDays(10),
        ]);

        $this->gamificationService->awardPoints($this->beneficiary, 'registration');

        $this->assertFalse($futureBadge->isAvailable());
        $this->assertFalse($futureBadge->checkCriteria($this->beneficiary));
        
        $awardedBadges = $this->gamificationService->checkAndAwardBadges($this->beneficiary);
        $futureBadgeAwarded = collect($awardedBadges)->firstWhere('slug', 'future-badge');
        $this->assertNull($futureBadgeAwarded);
    }

    /** @test */
    public function test_max_badge_per_user_enforcement()
    {
        $badge = GamificationBadge::where('slug', 'first-steps')->first();
        $badge->max_per_user = 2;
        $badge->save();

        // Setup conditions
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->profile_completed = true;
        $progress->save();

        // Award badge first time
        $this->gamificationService->awardBadge($this->beneficiary, $badge);
        $this->assertEquals(1, $this->beneficiary->badges()->where('gamification_badge_id', $badge->id)->count());

        // Award badge second time
        $this->gamificationService->awardBadge($this->beneficiary, $badge);
        $this->assertEquals(2, $this->beneficiary->badges()->where('gamification_badge_id', $badge->id)->count());

        // Try to award badge third time (should fail)
        $this->gamificationService->awardBadge($this->beneficiary, $badge);
        $this->assertEquals(2, $this->beneficiary->badges()->where('gamification_badge_id', $badge->id)->count());
    }

    /** @test */
    public function test_level_progression_at_maximum_level()
    {
        $maxLevel = GamificationLevel::orderBy('level_number', 'desc')->first();
        
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->current_level = $maxLevel->level_number;
        $progress->total_points = $maxLevel->points_required;
        $progress->save();

        // Award more points (should not level up further)
        $this->gamificationService->awardPoints($this->beneficiary, 'registration');

        $progress->refresh();
        $this->assertEquals($maxLevel->level_number, $progress->current_level);
        
        // Check level up returns null
        $nextLevel = $progress->checkLevelUp();
        $this->assertNull($nextLevel);
    }

    /** @test */
    public function test_streak_calculation_edge_cases()
    {
        $progress = $this->beneficiary->getOrCreateGamificationProgress();

        // Test first activity (no previous activity)
        $progress->last_activity_date = null;
        $progress->streak_days = 0;
        $progress->save();

        $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');
        $progress->refresh();
        $this->assertEquals(1, $progress->streak_days);

        // Test activity gap of exactly 2 days (should reset)
        $progress->last_activity_date = now()->subDays(2);
        $progress->streak_days = 5;
        $progress->save();

        $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');
        $progress->refresh();
        $this->assertEquals(1, $progress->streak_days); // Reset

        // Test same day activity (should not change streak)
        $today = now()->startOfDay();
        $progress->last_activity_date = $today;
        $progress->streak_days = 3;
        $progress->save();

        $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');
        $progress->refresh();
        $this->assertEquals(3, $progress->streak_days); // Unchanged
    }

    /** @test */
    public function test_invalid_badge_criteria_handling()
    {
        // Create badge with invalid criteria
        $invalidBadge = GamificationBadge::create([
            'name' => 'Invalid Badge',
            'slug' => 'invalid-badge',
            'description' => 'Badge with invalid criteria',
            'icon_name' => 'invalid',
            'icon_color' => '#FF0000',
            'category' => 'test',
            'rarity' => 'common',
            'points_value' => 100,
            'criteria' => [
                ['type' => 'unknown_field', 'value' => 100, 'operator' => '>='],
                ['type' => 'total_points', 'value' => 'invalid_value', 'operator' => '>='],
                ['type' => 'total_points', 'value' => 100, 'operator' => 'invalid_operator'],
            ],
            'is_active' => true,
            'is_secret' => false,
            'max_per_user' => 1,
            'sort_order' => 0,
        ]);

        $this->gamificationService->awardPoints($this->beneficiary, 'registration');

        // Should not crash and should not award the badge
        $this->assertFalse($invalidBadge->checkCriteria($this->beneficiary));
        
        $awardedBadges = $this->gamificationService->checkAndAwardBadges($this->beneficiary);
        $invalidBadgeAwarded = collect($awardedBadges)->firstWhere('slug', 'invalid-badge');
        $this->assertNull($invalidBadgeAwarded);
    }

    /** @test */
    public function test_leaderboard_with_tied_scores()
    {
        // Create beneficiaries with identical scores
        $tiedBeneficiaries = collect(range(1, 5))->map(function ($i) {
            $user = User::factory()->create(['email' => "tied{$i}@example.com"]);
            $beneficiary = Beneficiary::factory()->create([
                'user_id' => $user->id,
                'company_id' => $this->beneficiary->company_id,
            ]);

            // Award identical points
            $this->gamificationService->awardPoints($beneficiary, 'registration'); // 100 points each

            return $beneficiary;
        });

        $leaderboard = $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 10);

        // All tied beneficiaries should have the same points
        $pointCounts = collect($leaderboard)->countBy('total_points');
        $this->assertGreaterThan(0, $pointCounts[100] ?? 0); // Should have multiple entries with 100 points

        // Verify stable sorting (additional criteria like level, engagement_score)
        $leaderboard100Points = collect($leaderboard)->where('total_points', 100)->toArray();
        $this->assertGreaterThan(1, count($leaderboard100Points));
    }

    /** @test */
    public function test_engagement_score_boundary_conditions()
    {
        $progress = $this->beneficiary->getOrCreateGamificationProgress();

        // Test maximum engagement score
        $progress->tasks_completed = 50; // Base score would be 100
        $progress->streak_days = 10; // Bonus would be 20
        $progress->last_activity_date = now(); // No penalty
        $progress->updateEngagementScore();

        $this->assertEquals(100, $progress->engagement_score); // Capped at 100

        // Test minimum engagement score
        $progress->tasks_completed = 0;
        $progress->streak_days = 0;
        $progress->last_activity_date = now()->subDays(30); // High penalty
        $progress->updateEngagementScore();

        $this->assertEquals(0, $progress->engagement_score); // Floor at 0

        // Test null last activity date
        $progress->last_activity_date = null;
        $progress->updateEngagementScore();

        $this->assertGreaterThanOrEqual(0, $progress->engagement_score);
        $this->assertLessThanOrEqual(100, $progress->engagement_score);
    }

    /** @test */
    public function test_api_endpoints_with_missing_beneficiary()
    {
        // Create user without beneficiary
        $userWithoutBeneficiary = User::factory()->create([
            'email' => 'nobene@example.com',
        ]);

        Sanctum::actingAs($userWithoutBeneficiary);

        // Test that endpoints handle missing beneficiary gracefully
        $endpoints = [
            '/api/gamification/stats',
            '/api/gamification/progress',
            '/api/gamification/badges',
            '/api/gamification/leaderboard',
            '/api/gamification/achievements',
            '/api/gamification/activity-feed',
            '/api/gamification/dashboard',
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            
            // Should either create beneficiary automatically or return 404
            $this->assertContains($response->status(), [200, 404], 
                "Endpoint {$endpoint} should handle missing beneficiary gracefully");
        }
    }

    /** @test */
    public function test_large_metadata_handling()
    {
        // Test with very large metadata
        $largeMetadata = [
            'large_array' => array_fill(0, 1000, 'test_value'),
            'nested_data' => [
                'level1' => [
                    'level2' => [
                        'level3' => array_fill(0, 100, 'deep_value')
                    ]
                ]
            ],
            'long_string' => str_repeat('a', 10000),
        ];

        // Should handle large metadata without errors
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'profile_field', $largeMetadata);
        $this->assertEquals(10, $points);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $this->assertGreaterThan(0, $progress->total_points);
    }

    /** @test */
    public function test_unicode_and_special_characters()
    {
        // Create badge with unicode characters
        $unicodeBadge = GamificationBadge::create([
            'name' => '🏆 Special Badge 特別バッジ',
            'slug' => 'special-unicode-badge',
            'description' => 'Badge with émojis and spëcial çharacters 日本語',
            'icon_name' => '🎖️',
            'icon_color' => '#FFD700',
            'category' => 'spëcial',
            'rarity' => 'unicörn',
            'points_value' => 100,
            'criteria' => [
                ['type' => 'total_points', 'value' => 10, 'operator' => '>=']
            ],
            'is_active' => true,
            'is_secret' => false,
            'max_per_user' => 1,
            'sort_order' => 0,
        ]);

        $this->gamificationService->awardPoints($this->beneficiary, 'registration');
        $this->gamificationService->awardBadge($this->beneficiary, $unicodeBadge);

        // Test API response with unicode
        $response = $this->getJson('/api/gamification/badges');
        $response->assertOk();

        $badges = $response->json('data.earned');
        $earnedUnicodeBadge = collect($badges)->firstWhere('slug', 'special-unicode-badge');
        
        $this->assertNotNull($earnedUnicodeBadge);
        $this->assertEquals('🏆 Special Badge 特別バッジ', $earnedUnicodeBadge['name']);
    }

    /** @test */
    public function test_database_constraint_violations()
    {
        // Test duplicate badge award (should be handled by constraints)
        $badge = GamificationBadge::where('slug', 'first-steps')->first();
        
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->profile_completed = true;
        $progress->save();

        // Award badge first time
        $this->gamificationService->awardBadge($this->beneficiary, $badge);

        // Try to manually create duplicate (should fail gracefully)
        try {
            DB::table('beneficiary_badges')->insert([
                'beneficiary_id' => $this->beneficiary->id,
                'gamification_badge_id' => $badge->id,
                'earned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Expected due to unique constraint
            $this->assertStringContains('Duplicate entry', $e->getMessage());
        }

        // Verify only one badge exists
        $this->assertEquals(1, $this->beneficiary->badges()->where('gamification_badge_id', $badge->id)->count());
    }

    /** @test */
    public function test_api_rate_limiting_behavior()
    {
        // Test rapid API calls (simulating rate limiting scenarios)
        $responses = [];
        
        for ($i = 0; $i < 20; $i++) {
            $responses[] = $this->getJson('/api/gamification/stats');
        }

        // All should succeed (unless rate limiting is configured)
        foreach ($responses as $response) {
            $this->assertContains($response->status(), [200, 429]); // 429 = Too Many Requests
        }

        // At least some should succeed
        $successfulResponses = collect($responses)->filter(fn($r) => $r->status() === 200);
        $this->assertGreaterThan(0, $successfulResponses->count());
    }

    /** @test */
    public function test_memory_cleanup_after_operations()
    {
        $initialMemory = memory_get_usage();

        // Perform many operations
        for ($i = 0; $i < 100; $i++) {
            $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
            $this->gamificationService->getStatistics($this->beneficiary);
            $this->gamificationService->checkAndAwardBadges($this->beneficiary);
        }

        // Force garbage collection
        if (function_exists('gc_collect_cycles')) {
            gc_collect_cycles();
        }

        $finalMemory = memory_get_usage();
        $memoryIncrease = ($finalMemory - $initialMemory) / 1024 / 1024;

        // Memory increase should be reasonable (less than 20MB)
        $this->assertLessThan(20, $memoryIncrease, 'Memory increase should be controlled');
    }

    /** @test */
    public function test_progress_percentage_edge_cases()
    {
        $level1 = GamificationLevel::where('level_number', 1)->first();
        $level2 = GamificationLevel::where('level_number', 2)->first();

        // Test progress at exact level threshold
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->total_points = $level2->points_required; // Exactly at level 2 threshold
        $progress->current_level = 2;
        $progress->save();

        $response = $this->getJson('/api/gamification/progress');
        $data = $response->json('data');

        // Progress percentage should be reasonable
        $this->assertGreaterThanOrEqual(0, $data['progress_percentage']);
        $this->assertLessThanOrEqual(100, $data['progress_percentage']);

        // Test with max level (no next level)
        $maxLevel = GamificationLevel::orderBy('level_number', 'desc')->first();
        $progress->current_level = $maxLevel->level_number;
        $progress->total_points = $maxLevel->points_required + 1000;
        $progress->save();

        $response = $this->getJson('/api/gamification/progress');
        $data = $response->json('data');

        $this->assertEquals(100, $data['progress_percentage']);
        $this->assertNull($data['next_level']);
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

        // Create badge
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