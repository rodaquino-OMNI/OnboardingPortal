#!/bin/bash

# Comprehensive Database CRUD Testing Script
# Tests all database operations through Laravel Artisan commands

echo "🚀 Starting Database CRUD Tests"
echo "================================"

# Test 1: Database Connection Test
echo ""
echo "=== Test 1: Database Connection ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$pdo = DB::connection()->getPdo();
    echo '✅ Database connection: SUCCESS\n';
    echo '📊 Driver: ' . \$pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . '\n';
    echo '📊 Version: ' . \$pdo->getAttribute(PDO::ATTR_SERVER_VERSION) . '\n';
} catch (Exception \$e) {
    echo '❌ Database connection: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 2: User Model CRUD Operations
echo ""
echo "=== Test 2: User CRUD Operations ==="
docker-compose exec backend php artisan tinker --execute="
try {
    // Create user
    \$user = new App\Models\User();
    \$user->name = 'Test User ' . time();
    \$user->email = 'test' . time() . '@example.com';
    \$user->password = Hash::make('password123');
    \$user->save();
    echo '✅ User creation: SUCCESS (ID: ' . \$user->id . ')\n';
    
    // Read user
    \$retrieved = App\Models\User::find(\$user->id);
    if (\$retrieved) {
        echo '✅ User retrieval: SUCCESS\n';
    }
    
    // Update user
    \$retrieved->name = 'Updated User';
    \$retrieved->save();
    echo '✅ User update: SUCCESS\n';
    
    // Delete user
    \$retrieved->delete();
    echo '✅ User deletion: SUCCESS\n';
    
} catch (Exception \$e) {
    echo '❌ User CRUD: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 3: Health Questionnaire Operations
echo ""
echo "=== Test 3: Health Questionnaire Operations ==="
docker-compose exec backend php artisan tinker --execute="
try {
    // Get existing user or create one
    \$user = App\Models\User::first();
    if (!\$user) {
        \$user = new App\Models\User();
        \$user->name = 'Test User';
        \$user->email = 'questionnaire_test@example.com';
        \$user->password = Hash::make('password');
        \$user->save();
    }
    
    // Create health questionnaire
    \$questionnaire = new App\Models\HealthQuestionnaire();
    \$questionnaire->user_id = \$user->id;
    \$questionnaire->responses = json_encode([
        'symptoms' => ['headache', 'fatigue'],
        'medications' => ['aspirin']
    ]);
    \$questionnaire->completed_at = now();
    \$questionnaire->save();
    
    echo '✅ Health questionnaire creation: SUCCESS (ID: ' . \$questionnaire->id . ')\n';
    
    // Test JSON operations
    \$retrieved = App\Models\HealthQuestionnaire::find(\$questionnaire->id);
    \$responses = json_decode(\$retrieved->responses, true);
    if (isset(\$responses['symptoms'])) {
        echo '✅ JSON field operations: SUCCESS\n';
    }
    
    // Test relationships
    \$withUser = App\Models\HealthQuestionnaire::with('user')->find(\$questionnaire->id);
    if (\$withUser->user) {
        echo '✅ User relationship: SUCCESS\n';
    }
    
    // Cleanup
    \$questionnaire->delete();
    
} catch (Exception \$e) {
    echo '❌ Health questionnaire ops: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 4: Beneficiary Operations
echo ""
echo "=== Test 4: Beneficiary Operations ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$user = App\Models\User::first();
    if (!\$user) {
        echo '❌ No users available for beneficiary test\n';
    } else {
        // Create beneficiary
        \$beneficiary = new App\Models\Beneficiary();
        \$beneficiary->user_id = \$user->id;
        \$beneficiary->cpf = '123.456.789-' . str_pad(rand(10, 99), 2, '0', STR_PAD_LEFT);
        \$beneficiary->phone = '+55 11 99999-9999';
        \$beneficiary->birth_date = '1990-01-01';
        \$beneficiary->gender = 'M';
        \$beneficiary->save();
        
        echo '✅ Beneficiary creation: SUCCESS (ID: ' . \$beneficiary->id . ')\n';
        
        // Test relationship
        \$withUser = App\Models\Beneficiary::with('user')->find(\$beneficiary->id);
        if (\$withUser->user) {
            echo '✅ Beneficiary-User relationship: SUCCESS\n';
        }
        
        // Cleanup
        \$beneficiary->delete();
    }
} catch (Exception \$e) {
    echo '❌ Beneficiary operations: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 5: Document Operations
echo ""
echo "=== Test 5: Document Operations ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$user = App\Models\User::first();
    if (!\$user) {
        echo '❌ No users available for document test\n';
    } else {
        // Create document
        \$document = new App\Models\Document();
        \$document->user_id = \$user->id;
        \$document->original_name = 'test_document.pdf';
        \$document->file_path = '/storage/documents/test.pdf';
        \$document->file_size = 1024000;
        \$document->mime_type = 'application/pdf';
        \$document->status = 'uploaded';
        \$document->save();
        
        echo '✅ Document creation: SUCCESS (ID: ' . \$document->id . ')\n';
        
        // Test document retrieval
        \$retrieved = App\Models\Document::find(\$document->id);
        if (\$retrieved && \$retrieved->file_size > 0) {
            echo '✅ Document retrieval: SUCCESS\n';
        }
        
        // Cleanup
        \$document->delete();
    }
} catch (Exception \$e) {
    echo '❌ Document operations: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 6: Database Performance Tests
echo ""
echo "=== Test 6: Database Performance Tests ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$start = microtime(true);
    
    // Test user query performance
    \$users = DB::table('users')->limit(10)->get();
    \$userTime = (microtime(true) - \$start) * 1000;
    echo '✅ User query: ' . number_format(\$userTime, 2) . 'ms\n';
    
    // Test join query performance
    \$start = microtime(true);
    \$results = DB::table('users')
        ->leftJoin('health_questionnaires', 'users.id', '=', 'health_questionnaires.user_id')
        ->select('users.name', DB::raw('COUNT(health_questionnaires.id) as count'))
        ->groupBy('users.id', 'users.name')
        ->limit(5)
        ->get();
    \$joinTime = (microtime(true) - \$start) * 1000;
    echo '✅ Join query: ' . number_format(\$joinTime, 2) . 'ms\n';
    
    // Test aggregate query
    \$start = microtime(true);
    \$count = DB::table('users')->count();
    \$countTime = (microtime(true) - \$start) * 1000;
    echo '✅ Count query: ' . number_format(\$countTime, 2) . 'ms (Found: ' . \$count . ' users)\n';
    
} catch (Exception \$e) {
    echo '❌ Performance tests: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 7: Foreign Key Constraint Tests
echo ""
echo "=== Test 7: Foreign Key Constraint Tests ==="
docker-compose exec backend php artisan tinker --execute="
try {
    // Test invalid foreign key should fail
    \$questionnaire = new App\Models\HealthQuestionnaire();
    \$questionnaire->user_id = 999999; // Non-existent user
    \$questionnaire->responses = '{}';
    
    try {
        \$questionnaire->save();
        echo '❌ Foreign key constraint: FAILED - Should have prevented invalid user_id\n';
    } catch (Exception \$e) {
        echo '✅ Foreign key constraint: SUCCESS - Prevented invalid user_id\n';
    }
    
} catch (Exception \$e) {
    echo '❌ Foreign key test setup: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 8: Index Performance Test
echo ""
echo "=== Test 8: Index Performance Tests ==="
docker-compose exec backend php artisan tinker --execute="
try {
    // Test indexed email search
    \$start = microtime(true);
    \$user = DB::table('users')->where('email', 'like', '%@%')->first();
    \$emailTime = (microtime(true) - \$start) * 1000;
    echo '✅ Email index query: ' . number_format(\$emailTime, 2) . 'ms\n';
    
    // Test date range query (should use index)
    \$start = microtime(true);
    \$recent = DB::table('health_questionnaires')
        ->where('created_at', '>=', now()->subDays(30))
        ->count();
    \$dateTime = (microtime(true) - \$start) * 1000;
    echo '✅ Date range query: ' . number_format(\$dateTime, 2) . 'ms (Found: ' . \$recent . ' records)\n';
    
} catch (Exception \$e) {
    echo '❌ Index performance: FAILED - ' . \$e->getMessage() . '\n';
}"

echo ""
echo "================================"
echo "🏁 Database Tests Completed!"
echo "================================"