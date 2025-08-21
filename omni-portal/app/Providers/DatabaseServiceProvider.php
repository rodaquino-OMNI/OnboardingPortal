<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Services\DatabaseHealthService;

class DatabaseServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(DatabaseHealthService::class, function ($app) {
            return new DatabaseHealthService();
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Configure database event listeners for monitoring
        $this->configureQueryListeners();
        
        // Configure connection event listeners
        $this->configureConnectionListeners();
        
        // Register custom database connection resolvers
        $this->registerConnectionResolvers();
    }

    /**
     * Configure database query event listeners
     */
    protected function configureQueryListeners(): void
    {
        if (config('app.debug')) {
            DB::listen(function ($query) {
                Log::debug('Database Query Executed', [
                    'connection' => $query->connectionName,
                    'query' => $query->sql,
                    'bindings' => $query->bindings,
                    'time' => $query->time
                ]);
            });
        }

        // Log slow queries
        DB::listen(function ($query) {
            if ($query->time > 1000) { // Log queries taking more than 1 second
                Log::warning('Slow Database Query Detected', [
                    'connection' => $query->connectionName,
                    'query' => $query->sql,
                    'bindings' => $query->bindings,
                    'time' => $query->time
                ]);
            }
        });
    }

    /**
     * Configure database connection event listeners
     */
    protected function configureConnectionListeners(): void
    {
        // Listen for connection failures
        DB::getEventDispatcher()->listen('connection.before', function ($event) {
            Log::info("Attempting database connection", [
                'connection' => $event->connectionName
            ]);
        });

        // Handle connection failures gracefully
        $this->app['events']->listen('database.connection.failed', function ($event) {
            Log::error("Database connection failed", [
                'connection' => $event->connectionName,
                'exception' => $event->exception->getMessage()
            ]);
            
            // Attempt to use fallback connection if available
            $this->handleConnectionFailure($event->connectionName);
        });
    }

    /**
     * Register custom database connection resolvers
     */
    protected function registerConnectionResolvers(): void
    {
        // Register intelligent read connection resolver
        DB::resolverFor('mysql-ha-read', function ($connection, $database, $prefix, $config) {
            return $this->createIntelligentReadConnection($config);
        });
    }

    /**
     * Handle database connection failures
     */
    protected function handleConnectionFailure(string $connectionName): void
    {
        // If a slave connection fails, remove it from rotation temporarily
        if (str_contains($connectionName, 'slave')) {
            $this->markConnectionAsDown($connectionName);
            
            // Schedule a retry in 30 seconds
            $this->scheduleConnectionRetry($connectionName, 30);
        }
        
        // If master fails, this is critical - alert immediately
        if (str_contains($connectionName, 'master')) {
            Log::critical("Master database connection failed", [
                'connection' => $connectionName,
                'timestamp' => now()
            ]);
            
            // Trigger alerts or notifications here
            $this->alertMasterFailure($connectionName);
        }
    }

    /**
     * Create an intelligent read connection that selects the best slave
     */
    protected function createIntelligentReadConnection(array $config): \Illuminate\Database\Connection
    {
        $healthService = app(DatabaseHealthService::class);
        $bestConnection = $healthService->getBestReadConnection();
        
        // Get the configuration for the best connection
        $bestConfig = config("database.connections.{$bestConnection}");
        
        return DB::connection($bestConnection);
    }

    /**
     * Mark a connection as down temporarily
     */
    protected function markConnectionAsDown(string $connectionName): void
    {
        cache()->put("db_connection_down_{$connectionName}", true, now()->addMinutes(5));
        
        Log::warning("Marked database connection as down", [
            'connection' => $connectionName,
            'duration' => '5 minutes'
        ]);
    }

    /**
     * Schedule a connection retry
     */
    protected function scheduleConnectionRetry(string $connectionName, int $delaySeconds): void
    {
        // In a real application, you would use a queue job for this
        // For now, we'll just log the intention
        Log::info("Scheduled connection retry", [
            'connection' => $connectionName,
            'delay_seconds' => $delaySeconds
        ]);
    }

    /**
     * Alert about master database failure
     */
    protected function alertMasterFailure(string $connectionName): void
    {
        // Implement your alerting mechanism here
        // This could be email, Slack, PagerDuty, etc.
        
        Log::emergency("CRITICAL: Master database connection failed", [
            'connection' => $connectionName,
            'timestamp' => now(),
            'action_required' => 'Immediate investigation required'
        ]);
        
        // You could also trigger notifications:
        // Notification::route('slack', config('services.slack.webhook'))
        //     ->notify(new DatabaseFailureNotification($connectionName));
    }
}