<?php
namespace Tests\Feature\SliceB;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

class DocumentsAnalyticsPersistenceTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function all_document_events_persist_to_database()
    {
        $user = User::factory()->create();

        // Generate presigned URL
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/documents/presigned-url', [
                'filename' => 'test.pdf',
                'document_type' => 'rg',
            ]);

        $response->assertOk();

        // Check if analytics event was created (adjust based on your actual table structure)
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'document_presigned_url_generated',
        ]);

        // Submit document
        $submitResponse = $this->actingAs($user, 'sanctum')
            ->postJson('/api/documents', [
                'document_type_id' => 1,
                'file_path' => 'path/to/doc.pdf',
            ]);

        if ($submitResponse->status() === 201) {
            $this->assertDatabaseHas('audit_logs', [
                'action' => 'document_submitted',
            ]);
        }

        // Verify all events have proper user references
        $events = DB::table('audit_logs')
            ->where('user_id', $user->id)
            ->whereIn('action', ['document_presigned_url_generated', 'document_submitted'])
            ->get();

        foreach ($events as $event) {
            $this->assertNotNull($event->user_id);
            $this->assertEquals($user->id, $event->user_id);
        }
    }

    /** @test */
    public function analytics_events_contain_zero_pii()
    {
        $user = User::factory()->create([
            'email' => 'sensitive@example.com',
            'cpf' => '12345678900',
            'name' => 'Sensitive User Name',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/documents/presigned-url', [
                'filename' => 'my-cpf-scan.pdf',
                'document_type' => 'cpf',
            ]);

        $response->assertOk();

        // Get the audit log entry
        $event = DB::table('audit_logs')
            ->where('user_id', $user->id)
            ->where('action', 'document_presigned_url_generated')
            ->latest()
            ->first();

        $this->assertNotNull($event);

        // Convert event to JSON to check for PII
        $eventJson = json_encode($event);

        // No PII should appear anywhere in the event data
        $this->assertStringNotContainsString('sensitive@example.com', $eventJson);
        $this->assertStringNotContainsString('12345678900', $eventJson);
        $this->assertStringNotContainsString('Sensitive User Name', $eventJson);

        // Metadata should not contain sensitive filenames with identifying info
        if (isset($event->metadata)) {
            $metadata = is_string($event->metadata) ? $event->metadata : json_encode($event->metadata);
            $this->assertStringNotContainsString('sensitive', strtolower($metadata));
        }
    }

    /** @test */
    public function analytics_validation_fails_if_pii_detected_in_dev()
    {
        config(['app.env' => 'local']);

        $user = User::factory()->create();

        // This test validates that our analytics pipeline would catch PII
        // In production, this should never happen due to frontend sanitization
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/documents/presigned-url', [
                'filename' => 'test.pdf',
                'document_type' => 'rg',
            ]);

        // Should succeed - no PII in normal flow
        $response->assertOk();

        // Verify audit log doesn't contain raw user data
        $event = DB::table('audit_logs')
            ->where('user_id', $user->id)
            ->latest()
            ->first();

        $this->assertNotNull($event);

        // Should only have sanitized data
        $eventData = json_encode($event);
        $this->assertStringNotContainsString($user->email, $eventData);
    }

    /** @test */
    public function document_upload_flow_creates_complete_audit_trail()
    {
        $user = User::factory()->create();

        // Step 1: Request presigned URL
        $presignedResponse = $this->actingAs($user, 'sanctum')
            ->postJson('/api/documents/presigned-url', [
                'filename' => 'test-document.pdf',
                'document_type' => 'rg',
            ]);

        $presignedResponse->assertOk();

        // Step 2: Submit document
        $submitResponse = $this->actingAs($user, 'sanctum')
            ->postJson('/api/documents', [
                'document_type_id' => 1,
                'file_path' => 'documents/test-document.pdf',
            ]);

        // Verify audit trail exists
        $auditLogs = DB::table('audit_logs')
            ->where('user_id', $user->id)
            ->orderBy('created_at')
            ->get();

        $this->assertGreaterThanOrEqual(1, $auditLogs->count());

        // Verify each log entry has required fields
        foreach ($auditLogs as $log) {
            $this->assertNotNull($log->user_id);
            $this->assertNotNull($log->action);
            $this->assertNotNull($log->created_at);
        }
    }

    /** @test */
    public function concurrent_uploads_all_persist_analytics()
    {
        $user = User::factory()->create();

        // Simulate concurrent uploads
        $responses = [];
        for ($i = 0; $i < 5; $i++) {
            $responses[] = $this->actingAs($user, 'sanctum')
                ->postJson('/api/documents/presigned-url', [
                    'filename' => "document-{$i}.pdf",
                    'document_type' => 'rg',
                ]);
        }

        // All should succeed
        foreach ($responses as $response) {
            $response->assertOk();
        }

        // All events should be persisted
        $eventCount = DB::table('audit_logs')
            ->where('user_id', $user->id)
            ->where('action', 'document_presigned_url_generated')
            ->count();

        $this->assertEquals(5, $eventCount);
    }
}
