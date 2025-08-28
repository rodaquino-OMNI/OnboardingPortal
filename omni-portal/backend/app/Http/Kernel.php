<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    /**
     * The application's global HTTP middleware stack.
     *
     * These middleware are run during every request to your application.
     *
     * @var array<int, class-string|string>
     */
    protected $middleware = [
        \App\Http\Middleware\TrustProxies::class,
        \Illuminate\Http\Middleware\HandleCors::class, // Use Laravel's native CORS
        \Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance::class,
        \Illuminate\Foundation\Http\Middleware\ValidatePostSize::class,
        \App\Http\Middleware\TrimStrings::class,
        \Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class,
        \App\Http\Middleware\TracingMiddleware::class,
    ];

    /**
     * The application's route middleware groups.
     *
     * @var array<string, array<int, class-string|string>>
     */
    protected $middlewareGroups = [
        'web' => [
            \App\Http\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \App\Http\Middleware\UnifiedAuthMiddleware::class, // Unified authentication with CSRF
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],

        'api' => [
            // Optimized unified middleware stack for API requests
            \App\Http\Middleware\ApiPerformanceMiddleware::class, // Performance monitoring wrapper
            \App\Http\Middleware\ForceJsonResponse::class, // JSON response formatting (early)
            \App\Http\Middleware\UnifiedAuthMiddleware::class, // Unified auth/security/CSRF protection
            \Illuminate\Routing\Middleware\SubstituteBindings::class, // Route model binding
        ],

        'sanctum' => [
            // Authentication-enabled API middleware group (simplified)
            \App\Http\Middleware\ApiPerformanceMiddleware::class, // Performance monitoring
            \App\Http\Middleware\ForceJsonResponse::class, // JSON responses
            \App\Http\Middleware\UnifiedAuthMiddleware::class, // All-in-one auth/security middleware
            \Illuminate\Routing\Middleware\SubstituteBindings::class, // Route binding
        ],
    ];

    /**
     * The application's middleware aliases.
     *
     * Aliases may be used instead of class names to conveniently assign middleware to routes and groups.
     *
     * @var array<string, class-string|string>
     */
    protected $middlewareAliases = [
        // Standard Laravel middleware
        'auth' => \App\Http\Middleware\UnifiedAuthMiddleware::class, // Unified auth middleware
        'auth.basic' => \Illuminate\Auth\Middleware\AuthenticateWithBasicAuth::class,
        'auth.session' => \Illuminate\Session\Middleware\AuthenticateSession::class,
        'cache.headers' => \Illuminate\Http\Middleware\SetCacheHeaders::class,
        'can' => \Illuminate\Auth\Middleware\Authorize::class,
        'guest' => \App\Http\Middleware\RedirectIfAuthenticated::class,
        'password.confirm' => \Illuminate\Auth\Middleware\RequirePassword::class,
        'precognitive' => \Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests::class,
        'signed' => \App\Http\Middleware\ValidateSignature::class,
        'throttle' => \Illuminate\Routing\Middleware\ThrottleRequests::class,
        'verified' => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,

        // Sanctum middleware
        'abilities' => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
        'ability' => \Laravel\Sanctum\Http\Middleware\CheckForAnyAbility::class,

        // Application-specific middleware
        'api.performance' => \App\Http\Middleware\ApiPerformanceMiddleware::class,
        'admin.access' => \App\Http\Middleware\AdminAccess::class,

        // Deprecated aliases (for backward compatibility - will be removed in future)
        'auth.legacy' => \App\Http\Middleware\Authenticate::class,
        'api.throttle' => \App\Http\Middleware\ApiRateLimiter::class, // Now handled by UnifiedAuthMiddleware
        'api.security' => \App\Http\Middleware\ApiSecurityMiddleware::class, // Now handled by UnifiedAuthMiddleware
    ];
}