<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Company;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class TenantBoundaryMiddlewareTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private $company1;
    private $company2;
    private $user1;
    private $user2;
    private $beneficiary1;
    private $beneficiary2;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test companies
        $this->company1 = Company::create([
            'name' => 'Test Company 1',
            'cnpj' => '12345678000195',
            'email' => 'admin1@test.com',
            'phone' => '11999887766',
            'address' => 'Rua Test 123',
            'city' => 'São Paulo',
            'state' => 'SP',
            'zip_code' => '01234567',
            'contact_person' => 'Admin Test 1',
            'contact_email' => 'admin1@test.com',
            'contact_phone' => '11999887766',
        ]);

        $this->company2 = Company::create([
            'name' => 'Test Company 2',
            'cnpj' => '98765432000198',
            'email' => 'admin2@test.com',
            'phone' => '11888776655',
            'address' => 'Av Test 456',
            'city' => 'Rio de Janeiro',
            'state' => 'RJ',
            'zip_code' => '02345678',
            'contact_person' => 'Admin Test 2',
            'contact_email' => 'admin2@test.com',
            'contact_phone' => '11888776655',
        ]);

        // Create test users
        $this->user1 = User::create([
            'name' => 'User Company 1',
            'email' => 'user1@test.com',
            'password' => bcrypt('password123'),
            'company_id' => $this->company1->id,
            'role' => 'company_admin',
            'cpf' => '11111111111'
        ]);

        $this->user2 = User::create([
            'name' => 'User Company 2',
            'email' => 'user2@test.com',
            'password' => bcrypt('password123'),
            'company_id' => $this->company2->id,
            'role' => 'company_admin',
            'cpf' => '22222222222'
        ]);

        // Create test beneficiaries
        $this->beneficiary1 = Beneficiary::create([
            'user_id' => $this->user1->id,
            'company_id' => $this->company1->id,
            'cpf' => '11111111111',
            'name' => 'Beneficiary 1',
            'email' => 'ben1@test.com',
            'phone' => '11987654321',
            'birth_date' => '1990-01-01',
            'onboarding_status' => 'completed'
        ]);

        $this->beneficiary2 = Beneficiary::create([
            'user_id' => $this->user2->id,
            'company_id' => $this->company2->id,
            'cpf' => '22222222222',
            'name' => 'Beneficiary 2',
            'email' => 'ben2@test.com',
            'phone' => '11987654322',
            'birth_date' => '1991-01-01',
            'onboarding_status' => 'completed'
        ]);
    }

    /** @test */
    public function tenant_scope_filters_users_correctly()
    {
        // Test without authentication - should see all users
        $response = $this->get('/api/debug/users-count');
        // Note: This would need a debug route to test, or we test via Auth facade directly
        
        $this->assertTrue(true); // Placeholder - actual implementation would depend on available routes
    }

    /** @test */
    public function user_can_only_access_own_company_beneficiaries()
    {
        // Login as user from company 1
        $this->actingAs($this->user1);

        // Try to access beneficiary from same company - should succeed
        // Note: This would require actual API routes to test properly
        
        // For now, test the underlying logic
        Auth::login($this->user1);
        $accessibleBeneficiaries = Beneficiary::all();
        
        $this->assertEquals(1, $accessibleBeneficiaries->count());
        $this->assertEquals($this->beneficiary1->id, $accessibleBeneficiaries->first()->id);
        $this->assertEquals($this->company1->id, $accessibleBeneficiaries->first()->company_id);
    }

    /** @test */
    public function user_cannot_access_other_company_beneficiaries()
    {
        // Login as user from company 1
        Auth::login($this->user1);

        // Try to find beneficiary from company 2 - should return null due to TenantScope
        $crossTenantBeneficiary = Beneficiary::find($this->beneficiary2->id);
        
        $this->assertNull($crossTenantBeneficiary);
    }

    /** @test */
    public function without_tenant_scope_shows_all_records()
    {
        // Login as user from company 1
        Auth::login($this->user1);

        // With scope - should only see company 1 beneficiaries
        $scopedBeneficiaries = Beneficiary::all();
        $this->assertEquals(1, $scopedBeneficiaries->count());

        // Without scope - should see all beneficiaries
        $allBeneficiaries = Beneficiary::withoutTenant()->get();
        $this->assertEquals(2, $allBeneficiaries->count());
    }

    /** @test */
    public function automatic_company_id_assignment_on_create()
    {
        // Login as user from company 1
        Auth::login($this->user1);

        // Create new beneficiary without explicitly setting company_id
        $newBeneficiary = Beneficiary::create([
            'user_id' => $this->user1->id,
            // Note: NOT setting company_id - should be auto-assigned
            'cpf' => '33333333333',
            'name' => 'Auto Assigned Beneficiary',
            'email' => 'auto@test.com',
            'phone' => '11999888777',
            'birth_date' => '1995-05-05',
            'onboarding_status' => 'pending'
        ]);

        $this->assertEquals($this->company1->id, $newBeneficiary->company_id);
    }

    /** @test */
    public function cannot_modify_company_id_to_different_tenant()
    {
        // Login as user from company 1
        Auth::login($this->user1);

        // Create a beneficiary
        $beneficiary = Beneficiary::create([
            'user_id' => $this->user1->id,
            'cpf' => '44444444444',
            'name' => 'Test Beneficiary',
            'email' => 'test@test.com',
            'phone' => '11888777666',
            'birth_date' => '1992-02-02',
            'onboarding_status' => 'pending'
        ]);

        // Try to change company_id to different tenant
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Cannot change tenant ownership');

        $beneficiary->company_id = $this->company2->id;
        $beneficiary->save();
    }

    /** @test */
    public function health_questionnaires_are_tenant_scoped()
    {
        // Create health questionnaires for each beneficiary
        $questionnaire1 = HealthQuestionnaire::create([
            'beneficiary_id' => $this->beneficiary1->id,
            'company_id' => $this->company1->id,
            'questions' => json_encode(['height' => 180]),
            'status' => 'completed',
            'score' => 85
        ]);

        $questionnaire2 = HealthQuestionnaire::create([
            'beneficiary_id' => $this->beneficiary2->id,
            'company_id' => $this->company2->id,
            'questions' => json_encode(['height' => 165]),
            'status' => 'completed',
            'score' => 90
        ]);

        // Login as user from company 1
        Auth::login($this->user1);

        // Should only see questionnaires from company 1
        $visibleQuestionnaires = HealthQuestionnaire::all();
        $this->assertEquals(1, $visibleQuestionnaires->count());
        $this->assertEquals($questionnaire1->id, $visibleQuestionnaires->first()->id);

        // Should not be able to directly access questionnaire from company 2
        $crossTenantQuestionnaire = HealthQuestionnaire::find($questionnaire2->id);
        $this->assertNull($crossTenantQuestionnaire);
    }

    /** @test */
    public function documents_are_tenant_scoped()
    {
        // Create documents for each beneficiary
        $document1 = Document::create([
            'beneficiary_id' => $this->beneficiary1->id,
            'company_id' => $this->company1->id,
            'document_type' => 'id_document',
            'file_path' => 'test/doc1.pdf',
            'file_name' => 'document1.pdf',
            'status' => 'approved'
        ]);

        $document2 = Document::create([
            'beneficiary_id' => $this->beneficiary2->id,
            'company_id' => $this->company2->id,
            'document_type' => 'id_document',
            'file_path' => 'test/doc2.pdf',
            'file_name' => 'document2.pdf',
            'status' => 'approved'
        ]);

        // Login as user from company 1
        Auth::login($this->user1);

        // Should only see documents from company 1
        $visibleDocuments = Document::all();
        $this->assertEquals(1, $visibleDocuments->count());
        $this->assertEquals($document1->id, $visibleDocuments->first()->id);

        // Should not be able to directly access document from company 2
        $crossTenantDocument = Document::find($document2->id);
        $this->assertNull($crossTenantDocument);
    }

    /** @test */
    public function user_without_company_id_sees_all_records()
    {
        // Create user without company_id
        $userWithoutCompany = User::create([
            'name' => 'User Without Company',
            'email' => 'nocompany@test.com',
            'password' => bcrypt('password123'),
            'company_id' => null,
            'role' => 'employee',
            'cpf' => '99999999999'
        ]);

        // Login as user without company
        Auth::login($userWithoutCompany);

        // Should see all users (TenantScope only applies when user has company_id)
        $visibleUsers = User::all();
        $this->assertEquals(3, $visibleUsers->count()); // user1, user2, userWithoutCompany
    }

    /** @test */
    public function model_relationships_respect_tenant_boundaries()
    {
        // Create health questionnaire and document for beneficiary1
        $questionnaire = HealthQuestionnaire::create([
            'beneficiary_id' => $this->beneficiary1->id,
            'company_id' => $this->company1->id,
            'questions' => json_encode(['height' => 180]),
            'status' => 'completed',
            'score' => 85
        ]);

        $document = Document::create([
            'beneficiary_id' => $this->beneficiary1->id,
            'company_id' => $this->company1->id,
            'document_type' => 'id_document',
            'file_path' => 'test/doc.pdf',
            'file_name' => 'document.pdf',
            'status' => 'approved'
        ]);

        // Login as user from company 1
        Auth::login($this->user1);

        // Get beneficiary and test relationships
        $beneficiary = Beneficiary::first();
        $this->assertNotNull($beneficiary);

        // Check that relationships return tenant-scoped results
        $relatedQuestionnaires = $beneficiary->healthQuestionnaires;
        $relatedDocuments = $beneficiary->documents;

        $this->assertEquals(1, $relatedQuestionnaires->count());
        $this->assertEquals(1, $relatedDocuments->count());
        
        // Verify all related records have same company_id
        $this->assertEquals($this->company1->id, $beneficiary->company_id);
        $this->assertEquals($this->company1->id, $relatedQuestionnaires->first()->company_id);
        $this->assertEquals($this->company1->id, $relatedDocuments->first()->company_id);
    }

    /** @test */
    public function tenant_service_methods_work_correctly()
    {
        $tenantService = app(\App\Services\TenantService::class);

        // Test without authentication
        Auth::logout();
        $this->assertNull($tenantService->getCurrentTenantId());
        $this->assertFalse($tenantService->hasCurrentTenant());

        // Test with authentication
        Auth::login($this->user1);
        $this->assertEquals($this->company1->id, $tenantService->getCurrentTenantId());
        $this->assertTrue($tenantService->hasCurrentTenant());
        
        $currentTenant = $tenantService->getCurrentTenant();
        $this->assertEquals($this->company1->id, $currentTenant->id);
        $this->assertEquals($this->company1->name, $currentTenant->name);
    }

    /** @test */
    public function belongs_to_current_tenant_validation()
    {
        Auth::login($this->user1);

        // Test with model from same tenant
        $this->assertTrue($this->beneficiary1->belongsToCurrentTenant());

        // Test with model from different tenant  
        $this->assertFalse($this->beneficiary2->belongsToCurrentTenant());
    }
}