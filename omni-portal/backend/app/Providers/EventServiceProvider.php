<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use App\Modules\Gamification\Events\PointsEarnedEvent;
use App\Modules\Gamification\Events\LevelUpEvent;
use App\Modules\Gamification\Listeners\EmitAnalyticsEvents;
use App\Modules\Gamification\Listeners\UpdateDerivedStats;
use App\Modules\Health\Events\HealthQuestionnaireSubmitted;
use App\Modules\Health\Listeners\PersistHealthAnalytics;

/**
 * EventServiceProvider - Wires domain events to listeners
 *
 * Event-driven architecture for gamification system:
 * - PointsEarnedEvent → EmitAnalyticsEvents, UpdateDerivedStats
 * - LevelUpEvent → EmitAnalyticsEvents, UpdateDerivedStats
 *
 * All listeners are idempotent and can handle event replay.
 *
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-003: State Management
 */
class EventServiceProvider extends ServiceProvider
{
    /**
     * The event listener mappings for the application.
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        // Gamification events
        PointsEarnedEvent::class => [
            EmitAnalyticsEvents::class . '@handlePointsEarned',
            UpdateDerivedStats::class . '@handlePointsEarned',
        ],

        LevelUpEvent::class => [
            EmitAnalyticsEvents::class . '@handleLevelUp',
            UpdateDerivedStats::class . '@handleLevelUp',
        ],

        // Health questionnaire events
        HealthQuestionnaireSubmitted::class => [
            PersistHealthAnalytics::class,
        ],
    ];

    /**
     * Register any events for your application.
     */
    public function boot(): void
    {
        //
    }

    /**
     * Determine if events and listeners should be automatically discovered.
     */
    public function shouldDiscoverEvents(): bool
    {
        return false; // Explicit mapping for clarity
    }
}
