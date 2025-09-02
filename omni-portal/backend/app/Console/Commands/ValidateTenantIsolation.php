<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\Company;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ValidateTenantIsolation extends Command
{
    protected $signature = 'tenant:validate-isolation';
    protected $description = 'Validate tenant isolation is working correctly';

    public function handle()
    {
        $this->info('🔧 TENANT ISOLATION VALIDATION STARTING...');
        
        // Clear test data first
        $this->info('📊 Clearing existing test data...');
        $this->clearTestData();
        
        // Create test data
        $companies = $this->createTestData();
        
        // Run validation tests
        $this->runValidationTests($companies);
        
        // Cleanup
        $this->info('🧹 Cleaning up test data...');
        $this->clearTestData();
        
        $this->info('🏁 TENANT ISOLATION VALIDATION COMPLETED');
        
        return 0;
    }
    
    private function clearTestData()
    {
        try {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            
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
            $this->info('✅ Test data cleared successfully');
        } catch (\Exception $e) {
            $this->warn('⚠️  Warning cleaning test data: ' . $e->getMessage());
        }
    }
    
    private function createTestData()
    {
        $this->info('🏢 Creating test companies...');
        
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

        $this->info("✅ Created companies: {$company1->id}, {$company2->id}, {$company3->id}");

        // Create test users
        $this->info('👥 Creating test users...');
        
        $users = collect([
            // Company 1 users
            User::create([
                'name' => 'Admin TechCorp',
                'email' => 'admin@techcorp-test.com',
                'password' => bcrypt('password123'),
                'company_id' => $company1->id,
                'role' => 'company_admin',
                'cpf' => '11111111111'
            ]),
            User::create([
                'name' => 'HR TechCorp',
                'email' => 'hr@techcorp-test.com', 
                'password' => bcrypt('password123'),
                'company_id' => $company1->id,
                'role' => 'hr',
                'cpf' => '22222222222'
            ]),
            User::create([
                'name' => 'Employee TechCorp',
                'email' => 'employee@techcorp-test.com',
                'password' => bcrypt('password123'),
                'company_id' => $company1->id,
                'role' => 'employee',
                'cpf' => '33333333333'
            ]),
            // Company 2 users
            User::create([
                'name' => 'Admin HealthPlus',
                'email' => 'admin@healthplus-test.com',
                'password' => bcrypt('password123'),
                'company_id' => $company2->id,
                'role' => 'company_admin',
                'cpf' => '44444444444'
            ]),
            User::create([
                'name' => 'Employee HealthPlus',
                'email' => 'employee@healthplus-test.com',
                'password' => bcrypt('password123'),
                'company_id' => $company2->id,
                'role' => 'employee',
                'cpf' => '55555555555'
            ]),
            // Company 3 users
            User::create([
                'name' => 'Admin InnovateNow',
                'email' => 'admin@innovatenow-test.com',
                'password' => bcrypt('password123'),
                'company_id' => $company3->id,
                'role' => 'company_admin',
                'cpf' => '66666666666'
            ])
        ]);
        
        $this->info('✅ Created ' . $users->count() . ' test users');

        // Create beneficiaries
        $this->info('🧑‍💼 Creating beneficiaries...');
        foreach ($users as $user) {
            Beneficiary::create([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'cpf' => $user->cpf,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => '11987654321',
                'birth_date' => '1990-01-01',
                'onboarding_status' => 'in_progress'
            ]);
        }
        $this->info('✅ Created ' . $users->count() . ' beneficiaries');

        // Create health questionnaires
        $this->info('📋 Creating health questionnaires...');
        $beneficiaries = Beneficiary::whereIn('company_id', [$company1->id, $company2->id, $company3->id])->get();
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
        $this->info('✅ Created ' . $beneficiaries->count() . ' health questionnaires');

        // Create documents
        $this->info('📄 Creating documents...');
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
        $this->info('✅ Created ' . $beneficiaries->count() . ' documents');
        
        return [
            'company1' => $company1,
            'company2' => $company2, 
            'company3' => $company3,
            'users' => $users
        ];
    }
    
    private function runValidationTests($companies)
    {
        $this->info("\n🔍 STARTING TENANT ISOLATION TESTS");
        $this->info(str_repeat("=", 50));
        
        $company1 = $companies['company1'];
        $company2 = $companies['company2'];
        $company3 = $companies['company3'];
        $users = $companies['users'];
        
        $user1_admin = $users->where('company_id', $company1->id)->where('role', 'company_admin')->first();
        $user2_admin = $users->where('company_id', $company2->id)->where('role', 'company_admin')->first();
        $user3_admin = $users->where('company_id', $company3->id)->where('role', 'company_admin')->first();
        
        // Test 1: TenantScope automatic application
        $this->info("\n📊 TEST 1: TenantScope Automatic Application");
        $this->info(str_repeat("-", 30));
        
        Auth::login($user1_admin);
        $this->info("🔐 Logged in as: {$user1_admin->name} (Company: {$user1_admin->company_id})");
        
        $scopedUsers = User::all();
        $this->info("👥 Users visible with TenantScope: " . $scopedUsers->count() . " (Expected: 3)");
        $companyIds = $scopedUsers->pluck('company_id')->unique()->toArray();
        $this->info("   Company IDs: [" . implode(', ', $companyIds) . "]");
        
        if ($scopedUsers->count() === 3 && $companyIds === [$company1->id]) {
            $this->info("✅ TenantScope working correctly for Users");
        } else {
            $this->error("❌ TenantScope FAILED for Users");
        }
        
        // Test other models
        $scopedBeneficiaries = Beneficiary::all();
        $this->info("🧑‍💼 Beneficiaries visible: " . $scopedBeneficiaries->count() . " (Expected: 3)");
        $benCompanyIds = $scopedBeneficiaries->pluck('company_id')->unique()->toArray();
        
        if ($scopedBeneficiaries->count() === 3 && $benCompanyIds === [$company1->id]) {
            $this->info("✅ TenantScope working correctly for Beneficiaries");
        } else {
            $this->error("❌ TenantScope FAILED for Beneficiaries");
        }
        
        $scopedQuestionnaires = HealthQuestionnaire::all();
        $this->info("📋 Health Questionnaires visible: " . $scopedQuestionnaires->count() . " (Expected: 3)");
        if ($scopedQuestionnaires->count() === 3) {
            $this->info("✅ TenantScope working correctly for HealthQuestionnaires");
        } else {
            $this->error("❌ TenantScope FAILED for HealthQuestionnaires");
        }
        
        $scopedDocuments = Document::all();
        $this->info("📄 Documents visible: " . $scopedDocuments->count() . " (Expected: 3)");
        if ($scopedDocuments->count() === 3) {
            $this->info("✅ TenantScope working correctly for Documents");
        } else {
            $this->error("❌ TenantScope FAILED for Documents");
        }
        
        // Test 2: Raw database vs scoped queries
        $this->info("\n🔍 TEST 2: Raw Database Query Verification");
        $this->info(str_repeat("-", 30));
        
        $totalUsers = DB::table('users')->count();
        $totalBeneficiaries = DB::table('beneficiaries')->count(); 
        $totalQuestionnaires = DB::table('health_questionnaires')->count();
        $totalDocuments = DB::table('documents')->count();

        $this->info("📊 Total records in database:");
        $this->info("   Users: {$totalUsers}");
        $this->info("   Beneficiaries: {$totalBeneficiaries}"); 
        $this->info("   Health Questionnaires: {$totalQuestionnaires}");
        $this->info("   Documents: {$totalDocuments}");

        $this->info("\n📊 Records accessible via Eloquent (with TenantScope):");
        $this->info("   Users: " . User::count());
        $this->info("   Beneficiaries: " . Beneficiary::count());
        $this->info("   Health Questionnaires: " . HealthQuestionnaire::count());
        $this->info("   Documents: " . Document::count());
        
        // Test 3: Multi-tenant switching
        $this->info("\n🔄 TEST 3: Multi-Tenant Access Verification");
        $this->info(str_repeat("-", 30));
        
        Auth::login($user2_admin);
        $this->info("🔐 Switched to: {$user2_admin->name} (Company: {$user2_admin->company_id})");

        $company2Users = User::all();
        $this->info("👥 Users visible for Company 2: " . $company2Users->count() . " (Expected: 2)");
        $comp2Ids = $company2Users->pluck('company_id')->unique()->toArray();
        
        if ($company2Users->count() === 2 && $comp2Ids === [$company2->id]) {
            $this->info("✅ Tenant switching working correctly");
        } else {
            $this->error("❌ Tenant switching FAILED");
        }
        
        // Test 4: withoutTenant bypass
        $this->info("\n🚫 TEST 4: WithoutTenant Scope Bypass");
        $this->info(str_repeat("-", 30));

        $allUsersWithoutScope = User::withoutTenant()->get();
        $this->info("👥 All users without tenant scope: " . $allUsersWithoutScope->count());
        $allCompanyIds = $allUsersWithoutScope->pluck('company_id')->unique()->sort()->values()->toArray();
        $this->info("   Company IDs: [" . implode(', ', $allCompanyIds) . "]");

        if ($allUsersWithoutScope->count() >= 6) { // Should see all test users plus any existing ones
            $this->info("✅ WithoutTenant scope bypass working correctly");
        } else {
            $this->error("❌ WithoutTenant scope bypass FAILED");
        }
        
        // Test 5: Cross-tenant access prevention
        $this->info("\n⛔ TEST 5: Cross-Tenant Access Prevention");
        $this->info(str_repeat("-", 30));

        try {
            $company1User = User::find($user1_admin->id); // Should be null since we're logged as company2
            if ($company1User === null) {
                $this->info("✅ Cannot access Company 1 user from Company 2 context");
            } else {
                $this->error("❌ SECURITY BREACH: Can access Company 1 user from Company 2");
            }
        } catch (\Exception $e) {
            $this->info("✅ Exception prevented cross-tenant access: " . $e->getMessage());
        }
        
        // Test 6: Automatic company_id assignment
        $this->info("\n➕ TEST 6: Automatic Company ID Assignment");
        $this->info(str_repeat("-", 30));

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

        $this->info("🧑‍💼 Created beneficiary with auto-assigned company_id: {$newBeneficiary->company_id}");
        $this->info("🔐 Current user company_id: {$user2_admin->company_id}");

        if ($newBeneficiary->company_id === $user2_admin->company_id) {
            $this->info("✅ Automatic company_id assignment working");
        } else {
            $this->error("❌ Automatic company_id assignment FAILED");
        }
        
        // Test 7: Company ID modification prevention
        $this->info("\n🔒 TEST 7: Company ID Modification Prevention");
        $this->info(str_repeat("-", 30));

        try {
            $newBeneficiary->company_id = $company3->id; // Try to change to different company
            $newBeneficiary->save();
            $this->error("❌ SECURITY BREACH: Successfully changed company_id to different tenant");
        } catch (\Exception $e) {
            $this->info("✅ Company ID modification prevented: " . $e->getMessage());
        }
        
        // Final summary
        $this->info("\n" . str_repeat("=", 60));
        $this->info("🎯 TENANT ISOLATION VALIDATION SUMMARY");
        $this->info(str_repeat("=", 60));

        // Count final state by switching between users
        Auth::login($user1_admin);
        $company1Final = User::count();
        Auth::login($user2_admin);  
        $company2Final = User::count();
        Auth::login($user3_admin);
        $company3Final = User::count();

        $this->info("📊 Final tenant-scoped counts:");
        $this->info("   Company 1: {$company1Final} users");
        $this->info("   Company 2: {$company2Final} users"); 
        $this->info("   Company 3: {$company3Final} users");

        $this->info("\n🔍 Database integrity:");
        $totalDbUsers = DB::table('users')->count();
        $sumScoped = $company1Final + $company2Final + $company3Final;
        $this->info("   Total users in DB: {$totalDbUsers}");
        $this->info("   Sum of scoped users: {$sumScoped}");
        
        if ($sumScoped <= $totalDbUsers) {
            $this->info("✅ Database integrity maintained - scoped counts are consistent");
        } else {
            $this->error("❌ Database integrity issue - scoped counts exceed total");
        }
        
        Auth::logout();
    }
}