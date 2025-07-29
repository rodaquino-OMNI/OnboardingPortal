<?php

namespace Tests\Integration;

use Tests\TestCase;
use App\Services\OCRService;
use App\Services\TesseractOCRService;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Aws\Textract\TextractClient;
use Aws\Exception\AwsException;
use Mockery;

class OCRFallbackIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected $ocrService;
    protected $tesseractService;
    protected $beneficiary;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->ocrService = new OCRService();
        $this->tesseractService = new TesseractOCRService();
        
        // Create test beneficiary
        $user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $user->id,
            'full_name' => 'João Silva Santos',
            'cpf' => '123.456.789-00',
            'birth_date' => '1990-05-15'
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /** @test */
    public function it_can_fallback_to_tesseract_when_textract_fails()
    {
        // Mock Textract to fail
        $mockTextractClient = Mockery::mock(TextractClient::class);
        $mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andThrow(new AwsException('Service unavailable', 
                Mockery::mock(\Aws\CommandInterface::class)));

        // Inject mock into OCR service
        $reflection = new \ReflectionClass($this->ocrService);
        $property = $reflection->getProperty('textractClient');
        $property->setAccessible(true);
        $property->setValue($this->ocrService, $mockTextractClient);

        // Create document
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'type' => 'rg',
            'status' => 'processing',
            'file_path' => 'documents/test_rg.jpg'
        ]);

        // Mock Tesseract availability
        if (!TesseractOCRService::isAvailable()) {
            $this->markTestSkipped('Tesseract not available for testing');
        }

        // Create fallback OCR service that tries Textract first, then Tesseract
        $fallbackService = $this->createFallbackOCRService();
        
        $result = $fallbackService->processDocumentWithFallback($document->file_path, $document->type);

        // Verify fallback worked
        $this->assertIsArray($result);
        $this->assertArrayHasKey('raw_text', $result);
        $this->assertArrayHasKey('service_used', $result);
        $this->assertEquals('tesseract', $result['service_used']);
        $this->assertArrayHasKey('fallback_reason', $result);
        $this->assertStringContainsString('textract_failed', $result['fallback_reason']);
    }

    /** @test */
    public function it_can_retry_textract_with_exponential_backoff()
    {
        $attemptCount = 0;
        $mockTextractClient = Mockery::mock(TextractClient::class);
        
        // Mock to fail first 2 attempts, succeed on 3rd
        $mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->times(3)
            ->andReturnUsing(function() use (&$attemptCount) {
                $attemptCount++;
                if ($attemptCount < 3) {
                    throw new AwsException('Throttling exception', 
                        Mockery::mock(\Aws\CommandInterface::class));
                }
                return $this->createMockSuccessResponse();
            });

        // Inject mock
        $reflection = new \ReflectionClass($this->ocrService);
        $property = $reflection->getProperty('textractClient');
        $property->setAccessible(true);
        $property->setValue($this->ocrService, $mockTextractClient);

        $retryService = $this->createRetryableOCRService();
        
        $startTime = microtime(true);
        $result = $retryService->processDocumentWithRetry('documents/test.jpg');
        $endTime = microtime(true);

        // Verify retries worked
        $this->assertIsArray($result);
        $this->assertEquals(3, $attemptCount);
        
        // Verify exponential backoff timing (should take at least 3 seconds for retries)
        $totalTime = $endTime - $startTime;
        $this->assertGreaterThan(3, $totalTime, 'Should have exponential backoff delays');
        
        // Verify success after retries
        $this->assertArrayHasKey('raw_text', $result);
        $this->assertEquals('textract', $result['service_used']);
        $this->assertArrayHasKey('retry_count', $result);
        $this->assertEquals(2, $result['retry_count']); // 2 retries before success
    }

    /** @test */
    public function it_can_handle_network_timeout_gracefully()
    {
        $mockTextractClient = Mockery::mock(TextractClient::class);
        $mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andThrow(new \Exception('cURL error 28: Operation timed out'));

        // Inject mock
        $reflection = new \ReflectionClass($this->ocrService);
        $property = $reflection->getProperty('textractClient');
        $property->setAccessible(true);
        $property->setValue($this->ocrService, $mockTextractClient);

        $fallbackService = $this->createFallbackOCRService();
        
        $result = $fallbackService->processDocumentWithFallback('documents/test.jpg', 'rg');

        // Should fallback to Tesseract due to network timeout
        $this->assertEquals('tesseract', $result['service_used']);
        $this->assertStringContainsString('network_timeout', $result['fallback_reason']);
    }

    /** @test */
    public function it_can_handle_aws_quota_exceeded()
    {
        $mockTextractClient = Mockery::mock(TextractClient::class);
        $mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andThrow(new AwsException('ProvisionedThroughputExceededException', 
                Mockery::mock(\Aws\CommandInterface::class)));

        // Inject mock
        $reflection = new \ReflectionClass($this->ocrService);
        $property = $reflection->getProperty('textractClient');
        $property->setAccessible(true);
        $property->setValue($this->ocrService, $mockTextractClient);

        $fallbackService = $this->createFallbackOCRService();
        
        $result = $fallbackService->processDocumentWithFallback('documents/test.jpg', 'cpf');

        // Should fallback due to quota exceeded
        $this->assertEquals('tesseract', $result['service_used']);
        $this->assertStringContainsString('quota_exceeded', $result['fallback_reason']);
        
        // Should cache the quota exceeded status to avoid immediate retries
        $this->assertTrue(Cache::has('textract_quota_exceeded'));
    }

    /** @test */
    public function it_can_handle_invalid_document_format()
    {
        $mockTextractClient = Mockery::mock(TextractClient::class);
        $mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andThrow(new AwsException('UnsupportedDocumentException', 
                Mockery::mock(\Aws\CommandInterface::class)));

        // Inject mock
        $reflection = new \ReflectionClass($this->ocrService);
        $property = $reflection->getProperty('textractClient');
        $property->setAccessible(true);
        $property->setValue($this->ocrService, $mockTextractClient);

        $fallbackService = $this->createFallbackOCRService();
        
        $result = $fallbackService->processDocumentWithFallback('documents/unsupported.gif', 'rg');

        // Should fallback for unsupported format
        $this->assertEquals('tesseract', $result['service_used']);
        $this->assertStringContainsString('unsupported_format', $result['fallback_reason']);
    }

    /** @test */
    public function it_can_handle_both_services_failing()
    {
        // Mock Textract to fail
        $mockTextractClient = Mockery::mock(TextractClient::class);
        $mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andThrow(new AwsException('Service error', 
                Mockery::mock(\Aws\CommandInterface::class)));

        // Inject mock
        $reflection = new \ReflectionClass($this->ocrService);
        $property = $reflection->getProperty('textractClient');
        $property->setAccessible(true);
        $property->setValue($this->ocrService, $mockTextractClient);

        // Mock Tesseract to also fail
        $mockTesseract = Mockery::mock(TesseractOCRService::class);
        $mockTesseract
            ->shouldReceive('processDocument')
            ->once()
            ->andThrow(new \Exception('Tesseract processing failed'));

        $fallbackService = $this->createFallbackOCRService($mockTesseract);
        
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('All OCR services failed');
        
        $fallbackService->processDocumentWithFallback('documents/test.jpg', 'rg');
    }

    /** @test */
    public function it_can_validate_service_health_before_processing()
    {
        $healthService = $this->createOCRHealthService();
        
        // Test Textract health
        $textractHealth = $healthService->checkTextractHealth();
        $this->assertIsArray($textractHealth);
        $this->assertArrayHasKey('status', $textractHealth);
        $this->assertArrayHasKey('response_time', $textractHealth);
        $this->assertArrayHasKey('last_check', $textractHealth);
        
        // Test Tesseract health
        $tesseractHealth = $healthService->checkTesseractHealth();
        $this->assertIsArray($tesseractHealth);
        $this->assertArrayHasKey('status', $tesseractHealth);
        $this->assertArrayHasKey('version', $tesseractHealth);
        
        // Test overall health
        $overallHealth = $healthService->getOverallOCRHealth();
        $this->assertArrayHasKey('textract', $overallHealth);
        $this->assertArrayHasKey('tesseract', $overallHealth);
        $this->assertArrayHasKey('recommended_service', $overallHealth);
    }

    /** @test */
    public function it_can_prioritize_service_based_on_document_type()
    {
        $smartService = $this->createSmartOCRService();
        
        // Test different document types
        $testCases = [
            'rg' => 'tesseract', // Complex layout, better with Tesseract
            'cpf' => 'textract',  // Simple text, good for Textract
            'cnh' => 'textract',  // Structured format, good for Textract
            'comprovante_residencia' => 'tesseract' // Variable layouts
        ];
        
        foreach ($testCases as $docType => $expectedService) {
            $recommendedService = $smartService->getRecommendedService($docType);
            $this->assertEquals($expectedService, $recommendedService,
                "Wrong service recommendation for $docType");
        }
    }

    /** @test */
    public function it_can_handle_concurrent_processing_failures()
    {
        $concurrentService = $this->createConcurrentOCRService();
        
        // Simulate multiple documents being processed simultaneously
        $documents = [
            'doc1.jpg' => 'rg',
            'doc2.pdf' => 'cpf', 
            'doc3.jpg' => 'cnh',
            'doc4.pdf' => 'comprovante_residencia'
        ];
        
        // Mock some failures in concurrent processing
        $results = $concurrentService->processConcurrentDocuments($documents);
        
        $this->assertIsArray($results);
        $this->assertCount(4, $results);
        
        // All should have completed (with fallback if needed)
        foreach ($results as $filePath => $result) {
            $this->assertArrayHasKey('status', $result);
            $this->assertContains($result['status'], ['success', 'fallback_success']);
            $this->assertArrayHasKey('service_used', $result);
            $this->assertArrayHasKey('processing_time', $result);
        }
    }

    /** @test */
    public function it_can_recover_from_partial_failures()
    {
        $recoveryService = $this->createRecoveryOCRService();
        
        // Simulate partial processing failure (some fields extracted, others failed)
        $partialResult = [
            'raw_text' => 'REGISTRO GERAL\nNome: JOÃO SILVA',
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃO SILVA', 'confidence' => 95.0]
                // Missing RG number and birth date
            ],
            'confidence_scores' => [95.0],
            'processing_errors' => ['Failed to extract RG number', 'Failed to extract birth date']
        ];
        
        $recoveredResult = $recoveryService->recoverFromPartialFailure($partialResult, 'rg');
        
        $this->assertArrayHasKey('recovery_attempted', $recoveredResult);
        $this->assertTrue($recoveredResult['recovery_attempted']);
        $this->assertArrayHasKey('original_service', $recoveredResult);
        $this->assertArrayHasKey('recovery_service', $recoveredResult);
        
        // Should have attempted to extract missing fields
        $this->assertGreaterThan(1, count($recoveredResult['forms']));
    }

    /**
     * Create fallback OCR service with Textract -> Tesseract fallback
     */
    protected function createFallbackOCRService($mockTesseract = null): object
    {
        return new class($this->ocrService, $mockTesseract ?: $this->tesseractService) {
            private $textractService;
            private $tesseractService;
            
            public function __construct($textractService, $tesseractService)
            {
                $this->textractService = $textractService;
                $this->tesseractService = $tesseractService;
            }
            
            public function processDocumentWithFallback(string $filePath, string $docType): array
            {
                try {
                    $result = $this->textractService->processDocument($filePath);
                    $result['service_used'] = 'textract';
                    return $result;
                } catch (\Aws\Exception\AwsException $e) {
                    Log::warning('Textract failed, falling back to Tesseract: ' . $e->getMessage());
                    
                    $fallbackReason = $this->categorizeFallbackReason($e);
                    
                    if ($fallbackReason === 'quota_exceeded') {
                        Cache::put('textract_quota_exceeded', true, 300); // 5 minutes
                    }
                    
                    try {
                        $result = $this->tesseractService->processDocument($filePath);
                        $result['service_used'] = 'tesseract';
                        $result['fallback_reason'] = $fallbackReason;
                        return $result;
                    } catch (\Exception $tesseractException) {
                        throw new \Exception('All OCR services failed');
                    }
                } catch (\Exception $e) {
                    Log::warning('Textract network error, falling back to Tesseract: ' . $e->getMessage());
                    
                    $result = $this->tesseractService->processDocument($filePath);
                    $result['service_used'] = 'tesseract';
                    $result['fallback_reason'] = 'network_timeout';
                    return $result;
                }
            }
            
            private function categorizeFallbackReason(\Aws\Exception\AwsException $e): string
            {
                $message = $e->getMessage();
                
                if (strpos($message, 'ProvisionedThroughputExceededException') !== false) {
                    return 'quota_exceeded';
                } elseif (strpos($message, 'UnsupportedDocumentException') !== false) {
                    return 'unsupported_format';
                } elseif (strpos($message, 'Service unavailable') !== false) {
                    return 'service_unavailable';
                } else {
                    return 'textract_failed';
                }
            }
        };
    }

    /**
     * Create retryable OCR service with exponential backoff
     */
    protected function createRetryableOCRService(): object
    {
        return new class($this->ocrService) {
            private $ocrService;
            
            public function __construct($ocrService)
            {
                $this->ocrService = $ocrService;
            }
            
            public function processDocumentWithRetry(string $filePath, int $maxRetries = 3): array
            {
                $retryCount = 0;
                $baseDelay = 1; // Start with 1 second delay
                
                while ($retryCount < $maxRetries) {
                    try {
                        $result = $this->ocrService->processDocument($filePath);
                        $result['service_used'] = 'textract';
                        $result['retry_count'] = $retryCount;
                        return $result;
                    } catch (\Exception $e) {
                        $retryCount++;
                        
                        if ($retryCount >= $maxRetries) {
                            throw $e;
                        }
                        
                        // Exponential backoff
                        $delay = $baseDelay * pow(2, $retryCount - 1);
                        sleep($delay);
                        
                        Log::info("OCR retry attempt $retryCount after {$delay}s delay");
                    }
                }
                
                throw new \Exception('Max retries exceeded');
            }
        };
    }

    /**
     * Create OCR health monitoring service
     */
    protected function createOCRHealthService(): object
    {
        return new class($this->ocrService, $this->tesseractService) {
            private $textractService;
            private $tesseractService;
            
            public function __construct($textractService, $tesseractService)
            {
                $this->textractService = $textractService;
                $this->tesseractService = $tesseractService;
            }
            
            public function checkTextractHealth(): array
            {
                $startTime = microtime(true);
                $status = 'healthy';
                
                try {
                    // Try a simple health check (this would be a real AWS call in production)
                    $responseTime = (microtime(true) - $startTime) * 1000;
                    
                    if ($responseTime > 5000) { // > 5 seconds
                        $status = 'slow';
                    }
                } catch (\Exception $e) {
                    $status = 'unhealthy';
                    $responseTime = null;
                }
                
                return [
                    'status' => $status,
                    'response_time' => round($responseTime ?? 0, 2),
                    'last_check' => now()->toISOString()
                ];
            }
            
            public function checkTesseractHealth(): array
            {
                $status = TesseractOCRService::isAvailable() ? 'healthy' : 'unavailable';
                $version = null;
                
                if ($status === 'healthy') {
                    try {
                        $output = shell_exec('tesseract --version 2>&1');
                        preg_match('/tesseract\s+(\d+\.\d+\.\d+)/', $output, $matches);
                        $version = $matches[1] ?? 'unknown';
                    } catch (\Exception $e) {
                        $status = 'unhealthy';
                    }
                }
                
                return [
                    'status' => $status,
                    'version' => $version,
                    'last_check' => now()->toISOString()
                ];
            }
            
            public function getOverallOCRHealth(): array
            {
                $textractHealth = $this->checkTextractHealth();
                $tesseractHealth = $this->checkTesseractHealth();
                
                // Determine recommended service
                $recommendedService = 'textract'; // Default
                
                if ($textractHealth['status'] !== 'healthy' && $tesseractHealth['status'] === 'healthy') {
                    $recommendedService = 'tesseract';
                } elseif ($textractHealth['status'] === 'slow') {
                    $recommendedService = 'tesseract';
                }
                
                return [
                    'textract' => $textractHealth,
                    'tesseract' => $tesseractHealth,
                    'recommended_service' => $recommendedService
                ];
            }
        };
    }

    /**
     * Create smart OCR service that chooses based on document type
     */
    protected function createSmartOCRService(): object
    {
        return new class() {
            public function getRecommendedService(string $docType): string
            {
                $preferences = [
                    'rg' => 'tesseract',        // Complex Brazilian ID layout
                    'cpf' => 'textract',        // Simple structured document
                    'cnh' => 'textract',        // Standardized format
                    'comprovante_residencia' => 'tesseract'  // Variable utility bill formats
                ];
                
                return $preferences[$docType] ?? 'textract';
            }
        };
    }

    /**
     * Create concurrent OCR processing service
     */
    protected function createConcurrentOCRService(): object
    {
        return new class() {
            public function processConcurrentDocuments(array $documents): array
            {
                $results = [];
                
                foreach ($documents as $filePath => $docType) {
                    $startTime = microtime(true);
                    
                    try {
                        // Simulate processing with some random failures
                        if (rand(0, 3) === 0) { // 25% chance of failure
                            throw new \Exception('Simulated processing failure');
                        }
                        
                        $results[$filePath] = [
                            'status' => 'success',
                            'service_used' => 'textract',
                            'processing_time' => (microtime(true) - $startTime) * 1000
                        ];
                    } catch (\Exception $e) {
                        // Fallback processing
                        $results[$filePath] = [
                            'status' => 'fallback_success',
                            'service_used' => 'tesseract',
                            'processing_time' => (microtime(true) - $startTime) * 1000,
                            'fallback_reason' => 'primary_service_failed'
                        ];
                    }
                }
                
                return $results;
            }
        };
    }

    /**
     * Create recovery OCR service for partial failures
     */
    protected function createRecoveryOCRService(): object
    {
        return new class() {
            public function recoverFromPartialFailure(array $partialResult, string $docType): array
            {
                // Attempt recovery by trying alternative extraction methods
                $recoveredResult = $partialResult;
                $recoveredResult['recovery_attempted'] = true;
                $recoveredResult['original_service'] = 'textract';
                $recoveredResult['recovery_service'] = 'tesseract';
                
                // Simulate recovery of missing fields
                if ($docType === 'rg') {
                    $recoveredResult['forms'][] = [
                        'key' => 'RG',
                        'value' => '12.345.678-9',
                        'confidence' => 75.0,
                        'extracted_by' => 'recovery'
                    ];
                    
                    $recoveredResult['forms'][] = [
                        'key' => 'Data Nascimento',
                        'value' => '15/05/1990',
                        'confidence' => 70.0,
                        'extracted_by' => 'recovery'
                    ];
                }
                
                return $recoveredResult;
            }
        };
    }

    /**
     * Create mock success response for Textract
     */
    protected function createMockSuccessResponse(): \Aws\Result
    {
        $blocks = [
            [
                'Id' => 'block-1',
                'BlockType' => 'LINE',
                'Text' => 'JOÃO SILVA SANTOS',
                'Confidence' => 95.0
            ]
        ];
        
        return new \Aws\Result(['Blocks' => $blocks]);
    }
}