<?php

namespace App\Console\Commands;

use App\Services\EnhancedOCRService;
use App\Services\OCRUsageTracker;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class TestOCRIntegration extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'ocr:test 
                            {--file= : Path to test file}
                            {--provider=enhanced : OCR provider to test (enhanced, textract, tesseract)}
                            {--features=* : Textract features to test}';

    /**
     * The console command description.
     */
    protected $description = 'Test OCR integration with AWS Textract and Tesseract fallback';

    /**
     * Execute the console command.
     */
    public function handle(EnhancedOCRService $ocrService, OCRUsageTracker $usageTracker): int
    {
        $this->info('🔍 OCR Integration Test Starting...');
        $this->newLine();

        // Display current configuration
        $this->displayConfiguration();

        // Test connectivity
        if (!$this->testConnectivity()) {
            return 1;
        }

        // Test usage tracking
        $this->testUsageTracking($usageTracker);

        // Test OCR processing if file provided
        $filePath = $this->option('file');
        if ($filePath) {
            $this->testOCRProcessing($ocrService, $filePath);
        }

        // Display budget status
        $this->displayBudgetStatus($usageTracker);

        $this->newLine();
        $this->info('✅ OCR Integration Test Completed!');
        
        return 0;
    }

    /**
     * Display current OCR configuration
     */
    protected function displayConfiguration(): void
    {
        $this->info('📋 Current OCR Configuration:');
        
        $config = Config::get('ocr');
        
        $this->table(
            ['Setting', 'Value'],
            [
                ['Default Driver', $config['default']],
                ['Monitoring Enabled', $config['monitoring']['enabled'] ? 'Yes' : 'No'],
                ['Daily Budget', '$' . number_format($config['monitoring']['daily_budget'], 2)],
                ['Monthly Budget', '$' . number_format($config['monitoring']['monthly_budget'], 2)],
                ['Cache Enabled', $config['cache']['enabled'] ? 'Yes' : 'No'],
                ['Cache TTL', $config['cache']['ttl'] . ' seconds'],
                ['Min Confidence', $config['quality']['min_confidence'] . '%'],
                ['AWS Region', $config['drivers']['textract']['region']],
                ['S3 Bucket', $config['drivers']['textract']['bucket']],
            ]
        );
        
        $this->newLine();
    }

    /**
     * Test basic connectivity
     */
    protected function testConnectivity(): bool
    {
        $this->info('🔗 Testing Connectivity...');
        
        try {
            // Test AWS credentials
            $hasAWSCreds = !empty(config('services.aws.key')) && !empty(config('services.aws.secret'));
            $this->line('AWS Credentials: ' . ($hasAWSCreds ? '✅ Configured' : '❌ Missing'));
            
            // Test S3 connectivity
            try {
                Storage::disk('s3')->exists('test-connectivity');
                $this->line('S3 Connectivity: ✅ Connected');
            } catch (\Exception $e) {
                $this->line('S3 Connectivity: ❌ Failed - ' . $e->getMessage());
            }
            
            // Test Redis (for caching)
            try {
                \Illuminate\Support\Facades\Cache::store('redis')->put('ocr_test_key', 'test', 1);
                \Illuminate\Support\Facades\Cache::store('redis')->forget('ocr_test_key');
                $this->line('Redis Cache: ✅ Connected');
            } catch (\Exception $e) {
                $this->line('Redis Cache: ❌ Failed - ' . $e->getMessage());
            }
            
            $this->newLine();
            return true;
            
        } catch (\Exception $e) {
            $this->error('❌ Connectivity test failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Test usage tracking functionality
     */
    protected function testUsageTracking(OCRUsageTracker $usageTracker): void
    {
        $this->info('📊 Testing Usage Tracking...');
        
        try {
            // Record test usage
            $usageTracker->recordUsage('textract', 1, 0.05);
            $usageTracker->recordUsage('tesseract', 2, 0.00);
            
            $dailyUsage = $usageTracker->getDailyUsage();
            $monthlyUsage = $usageTracker->getMonthlyUsage();
            
            $this->line("Daily Usage: $" . number_format($dailyUsage, 2));
            $this->line("Monthly Usage: $" . number_format($monthlyUsage, 2));
            
            $canProcess = $usageTracker->canProcessDocument();
            $this->line('Can Process: ' . ($canProcess ? '✅ Yes' : '❌ No'));
            
            $this->newLine();
            
        } catch (\Exception $e) {
            $this->error('❌ Usage tracking test failed: ' . $e->getMessage());
        }
    }

    /**
     * Test OCR processing with provided file
     */
    protected function testOCRProcessing(EnhancedOCRService $ocrService, string $filePath): void
    {
        $this->info("🔍 Testing OCR Processing with file: {$filePath}");
        
        try {
            if (!Storage::disk('s3')->exists($filePath)) {
                $this->error("❌ File not found in S3: {$filePath}");
                return;
            }
            
            $options = [];
            if ($this->option('features')) {
                $options['features'] = $this->option('features');
            }
            
            $startTime = microtime(true);
            $result = $ocrService->processDocument($filePath, $options);
            $endTime = microtime(true);
            
            $processingTime = round(($endTime - $startTime) * 1000, 2);
            
            if ($result['success']) {
                $this->info('✅ OCR Processing Successful!');
                
                $this->table(
                    ['Metric', 'Value'],
                    [
                        ['Processing Time', $processingTime . ' ms'],
                        ['Processing Method', $result['processing_method'] ?? 'N/A'],
                        ['Quality Score', isset($result['quality_score']) ? $result['quality_score'] . '/100' : 'N/A'],
                        ['Confidence Score', isset($result['average_confidence']) ? round($result['average_confidence'], 2) . '%' : 'N/A'],
                        ['Text Length', strlen($result['raw_text'] ?? '') . ' characters'],
                        ['Forms Detected', count($result['forms'] ?? [])],
                        ['Tables Detected', count($result['tables'] ?? [])],
                        ['Blocks Detected', count($result['blocks'] ?? [])],
                    ]
                );
                
                // Show first 200 characters of extracted text
                $text = $result['raw_text'] ?? '';
                if (strlen($text) > 200) {
                    $text = substr($text, 0, 200) . '...';
                }
                
                if ($text) {
                    $this->info('📄 Extracted Text (first 200 chars):');
                    $this->line($text);
                }
                
                // Show forms if any
                if (!empty($result['forms'])) {
                    $this->info('📋 Detected Forms:');
                    foreach (array_slice($result['forms'], 0, 5) as $form) {
                        $this->line("  • {$form['key']}: {$form['value']} (confidence: {$form['confidence']}%)");
                    }
                }
                
            } else {
                $this->error('❌ OCR Processing Failed: ' . ($result['error'] ?? 'Unknown error'));
            }
            
        } catch (\Exception $e) {
            $this->error('❌ OCR processing test failed: ' . $e->getMessage());
        }
        
        $this->newLine();
    }

    /**
     * Display current budget status
     */
    protected function displayBudgetStatus(OCRUsageTracker $usageTracker): void
    {
        $this->info('💰 Current Budget Status:');
        
        try {
            $budgetStatus = $usageTracker->getBudgetStatus();
            
            $this->table(
                ['Period', 'Usage', 'Budget', 'Percentage', 'Remaining'],
                [
                    [
                        'Daily',
                        '$' . number_format($budgetStatus['daily']['usage'], 2),
                        '$' . number_format($budgetStatus['daily']['budget'], 2),
                        round($budgetStatus['daily']['percentage'], 1) . '%',
                        '$' . number_format($budgetStatus['daily']['remaining'], 2)
                    ],
                    [
                        'Monthly',
                        '$' . number_format($budgetStatus['monthly']['usage'], 2),
                        '$' . number_format($budgetStatus['monthly']['budget'], 2),
                        round($budgetStatus['monthly']['percentage'], 1) . '%',
                        '$' . number_format($budgetStatus['monthly']['remaining'], 2)
                    ]
                ]
            );
            
        } catch (\Exception $e) {
            $this->error('❌ Failed to get budget status: ' . $e->getMessage());
        }
    }
}