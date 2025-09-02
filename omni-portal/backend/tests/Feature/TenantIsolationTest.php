<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Company;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Laravel\Sanctum\Sanctum;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private $company1;
    private $company2;
    private $user1;
    private $user2;
    private $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        // Create two companies
        $this->company1 = Company::factory()->create(['name' => 'Company 1']);
        $this->company2 = Company::factory()->create(['name' => 'Company 2']);

        // Create users for each company
        $this->user1 = User::factory()->create([
            'company_id' => $this->company1->id,
            'role' => 'company_admin'
        ]);

        $this->user2 = User::factory()->create([
            'company_id' => $this->company2->id,
            'role' => 'company_admin'
        ]);

        // Create super admin
        $this->superAdmin = User::factory()->create([
            'company_id' => null,
            'role' => 'super_admin'
        ]);
        $this->superAdmin->assignRole('super-admin');
    }

    /** @test */
    public function users_can_only_see_their_company_beneficiaries()
    {
        // Create beneficiaries for each company
        $beneficiary1 = Beneficiary::factory()->create([
            'company_id' => $this->company1->id,
            'user_id' => $this->user1->id
        ]);

        $beneficiary2 = Beneficiary::factory()->create([
            'company_id' => $this->company2->id,
            'user_id' => $this->user2->id
        ]);

        // User 1 should only see Company 1 beneficiaries
        Sanctum::actingAs($this->user1);
        
        $this->assertTrue(
            Beneficiary::where('id', $beneficiary1->id)->exists(),
            'User should see their company beneficiary'
        );

        $this->assertFalse(
            Beneficiary::where('id', $beneficiary2->id)->exists(),
            'User should not see other company beneficiary'
        );
    }

    /** @test */
    public function documents_are_tenant_isolated()
    {
        $beneficiary1 = Beneficiary::factory()->create([
            'company_id' => $this->company1->id,
            'user_id' => $this->user1->id
        ]);

        $beneficiary2 = Beneficiary::factory()->create([
            'company_id' => $this->company2->id,
            'user_id' => $this->user2->id
        ]);

        // Create documents for each beneficiary
        $document1 = Document::factory()->create([
            'beneficiary_id' => $beneficiary1->id,
            'company_id' => $this->company1->id,
            'uploaded_by' => $this->user1->id
        ]);

        $document2 = Document::factory()->create([
            'beneficiary_id' => $beneficiary2->id,
            'company_id' => $this->company2->id,
            'uploaded_by' => $this->user2->id
        ]);

        // User 1 should only see Company 1 documents
        Sanctum::actingAs($this->user1);
        
        $this->assertTrue(
            Document::where('id', $document1->id)->exists(),
            'User should see their company document'
        );

        $this->assertFalse(
            Document::where('id', $document2->id)->exists(),
            'User should not see other company document'
        );
    }

    /** @test */
    public function health_questionnaires_are_tenant_isolated()
    {
        $beneficiary1 = Beneficiary::factory()->create([
            'company_id' => $this->company1->id,
            'user_id' => $this->user1->id
        ]);

        $beneficiary2 = Beneficiary::factory()->create([
            'company_id' => $this->company2->id,
            'user_id' => $this->user2->id
        ]);

        // Create health questionnaires for each beneficiary
        $questionnaire1 = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $beneficiary1->id,
            'company_id' => $this->company1->id
        ]);

        $questionnaire2 = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $beneficiary2->id,
            'company_id' => $this->company2->id
        ]);

        // User 1 should only see Company 1 questionnaires
        Sanctum::actingAs($this->user1);
        
        $this->assertTrue(
            HealthQuestionnaire::where('id', $questionnaire1->id)->exists(),
            'User should see their company questionnaire'
        );

        $this->assertFalse(
            HealthQuestionnaire::where('id', $questionnaire2->id)->exists(),
            'User should not see other company questionnaire'
        );
    }

    /** @test */
    public function super_admin_can_see_all_tenant_data()
    {
        $beneficiary1 = Beneficiary::factory()->create([
            'company_id' => $this->company1->id,
            'user_id' => $this->user1->id
        ]);

        $beneficiary2 = Beneficiary::factory()->create([
            'company_id' => $this->company2->id,
            'user_id' => $this->user2->id
        ]);

        // Super admin should see all beneficiaries
        Sanctum::actingAs($this->superAdmin);
        
        $this->assertTrue(
            Beneficiary::withoutTenant()->where('id', $beneficiary1->id)->exists(),
            'Super admin should see Company 1 beneficiary'
        );

        $this->assertTrue(
            Beneficiary::withoutTenant()->where('id', $beneficiary2->id)->exists(),
            'Super admin should see Company 2 beneficiary'
        );
    }

    /** @test */
    public function tenant_boundary_middleware_blocks_cross_tenant_access()
    {
        $beneficiary1 = Beneficiary::factory()->create([
            'company_id' => $this->company1->id,
            'user_id' => $this->user1->id
        ]);

        $beneficiary2 = Beneficiary::factory()->create([
            'company_id' => $this->company2->id,
            'user_id' => $this->user2->id
        ]);

        // User 1 trying to access Company 2 beneficiary should be blocked
        Sanctum::actingAs($this->user1);
        
        $response = $this->getJson("/api/beneficiaries/{$beneficiary2->id}");
        
        $response->assertStatus(403);
        $response->assertJson(['message' => 'Access denied: Resource belongs to different tenant']);
    }

    /** @test */
    public function models_automatically_assign_company_id_on_creation()
    {
        Sanctum::actingAs($this->user1);
        
        $beneficiary = Beneficiary::create([
            'user_id' => $this->user1->id,
            'full_name' => 'Test Beneficiary',
            'cpf' => '12345678901',
            'birth_date' => '1990-01-01'
        ]);
        
        $this->assertEquals($this->company1->id, $beneficiary->company_id);
    }

    /** @test */
    public function cannot_change_company_id_to_different_tenant()
    {
        $beneficiary = Beneficiary::factory()->create([
            'company_id' => $this->company1->id,
            'user_id' => $this->user1->id
        ]);
        
        Sanctum::actingAs($this->user1);
        
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Cannot change tenant ownership');
        
        $beneficiary->update(['company_id' => $this->company2->id]);
    }

    /** @test */
    public function users_without_company_cannot_access_tenant_resources()
    {
        $userWithoutCompany = User::factory()->create([
            'company_id' => null,
            'role' => 'beneficiary'
        ]);

        $beneficiary = Beneficiary::factory()->create([
            'company_id' => $this->company1->id,
            'user_id' => $this->user1->id
        ]);

        Sanctum::actingAs($userWithoutCompany);
        
        $response = $this->getJson("/api/beneficiaries/{$beneficiary->id}");
        
        $response->assertStatus(403);
        $response->assertJson(['message' => 'Access denied: No company membership required for this resource']);
    }

    /** @test */
    public function tenant_scopes_work_with_relationships()
    {
        $beneficiary1 = Beneficiary::factory()->create([
            'company_id' => $this->company1->id,
            'user_id' => $this->user1->id
        ]);

        $document1 = Document::factory()->create([
            'beneficiary_id' => $beneficiary1->id,
            'company_id' => $this->company1->id,
            'uploaded_by' => $this->user1->id
        ]);

        $beneficiary2 = Beneficiary::factory()->create([
            'company_id' => $this->company2->id,
            'user_id' => $this->user2->id
        ]);

        $document2 = Document::factory()->create([
            'beneficiary_id' => $beneficiary2->id,
            'company_id' => $this->company2->id,
            'uploaded_by' => $this->user2->id
        ]);

        // User 1 should only see documents through their beneficiaries
        Sanctum::actingAs($this->user1);
        
        $beneficiaryWithDocuments = Beneficiary::with('documents')->first();
        
        $this->assertEquals(1, $beneficiaryWithDocuments->documents->count());
        $this->assertEquals($document1->id, $beneficiaryWithDocuments->documents->first()->id);
    }
}