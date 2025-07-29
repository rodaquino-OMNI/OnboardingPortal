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
use Illuminate\Support\Facades\DB;

class GamificationController extends Controller
{
    protected GamificationService $gamificationService;

    public function __construct(GamificationService $gamificationService)
    {
        $this->middleware('auth:sanctum');
        $this->gamificationService = $gamificationService;
    }

    /**
     * Get gamification statistics for the authenticated beneficiary.
     */
    public function getStats(Request $request): JsonResponse
    {
        $beneficiary = $this->getBeneficiary($request);
        
        if (!$beneficiary) {
            return response()->json(['error' => 'Beneficiary not found'], 404);
        }
        
        $stats = $this->gamificationService->getStatistics($beneficiary);
        
        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get badges for the authenticated beneficiary.
     */
    public function getBadges(Request $request): JsonResponse
    {
        $beneficiary = $this->getBeneficiary($request);
        
        if (!$beneficiary) {
            return response()->json(['error' => 'Beneficiary not found'], 404);
        }
        
        $earnedBadges = $beneficiary->badges()->get();
        $availableBadges = GamificationBadge::where('is_active', true)
            ->where('is_secret', false)
            ->get();
        
        return response()->json([
            'success' => true,
            'data' => [
                'earned' => $earnedBadges->map(function ($badge) {
                    return [
                        'id' => $badge->id,
                        'name' => $badge->name,
                        'slug' => $badge->slug,
                        'description' => $badge->description,
                        'icon_name' => $badge->icon_name,
                        'icon_color' => $badge->icon_color,
                        'category' => $badge->category,
                        'rarity' => $badge->rarity,
                        'points_value' => $badge->points_value,
                        'earned_at' => $badge->pivot->earned_at,
                    ];
                }),
                'available' => $availableBadges->filter(function ($badge) use ($beneficiary) {
                    return !$beneficiary->hasBadge($badge->slug);
                })->map(function ($badge) {
                    return [
                        'id' => $badge->id,
                        'name' => $badge->name,
                        'slug' => $badge->slug,
                        'description' => $badge->description,
                        'icon_name' => $badge->icon_name,
                        'icon_color' => $badge->icon_color,
                        'category' => $badge->category,
                        'rarity' => $badge->rarity,
                        'points_value' => $badge->points_value,
                        'criteria' => $badge->criteria,
                    ];
                }),
            ],
        ]);
    }

    /**
     * Get all available levels.
     */
    public function getLevels(): JsonResponse
    {
        $levels = GamificationLevel::orderBy('level_number')->get();
        
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
    }

    /**
     * Get leaderboard for the company.
     */
    public function getLeaderboard(Request $request): JsonResponse
    {
        $beneficiary = $this->getBeneficiary($request);
        
        if (!$beneficiary) {
            return response()->json(['error' => 'Beneficiary not found'], 404);
        }
        
        $limit = $request->input('limit', 10);
        $companyId = $beneficiary->company_id;
        
        $leaderboard = $this->gamificationService->getLeaderboard($companyId, $limit);
        
        return response()->json([
            'success' => true,
            'data' => $leaderboard,
        ]);
    }

    /**
     * Get detailed progress information.
     */
    public function getProgress(Request $request): JsonResponse
    {
        $beneficiary = $this->getBeneficiary($request);
        
        if (!$beneficiary) {
            return response()->json(['error' => 'Beneficiary not found'], 404);
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
                ] : null,
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
                    : 100,
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
    }

    /**
     * Get achievements for the authenticated beneficiary.
     */
    public function getAchievements(Request $request): JsonResponse
    {
        $beneficiary = $this->getBeneficiary($request);
        
        if (!$beneficiary) {
            return response()->json(['error' => 'Beneficiary not found'], 404);
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
        $completedAchievements = 0;
        
        foreach ($achievements as $category => $categoryAchievements) {
            $totalAchievements += count($categoryAchievements);
            $completedAchievements += count(array_filter($categoryAchievements));
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'achievements' => $achievements,
                'summary' => [
                    'total' => $totalAchievements,
                    'completed' => $completedAchievements,
                    'completion_percentage' => $totalAchievements > 0 ? round(($completedAchievements / $totalAchievements) * 100, 2) : 0,
                ],
                'recent_badges' => $earnedBadges->sortByDesc('pivot.earned_at')->take(5)->map(function ($badge) {
                    return [
                        'name' => $badge->name,
                        'icon' => $badge->icon_name,
                        'color' => $badge->icon_color,
                        'earned_at' => $badge->pivot->earned_at,
                        'points' => $badge->points_value,
                    ];
                }),
            ],
        ]);
    }

