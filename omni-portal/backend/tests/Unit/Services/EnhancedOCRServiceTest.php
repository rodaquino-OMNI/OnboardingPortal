<?php

namespace Tests\Unit\Services;

use App\Services\EnhancedOCRService;
use App\Services\OCRUsageTracker;
use App\Services\TesseractOCRService;
use Aws\Textract\TextractClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Mockery;
use Tests\TestCase;

class EnhancedOCRServiceTest extends TestCase
{
    use RefreshDatabase;

    protected $ocrService;
    protected $mockTextractClient;
    protected $mockTesseractService;
    protected $mockUsageTracker;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock dependencies
        $this->mockTesseractService = Mockery::mock(TesseractOCRService::class);
        $this->mockUsageTracker = Mockery::mock(OCRUsageTracker::class);

        // Set test configuration
        Config::set('ocr', [
            'default' => 'enhanced',
            'drivers' => [
                'enhanced' => [
                    'driver' => 'enhanced',
                    'primary' => 'textract',
                    'fallback' => 'tesseract',
                    'max_retries' => 3,
                    'retry_delay' => 100,
                    'timeout' => 30,
                ],
                'textract' => [
                    'driver' => 'textract',
                    'region' => 'us-east-1',
                    'version' => 'latest',
                    'credentials' => [
                        'key' => 'test-key',
                        'secret' => 'test-secret',
                    ],
                    'bucket' => 'test-bucket',
                    'features' => ['FORMS', 'TABLES'],
                    'cost_per_page' => 0.05,
                ],
                'tesseract' => [
                    'driver' => 'tesseract',
                    'languages' => ['por', 'eng'],
                ],
            ],
            'quality' => [
                'min_confidence' => 70,
                'fallback_threshold' => 50,
                'text_length_threshold' => 50,
            ],
            'cache' => [
                'enabled' => true,
                'ttl' => 3600,
                'prefix' => 'ocr_test',
            ],
            'monitoring' => [
                'enabled' => true,
                'daily_budget' => 50.0,
            ],
        ]);

        // Initialize service with mocked dependencies
        $this->ocrService = new EnhancedOCRService($this->mockTesseractService);
        
        // Replace the usage tracker with mock
        $reflection = new \ReflectionClass($this->ocrService);
        $usageTrackerProperty = $reflection->getProperty('usageTracker');
        $usageTrackerProperty->setAccessible(true);
        $usageTrackerProperty->setValue($this->ocrService, $this->mockUsageTracker);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /** @test */
    public function it_can_initialize_with_proper_configuration()
    {
        $this->assertInstanceOf(EnhancedOCRService::class, $this->ocrService);
    }

    /** @test */
    public function it_returns_cached_result_when_available()
    {
        $filePath = 'test/document.pdf';
        $cacheKey = 'ocr_test_' . md5($filePath . serialize([]));
        $cachedResult = ['success' => true, 'raw_text' => 'Cached content'];

        Cache::shouldReceive('has')
            ->with($cacheKey)
            ->once()
            ->andReturn(true);

        Cache::shouldReceive('get')
            ->with($cacheKey)
            ->once()
            ->andReturn($cachedResult);

        $this->mockUsageTracker
            ->shouldReceive('canProcessDocument')
            ->once()
            ->andReturn(true);

        $result = $this->ocrService->processDocument($filePath);

        $this->assertEquals($cachedResult, $result);
    }

    /** @test */
    public function it_blocks_processing_when_budget_limit_reached()
    {
        $this->mockUsageTracker
            ->shouldReceive('canProcessDocument')
            ->once()
            ->andReturn(false);

        Cache::shouldReceive('has')->andReturn(false);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Daily OCR budget limit reached');

        $this->ocrService->processDocument('test/document.pdf');
    }

    /** @test */
    public function it_falls_back_to_tesseract_when_textract_fails()
    {
        $filePath = 'test/document.pdf';
        $tesseractResult = [
            'raw_text' => 'Fallback content',
            'blocks' => [],
            'confidence_scores' => [85],
            'forms' => [],
            'average_confidence' => 85
        ];

        $this->mockUsageTracker
            ->shouldReceive('canProcessDocument')
            ->once()
            ->andReturn(true);

        $this->mockUsageTracker
            ->shouldReceive('recordUsage')
            ->with('tesseract', 1)
            ->once();

        Cache::shouldReceive('has')->andReturn(false);
        Cache::shouldReceive('put')->once();

        // Mock Textract failure
        $this->mockTesseractService
            ->shouldReceive('processDocument')
            ->with($filePath)
            ->once()
            ->andReturn($tesseractResult);

        Log::shouldReceive('info')->atLeast()->once();
        Log::shouldReceive('error')->atLeast()->once();

        $result = $this->ocrService->processDocument($filePath);

        $this->assertTrue($result['success']);
        $this->assertEquals('tesseract_fallback', $result['processing_method']);
        $this->assertEquals('Fallback content', $result['raw_text']);
    }

