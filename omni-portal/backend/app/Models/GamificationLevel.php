<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GamificationLevel extends Model
{
    use HasFactory;

    protected $fillable = [
        'level_number',
        'name',
        'title',
        'points_required',
        'points_to_next',
        'color_theme',
        'icon',
        'rewards',
        'unlocked_features',
        'description',
        'discount_percentage',
        'priority_support_level',
    ];

    protected $casts = [
        'rewards' => 'array',
        'unlocked_features' => 'array',
        'discount_percentage' => 'decimal:2',
    ];

    /**
     * Get the next level.
     */
    public function getNextLevel(): ?self
    {
        return self::where('level_number', $this->level_number + 1)->first();
    }

    /**
     * Get the previous level.
     */
    public function getPreviousLevel(): ?self
    {
        return self::where('level_number', $this->level_number - 1)->first();
    }

    /**
     * Calculate progress percentage to next level.
     */
    public function calculateProgress(int $currentPoints): float
    {
        if ($this->points_to_next === null || $this->points_to_next === 0) {
            return 100.0; // Max level reached
        }

        $pointsInCurrentLevel = $currentPoints - $this->points_required;
        $pointsNeededForNext = $this->points_to_next;

        if ($pointsNeededForNext <= 0) {
            return 100.0;
        }

        $progress = ($pointsInCurrentLevel / $pointsNeededForNext) * 100;
        return min(100.0, max(0.0, $progress));
    }
}