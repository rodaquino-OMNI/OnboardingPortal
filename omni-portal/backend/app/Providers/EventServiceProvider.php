<?php

namespace App\Providers;

use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Listeners\SendEmailVerificationNotification;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Event;
use App\Events\UserAction;
use App\Events\DocumentProcessed;
use App\Listeners\AwardPoints;
use App\Listeners\CheckBadges;
use App\Listeners\CheckLevelUp;
use App\Listeners\ProcessDocumentGamification;

class EventServiceProvider extends ServiceProvider
{
    /**
     * The event to listener mappings for the application.
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        Registered::class => [
            SendEmailVerificationNotification::class,
        ],
        UserAction::class => [
            AwardPoints::class,
            CheckBadges::class,
            CheckLevelUp::class,
        ],
        DocumentProcessed::class => [
            ProcessDocumentGamification::class,
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
        return false;
    }
}