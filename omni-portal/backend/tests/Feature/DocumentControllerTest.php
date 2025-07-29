<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Services\OCRService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Mockery;

class DocumentControllerTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $beneficiary;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('s3');

        $this->user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create(['user_id' => $this->user->id]);
    }

    /** @test */
    public function it_can_get_all_documents_for_authenticated_user()
    {
        Sanctum::actingAs($this->user);

        Document::factory()->count(3)->create([
            'beneficiary_id' => $this->beneficiary->id
        ]);

        $response = $this->getJson('/api/documents');

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        '*' => [
                            'id',
                            'document_type',
                            'file_path',
                            'status',
                            'created_at'
                        ]
                    ]
                ]);
    }

    /** @test */
    public function it_can_upload_a_document()
    {
        Sanctum::actingAs($this->user);

        $file = UploadedFile::fake()->image('rg.jpg', 800, 600)->size(5000); // 5MB

        $response = $this->postJson('/api/documents/upload', [
            'file' => $file,
            'document_type' => 'rg',
            'description' => 'Documento de identidade'
        ]);

        $response->assertStatus(201)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'id',
                        'type',
                        'file_path',
                        'status'
                    ]
                ]);

        $this->assertDatabaseHas('documents', [
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'rg',
            'status' => 'processing'
        ]);

        Storage::disk('s3')->assertExists($response->json('data.file_path'));
    }

    /** @test */
    public function it_validates_file_upload_requirements()
    {
        Sanctum::actingAs($this->user);

        // Test file size limit
        $largefile = UploadedFile::fake()->create('large.pdf', 15000); // 15MB - exceeds limit

        $response = $this->postJson('/api/documents/upload', [
            'file' => $largefile,
            'document_type' => 'rg'
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['file']);

        // Test invalid file type
        $invalidFile = UploadedFile::fake()->create('document.txt');

        $response = $this->postJson('/api/documents/upload', [
            'file' => $invalidFile,
            'document_type' => 'rg'
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['file']);

        // Test invalid document type
        $validFile = UploadedFile::fake()->image('document.jpg');

        $response = $this->postJson('/api/documents/upload', [
            'file' => $validFile,
            'type' => 'invalid_type'
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['type']);
    }

    /** @test */
    public function it_can_get_document_details()
    {
        Sanctum::actingAs($this->user);

        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'ocr_data' => [
                'extracted_text' => 'Sample extracted text',
                'confidence' => 0.95
            ]
        ]);

        $response = $this->getJson("/api/documents/{$document->id}");

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'id',
                        'type',
                        'ocr_data',
                        'status'
                    ]
                ]);
    }

    /** @test */
    public function it_can_generate_download_url()
    {
        Sanctum::actingAs($this->user);

        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'file_path' => 'documents/1/test.jpg'
        ]);

        Storage::disk('s3')->put($document->file_path, 'fake file content');

        $response = $this->getJson("/api/documents/{$document->id}/download");

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'download_url',
                        'expires_at'
                    ]
                ]);
    }

    /** @test */
    public function it_can_delete_a_document()
    {
        Sanctum::actingAs($this->user);

        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'file_path' => 'documents/1/test.jpg'
        ]);

        Storage::disk('s3')->put($document->file_path, 'fake file content');

        $response = $this->deleteJson("/api/documents/{$document->id}");

        $response->assertStatus(200)
                ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('documents', ['id' => $document->id]);
        Storage::disk('s3')->assertMissing($document->file_path);
    }

    /** @test */
    public function it_can_trigger_ocr_processing()
    {
        Sanctum::actingAs($this->user);

        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'uploaded'
        ]);

        $response = $this->postJson("/api/documents/{$document->id}/process-ocr");

        $response->assertStatus(200)
                ->assertJson(['success' => true]);

        $document->refresh();
        $this->assertEquals('processing', $document->status);
    }

    /** @test */
    public function it_prevents_duplicate_ocr_processing()
    {
        Sanctum::actingAs($this->user);

        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'processing'
        ]);

        $response = $this->postJson("/api/documents/{$document->id}/process-ocr");

        $response->assertStatus(409)
                ->assertJson([
                    'success' => false,
                    'message' => 'Document is already being processed'
                ]);
    }

    /** @test */
    public function it_can_validate_ocr_results()
    {
        Sanctum::actingAs($this->user);

        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'rg',
            'ocr_data' => [
                'name' => 'JOÃO SILVA',
                'rg_number' => '12.345.678-9'
            ]
        ]);

        // Mock OCR service
        $this->app->bind(OCRService::class, function () {
            $mock = Mockery::mock(OCRService::class);
            $mock->shouldReceive('validateExtractedData')
                 ->andReturn([
                     'is_valid' => true,
                     'errors' => [],
                     'confidence_score' => 95
                 ]);
            return $mock;
        });

        $response = $this->postJson("/api/documents/{$document->id}/validate-ocr");

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'validation' => [
                            'is_valid',
                            'confidence_score'
                        ],
                        'document'
                    ]
                ]);

        $document->refresh();
        $this->assertEquals('approved', $document->status);
    }

    /** @test */
    public function it_can_get_validation_progress()
    {
        Sanctum::actingAs($this->user);

        // Create documents with various statuses
        Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'rg',
            'status' => 'approved'
        ]);

        Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'document_type' => 'cpf',
            'status' => 'processing'
        ]);

        $response = $this->getJson('/api/documents/validation-progress');

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'progress' => [
                            'rg' => [
                                'uploaded',
                                'status',
                                'required'
                            ]
                        ],
                        'overall_percentage',
                        'completed_documents',
                        'total_required'
                    ]
                ]);
    }

    /** @test */
    public function it_prevents_unauthorized_access_to_documents()
    {
        $otherUser = User::factory()->create();
        $otherBeneficiary = Beneficiary::factory()->create(['user_id' => $otherUser->id]);
        
        $document = Document::factory()->create([
            'beneficiary_id' => $otherBeneficiary->id
        ]);

        Sanctum::actingAs($this->user);

        // Test accessing other user's document
        $response = $this->getJson("/api/documents/{$document->id}");
        $response->assertStatus(404);

        $response = $this->deleteJson("/api/documents/{$document->id}");
        $response->assertStatus(404);

        $response = $this->getJson("/api/documents/{$document->id}/download");
        $response->assertStatus(404);
    }

    /** @test */
    public function it_handles_storage_failures_gracefully()
    {
        Sanctum::actingAs($this->user);

        // Force storage failure
        Storage::shouldReceive('disk')->andThrow(new \Exception('Storage unavailable'));

        $file = UploadedFile::fake()->image('test.jpg');

        $response = $this->postJson('/api/documents/upload', [
            'file' => $file,
            'document_type' => 'rg'
        ]);

        $response->assertStatus(500)
                ->assertJson([
                    'success' => false
                ]);
    }

    /** @test */
    public function it_requires_authentication_for_all_endpoints()
    {
        $file = UploadedFile::fake()->image('test.jpg');

        $endpoints = [
            ['GET', '/api/documents', []],
            ['POST', '/api/documents/upload', ['file' => $file, 'document_type' => 'rg']],
            ['GET', '/api/documents/validation-progress', []],
            ['GET', '/api/documents/1', []],
            ['GET', '/api/documents/1/download', []],
            ['POST', '/api/documents/1/process-ocr', []],
            ['POST', '/api/documents/1/validate-ocr', []],
            ['DELETE', '/api/documents/1', []]
        ];

        foreach ($endpoints as $endpoint) {
            $method = $endpoint[0];
            $url = $endpoint[1];
            $data = $endpoint[2] ?? [];
            $response = $this->json($method, $url, $data);
            $response->assertStatus(401);
        }
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}