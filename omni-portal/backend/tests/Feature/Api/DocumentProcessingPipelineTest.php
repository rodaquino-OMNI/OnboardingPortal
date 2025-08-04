<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\PerformanceReport;
use App\Services\OCRService;
use App\Services\DocumentValidationService;
use App\Jobs\ProcessDocumentOCR;
use App\Jobs\ValidateDocument;
use App\Jobs\GenerateDocumentThumbnail;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Mockery;

class DocumentProcessingPipelineTest extends TestCase
{
    use RefreshDatabase;

    private $user;
    private $beneficiary;
    private $ocrService;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        Storage::fake('local');
        Storage::fake('s3');
        Queue::fake();
        
        // Create test user
        $this->user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create(['user_id' => $this->user->id]);
        
        // Seed document types
        $this->seedDocumentTypes();
        
        // Mock OCR service
        $this->ocrService = Mockery::mock(OCRService::class);
        $this->app->instance(OCRService::class, $this->ocrService);
    }

    /**
     * Test complete document upload and OCR processing pipeline
     */
    public function test_complete_document_processing_pipeline(): void
    {
        Sanctum::actingAs($this->user);
        
        // Mock successful OCR response
        $this->ocrService->shouldReceive('processDocument')
            ->once()
            ->andReturn([
                'success' => true,
                'text' => 'John Doe\nRG: 12.345.678-9\nCPF: 123.456.789-00',
                'confidence' => 0.95,
                'metadata' => [
                    'processing_time' => 1.5,
                    'service' => 'primary'
                ]
            ]);
        
        // Upload document
        $file = UploadedFile::fake()->image('rg.jpg', 1200, 800);
        
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => DocumentType::where('code', 'RG')->first()->id,
            'file' => $file,
            'enable_ocr' => true,
            'auto_validate' => true
        ]);
        
        $response->assertStatus(201)
            ->assertJsonStructure([
                'document' => [
                    'id',
                    'status',
                    'ocr_status',
                    'file_path',
                    'thumbnail_path'
                ]
            ]);
        
        $documentId = $response->json('document.id');
        
        // Verify jobs were queued
        Queue::assertPushed(ProcessDocumentOCR::class, function ($job) use ($documentId) {
            return $job->documentId === $documentId;
        });
        
        Queue::assertPushed(GenerateDocumentThumbnail::class);
        Queue::assertPushed(ValidateDocument::class);
        
        // Check processing status
        $response = $this->getJson("/api/v3/documents/{$documentId}/status");
        
        $response->assertStatus(200)
            ->assertJson([
                'document' => [
                    'status' => 'processing',
                    'ocr_status' => 'pending'
                ]
            ]);
        
        // Simulate job processing
        $this->processQueuedJobs();
        
        // Verify final status
        $document = Document::find($documentId);
        $this->assertEquals('validated', $document->status);
        $this->assertEquals('completed', $document->ocr_status);
        $this->assertNotNull($document->ocr_data);
        $this->assertEquals(0.95, $document->ocr_data['confidence']);
    }

    /**
     * Test OCR fallback mechanism
     */
    public function test_ocr_fallback_mechanism(): void
    {
        Sanctum::actingAs($this->user);
        
        // Mock primary OCR failure
        $this->ocrService->shouldReceive('processDocument')
            ->once()
            ->andReturn([
                'success' => false,
                'error' => 'Service unavailable'
            ]);
        
        // Mock fallback OCR success
        $this->ocrService->shouldReceive('processDocumentWithFallback')
            ->once()
            ->andReturn([
                'success' => true,
                'text' => 'Extracted text from fallback',
                'confidence' => 0.85,
                'metadata' => [
                    'service' => 'fallback',
                    'provider' => 'secondary'
                ]
            ]);
        
        $file = UploadedFile::fake()->image('cpf.jpg');
        
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => DocumentType::where('code', 'CPF')->first()->id,
            'file' => $file,
            'enable_ocr' => true
        ]);
        
        $response->assertStatus(201);
        $documentId = $response->json('document.id');
        
        // Process jobs (primary will fail)
        $this->processQueuedJobs();
        
        // Check that fallback was triggered
        $response = $this->postJson("/api/v3/documents/{$documentId}/reprocess", [
            'use_fallback' => true
        ]);
        
        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Document reprocessing initiated',
                'fallback_service' => true
            ]);
        
        // Verify fallback results
        $document = Document::find($documentId);
        $this->assertEquals('fallback', $document->ocr_metadata['service']);
        $this->assertEquals('secondary', $document->ocr_metadata['provider']);
    }

    /**
     * Test batch document processing
     */
    public function test_batch_document_processing(): void
    {
        Sanctum::actingAs($this->user);
        
        $documents = [];
        $documentTypes = ['RG', 'CPF', 'COMP_RES'];
        
        // Upload multiple documents
        foreach ($documentTypes as $type) {
            $file = UploadedFile::fake()->image("{$type}.pdf", 1000, 1400);
            
            $response = $this->postJson('/api/v3/documents/upload', [
                'document_type_id' => DocumentType::where('code', $type)->first()->id,
                'file' => $file,
                'enable_ocr' => true
            ]);
            
            $response->assertStatus(201);
            $documents[] = $response->json('document.id');
        }
        
        // Verify batch queue optimization
        $pushedJobs = Queue::pushed(ProcessDocumentOCR::class);
        $this->assertCount(3, $pushedJobs);
        
        // Check batch processing status
        $response = $this->postJson('/api/documents/batch-status', [
            'document_ids' => $documents
        ]);
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'documents' => [
                    '*' => [
                        'id',
                        'status',
                        'ocr_status',
                        'progress_percentage'
                    ]
                ],
                'summary' => [
                    'total',
                    'completed',
                    'processing',
                    'failed'
                ]
            ]);
    }

    /**
     * Test document validation pipeline
     */
    public function test_document_validation_pipeline(): void
    {
        Sanctum::actingAs($this->user);
        
        // Mock OCR with extractable data
        $this->ocrService->shouldReceive('processDocument')
            ->andReturn([
                'success' => true,
                'text' => "REGISTRO GERAL\nNOME: JOÃO SILVA\nRG: 12.345.678-9\nDATA NASC: 15/01/1990\nVALIDADE: 15/01/2025",
                'confidence' => 0.92,
                'extracted_fields' => [
                    'document_number' => '12.345.678-9',
                    'name' => 'JOÃO SILVA',
                    'birth_date' => '1990-01-15',
                    'expiry_date' => '2025-01-15'
                ]
            ]);
        
        $file = UploadedFile::fake()->image('rg_valid.jpg');
        
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => DocumentType::where('code', 'RG')->first()->id,
            'file' => $file,
            'enable_ocr' => true,
            'auto_validate' => true,
            'validation_rules' => [
                'check_expiry' => true,
                'verify_name' => true,
                'minimum_confidence' => 0.9
            ]
        ]);
        
        $response->assertStatus(201);
        $documentId = $response->json('document.id');
        
        // Process validation
        $this->processQueuedJobs();
        
        // Check validation results
        $response = $this->getJson("/api/documents/{$documentId}");
        
        $response->assertStatus(200)
            ->assertJson([
                'document' => [
                    'validation_status' => 'validated',
                    'validation_results' => [
                        'expiry_check' => 'passed',
                        'name_verification' => 'passed',
                        'confidence_check' => 'passed'
                    ]
                ]
            ]);
    }

    /**
     * Test document processing performance metrics
     */
    public function test_document_processing_performance_metrics(): void
    {
        Sanctum::actingAs($this->user);
        
        // Process multiple documents to generate metrics
        for ($i = 0; $i < 5; $i++) {
            $file = UploadedFile::fake()->image("doc_{$i}.jpg");
            
            $this->postJson('/api/v3/documents/upload', [
                'document_type_id' => 1,
                'file' => $file,
                'enable_ocr' => true
            ]);
        }
        
        // Get performance report
        $response = $this->getJson('/api/v3/documents/performance-report', [
            'period' => 'today',
            'metrics' => ['processing_time', 'ocr_accuracy', 'success_rate']
        ]);
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'report' => [
                    'period',
                    'total_processed',
                    'average_processing_time',
                    'ocr_accuracy',
                    'success_rate',
                    'failed_documents',
                    'processing_breakdown' => [
                        'upload_time',
                        'ocr_time',
                        'validation_time'
                    ]
                ]
            ]);
        
        // Verify metrics are being tracked
        $this->assertDatabaseHas('performance_reports', [
            'type' => 'document_processing',
            'period' => 'daily'
        ]);
    }

    /**
     * Test document type specific processing
     */
    public function test_document_type_specific_processing(): void
    {
        Sanctum::actingAs($this->user);
        
        // Test RG specific processing
        $rgFile = UploadedFile::fake()->image('rg.jpg');
        
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => DocumentType::where('code', 'RG')->first()->id,
            'file' => $rgFile,
            'enable_ocr' => true
        ]);
        
        $response->assertStatus(201);
        $rgDocId = $response->json('document.id');
        
        // Test CPF specific processing
        $cpfFile = UploadedFile::fake()->image('cpf.jpg');
        
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => DocumentType::where('code', 'CPF')->first()->id,
            'file' => $cpfFile,
            'enable_ocr' => true
        ]);
        
        $response->assertStatus(201);
        $cpfDocId = $response->json('document.id');
        
        // Verify different processing rules applied
        Queue::assertPushed(ProcessDocumentOCR::class, function ($job) use ($rgDocId) {
            return $job->documentId === $rgDocId && $job->processingRules['extract_photo'] === true;
        });
        
        Queue::assertPushed(ProcessDocumentOCR::class, function ($job) use ($cpfDocId) {
            return $job->documentId === $cpfDocId && $job->processingRules['validate_cpf'] === true;
        });
    }

    /**
     * Test document processing error handling
     */
    public function test_document_processing_error_handling(): void
    {
        Sanctum::actingAs($this->user);
        
        // Test corrupted file
        $corruptedFile = UploadedFile::fake()->create('corrupted.jpg', 0);
        
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => 1,
            'file' => $corruptedFile
        ]);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
        
        // Test unsupported format with graceful handling
        $unsupportedFile = UploadedFile::fake()->create('document.xyz', 100);
        
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => 1,
            'file' => $unsupportedFile
        ]);
        
        $response->assertStatus(422)
            ->assertJson([
                'errors' => [
                    'file' => ['The file must be a file of type: jpeg, jpg, png, pdf.']
                ]
            ]);
    }

    /**
     * Test document processing with network failures
     */
    public function test_document_processing_with_network_failures(): void
    {
        Sanctum::actingAs($this->user);
        
        // Mock network timeout
        Http::fake([
            'ocr-service.com/*' => Http::response([], 504) // Gateway timeout
        ]);
        
        $file = UploadedFile::fake()->image('document.jpg');
        
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => 1,
            'file' => $file,
            'enable_ocr' => true
        ]);
        
        $response->assertStatus(201);
        $documentId = $response->json('document.id');
        
        // Process with retry logic
        $maxRetries = 3;
        for ($i = 0; $i < $maxRetries; $i++) {
            $this->processQueuedJobs();
        }
        
        // Verify retry attempts logged
        $document = Document::find($documentId);
        $this->assertArrayHasKey('retry_count', $document->ocr_metadata);
        $this->assertEquals($maxRetries, $document->ocr_metadata['retry_count']);
    }

    /**
     * Test document caching strategy
     */
    public function test_document_caching_strategy(): void
    {
        Sanctum::actingAs($this->user);
        
        $file = UploadedFile::fake()->image('cached_doc.jpg');
        
        $response = $this->postJson('/api/documents/upload', [
            'document_type_id' => 1,
            'file' => $file
        ]);
        
        $documentId = $response->json('document.id');
        
        // First access - cache miss
        Cache::flush();
        $response = $this->getJson("/api/documents/{$documentId}");
        $response->assertStatus(200);
        
        // Verify cache was populated
        $cacheKey = "document.{$documentId}";
        $this->assertTrue(Cache::has($cacheKey));
        
        // Second access - cache hit
        $cachedResponse = $this->getJson("/api/documents/{$documentId}");
        $cachedResponse->assertStatus(200);
        
        // Verify same data
        $this->assertEquals(
            $response->json('document'),
            $cachedResponse->json('document')
        );
        
        // Update document invalidates cache
        Document::find($documentId)->update(['status' => 'reviewed']);
        $this->assertFalse(Cache::has($cacheKey));
    }

    /**
     * Test concurrent document uploads
     */
    public function test_concurrent_document_uploads(): void
    {
        Sanctum::actingAs($this->user);
        
        $concurrentUploads = 5;
        $responses = [];
        
        // Simulate concurrent uploads
        for ($i = 0; $i < $concurrentUploads; $i++) {
            $file = UploadedFile::fake()->image("concurrent_{$i}.jpg");
            
            $responses[] = $this->postJson('/api/v3/documents/upload', [
                'document_type_id' => rand(1, 3),
                'file' => $file,
                'enable_ocr' => true
            ]);
        }
        
        // All should succeed
        foreach ($responses as $response) {
            $response->assertStatus(201);
        }
        
        // Verify no duplicate processing
        $documentIds = array_map(fn($r) => $r->json('document.id'), $responses);
        $uniqueIds = array_unique($documentIds);
        
        $this->assertCount($concurrentUploads, $uniqueIds);
        
        // Verify queue has all jobs
        $queuedJobs = Queue::pushed(ProcessDocumentOCR::class);
        $this->assertCount($concurrentUploads, $queuedJobs);
    }

    /**
     * Helper: Process queued jobs
     */
    private function processQueuedJobs(): void
    {
        // Simulate job processing
        $jobs = Queue::pushed(ProcessDocumentOCR::class);
        
        foreach ($jobs as $job) {
            // Update document status as if job ran
            $document = Document::find($job->documentId);
            if ($document) {
                $document->update([
                    'ocr_status' => 'completed',
                    'status' => 'validated',
                    'ocr_data' => [
                        'text' => 'Processed text',
                        'confidence' => 0.95
                    ]
                ]);
            }
        }
    }

    /**
     * Helper: Seed document types
     */
    private function seedDocumentTypes(): void
    {
        DocumentType::insert([
            ['name' => 'RG', 'code' => 'RG', 'is_required' => true, 'processing_rules' => json_encode(['extract_photo' => true])],
            ['name' => 'CPF', 'code' => 'CPF', 'is_required' => true, 'processing_rules' => json_encode(['validate_cpf' => true])],
            ['name' => 'Comprovante de Residência', 'code' => 'COMP_RES', 'is_required' => true, 'processing_rules' => json_encode(['extract_address' => true])]
        ]);
    }

    protected function tearDown(): void
    {
        exec('npx claude-flow@alpha hooks post-edit --file "/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend/tests/Feature/Api/DocumentProcessingPipelineTest.php" --memory-key "analyzer/journey-tests/document-pipeline"');
        
        Mockery::close();
        parent::tearDown();
    }
}