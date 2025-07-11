<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class GamificationBadge extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon_name',
        'icon_color',
        'category',
        'rarity',
        'points_value',
        'criteria',
        'is_active',
        'is_secret',
        'sort_order',
        'max_per_user',
        'available_from',
        'available_until',
    ];

    protected $casts = [
        'criteria' => 'array',
        'is_active' => 'boolean',
        'is_secret' => 'boolean',
        'available_from' => 'datetime',
        'available_until' => 'datetime',
    ];

    /**
     * Get the beneficiaries that have earned this badge.
     */
    public function beneficiaries(): BelongsToMany
    {
        return $this->belongsToMany(Beneficiary::class, 'beneficiary_badges')
            ->withPivot('earned_at', 'notified_at')
            ->withTimestamps();
    }

    /**
     * Check if the badge is currently available.
     */
    public function isAvailable(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $now = now();

        if ($this->available_from && $now->lt($this->available_from)) {
            return false;
        }

        if ($this->available_until && $now->gt($this->available_until)) {
            return false;
        }

        return true;
    }

    /**
     * Check if a beneficiary meets the criteria for this badge.
     */
    public function checkCriteria(Beneficiary $beneficiary): bool
    {
        if (!$this->isAvailable()) {
            return false;
        }

        // Check if already at max earned count
        $earnedCount = $beneficiary->badges()->where('gamification_badge_id', $this->id)->count();
        if ($earnedCount >= $this->max_per_user) {
            return false;
        }

        $criteria = $this->criteria ?? [];
        $progress = $beneficiary->getOrCreateGamificationProgress();

        // Check each criterion
        foreach ($criteria as $criterion) {
            if (!$this->checkSingleCriterion($criterion, $beneficiary, $progress)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check a single criterion.
     */
    protected function checkSingleCriterion(array $criterion, Beneficiary $beneficiary, GamificationProgress $progress): bool
    {
        $type = $criterion['type'] ?? '';
        $value = $criterion['value'] ?? 0;
        $operator = $criterion['operator'] ?? '>=';

        switch ($type) {
            case 'total_points':
                return $this->compareValues($progress->total_points, $operator, $value);
                
            case 'documents_uploaded':
                return $this->compareValues($progress->documents_uploaded, $operator, $value);
                
            case 'health_assessments_completed':
                return $this->compareValues($progress->health_assessments_completed, $operator, $value);
                
            case 'streak_days':
                return $this->compareValues($progress->streak_days, $operator, $value);
                
            case 'perfect_forms':
                return $this->compareValues($progress->perfect_forms, $operator, $value);
                
            case 'profile_completed':
                return $progress->profile_completed == $value;
                
            case 'onboarding_completed':
                return $progress->onboarding_completed == $value;
                
            case 'tasks_completed':
                return $this->compareValues($progress->tasks_completed, $operator, $value);
                
            case 'current_level':
                return $this->compareValues($progress->current_level, $operator, $value);
                
            case 'engagement_score':
                return $this->compareValues($progress->engagement_score, $operator, $value);
                
            case 'completion_time':
                // Check if onboarding was completed within X days
                if ($progress->onboarding_completed && $beneficiary->created_at) {
                    $daysTaken = $beneficiary->created_at->diffInDays($beneficiary->onboarding_completed_at);
                    return $this->compareValues($daysTaken, $operator, $value);
                }
                return false;
                
            case 'early_bird':
                // Check if activities were done in morning hours
                $morningActivities = $criterion['morning_activities'] ?? 3;
                // This would need to be tracked separately
                return false; // Placeholder
                
            default:
                return false;
        }
    }

    /**
     * Compare values based on operator.
     */
    protected function compareValues($actual, string $operator, $expected): bool
    {
        switch ($operator) {
            case '>':
                return $actual > $expected;
            case '>=':
                return $actual >= $expected;
            case '=':
            case '==':
                return $actual == $expected;
            case '<':
                return $actual < $expected;
            case '<=':
                return $actual <= $expected;
            case '!=':
                return $actual != $expected;
            default:
                return false;
        }
    }
}