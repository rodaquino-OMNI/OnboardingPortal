<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Beneficiary;
use App\Models\GamificationBadge;
use App\Models\GamificationLevel;
use App\Services\GamificationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GamificationController extends Controller
{
    protected GamificationService $gamificationService;

    public function __construct(GamificationService $gamificationService)
    {
        // Only apply auth middleware to specific methods
        $this->middleware('auth:sanctum')->except(['getProgress', 'getBadges', 'getLeaderboard', 'getLevels']);
        $this->gamificationService = $gamificationService;
    }

    /**
     * Get gamification statistics for the authenticated beneficiary.
     */
    public function getStats(Request $request): JsonResponse
    {
        try {
            $beneficiary = $this->getBeneficiary($request);
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => true,
                    'data' => $this->getDefaultStats()
                ]);
            }
            
            $stats = $this->gamificationService->getStatistics($beneficiary);
            
            return response()->json([
                'success' => true,
                'data' => $stats,
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting gamification stats: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => $this->getDefaultStats()
            ]);
        }
    }

    /**
     * Get badges for the authenticated beneficiary.
     */
    public function getBadges(Request $request): JsonResponse
    {
        try {
            $beneficiary = $this->getBeneficiary($request);
            
            if (!$beneficiary) {
                // Cache available badges for 1 hour - Technical Excellence
                $availableBadges = Cache::remember('gamification_badges_available', 3600, function () {
                    return GamificationBadge::where('is_active', true)
                        ->where('is_secret', false)
                        ->select(['id', 'name', 'slug', 'description', 'icon_name', 'icon_color', 'category', 'rarity', 'points_value', 'criteria'])
                        ->get()
                        ->map(function ($badge) {
                            return $this->formatBadge($badge);
                        });
                });
                    
                return response()->json([
                    'success' => true,
                    'data' => [
                        'earned' => [],
                        'available' => $availableBadges
                    ]
                ]);
            }
            
            // Eager load badges with pivot data to avoid N+1 queries
            $earnedBadges = $beneficiary->badges()
                ->select(['gamification_badges.id', 'name', 'slug', 'description', 'icon_name', 'icon_color', 'category', 'rarity', 'points_value', 'criteria', 'beneficiary_badges.earned_at'])
                ->get();
            
            // Get earned badge slugs for efficient filtering
            $earnedBadgeSlugs = $earnedBadges->pluck('slug')->toArray();
            
            // Cache available badges query
            $cacheKey = 'available_badges_for_' . $beneficiary->id;
            $availableBadges = Cache::remember($cacheKey, 300, function () use ($earnedBadgeSlugs) {
                return GamificationBadge::where('is_active', true)
                    ->where('is_secret', false)
                    ->whereNotIn('slug', $earnedBadgeSlugs)
                    ->select(['id', 'name', 'slug', 'description', 'icon_name', 'icon_color', 'category', 'rarity', 'points_value', 'criteria'])
                    ->get();
            });
            
            return response()->json([
                'success' => true,
                'data' => [
                    'earned' => $earnedBadges->map(function ($badge) {
                        return array_merge(
                            $this->formatBadge($badge),
                            ['earned_at' => $badge->pivot->earned_at]
                        );
                    }),
                    'available' => $availableBadges->map(function ($badge) {
                        return $this->formatBadge($badge);
                    }),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting badges: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => [
                    'earned' => [],
                    'available' => []
                ]
            ]);
        }
    }

    /**
     * Get all available levels.
     */
    public function getLevels(): JsonResponse
    {
        try {
            // Cache levels for 1 hour - they rarely change
            $levels = Cache::remember('gamification_levels_all', 3600, function () {
                return GamificationLevel::orderBy('level_number')->get();
            });
            
            return response()->json([
                'success' => true,
                'data' => $levels->map(function ($level) {
                    return [
                        'id' => $level->id,
                        'level_number' => $level->level_number,
                        'name' => $level->name,
                        'title' => $level->title,
                        'points_required' => $level->points_required,
                        'points_to_next' => $level->points_to_next,
                        'color_theme' => $level->color_theme,
                        'icon' => $level->icon,
                        'description' => $level->description,
                        'rewards' => $level->rewards,
                        'unlocked_features' => $level->unlocked_features,
                        'discount_percentage' => $level->discount_percentage,
                    ];
                }),
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting levels: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => []
            ]);
        }
    }

    /**
     * Get leaderboard for the company.
     */
    public function getLeaderboard(Request $request): JsonResponse
    {
        try {
            $beneficiary = $this->getBeneficiary($request);
            $limit = $request->input('limit', 10);
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => true,
                    'data' => []
                ]);
            }
            
            $companyId = $beneficiary->company_id;
            $leaderboard = $this->gamificationService->getLeaderboard($companyId, $limit);
            
            return response()->json([
                'success' => true,
                'data' => $leaderboard,
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting leaderboard: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => []
            ]);
        }
    }

    /**
     * Get detailed progress information.
     */
    public function getProgress(Request $request): JsonResponse
    {
        try {
            $beneficiary = $this->getBeneficiary($request);
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => true,
                    'data' => $this->getDefaultProgress()
                ]);
            }
            
            $progress = $beneficiary->getOrCreateGamificationProgress();
            $currentLevel = $beneficiary->getCurrentLevel();
            $nextLevel = $currentLevel ? $currentLevel->getNextLevel() : null;
            
            return response()->json([
                'success' => true,
                'data' => [
                    'total_points' => $progress->total_points,
                    'current_level' => $currentLevel ? [
                        'number' => $currentLevel->level_number,
                        'name' => $currentLevel->name,
                        'title' => $currentLevel->title,
                        'color' => $currentLevel->color_theme,
                        'icon' => $currentLevel->icon,
                        'points_required' => $currentLevel->points_required,
                    ] : $this->getDefaultLevel(),
                    'next_level' => $nextLevel ? [
                        'number' => $nextLevel->level_number,
                        'name' => $nextLevel->name,
                        'title' => $nextLevel->title,
                        'color' => $nextLevel->color_theme,
                        'icon' => $nextLevel->icon,
                        'points_required' => $nextLevel->points_required,
                        'points_remaining' => max(0, $nextLevel->points_required - $progress->total_points),
                    ] : null,
                    'progress_percentage' => $currentLevel && $nextLevel 
                        ? min(100, (($progress->total_points - $currentLevel->points_required) / 
                            ($nextLevel->points_required - $currentLevel->points_required)) * 100)
                        : 0,
                    'streak_days' => $progress->streak_days,
                    'tasks_completed' => $progress->tasks_completed,
                    'perfect_forms' => $progress->perfect_forms,
                    'documents_uploaded' => $progress->documents_uploaded,
                    'health_assessments_completed' => $progress->health_assessments_completed,
                    'engagement_score' => $progress->engagement_score,
                    'last_activity_date' => $progress->last_activity_date?->toDateString(),
                    'profile_completed' => $progress->profile_completed,
                    'onboarding_completed' => $progress->onboarding_completed,
                    'badges_earned' => $progress->badges_earned,
                    'achievements' => $progress->achievements,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting progress: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => $this->getDefaultProgress()
            ]);
        }
    }

    /**
     * Get achievements for the authenticated beneficiary.
     */
    public function getAchievements(Request $request): JsonResponse
    {
        try {
            $beneficiary = $this->getBeneficiary($request);
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => true,
                    'data' => $this->getDefaultAchievements()
                ]);
            }
            
            $progress = $beneficiary->getOrCreateGamificationProgress();
            $earnedBadges = $beneficiary->badges()->get();
            
            // Calculate various achievements based on progress
            $achievements = [
                'onboarding' => [
                    'profile_completed' => $progress->profile_completed,
                    'health_assessment_completed' => $progress->health_assessments_completed > 0,
                    'documents_uploaded' => $progress->documents_uploaded > 0,
                    'onboarding_completed' => $progress->onboarding_completed,
                ],
                'engagement' => [
                    'streak_milestone_1' => $progress->streak_days >= 7,
                    'streak_milestone_2' => $progress->streak_days >= 30,
                    'streak_milestone_3' => $progress->streak_days >= 90,
                    'high_engagement' => $progress->engagement_score >= 80,
                ],
                'tasks' => [
                    'first_task' => $progress->tasks_completed >= 1,
                    'task_milestone_10' => $progress->tasks_completed >= 10,
                    'task_milestone_50' => $progress->tasks_completed >= 50,
                    'perfect_form_submitted' => $progress->perfect_forms > 0,
                ],
                'social' => [
                    'first_badge' => $earnedBadges->count() > 0,
                    'badge_collector' => $earnedBadges->count() >= 5,
                    'badge_master' => $earnedBadges->count() >= 10,
                ],
                'points' => [
                    'first_100_points' => $progress->total_points >= 100,
                    'first_500_points' => $progress->total_points >= 500,
                    'first_1000_points' => $progress->total_points >= 1000,
                ],
            ];
            
            // Calculate total achievement progress
            $totalAchievements = 0;
            $earnedAchievements = 0;
            
            foreach ($achievements as $category => $items) {
                foreach ($items as $key => $earned) {
                    $totalAchievements++;
                    if ($earned) {
                        $earnedAchievements++;
                    }
                }
            }
            
            $achievements['summary'] = [
                'total' => $totalAchievements,
                'earned' => $earnedAchievements,
                'percentage' => $totalAchievements > 0 ? round(($earnedAchievements / $totalAchievements) * 100) : 0,
            ];
            
            return response()->json([
                'success' => true,
                'data' => $achievements,
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting achievements: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => $this->getDefaultAchievements()
            ]);
        }
    }

    /**
     * Get activity feed for the authenticated beneficiary.
     */
    public function getActivityFeed(Request $request): JsonResponse
    {
        try {
            $beneficiary = $this->getBeneficiary($request);
            $limit = $request->input('limit', 20);
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => true,
                    'data' => []
                ]);
            }
            
            // Get recent activities from various sources
            $activities = collect();
            
            // Add badge activities with selective loading
            $beneficiary->badges()
                ->select(['gamification_badges.id', 'name', 'icon_name', 'points_value', 'beneficiary_badges.earned_at'])
                ->orderBy('beneficiary_badges.earned_at', 'desc')
                ->limit(5)
                ->get()
                ->each(function ($badge) use ($activities) {
                    $activities->push([
                        'id' => 'badge_' . $badge->id . '_' . $badge->pivot->earned_at->timestamp,
                        'type' => 'badge_earned',
                        'title' => 'Conquista desbloqueada',
                        'description' => "Você conquistou o emblema '{$badge->name}'",
                        'icon' => $badge->icon_name,
                        'points' => $badge->points_value,
                        'timestamp' => $badge->pivot->earned_at->toIso8601String(),
                    ]);
                });
            
            // Add level up activities (mock for now)
            $progress = $beneficiary->getOrCreateGamificationProgress();
            if ($progress->current_level > 1) {
                $activities->push([
                    'id' => 'level_' . $progress->current_level,
                    'type' => 'level_up',
                    'title' => 'Subiu de nível!',
                    'description' => "Você alcançou o nível {$progress->current_level}",
                    'icon' => '🎉',
                    'points' => null,
                    'timestamp' => $progress->last_level_up_at ? 
                        $progress->last_level_up_at->toIso8601String() : 
                        now()->subDays(1)->toIso8601String(),
                ]);
            }
            
            // Sort by timestamp and limit
            $sortedActivities = $activities->sortByDesc('timestamp')->take($limit)->values();
            
            return response()->json([
                'success' => true,
                'data' => $sortedActivities,
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting activity feed: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => []
            ]);
        }
    }

    /**
     * Get dashboard summary for the authenticated beneficiary.
     */
    public function getDashboard(Request $request): JsonResponse
    {
        try {
            $beneficiary = $this->getBeneficiary($request);
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => true,
                    'data' => $this->getDefaultDashboard()
                ]);
            }
            
            $progress = $beneficiary->getOrCreateGamificationProgress();
            // Use eager loading to avoid N+1 queries
            $earnedBadges = $beneficiary->badges()->count();
            $totalBadges = Cache::remember('total_active_badges_count', 3600, function () {
                return GamificationBadge::where('is_active', true)->where('is_secret', false)->count();
            });
            
            $summary = [
                'user' => [
                    'name' => $beneficiary->full_name,
                    'avatar' => null, // Add avatar URL if available
                    'member_since' => $beneficiary->created_at->toDateString(),
                ],
                'stats' => [
                    'total_points' => $progress->total_points,
                    'current_level' => $progress->current_level,
                    'streak_days' => $progress->streak_days,
                    'badges_earned' => $earnedBadges,
                    'badges_total' => $totalBadges,
                    'tasks_completed' => $progress->tasks_completed,
                    'engagement_score' => $progress->engagement_score,
                ],
                'recent_achievements' => Cache::remember('recent_achievements_' . $beneficiary->id, 60, function () use ($beneficiary) {
                    return $beneficiary->badges()
                        ->select(['gamification_badges.id', 'name', 'icon_name', 'beneficiary_badges.earned_at'])
                        ->orderBy('beneficiary_badges.earned_at', 'desc')
                        ->limit(3)
                        ->get();
                })
                    ->map(function ($badge) {
                        return [
                            'id' => $badge->id,
                            'name' => $badge->name,
                            'icon' => $badge->icon_name,
                            'earned_at' => $badge->pivot->earned_at->toDateString(),
                        ];
                    }),
                'next_rewards' => [
                    'next_badge' => null, // Calculate next achievable badge
                    'next_level' => $beneficiary->getCurrentLevel()?->getNextLevel()?->name,
                    'points_to_next_level' => $progress->points_to_next_level,
                ],
            ];
            
            return response()->json([
                'success' => true,
                'data' => $summary,
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting dashboard: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => $this->getDefaultDashboard()
            ]);
        }
    }

    /**
     * Helper method to get or create beneficiary for the authenticated user.
     */
    protected function getBeneficiary(Request $request): ?Beneficiary
    {
        $user = Auth::user();
        
        if (!$user) {
            return null;
        }
        
        // First try to find existing beneficiary
        $beneficiary = Beneficiary::where('user_id', $user->id)->first();
        
        if (!$beneficiary && $user->role === 'beneficiary') {
            // If no beneficiary exists, create a default one for the user
            try {
                $beneficiary = Beneficiary::create([
                    'user_id' => $user->id,
                    'company_id' => 1, // Default company ID
                    'cpf' => $user->cpf,
                    'full_name' => $user->name,
                    'birth_date' => '2000-01-01', // Default date
                    'phone' => '11999999999', // Default phone
                    'address' => 'Address to be updated',
                    'number' => '0',
                    'neighborhood' => 'Neighborhood',
                    'city' => 'City',
                    'state' => 'SP',
                    'zip_code' => '00000-000',
                    'country' => 'BR',
                    'timezone' => 'America/Sao_Paulo',
                    'preferred_language' => 'pt',
                    'onboarding_status' => 'in_progress',
                ]);
            } catch (\Exception $e) {
                Log::error('Error creating beneficiary: ' . $e->getMessage());
                return null;
            }
        }
        
        return $beneficiary;
    }

    /**
     * Format badge data for response.
     */
    private function formatBadge($badge): array
    {
        return [
            'id' => $badge->id,
            'name' => $badge->name,
            'slug' => $badge->slug,
            'description' => $badge->description,
            'icon' => $badge->icon_name,
            'icon_name' => $badge->icon_name,
            'icon_color' => $badge->icon_color,
            'category' => $badge->category,
            'rarity' => $badge->rarity,
            'points_value' => $badge->points_value,
            'pointsRequired' => $badge->points_value, // For compatibility
            'criteria' => $badge->criteria,
        ];
    }

    /**
     * Get default stats when no beneficiary is found.
     */
    private function getDefaultStats(): array
    {
        return [
            'totalPoints' => 0,
            'currentLevel' => 1,
            'currentStreak' => 0,
            'longestStreak' => 0,
            'badgesEarned' => 0,
            'tasksCompleted' => 0,
            'achievementsUnlocked' => 0,
            'current_level' => 1,
        ];
    }

    /**
     * Get default progress when no beneficiary is found.
     */
    private function getDefaultProgress(): array
    {
        return [
            'total_points' => 0,
            'current_level' => $this->getDefaultLevel(),
            'next_level' => null,
            'progress_percentage' => 0,
            'streak_days' => 0,
            'tasks_completed' => 0,
            'perfect_forms' => 0,
            'documents_uploaded' => 0,
            'health_assessments_completed' => 0,
            'engagement_score' => 0,
            'last_activity_date' => null,
            'profile_completed' => 0,
            'onboarding_completed' => 0,
            'badges_earned' => null,
            'achievements' => null,
        ];
    }

    /**
     * Get default level data.
     */
    private function getDefaultLevel(): array
    {
        return [
            'number' => 1,
            'name' => 'Iniciante',
            'title' => 'Iniciante',
            'color' => '#4CAF50',
            'icon' => '🌱',
            'points_required' => 0,
        ];
    }

    /**
     * Get default achievements when no beneficiary is found.
     */
    private function getDefaultAchievements(): array
    {
        return [
            'onboarding' => [
                'profile_completed' => false,
                'health_assessment_completed' => false,
                'documents_uploaded' => false,
                'onboarding_completed' => false,
            ],
            'engagement' => [
                'streak_milestone_1' => false,
                'streak_milestone_2' => false,
                'streak_milestone_3' => false,
                'high_engagement' => false,
            ],
            'tasks' => [
                'first_task' => false,
                'task_milestone_10' => false,
                'task_milestone_50' => false,
                'perfect_form_submitted' => false,
            ],
            'social' => [
                'first_badge' => false,
                'badge_collector' => false,
                'badge_master' => false,
            ],
            'points' => [
                'first_100_points' => false,
                'first_500_points' => false,
                'first_1000_points' => false,
            ],
            'summary' => [
                'total' => 15,
                'earned' => 0,
                'percentage' => 0,
            ],
        ];
    }

    /**
     * Get default dashboard data when no beneficiary is found.
     */
    private function getDefaultDashboard(): array
    {
        return [
            'user' => [
                'name' => 'Guest User',
                'avatar' => null,
                'member_since' => now()->toDateString(),
            ],
            'stats' => [
                'total_points' => 0,
                'current_level' => 1,
                'streak_days' => 0,
                'badges_earned' => 0,
                'badges_total' => Cache::remember('total_active_badges_count', 3600, function () {
                    return GamificationBadge::where('is_active', true)->where('is_secret', false)->count();
                }),
                'tasks_completed' => 0,
                'engagement_score' => 0,
            ],
            'recent_achievements' => [],
            'next_rewards' => [
                'next_badge' => null,
                'next_level' => 'Aprendiz',
                'points_to_next_level' => 100,
            ],
        ];
    }
}