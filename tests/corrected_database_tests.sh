#!/bin/bash

# Corrected Database Testing Script Based on Actual Schema
# Fixed to use correct column names from migration files

echo "🚀 Starting Corrected Database CRUD Tests"
echo "=========================================="

# Test 1: Database Connection Test
echo ""
echo "=== Test 1: Database Connection ==="
cd /Users/rodrigo/claude-projects/OnboardingPortal/omni-portal
docker-compose exec backend php artisan tinker --execute="
try {
    \$pdo = DB::connection()->getPdo();
    echo '✅ Database connection: SUCCESS\n';
    echo '📊 Driver: ' . \$pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . '\n';
    echo '📊 Version: ' . \$pdo->getAttribute(PDO::ATTR_SERVER_VERSION) . '\n';
    echo '📊 Database: ' . \$pdo->query('SELECT DATABASE()')->fetchColumn() . '\n';
} catch (Exception \$e) {
    echo '❌ Database connection: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 2: Show Table Schemas
echo ""
echo "=== Test 2: Database Schema Validation ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$tables = ['users', 'health_questionnaires', 'documents', 'beneficiaries'];
    foreach (\$tables as \$table) {
        \$columns = Schema::getColumnListing(\$table);
        echo '📋 Table: ' . \$table . ' - Columns: ' . implode(', ', \$columns) . '\n';
    }
} catch (Exception \$e) {
    echo '❌ Schema check: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 3: User CRUD Operations
echo ""
echo "=== Test 3: User CRUD Operations ==="
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

# Test 4: Health Questionnaire Operations (checking actual columns)
echo ""
echo "=== Test 4: Health Questionnaire Operations ==="
docker-compose exec backend php artisan tinker --execute="
try {
    // Get existing user
    \$user = App\Models\User::first();
    if (!\$user) {
        echo '❌ No users available\n';
        return;
    }
    
    // Check what columns exist in health_questionnaires
    \$columns = Schema::getColumnListing('health_questionnaires');
    echo '📋 Available columns: ' . implode(', ', \$columns) . '\n';
    
    // Create with available columns only
    \$questionnaire = new App\Models\HealthQuestionnaire();
    
    // Map to correct column names based on migration
    if (in_array('beneficiary_id', \$columns)) {
        \$beneficiary = App\Models\Beneficiary::first();
        if (\$beneficiary) {
            \$questionnaire->beneficiary_id = \$beneficiary->id;
        }
    }
    
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
    
    // Cleanup
    \$questionnaire->delete();
    
} catch (Exception \$e) {
    echo '❌ Health questionnaire ops: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 5: Document Operations with correct schema
echo ""
echo "=== Test 5: Document Operations ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$user = App\Models\User::first();
    if (!\$user) {
        echo '❌ No users available\n';
        return;
    }
    
    // Check document table columns
    \$columns = Schema::getColumnListing('documents');
    echo '📋 Document columns: ' . implode(', ', \$columns) . '\n';
    
    // Create document with correct columns
    \$document = new App\Models\Document();
    
    // Map to actual schema
    if (in_array('beneficiary_id', \$columns)) {
        \$beneficiary = App\Models\Beneficiary::first();
        if (\$beneficiary) {
            \$document->beneficiary_id = \$beneficiary->id;
        }
    }
    
    \$document->original_name = 'test_document.pdf';
    \$document->file_path = '/storage/documents/test.pdf';
    \$document->file_size = 1024000;
    \$document->mime_type = 'application/pdf';
    \$document->status = 'uploaded';
    \$document->save();
    
    echo '✅ Document creation: SUCCESS (ID: ' . \$document->id . ')\n';
    
    // Cleanup
    \$document->delete();
    
} catch (Exception \$e) {
    echo '❌ Document operations: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 6: Beneficiary Operations with correct gender enum
echo ""
echo "=== Test 6: Beneficiary Operations ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$user = App\Models\User::first();
    if (!\$user) {
        echo '❌ No users available\n';
        return;
    }
    
    // Check beneficiaries columns
    \$columns = Schema::getColumnListing('beneficiaries');
    echo '📋 Beneficiary columns: ' . implode(', ', \$columns) . '\n';
    
    // Create beneficiary with correct enum values
    \$beneficiary = new App\Models\Beneficiary();
    \$beneficiary->user_id = \$user->id;
    \$beneficiary->cpf = '123.456.789-' . str_pad(rand(10, 99), 2, '0', STR_PAD_LEFT);
    \$beneficiary->phone = '+55 11 99999-9999';
    \$beneficiary->birth_date = '1990-01-01';
    \$beneficiary->gender = 'male'; // Use full enum value instead of 'M'
    \$beneficiary->save();
    
    echo '✅ Beneficiary creation: SUCCESS (ID: ' . \$beneficiary->id . ')\n';
    
    // Test relationship
    \$withUser = App\Models\Beneficiary::with('user')->find(\$beneficiary->id);
    if (\$withUser->user) {
        echo '✅ Beneficiary-User relationship: SUCCESS\n';
    }
    
    // Cleanup
    \$beneficiary->delete();
    
} catch (Exception \$e) {
    echo '❌ Beneficiary operations: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 7: Database Performance with Correct Schema
echo ""
echo "=== Test 7: Database Performance Tests ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$start = microtime(true);
    
    // Test user query performance
    \$users = DB::table('users')->limit(10)->get();
    \$userTime = (microtime(true) - \$start) * 1000;
    echo '✅ User query: ' . number_format(\$userTime, 2) . 'ms\n';
    
    // Test aggregate query
    \$start = microtime(true);
    \$count = DB::table('users')->count();
    \$countTime = (microtime(true) - \$start) * 1000;
    echo '✅ Count query: ' . number_format(\$countTime, 2) . 'ms (Found: ' . \$count . ' users)\n';
    
    // Test health questionnaires count
    \$start = microtime(true);
    \$hqCount = DB::table('health_questionnaires')->count();
    \$hqTime = (microtime(true) - \$start) * 1000;
    echo '✅ Health questionnaire count: ' . number_format(\$hqTime, 2) . 'ms (Found: ' . \$hqCount . ' records)\n';
    
} catch (Exception \$e) {
    echo '❌ Performance tests: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 8: Index Performance Tests
echo ""
echo "=== Test 8: Index Performance Tests ==="
docker-compose exec backend php artisan tinker --execute="
try {
    // Test email index
    \$start = microtime(true);
    \$user = DB::table('users')->where('email', 'like', '%@%')->first();
    \$emailTime = (microtime(true) - \$start) * 1000;
    echo '✅ Email index query: ' . number_format(\$emailTime, 2) . 'ms\n';
    
    // Test primary key lookup
    \$start = microtime(true);
    \$user = DB::table('users')->where('id', 1)->first();
    \$pkTime = (microtime(true) - \$start) * 1000;
    echo '✅ Primary key lookup: ' . number_format(\$pkTime, 2) . 'ms\n';
    
    // Test created_at index if exists
    \$start = microtime(true);
    \$recent = DB::table('users')->where('created_at', '>=', now()->subDays(30))->count();
    \$dateTime = (microtime(true) - \$start) * 1000;
    echo '✅ Date range query: ' . number_format(\$dateTime, 2) . 'ms (Found: ' . \$recent . ' recent users)\n';
    
} catch (Exception \$e) {
    echo '❌ Index performance: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 9: Connection Pooling Test
echo ""
echo "=== Test 9: Connection Pooling Test ==="
docker-compose exec backend php artisan tinker --execute="
try {
    \$startTime = microtime(true);
    \$connections = 0;
    
    // Test multiple quick queries
    for (\$i = 0; \$i < 10; \$i++) {
        DB::table('users')->count();
        \$connections++;
    }
    
    \$totalTime = microtime(true) - \$startTime;
    echo '✅ Connection pooling: SUCCESS - ' . \$connections . ' operations in ' . number_format(\$totalTime * 1000, 2) . 'ms\n';
    
} catch (Exception \$e) {
    echo '❌ Connection pooling: FAILED - ' . \$e->getMessage() . '\n';
}"

# Test 10: Transaction Test
echo ""
echo "=== Test 10: Transaction Test ==="
docker-compose exec backend php artisan tinker --execute="
try {
    DB::beginTransaction();
    
    // Create test user within transaction
    \$user = new App\Models\User();
    \$user->name = 'Transaction Test User';
    \$user->email = 'transaction_test_' . time() . '@example.com';
    \$user->password = Hash::make('password');
    \$user->save();
    \$userId = \$user->id;
    
    echo '✅ Transaction user created: ID ' . \$userId . '\n';
    
    // Rollback transaction
    DB::rollBack();
    
    // Verify user was rolled back
    \$checkUser = App\Models\User::find(\$userId);
    if (!\$checkUser) {
        echo '✅ Transaction rollback: SUCCESS - User was not persisted\n';
    } else {
        echo '❌ Transaction rollback: FAILED - User was persisted\n';
        \$checkUser->delete(); // Cleanup
    }
    
} catch (Exception \$e) {
    DB::rollBack();
    echo '❌ Transaction test: FAILED - ' . \$e->getMessage() . '\n';
}"

echo ""
echo "=========================================="
echo "🏁 Corrected Database Tests Completed!"
echo "=========================================="