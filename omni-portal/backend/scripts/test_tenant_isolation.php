<?php

require_once 'bootstrap/app.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;
use App\Models\Company;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

echo "🔧 TENANT ISOLATION VALIDATION STARTING...\n";

// Clear any existing test data
echo "📊 Clearing existing test data...\n";
try {
    // For SQLite, we can't use MySQL-specific commands
    $testCompanies = Company::whereIn('name', [
        'TechCorp Test Company', 
        'HealthPlus Test Company', 
        'InnovateNow Test Company'
    ])->pluck('id');
    
    if ($testCompanies->isNotEmpty()) {
        User::whereIn('company_id', $testCompanies)->delete();
        Beneficiary::whereIn('company_id', $testCompanies)->delete();
        Document::whereIn('company_id', $testCompanies)->delete();
        HealthQuestionnaire::whereIn('company_id', $testCompanies)->delete();
        Company::whereIn('id', $testCompanies)->delete();
    }
    
    echo "✅ Test data cleared successfully\n";
} catch (Exception $e) {
    echo "⚠️  Warning cleaning test data: " . $e->getMessage() . "\n";
}

// Create test companies with all required fields
echo "🏢 Creating test companies...\n";
$company1 = Company::create([
    'name' => 'TechCorp Test Company',
    'cnpj' => '12345678000195',
    'email' => 'admin@techcorp-test.com',
    'phone' => '11999887766',
    'address' => 'Rua Test 123',
    'city' => 'São Paulo',
    'state' => 'SP',
    'zip_code' => '01234567',
    'contact_person' => 'Admin Test',
    'contact_email' => 'admin@techcorp-test.com',
    'contact_phone' => '11999887766',
    'is_active' => true
]);

$company2 = Company::create([
    'name' => 'HealthPlus Test Company', 
    'cnpj' => '98765432000198',
    'email' => 'admin@healthplus-test.com',
    'phone' => '11888776655',
    'address' => 'Av Test 456',
    'city' => 'Rio de Janeiro',
    'state' => 'RJ',
    'zip_code' => '02345678',
    'contact_person' => 'Admin Health',
    'contact_email' => 'admin@healthplus-test.com',
    'contact_phone' => '11888776655',
    'is_active' => true
]);

$company3 = Company::create([
    'name' => 'InnovateNow Test Company',
    'cnpj' => '45678912000187',
    'email' => 'admin@innovatenow-test.com',
    'phone' => '11777665544',
    'address' => 'Rua Innovation 789',
    'city' => 'Belo Horizonte',
    'state' => 'MG',
    'zip_code' => '03456789',
    'contact_person' => 'Admin Innovation',
    'contact_email' => 'admin@innovatenow-test.com',
    'contact_phone' => '11777665544',
    'is_active' => true
]);

echo "✅ Created companies: {$company1->id}, {$company2->id}, {$company3->id}\n";

// Create test users for each company
echo "👥 Creating test users...\n";
$users = collect();

// Company 1 users
$user1_admin = User::create([
    'name' => 'Admin TechCorp',
    'email' => 'admin@techcorp-test.com',
    'password' => bcrypt('password123'),
    'company_id' => $company1->id,
    'role' => 'company_admin',
    'cpf' => '11111111111'
]);

$user1_hr = User::create([
    'name' => 'HR TechCorp',
    'email' => 'hr@techcorp-test.com', 
    'password' => bcrypt('password123'),
    'company_id' => $company1->id,
    'role' => 'hr',
    'cpf' => '22222222222'
]);

$user1_employee = User::create([
    'name' => 'Employee TechCorp',
    'email' => 'employee@techcorp-test.com',
    'password' => bcrypt('password123'),
    'company_id' => $company1->id,
    'role' => 'employee',
    'cpf' => '33333333333'
]);

// Company 2 users
$user2_admin = User::create([
    'name' => 'Admin HealthPlus',
    'email' => 'admin@healthplus-test.com',
    'password' => bcrypt('password123'),
    'company_id' => $company2->id,
    'role' => 'company_admin',
    'cpf' => '44444444444'
]);

$user2_employee = User::create([
    'name' => 'Employee HealthPlus',
    'email' => 'employee@healthplus-test.com',
    'password' => bcrypt('password123'),
    'company_id' => $company2->id,
    'role' => 'employee',
    'cpf' => '55555555555'
]);

// Company 3 users
$user3_admin = User::create([
    'name' => 'Admin InnovateNow',
    'email' => 'admin@innovatenow-test.com',
    'password' => bcrypt('password123'),
    'company_id' => $company3->id,
    'role' => 'company_admin',
    'cpf' => '66666666666'
]);

