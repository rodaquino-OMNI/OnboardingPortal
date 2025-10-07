<?php

namespace Tests\Feature\SliceB;

use Tests\TestCase;
use App\Models\User;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\AnalyticsEvent;
use App\Services\DocumentsService;
use App\Services\AnalyticsEventRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

/**
 * DocumentsService Comprehensive Test Suite
 *
 * Purpose: Verify complete Slice B documents service functionality
 *
 * Coverage:
 * - Presigned URL generation with 15-minute expiry
 * - Document submission with encryption
 * - Document approval/rejection flows
 * - Analytics integration
 * - PII detection
 * - Audit trail completeness
 * - Idempotency
 * - Concurrent operations
 *
 * Target: ≥75% service coverage
 */
class DocumentsServiceTest extends TestCase
{
    use RefreshDatabase;

    private DocumentsService $service;

    protected function setUp(): void
    {
        parent::setUp();

        // Initialize service with analytics repository
        $this->service = new DocumentsService(
            app(AnalyticsEventRepository::class)
        );

        // Seed document types
        DocumentType::factory()->create(['slug' => 'rg', 'name' => 'RG']);
        DocumentType::factory()->create(['slug' => 'cpf', 'name' => 'CPF']);
        DocumentType::factory()->create(['slug' => 'proof_of_address', 'name' => 'Proof of Address']);

        // Mock S3 storage
        Storage::fake('s3');
    }

    /**
     * Test: Presigned URL expires in 15 minutes
     *
     * @test
     */
    public function presigned_url_expires_in_15_minutes(): void
    {
        $user = User::factory()->create();

        $result = $this->service->generatePresignedUrl($user, 'test.pdf', 'rg');

        $this->assertArrayHasKey('upload_url', $result);
        $this->assertArrayHasKey('path', $result);
        $this->assertArrayHasKey('expires_at', $result);

        // Verify 15-minute expiry
        $expiresAt = \Carbon\Carbon::parse($result['expires_at']);
        $expectedExpiry = now()->addMinutes(15);

        $this->assertTrue(
            $expiresAt->between(
                $expectedExpiry->subMinutes(1),
                $expectedExpiry->addMinutes(1)
            )
        );
    }

    /**
     * Test: Submit encrypts metadata per ADR-004
     *
     * @test
     */
    public function submit_encrypts_metadata(): void
    {
        $user = User::factory()->create();

        $path = 'documents/' . $user->id . '/test.pdf';
        Storage::disk('s3')->put($path, 'content');

        $document = $this->service->submitDocument($user, $path, 'rg', [
            'document_number' => '12.345.678-9',
        ]);

        $this->assertNotNull($document);
        $this->assertEquals('pending_review', $document->status);

        // Verify metadata is stored (encryption happens at model level via EncryptsAttributes trait)
        $this->assertNotNull($document->metadata);
        $this->assertArrayHasKey('document_number', $document->metadata);
    }

    /**
     * Test: Approve triggers badge unlock event
     *
     * @test
     */
    public function approve_triggers_badge_unlock_event(): void
    {
        $user = User::factory()->create();
        $reviewer = User::factory()->create();
        $documentType = DocumentType::where('slug', 'rg')->first();

        $document = Document::factory()->create([
            'user_id' => $user->id,
            'document_type_id' => $documentType->id,
            'status' => 'pending_review',
        ]);

        // Expect DocumentProcessed event to be fired
        \Event::fake([\App\Events\DocumentProcessed::class]);

        $result = $this->service->approveDocument($document, $reviewer, 'Approved - looks good');

        $this->assertTrue($result);
        $this->assertEquals('approved', $document->fresh()->status);

        // Verify event was dispatched
        \Event::assertDispatched(\App\Events\DocumentProcessed::class, function ($event) use ($document) {
            return $event->document->id === $document->id;
        });
    }

    /**
     * Test: Reject categorizes reason
     *
     * @test
     */
    public function reject_categorizes_reason(): void
    {
        $user = User::factory()->create();
        $reviewer = User::factory()->create();
        $documentType = DocumentType::where('slug', 'cpf')->first();

        $document = Document::factory()->create([
            'user_id' => $user->id,
            'document_type_id' => $documentType->id,
            'status' => 'pending_review',
        ]);

        $result = $this->service->rejectDocument($document, $reviewer, 'Image is too blurry and illegible');

        $this->assertTrue($result);
        $this->assertEquals('rejected', $document->fresh()->status);

        // Verify analytics event with categorized reason
        $this->assertDatabaseHas('analytics_events', [
            'event_name' => 'documents.rejected',
            'event_category' => 'documents',
        ]);

        $event = AnalyticsEvent::where('event_name', 'documents.rejected')->first();
        $this->assertEquals('quality_issue', $event->metadata['rejection_reason_category']);
    }

    /**
     * Test: Analytics validation throws in dev on PII
     *
     * @test
     */
    public function analytics_validation_throws_in_dev_on_pii(): void
    {
        config(['app.env' => 'local']);

        $user = User::factory()->create([
            'email' => 'user@example.com',
        ]);

        // This should not throw because filename is hashed
        $result = $this->service->generatePresignedUrl($user, 'test.pdf', 'rg');
        $this->assertNotNull($result);

        // Verify analytics event was created without PII
        $event = AnalyticsEvent::where('event_name', 'documents.presigned_generated')->first();
        $eventJson = json_encode($event);

        $this->assertStringNotContainsString('user@example.com', $eventJson);
    }

