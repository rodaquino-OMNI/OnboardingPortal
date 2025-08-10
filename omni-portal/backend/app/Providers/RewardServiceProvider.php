<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\RewardDeliveryService;
use App\Services\ReportGenerationService;

class RewardServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Register RewardDeliveryService as singleton
        $this->app->singleton(RewardDeliveryService::class, function ($app) {
            return new RewardDeliveryService();
        });

        // Register ReportGenerationService as singleton
        $this->app->singleton(ReportGenerationService::class, function ($app) {
            return new ReportGenerationService();
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Schedule reward delivery queue processing
        if ($this->app->runningInConsole()) {
            $this->commands([
                \App\Console\Commands\ProcessRewardDeliveryQueue::class,
            ]);
        }
    }
}