$users = collect([$user1_admin, $user1_hr, $user1_employee, $user2_admin, $user2_employee, $user3_admin]);
echo "✅ Created " . $users->count() . " test users\n";

// Create beneficiaries for each user
echo "🧑‍💼 Creating beneficiaries...\n";
$beneficiaries = collect();

foreach ($users as $user) {
    $beneficiary = Beneficiary::create([
        'user_id' => $user->id,
        'company_id' => $user->company_id,
        'cpf' => $user->cpf,
        'name' => $user->name,
        'email' => $user->email,
        'phone' => '11987654321',
        'birth_date' => '1990-01-01',
        'onboarding_status' => 'in_progress'
    ]);
    $beneficiaries->push($beneficiary);
}

echo "✅ Created " . $beneficiaries->count() . " beneficiaries\n";

// Create health questionnaires
echo "📋 Creating health questionnaires...\n";
foreach ($beneficiaries as $beneficiary) {
    HealthQuestionnaire::create([
        'beneficiary_id' => $beneficiary->id,
        'company_id' => $beneficiary->company_id,
        'questions' => json_encode([
            'height' => rand(160, 190),
            'weight' => rand(60, 100),
            'blood_pressure' => 'normal'
        ]),
        'status' => 'completed',
        'score' => rand(70, 100)
    ]);
}
echo "✅ Created " . $beneficiaries->count() . " health questionnaires\n";

// Create documents
echo "📄 Creating documents...\n";
foreach ($beneficiaries as $beneficiary) {
    Document::create([
        'beneficiary_id' => $beneficiary->id,
        'company_id' => $beneficiary->company_id,
        'document_type' => 'id_document',
        'file_path' => 'test/document_' . $beneficiary->id . '.pdf',
        'file_name' => 'test_document.pdf',
        'status' => 'approved'
    ]);
}
echo "✅ Created " . $beneficiaries->count() . " documents\n";

echo "\n🔍 STARTING TENANT ISOLATION TESTS\n";
echo str_repeat("=", 50) . "\n";

// ===========================================
// TEST 1: TenantScope Automatic Application
// ===========================================
echo "\n📊 TEST 1: TenantScope Automatic Application\n";
echo str_repeat("-", 30) . "\n";

// Login as company 1 admin
Auth::login($user1_admin);
echo "🔐 Logged in as: {$user1_admin->name} (Company: {$user1_admin->company_id})\n";

// Test Users model
$scopedUsers = User::all();
echo "👥 Users visible with TenantScope: " . $scopedUsers->count() . " (Expected: 3)\n";
$companyIds = $scopedUsers->pluck('company_id')->unique()->toArray();
echo "   Company IDs: [" . implode(', ', $companyIds) . "]\n";

if ($scopedUsers->count() === 3 && count($companyIds) === 1 && $companyIds[0] === $company1->id) {
    echo "✅ TenantScope working correctly for Users\n";
} else {
    echo "❌ TenantScope FAILED for Users - Expected 3 users for company {$company1->id}, got " . $scopedUsers->count() . "\n";
}

// Test Beneficiaries model
$scopedBeneficiaries = Beneficiary::all();
echo "🧑‍💼 Beneficiaries visible: " . $scopedBeneficiaries->count() . " (Expected: 3)\n";
$benCompanyIds = $scopedBeneficiaries->pluck('company_id')->unique()->toArray();

if ($scopedBeneficiaries->count() === 3 && count($benCompanyIds) === 1 && $benCompanyIds[0] === $company1->id) {
    echo "✅ TenantScope working correctly for Beneficiaries\n";
} else {
    echo "❌ TenantScope FAILED for Beneficiaries\n";
}

// Test HealthQuestionnaires model
$scopedQuestionnaires = HealthQuestionnaire::all();
echo "📋 Health Questionnaires visible: " . $scopedQuestionnaires->count() . " (Expected: 3)\n";
if ($scopedQuestionnaires->count() === 3) {
    echo "✅ TenantScope working correctly for HealthQuestionnaires\n";
} else {
    echo "❌ TenantScope FAILED for HealthQuestionnaires\n";
}

// Test Documents model
$scopedDocuments = Document::all();
echo "📄 Documents visible: " . $scopedDocuments->count() . " (Expected: 3)\n";
if ($scopedDocuments->count() === 3) {
    echo "✅ TenantScope working correctly for Documents\n";
} else {
    echo "❌ TenantScope FAILED for Documents\n";
}

