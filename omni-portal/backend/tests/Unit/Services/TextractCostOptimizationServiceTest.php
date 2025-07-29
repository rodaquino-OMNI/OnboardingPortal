<?php

namespace Tests\Unit\Services;

use App\Services\TextractCostOptimizationService;
use App\Services\OCRUsageTracker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Mockery;

class TextractCostOptimizationServiceTest extends TestCase
{
    use RefreshDatabase;

    protected TextractCostOptimizationService $service;
    protected $mockUsageTracker;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->mockUsageTracker = Mockery::mock(OCRUsageTracker::class);
        $this->service = new TextractCostOptimizationService($this->mockUsageTracker);
        
        // Set up test configuration
        Config::set('ocr.cost_limits.daily', 100.00);
        Config::set('ocr.cost_limits.weekly', 500.00);
        Config::set('ocr.cost_limits.monthly', 2000.00);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_can_process_document_within_limits()
    {
        // Arrange
        $this->mockUsageTracker->shouldReceive('getDailyUsage')->andReturn(10.00);
        $this->mockUsageTracker->shouldReceive('getMonthlyUsage')->andReturn(100.00);
        
        $testFile = $this->createTestImage();
        
        // Act
        $canProcess = $this->service->canProcessDocument($testFile);
        
        // Assert
        $this->assertTrue($canProcess);
    }

    public function test_cannot_process_document_exceeding_daily_limit()
    {
        // Arrange
        $this->mockUsageTracker->shouldReceive('getDailyUsage')->andReturn(99.95);
        $this->mockUsageTracker->shouldReceive('getMonthlyUsage')->andReturn(100.00);
        
        $testFile = $this->createTestImage();
        
        // Act
        $canProcess = $this->service->canProcessDocument($testFile);
        
        // Assert
        $this->assertFalse($canProcess);
    }

    public function test_estimate_processing_cost()
    {
        // Arrange
        $testFile = $this->createTestImage();
        
        // Act
        $estimatedCost = $this->service->estimateProcessingCost($testFile, ['FORMS', 'TABLES']);
        
        // Assert
        $this->assertIsFloat($estimatedCost);
        $this->assertGreaterThan(0, $estimatedCost);
        // Single page with FORMS (0.05) + TABLES (0.065) = 0.115 * 1.1 (AWS fees) = 0.1265
        $this->assertEquals(0.1265, $estimatedCost);
    }

    public function test_optimize_document()
    {
        // Arrange
        $testFile = $this->createTestImage(2000, 2000);
        
        // Act
        $result = $this->service->optimizeDocument($testFile);
        
        // Assert
        $this->assertIsArray($result);
        $this->assertArrayHasKey('original_path', $result);
        $this->assertArrayHasKey('optimized_path', $result);
        $this->assertArrayHasKey('compression_ratio', $result);
        $this->assertArrayHasKey('estimated_cost_reduction', $result);
        $this->assertLessThan(1.0, $result['compression_ratio']);
        
        // Clean up
        if (file_exists($result['optimized_path'])) {
            unlink($result['optimized_path']);
        }
    }

    public function test_optimize_batch_processing()
    {
        // Arrange
        $documents = [
            ['path' => $this->createTestImage(), 'type' => 'forms'],
            ['path' => $this->createTestImage(), 'type' => 'forms'],
            ['path' => $this->createTestImage(), 'type' => 'tables'],
            ['path' => $this->createTestImage(), 'type' => 'complex'],
        ];
        
        // Act
        $result = $this->service->optimizeBatchProcessing($documents);
        
        // Assert
        $this->assertIsArray($result);
        $this->assertArrayHasKey('batches', $result);
        $this->assertArrayHasKey('total_documents', $result);
        $this->assertArrayHasKey('estimated_cost_savings', $result);
        $this->assertEquals(4, $result['total_documents']);
        $this->assertGreaterThan(0, $result['estimated_cost_savings']);
    }

    public function test_monitor_costs_with_alerts()
    {
        // Arrange
        $this->mockUsageTracker->shouldReceive('getDailyUsage')->andReturn(85.00);
        $this->mockUsageTracker->shouldReceive('getMonthlyUsage')->andReturn(1700.00);
        
        // Mock weekly usage calculation
        Cache::shouldReceive('get')->andReturn(0);
        
        // Act
        $report = $this->service->monitorCosts();
        
        // Assert
        $this->assertIsArray($report);
        $this->assertArrayHasKey('alerts', $report);
        $this->assertNotEmpty($report['alerts']);
        $this->assertEquals('warning', $report['alerts'][0]['severity']);
    }

    public function test_record_actual_cost()
    {
        // Arrange
        $estimatedCost = 0.10;
        $processingResult = [
            'pages_processed' => 2,
            'features' => ['FORMS', 'TABLES'],
            'processing_time' => 3.5,
        ];
        
        $this->mockUsageTracker->shouldReceive('recordUsage')
            ->once()
            ->with('textract', 2, 0.1265);
        
        Cache::shouldReceive('get')->andReturn([]);
        Cache::shouldReceive('put')->andReturn(true);
        
        // Act
        $this->service->recordActualCost($estimatedCost, $processingResult);
        
        // Assert - method should complete without throwing exception
        $this->assertTrue(true);
    }

    public function test_get_cost_optimization_summary()
    {
        // Arrange
        $this->mockUsageTracker->shouldReceive('getDailyUsage')->andReturn(25.00);
        $this->mockUsageTracker->shouldReceive('getMonthlyUsage')->andReturn(500.00);
        
        Cache::shouldReceive('get')->andReturn([]);
        Cache::shouldReceive('put')->andReturn(true);
        
        // Act
        $summary = $this->service->getCostOptimizationSummary();
        
        // Assert
        $this->assertIsArray($summary);
        $this->assertArrayHasKey('status', $summary);
        $this->assertArrayHasKey('current_usage', $summary);
        $this->assertArrayHasKey('recommendations', $summary);
        $this->assertEquals('healthy', $summary['status']);
    }

    /**
     * Create a test image file
     */
    private function createTestImage($width = 1000, $height = 1000): string
    {
        $tempPath = storage_path('app/temp/test_images');
        if (!file_exists($tempPath)) {
            mkdir($tempPath, 0755, true);
        }
        
        $filename = $tempPath . '/' . uniqid('test_') . '.jpg';
        
        // Create a simple test image
        $image = imagecreate($width, $height);
        $background = imagecolorallocate($image, 255, 255, 255);
        $textColor = imagecolorallocate($image, 0, 0, 0);
        imagestring($image, 5, 50, 50, 'Test Document', $textColor);
        imagejpeg($image, $filename);
        imagedestroy($image);
        
        return $filename;
    }
}