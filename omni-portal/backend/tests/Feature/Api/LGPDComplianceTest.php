<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Document;
use App\Models\PrivacySetting;
use App\Models\ConsentLog;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

class LGPDComplianceTest extends TestCase
{
    use RefreshDatabase;

    protected $user;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a fully registered active user
        $this->user = User::factory()->create([
            'name' => 'Test User',
            'email' => 'lgpd@example.com',
            'cpf' => '12345678901',
            'registration_step' => 'completed',
            'status' => 'active',
            'email_verified_at' => now()
        ]);

        // Setup storage fake for testing file exports
        Storage::fake('local');
    }

    /**
     * Test user can export personal data in JSON format
     */
    public function test_user_can_export_personal_data_json()
    {
        Sanctum::actingAs($this->user);

        // Create some user data
        Document::factory()->count(3)->create(['user_id' => $this->user->id]);

        $response = $this->getJson('/api/lgpd/export-data');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user' => [
                    'id',
                    'name',
                    'email',
                    'cpf',
                    'created_at',
                    'updated_at'
                ],
                'documents',
                'privacy_settings',
                'consent_history',
                'activity_logs',
                'export_date'
            ]);

        // Verify sensitive data is included
        $response->assertJsonPath('user.email', 'lgpd@example.com');
        $response->assertJsonPath('user.cpf', '12345678901');
        
        // Verify documents are included
        $this->assertCount(3, $response->json('documents'));
    }

    /**
     * Test user can export personal data in PDF format
     */
    public function test_user_can_export_personal_data_pdf()
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/lgpd/export-data-pdf');

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'attachment; filename="personal-data-export.pdf"');
    }

    /**
     * Test user can delete their account
     */
    public function test_user_can_delete_account()
    {
        Sanctum::actingAs($this->user);

        // Create related data
        $document = Document::factory()->create(['user_id' => $this->user->id]);
        
        $response = $this->deleteJson('/api/lgpd/delete-account', [
            'password' => 'password', // Default factory password
            'confirmation' => 'DELETE MY ACCOUNT'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Account successfully deleted',
                'deleted_at' => now()->toISOString()
            ]);

        // Verify user is soft deleted
        $this->assertSoftDeleted('users', [
            'id' => $this->user->id
        ]);

        // Verify related data is also deleted
        $this->assertSoftDeleted('documents', [
            'id' => $document->id
        ]);
    }

    /**
     * Test account deletion requires correct password
     */
    public function test_account_deletion_requires_correct_password()
    {
        Sanctum::actingAs($this->user);

        $response = $this->deleteJson('/api/lgpd/delete-account', [
            'password' => 'wrongpassword',
            'confirmation' => 'DELETE MY ACCOUNT'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    /**
     * Test account deletion requires confirmation phrase
     */
    public function test_account_deletion_requires_confirmation_phrase()
    {
        Sanctum::actingAs($this->user);

        $response = $this->deleteJson('/api/lgpd/delete-account', [
            'password' => 'password',
            'confirmation' => 'WRONG PHRASE'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['confirmation']);
    }

    /**
     * Test get privacy settings
     */
    public function test_user_can_get_privacy_settings()
    {
        Sanctum::actingAs($this->user);

        // Create privacy settings
        PrivacySetting::create([
            'user_id' => $this->user->id,
            'marketing_emails' => true,
            'data_analytics' => false,
            'third_party_sharing' => false
        ]);

        $response = $this->getJson('/api/lgpd/privacy-settings');

        $response->assertStatus(200)
            ->assertJson([
                'marketing_emails' => true,
                'data_analytics' => false,
                'third_party_sharing' => false
            ])
            ->assertJsonStructure([
                'marketing_emails',
                'data_analytics',
                'third_party_sharing',
                'updated_at'
            ]);
    }

    /**
     * Test update privacy settings
     */
    public function test_user_can_update_privacy_settings()
    {
        Sanctum::actingAs($this->user);

        $response = $this->putJson('/api/lgpd/privacy-settings', [
            'marketing_emails' => false,
            'data_analytics' => true,
            'third_party_sharing' => false
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Privacy settings updated successfully',
                'settings' => [
                    'marketing_emails' => false,
                    'data_analytics' => true,
                    'third_party_sharing' => false
                ]
            ]);

        // Verify database update
        $this->assertDatabaseHas('privacy_settings', [
            'user_id' => $this->user->id,
            'marketing_emails' => false,
            'data_analytics' => true,
            'third_party_sharing' => false
        ]);
    }

    /**
     * Test get consent history
     */
    public function test_user_can_get_consent_history()
    {
        Sanctum::actingAs($this->user);

        // Create consent logs
        ConsentLog::create([
            'user_id' => $this->user->id,
            'consent_type' => 'terms_of_service',
            'action' => 'granted',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit Test'
        ]);

        ConsentLog::create([
            'user_id' => $this->user->id,
            'consent_type' => 'marketing_emails',
            'action' => 'withdrawn',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit Test'
        ]);

        $response = $this->getJson('/api/lgpd/consent-history');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'consent_type',
                        'action',
                        'timestamp',
                        'ip_address',
                        'user_agent'
                    ]
                ],
                'total'
            ]);

        $this->assertCount(2, $response->json('data'));
    }

    /**
     * Test withdraw consent
     */
    public function test_user_can_withdraw_consent()
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/lgpd/withdraw-consent', [
            'consent_type' => 'marketing_emails',
            'reason' => 'Too many emails'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Consent withdrawn successfully',
                'consent_type' => 'marketing_emails'
            ]);

        // Verify consent log was created
        $this->assertDatabaseHas('consent_logs', [
            'user_id' => $this->user->id,
            'consent_type' => 'marketing_emails',
            'action' => 'withdrawn'
        ]);

        // Verify privacy setting was updated
        $this->assertDatabaseHas('privacy_settings', [
            'user_id' => $this->user->id,
            'marketing_emails' => false
        ]);
    }

    /**
     * Test get data processing activities
     */
    public function test_user_can_get_data_processing_activities()
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/lgpd/data-processing-activities');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'activities' => [
                    '*' => [
                        'purpose',
                        'legal_basis',
                        'data_categories',
                        'retention_period',
                        'third_party_sharing'
                    ]
                ]
            ]);

        // Verify standard activities are present
        $activities = $response->json('activities');
        $purposes = array_column($activities, 'purpose');
        
        $this->assertContains('Account Management', $purposes);
        $this->assertContains('Service Provision', $purposes);
        $this->assertContains('Legal Compliance', $purposes);
    }

    /**
     * Test LGPD endpoints require authentication
     */
    public function test_lgpd_endpoints_require_authentication()
    {
        // Test without authentication
        $endpoints = [
            ['method' => 'GET', 'uri' => '/api/lgpd/consent-status'],
            ['method' => 'POST', 'uri' => '/api/lgpd/update-consent'],
            ['method' => 'POST', 'uri' => '/api/lgpd/data-export-request'],
            ['method' => 'POST', 'uri' => '/api/lgpd/data-deletion-request'],
            ['method' => 'GET', 'uri' => '/api/lgpd/privacy-settings'],
            ['method' => 'PUT', 'uri' => '/api/lgpd/privacy-settings']
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->json($endpoint['method'], $endpoint['uri']);
            $response->assertStatus(401);
        }
    }

    /**
     * Test LGPD endpoints require completed registration
     */
    public function test_lgpd_endpoints_require_completed_registration()
    {
        // Create user with incomplete registration
        $incompleteUser = User::factory()->create([
            'registration_completed' => false,
            'registration_step' => 2
        ]);

        Sanctum::actingAs($incompleteUser);

        $response = $this->getJson('/api/lgpd/export-data');
        $response->assertStatus(403)
            ->assertJson([
                'message' => 'Registration not completed'
            ]);
    }

    /**
     * Test LGPD endpoints require active account
     */
    public function test_lgpd_endpoints_require_active_account()
    {
        // Create suspended user
        $suspendedUser = User::factory()->create([
            'registration_completed' => true,
            'status' => 'suspended'
        ]);

        Sanctum::actingAs($suspendedUser);

        $response = $this->getJson('/api/lgpd/export-data');
        $response->assertStatus(403)
            ->assertJson([
                'message' => 'Account is not active'
            ]);
    }

    /**
     * Test data export includes all user information
     */
    public function test_data_export_is_comprehensive()
    {
        Sanctum::actingAs($this->user);

        // Create various user data
        Document::factory()->count(2)->create(['user_id' => $this->user->id]);
        
        ConsentLog::create([
            'user_id' => $this->user->id,
            'consent_type' => 'terms_of_service',
            'action' => 'granted'
        ]);

        PrivacySetting::create([
            'user_id' => $this->user->id,
            'marketing_emails' => true
        ]);

        $response = $this->getJson('/api/lgpd/export-data');

        $response->assertStatus(200);

        $data = $response->json();

        // Verify all sections are present and populated
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('documents', $data);
        $this->assertArrayHasKey('privacy_settings', $data);
        $this->assertArrayHasKey('consent_history', $data);
        $this->assertArrayHasKey('activity_logs', $data);

        // Verify counts
        $this->assertCount(2, $data['documents']);
        $this->assertCount(1, $data['consent_history']);
        $this->assertNotEmpty($data['privacy_settings']);
    }
}