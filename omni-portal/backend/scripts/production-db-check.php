<?php
/**
 * Production Database Configuration Check
 * Tests with proper environment loading for production scenarios
 */

// Load environment variables from .env file
if (file_exists(__DIR__ . '/../.env')) {
    $lines = file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value, " \t\n\r\0\x0B\"'");
        
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "🔍 PRODUCTION DATABASE CONFIGURATION VERIFICATION\n";
echo "═══════════════════════════════════════════════════════════\n\n";

echo "1. ENVIRONMENT VARIABLES (from .env):\n";
echo "   DB_CONNECTION: " . (env('DB_CONNECTION') ?: 'NOT SET') . "\n";
echo "   DB_HOST: " . (env('DB_HOST') ?: 'NOT SET') . "\n";
echo "   DB_PORT: " . (env('DB_PORT') ?: 'NOT SET') . "\n";
echo "   DB_DATABASE: " . (env('DB_DATABASE') ?: 'NOT SET') . "\n";
echo "   DB_USERNAME: " . (env('DB_USERNAME') ?: 'NOT SET') . "\n";
echo "   QUEUE_CONNECTION: " . (env('QUEUE_CONNECTION') ?: 'NOT SET') . "\n";
echo "   CACHE_DRIVER: " . (env('CACHE_DRIVER') ?: 'NOT SET') . "\n";
echo "   REDIS_HOST: " . (env('REDIS_HOST') ?: 'NOT SET') . "\n";
echo "   REDIS_PORT: " . (env('REDIS_PORT') ?: 'NOT SET') . "\n\n";

echo "2. CACHED CONFIGURATION:\n";
echo "   Default DB Connection: " . config('database.default') . "\n";
echo "   MySQL Host: " . config('database.connections.mysql.host') . "\n";
echo "   MySQL Port: " . config('database.connections.mysql.port') . "\n";
echo "   MySQL Database: " . config('database.connections.mysql.database') . "\n";
echo "   MySQL Username: " . config('database.connections.mysql.username') . "\n";
echo "   Queue Default: " . config('queue.default') . "\n";
echo "   Queue Batching DB: " . config('queue.batching.database') . "\n";
echo "   Queue Failed DB: " . config('queue.failed.database') . "\n";
echo "   Cache Default: " . config('cache.default') . "\n\n";

echo "3. CONFIGURATION FILE ANALYSIS:\n";
$envFile = __DIR__ . '/../.env';
$dockerEnvFile = __DIR__ . '/../.env.docker';
$configCacheFile = __DIR__ . '/../bootstrap/cache/config.php';

if (file_exists($envFile)) {
    echo "   ✅ .env file exists\n";
    $envContent = file_get_contents($envFile);
    if (strpos($envContent, 'DB_CONNECTION=mysql') !== false) {
        echo "   ✅ .env contains DB_CONNECTION=mysql\n";
    } else {
        echo "   ❌ .env does not contain DB_CONNECTION=mysql\n";
    }
} else {
    echo "   ❌ .env file missing\n";
}

if (file_exists($dockerEnvFile)) {
    echo "   ✅ .env.docker file exists\n";
    $dockerEnvContent = file_get_contents($dockerEnvFile);
    if (strpos($dockerEnvContent, 'DB_CONNECTION=mysql') !== false) {
        echo "   ✅ .env.docker contains DB_CONNECTION=mysql\n";
    }
} else {
    echo "   ❌ .env.docker file missing\n";
}

if (file_exists($configCacheFile)) {
    echo "   ✅ Cached config exists\n";
    $cacheContent = file_get_contents($configCacheFile);
    if (strpos($cacheContent, "'default' => 'mysql'") !== false) {
        echo "   ✅ Cached config has default MySQL connection\n";
    }
} else {
    echo "   ❌ Cached config missing\n";
}

echo "\n";

echo "4. SQLITE CONTAMINATION CHECK:\n";
$sqliteFiles = [
    __DIR__ . '/../database/database.sqlite',
    __DIR__ . '/../storage/database.sqlite',
    __DIR__ . '/../database.sqlite'
];

$sqliteFound = false;
foreach ($sqliteFiles as $file) {
    if (file_exists($file)) {
        $size = filesize($file);
        echo "   ⚠️  SQLite file found: " . basename(dirname($file)) . "/" . basename($file) . " ({$size} bytes)\n";
        $sqliteFound = true;
    }
}

if (!$sqliteFound) {
    echo "   ✅ No SQLite files found\n";
}

echo "\n";

