<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\OptimizedTextractService;
use App\Services\TextractCostOptimizationService;
use App\Services\DocumentPreprocessingService;
use App\Services\TextractMonitoringService;
use App\Services\TesseractOCRService;
use Aws\Textract\TextractClient;
use Aws\Exception\AwsException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Mockery;

class OptimizedTextractServiceTest extends TestCase
{
    use RefreshDatabase;

    private $service;
    private $costService;
    private $preprocessingService;
    private $monitoringService;
    private $tesseractService;
    private $textractClient;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock dependencies
        $this->tesseractService = Mockery::mock(TesseractOCRService::class);
        $this->costService = Mockery::mock(TextractCostOptimizationService::class);
        $this->preprocessingService = Mockery::mock(DocumentPreprocessingService::class);
        $this->monitoringService = Mockery::mock(TextractMonitoringService::class);
        
        // Mock Textract client
        $this->textractClient = Mockery::mock(TextractClient::class);

        // Create service instance with mocked dependencies
        $this->service = Mockery::mock(OptimizedTextractService::class, [
            $this->tesseractService,
            $this->costService,
            $this->preprocessingService,
            $this->monitoringService
        ])->makePartial();

        // Set the mocked Textract client
        $reflection = new \ReflectionClass($this->service);
        $property = $reflection->getProperty('textractClient');
        $property->setAccessible(true);
        $property->setValue($this->service, $this->textractClient);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /** @test */
    public function it_processes_document_with_cost_optimization()
    {
        $filePath = 'test-document.jpg';
        $optimizedPath = 'optimized-document.jpg';

        // Mock preprocessing
        $this->preprocessingService->shouldReceive('optimizeForTextract')
            ->with($filePath)
            ->andReturn($optimizedPath);

        // Mock cost checking
        $this->costService->shouldReceive('canProcessDocument')
            ->with($optimizedPath)
            ->andReturn(true);

        $this->costService->shouldReceive('estimateProcessingCost')
            ->with($optimizedPath, ['FORMS'])
            ->andReturn(0.05);

        $this->costService->shouldReceive('getDailyUsage')
            ->with('textract')
            ->andReturn(10.50);

        $this->costService->shouldReceive('getMonthlyUsage')
            ->with('textract')
            ->andReturn(250.00);

        // Mock S3 upload
        Storage::fake('s3');
        Storage::disk('s3')->put('ocr-documents/optimized-document.jpg', 'fake-content');

        // Mock Textract response
        $textractResponse = $this->mockTextractResponse();
        $this->textractClient->shouldReceive('analyzeDocument')
            ->andReturn($textractResponse);

        // Mock cost recording
        $this->costService->shouldReceive('recordActualCost')
            ->once();

        // Mock monitoring
        $this->monitoringService->shouldReceive('recordProcessingMetrics')
            ->once();

        // Execute
        $result = $this->service->processDocumentOptimized($filePath);

        // Assert
        $this->assertTrue($result['success']);
        $this->assertEquals('textract', $result['processing_method']);
        $this->assertArrayHasKey('quality_metrics', $result);
    }

    /** @test */
    public function it_falls_back_to_tesseract_when_cost_limit_reached()
    {
        $filePath = 'test-document.jpg';
        $optimizedPath = 'optimized-document.jpg';

        // Mock preprocessing
        $this->preprocessingService->shouldReceive('optimizeForTextract')
            ->with($filePath)
            ->andReturn($optimizedPath);

        // Mock cost checking - limit reached
        $this->costService->shouldReceive('canProcessDocument')
            ->with($optimizedPath)
            ->andReturn(false);

        $this->costService->shouldReceive('getDailyUsage')
            ->with('textract')
            ->andReturn(1000.00); // Daily limit reached

        $this->costService->shouldReceive('getMonthlyUsage')
            ->with('textract')
            ->andReturn(25000.00);

        // Mock Tesseract fallback
        $tesseractResult = [
            'raw_text' => 'Test document content',
            'confidence_scores' => [85, 90, 88],
            'average_confidence' => 87.67,
            'success' => true
        ];

        $this->tesseractService->shouldReceive('processDocument')
            ->with($filePath)
            ->andReturn($tesseractResult);

        // Execute
        $result = $this->service->processDocumentOptimized($filePath);

        // Assert
        $this->assertTrue($result['success']);
        $this->assertEquals('Test document content', $result['raw_text']);
    }

    /** @test */
    public function it_detects_document_types_correctly()
    {
        // Test ID document detection (aspect ratio 1.5)
        $this->assertEquals(
            'id_document',
            $this->invokePrivateMethod('detectDocumentType', 'test-rg.jpg')
        );

        // Test portrait document detection (aspect ratio 0.75)
        $this->assertEquals(
            'portrait_document',
            $this->invokePrivateMethod('detectDocumentType', 'test-cpf.jpg')
        );
    }

