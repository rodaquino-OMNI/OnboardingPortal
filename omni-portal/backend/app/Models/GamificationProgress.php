<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GamificationProgress extends Model
{
    use HasFactory;

    protected $table = 'gamification_progress';

    protected $fillable = [
        'beneficiary_id',
        'total_points',
        'current_level',
        'points_to_next_level',
        'streak_days',
        'last_activity_date',
        'tasks_completed',
        'perfect_forms',
        'documents_uploaded',
        'health_assessments_completed',
        'profile_completed',
        'onboarding_completed',
        'badges_earned',
        'achievements',
        'daily_challenges',
        'weekly_goals',
        'engagement_score',
        'last_badge_earned_at',
        'last_level_up_at',
    ];

    protected $casts = [
        'last_activity_date' => 'date',
        'profile_completed' => 'boolean',
        'onboarding_completed' => 'boolean',
        'badges_earned' => 'array',
        'achievements' => 'array',
        'daily_challenges' => 'array',
        'weekly_goals' => 'array',
        'engagement_score' => 'decimal:2',
        'last_badge_earned_at' => 'datetime',
        'last_level_up_at' => 'datetime',
    ];

    /**
     * Get the beneficiary that owns the gamification progress.
     */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    /**
     * Add points to the beneficiary's total.
     */
    public function addPoints(int $points, string $action = 'general'): void
    {
        $this->increment('total_points', $points);
        $this->last_activity_date = now()->toDateString();
        
        // Track the action
        $achievements = $this->achievements ?? [];
        $achievements[] = [
            'action' => $action,
            'points' => $points,
            'date' => now()->toDateString(),
        ];
        $this->achievements = $achievements;
        $this->save();
        
        // Check for level up
        $nextLevel = $this->checkLevelUp();
        if ($nextLevel) {
            $this->levelUp($nextLevel);
        }
    }

    /**
     * Update the engagement score based on recent activity.
     */
    public function updateEngagementScore(): void
    {
        $daysSinceLastActivity = $this->last_activity_date 
            ? now()->diffInDays($this->last_activity_date) 
            : 999;

        // Calculate engagement score (0-100)
        $baseScore = min(100, $this->tasks_completed * 2);
        $streakBonus = min(20, $this->streak_days * 2);
        $activityPenalty = max(0, 30 - ($daysSinceLastActivity * 5));
        
        $this->engagement_score = min(100, max(0, $baseScore + $streakBonus + $activityPenalty));
        $this->save();
    }

    /**
     * Update activity streak.
     */
    public function updateStreak(): void
    {
        $today = now()->startOfDay();
        $lastActivity = $this->last_activity_date ? $this->last_activity_date->startOfDay() : null;

        if (!$lastActivity || $lastActivity->lt($today->subDays(1))) {
            // Reset streak if more than 1 day has passed
            $this->streak_days = 1;
        } elseif ($lastActivity->eq($today->subDays(1))) {
            // Increment streak if activity was yesterday
            $this->increment('streak_days');
        }
        // If activity is today, don't change streak

        $this->last_activity_date = $today;
        $this->save();
    }

    /**
     * Check if ready for level up.
     */
    public function checkLevelUp(): ?GamificationLevel
    {
        $nextLevel = GamificationLevel::where('level_number', $this->current_level + 1)->first();
        
        if ($nextLevel && $this->total_points >= $nextLevel->points_required) {
            return $nextLevel;
        }

        return null;
    }

    /**
     * Level up the beneficiary.
     */
    public function levelUp(GamificationLevel $newLevel): void
    {
        $this->current_level = $newLevel->level_number;
        $this->last_level_up_at = now();
        $this->save();
    }
}