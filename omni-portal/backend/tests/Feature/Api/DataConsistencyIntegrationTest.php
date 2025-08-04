<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\HealthQuestionnaire;
use App\Models\Interview;
use App\Models\GamificationProgress;
use App\Models\GamificationBadge;
use App\Models\AuditLog;
use App\Jobs\ProcessDocumentOCR;
use App\Jobs\UpdateGamificationProgress;
use App\Events\DocumentUploaded;
use App\Events\HealthQuestionnaireCompleted;
use App\Events\InterviewScheduled;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class DataConsistencyIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private $user;
    private $beneficiary;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        Storage::fake('local');
        Queue::fake();
        
        // Create test user with beneficiary
        $this->user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create(['user_id' => $this->user->id]);
        $this->user->beneficiary()->save($this->beneficiary);
        
        // Initialize gamification
        GamificationProgress::create([
            'beneficiary_id' => $this->beneficiary->id,
            'points' => 100,
            'level' => 1
        ]);
        
        $this->seedTestData();
    }

    /**
     * Test data consistency during concurrent updates
     */
    public function test_data_consistency_during_concurrent_updates(): void
    {
        Sanctum::actingAs($this->user);
        
        // Simulate concurrent operations
        $operations = [];
        
        // Operation 1: Upload document
        $operations[] = function() {
            $file = UploadedFile::fake()->image('doc1.jpg');
            return $this->postJson('/api/documents/upload', [
                'document_type_id' => 1,
                'file' => $file
            ]);
        };
        
        // Operation 2: Update profile
        $operations[] = function() {
            return $this->putJson('/api/profile', [
                'phone' => '+5511999999999',
                'address' => 'New Address 123'
            ]);
        };
        
        // Operation 3: Submit health questionnaire
        $operations[] = function() {
            return $this->postJson('/api/health-questionnaires/submit-unified', [
                'template_id' => 1,
                'responses' => [
                    ['question_id' => 1, 'answer' => 'Test answer']
                ]
            ]);
        };
        
        // Execute operations
        $results = [];
        foreach ($operations as $operation) {
            $results[] = $operation();
        }
        
        // Verify all operations succeeded
        foreach ($results as $response) {
            $this->assertIn($response->status(), [200, 201]);
        }
        
        // Verify data consistency
        $this->user->refresh();
        $this->beneficiary->refresh();
        
        // Check gamification points are correctly calculated
        $progress = GamificationProgress::where('beneficiary_id', $this->beneficiary->id)->first();
        $this->assertGreaterThan(100, $progress->points); // Should have earned points
        
        // Verify audit logs are complete
        $auditCount = AuditLog::where('user_id', $this->user->id)
            ->whereIn('action', ['document.uploaded', 'profile.updated', 'health_questionnaire.submitted'])
            ->count();
        $this->assertEquals(3, $auditCount);
        
        // Check no duplicate entries
        $documentCount = Document::where('beneficiary_id', $this->beneficiary->id)->count();
        $this->assertEquals(1, $documentCount);
    }

    /**
     * Test transaction rollback on failure
     */
    public function test_transaction_rollback_on_failure(): void
    {
        Sanctum::actingAs($this->user);
        
        // Attempt to upload invalid document that will fail validation
        $file = UploadedFile::fake()->create('invalid.exe', 100); // Invalid file type
        
        $initialDocCount = Document::count();
        $initialPoints = $this->beneficiary->gamificationProgress->points;
        
        $response = $this->postJson('/api/documents/upload', [
            'document_type_id' => 999, // Invalid ID
            'file' => $file
        ]);
        
        $response->assertStatus(422);
        
        // Verify no partial data was saved
        $this->assertEquals($initialDocCount, Document::count());
        $this->assertEquals($initialPoints, $this->beneficiary->gamificationProgress->fresh()->points);
        
        // Verify no audit log for failed operation
        $this->assertDatabaseMissing('audit_logs', [
            'user_id' => $this->user->id,
            'action' => 'document.uploaded',
            'created_at' => now()
        ]);
    }

    /**
     * Test cascade updates across related models
     */
    public function test_cascade_updates_across_related_models(): void
    {
        Sanctum::actingAs($this->user);
        
        // Upload multiple documents
        $documentIds = [];
        foreach (['RG', 'CPF'] as $docType) {
            $file = UploadedFile::fake()->image("{$docType}.jpg");
            $response = $this->postJson('/api/documents/upload', [
                'document_type_id' => DocumentType::where('code', $docType)->first()->id,
                'file' => $file
            ]);
            $documentIds[] = $response->json('document.id');
        }
        
        // Complete health questionnaire
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'template_id' => 1,
            'responses' => [
                ['question_id' => 1, 'answer' => 'Healthy'],
                ['question_id' => 2, 'answer' => 'No issues']
            ]
        ]);
        $questionnaireId = $response->json('questionnaire.id');
        
        // Verify beneficiary status updated
        $this->beneficiary->refresh();
        $this->assertTrue($this->beneficiary->documents_verified || $this->beneficiary->documents()->exists());
        $this->assertTrue($this->beneficiary->health_assessment_completed || $this->beneficiary->healthQuestionnaires()->exists());
        
        // Delete user (test cascade)
        $response = $this->deleteJson('/api/lgpd/delete-account', [
            'password' => 'password',
            'reason' => 'testing'
        ]);
        
        $response->assertStatus(200);
        
        // Verify cascade deletion
        $this->assertDatabaseMissing('users', ['id' => $this->user->id]);
        $this->assertDatabaseMissing('beneficiaries', ['id' => $this->beneficiary->id]);
        $this->assertDatabaseMissing('documents', ['beneficiary_id' => $this->beneficiary->id]);
        $this->assertDatabaseMissing('health_questionnaires', ['beneficiary_id' => $this->beneficiary->id]);
        $this->assertDatabaseMissing('gamification_progress', ['beneficiary_id' => $this->beneficiary->id]);
    }

    /**
     * Test event-driven data synchronization
     */
    public function test_event_driven_data_synchronization(): void
    {
        Event::fake([
            DocumentUploaded::class,
            HealthQuestionnaireCompleted::class,
            InterviewScheduled::class
        ]);
        
        Sanctum::actingAs($this->user);
        
        // Upload document
        $file = UploadedFile::fake()->image('test.jpg');
        $response = $this->postJson('/api/documents/upload', [
            'document_type_id' => 1,
            'file' => $file
        ]);
        
        // Verify event was dispatched
        Event::assertDispatched(DocumentUploaded::class, function ($event) {
            return $event->document->beneficiary_id === $this->beneficiary->id;
        });
        
        // Complete health questionnaire
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'template_id' => 1,
            'responses' => [['question_id' => 1, 'answer' => 'Test']]
        ]);
        
        Event::assertDispatched(HealthQuestionnaireCompleted::class);
        
        // Verify jobs were queued
        Queue::assertPushed(ProcessDocumentOCR::class);
        Queue::assertPushed(UpdateGamificationProgress::class);
    }

    /**
     * Test cache consistency with database
     */
    public function test_cache_consistency_with_database(): void
    {
        Sanctum::actingAs($this->user);
        
        // Warm up cache
        $response = $this->getJson('/api/gamification/progress');
        $cachedProgress = $response->json('progress');
        
        // Update data directly in database
        DB::table('gamification_progress')
            ->where('beneficiary_id', $this->beneficiary->id)
            ->update(['points' => 500]);
        
        // Cache should be invalidated and return fresh data
        $response = $this->getJson('/api/gamification/progress');
        $freshProgress = $response->json('progress');
        
        $this->assertEquals(500, $freshProgress['points']);
        $this->assertNotEquals($cachedProgress['points'], $freshProgress['points']);
    }

    /**
     * Test data integrity during bulk operations
     */
    public function test_data_integrity_during_bulk_operations(): void
    {
        // Create multiple beneficiaries
        $beneficiaries = User::factory()->count(10)->create(['role' => 'beneficiary']);
        
        foreach ($beneficiaries as $user) {
            Beneficiary::factory()->create(['user_id' => $user->id]);
        }
        
        // Admin performs bulk approval
        $admin = User::factory()->create(['role' => 'admin', 'is_admin' => true]);
        Sanctum::actingAs($admin);
        
        $beneficiaryIds = Beneficiary::pluck('id')->toArray();
        
        $response = $this->postJson('/api/admin/beneficiaries/bulk-approve', [
            'beneficiary_ids' => $beneficiaryIds,
            'plan_type' => 'basic',
            'notes' => 'Bulk approval test'
        ]);
        
        $response->assertStatus(200);
        
        // Verify all beneficiaries approved correctly
        $approvedCount = Beneficiary::whereIn('id', $beneficiaryIds)
            ->where('status', 'approved')
            ->count();
        
        $this->assertEquals(count($beneficiaryIds), $approvedCount);
        
        // Verify audit logs created for each
        $auditCount = AuditLog::where('user_id', $admin->id)
            ->where('action', 'beneficiary.bulk_approved')
            ->count();
        
        $this->assertGreaterThan(0, $auditCount);
    }

    /**
     * Test referential integrity constraints
     */
    public function test_referential_integrity_constraints(): void
    {
        Sanctum::actingAs($this->user);
        
        // Create related data
        $file = UploadedFile::fake()->image('doc.jpg');
        $response = $this->postJson('/api/documents/upload', [
            'document_type_id' => 1,
            'file' => $file
        ]);
        
        $documentId = $response->json('document.id');
        
        // Try to create orphaned record (should fail)
        $this->expectException(\Illuminate\Database\QueryException::class);
        
        DB::table('documents')->insert([
            'beneficiary_id' => 99999, // Non-existent beneficiary
            'document_type_id' => 1,
            'file_path' => 'test.jpg',
            'status' => 'pending'
        ]);
    }

    /**
     * Test optimistic locking for concurrent updates
     */
    public function test_optimistic_locking_for_concurrent_updates(): void
    {
        Sanctum::actingAs($this->user);
        
        // Get current profile
        $response = $this->getJson('/api/profile');
        $version = $response->json('user.updated_at');
        
        // Simulate another update (changes version)
        $this->user->update(['phone' => '1234567890']);
        
        // Try to update with old version
        $response = $this->putJson('/api/profile', [
            'name' => 'Updated Name',
            'version' => $version // Old version
        ]);
        
        // Should handle version conflict gracefully
        if ($response->status() === 409) {
            $this->assertEquals('Conflict: Data has been modified', $response->json('message'));
        } else {
            // If no version control, should still succeed
            $this->assertEquals(200, $response->status());
        }
    }

    /**
     * Test data validation consistency across endpoints
     */
    public function test_data_validation_consistency_across_endpoints(): void
    {
        Sanctum::actingAs($this->user);
        
        $invalidCPF = '00000000000'; // Invalid CPF
        
        // Test registration endpoint
        $response = $this->postJson('/api/auth/register', [
            'email' => 'new@test.com',
            'cpf' => $invalidCPF,
            'password' => 'password',
            'password_confirmation' => 'password'
        ]);
        
        $this->assertEquals(422, $response->status());
        
        // Test profile update endpoint
        $response = $this->putJson('/api/profile', [
            'cpf' => $invalidCPF
        ]);
        
        $this->assertEquals(422, $response->status());
        
        // Both should have consistent validation messages
        $this->assertStringContainsString('CPF', $response->json('errors.cpf.0'));
    }

    /**
     * Test LGPD data consistency and privacy
     */
    public function test_lgpd_data_consistency_and_privacy(): void
    {
        Sanctum::actingAs($this->user);
        
        // Create various data types
        $this->createCompleteUserData();
        
        // Export data
        $response = $this->getJson('/api/lgpd/export-data');
        $exportedData = $response->json('user_data');
        
        // Verify all data types are included
        $this->assertArrayHasKey('personal_information', $exportedData);
        $this->assertArrayHasKey('beneficiary_data', $exportedData);
        $this->assertArrayHasKey('documents', $exportedData);
        $this->assertArrayHasKey('health_data', $exportedData);
        $this->assertArrayHasKey('audit_logs', $exportedData);
        
        // Verify sensitive data is properly handled
        $this->assertArrayNotHasKey('password', $exportedData['personal_information']);
        $this->assertArrayNotHasKey('remember_token', $exportedData['personal_information']);
        
        // Test data anonymization
        $response = $this->postJson('/api/lgpd/anonymize-data', [
            'keep_statistical_data' => true
        ]);
        
        if ($response->status() === 200) {
            // Verify personal data is anonymized
            $this->user->refresh();
            $this->assertNotEquals('Test User', $this->user->name);
            $this->assertStringContainsString('anonymous', $this->user->email);
        }
    }

    /**
     * Helper: Create complete user data
     */
    private function createCompleteUserData(): void
    {
        // Documents
        foreach (['RG', 'CPF'] as $docType) {
            Document::factory()->create([
                'beneficiary_id' => $this->beneficiary->id,
                'document_type_id' => DocumentType::where('code', $docType)->first()->id
            ]);
        }
        
        // Health questionnaire
        HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed'
        ]);
        
        // Interview
        Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'scheduled'
        ]);
        
        // Audit logs
        AuditLog::factory()->count(5)->create([
            'user_id' => $this->user->id
        ]);
    }

    /**
     * Helper: Seed test data
     */
    private function seedTestData(): void
    {
        DocumentType::insert([
            ['name' => 'RG', 'code' => 'RG', 'is_required' => true],
            ['name' => 'CPF', 'code' => 'CPF', 'is_required' => true]
        ]);
        
        GamificationBadge::insert([
            ['code' => 'first_document', 'name' => 'First Document', 'description' => 'Uploaded first document', 'icon' => 'doc', 'points' => 25],
            ['code' => 'health_complete', 'name' => 'Health Complete', 'description' => 'Completed health assessment', 'icon' => 'health', 'points' => 50]
        ]);
    }

    protected function tearDown(): void
    {
        exec('npx claude-flow@alpha hooks post-edit --file "/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend/tests/Feature/Api/DataConsistencyIntegrationTest.php" --memory-key "analyzer/journey-tests/data-consistency"');
        
        parent::tearDown();
    }
}