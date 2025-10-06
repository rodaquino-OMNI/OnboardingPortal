<?php

namespace App\Modules\Gamification\Listeners;

use App\Modules\Gamification\Events\PointsEarnedEvent;
use App\Modules\Gamification\Events\LevelUpEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * UpdateDerivedStats - Listener for updating derived gamification statistics
 *
 * Updates denormalized/derived stats for performance optimization:
 * - Leaderboard rankings (cached, updated incrementally)
 * - Daily/weekly/monthly aggregates (for analytics dashboards)
 * - Achievement progress counters
 *
 * Idempotent: Uses idempotency key to prevent duplicate updates.
 *
 * Performance strategy:
 * - Incremental updates (not full recalculation)
 * - Cache invalidation with smart TTLs
 * - Async processing via queue (if available)
 *
 * @see docs/GAMIFICATION_SPEC.md - Leaderboard mechanics
 * @see App\Modules\Gamification\Events\PointsEarnedEvent
 */
class UpdateDerivedStats
{
    /**
     * Handle PointsEarnedEvent
     *
     * Updates:
     * - User's leaderboard rank (cached with TTL)
     * - Daily/weekly/monthly point aggregates
     * - Action-specific counters (for achievements)
     *
     * @param PointsEarnedEvent $event
     */
    public function handlePointsEarned(PointsEarnedEvent $event): void
    {
        // Idempotency check
        $cacheKey = "stats:updated:{$event->idempotencyKey}";

        if (Cache::has($cacheKey)) {
            Log::debug('Derived stats already updated (idempotent)', [
                'idempotency_key' => $event->idempotencyKey,
            ]);
            return;
        }

        // Update leaderboard rank (invalidate cache)
        $this->invalidateLeaderboardCache($event->userId);

        // Update aggregates
        $this->updatePointAggregates($event->userId, $event->delta, $event->action, $event->occurredAt);

        // Update action counters (for achievements)
        $this->incrementActionCounter($event->userId, $event->action);

        // Mark as processed
        Cache::put($cacheKey, true, now()->addDays(7));

        Log::info('Derived stats updated: points_earned', [
            'user_id' => $event->userId,
            'action' => $event->action,
            'points' => $event->delta,
        ]);
    }

    /**
     * Handle LevelUpEvent
     *
     * Updates:
     * - User's level in leaderboard (cache invalidation)
     * - Level-up timestamps (for achievement tracking)
     * - Milestone counters
     *
     * @param LevelUpEvent $event
     */
    public function handleLevelUp(LevelUpEvent $event): void
    {
        // Level up events are naturally idempotent (user_id + new_level is unique)
        $cacheKey = "stats:levelup:{$event->user->id}:{$event->newLevel}";

        if (Cache::has($cacheKey)) {
            Log::debug('Derived stats already updated (idempotent)', [
                'user_id' => $event->user->id,
                'new_level' => $event->newLevel,
            ]);
            return;
        }

        // Invalidate leaderboard cache (level affects display)
        $this->invalidateLeaderboardCache($event->user->id);

        // Record level-up timestamp (for "time to level X" metrics)
        $this->recordLevelUpTimestamp($event->user->id, $event->newLevel);

        // Update milestone counters
        $this->updateMilestoneCounters($event->user->id, $event->newLevel);

        // Mark as processed
        Cache::put($cacheKey, true, now()->addDays(30));

        Log::info('Derived stats updated: level_up', [
            'user_id' => $event->user->id,
            'old_level' => $event->oldLevel,
            'new_level' => $event->newLevel,
        ]);
    }

    /**
     * Invalidate leaderboard cache for user
     *
     * Invalidates both global leaderboard and user's rank cache.
     *
     * @param int $userId User ID
     */
    private function invalidateLeaderboardCache(int $userId): void
    {
        // Invalidate global leaderboard (will be rebuilt on next request)
        Cache::forget('leaderboard:global');
        Cache::forget('leaderboard:weekly');
        Cache::forget('leaderboard:monthly');

        // Invalidate user's rank cache
        Cache::forget("leaderboard:rank:{$userId}");

        Log::debug('Leaderboard cache invalidated', ['user_id' => $userId]);
    }