echo "5. QUEUE WORKER COMMAND VERIFICATION:\n";
$supervisorConfig = __DIR__ . '/../docker/supervisor/supervisord.conf';
if (file_exists($supervisorConfig)) {
    $content = file_get_contents($supervisorConfig);
    
    // Extract the queue worker command
    if (preg_match('/command=php.*artisan queue:work\s+(\w+)/', $content, $matches)) {
        $queueConnection = $matches[1];
        echo "   Queue Worker Connection: {$queueConnection}\n";
        
        if ($queueConnection === 'redis') {
            echo "   ✅ Queue worker correctly configured for Redis\n";
        } else {
            echo "   ❌ Queue worker not using Redis (using: {$queueConnection})\n";
        }
    }
    
    // Check scheduler
    if (strpos($content, 'artisan schedule:run') !== false) {
        echo "   ✅ Laravel scheduler configured\n";
    } else {
        echo "   ❌ Laravel scheduler not configured\n";
    }
} else {
    echo "   ⚠️  Supervisor config not found\n";
}

echo "\n";

echo "6. DOCKER COMPOSE VERIFICATION:\n";
$dockerComposeFile = __DIR__ . '/../../docker-compose.yml';
if (file_exists($dockerComposeFile)) {
    echo "   ✅ docker-compose.yml found\n";
    $dockerContent = file_get_contents($dockerComposeFile);
    
    if (strpos($dockerContent, 'mysql:') !== false) {
        echo "   ✅ MySQL service defined in docker-compose\n";
    }
    
    if (strpos($dockerContent, 'redis:') !== false) {
        echo "   ✅ Redis service defined in docker-compose\n";
    }
} else {
    echo "   ⚠️  docker-compose.yml not found\n";
}

echo "\n";

echo "7. CRITICAL ASSESSMENT:\n";
$criticalIssues = [];
$warnings = [];
$successes = [];

// Check environment configuration
if (env('DB_CONNECTION') !== 'mysql') {
    $criticalIssues[] = "DB_CONNECTION environment variable not set to mysql";
} else {
    $successes[] = "DB_CONNECTION correctly set to mysql";
}

// Check cached configuration
if (config('database.default') === 'mysql') {
    $successes[] = "Default database connection is MySQL";
} else {
    $criticalIssues[] = "Default database connection is not MySQL";
}

if (config('queue.default') === 'redis') {
    $successes[] = "Queue system using Redis";
} else {
    $warnings[] = "Queue system not using Redis";
}

if (config('cache.default') === 'redis') {
    $successes[] = "Cache system using Redis";
} else {
    $warnings[] = "Cache system not using Redis";
}

if (config('queue.batching.database') === 'mysql') {
    $successes[] = "Queue batching using MySQL";
} else {
    $criticalIssues[] = "Queue batching not using MySQL";
}

if (config('queue.failed.database') === 'mysql') {
    $successes[] = "Failed jobs using MySQL";
} else {
    $criticalIssues[] = "Failed jobs not using MySQL";
}

// SQLite file check
if ($sqliteFound) {
    $warnings[] = "SQLite files still present in the system";
}

// Display results
if (empty($criticalIssues)) {
    echo "   🎉 NO CRITICAL ISSUES FOUND!\n";
} else {
    echo "   🚨 CRITICAL ISSUES:\n";
    foreach ($criticalIssues as $issue) {
        echo "      • {$issue}\n";
    }
}

if (!empty($warnings)) {
    echo "   ⚠️  WARNINGS:\n";
    foreach ($warnings as $warning) {
        echo "      • {$warning}\n";
    }
}

if (!empty($successes)) {
    echo "   ✅ SUCCESSFUL CONFIGURATIONS:\n";
    foreach ($successes as $success) {
        echo "      • {$success}\n";
    }
}

echo "\n";

echo "8. RECOMMENDED ACTIONS:\n";
if ($sqliteFound) {
    echo "   • Consider removing SQLite database files if they're no longer needed\n";
}

if (!empty($criticalIssues)) {
    echo "   • Fix critical configuration issues before deploying to production\n";
    echo "   • Clear Laravel configuration cache: php artisan config:clear\n";
    echo "   • Regenerate configuration cache: php artisan config:cache\n";
}

if (empty($criticalIssues) && empty($warnings)) {
    echo "   • Configuration is ready for production deployment\n";
    echo "   • All database operations will use MySQL\n";
    echo "   • Queue and cache systems properly configured\n";
}

echo "\n═══════════════════════════════════════════════════════════\n";
echo "Production database configuration verification complete!\n";
echo "═══════════════════════════════════════════════════════════\n";