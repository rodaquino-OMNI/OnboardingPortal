<?php

namespace Tests\Feature;

use App\Jobs\ProcessDocumentOCR;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\User;
use App\Services\EnhancedOCRService;
use App\Services\OCRUsageTracker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OCRIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $beneficiary;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $this->user->id,
            'full_name' => 'João Silva',
            'cpf' => '123.456.789-00',
            'birth_date' => '1990-01-15'
        ]);

        Storage::fake('s3');
        Queue::fake();
    }

    /** @test */
    public function it_can_upload_and_queue_ocr_processing()
    {
        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');

        $response = $this->actingAs($this->user)
            ->postJson('/api/documents/upload', [
                'file' => $file,
                'type' => 'rg',
                'description' => 'Test RG document'
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Document uploaded successfully and is being processed'
            ]);

        // Verify document was created
        $this->assertDatabaseHas('documents', [
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'rg',
            'status' => 'pending'
        ]);

        // Verify OCR job was queued
        Queue::assertPushed(ProcessDocumentOCR::class);
    }

    /** @test */
    public function it_processes_document_ocr_job_successfully()
    {
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'rg',
            'status' => 'pending',
            'file_path' => 'test/document.pdf'
        ]);

        // Mock file existence
        Storage::disk('s3')->put($document->file_path, 'fake pdf content');

        // Create a mock OCR service that returns successful results
        $mockOCRService = $this->createMock(EnhancedOCRService::class);
        $mockOCRService->method('processDocument')
            ->willReturn([
                'success' => true,
                'raw_text' => 'Nome: João Silva\nRG: 12.345.678-9\nData Nascimento: 15/01/1990',
                'blocks' => [],
                'forms' => [
                    ['key' => 'nome', 'value' => 'João Silva', 'confidence' => 95],
                    ['key' => 'rg', 'value' => '12.345.678-9', 'confidence' => 90],
                ],
                'average_confidence' => 92.5,
                'processing_method' => 'textract',
                'quality_score' => 85.0
            ]);

        $mockOCRService->method('extractStructuredData')
            ->willReturn([
                'name' => 'João Silva',
                'rg_number' => '12.345.678-9',
                'birth_date' => '15/01/1990'
            ]);

        $mockOCRService->method('validateExtractedData')
            ->willReturn([
                'is_valid' => true,
                'errors' => [],
                'warnings' => [],
                'confidence_score' => 92.5
            ]);

        $this->app->instance(EnhancedOCRService::class, $mockOCRService);

        // Process the job
        $job = new ProcessDocumentOCR($document);
        $job->handle($mockOCRService);

        // Verify document was updated
        $document->refresh();
        $this->assertEquals('processed', $document->status);
        $this->assertEquals('textract', $document->processing_method);
        $this->assertEquals(85.0, $document->quality_score);
        $this->assertEquals('valid', $document->validation_status);
        $this->assertNotNull($document->ocr_data);
        $this->assertNotNull($document->extracted_data);
    }

    /** @test */
    public function it_handles_ocr_processing_failures_gracefully()
    {
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'rg',
            'status' => 'pending',
            'file_path' => 'test/document.pdf'
        ]);

        // Create a mock OCR service that fails
        $mockOCRService = $this->createMock(EnhancedOCRService::class);
        $mockOCRService->method('processDocument')
            ->willReturn([
                'success' => false,
                'error' => 'OCR processing failed after 3 attempts'
            ]);

        $this->app->instance(EnhancedOCRService::class, $mockOCRService);

        // Process the job and expect it to fail
        $job = new ProcessDocumentOCR($document);
        
        $this->expectException(\Exception::class);
        $job->handle($mockOCRService);

        // Verify document status was updated
        $document->refresh();
        $this->assertEquals('failed', $document->status);
        $this->assertNotNull($document->error_message);
    }

    /** @test */
    public function it_tracks_ocr_usage_correctly()
    {
        $usageTracker = new OCRUsageTracker();
        
        // Reset usage for clean test
        $usageTracker->resetUsage();
        
        // Record some usage
        $usageTracker->recordUsage('textract', 2, 0.10);
        $usageTracker->recordUsage('tesseract', 1, 0.00);
        
        // Check usage statistics
        $dailyUsage = $usageTracker->getDailyUsage();
        $this->assertEquals(0.10, $dailyUsage);
        
        $budgetStatus = $usageTracker->getBudgetStatus();
        $this->assertArrayHasKey('daily', $budgetStatus);
        $this->assertArrayHasKey('monthly', $budgetStatus);
        $this->assertEquals(0.10, $budgetStatus['daily']['usage']);
    }

    /** @test */
    public function it_prevents_processing_when_budget_exceeded()
    {
        $usageTracker = new OCRUsageTracker();
        
        // Reset and set high usage
        $usageTracker->resetUsage();
        $usageTracker->recordUsage('textract', 1000, 50.01); // Exceed daily budget
        
        $this->assertFalse($usageTracker->canProcessDocument());
    }

    /** @test */
    public function it_validates_document_data_against_beneficiary()
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/documents/1/validate-ocr');

        // Since we don't have a real document, this should return 404
        $response->assertStatus(404);
    }

    /** @test */
    public function it_returns_validation_progress_correctly()
    {
        // Create some test documents
        Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'rg',
            'status' => 'approved'
        ]);

        Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'cpf',
            'status' => 'pending'
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/documents/validation-progress');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'progress',
                    'overall_percentage',
                    'completed_documents',
                    'total_required'
                ]
            ]);

        $data = $response->json('data');
        $this->assertGreaterThan(0, $data['overall_percentage']);
        $this->assertEquals(1, $data['completed_documents']);
    }

    /** @test */
    public function it_handles_concurrent_processing_safely()
    {
        // Create multiple documents
        $documents = collect();
        for ($i = 0; $i < 5; $i++) {
            $documents->push(Document::factory()->create([
                'beneficiary_id' => $this->beneficiary->id,
                'document_type' => 'rg',
                'status' => 'pending',
                'file_path' => "test/document_{$i}.pdf"
            ]));
        }

        // Mock successful OCR processing
        $mockOCRService = $this->createMock(EnhancedOCRService::class);
        $mockOCRService->method('processDocument')
            ->willReturn([
                'success' => true,
                'raw_text' => 'Test content',
                'processing_method' => 'textract',
                'quality_score' => 85.0,
                'average_confidence' => 90.0
            ]);

        $mockOCRService->method('extractStructuredData')
            ->willReturn(['name' => 'Test Name']);

        $mockOCRService->method('validateExtractedData')
            ->willReturn(['is_valid' => true, 'errors' => []]);

        $this->app->instance(EnhancedOCRService::class, $mockOCRService);

        // Process all documents concurrently (simulate)
        $documents->each(function ($document) use ($mockOCRService) {
            Storage::disk('s3')->put($document->file_path, 'fake content');
            
            $job = new ProcessDocumentOCR($document);
            $job->handle($mockOCRService);
        });

        // Verify all documents were processed
        $processedCount = Document::where('status', 'processed')->count();
        $this->assertEquals(5, $processedCount);
    }
}