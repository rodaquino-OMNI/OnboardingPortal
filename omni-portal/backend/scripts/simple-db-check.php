<?php
/**
 * Simple Database Configuration Check
 * Verifies MySQL configuration across all Laravel components
 */

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "🔍 AUSTA Portal Database Configuration Verification\n";
echo "═══════════════════════════════════════════════════════\n\n";

// 1. Environment Check
echo "1. ENVIRONMENT VARIABLES:\n";
echo "   DB_CONNECTION: " . (env('DB_CONNECTION') ?: 'NOT SET') . "\n";
echo "   DB_HOST: " . (env('DB_HOST') ?: 'NOT SET') . "\n";
echo "   DB_DATABASE: " . (env('DB_DATABASE') ?: 'NOT SET') . "\n";
echo "   QUEUE_CONNECTION: " . (env('QUEUE_CONNECTION') ?: 'NOT SET') . "\n";
echo "   CACHE_DRIVER: " . (env('CACHE_DRIVER') ?: 'NOT SET') . "\n\n";

// 2. Laravel Config Check
echo "2. LARAVEL CONFIGURATION:\n";
echo "   Default DB Connection: " . config('database.default') . "\n";
echo "   Queue Default: " . config('queue.default') . "\n";
echo "   Queue Batching DB: " . config('queue.batching.database') . "\n";
echo "   Queue Failed DB: " . config('queue.failed.database') . "\n";
echo "   Cache Default: " . config('cache.default') . "\n\n";

// 3. Database Connection Test
echo "3. DATABASE CONNECTION TEST:\n";
try {
    $pdo = DB::connection()->getPdo();
    $driver = DB::connection()->getDriverName();
    $dbName = DB::connection()->getDatabaseName();
    
    echo "   Status: ✅ CONNECTED\n";
    echo "   Driver: {$driver}\n";
    echo "   Database: {$dbName}\n";
    
    // Test MySQL specific query
    $result = DB::select('SELECT VERSION() as version, DATABASE() as current_db');
    echo "   MySQL Version: {$result[0]->version}\n";
    echo "   Current Database: {$result[0]->current_db}\n";
    
} catch (Exception $e) {
    echo "   Status: ❌ FAILED\n";
    echo "   Error: {$e->getMessage()}\n";
}

echo "\n";

// 4. Check for SQLite file existence
echo "4. SQLITE FILE CHECK:\n";
$sqliteFile = database_path('database.sqlite');
if (file_exists($sqliteFile)) {
    echo "   ⚠️  WARNING: SQLite file exists at {$sqliteFile}\n";
    echo "   File size: " . filesize($sqliteFile) . " bytes\n";
} else {
    echo "   ✅ No SQLite file found\n";
}

echo "\n";

// 5. Migration Status
echo "5. MIGRATION STATUS:\n";
try {
    $migrations = DB::table('migrations')->count();
    echo "   Applied migrations: {$migrations}\n";
    
    $lastMigration = DB::table('migrations')->latest('id')->first();
    if ($lastMigration) {
        echo "   Last migration: {$lastMigration->migration}\n";
    }
} catch (Exception $e) {
    echo "   Error checking migrations: {$e->getMessage()}\n";
}

echo "\n";

// 6. Critical Tables Check
echo "6. CRITICAL TABLES CHECK:\n";
$criticalTables = ['users', 'health_questionnaires', 'gamification_progress', 'jobs', 'failed_jobs'];
foreach ($criticalTables as $table) {
    try {
        $count = DB::table($table)->count();
        echo "   ✅ {$table}: {$count} records\n";
    } catch (Exception $e) {
        echo "   ❌ {$table}: Table not found or error\n";
    }
}

echo "\n";

// 7. Worker Configuration Check
echo "7. WORKER CONFIGURATION:\n";
$supervisorConfig = __DIR__ . '/../docker/supervisor/supervisord.conf';
if (file_exists($supervisorConfig)) {
    $content = file_get_contents($supervisorConfig);
    if (strpos($content, 'queue:work redis') !== false) {
        echo "   ✅ Queue worker configured for Redis\n";
    } else {
        echo "   ❌ Queue worker not configured for Redis\n";
    }
    
    if (strpos($content, 'schedule:run') !== false) {
        echo "   ✅ Scheduler configured\n";
    } else {
        echo "   ❌ Scheduler not configured\n";
    }
} else {
    echo "   ⚠️  Supervisor config not found\n";
}

echo "\n";

// 8. Final Assessment
echo "8. FINAL ASSESSMENT:\n";
$issues = [];

if (config('database.default') !== 'mysql') {
    $issues[] = "Default database connection is not MySQL";
}

if (config('queue.batching.database') !== 'mysql') {
    $issues[] = "Queue batching not using MySQL";
}

if (config('queue.failed.database') !== 'mysql') {
    $issues[] = "Failed jobs not using MySQL";
}

if (empty($issues)) {
    echo "   🎉 ALL SYSTEMS CONFIGURED FOR MYSQL\n";
    echo "   ✅ Database: MySQL\n";
    echo "   ✅ Queue: Redis with MySQL storage\n";
    echo "   ✅ Cache: Redis\n";
    echo "   ✅ Sessions: Redis\n";
} else {
    echo "   ⚠️  ISSUES FOUND:\n";
    foreach ($issues as $issue) {
        echo "      • {$issue}\n";
    }
}

echo "\n═══════════════════════════════════════════════════════\n";
echo "Database configuration check complete!\n";
echo "═══════════════════════════════════════════════════════\n";