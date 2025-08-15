<?php
/**
 * Docker Database Connection Test
 * Tests database connectivity in Docker environment
 */

echo "🐳 DOCKER DATABASE CONNECTION TEST\n";
echo "═══════════════════════════════════════════════════════════\n\n";

// Test direct MySQL connection using environment variables
echo "1. DIRECT MYSQL CONNECTION TEST:\n";

$host = 'mysql';  // Docker service name
$port = '3306';
$database = 'austa_portal';
$username = 'austa_user';
$password = 'austa_password';

echo "   Attempting connection to: {$username}@{$host}:{$port}/{$database}\n";

try {
    $dsn = "mysql:host={$host};port={$port};dbname={$database}";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5
    ]);
    
    echo "   ✅ Direct MySQL connection: SUCCESS\n";
    
    // Test basic queries
    $version = $pdo->query("SELECT VERSION() as version")->fetch();
    echo "   MySQL Version: {$version['version']}\n";
    
    $currentDb = $pdo->query("SELECT DATABASE() as db")->fetch();
    echo "   Current Database: {$currentDb['db']}\n";
    
    // Check if main tables exist
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "   Tables found: " . count($tables) . "\n";
    
    $criticalTables = ['migrations', 'users', 'health_questionnaires'];
    foreach ($criticalTables as $table) {
        if (in_array($table, $tables)) {
            $count = $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
            echo "   ✅ {$table}: {$count} records\n";
        } else {
            echo "   ❌ {$table}: Not found\n";
        }
    }
    
} catch (PDOException $e) {
    echo "   ❌ Direct MySQL connection: FAILED\n";
    echo "   Error: {$e->getMessage()}\n";
    echo "   Code: {$e->getCode()}\n";
}

echo "\n";

// Test Redis connection
echo "2. DIRECT REDIS CONNECTION TEST:\n";
$redisHost = 'redis';
$redisPort = 6379;
$redisPassword = 'redis_secret';

echo "   Attempting connection to: {$redisHost}:{$redisPort}\n";

if (class_exists('Redis')) {
    try {
        $redis = new Redis();
        $redis->connect($redisHost, $redisPort, 5); // 5 second timeout
        
        if ($redisPassword) {
            $redis->auth($redisPassword);
        }
        
        echo "   ✅ Direct Redis connection: SUCCESS\n";
        
        // Test Redis operations
        $redis->set('test_key', 'test_value', 10);
        $value = $redis->get('test_key');
        echo "   Redis test operation: " . ($value === 'test_value' ? 'SUCCESS' : 'FAILED') . "\n";
        
        $info = $redis->info();
        echo "   Redis Version: {$info['redis_version']}\n";
        echo "   Connected Clients: {$info['connected_clients']}\n";
        
        $redis->del('test_key');
        
    } catch (Exception $e) {
        echo "   ❌ Direct Redis connection: FAILED\n";
        echo "   Error: {$e->getMessage()}\n";
    }
} else {
    echo "   ⚠️  Redis PHP extension not available\n";
}

echo "\n";

// Network connectivity test
echo "3. NETWORK CONNECTIVITY TEST:\n";

$services = [
    'mysql' => 3306,
    'redis' => 6379,
];

foreach ($services as $service => $port) {
    echo "   Testing {$service}:{$port}... ";
    
    $connection = @fsockopen($service, $port, $errno, $errstr, 5);
    if ($connection) {
        echo "✅ REACHABLE\n";
        fclose($connection);
    } else {
        echo "❌ UNREACHABLE (Error: {$errno} - {$errstr})\n";
    }
}

echo "\n";

// Environment check
echo "4. DOCKER ENVIRONMENT CHECK:\n";
$dockerEnvVars = [
    'HOSTNAME',
    'PATH',
    'PWD',
    'HOME'
];

foreach ($dockerEnvVars as $var) {
    $value = getenv($var);
    echo "   {$var}: " . ($value ?: 'NOT SET') . "\n";
}

// Check if running in Docker
if (file_exists('/.dockerenv')) {
    echo "   ✅ Running inside Docker container\n";
} else {
    echo "   ⚠️  Not running inside Docker container\n";
}

echo "\n";

echo "5. CONFIGURATION SUMMARY:\n";
echo "   Database Driver: MySQL\n";
echo "   Database Host: mysql (Docker service)\n";
echo "   Database Port: 3306\n";
echo "   Database Name: austa_portal\n";
echo "   Queue System: Redis\n";
echo "   Cache System: Redis\n";
echo "   Session Store: Redis\n";
echo "   Worker Processes: Configured via Supervisor\n";

echo "\n═══════════════════════════════════════════════════════════\n";
echo "Docker database connection test complete!\n";
echo "═══════════════════════════════════════════════════════════\n";