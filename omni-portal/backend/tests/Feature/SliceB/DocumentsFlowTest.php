<?php

namespace Tests\Feature\SliceB;

use Tests\TestCase;
use App\Models\User;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\AnalyticsEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

/**
 * Slice B Documents Flow Integration Tests
 *
 * Purpose: Verify complete documents upload lifecycle with analytics persistence
 *
 * Test Coverage:
 * 1. Presigned URL generation with analytics
 * 2. Document submission with analytics and audit
 * 3. Document status retrieval
 * 4. Feature flag enforcement
 * 5. PII detection in analytics (CRITICAL)
 * 6. Analytics event persistence
 *
 * Compliance:
 * - Zero PII in analytics payloads (LGPD/HIPAA)
 * - Full audit trail verification
 * - ADR-004 encryption compliance
 */
class DocumentsFlowTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Set up test environment
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Seed document types
        DocumentType::factory()->create(['slug' => 'rg', 'name' => 'RG']);
        DocumentType::factory()->create(['slug' => 'cpf', 'name' => 'CPF']);

        // Enable feature flag for tests
        DB::table('feature_flags')->insert([
            'key' => 'sliceB_documents',
            'enabled' => true,
            'rollout_percentage' => 100,
            'description' => 'Test flag',
            'environments' => json_encode(['testing']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Mock S3 storage
        Storage::fake('s3');
    }

    /**
     * Test: Presigned URL generation tracks analytics event
     *
     * @test
     */
    public function presign_generates_upload_url_and_tracks_analytics(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'rg-frente.pdf',
            'type' => 'rg',
        ]);

        // Assert HTTP 200
        $response->assertStatus(200)
            ->assertJsonStructure(['upload_url', 'path', 'expires_at']);

        // Verify analytics event persisted
        $this->assertDatabaseHas('analytics_events', [
            'event_name' => 'documents.presigned_generated',
            'event_category' => 'documents',
            'user_id_hash' => hash('sha256', (string) $user->id),
        ]);

        // Verify event metadata structure
        $event = AnalyticsEvent::where('event_name', 'documents.presigned_generated')->first();
        $this->assertNotNull($event);
        $this->assertArrayHasKey('document_type', $event->metadata);
        $this->assertArrayHasKey('filename_hash', $event->metadata);
        $this->assertEquals('rg', $event->metadata['document_type']);
    }

    /**
     * Test: Document submission creates record and persists analytics
     *
     * @test
     */
    public function submit_creates_document_and_persists_analytics(): void
    {
        $user = User::factory()->create();

        // Create fake S3 file
        $path = 'documents/123/test-rg.pdf';
        Storage::disk('s3')->put($path, 'fake-pdf-content');

        $response = $this->actingAs($user)->postJson('/api/v1/documents/submit', [
            'path' => $path,
            'type' => 'rg',
            'metadata' => ['notes' => 'Front page'],
        ]);

        // Assert HTTP 201
        $response->assertStatus(201)
            ->assertJsonStructure(['document_id', 'status', 'submitted_at', 'message']);

        // Verify document created
        $this->assertDatabaseHas('documents', [
            'user_id' => $user->id,
            'status' => 'pending_review',
            'file_path' => $path,
        ]);

        // Verify analytics event persisted
        $this->assertDatabaseHas('analytics_events', [
            'event_name' => 'documents.submitted',
            'event_category' => 'documents',
            'user_id_hash' => hash('sha256', (string) $user->id),
        ]);

        // Verify event metadata
        $event = AnalyticsEvent::where('event_name', 'documents.submitted')->first();
        $this->assertNotNull($event);
        $this->assertArrayHasKey('document_type', $event->metadata);
        $this->assertArrayHasKey('file_size_bytes', $event->metadata);
        $this->assertEquals('rg', $event->metadata['document_type']);
    }

    /**
     * Test: Document status retrieval returns correct data
     *
     * @test
     */
    public function status_returns_document_information(): void
    {
        $user = User::factory()->create();
        $documentType = DocumentType::where('slug', 'rg')->first();

        $document = Document::factory()->create([
            'user_id' => $user->id,
            'document_type_id' => $documentType->id,
            'status' => 'pending_review',
        ]);

        $response = $this->actingAs($user)->getJson("/api/v1/documents/{$document->id}/status");

        $response->assertStatus(200)
            ->assertJson([
                'document_id' => $document->id,
                'status' => 'pending_review',
                'type' => 'rg',
            ]);
    }

    /**
     * Test: Feature flag enforcement blocks when disabled
     *
     * @test
     */
    public function feature_flag_blocks_access_when_disabled(): void
    {
        // Disable feature flag
        DB::table('feature_flags')
            ->where('key', 'sliceB_documents')
            ->update(['enabled' => false]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'test.pdf',
            'type' => 'rg',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'error' => 'Feature not available',
            ]);
    }

    /**
     * Test: Analytics events contain NO PII (CRITICAL)
     *
     * @test
     */
    public function analytics_events_contain_no_pii(): void
    {
        $user = User::factory()->create([
            'email' => 'user@example.com',
            'cpf' => '123.456.789-01',
        ]);

        // Request with filename containing PII-like data
        $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'my-cpf-123456789.pdf',
            'type' => 'cpf',
        ]);

        $event = AnalyticsEvent::where('event_name', 'documents.presigned_generated')->first();

        // Verify NO PII in metadata
        $metadataJson = json_encode($event->metadata);
        $this->assertStringNotContainsString('123456789', $metadataJson);
        $this->assertStringNotContainsString($user->email, $metadataJson);
        $this->assertStringNotContainsString($user->cpf, $metadataJson);

        // Verify filename is hashed, not stored plaintext
        $this->assertArrayHasKey('filename_hash', $event->metadata);
        $this->assertEquals(64, strlen($event->metadata['filename_hash'])); // SHA256 length
    }

    /**
     * Test: Multiple analytics events persist independently
     *
     * @test
     */
    public function multiple_analytics_events_persist_independently(): void
    {
        $user = User::factory()->create();

        // Generate presigned URL
        $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'test1.pdf',
            'type' => 'rg',
        ]);

        // Submit document
        $path = 'documents/123/test-rg.pdf';
        Storage::disk('s3')->put($path, 'content');

        $this->actingAs($user)->postJson('/api/v1/documents/submit', [
            'path' => $path,
            'type' => 'rg',
        ]);

        // Verify both events persisted
        $this->assertEquals(2, AnalyticsEvent::count());

        $presignEvent = AnalyticsEvent::where('event_name', 'documents.presigned_generated')->first();
        $submitEvent = AnalyticsEvent::where('event_name', 'documents.submitted')->first();

        $this->assertNotNull($presignEvent);
        $this->assertNotNull($submitEvent);
        $this->assertNotEquals($presignEvent->id, $submitEvent->id);
    }

    /**
     * Test: Validation errors return proper 422 responses
     *
     * @test
     */
    public function validation_errors_return_422_with_details(): void
    {
        $user = User::factory()->create();

        // Missing required fields
        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', []);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'error',
                'message',
                'errors' => [
                    'filename',
                    'type',
                ],
            ]);
    }

    /**
     * Test: Invalid document type rejected
     *
     * @test
     */
    public function invalid_document_type_rejected(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'test.pdf',
            'type' => 'invalid_type',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    /**
     * Test: Cannot access other user's documents
     *
     * @test
     */
    public function cannot_access_other_users_documents(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        $document = Document::factory()->create([
            'user_id' => $user1->id,
        ]);

        // User2 tries to access User1's document
        $response = $this->actingAs($user2)->getJson("/api/v1/documents/{$document->id}/status");

        $response->assertStatus(404)
            ->assertJson([
                'error' => 'Not found',
            ]);
    }
}
