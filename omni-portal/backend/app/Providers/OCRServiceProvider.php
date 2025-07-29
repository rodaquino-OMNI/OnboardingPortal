<?php

namespace App\Providers;

use App\Services\DocumentPreprocessingService;
use App\Services\EnhancedOCRService;
use App\Services\OCRUsageTracker;
use App\Services\OptimizedTextractService;
use App\Services\TesseractOCRService;
use App\Services\TextractCostOptimizationService;
use App\Services\TextractMonitoringService;
use App\Services\CloudWatchService;
use App\Services\AlertingService;
use Illuminate\Support\ServiceProvider;

class OCRServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Register base services
        $this->app->singleton(TesseractOCRService::class, function ($app) {
            return new TesseractOCRService();
        });

        $this->app->singleton(OCRUsageTracker::class, function ($app) {
            return new OCRUsageTracker();
        });

        $this->app->singleton(DocumentPreprocessingService::class, function ($app) {
            return new DocumentPreprocessingService();
        });

        // Register placeholder services
        $this->app->singleton(CloudWatchService::class, function ($app) {
            return new CloudWatchService();
        });

        $this->app->singleton(AlertingService::class, function ($app) {
            return new AlertingService();
        });

        // Register cost optimization service
        $this->app->singleton(TextractCostOptimizationService::class, function ($app) {
            return new TextractCostOptimizationService(
                $app->make('cache')->store(),
                $app->make(OCRUsageTracker::class)
            );
        });

        // Register monitoring service
        $this->app->singleton(TextractMonitoringService::class, function ($app) {
            return new TextractMonitoringService(
                $app->make(CloudWatchService::class),
                $app->make(AlertingService::class)
            );
        });

        // Register Enhanced OCR Service
        $this->app->singleton(EnhancedOCRService::class, function ($app) {
            return new EnhancedOCRService(
                $app->make(TesseractOCRService::class)
            );
        });

        // Register Optimized Textract Service
        $this->app->singleton(OptimizedTextractService::class, function ($app) {
            return new OptimizedTextractService(
                $app->make(TesseractOCRService::class),
                $app->make(TextractCostOptimizationService::class),
                $app->make(DocumentPreprocessingService::class),
                $app->make(TextractMonitoringService::class)
            );
        });

        // Set the default OCR service based on configuration
        $this->app->bind('ocr', function ($app) {
            $driver = config('ocr.default', 'enhanced');
            
            return match ($driver) {
                'optimized' => $app->make(OptimizedTextractService::class),
                'enhanced' => $app->make(EnhancedOCRService::class),
                'tesseract' => $app->make(TesseractOCRService::class),
                default => $app->make(EnhancedOCRService::class),
            };
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Publish configuration
        $this->publishes([
            __DIR__.'/../../config/ocr.php' => config_path('ocr.php'),
        ], 'ocr-config');
    }
}