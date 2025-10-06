<?php

namespace App\Modules\Gamification\Listeners;

use App\Modules\Gamification\Events\PointsEarnedEvent;
use App\Modules\Gamification\Events\LevelUpEvent;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * EmitAnalyticsEvents - Listener for gamification analytics
 *
 * Emits analytics events to tracking service (Amplitude, Mixpanel, etc.)
 * Idempotent: Uses idempotency key to prevent duplicate emissions.
 *
 * If queue available: Async emission via job
 * If no queue: Store in outbox table for batch delivery
 *
 * @see docs/ANALYTICS_SPEC.md - Event contracts
 * @see App\Modules\Gamification\Events\PointsEarnedEvent
 */
class EmitAnalyticsEvents
{
    /**
     * Handle PointsEarnedEvent
     *
     * @param PointsEarnedEvent $event
     */
    public function handlePointsEarned(PointsEarnedEvent $event): void
    {
        // Idempotency check: Have we already emitted this event?
        $cacheKey = "analytics:emitted:{$event->idempotencyKey}";

        if (Cache::has($cacheKey)) {
            Log::debug('Analytics event already emitted (idempotent)', [
                'idempotency_key' => $event->idempotencyKey,
            ]);
            return;
        }

        // Emit to analytics service
        $this->emitToAnalytics($event->toAnalyticsPayload());

        // Mark as emitted (TTL: 7 days)
        Cache::put($cacheKey, true, now()->addDays(7));

        Log::info('Analytics event emitted: points_earned', [
            'user_id' => $event->userId,
            'action' => $event->action,
            'points' => $event->delta,
        ]);
    }

    /**
     * Handle LevelUpEvent
     *
     * @param LevelUpEvent $event
     */
    public function handleLevelUp(LevelUpEvent $event): void
    {
        // Level up events are naturally idempotent (user_id + new_level is unique)
        $cacheKey = "analytics:levelup:{$event->user->id}:{$event->newLevel}";

        if (Cache::has($cacheKey)) {
            Log::debug('Analytics event already emitted (idempotent)', [
                'user_id' => $event->user->id,
                'new_level' => $event->newLevel,
            ]);
            return;
        }

        // Emit to analytics service
        $this->emitToAnalytics($event->toAnalyticsPayload());

        // Mark as emitted (TTL: 30 days)
        Cache::put($cacheKey, true, now()->addDays(30));

        Log::info('Analytics event emitted: level_up', [
            'user_id' => $event->user->id,
            'old_level' => $event->oldLevel,
            'new_level' => $event->newLevel,
        ]);
    }

    /**
     * Emit event to analytics service
     *
     * @param array $payload Event data (no PHI)
     */
    private function emitToAnalytics(array $payload): void
    {
        // TODO: Integrate with actual analytics service (Amplitude, Mixpanel, etc.)
        // For now, log to file for verification

        if (config('feature_flags.analytics_enabled', true)) {
            // Example: Analytics::track($payload['user_id'], $payload['event'], $payload);

            // Fallback: Log to file
            Log::channel('analytics')->info('Analytics event', $payload);
        }

        // If no queue available, could store in outbox table:
        // DB::table('analytics_outbox')->insert([
        //     'event' => $payload['event'],
        //     'payload' => json_encode($payload),
        //     'created_at' => now(),
        // ]);
    }
}
