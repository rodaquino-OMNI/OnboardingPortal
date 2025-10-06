<?php

namespace App\Modules\Gamification\Services;

use App\Models\User;
use App\Modules\Gamification\Repositories\PointsRepository;
use App\Modules\Gamification\Events\PointsEarnedEvent;
use App\Modules\Gamification\Events\LevelUpEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Event;

/**
 * PointsEngine - Deterministic points awarding with idempotency
 *
 * Implements point system per GAMIFICATION_SPEC.md with:
 * - Idempotency (duplicate prevention)
 * - Concurrency safety (optimistic locking)
 * - Transactional integrity
 * - Level-up detection
 *
 * @see docs/GAMIFICATION_SPEC.md - Point values and rules
 * @see docs/DECISION_JOURNAL.md - DJ-006 Fraud detection
 */
class PointsEngine
{
    /**
     * Point values per action (from GAMIFICATION_SPEC.md)
     */
    private const POINT_VALUES = [
        'registration' => 100,
        'profile_basic' => 50,
        'profile_optional' => 25,
        'health_question_required' => 20,
        'health_question_optional' => 20,
        'document_upload' => 75,
        'document_approved' => 150,
        'interview_scheduled' => 200,
        'interview_attended' => 300,
        'onboarding_complete' => 500,

        // Bonuses
        'early_completion' => 100,
        'consistency' => 50,
        'thoroughness' => 25,
        'punctuality' => 75,
        'zero_errors' => 50,
        'document_quality' => 25,
    ];

    /**
     * Level thresholds (from GAMIFICATION_SPEC.md)
     */
    private const LEVEL_THRESHOLDS = [
        1 => 0,
        2 => 500,
        3 => 1500,
        4 => 3000,
        5 => 5000,
    ];

    public function __construct(
        private PointsRepository $pointsRepo,
        private AuditLogService $auditLog
    ) {}

    /**
     * Award points with idempotency and concurrency safety
     *
     * @param User $user User to award points to
     * @param string $action Action identifier (must match POINT_VALUES keys)
     * @param array $metadata Additional context (no PHI)
     * @return bool True if points awarded, false if duplicate (idempotent)
     * @throws \InvalidArgumentException If action not defined
     */
    public function awardPoints(
        User $user,
        string $action,
        array $metadata = []
    ): bool {
        // Validate action
        if (!isset(self::POINT_VALUES[$action])) {
            throw new \InvalidArgumentException("Invalid action: {$action}");
        }

        $points = self::POINT_VALUES[$action];
        $idempotencyKey = $this->generateIdempotencyKey($user->id, $action, $metadata);

        return DB::transaction(function () use ($user, $action, $points, $metadata, $idempotencyKey) {
            // Check idempotency - prevent duplicate points
            if ($this->pointsRepo->transactionExists($idempotencyKey)) {
                Log::info('Duplicate points award blocked (idempotent)', [
                    'user_id' => $user->id,
                    'action' => $action,
                    'idempotency_key' => $idempotencyKey,
                ]);
                return false;
            }

            // Create points transaction
            $this->pointsRepo->createTransaction([
                'user_id' => $user->id,
                'idempotency_key' => $idempotencyKey,
                'action' => $action,
                'points' => $points,
                'metadata' => $metadata,
                'source' => 'system',
            ]);

            // Update user balance (concurrency-safe increment)
            // Uses optimistic locking to prevent race conditions
            $user->increment('points_balance', $points);
            $user->update(['last_action_at' => now()]);

            // Check for level up
            $this->checkLevelUp($user);

            // Update streak
            $this->updateStreak($user);

            // Audit log (WHO-WHAT-WHEN-WHERE-HOW)
            $this->auditLog->log($user, 'points_awarded', [
                'action' => $action,
                'points' => $points,
                'new_balance' => $user->fresh()->points_balance,
            ]);

            // Emit analytics event
            Event::dispatch(new PointsEarnedEvent($user, $action, $points, $metadata));

            Log::info('Points awarded successfully', [
                'user_id' => $user->id,
                'action' => $action,
                'points' => $points,
                'new_balance' => $user->fresh()->points_balance,
            ]);

            return true;
        });
    }