// ===========================================
// TEST 2: Raw Database vs Scoped Queries
// ===========================================
echo "\n🔍 TEST 2: Raw Database Query Verification\n";
echo str_repeat("-", 30) . "\n";

$totalUsers = DB::table('users')->count();
$totalBeneficiaries = DB::table('beneficiaries')->count(); 
$totalQuestionnaires = DB::table('health_questionnaires')->count();
$totalDocuments = DB::table('documents')->count();

echo "📊 Total records in database:\n";
echo "   Users: {$totalUsers}\n";
echo "   Beneficiaries: {$totalBeneficiaries}\n"; 
echo "   Health Questionnaires: {$totalQuestionnaires}\n";
echo "   Documents: {$totalDocuments}\n";

echo "\n📊 Records accessible via Eloquent (with TenantScope):\n";
echo "   Users: " . User::count() . "\n";
echo "   Beneficiaries: " . Beneficiary::count() . "\n";
echo "   Health Questionnaires: " . HealthQuestionnaire::count() . "\n";
echo "   Documents: " . Document::count() . "\n";

// Show actual SQL being generated
echo "\n🔍 Generated SQL with TenantScope:\n";
echo "   Users Query: " . User::toSql() . "\n";
echo "   Parameters: [" . $user1_admin->company_id . "]\n";

// ===========================================
// TEST 3: Multi-Tenant Switching
// ===========================================
echo "\n🔄 TEST 3: Multi-Tenant Access Verification\n";
echo str_repeat("-", 30) . "\n";

// Switch to company 2 user
Auth::login($user2_admin);
echo "🔐 Switched to: {$user2_admin->name} (Company: {$user2_admin->company_id})\n";

$company2Users = User::all();
echo "👥 Users visible for Company 2: " . $company2Users->count() . " (Expected: 2)\n";
$comp2Ids = $company2Users->pluck('company_id')->unique()->toArray();
echo "   Company IDs: [" . implode(', ', $comp2Ids) . "]\n";

if ($company2Users->count() === 2 && count($comp2Ids) === 1 && $comp2Ids[0] === $company2->id) {
    echo "✅ Tenant switching working correctly\n";
} else {
    echo "❌ Tenant switching FAILED\n";
}

// ===========================================
// TEST 4: WithoutTenant Scope Bypass
// ===========================================
echo "\n🚫 TEST 4: WithoutTenant Scope Bypass\n";
echo str_repeat("-", 30) . "\n";

$allUsersWithoutScope = User::withoutTenant()->get();
echo "👥 All users without tenant scope: " . $allUsersWithoutScope->count() . "\n";
$allCompanyIds = $allUsersWithoutScope->pluck('company_id')->unique()->sort()->values()->toArray();
echo "   Company IDs: [" . implode(', ', $allCompanyIds) . "]\n";

if ($allUsersWithoutScope->count() >= 6) { // Should see all test users plus any existing ones
    echo "✅ WithoutTenant scope bypass working correctly\n";
} else {
    echo "❌ WithoutTenant scope bypass FAILED - Expected at least 6 users, got " . $allUsersWithoutScope->count() . "\n";
}

// ===========================================
// TEST 5: Cross-Tenant Access Prevention
// ===========================================
echo "\n⛔ TEST 5: Cross-Tenant Access Prevention\n";
echo str_repeat("-", 30) . "\n";

// Currently logged as company2 admin, try to access company1 user
try {
    $company1User = User::find($user1_admin->id); // Should be null since we're logged as company2
    if ($company1User === null) {
        echo "✅ Cannot access Company 1 user from Company 2 context\n";
    } else {
        echo "❌ SECURITY BREACH: Can access Company 1 user from Company 2\n";
        echo "   Found user: {$company1User->name} (Company: {$company1User->company_id})\n";
    }
} catch (Exception $e) {
    echo "✅ Exception prevented cross-tenant access: " . $e->getMessage() . "\n";
}

// Test specific beneficiary access
$company1Beneficiary = $beneficiaries->where('company_id', $company1->id)->first();
try {
    $crossTenantBeneficiary = Beneficiary::find($company1Beneficiary->id);
    if ($crossTenantBeneficiary === null) {
        echo "✅ Cannot access Company 1 beneficiary from Company 2 context\n";
    } else {
        echo "❌ SECURITY BREACH: Can access Company 1 beneficiary from Company 2\n";
    }
} catch (Exception $e) {
    echo "✅ Exception prevented cross-tenant beneficiary access\n";
}

