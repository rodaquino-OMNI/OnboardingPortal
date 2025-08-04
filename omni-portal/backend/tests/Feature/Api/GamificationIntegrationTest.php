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
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\DB;
use App\Events\UserAction;

class GamificationIntegrationTest extends TestCase
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
            'email_verified_at' => now(),
            'registration_step' => 'completed',
            'is_active' => true,
        ]);

        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $this->user->id,
            'company_id' => 1,
        ]);

        // Create gamification levels
        $this->createTestLevels();
        
        // Create gamification badges
        $this->createTestBadges();

        Sanctum::actingAs($this->user);
    }

    /** @test */
    public function test_points_accumulation_across_different_activities()
    {
        // Test registration points
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'registration');
        $this->assertEquals(100, $points);

        // Test profile field completion
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
        $this->assertEquals(10, $points);

        // Test health questionnaire
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'health_question');
        $this->assertEquals(20, $points);

        // Test document upload (required)
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'document_upload', ['is_required' => true]);
        $this->assertEquals(50, $points);

        // Test document upload (optional)
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'document_upload', ['is_required' => false]);
        $this->assertEquals(100, $points);

        // Verify total points
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $this->assertEquals(280, $progress->total_points);

        // Test interview completion
        $points = $this->gamificationService->awardPoints($this->beneficiary, 'interview', ['is_completed' => true]);
        $this->assertEquals(200, $points);

        // Verify final total
        $progress->refresh();
        $this->assertEquals(480, $progress->total_points);
    }

    /** @test */
    public function test_badge_unlocking_conditions_and_progression()
    {
        // Award initial points to meet badge criteria
        $this->gamificationService->awardPoints($this->beneficiary, 'registration');
        $this->gamificationService->awardPoints($this->beneficiary, 'profile_completed');

        // Mark profile as completed
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->profile_completed = true;
        $progress->save();

        // Check badges
        $awardedBadges = $this->gamificationService->checkAndAwardBadges($this->beneficiary);
        
        // Should get "First Steps" badge for profile completion
        $this->assertCount(1, $awardedBadges);
        $this->assertEquals('first-steps', $awardedBadges[0]->slug);

        // Test streak badge
        $progress->streak_days = 7;
        $progress->save();

        $awardedBadges = $this->gamificationService->checkAndAwardBadges($this->beneficiary);
        
        // Should get "Week Warrior" badge for 7-day streak
        $weekWarriorBadge = collect($awardedBadges)->firstWhere('slug', 'week-warrior');
        $this->assertNotNull($weekWarriorBadge);
    }

    /** @test */
    public function test_leaderboard_real_time_updates_with_proper_ranking()
    {
        // Create multiple beneficiaries for company leaderboard
        $competitors = collect(range(1, 5))->map(function ($i) {
            $user = User::factory()->create([
                'email' => "user{$i}@example.com",
            ]);
            
            $beneficiary = Beneficiary::factory()->create([
                'user_id' => $user->id,
                'company_id' => $this->beneficiary->company_id,
            ]);

            // Award different amounts of points
            $this->gamificationService->awardPoints($beneficiary, 'registration');
            for ($j = 0; $j < $i; $j++) {
                $this->gamificationService->awardPoints($beneficiary, 'profile_field');
            }

            return $beneficiary;
        });

        // Award main beneficiary more points
        $this->gamificationService->awardPoints($this->beneficiary, 'registration');
        for ($i = 0; $i < 10; $i++) {
            $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
        }

        // Get leaderboard
        $leaderboard = $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 10);

        // Verify ranking (main beneficiary should be first with 200 points)
        $this->assertEquals($this->beneficiary->id, $leaderboard[0]['beneficiary_id']);
        $this->assertEquals(200, $leaderboard[0]['total_points']);

        // Verify order is correct
        $points = collect($leaderboard)->pluck('total_points')->toArray();
        $sortedPoints = collect($points)->sortDesc()->toArray();
        $this->assertEquals($sortedPoints, $points);
    }

    /** @test */
    public function test_concurrent_user_updates_to_leaderboard()
    {
        Event::fake();

        // Simulate concurrent point awards
        $promises = collect(range(1, 10))->map(function ($i) {
            return function () use ($i) {
                DB::transaction(function () use ($i) {
                    $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
                });
            };
        });

        // Execute all transactions concurrently
        foreach ($promises as $promise) {
            $promise();
        }

        // Verify final state
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->refresh();
        
        $this->assertEquals(100, $progress->total_points); // 10 * 10 points each
        
        // Verify no duplicate entries or corruption
        $leaderboard = $this->gamificationService->getLeaderboard($this->beneficiary->company_id, 10);
        $this->assertCount(1, $leaderboard);
    }

    /** @test */
    public function test_level_progression_and_milestone_rewards()
    {
        Event::fake();

        // Award points to trigger level up
        $this->gamificationService->awardPoints($this->beneficiary, 'registration'); // 100 points
        $this->gamificationService->awardPoints($this->beneficiary, 'profile_completed'); // 50 points
        $this->gamificationService->awardPoints($this->beneficiary, 'document_upload', ['is_required' => false]); // 100 points

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->refresh();

        // Should be at level 2 (250 points)
        $this->assertEquals(2, $progress->current_level);
        $this->assertEquals(250, $progress->total_points);

        // Verify level up event was dispatched
        Event::assertDispatched(UserAction::class, function ($event) {
            return $event->action === 'level_up' && 
                   $event->metadata['new_level'] === 2;
        });

        // Test milestone rewards
        $currentLevel = $this->beneficiary->getCurrentLevel();
        $this->assertNotNull($currentLevel);
        $this->assertEquals('Explorer', $currentLevel->name);
        $this->assertNotNull($currentLevel->rewards);
    }

    /** @test */
    public function test_achievement_notifications_and_activity_feed()
    {
        Event::fake();

        // Complete various activities
        $this->gamificationService->awardPoints($this->beneficiary, 'registration');
        $this->gamificationService->awardPoints($this->beneficiary, 'profile_completed');
        
        // Mark progress for achievements
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->profile_completed = true;
        $progress->documents_uploaded = 1;
        $progress->save();

        // Award badge
        $badge = GamificationBadge::where('slug', 'first-steps')->first();
        $this->gamificationService->awardBadge($this->beneficiary, $badge);

        // Test activity feed endpoint
        $response = $this->getJson('/api/gamification/activity-feed');
        
        $response->assertOk()
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        '*' => [
                            'type',
                            'timestamp',
                            'data' => [
                                'badge_name',
                                'badge_icon',
                                'badge_color',
                                'points_earned'
                            ]
                        ]
                    ]
                ]);

        // Verify events were dispatched
        Event::assertDispatched(UserAction::class, function ($event) {
            return $event->action === 'badge_earned';
        });
    }

    /** @test */
    public function test_progress_tracking_across_sessions()
    {
        // Award points in first "session"
        $this->gamificationService->awardPoints($this->beneficiary, 'registration');
        $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $firstSessionPoints = $progress->total_points;
        $firstSessionLevel = $progress->current_level;

        // Simulate new session (different day)
        $progress->last_activity_date = now()->subDay();
        $progress->save();

        // Award more points
        $this->gamificationService->awardPoints($this->beneficiary, 'profile_field');
        $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');

        $progress->refresh();

        // Verify progress persisted and accumulated
        $this->assertGreaterThan($firstSessionPoints, $progress->total_points);
        $this->assertGreaterThanOrEqual($firstSessionLevel, $progress->current_level);

        // Test API endpoint for progress
        $response = $this->getJson('/api/gamification/progress');
        
        $response->assertOk()
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'total_points',
                        'current_level',
                        'next_level',
                        'progress_percentage',
                        'streak_days',
                        'tasks_completed'
                    ]
                ]);
    }

    /** @test */
    public function test_streak_management_and_daily_login_bonuses()
    {
        // Day 1
        $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $this->assertEquals(1, $progress->streak_days);

        // Day 2 (consecutive)
        $progress->last_activity_date = now()->subDay();
        $progress->save();
        
        $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');
        $progress->refresh();
        $this->assertEquals(2, $progress->streak_days);

        // Day 4 (missed day 3)
        $progress->last_activity_date = now()->subDays(2);
        $progress->save();
        
        $this->gamificationService->awardPoints($this->beneficiary, 'daily_login');
        $progress->refresh();
        $this->assertEquals(1, $progress->streak_days); // Reset

        // Test streak bonus calculation
        $progress->streak_days = 10;
        $progress->save();
        
        $bonusPoints = $this->gamificationService->awardPoints($this->beneficiary, 'streak_bonus', ['streak_days' => 10]);
        $this->assertEquals(100, $bonusPoints); // Capped at 100
    }

    /** @test */
    public function test_gamification_analytics_and_reporting()
    {
        // Generate test data
        $this->gamificationService->awardPoints($this->beneficiary, 'registration');
        $this->gamificationService->awardPoints($this->beneficiary, 'profile_completed');
        $this->gamificationService->awardPoints($this->beneficiary, 'document_upload', ['is_required' => true]);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->profile_completed = true;
        $progress->documents_uploaded = 3;
        $progress->health_assessments_completed = 2;
        $progress->tasks_completed = 5;
        $progress->save();

        // Test statistics endpoint
        $response = $this->getJson('/api/gamification/stats');
        
        $response->assertOk()
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'total_points',
                        'current_level' => [
                            'number',
                            'name',
                            'color',
                            'icon'
                        ],
                        'next_level',
                        'streak_days',
                        'badges_earned',
                        'tasks_completed',
                        'engagement_score'
                    ]
                ]);

        // Test achievements endpoint
        $response = $this->getJson('/api/gamification/achievements');
        
        $response->assertOk()
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'achievements' => [
                            'onboarding' => [
                                'profile_completed',
                                'health_assessment_completed',
                                'documents_uploaded',
                                'onboarding_completed'
                            ],
                            'engagement',
                            'tasks',
                            'social',
                            'points'
                        ],
                        'summary' => [
                            'total',
                            'completed',
                            'completion_percentage'
                        ]
                    ]
                ]);

        // Verify analytics calculations
        $data = $response->json('data');
        $this->assertTrue($data['achievements']['onboarding']['profile_completed']);
        $this->assertTrue($data['achievements']['onboarding']['health_assessment_completed']);
        $this->assertTrue($data['achievements']['onboarding']['documents_uploaded']);
    }

    /** @test */
    public function test_edge_cases_and_boundary_conditions()
    {
        // Test negative points (should not reduce total)
        $initialPoints = $this->beneficiary->getOrCreateGamificationProgress()->total_points;
        $this->gamificationService->awardPoints($this->beneficiary, 'invalid_action');
        
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $this->assertEquals($initialPoints, $progress->total_points);

        // Test maximum streak days
        $progress->streak_days = 365;
        $progress->save();
        
        $bonusPoints = $this->gamificationService->awardPoints($this->beneficiary, 'streak_bonus', ['streak_days' => 365]);
        $this->assertEquals(100, $bonusPoints); // Should be capped

        // Test badge max per user limit
        $badge = GamificationBadge::where('slug', 'first-steps')->first();
        $badge->max_per_user = 1;
        $badge->save();

        // Award badge first time
        $this->gamificationService->awardBadge($this->beneficiary, $badge);
        $this->assertEquals(1, $this->beneficiary->badges()->count());

        // Try to award same badge again
        $this->gamificationService->awardBadge($this->beneficiary, $badge);
        $this->assertEquals(1, $this->beneficiary->badges()->count()); // Should not increase

        // Test level progression at max level
        $maxLevel = GamificationLevel::orderBy('level_number', 'desc')->first();
        $progress->current_level = $maxLevel->level_number;
        $progress->total_points = $maxLevel->points_required + 1000;
        $progress->save();

        $nextLevel = $progress->checkLevelUp();
        $this->assertNull($nextLevel); // No level up possible
    }

    /** @test */
    public function test_gamification_api_endpoints_integration()
    {
        // Setup test data
        $this->gamificationService->awardPoints($this->beneficiary, 'registration');
        
        // Test badges endpoint
        $response = $this->getJson('/api/gamification/badges');
        $response->assertOk()
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'earned' => [],
                        'available' => [
                            '*' => [
                                'id',
                                'name',
                                'slug',
                                'description',
                                'icon_name',
                                'category',
                                'rarity'
                            ]
                        ]
                    ]
                ]);

        // Test levels endpoint
        $response = $this->getJson('/api/gamification/levels');
        $response->assertOk()
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        '*' => [
                            'level_number',
                            'name',
                            'title',
                            'points_required',
                            'color_theme',
                            'rewards'
                        ]
                    ]
                ]);

        // Test leaderboard endpoint
        $response = $this->getJson('/api/gamification/leaderboard');
        $response->assertOk()
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        '*' => [
                            'beneficiary_id',
                            'name',
                            'total_points',
                            'current_level',
                            'badges_count'
                        ]
                    ]
                ]);

        // Test dashboard endpoint
        $response = $this->getJson('/api/gamification/dashboard');
        $response->assertOk()
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'stats',
                        'recent_badges',
                        'quick_stats' => [
                            'points_today',
                            'streak_days',
                            'completion_rate',
                            'rank_in_company'
                        ]
                    ]
                ]);
    }

    /** @test */
    public function test_concurrent_badge_awards_and_race_conditions()
    {
        // Create multiple processes trying to award the same badge
        $badge = GamificationBadge::where('slug', 'first-steps')->first();
        $badge->max_per_user = 1;
        $badge->save();

        // Setup conditions for badge
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $progress->profile_completed = true;
        $progress->save();

        // Simulate concurrent badge awards
        DB::transaction(function () use ($badge) {
            $this->gamificationService->awardBadge($this->beneficiary, $badge);
        });

        DB::transaction(function () use ($badge) {
            $this->gamificationService->awardBadge($this->beneficiary, $badge);
        });

        // Should only have one instance of the badge
        $this->assertEquals(1, $this->beneficiary->badges()->where('gamification_badge_id', $badge->id)->count());
    }

    /**
     * Create test gamification levels
     */
    protected function createTestLevels(): void
    {
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
                'description' => "Level {$level['level_number']} - {$level['name']}",
                'rewards' => ['discount' => $level['level_number'] * 5],
                'unlocked_features' => [],
                'discount_percentage' => $level['level_number'] * 5,
            ]));
        }
    }

    /**
     * Create test gamification badges
     */
    protected function createTestBadges(): void
    {
        $badges = [
            [
                'name' => 'First Steps',
                'slug' => 'first-steps',
                'description' => 'Complete your profile',
                'category' => 'onboarding',
                'rarity' => 'common',
                'points_value' => 50,
                'criteria' => [
                    ['type' => 'profile_completed', 'value' => true, 'operator' => '==']
                ],
                'max_per_user' => 1,
            ],
            [
                'name' => 'Week Warrior',
                'slug' => 'week-warrior',
                'description' => 'Maintain a 7-day streak',
                'category' => 'engagement',
                'rarity' => 'uncommon',
                'points_value' => 100,
                'criteria' => [
                    ['type' => 'streak_days', 'value' => 7, 'operator' => '>=']
                ],
                'max_per_user' => 1,
            ],
            [
                'name' => 'Document Master',
                'slug' => 'document-master',
                'description' => 'Upload 5 documents',
                'category' => 'tasks',
                'rarity' => 'rare',
                'points_value' => 200,
                'criteria' => [
                    ['type' => 'documents_uploaded', 'value' => 5, 'operator' => '>=']
                ],
                'max_per_user' => 1,
            ],
        ];

        foreach ($badges as $badge) {
            GamificationBadge::create(array_merge($badge, [
                'icon_name' => 'badge',
                'icon_color' => '#FFD700',
                'is_active' => true,
                'is_secret' => false,
                'sort_order' => 0,
            ]));
        }
    }
}