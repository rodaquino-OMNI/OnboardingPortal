<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\OptimizedTextractService;
use App\Services\TesseractOCRService;
use App\Services\TextractCostOptimizationService;
use App\Services\DocumentPreprocessingService;
use App\Services\TextractMonitoringService;
use App\Services\CloudWatchService;
use App\Services\AlertingService;
use App\Services\OCRUsageTracker;
use Illuminate\Support\Facades\Cache;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register OCR services
        $this->app->singleton(TesseractOCRService::class, function ($app) {
            return new TesseractOCRService();
        });

        $this->app->singleton(OCRUsageTracker::class, function ($app) {
            return new OCRUsageTracker();
        });

        $this->app->singleton(CloudWatchService::class, function ($app) {
            return new CloudWatchService();
        });

        $this->app->singleton(AlertingService::class, function ($app) {
            return new AlertingService();
        });

        $this->app->singleton(TextractCostOptimizationService::class, function ($app) {
            return new TextractCostOptimizationService(
                Cache::getFacadeRoot(),
                $app->make(OCRUsageTracker::class)
            );
        });

        $this->app->singleton(DocumentPreprocessingService::class, function ($app) {
            return new DocumentPreprocessingService();
        });

        $this->app->singleton(TextractMonitoringService::class, function ($app) {
            return new TextractMonitoringService(
                $app->make(CloudWatchService::class),
                $app->make(AlertingService::class)
            );
        });

        $this->app->singleton(OptimizedTextractService::class, function ($app) {
            return new OptimizedTextractService(
                $app->make(TesseractOCRService::class),
                $app->make(TextractCostOptimizationService::class),
                $app->make(DocumentPreprocessingService::class),
                $app->make(TextractMonitoringService::class)
            );
        });

        // Register the unified AuthService
        $this->app->singleton(\App\Services\AuthService::class, function ($app) {
            return new \App\Services\AuthService();
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Set maximum execution time for OCR operations
        if (!app()->runningInConsole()) {
            set_time_limit(300); // 5 minutes
        }
    }
}