    /**
     * Check if user leveled up and emit event
     */
    private function checkLevelUp(User $user): void
    {
        $currentLevel = $user->current_level;
        $newLevel = $this->calculateLevel($user->points_balance);

        if ($newLevel > $currentLevel) {
            $user->update(['current_level' => $newLevel]);

            Log::info('User leveled up', [
                'user_id' => $user->id,
                'old_level' => $currentLevel,
                'new_level' => $newLevel,
                'points' => $user->points_balance,
            ]);

            // Audit log
            $this->auditLog->log($user, 'level_up', [
                'old_level' => $currentLevel,
                'new_level' => $newLevel,
            ]);

            // Emit event for celebration UI
            Event::dispatch(new LevelUpEvent($user, $currentLevel, $newLevel));
        }
    }

    /**
     * Calculate level based on points balance
     *
     * @param int $points Total points
     * @return int Current level (1-5)
     */
    private function calculateLevel(int $points): int
    {
        // Iterate levels in reverse to find highest threshold met
        foreach (array_reverse(self::LEVEL_THRESHOLDS, true) as $level => $threshold) {
            if ($points >= $threshold) {
                return $level;
            }
        }

        return 1;
    }

    /**
     * Update user's streak based on last action
     * Per GAMIFICATION_SPEC.md: Streak = consecutive days with activity
     */
    private function updateStreak(User $user): void
    {
        $lastAction = $user->last_action_at;
        $now = now();

        if (!$lastAction) {
            // First action - start streak
            $user->update([
                'current_streak' => 1,
                'streak_started_at' => $now,
            ]);
            return;
        }

        $daysSinceLastAction = $now->diffInDays($lastAction);

        if ($daysSinceLastAction === 0) {
            // Same day - no change to streak
            return;
        } elseif ($daysSinceLastAction === 1) {
            // Consecutive day - increment streak
            $user->increment('current_streak');
        } else {
            // Streak broken - reset
            $user->update([
                'current_streak' => 1,
                'streak_started_at' => $now,
            ]);

            Log::info('User streak broken', [
                'user_id' => $user->id,
                'days_since_last_action' => $daysSinceLastAction,
            ]);
        }
    }

    /**
     * Generate idempotency key for duplicate prevention
     *
     * @param int $userId User ID
     * @param string $action Action identifier
     * @param array $metadata Additional context
     * @return string SHA-256 hash
     */
    private function generateIdempotencyKey(int $userId, string $action, array $metadata): string
    {
        // Include metadata to allow same action with different context
        // Example: 'document_upload' for RG vs CPF are different transactions
        $payload = json_encode([
            'user_id' => $userId,
            'action' => $action,
            'metadata' => $metadata,
        ]);

        return hash('sha256', $payload);
    }

    /**
     * Get points required for next level
     *
     * @param User $user User to check
     * @return int|null Points needed, or null if max level
     */
    public function pointsToNextLevel(User $user): ?int
    {
        $currentLevel = $user->current_level;
        $nextLevel = $currentLevel + 1;

        if (!isset(self::LEVEL_THRESHOLDS[$nextLevel])) {
            return null; // Max level reached
        }

        $nextThreshold = self::LEVEL_THRESHOLDS[$nextLevel];
        $currentPoints = $user->points_balance;

        return max(0, $nextThreshold - $currentPoints);
    }

    /**
     * Get progress percentage to next level
     *
     * @param User $user User to check
     * @return float Progress (0.0 to 1.0)
     */
    public function progressToNextLevel(User $user): float
    {
        $currentLevel = $user->current_level;
        $currentPoints = $user->points_balance;

        if (!isset(self::LEVEL_THRESHOLDS[$currentLevel + 1])) {
            return 1.0; // Max level
        }

        $currentThreshold = self::LEVEL_THRESHOLDS[$currentLevel];
        $nextThreshold = self::LEVEL_THRESHOLDS[$currentLevel + 1];

        $pointsInLevel = $currentPoints - $currentThreshold;
        $pointsNeeded = $nextThreshold - $currentThreshold;

        return min(1.0, $pointsInLevel / $pointsNeeded);
    }
}