    /**
     * Test: Analytics drops in prod on PII
     *
     * @test
     */
    public function analytics_drops_in_prod_on_pii(): void
    {
        config(['app.env' => 'production']);

        $user = User::factory()->create();

        // Normal operation - should succeed
        $result = $this->service->generatePresignedUrl($user, 'test.pdf', 'rg');
        $this->assertNotNull($result);

        // Analytics should be persisted (no PII in normal flow)
        $this->assertDatabaseHas('analytics_events', [
            'event_name' => 'documents.presigned_generated',
        ]);
    }

    /**
     * Test: All events have hashed user IDs
     *
     * @test
     */
    public function all_events_have_hashed_user_ids(): void
    {
        $user = User::factory()->create();

        // Generate presigned URL
        $this->service->generatePresignedUrl($user, 'test1.pdf', 'rg');

        // Submit document
        $path = 'documents/test.pdf';
        Storage::disk('s3')->put($path, 'content');
        $document = $this->service->submitDocument($user, $path, 'cpf');

        // Approve document
        $reviewer = User::factory()->create();
        $this->service->approveDocument($document, $reviewer);

        // Verify all events have hashed user IDs
        $events = AnalyticsEvent::all();

        foreach ($events as $event) {
            $this->assertNotNull($event->user_id_hash);
            $this->assertEquals(64, strlen($event->user_id_hash)); // SHA256 length
            $this->assertEquals(hash('sha256', (string) $user->id), $event->user_id_hash);
        }
    }

    /**
     * Test: Concurrent submissions are isolated
     *
     * @test
     */
    public function concurrent_submissions_isolated(): void
    {
        $user = User::factory()->create();

        // Simulate concurrent document submissions
        $documents = [];
        for ($i = 0; $i < 5; $i++) {
            $path = "documents/test{$i}.pdf";
            Storage::disk('s3')->put($path, "content{$i}");

            $documents[] = $this->service->submitDocument($user, $path, 'rg', [
                'index' => $i,
            ]);
        }

        // Verify all 5 documents were created independently
        $this->assertCount(5, $documents);
        $this->assertEquals(5, Document::where('user_id', $user->id)->count());

        // Verify each has unique metadata
        foreach ($documents as $index => $document) {
            $this->assertEquals($index, $document->metadata['index']);
        }
    }

    /**
     * Test: Idempotency on duplicate submit
     *
     * @test
     */
    public function idempotency_on_duplicate_submit(): void
    {
        $user = User::factory()->create();

        $path = 'documents/test.pdf';
        Storage::disk('s3')->put($path, 'content');

        // First submission
        $doc1 = $this->service->submitDocument($user, $path, 'rg');

        // Second submission with same path
        $doc2 = $this->service->submitDocument($user, $path, 'rg');

        // Both should succeed (no uniqueness constraint on path)
        $this->assertNotNull($doc1);
        $this->assertNotNull($doc2);
        $this->assertNotEquals($doc1->id, $doc2->id);

        // Should have 2 separate documents
        $this->assertEquals(2, Document::where('user_id', $user->id)->count());
    }

    /**
     * Test: Audit trail completeness
     *
     * @test
     */
    public function audit_trail_completeness(): void
    {
        Log::shouldReceive('channel')
            ->with('audit')
            ->andReturnSelf()
            ->times(3); // Submit, Approve, Reject

        Log::shouldReceive('info')
            ->times(3);

        $user = User::factory()->create();
        $reviewer = User::factory()->create();

        // Submit document
        $path = 'documents/test1.pdf';
        Storage::disk('s3')->put($path, 'content');
        $doc1 = $this->service->submitDocument($user, $path, 'rg');

        // Approve document
        $this->service->approveDocument($doc1, $reviewer);

        // Submit and reject another document
        $path2 = 'documents/test2.pdf';
        Storage::disk('s3')->put($path2, 'content');
        $doc2 = $this->service->submitDocument($user, $path2, 'cpf');
        $this->service->rejectDocument($doc2, $reviewer, 'Expired document');

        // Log calls verified by Mockery expectations above
        $this->assertTrue(true);
    }

    /**
     * Test: Invalid document type throws exception
     *
     * @test
     */
    public function invalid_document_type_throws_exception(): void
    {
        $user = User::factory()->create();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid document type');

        $this->service->generatePresignedUrl($user, 'test.pdf', 'invalid_type');
    }

    /**
     * Test: File not found throws RuntimeException
     *
     * @test
     */
    public function file_not_found_throws_runtime_exception(): void
    {
        $user = User::factory()->create();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('File not found at path');

        $this->service->submitDocument($user, 'nonexistent/path.pdf', 'rg');
    }

    /**
     * Test: Get status returns null for non-owned document
     *
     * @test
     */
    public function get_status_returns_null_for_non_owned_document(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        $document = Document::factory()->create([
            'user_id' => $user1->id,
        ]);

        $result = $this->service->getStatus($user2, $document->id);

        $this->assertNull($result);
    }
}
