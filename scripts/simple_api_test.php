<?php

// Simple API Test Script to validate server functionality
require_once __DIR__ . '/../omni-portal/backend/vendor/autoload.php';

use Illuminate\Foundation\Application;

try {
    // Test basic Laravel bootstrap
    $app = new Application(
        $_ENV['APP_BASE_PATH'] ?? dirname(__DIR__) . '/omni-portal/backend'
    );
    
    echo "✓ Laravel application bootstrapped successfully\n";
    
    // Test database connection
    try {
        $dbPath = dirname(__DIR__) . '/omni-portal/backend/database/database.sqlite';
        if (file_exists($dbPath)) {
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            // Test a simple query
            $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' LIMIT 5");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            echo "✓ Database connection successful\n";
            echo "✓ Found " . count($tables) . " tables in database\n";
            echo "✓ Sample tables: " . implode(', ', array_slice($tables, 0, 3)) . "\n";
        } else {
            echo "✗ Database file not found: $dbPath\n";
        }
    } catch (Exception $e) {
        echo "✗ Database error: " . $e->getMessage() . "\n";
    }
    
    // Test basic HTTP request
    $baseUrl = 'http://127.0.0.1:8001';
    
    echo "\nTesting API endpoints:\n";
    
    $endpoints = [
        '/api/info' => 'GET',
        '/api/gamification/progress' => 'GET', 
        '/api/health' => 'GET'
    ];
    
    foreach ($endpoints as $endpoint => $method) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $baseUrl . $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
        
        $start = microtime(true);
        $response = curl_exec($ch);
        $responseTime = microtime(true) - $start;
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            echo "✗ $endpoint: CURL Error - $error\n";
        } else {
            $status = $httpCode >= 200 && $httpCode < 400 ? '✓' : '✗';
            echo "$status $endpoint: HTTP $httpCode (" . round($responseTime * 1000, 2) . "ms)\n";
            
            if ($httpCode >= 400) {
                echo "   Response: " . substr($response, 0, 200) . "\n";
            }
        }
    }
    
} catch (Exception $e) {
    echo "✗ Bootstrap error: " . $e->getMessage() . "\n";
}

echo "\nTest completed.\n";