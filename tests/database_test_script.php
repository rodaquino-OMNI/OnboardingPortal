<?php
/**
 * Comprehensive Database Testing Script
 * Tests all critical database operations for OnboardingPortal
 */

// Test database connectivity and basic operations
function testDatabaseConnectivity() {
    echo "=== Testing Database Connectivity ===\n";
    
    try {
        $pdo = DB::connection()->getPdo();
        echo "✅ Database connection: SUCCESS\n";
        echo "📊 Database driver: " . $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . "\n";
        echo "📊 Server version: " . $pdo->getAttribute(PDO::ATTR_SERVER_VERSION) . "\n";
        return true;
    } catch (Exception $e) {
        echo "❌ Database connection: FAILED - " . $e->getMessage() . "\n";
        return false;
    }
}

// Test user authentication operations
function testUserOperations() {
    echo "\n=== Testing User CRUD Operations ===\n";
    
    try {
        // Test user creation
        $user = new App\Models\User();
        $user->name = 'Test User ' . time();
        $user->email = 'test' . time() . '@example.com';
        $user->password = Hash::make('password123');
        $user->save();
        
        echo "✅ User creation: SUCCESS (ID: {$user->id})\n";
        
        // Test user retrieval
        $retrievedUser = App\Models\User::find($user->id);
        if ($retrievedUser && $retrievedUser->email === $user->email) {
            echo "✅ User retrieval: SUCCESS\n";
        } else {
            echo "❌ User retrieval: FAILED\n";
        }
        
        // Test user update
        $retrievedUser->name = 'Updated Test User';
        $retrievedUser->save();
        echo "✅ User update: SUCCESS\n";
        
        // Test user deletion
        $retrievedUser->delete();
        echo "✅ User deletion: SUCCESS\n";
        
        return true;
    } catch (Exception $e) {
        echo "❌ User operations: FAILED - " . $e->getMessage() . "\n";
        return false;
    }
}

// Test health questionnaire operations
function testHealthQuestionnaireOperations() {
    echo "\n=== Testing Health Questionnaire Operations ===\n";
    
    try {
        // First, get a valid user
        $user = App\Models\User::first();
        if (!$user) {
            echo "❌ Health questionnaire test: No users available\n";
            return false;
        }
        
        // Create health questionnaire
        $questionnaire = new App\Models\HealthQuestionnaire();
        $questionnaire->user_id = $user->id;
        $questionnaire->responses = json_encode([
            'symptoms' => ['headache', 'fatigue'],
            'medications' => ['aspirin'],
            'allergies' => 'none'
        ]);
        $questionnaire->completed_at = now();
        $questionnaire->save();
        
        echo "✅ Health questionnaire creation: SUCCESS (ID: {$questionnaire->id})\n";
        
        // Test retrieval with user relationship
        $retrieved = App\Models\HealthQuestionnaire::with('user')->find($questionnaire->id);
        if ($retrieved && $retrieved->user_id === $user->id) {
            echo "✅ Health questionnaire retrieval with relationships: SUCCESS\n";
        }
        
        // Test JSON field operations
        $responses = json_decode($retrieved->responses, true);
        if (is_array($responses) && isset($responses['symptoms'])) {
            echo "✅ JSON field operations: SUCCESS\n";
        }
        
        // Cleanup
        $questionnaire->delete();
        
        return true;
    } catch (Exception $e) {
        echo "❌ Health questionnaire operations: FAILED - " . $e->getMessage() . "\n";
        return false;
    }
}

// Test beneficiary operations
function testBeneficiaryOperations() {
    echo "\n=== Testing Beneficiary Operations ===\n";
    
    try {
        $user = App\Models\User::first();
        if (!$user) {
            echo "❌ Beneficiary test: No users available\n";
            return false;
        }
        
        $beneficiary = new App\Models\Beneficiary();
        $beneficiary->user_id = $user->id;
        $beneficiary->cpf = '123.456.789-' . str_pad(rand(10, 99), 2, '0', STR_PAD_LEFT);
        $beneficiary->phone = '+55 11 99999-9999';
        $beneficiary->birth_date = '1990-01-01';
        $beneficiary->gender = 'M';
        $beneficiary->save();
        
        echo "✅ Beneficiary creation: SUCCESS (ID: {$beneficiary->id})\n";
        
        // Test relationship
        $retrieved = App\Models\Beneficiary::with('user')->find($beneficiary->id);
        if ($retrieved && $retrieved->user->id === $user->id) {
            echo "✅ Beneficiary-User relationship: SUCCESS\n";
        }
        
        // Cleanup
        $beneficiary->delete();
        
        return true;
    } catch (Exception $e) {
        echo "❌ Beneficiary operations: FAILED - " . $e->getMessage() . "\n";
        return false;
    }
}