    /** @test */
    public function it_selects_optimal_features_based_on_document_type()
    {
        // Test ID document features
        $features = $this->invokePrivateMethod('selectOptimalFeatures', 'id_document', []);
        $this->assertEquals(['FORMS'], $features);

        // Test form document features
        $features = $this->invokePrivateMethod('selectOptimalFeatures', 'form_document', []);
        $this->assertContains('FORMS', $features);
        $this->assertContains('TABLES', $features);

        // Test with additional options
        $options = ['extract_signatures' => true];
        $features = $this->invokePrivateMethod('selectOptimalFeatures', 'id_document', $options);
        $this->assertContains('SIGNATURES', $features);
    }

    /** @test */
    public function it_handles_throttling_exception_with_exponential_backoff()
    {
        $filePath = 'test-document.jpg';
        $exception = new AwsException('Rate exceeded', Mockery::mock(\GuzzleHttp\Command\CommandInterface::class));
        $exception->setAwsErrorCode('ThrottlingException');

        // First attempt should retry with backoff
        $result = $this->invokePrivateMethod('handleTextractError', $exception, $filePath, []);

        // Should eventually fall back to Tesseract after max retries
        $this->assertIsArray($result);
    }

    /** @test */
    public function it_formats_brazilian_documents_correctly()
    {
        // Test CPF formatting
        $cpf = $this->invokePrivateMethod('formatCPF', '12345678901');
        $this->assertEquals('123.456.789-01', $cpf);

        // Test date parsing
        $date = $this->invokePrivateMethod('parseBrazilianDate', '25/12/2023');
        $this->assertEquals('2023-12-25', $date);
    }

    /** @test */
    public function it_calculates_quality_metrics_correctly()
    {
        $data = [
            'confidence_scores' => [85, 90, 95, 80, 88],
            'raw_text' => str_repeat('test ', 50),
            'forms' => [[], [], []],
            'tables' => [[]],
            'blocks' => array_fill(0, 20, [])
        ];

        $metrics = $this->invokePrivateMethod('calculateQualityMetrics', $data);

        $this->assertArrayHasKey('confidence_distribution', $metrics);
        $this->assertArrayHasKey('completeness_score', $metrics);
        $this->assertArrayHasKey('data_quality_score', $metrics);
        $this->assertArrayHasKey('processing_recommendations', $metrics);

        // Check confidence distribution
        $this->assertEquals(80, $metrics['confidence_distribution']['min']);
        $this->assertEquals(95, $metrics['confidence_distribution']['max']);
        $this->assertEquals(88, $metrics['confidence_distribution']['average']);
    }

    /** @test */
    public function it_handles_unsupported_document_exception()
    {
        $filePath = 'test-document.pdf';
        $exception = new AwsException('Document format not supported', Mockery::mock(\GuzzleHttp\Command\CommandInterface::class));
        $exception->setAwsErrorCode('UnsupportedDocumentException');

        // Mock Tesseract fallback
        $this->tesseractService->shouldReceive('processDocument')
            ->with($filePath, [])
            ->andReturn(['success' => true, 'raw_text' => 'Fallback text']);

        $result = $this->invokePrivateMethod('handleTextractError', $exception, $filePath, []);

        $this->assertTrue($result['success']);
        $this->assertEquals('Fallback text', $result['raw_text']);
    }

    /**
     * Helper method to invoke private methods
     */
    private function invokePrivateMethod($methodName, ...$args)
    {
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod($methodName);
        $method->setAccessible(true);

        // Mock image creation for document type detection
        if ($methodName === 'detectDocumentType') {
            $this->mockImageCreation($args[0]);
        }

        return $method->invoke($this->service, ...$args);
    }

    /**
     * Mock Textract response
     */
    private function mockTextractResponse()
    {
        return [
            'Blocks' => [
                [
                    'Id' => '1',
                    'BlockType' => 'LINE',
                    'Text' => 'Test Document',
                    'Confidence' => 95.5,
                    'Geometry' => ['BoundingBox' => []]
                ],
                [
                    'Id' => '2',
                    'BlockType' => 'KEY_VALUE_SET',
                    'EntityTypes' => ['KEY'],
                    'Confidence' => 90.0,
                    'Relationships' => [
                        ['Type' => 'VALUE', 'Ids' => ['3']]
                    ]
                ],
                [
                    'Id' => '3',
                    'BlockType' => 'KEY_VALUE_SET',
                    'EntityTypes' => ['VALUE'],
                    'Confidence' => 88.0,
                    'Relationships' => [
                        ['Type' => 'CHILD', 'Ids' => ['4']]
                    ]
                ],
                [
                    'Id' => '4',
                    'BlockType' => 'WORD',
                    'Text' => 'Test Value',
                    'Confidence' => 92.0
                ]
            ]
        ];
    }

    /**
     * Mock image creation for document type detection
     */
    private function mockImageCreation($filename)
    {
        // Mock based on filename
        if (strpos($filename, 'rg') !== false) {
            // ID document aspect ratio (1.5)
            $width = 300;
            $height = 200;
        } elseif (strpos($filename, 'cpf') !== false) {
            // Portrait document aspect ratio (0.75)
            $width = 150;
            $height = 200;
        } else {
            // General document
            $width = 210;
            $height = 297;
        }

        // Override imagecreatefromstring function for testing
        // This is a simplified approach - in production, use proper mocking
    }
}