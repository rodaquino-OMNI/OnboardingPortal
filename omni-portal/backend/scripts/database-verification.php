<?php
/**
 * Comprehensive Database Configuration Verification Script
 * 
 * This script verifies that all Laravel components are properly configured to use MySQL
 * instead of SQLite, including queue workers, scheduler, and cache systems.
 */

require __DIR__ . '/../vendor/autoload.php';

use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;

class DatabaseConfigVerifier
{
    private array $results = [];
    private Application $app;

    public function __construct()
    {
        $this->app = require __DIR__ . '/../bootstrap/app.php';
        $this->app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    }

    public function run(): array
    {
        echo "🔍 Starting Comprehensive Database Configuration Verification\n";
        echo "═══════════════════════════════════════════════════════════\n\n";

        $this->verifyEnvironmentVariables();
        $this->verifyDatabaseConfiguration();
        $this->verifyQueueConfiguration();
        $this->verifyCacheConfiguration();
        $this->verifyRedisConfiguration();
        $this->verifyDatabaseConnection();
        $this->verifyMigrationTables();
        $this->verifyQueueTables();
        $this->verifyWorkerProcesses();
        $this->generateSummaryReport();

        return $this->results;
    }

    private function verifyEnvironmentVariables(): void
    {
        echo "📋 1. Environment Variables Verification\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $envVars = [
            'DB_CONNECTION' => env('DB_CONNECTION'),
            'DB_HOST' => env('DB_HOST'),
            'DB_PORT' => env('DB_PORT'),
            'DB_DATABASE' => env('DB_DATABASE'),
            'DB_USERNAME' => env('DB_USERNAME'),
            'QUEUE_CONNECTION' => env('QUEUE_CONNECTION'),
            'CACHE_DRIVER' => env('CACHE_DRIVER'),
            'REDIS_HOST' => env('REDIS_HOST'),
            'REDIS_PORT' => env('REDIS_PORT'),
        ];

        foreach ($envVars as $key => $value) {
            $status = $value !== null ? "✅ SET" : "❌ NOT SET";
            echo sprintf("  %-20s: %s (%s)\n", $key, $value ?? 'NULL', $status);
            $this->results['env'][$key] = [
                'value' => $value,
                'status' => $value !== null ? 'ok' : 'missing'
            ];
        }

        $dbConnection = env('DB_CONNECTION');
        if ($dbConnection === 'mysql') {
            echo "  ✅ DB_CONNECTION correctly set to MySQL\n";
            $this->results['env']['db_connection_check'] = 'mysql_configured';
        } elseif ($dbConnection === 'sqlite') {
            echo "  ❌ WARNING: DB_CONNECTION is set to SQLite!\n";
            $this->results['env']['db_connection_check'] = 'sqlite_detected';
        } else {
            echo "  ⚠️  UNKNOWN: DB_CONNECTION is set to: {$dbConnection}\n";
            $this->results['env']['db_connection_check'] = 'unknown_driver';
        }