// ===========================================
// TEST 6: Automatic Company ID Assignment
// ===========================================
echo "\n➕ TEST 6: Automatic Company ID Assignment\n";
echo str_repeat("-", 30) . "\n";

// Create new beneficiary while logged as company 2 admin
$newBeneficiary = Beneficiary::create([
    'user_id' => $user2_admin->id,
    // Note: NOT setting company_id - should be auto-assigned
    'cpf' => '77777777777',
    'name' => 'Test Auto Assignment',
    'email' => 'test@auto.com',
    'phone' => '11999887766',
    'birth_date' => '1995-05-05',
    'onboarding_status' => 'pending'
]);

echo "🧑‍💼 Created beneficiary with auto-assigned company_id: {$newBeneficiary->company_id}\n";
echo "🔐 Current user company_id: {$user2_admin->company_id}\n";

if ($newBeneficiary->company_id === $user2_admin->company_id) {
    echo "✅ Automatic company_id assignment working\n";
} else {
    echo "❌ Automatic company_id assignment FAILED\n";
}

// ===========================================
// TEST 7: Company ID Modification Prevention
// ===========================================
echo "\n🔒 TEST 7: Company ID Modification Prevention\n";
echo str_repeat("-", 30) . "\n";

try {
    $originalCompanyId = $newBeneficiary->company_id;
    $newBeneficiary->company_id = $company3->id; // Try to change to different company
    $newBeneficiary->save();
    echo "❌ SECURITY BREACH: Successfully changed company_id from {$originalCompanyId} to {$newBeneficiary->company_id}\n";
} catch (Exception $e) {
    echo "✅ Company ID modification prevented: " . $e->getMessage() . "\n";
}

// ===========================================
// TEST 8: Detailed Query Analysis
// ===========================================
echo "\n🔍 TEST 8: Detailed Query Analysis\n";
echo str_repeat("-", 30) . "\n";

// Enable query logging
DB::enableQueryLog();

// Run some queries
Auth::login($user1_admin);
$testUsers = User::where('role', 'company_admin')->get();
$testBeneficiaries = Beneficiary::where('onboarding_status', 'in_progress')->get();

// Show queries
$queries = DB::getQueryLog();
echo "📊 Executed queries:\n";
foreach ($queries as $query) {
    echo "   SQL: " . $query['query'] . "\n";
    echo "   Bindings: [" . implode(', ', $query['bindings']) . "]\n";
    echo "   Time: " . $query['time'] . "ms\n\n";
}

DB::disableQueryLog();

// Final summary
echo "\n" . str_repeat("=", 60) . "\n";
echo "🎯 TENANT ISOLATION VALIDATION SUMMARY\n";
echo str_repeat("=", 60) . "\n";

// Count final state by switching between users
Auth::login($user1_admin);
$company1Final = User::count();
Auth::login($user2_admin);  
$company2Final = User::count();
Auth::login($user3_admin);
$company3Final = User::count();

echo "📊 Final tenant-scoped counts:\n";
echo "   Company 1: {$company1Final} users\n";
echo "   Company 2: {$company2Final} users\n"; 
echo "   Company 3: {$company3Final} users\n";

echo "\n🔍 Database integrity:\n";
$totalDbUsers = DB::table('users')->count();
$sumScoped = $company1Final + $company2Final + $company3Final;
echo "   Total users in DB: {$totalDbUsers}\n";
echo "   Sum of scoped users: {$sumScoped}\n";

if ($sumScoped <= $totalDbUsers) {
    echo "✅ Database integrity maintained - scoped counts are consistent\n";
} else {
    echo "❌ Database integrity issue - scoped counts exceed total\n";
}

// Cleanup test data
echo "\n🧹 Cleaning up test data...\n";
try {
    $testCompanyIds = [$company1->id, $company2->id, $company3->id];
    User::withoutTenant()->whereIn('company_id', $testCompanyIds)->delete();
    Beneficiary::withoutTenant()->whereIn('company_id', $testCompanyIds)->delete();
    Document::withoutTenant()->whereIn('company_id', $testCompanyIds)->delete();
    HealthQuestionnaire::withoutTenant()->whereIn('company_id', $testCompanyIds)->delete();
    Company::whereIn('id', $testCompanyIds)->delete();
    
    echo "✅ Test data cleaned up successfully\n";
} catch (Exception $e) {
    echo "⚠️  Warning during cleanup: " . $e->getMessage() . "\n";
}

echo "\n🏁 TENANT ISOLATION VALIDATION COMPLETED\n";

// Logout
Auth::logout();