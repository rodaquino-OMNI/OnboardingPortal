<?php

namespace App\Services;

use App\Models\Beneficiary;
use App\Models\GamificationBadge;
use App\Models\GamificationLevel;
use App\Models\GamificationProgress;
use App\Events\UserAction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GamificationService
{
    /**
     * Point values for different actions
     */
    const POINTS = [
        'registration' => 100,
        'profile_field' => 10,
        'health_question' => 20,
        'document_required' => 50,
        'document_optional' => 100,
        'interview_scheduled' => 150,
        'interview_completed' => 200,
        'profile_completed' => 50,
        'onboarding_completed' => 200,
        'daily_login' => 5,
        'streak_bonus' => 10, // Per day of streak
    ];

    /**
     * Award points to a beneficiary for an action.
     */
    public function awardPoints(Beneficiary $beneficiary, string $action, array $metadata = []): int
    {
        $points = $this->calculatePoints($action, $metadata);
        
        if ($points <= 0) {
            return 0;
        }

        DB::transaction(function () use ($beneficiary, $points, $action, $metadata) {
            $progress = $beneficiary->getOrCreateGamificationProgress();
            $oldLevel = $progress->current_level;
            
            // Add points
            $progress->addPoints($points);
            
            // Update activity streak
            $progress->updateStreak();
            
            // Track specific action counts
            $this->updateActionCounts($progress, $action, $metadata);
            
            // Check for level up
            if ($newLevel = $progress->checkLevelUp()) {
                $progress->levelUp($newLevel);
                
                // Dispatch level up event
                event(new UserAction($beneficiary, 'level_up', [
                    'old_level' => $oldLevel,
                    'new_level' => $newLevel->level_number,
                    'level_name' => $newLevel->name,
                ]));
            }
            
            // Log the point award
            Log::info('Points awarded', [
                'beneficiary_id' => $beneficiary->id,
                'action' => $action,
                'points' => $points,
                'total_points' => $progress->total_points,
            ]);
        });

        return $points;
    }

    /**
     * Calculate points for an action.
     */
    protected function calculatePoints(string $action, array $metadata = []): int
    {
        $basePoints = self::POINTS[$action] ?? 0;
        
        // Apply modifiers based on metadata
        switch ($action) {
            case 'document_upload':
                // Determine if document is required or optional
                $isRequired = $metadata['is_required'] ?? true;
                $basePoints = $isRequired ? self::POINTS['document_required'] : self::POINTS['document_optional'];
                break;
                
            case 'interview':
                // Determine if scheduled or completed
                $isCompleted = $metadata['is_completed'] ?? false;
                $basePoints = $isCompleted ? self::POINTS['interview_completed'] : self::POINTS['interview_scheduled'];
                break;
                
            case 'streak_bonus':
                // Calculate streak bonus
                $streakDays = $metadata['streak_days'] ?? 0;
                $basePoints = min($streakDays * self::POINTS['streak_bonus'], 100); // Cap at 100
                break;
        }
        
        // Apply any multipliers
        $multiplier = $metadata['multiplier'] ?? 1.0;
        
        return (int) round($basePoints * $multiplier);
    }

    /**
     * Update specific action counts in progress.
     */
    protected function updateActionCounts(GamificationProgress $progress, string $action, array $metadata = []): void
    {
        switch ($action) {
            case 'document_upload':
                $progress->increment('documents_uploaded');
                break;
                
            case 'health_assessment':
                $progress->increment('health_assessments_completed');
                break;
                
            case 'profile_completed':
                $progress->profile_completed = true;
                break;
                
            case 'onboarding_completed':
                $progress->onboarding_completed = true;
                break;
                
            case 'perfect_form':
                $progress->increment('perfect_forms');
                break;
                
            case 'task_completed':
                $progress->increment('tasks_completed');
                break;
        }
        
        $progress->save();
    }

    /**
     * Check and award badges for a beneficiary.
     */
    public function checkAndAwardBadges(Beneficiary $beneficiary): array
    {
        $awardedBadges = [];
        $badges = GamificationBadge::where('is_active', true)->get();
        
        foreach ($badges as $badge) {
            if ($badge->checkCriteria($beneficiary)) {
                $this->awardBadge($beneficiary, $badge);
                $awardedBadges[] = $badge;
            }
        }
        
        return $awardedBadges;
    }

    /**
     * Award a specific badge to a beneficiary.
     */
    public function awardBadge(Beneficiary $beneficiary, GamificationBadge $badge): void
    {
        // Check if already has this badge (and max count)
        $existingCount = $beneficiary->badges()->where('gamification_badge_id', $badge->id)->count();
        if ($existingCount >= $badge->max_per_user) {
            return;
        }
        
        DB::transaction(function () use ($beneficiary, $badge) {
            // Award the badge
            $beneficiary->badges()->attach($badge->id, [
                'earned_at' => now(),
            ]);
            
            // Award badge points
            if ($badge->points_value > 0) {
                $this->awardPoints($beneficiary, 'badge_earned', [
                    'badge_id' => $badge->id,
                    'badge_slug' => $badge->slug,
                    'points' => $badge->points_value,
                ]);
            }
            
            // Update progress
            $progress = $beneficiary->getOrCreateGamificationProgress();
            $progress->last_badge_earned_at = now();
            
            // Update badges earned array
            $badgesEarned = $progress->badges_earned ?? [];
            $badgesEarned[] = [
                'badge_id' => $badge->id,
                'earned_at' => now()->toIso8601String(),
            ];
            $progress->badges_earned = $badgesEarned;
            $progress->save();
            
            // Dispatch badge earned event
            event(new UserAction($beneficiary, 'badge_earned', [
                'badge_id' => $badge->id,
                'badge_name' => $badge->name,
                'badge_slug' => $badge->slug,
                'badge_rarity' => $badge->rarity,
            ]));
            
            Log::info('Badge awarded', [
                'beneficiary_id' => $beneficiary->id,
                'badge_id' => $badge->id,
                'badge_slug' => $badge->slug,
            ]);
        });
    }

    /**
     * Get leaderboard for a company or globally.
     */
    public function getLeaderboard(?int $companyId = null, int $limit = 10): array
    {
        $query = GamificationProgress::with('beneficiary')
            ->orderBy('total_points', 'desc')
            ->orderBy('current_level', 'desc')
            ->orderBy('engagement_score', 'desc');
        
        if ($companyId) {
            $query->whereHas('beneficiary', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            });
        }
        
        return $query->limit($limit)->get()->map(function ($progress) {
            return [
                'beneficiary_id' => $progress->beneficiary_id,
                'name' => $progress->beneficiary->full_name,
                'avatar' => $progress->beneficiary->profile_picture,
                'total_points' => $progress->total_points,
                'current_level' => $progress->current_level,
                'level_name' => GamificationLevel::where('level_number', $progress->current_level)->value('name'),
                'badges_count' => count($progress->badges_earned ?? []),
                'engagement_score' => $progress->engagement_score,
            ];
        })->toArray();
    }

    /**
     * Get gamification statistics for a beneficiary.
     */
    public function getStatistics(Beneficiary $beneficiary): array
    {
        $progress = $beneficiary->getOrCreateGamificationProgress();
        $currentLevel = $beneficiary->getCurrentLevel();
        $nextLevel = $currentLevel ? $currentLevel->getNextLevel() : null;
        
        return [
            'total_points' => $progress->total_points,
            'current_level' => [
                'number' => $progress->current_level,
                'name' => $currentLevel->name ?? 'Unknown',
                'color' => $currentLevel->color_theme ?? '#3B82F6',
                'icon' => $currentLevel->icon ?? null,
            ],
            'next_level' => $nextLevel ? [
                'number' => $nextLevel->level_number,
                'name' => $nextLevel->name,
                'points_required' => $nextLevel->points_required,
                'points_remaining' => max(0, $nextLevel->points_required - $progress->total_points),
                'progress_percentage' => $currentLevel->calculateProgress($progress->total_points),
            ] : null,
            'streak_days' => $progress->streak_days,
            'badges_earned' => $beneficiary->badges()->count(),
            'tasks_completed' => $progress->tasks_completed,
            'engagement_score' => $progress->engagement_score,
            'last_activity' => $progress->last_activity_date?->toDateString(),
            'member_since' => $beneficiary->created_at->toDateString(),
        ];
    }

    /**
     * Check specific badge criteria for common badges.
     */
    public function checkSpecificBadges(Beneficiary $beneficiary, string $badgeSlug): void
    {
        $badge = GamificationBadge::where('slug', $badgeSlug)->first();
        
        if ($badge && $badge->checkCriteria($beneficiary)) {
            $this->awardBadge($beneficiary, $badge);
        }
    }
}