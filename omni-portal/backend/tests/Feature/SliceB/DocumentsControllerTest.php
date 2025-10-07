<?php

namespace Tests\Feature\SliceB;

use Tests\TestCase;
use App\Models\User;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\FeatureFlag;
use App\Models\AnalyticsEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * SliceB DocumentsController Comprehensive Test Suite
 *
 * Purpose: Verify complete Slice B documents controller functionality
 *
 * Coverage:
 * - Authentication enforcement
 * - Feature flag blocking
 * - Input validation
 * - Analytics tracking
 * - Rate limiting
 * - Cross-user access prevention
 * - Error handling
 * - PII prevention
 *
 * Target: ≥75% controller coverage
 */
class DocumentsControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed document types
        DocumentType::factory()->create(['slug' => 'rg', 'name' => 'RG']);
        DocumentType::factory()->create(['slug' => 'cpf', 'name' => 'CPF']);
        DocumentType::factory()->create(['slug' => 'proof_of_address', 'name' => 'Proof of Address']);
        DocumentType::factory()->create(['slug' => 'medical_certificate', 'name' => 'Medical Certificate']);

        // Enable feature flag for tests
        FeatureFlag::create([
            'key' => 'sliceB_documents',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => ['testing'],
            'description' => 'Slice B documents flow',
        ]);

        // Mock S3 storage
        Storage::fake('s3');
    }

    /**
     * Test: Presigned URL requires authentication
     *
     * @test
     */
    public function presign_requires_authentication(): void
    {
        $response = $this->postJson('/api/v1/documents/presign', [
            'filename' => 'test.pdf',
            'type' => 'rg',
        ]);

        $response->assertStatus(401);
    }

    /**
     * Test: Presigned URL validates input
     *
     * @test
     */
    public function presign_validates_input(): void
    {
        $user = User::factory()->create();

        // Missing required fields
        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['filename', 'type']);

        // Invalid document type
        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'test.pdf',
            'type' => 'invalid_type',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    /**
     * Test: Presigned URL generates URL and tracks analytics
     *
     * @test
     */
    public function presign_generates_url_and_tracks_analytics(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'rg-frente.pdf',
            'type' => 'rg',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'upload_url',
                'path',
                'expires_at',
            ]);

        // Verify analytics event persisted
        $this->assertDatabaseHas('analytics_events', [
            'event_name' => 'documents.presigned_generated',
            'event_category' => 'documents',
            'user_id_hash' => hash('sha256', (string) $user->id),
        ]);

        // Verify event metadata
        $event = AnalyticsEvent::where('event_name', 'documents.presigned_generated')->first();
        $this->assertNotNull($event);
        $this->assertArrayHasKey('document_type', $event->metadata);
        $this->assertArrayHasKey('filename_hash', $event->metadata);
        $this->assertEquals('rg', $event->metadata['document_type']);
        $this->assertEquals('pdf', $event->metadata['file_extension']);
    }

    /**
     * Test: Presigned URL blocked when feature flag disabled
     *
     * @test
     */
    public function presign_blocked_when_flag_disabled(): void
    {
        // Disable feature flag
        FeatureFlag::where('key', 'sliceB_documents')->update(['enabled' => false]);

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
     * Test: Submit creates document record
     *
     * @test
     */
    public function submit_creates_document_record(): void
    {
        $user = User::factory()->create();

        // Create fake S3 file
        $path = 'documents/' . $user->id . '/test-rg.pdf';
        Storage::disk('s3')->put($path, 'fake-pdf-content');

        $response = $this->actingAs($user)->postJson('/api/v1/documents/submit', [
            'path' => $path,
            'type' => 'rg',
            'metadata' => ['notes' => 'Front page'],
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'document_id',
                'status',
                'submitted_at',
                'message',
            ])
            ->assertJson([
                'status' => 'pending_review',
            ]);

        // Verify document created in database
        $this->assertDatabaseHas('documents', [
            'user_id' => $user->id,
            'status' => 'pending_review',
            'file_path' => $path,
        ]);
    }

    /**
     * Test: Submit persists analytics event
     *
     * @test
     */
    public function submit_persists_analytics_event(): void
    {
        $user = User::factory()->create();

        $path = 'documents/' . $user->id . '/test.pdf';
        Storage::disk('s3')->put($path, 'content');

        $this->actingAs($user)->postJson('/api/v1/documents/submit', [
            'path' => $path,
            'type' => 'cpf',
        ]);

        // Verify analytics event
        $this->assertDatabaseHas('analytics_events', [
            'event_name' => 'documents.submitted',
            'event_category' => 'documents',
            'user_id_hash' => hash('sha256', (string) $user->id),
        ]);

        $event = AnalyticsEvent::where('event_name', 'documents.submitted')->first();
        $this->assertArrayHasKey('document_type', $event->metadata);
        $this->assertArrayHasKey('file_size_bytes', $event->metadata);
        $this->assertEquals('cpf', $event->metadata['document_type']);
    }

    /**
     * Test: Submit validates file path exists
     *
     * @test
     */
    public function submit_validates_file_path(): void
    {
        $user = User::factory()->create();

        // File does not exist in S3
        $response = $this->actingAs($user)->postJson('/api/v1/documents/submit', [
            'path' => 'documents/nonexistent.pdf',
            'type' => 'rg',
        ]);

        $response->assertStatus(404)
            ->assertJson([
                'error' => 'File not found',
            ]);
    }

    /**
     * Test: Status returns document information
     *
     * @test
     */
    public function status_returns_document_info(): void
    {
        $user = User::factory()->create();
        $documentType = DocumentType::where('slug', 'rg')->first();

        $document = Document::factory()->create([
            'user_id' => $user->id,
            'document_type_id' => $documentType->id,
            'status' => 'approved',
            'reviewed_at' => now(),
        ]);

        $response = $this->actingAs($user)->getJson("/api/v1/documents/{$document->id}/status");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'document_id',
                'status',
                'type',
                'submitted_at',
                'reviewed_at',
            ])
            ->assertJson([
                'document_id' => $document->id,
                'status' => 'approved',
                'type' => 'rg',
            ]);
    }

    /**
     * Test: Status blocks cross-user access
     *
     * @test
     */
    public function status_blocks_cross_user_access(): void
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

    /**
     * Test: Rate limiting enforced (60 req/min)
     *
     * @test
     */
    public function rate_limiting_enforced(): void
    {
        $user = User::factory()->create();

        // Make 61 requests (exceeds limit of 60)
        for ($i = 0; $i < 61; $i++) {
            $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
                'filename' => "file{$i}.pdf",
                'type' => 'rg',
            ]);

            if ($i < 60) {
                $response->assertStatus(200);
            } else {
                // 61st request should be rate limited
                $response->assertStatus(429);
                break;
            }
        }
    }

    /**
     * Test: Validation errors return 422
     *
     * @test
     */
    public function validation_errors_return_422(): void
    {
        $user = User::factory()->create();

        // Empty request
        $response = $this->actingAs($user)->postJson('/api/v1/documents/submit', []);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'error',
                'message',
                'errors',
            ]);
    }

    /**
     * Test: Analytics events contain no PII
     *
     * @test
     */
    public function analytics_events_contain_no_pii(): void
    {
        $user = User::factory()->create([
            'email' => 'sensitive@example.com',
            'cpf' => '12345678901',
        ]);

        $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'my-cpf-12345678901.pdf',
            'type' => 'cpf',
        ]);

        $event = AnalyticsEvent::where('event_name', 'documents.presigned_generated')->first();
        $eventJson = json_encode($event);

        // Verify NO PII in event
        $this->assertStringNotContainsString('sensitive@example.com', $eventJson);
        $this->assertStringNotContainsString('12345678901', $eventJson);

        // Verify filename is hashed
        $this->assertArrayHasKey('filename_hash', $event->metadata);
        $this->assertEquals(64, strlen($event->metadata['filename_hash'])); // SHA256 length
    }

    /**
     * Test: Multiple metadata fields validated
     *
     * @test
     */
    public function metadata_validation_enforced(): void
    {
        $user = User::factory()->create();
        $path = 'documents/test.pdf';
        Storage::disk('s3')->put($path, 'content');

        // Metadata with oversized value (>500 chars)
        $response = $this->actingAs($user)->postJson('/api/v1/documents/submit', [
            'path' => $path,
            'type' => 'rg',
            'metadata' => [
                'notes' => str_repeat('a', 501), // Exceeds 500 char limit
            ],
        ]);

        $response->assertStatus(422);
    }

    /**
     * Test: All document types accepted
     *
     * @test
     */
    public function all_document_types_accepted(): void
    {
        $user = User::factory()->create();

        $types = ['rg', 'cpf', 'proof_of_address', 'medical_certificate'];

        foreach ($types as $type) {
            $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
                'filename' => "test-{$type}.pdf",
                'type' => $type,
            ]);

            $response->assertStatus(200);
        }
    }

    /**
     * Test: Presigned URL expires correctly
     *
     * @test
     */
    public function presigned_url_expires_in_15_minutes(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'test.pdf',
            'type' => 'rg',
        ]);

        $response->assertStatus(200);

        $data = $response->json();
        $this->assertArrayHasKey('expires_at', $data);

        // Verify expiration is approximately 15 minutes from now
        $expiresAt = \Carbon\Carbon::parse($data['expires_at']);
        $expectedExpiry = now()->addMinutes(15);

        $this->assertTrue(
            $expiresAt->between(
                $expectedExpiry->subMinutes(1),
                $expectedExpiry->addMinutes(1)
            )
        );
    }

    /**
     * Test: Error logging on server failures
     *
     * @test
     */
    public function server_errors_are_logged(): void
    {
        Log::shouldReceive('error')
            ->once()
            ->with('Presigned URL generation failed', \Mockery::any());

        $user = User::factory()->create();

        // Force an error by using invalid storage disk
        Storage::shouldReceive('disk')
            ->andThrow(new \Exception('Storage error'));

        $response = $this->actingAs($user)->postJson('/api/v1/documents/presign', [
            'filename' => 'test.pdf',
            'type' => 'rg',
        ]);

        $response->assertStatus(500)
            ->assertJson([
                'error' => 'Server error',
            ]);
    }
}
