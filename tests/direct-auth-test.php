<?php

/**
 * Direct Authentication Test Script
 * Tests authentication endpoints directly without middleware issues
 */

require_once __DIR__ . '/../omni-portal/backend/vendor/autoload.php';

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

// Bootstrap Laravel
$app = require_once __DIR__ . '/../omni-portal/backend/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Test credentials
$credentials = [
    'admin' => ['email' => 'admin@omnihealth.com', 'password' => 'Admin@123'],
    'doctor' => ['email' => 'maria.silva@omnihealth.com', 'password' => 'Doctor@123!'],
    'coordinator' => ['email' => 'carlos.santos@omnihealth.com', 'password' => 'Coord@123!'],
    'employee' => ['email' => 'ana.costa@empresa.com', 'password' => 'Employee@123!']
];

echo "🔐 DIRECT AUTHENTICATION TEST\n";
echo "============================\n\n";

// Test database connection
try {
    $users = DB::table('users')->count();
    echo "✅ Database connection OK - Found {$users} users\n\n";
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test each credential
foreach ($credentials as $type => $cred) {
    echo "Testing {$type} ({$cred['email']}):\n";
    echo "----------------------------------------\n";
    
    try {
        // Check if user exists
        $user = DB::table('users')->where('email', $cred['email'])->first();
        
        if (!$user) {
            echo "❌ User not found in database\n\n";
            continue;
        }
        
        echo "✅ User found in database (ID: {$user->id})\n";
        
        // Check password
        if (Hash::check($cred['password'], $user->password)) {
            echo "✅ Password verification successful\n";
            
            // Test token creation (simulate login)
            try {
                $userModel = new \App\Models\User();
                $userModel->forceFill((array) $user);
                $userModel->exists = true;
                
                $token = $userModel->createToken('auth_token')->plainTextToken;
                echo "✅ Token creation successful: " . substr($token, 0, 20) . "...\n";
                
            } catch (Exception $e) {
                echo "⚠️  Token creation failed: " . $e->getMessage() . "\n";
            }
            
        } else {
            echo "❌ Password verification failed\n";
        }
        
    } catch (Exception $e) {
        echo "❌ Test failed: " . $e->getMessage() . "\n";
    }
    
    echo "\n";
}

// Test API endpoint availability through HTTP
echo "Testing HTTP API endpoints:\n";
echo "===========================\n";

$testEndpoints = [
    'Health Check' => 'http://localhost:8000/api/health',
    'CSRF Cookie' => 'http://localhost:8000/sanctum/csrf-cookie'
];

foreach ($testEndpoints as $name => $url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        echo "❌ {$name}: Connection failed - {$error}\n";
    } else {
        if ($httpCode == 200 || $httpCode == 204) {
            echo "✅ {$name}: HTTP {$httpCode} - OK\n";
        } else {
            echo "⚠️  {$name}: HTTP {$httpCode} - " . substr($response, 0, 100) . "\n";
        }
    }
}

echo "\n";

// Test login endpoint with actual HTTP request
echo "Testing Login Endpoint:\n";
echo "======================\n";

foreach ($credentials as $type => $cred) {
    echo "Testing login for {$type}:\n";
    
    $loginData = json_encode([
        'email' => $cred['email'],
        'password' => $cred['password']
    ]);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'http://localhost:8000/api/auth/login');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $loginData);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Content-Type: application/json',
        'Origin: http://localhost:3000'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        echo "❌ Connection failed: {$error}\n";
    } else {
        echo "📡 HTTP Status: {$httpCode}\n";
        echo "📄 Response: " . substr($response, 0, 200) . "\n";
        
        if ($httpCode == 200) {
            $responseData = json_decode($response, true);
            if (isset($responseData['token']) || isset($responseData['access_token'])) {
                echo "✅ Login successful - Token received\n";
            } else {
                echo "⚠️  Login returned 200 but no token found\n";
            }
        } else {
            echo "❌ Login failed with HTTP {$httpCode}\n";
        }
    }
    
    echo "\n";
}

echo "Test completed at " . date('Y-m-d H:i:s') . "\n";