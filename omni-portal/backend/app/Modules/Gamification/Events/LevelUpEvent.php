<?php

namespace App\Modules\Gamification\Events;

use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * LevelUpEvent - Emitted when user reaches new level
 *
 * Dispatched by PointsEngine when user crosses level threshold.
 * Triggers celebration UI, achievements, and analytics tracking.
 *
 * Level thresholds (per GAMIFICATION_SPEC.md):
 * - Level 1: 0 points
 * - Level 2: 500 points
 * - Level 3: 1,500 points
 * - Level 4: 3,000 points
 * - Level 5: 5,000 points
 *
 * @see App\Modules\Gamification\Services\PointsEngine::checkLevelUp()
 * @see docs/GAMIFICATION_SPEC.md - Level progression
 */
final class LevelUpEvent
{
    use Dispatchable, SerializesModels;

    /**
     * Create a new level up event
     *
     * @param User $user User who leveled up
     * @param int $oldLevel Previous level
     * @param int $newLevel New level (oldLevel + 1 or more if multiple thresholds crossed)
     */
    public function __construct(
        public readonly User $user,
        public readonly int $oldLevel,
        public readonly int $newLevel
    ) {}

    /**
     * Get event payload for analytics
     *
     * @return array Analytics-ready payload
     */
    public function toAnalyticsPayload(): array
    {
        return [
            'event' => 'level_up',
            'user_id' => $this->user->id,
            'old_level' => $this->oldLevel,
            'new_level' => $this->newLevel,
            'current_points' => $this->user->points_balance,
            'occurred_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Get celebration message for UI
     *
     * @return string Localized celebration message
     */
    public function getCelebrationMessage(): string
    {
        return match($this->newLevel) {
            2 => '🎉 Parabéns! Você alcançou o Nível 2!',
            3 => '🌟 Incrível! Nível 3 desbloqueado!',
            4 => '🏆 Excelente! Você é Nível 4!',
            5 => '👑 Máximo! Você é Nível 5 - Mestre!',
            default => "🎊 Parabéns! Nível {$this->newLevel} alcançado!",
        };
    }

    /**
     * Check if this is a major milestone (multiple levels)
     *
     * @return bool True if skipped levels (e.g., 1 → 3)
     */
    public function isMajorMilestone(): bool
    {
        return ($this->newLevel - $this->oldLevel) > 1;
    }
}
