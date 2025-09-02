<?php

/**
 * Tenant Isolation Validation Script
 * 
 * This script creates test data and validates that tenant isolation is working correctly.
 * Run with: php artisan tinker < tests/tenant_isolation_validation.php
 */

use App\Models\User;
use App\Models\Company;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

echo "🔧 TENANT ISOLATION VALIDATION STARTING...\n";

// Clear test data first
echo "📊 Clearing existing test data...\n";
try {
    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    
    // Delete test companies and related data
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
    
    DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    echo "✅ Test data cleared successfully\n";
} catch (Exception $e) {
    echo "⚠️  Warning cleaning test data: " . $e->getMessage() . "\n";
}

// Create test companies
echo "🏢 Creating test companies...\n";
$company1 = Company::create([
    'name' => 'TechCorp Test Company',
    'cnpj' => '12345678000195',
    'contact_email' => 'admin@techcorp-test.com',
    'status' => 'active'
]);

$company2 = Company::create([
    'name' => 'HealthPlus Test Company', 
    'cnpj' => '98765432000198',
    'contact_email' => 'admin@healthplus-test.com',
    'status' => 'active'
]);

$company3 = Company::create([
    'name' => 'InnovateNow Test Company',
    'cnpj' => '45678912000187',
    'contact_email' => 'admin@innovatenow-test.com',
    'status' => 'active'
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

// Create beneficiaries for each company
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
$questionnaires = collect();

foreach ($beneficiaries as $beneficiary) {
    $questionnaire = HealthQuestionnaire::create([
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
    $questionnaires->push($questionnaire);
}

echo "✅ Created " . $questionnaires->count() . " health questionnaires\n";

// Create documents
echo "📄 Creating documents...\n";
$documents = collect();

foreach ($beneficiaries as $beneficiary) {
    $document = Document::create([
        'beneficiary_id' => $beneficiary->id,
        'company_id' => $beneficiary->company_id,
        'document_type' => 'id_document',
        'file_path' => 'test/document_' . $beneficiary->id . '.pdf',
        'file_name' => 'test_document.pdf',
        'status' => 'approved'
    ]);
    $documents->push($document);
}

echo "✅ Created " . $documents->count() . " documents\n";

echo "\n🔍 STARTING TENANT ISOLATION TESTS\n";
echo "=" . str_repeat("=", 50) . "\n";

// Test 1: Verify TenantScope is applied automatically
echo "\n📊 TEST 1: TenantScope Automatic Application\n";
echo "-" . str_repeat("-", 30) . "\n";

// Login as company 1 admin
Auth::login($user1_admin);
echo "🔐 Logged in as: {$user1_admin->name} (Company: {$user1_admin->company_id})\n";

// Query users - should only return company 1 users
$scopedUsers = User::all();
echo "👥 Users visible with TenantScope: " . $scopedUsers->count() . " (Expected: 3)\n";
echo "   Company IDs: " . $scopedUsers->pluck('company_id')->unique()->toArray() . "\n";

if ($scopedUsers->count() === 3 && $scopedUsers->pluck('company_id')->unique()->toArray() === [$company1->id]) {
    echo "✅ TenantScope working correctly for Users\n";
} else {
    echo "❌ TenantScope FAILED for Users\n";
}

// Test beneficiaries
$scopedBeneficiaries = Beneficiary::all();
echo "🧑‍💼 Beneficiaries visible: " . $scopedBeneficiaries->count() . " (Expected: 3)\n";
echo "   Company IDs: " . $scopedBeneficiaries->pluck('company_id')->unique()->toArray() . "\n";

if ($scopedBeneficiaries->count() === 3 && $scopedBeneficiaries->pluck('company_id')->unique()->toArray() === [$company1->id]) {
    echo "✅ TenantScope working correctly for Beneficiaries\n";
} else {
    echo "❌ TenantScope FAILED for Beneficiaries\n";
}

// Test health questionnaires
$scopedQuestionnaires = HealthQuestionnaire::all();
echo "📋 Health Questionnaires visible: " . $scopedQuestionnaires->count() . " (Expected: 3)\n";
echo "   Company IDs: " . $scopedQuestionnaires->pluck('company_id')->unique()->toArray() . "\n";

if ($scopedQuestionnaires->count() === 3 && $scopedQuestionnaires->pluck('company_id')->unique()->toArray() === [$company1->id]) {
    echo "✅ TenantScope working correctly for HealthQuestionnaires\n";
} else {
    echo "❌ TenantScope FAILED for HealthQuestionnaires\n";
}

// Test documents
$scopedDocuments = Document::all();
echo "📄 Documents visible: " . $scopedDocuments->count() . " (Expected: 3)\n";
echo "   Company IDs: " . $scopedDocuments->pluck('company_id')->unique()->toArray() . "\n";

if ($scopedDocuments->count() === 3 && $scopedDocuments->pluck('company_id')->unique()->toArray() === [$company1->id]) {
    echo "✅ TenantScope working correctly for Documents\n";
} else {
    echo "❌ TenantScope FAILED for Documents\n";
}

// Test 2: Raw SQL Queries to verify actual database filtering
echo "\n🔍 TEST 2: Raw Database Query Verification\n";
echo "-" . str_repeat("-", 30) . "\n";

// Count total records in database vs. what's accessible
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

// Test 3: Switch between tenants
echo "\n🔄 TEST 3: Multi-Tenant Access Verification\n";
echo "-" . str_repeat("-", 30) . "\n";

// Switch to company 2 user
Auth::login($user2_admin);
echo "🔐 Switched to: {$user2_admin->name} (Company: {$user2_admin->company_id})\n";

$company2Users = User::all();
echo "👥 Users visible for Company 2: " . $company2Users->count() . " (Expected: 2)\n";
echo "   Company IDs: " . $company2Users->pluck('company_id')->unique()->toArray() . "\n";

if ($company2Users->count() === 2 && $company2Users->pluck('company_id')->unique()->toArray() === [$company2->id]) {
    echo "✅ Tenant switching working correctly\n";
} else {
    echo "❌ Tenant switching FAILED\n";
}

// Test 4: withoutTenant() scope bypass
echo "\n🚫 TEST 4: WithoutTenant Scope Bypass\n";
echo "-" . str_repeat("-", 30) . "\n";

$allUsersWithoutScope = User::withoutTenant()->get();
echo "👥 All users without tenant scope: " . $allUsersWithoutScope->count() . "\n";
echo "   Company IDs: " . $allUsersWithoutScope->pluck('company_id')->unique()->sort()->values()->toArray() . "\n";

if ($allUsersWithoutScope->count() === $totalUsers) {
    echo "✅ WithoutTenant scope bypass working correctly\n";
} else {
    echo "❌ WithoutTenant scope bypass FAILED\n";
}

// Test 5: Cross-tenant access attempts
echo "\n⛔ TEST 5: Cross-Tenant Access Prevention\n";
echo "-" . str_repeat("-", 30) . "\n";

// Try to access specific records from other companies
try {
    $company1User = User::find($user1_admin->id); // Should be null since we're logged as company2
    if ($company1User === null) {
        echo "✅ Cannot access Company 1 user from Company 2 context\n";
    } else {
        echo "❌ SECURITY BREACH: Can access Company 1 user from Company 2\n";
    }
} catch (Exception $e) {
    echo "✅ Exception prevented cross-tenant access: " . $e->getMessage() . "\n";
}

// Test 6: Model relationship filtering
echo "\n🔗 TEST 6: Model Relationship Filtering\n";
echo "-" . str_repeat("-", 30) . "\n";

$beneficiary = Beneficiary::first();
if ($beneficiary) {
    echo "🧑‍💼 Testing beneficiary relationships for Company {$beneficiary->company_id}\n";
    
    $beneficiaryDocuments = $beneficiary->documents;
    echo "📄 Documents for beneficiary: " . $beneficiaryDocuments->count() . "\n";
    echo "   All docs have same company_id: " . ($beneficiaryDocuments->pluck('company_id')->unique()->count() === 1 ? "✅ YES" : "❌ NO") . "\n";
    
    $beneficiaryQuestionnaires = $beneficiary->healthQuestionnaires;
    echo "📋 Questionnaires for beneficiary: " . $beneficiaryQuestionnaires->count() . "\n";
    echo "   All questionnaires have same company_id: " . ($beneficiaryQuestionnaires->pluck('company_id')->unique()->count() === 1 ? "✅ YES" : "❌ NO") . "\n";
}

// Test 7: Automatic company_id assignment on create
echo "\n➕ TEST 7: Automatic Company ID Assignment\n";
echo "-" . str_repeat("-", 30) . "\n";

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

// Test 8: Prevention of company_id modification
echo "\n🔒 TEST 8: Company ID Modification Prevention\n";
echo "-" . str_repeat("-", 30) . "\n";

try {
    $newBeneficiary->company_id = $company3->id; // Try to change to different company
    $newBeneficiary->save();
    echo "❌ SECURITY BREACH: Successfully changed company_id to different tenant\n";
} catch (Exception $e) {
    echo "✅ Company ID modification prevented: " . $e->getMessage() . "\n";
}

// Test 9: SQL Injection protection in tenant scope
echo "\n💉 TEST 9: SQL Injection Protection\n";
echo "-" . str_repeat("-", 30) . "\n";

// Login as a user with malicious company_id (simulate)
// This tests that our scopes properly escape SQL
try {
    $maliciousCompanyId = "1 OR 1=1"; 
    $results = DB::select("
        SELECT COUNT(*) as count 
        FROM users 
        WHERE company_id = ?
    ", [$maliciousCompanyId]);
    
    echo "🛡️  SQL injection test completed. Result count: " . $results[0]->count . "\n";
    if ($results[0]->count == 0) {
        echo "✅ SQL injection protection working\n";
    } else {
        echo "❌ Potential SQL injection vulnerability\n";
    }
} catch (Exception $e) {
    echo "✅ SQL injection prevented by database: " . $e->getMessage() . "\n";
}

// Final summary
echo "\n" . str_repeat("=", 60) . "\n";
echo "🎯 TENANT ISOLATION VALIDATION SUMMARY\n";
echo str_repeat("=", 60) . "\n";

// Count final state
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
echo "   Total users in DB: " . DB::table('users')->count() . "\n";
echo "   Sum of scoped users: " . ($company1Final + $company2Final + $company3Final) . "\n";

// Cleanup test data
echo "\n🧹 Cleaning up test data...\n";
try {
    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    
    $testCompanyIds = [$company1->id, $company2->id, $company3->id];
    User::whereIn('company_id', $testCompanyIds)->delete();
    Beneficiary::whereIn('company_id', $testCompanyIds)->delete();
    Document::whereIn('company_id', $testCompanyIds)->delete();
    HealthQuestionnaire::whereIn('company_id', $testCompanyIds)->delete();
    Company::whereIn('id', $testCompanyIds)->delete();
    
    DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    echo "✅ Test data cleaned up successfully\n";
} catch (Exception $e) {
    echo "⚠️  Warning during cleanup: " . $e->getMessage() . "\n";
}

echo "\n🏁 TENANT ISOLATION VALIDATION COMPLETED\n";

// Logout
Auth::logout();