    /** @test */
    public function it_validates_quality_correctly()
    {
        $reflection = new \ReflectionClass($this->ocrService);
        $method = $reflection->getMethod('isQualityAcceptable');
        $method->setAccessible(true);

        // Test acceptable quality
        $goodResult = [
            'average_confidence' => 80,
            'raw_text' => 'This is a long enough text to pass the threshold test'
        ];
        $this->assertTrue($method->invoke($this->ocrService, $goodResult));

        // Test poor confidence
        $poorConfidenceResult = [
            'average_confidence' => 40,
            'raw_text' => 'This is a long enough text to pass the threshold test'
        ];
        $this->assertFalse($method->invoke($this->ocrService, $poorConfidenceResult));

        // Test short text
        $shortTextResult = [
            'average_confidence' => 80,
            'raw_text' => 'Short'
        ];
        $this->assertFalse($method->invoke($this->ocrService, $shortTextResult));
    }

    /** @test */
    public function it_calculates_quality_score_correctly()
    {
        $reflection = new \ReflectionClass($this->ocrService);
        $method = $reflection->getMethod('calculateQualityScore');
        $method->setAccessible(true);

        $result = [
            'average_confidence' => 80,
            'raw_text' => 'This is a reasonably long text for testing quality score calculation',
            'forms' => [['key' => 'name', 'value' => 'John Doe']],
            'tables' => [['rows' => [['cell1', 'cell2']]]],
            'blocks' => [
                ['text' => 'Block 1'],
                ['text' => 'Block 2'],
                ['text' => 'Block 3']
            ]
        ];

        $score = $method->invoke($this->ocrService, $result);

        $this->assertIsFloat($score);
        $this->assertGreaterThan(0, $score);
        $this->assertLessThanOrEqual(100, $score);
    }

    /** @test */
    public function it_processes_key_value_pairs_correctly()
    {
        $reflection = new \ReflectionClass($this->ocrService);
        $method = $reflection->getMethod('processKeyValuePairs');
        $method->setAccessible(true);

        $keyMap = [
            'key1' => [
                'Id' => 'key1',
                'Confidence' => 90,
                'Relationships' => [
                    [
                        'Type' => 'VALUE',
                        'Ids' => ['value1']
                    ]
                ]
            ]
        ];

        $valueMap = [
            'value1' => [
                'Id' => 'value1',
                'Confidence' => 85
            ]
        ];

        $blockMap = [
            'key1' => [
                'Id' => 'key1',
                'Relationships' => [
                    [
                        'Type' => 'CHILD',
                        'Ids' => ['word1']
                    ]
                ]
            ],
            'value1' => [
                'Id' => 'value1',
                'Relationships' => [
                    [
                        'Type' => 'CHILD',
                        'Ids' => ['word2']
                    ]
                ]
            ],
            'word1' => [
                'Id' => 'word1',
                'BlockType' => 'WORD',
                'Text' => 'Name:'
            ],
            'word2' => [
                'Id' => 'word2',
                'BlockType' => 'WORD',
                'Text' => 'John Doe'
            ]
        ];

        $result = $method->invoke($this->ocrService, $keyMap, $valueMap, $blockMap);

        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        $this->assertEquals('Name:', $result[0]['key']);
        $this->assertEquals('John Doe', $result[0]['value']);
        $this->assertEquals(90, $result[0]['confidence']);
    }

    /** @test */
    public function it_estimates_pages_correctly()
    {
        $reflection = new \ReflectionClass($this->ocrService);
        $method = $reflection->getMethod('estimatePages');
        $method->setAccessible(true);

        // Test PDF estimation
        $pdfResult = $method->invoke($this->ocrService, 'document.pdf');
        $this->assertEquals(1, $pdfResult);

        // Test image estimation  
        $imageResult = $method->invoke($this->ocrService, 'document.jpg');
        $this->assertEquals(1, $imageResult);
    }

    /** @test */
    public function it_generates_correct_cache_keys()
    {
        $reflection = new \ReflectionClass($this->ocrService);
        $method = $reflection->getMethod('getCacheKey');
        $method->setAccessible(true);

        $filePath = 'test/document.pdf';
        $options = ['feature' => 'FORMS'];

        $key1 = $method->invoke($this->ocrService, $filePath, $options);
        $key2 = $method->invoke($this->ocrService, $filePath, $options);
        $key3 = $method->invoke($this->ocrService, $filePath, []);

        // Same inputs should generate same key
        $this->assertEquals($key1, $key2);
        
        // Different options should generate different key
        $this->assertNotEquals($key1, $key3);
        
        // Should start with prefix
        $this->assertStringStartsWith('ocr_test_', $key1);
    }
}