        echo "\n";
    }

    private function verifyDatabaseConfiguration(): void
    {
        echo "🗄️  2. Laravel Database Configuration\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $defaultConnection = Config::get('database.default');
        echo "  Default Connection: {$defaultConnection}\n";
        $this->results['database']['default_connection'] = $defaultConnection;

        $connections = Config::get('database.connections');
        foreach (['mysql', 'sqlite'] as $driver) {
            if (isset($connections[$driver])) {
                echo "  {$driver} Configuration:\n";
                foreach ($connections[$driver] as $key => $value) {
                    if (!in_array($key, ['password'])) { // Don't show passwords
                        $displayValue = is_array($value) ? json_encode($value) : $value;
                        echo "    {$key}: {$displayValue}\n";
                    }
                }
                $this->results['database']['connections'][$driver] = $connections[$driver];
            }
        }

        echo "\n";
    }

    private function verifyQueueConfiguration(): void
    {
        echo "📨 3. Queue Configuration\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $defaultQueue = Config::get('queue.default');
        echo "  Default Queue Connection: {$defaultQueue}\n";
        $this->results['queue']['default_connection'] = $defaultQueue;

        $batchingDb = Config::get('queue.batching.database');
        echo "  Queue Batching Database: {$batchingDb}\n";
        $this->results['queue']['batching_database'] = $batchingDb;

        $failedDb = Config::get('queue.failed.database');
        echo "  Failed Jobs Database: {$failedDb}\n";
        $this->results['queue']['failed_database'] = $failedDb;

        // Check queue connections
        $queueConnections = Config::get('queue.connections');
        foreach (['database', 'redis'] as $connection) {
            if (isset($queueConnections[$connection])) {
                echo "  {$connection} Queue Configuration:\n";
                foreach ($queueConnections[$connection] as $key => $value) {
                    echo "    {$key}: {$value}\n";
                }
            }
        }

        echo "\n";
    }

    private function verifyCacheConfiguration(): void
    {
        echo "💾 4. Cache Configuration\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $defaultCache = Config::get('cache.default');
        echo "  Default Cache Store: {$defaultCache}\n";
        $this->results['cache']['default_store'] = $defaultCache;

        $cacheStores = Config::get('cache.stores');
        foreach (['redis', 'database', 'file'] as $store) {
            if (isset($cacheStores[$store])) {
                echo "  {$store} Cache Configuration:\n";
                foreach ($cacheStores[$store] as $key => $value) {
                    if (!is_array($value)) {
                        echo "    {$key}: {$value}\n";
                    }
                }
            }
        }

        echo "\n";
    }

    private function verifyRedisConfiguration(): void
    {
        echo "🔴 5. Redis Configuration\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $redisConfig = Config::get('database.redis');
        
        foreach (['default', 'cache', 'session'] as $connection) {
            if (isset($redisConfig[$connection])) {
                echo "  {$connection} Redis Configuration:\n";
                foreach ($redisConfig[$connection] as $key => $value) {
                    if (!in_array($key, ['password'])) {
                        echo "    {$key}: {$value}\n";
                    }
                }
                $this->results['redis'][$connection] = $redisConfig[$connection];
            }
        }

        echo "\n";
    }

    private function verifyDatabaseConnection(): void
    {
        echo "🔌 6. Database Connection Test\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        try {
            $connectionName = DB::getDefaultConnection();
            echo "  Active Connection: {$connectionName}\n";
            
            $driverName = DB::connection()->getDriverName();
            echo "  Database Driver: {$driverName}\n";
            
            $config = DB::connection()->getConfig();
            echo "  Database Host: {$config['host']}\n";
            echo "  Database Name: {$config['database']}\n";
            echo "  Database Port: {$config['port']}\n";
            
            // Test actual connection
            $result = DB::select('SELECT CONNECTION_ID() as connection_id, DATABASE() as database_name, VERSION() as version');
            if ($result) {
                echo "  ✅ Connection Test: SUCCESS\n";
                echo "  Connection ID: {$result[0]->connection_id}\n";
                echo "  Current Database: {$result[0]->database_name}\n";
                echo "  MySQL Version: {$result[0]->version}\n";
                $this->results['connection']['status'] = 'success';
                $this->results['connection']['details'] = $result[0];
            }

        } catch (\Exception $e) {
            echo "  ❌ Connection Test: FAILED\n";
            echo "  Error: {$e->getMessage()}\n";
            $this->results['connection']['status'] = 'failed';
            $this->results['connection']['error'] = $e->getMessage();
        }

        echo "\n";
    }

    private function verifyMigrationTables(): void
    {
        echo "🛠️  7. Migration Tables Verification\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        try {
            $tables = DB::select("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('migrations', 'users', 'health_questionnaires')");
            
            echo "  Core Tables Found:\n";
            foreach ($tables as $table) {
                echo "    ✅ {$table->TABLE_NAME}\n";
            }
            
            $migrationCount = DB::table('migrations')->count();
            echo "  Total Migrations Applied: {$migrationCount}\n";
            
            $this->results['migrations']['tables_found'] = count($tables);
            $this->results['migrations']['migration_count'] = $migrationCount;
            
        } catch (\Exception $e) {
            echo "  ❌ Migration Check: FAILED\n";
            echo "  Error: {$e->getMessage()}\n";
            $this->results['migrations']['status'] = 'failed';
            $this->results['migrations']['error'] = $e->getMessage();
        }

        echo "\n";
    }

    private function verifyQueueTables(): void
    {
        echo "📋 8. Queue Tables Verification\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        try {
            $queueTables = ['jobs', 'job_batches', 'failed_jobs'];
            $foundTables = [];
            
            foreach ($queueTables as $table) {
                $exists = DB::select("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [$table]);
                if ($exists) {
                    echo "  ✅ {$table} table exists\n";
                    $foundTables[] = $table;
                    
                    // Count records
                    $count = DB::table($table)->count();
                    echo "    Records: {$count}\n";
                } else {
                    echo "  ❌ {$table} table missing\n";
                }
            }
            
            $this->results['queue_tables']['found'] = $foundTables;
            $this->results['queue_tables']['missing'] = array_diff($queueTables, $foundTables);
            
        } catch (\Exception $e) {
            echo "  ❌ Queue Tables Check: FAILED\n";
            echo "  Error: {$e->getMessage()}\n";
            $this->results['queue_tables']['error'] = $e->getMessage();
        }

        echo "\n";
    }

    private function verifyWorkerProcesses(): void
    {
        echo "⚙️  9. Worker Processes Configuration\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        // Check supervisor configuration file
        $supervisorConfig = '/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend/docker/supervisor/supervisord.conf';
        if (file_exists($supervisorConfig)) {
            echo "  ✅ Supervisor config found\n";
            
            $content = file_get_contents($supervisorConfig);
            
            // Check for queue worker configuration
            if (strpos($content, 'queue:work redis') !== false) {
                echo "  ✅ Queue worker configured to use Redis\n";
                $this->results['workers']['queue_redis'] = true;
            } else {
                echo "  ❌ Queue worker not configured for Redis\n";
                $this->results['workers']['queue_redis'] = false;
            }
            
            // Check for scheduler
            if (strpos($content, 'schedule:run') !== false) {
                echo "  ✅ Laravel scheduler configured\n";
                $this->results['workers']['scheduler'] = true;
            } else {
                echo "  ❌ Laravel scheduler not configured\n";
                $this->results['workers']['scheduler'] = false;
            }
            
        } else {
            echo "  ⚠️  Supervisor config not found at expected location\n";
            $this->results['workers']['supervisor_config'] = 'not_found';
        }

        echo "\n";
    }

    private function generateSummaryReport(): void
    {
        echo "📊 10. Summary Report\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $issues = [];
        $warnings = [];
        $successes = [];

        // Check for critical issues
        if (isset($this->results['env']['db_connection_check']) && $this->results['env']['db_connection_check'] === 'sqlite_detected') {
            $issues[] = "DB_CONNECTION is set to SQLite instead of MySQL";
        }

        if (isset($this->results['connection']['status']) && $this->results['connection']['status'] === 'failed') {
            $issues[] = "Database connection failed: " . ($this->results['connection']['error'] ?? 'Unknown error');
        }

        if (isset($this->results['database']['default_connection']) && $this->results['database']['default_connection'] === 'mysql') {
            $successes[] = "Default database connection is MySQL";
        }

        if (isset($this->results['queue']['batching_database']) && $this->results['queue']['batching_database'] === 'mysql') {
            $successes[] = "Queue batching uses MySQL";
        }

        if (isset($this->results['queue']['failed_database']) && $this->results['queue']['failed_database'] === 'mysql') {
            $successes[] = "Failed jobs table uses MySQL";
        }

        // Display results
        if (empty($issues)) {
            echo "  🎉 No critical issues found!\n";
        } else {
            echo "  ❌ Critical Issues:\n";
            foreach ($issues as $issue) {
                echo "    • {$issue}\n";
            }
        }

        if (!empty($warnings)) {
            echo "  ⚠️  Warnings:\n";
            foreach ($warnings as $warning) {
                echo "    • {$warning}\n";
            }
        }

        if (!empty($successes)) {
            echo "  ✅ Successes:\n";
            foreach ($successes as $success) {
                echo "    • {$success}\n";
            }
        }

        $this->results['summary'] = [
            'issues' => $issues,
            'warnings' => $warnings,
            'successes' => $successes,
            'overall_status' => empty($issues) ? 'healthy' : 'needs_attention'
        ];

        echo "\n";
        echo "═══════════════════════════════════════════════════════════\n";
        echo "🏁 Database Configuration Verification Complete!\n";
        echo "═══════════════════════════════════════════════════════════\n";
    }
}

// Run the verification if called directly
if (basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    $verifier = new DatabaseConfigVerifier();
    $results = $verifier->run();
    
    // Save results to file
    $resultsFile = __DIR__ . '/../storage/logs/database-verification-' . date('Y-m-d-H-i-s') . '.json';
    file_put_contents($resultsFile, json_encode($results, JSON_PRETTY_PRINT));
    echo "\n📄 Results saved to: {$resultsFile}\n";
}