<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Routing\Router;
use App\Http\Middleware\FeatureFlagMiddleware;

/**
 * AppServiceProvider - Core application service provider
 *
 * Responsibilities:
 * - Register middleware aliases for route usage
 * - Bootstrap application-level services
 * - Configure service bindings
 *
 * Middleware Aliases:
 * - 'feature.flag' => FeatureFlagMiddleware (for feature toggles)
 *
 * @see app/Http/Middleware/FeatureFlagMiddleware.php
 * @see routes/api.php (uses 'feature.flag:sliceC_health')
 */
class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(Router $router): void
    {
        // Register middleware aliases for route usage
        // Laravel 11: Uses Router::aliasMiddleware instead of Http\Kernel
        $router->aliasMiddleware('feature.flag', FeatureFlagMiddleware::class);
    }
}
