<?php

namespace App\Providers;

use App\Services\DatabaseQueryValidator;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/**
 * Database Query Validator Service Provider
 *
 * Registers the DatabaseQueryValidator service and sets up query event listeners
 * for runtime validation in production environments.
 *
 * @package App\Providers
 */
class DatabaseQueryValidatorServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     *
     * @return void
     */
    public function register(): void
    {
        // Register the validator as a singleton
        $this->app->singleton(DatabaseQueryValidator::class, function ($app) {
            return new DatabaseQueryValidator();
        });

        // Create an alias for easier access
        $this->app->alias(DatabaseQueryValidator::class, 'db.query.validator');
    }

    /**
     * Bootstrap services.
     *
     * @return void
     */
    public function boot(): void
    {
        // Only attach query listeners if validator is enabled
        $validator = $this->app->make(DatabaseQueryValidator::class);

        if ($validator->isEnabled()) {
            $this->attachQueryListeners($validator);
        }
    }

    /**
     * Attach database query event listeners
     *
     * @param DatabaseQueryValidator $validator
     * @return void
     */
    protected function attachQueryListeners(DatabaseQueryValidator $validator): void
    {
        // Listen for queries before they're executed
        DB::listen(function ($query) use ($validator) {
            try {
                $validator->validateQuery($query->sql, $query->bindings);
            } catch (\RuntimeException $e) {
                // Re-throw to prevent query execution
                throw $e;
            }
        });
    }

    /**
     * Get the services provided by the provider.
     *
     * @return array<int, string>
     */
    public function provides(): array
    {
        return [
            DatabaseQueryValidator::class,
            'db.query.validator',
        ];
    }
}