    /**
     * Update point aggregates for analytics
     *
     * Increments daily/weekly/monthly aggregate counters.
     *
     * @param int $userId User ID
     * @param int $delta Points earned
     * @param string $action Action identifier
     * @param \DateTimeImmutable $occurredAt Event timestamp
     */
    private function updatePointAggregates(int $userId, int $delta, string $action, \DateTimeImmutable $occurredAt): void
    {
        $date = $occurredAt->format('Y-m-d');
        $week = $occurredAt->format('Y-W');
        $month = $occurredAt->format('Y-m');

        // Daily aggregate
        DB::table('gamification_aggregates')->updateOrInsert(
            ['user_id' => $userId, 'period' => 'daily', 'period_key' => $date],
            [
                'points_earned' => DB::raw("points_earned + {$delta}"),
                'actions_count' => DB::raw('actions_count + 1'),
                'updated_at' => now(),
            ]
        );

        // Weekly aggregate
        DB::table('gamification_aggregates')->updateOrInsert(
            ['user_id' => $userId, 'period' => 'weekly', 'period_key' => $week],
            [
                'points_earned' => DB::raw("points_earned + {$delta}"),
                'actions_count' => DB::raw('actions_count + 1'),
                'updated_at' => now(),
            ]
        );

        // Monthly aggregate
        DB::table('gamification_aggregates')->updateOrInsert(
            ['user_id' => $userId, 'period' => 'monthly', 'period_key' => $month],
            [
                'points_earned' => DB::raw("points_earned + {$delta}"),
                'actions_count' => DB::raw('actions_count + 1'),
                'updated_at' => now(),
            ]
        );

        Log::debug('Point aggregates updated', [
            'user_id' => $userId,
            'period_key' => $date,
            'delta' => $delta,
        ]);
    }

    /**
     * Increment action counter for achievements
     *
     * Tracks action-specific counts (e.g., "documents_uploaded: 10")
     * Used for achievement unlock criteria.
     *
     * @param int $userId User ID
     * @param string $action Action identifier
     */
    private function incrementActionCounter(int $userId, string $action): void
    {
        DB::table('gamification_action_counters')->updateOrInsert(
            ['user_id' => $userId, 'action' => $action],
            [
                'count' => DB::raw('count + 1'),
                'last_increment_at' => now(),
            ]
        );

        Log::debug('Action counter incremented', [
            'user_id' => $userId,
            'action' => $action,
        ]);
    }

    /**
     * Record level-up timestamp
     *
     * Stores timestamp when user reached each level (for time-to-level metrics)
     *
     * @param int $userId User ID
     * @param int $level Level reached
     */
    private function recordLevelUpTimestamp(int $userId, int $level): void
    {
        DB::table('gamification_level_timestamps')->insert([
            'user_id' => $userId,
            'level' => $level,
            'reached_at' => now(),
        ]);

        Log::debug('Level-up timestamp recorded', [
            'user_id' => $userId,
            'level' => $level,
        ]);
    }

    /**
     * Update milestone counters
     *
     * Increments milestone-specific counters (for admin dashboards)
     *
     * @param int $userId User ID
     * @param int $level Level reached
     */
    private function updateMilestoneCounters(int $userId, int $level): void
    {
        // Increment global milestone counter (how many users reached this level)
        DB::table('gamification_milestones')->updateOrInsert(
            ['milestone_type' => 'level', 'milestone_value' => $level],
            [
                'user_count' => DB::raw('user_count + 1'),
                'updated_at' => now(),
            ]
        );

        Log::debug('Milestone counter updated', [
            'user_id' => $userId,
            'level' => $level,
        ]);
    }
}