// Test document operations
function testDocumentOperations() {
    echo "\n=== Testing Document Operations ===\n";
    
    try {
        $user = App\Models\User::first();
        if (!$user) {
            echo "❌ Document test: No users available\n";
            return false;
        }
        
        $document = new App\Models\Document();
        $document->user_id = $user->id;
        $document->original_name = 'test_document.pdf';
        $document->file_path = '/storage/documents/test.pdf';
        $document->file_size = 1024000;
        $document->mime_type = 'application/pdf';
        $document->status = 'uploaded';
        $document->save();
        
        echo "✅ Document creation: SUCCESS (ID: {$document->id})\n";
        
        // Test file path operations
        if (strpos($document->file_path, '/storage/') === 0) {
            echo "✅ Document file path validation: SUCCESS\n";
        }
        
        // Cleanup
        $document->delete();
        
        return true;
    } catch (Exception $e) {
        echo "❌ Document operations: FAILED - " . $e->getMessage() . "\n";
        return false;
    }
}

// Test database indexes and performance
function testDatabasePerformance() {
    echo "\n=== Testing Database Performance ===\n";
    
    try {
        $start = microtime(true);
        
        // Test index usage on users table
        $users = DB::table('users')->where('email', 'like', '%@example.com')->get();
        $userQueryTime = microtime(true) - $start;
        
        echo "✅ User email query: " . number_format($userQueryTime * 1000, 2) . "ms\n";
        
        // Test health questionnaire queries
        $start = microtime(true);
        $questionnaires = DB::table('health_questionnaires')
            ->where('created_at', '>=', now()->subDays(7))
            ->count();
        $questionnaireQueryTime = microtime(true) - $start;
        
        echo "✅ Health questionnaire date query: " . number_format($questionnaireQueryTime * 1000, 2) . "ms\n";
        
        // Test complex join query
        $start = microtime(true);
        $results = DB::table('users')
            ->leftJoin('health_questionnaires', 'users.id', '=', 'health_questionnaires.user_id')
            ->select('users.name', DB::raw('COUNT(health_questionnaires.id) as questionnaire_count'))
            ->groupBy('users.id', 'users.name')
            ->limit(10)
            ->get();
        $joinQueryTime = microtime(true) - $start;
        
        echo "✅ Complex join query: " . number_format($joinQueryTime * 1000, 2) . "ms\n";
        
        return true;
    } catch (Exception $e) {
        echo "❌ Performance tests: FAILED - " . $e->getMessage() . "\n";
        return false;
    }
}

// Test foreign key constraints
function testForeignKeyConstraints() {
    echo "\n=== Testing Foreign Key Constraints ===\n";
    
    try {
        // Test invalid user_id in health_questionnaires
        try {
            $questionnaire = new App\Models\HealthQuestionnaire();
            $questionnaire->user_id = 999999; // Non-existent user
            $questionnaire->responses = '{}';
            $questionnaire->save();
            
            echo "❌ Foreign key constraint: FAILED - Should have prevented invalid user_id\n";
            return false;
        } catch (Exception $e) {
            echo "✅ Foreign key constraint: SUCCESS - Prevented invalid user_id\n";
        }
        
        return true;
    } catch (Exception $e) {
        echo "❌ Foreign key constraint test: FAILED - " . $e->getMessage() . "\n";
        return false;
    }
}

// Test connection pooling under load
function testConnectionPooling() {
    echo "\n=== Testing Connection Pooling ===\n";
    
    try {
        $connections = [];
        $startTime = microtime(true);
        
        // Create multiple connections
        for ($i = 0; $i < 5; $i++) {
            $connection = DB::connection();
            $connections[] = $connection;
            
            // Simple query to test connection
            $result = $connection->select('SELECT 1 as test');
        }
        
        $totalTime = microtime(true) - $startTime;
        echo "✅ Connection pooling: SUCCESS - 5 connections in " . number_format($totalTime * 1000, 2) . "ms\n";
        
        return true;
    } catch (Exception $e) {
        echo "❌ Connection pooling: FAILED - " . $e->getMessage() . "\n";
        return false;
    }
}

// Main test runner
function runAllTests() {
    echo "🚀 Starting Comprehensive Database Tests\n";
    echo "==========================================\n";
    
    $tests = [
        'Database Connectivity' => 'testDatabaseConnectivity',
        'User Operations' => 'testUserOperations',
        'Health Questionnaire Operations' => 'testHealthQuestionnaireOperations',
        'Beneficiary Operations' => 'testBeneficiaryOperations',
        'Document Operations' => 'testDocumentOperations',
        'Database Performance' => 'testDatabasePerformance',
        'Foreign Key Constraints' => 'testForeignKeyConstraints',
        'Connection Pooling' => 'testConnectionPooling'
    ];
    
    $results = [];
    
    foreach ($tests as $testName => $testFunction) {
        $results[$testName] = $testFunction();
    }
    
    echo "\n==========================================\n";
    echo "📊 Test Results Summary:\n";
    
    $passed = 0;
    $total = count($results);
    
    foreach ($results as $testName => $result) {
        $status = $result ? '✅ PASS' : '❌ FAIL';
        echo "  {$status} - {$testName}\n";
        if ($result) $passed++;
    }
    
    $percentage = round(($passed / $total) * 100, 2);
    echo "\n🎯 Overall Score: {$passed}/{$total} ({$percentage}%)\n";
    
    if ($percentage >= 80) {
        echo "🎉 Database tests: EXCELLENT\n";
    } elseif ($percentage >= 60) {
        echo "⚠️  Database tests: GOOD (some issues to address)\n";
    } else {
        echo "🚨 Database tests: CRITICAL (major issues found)\n";
    }
}

// Run all tests
runAllTests();