    /**
     * Get activity feed for gamification events.
     */
    public function getActivityFeed(Request $request): JsonResponse
    {
        $beneficiary = $this->getBeneficiary($request);
        
        if (!$beneficiary) {
            return response()->json(['error' => 'Beneficiary not found'], 404);
        }
        
        $limit = $request->input('limit', 20);
        
        // Get recent activities (this would need to be implemented with an activities table)
        // For now, we'll return recent badges and level ups
        $recentBadges = $beneficiary->badges()
            ->orderBy('pivot_earned_at', 'desc')
            ->limit($limit)
            ->get();
        
        $activities = $recentBadges->map(function ($badge) {
            return [
                'type' => 'badge_earned',
                'timestamp' => $badge->pivot->earned_at,
                'data' => [
                    'badge_name' => $badge->name,
                    'badge_icon' => $badge->icon_name,
                    'badge_color' => $badge->icon_color,
                    'badge_rarity' => $badge->rarity,
                    'points_earned' => $badge->points_value,
                ],
            ];
        });
        
        return response()->json([
            'success' => true,
            'data' => $activities->sortByDesc('timestamp')->values()->all(),
        ]);
    }

    /**
     * Get dashboard summary.
     */
    public function getDashboard(Request $request): JsonResponse
    {
        $beneficiary = $this->getBeneficiary($request);
        
        if (!$beneficiary) {
            return response()->json(['error' => 'Beneficiary not found'], 404);
        }
        
        $stats = $this->gamificationService->getStatistics($beneficiary);
        $progress = $beneficiary->getOrCreateGamificationProgress();
        
        // Get recent achievements
        $recentBadges = $beneficiary->badges()
            ->orderBy('pivot_earned_at', 'desc')
            ->limit(3)
            ->get();
        
        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'recent_badges' => $recentBadges->map(function ($badge) {
                    return [
                        'name' => $badge->name,
                        'icon' => $badge->icon_name,
                        'color' => $badge->icon_color,
                        'earned_at' => $badge->pivot->earned_at,
                    ];
                }),
                'quick_stats' => [
                    'points_today' => 0, // Would need to track daily points
                    'streak_days' => $progress->streak_days,
                    'completion_rate' => $this->calculateCompletionRate($beneficiary),
                    'rank_in_company' => $this->calculateRank($beneficiary),
                ],
            ],
        ]);
    }

    /**
     * Get the authenticated beneficiary.
     */
    protected function getBeneficiary(Request $request): ?Beneficiary
    {
        $user = Auth::user();
        
        if (!$user) {
            return null;
        }
        
        // First try to find existing beneficiary
        $beneficiary = Beneficiary::where('user_id', $user->id)->first();
        
        if (!$beneficiary) {
            // If no beneficiary exists, create a default one for the user
            $beneficiary = Beneficiary::create([
                'user_id' => $user->id,
                'company_id' => 1, // Default company ID
                'cpf' => $user->cpf,
                'full_name' => $user->name,
                'onboarding_status' => 'in_progress',
                'onboarding_step' => 'health_questionnaire'
            ]);
        }
        
        return $beneficiary;
    }

    /**
     * Calculate completion rate for onboarding.
     */
    protected function calculateCompletionRate(Beneficiary $beneficiary): float
    {
        $totalSteps = 7; // Registration, Profile, Health, Documents, Interview, Review, Complete
        $completedSteps = 0;
        
        $progress = $beneficiary->getOrCreateGamificationProgress();
        
        if ($progress->profile_completed) $completedSteps++;
        if ($progress->health_assessments_completed > 0) $completedSteps++;
        if ($progress->documents_uploaded > 0) $completedSteps++;
        if ($beneficiary->interviews()->where('status', 'completed')->exists()) $completedSteps++;
        if ($progress->onboarding_completed) $completedSteps++;
        
        return round(($completedSteps / $totalSteps) * 100, 2);
    }

    /**
     * Calculate rank in company.
     */
    protected function calculateRank(Beneficiary $beneficiary): int
    {
        $progress = $beneficiary->getOrCreateGamificationProgress();
        
        $rank = DB::table('gamification_progress')
            ->join('beneficiaries', 'gamification_progress.beneficiary_id', '=', 'beneficiaries.id')
            ->where('beneficiaries.company_id', $beneficiary->company_id)
            ->where('gamification_progress.total_points', '>', $progress->total_points)
            ->count();
        
        return $rank + 1;
    }
}