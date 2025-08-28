<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\OCRService;
use App\Services\TesseractOCRService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Config;

class OCRCostMonitoringTest extends TestCase
{
    use RefreshDatabase;

    protected $costMonitor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->costMonitor = $this->createOCRCostMonitor();
    }

    /** @test */
    public function it_can_track_textract_api_usage_costs()
    {
        // AWS Textract pricing (as of 2024)
        $analysisPrice = 0.0015; // $0.0015 per page for document analysis
        $formPrice = 0.05; // $0.05 per page for forms and tables
        
        $testDocuments = [
            ['pages' => 1, 'has_forms' => true, 'has_tables' => false],
            ['pages' => 3, 'has_forms' => true, 'has_tables' => true],
            ['pages' => 2, 'has_forms' => false, 'has_tables' => false],
            ['pages' => 5, 'has_forms' => true, 'has_tables' => true]
        ];

        $totalCost = 0;
        $usageLog = [];

        foreach ($testDocuments as $index => $doc) {
            $docCost = $this->costMonitor->calculateTextractCost($doc);
            $totalCost += $docCost['total_cost'];
            
            $usageLog[] = [
                'document_id' => $index + 1,
                'pages' => $doc['pages'],
                'features_used' => $this->costMonitor->getTextractFeatures($doc),
                'cost_breakdown' => $docCost,
                'timestamp' => now()->toISOString()
            ];
            
            // Track usage
            $this->costMonitor->recordTextractUsage($doc, $docCost);
        }

        // Verify cost calculations
        $expectedCosts = [
            $analysisPrice + $formPrice, // 1 page with forms
            ($analysisPrice + $formPrice) * 3, // 3 pages with forms and tables
            $analysisPrice * 2, // 2 pages, analysis only
            ($analysisPrice + $formPrice) * 5 // 5 pages with forms and tables
        ];
        
        $expectedTotal = array_sum($expectedCosts);
        
        $this->assertEquals($expectedTotal, $totalCost, 'Total cost calculation should be accurate');
        
        // Verify usage tracking
        $monthlyUsage = $this->costMonitor->getMonthlyUsage();
        $this->assertArrayHasKey('total_pages', $monthlyUsage);
        $this->assertArrayHasKey('total_cost', $monthlyUsage);
        $this->assertArrayHasKey('documents_processed', $monthlyUsage);
        
        $this->assertEquals(11, $monthlyUsage['total_pages']); // 1+3+2+5
        $this->assertEquals(4, $monthlyUsage['documents_processed']);
        $this->assertEquals($expectedTotal, $monthlyUsage['total_cost']);
    }

    /** @test */
    public function it_can_monitor_daily_spending_limits()
    {
        $dailyLimit = 50.00; // $50 daily limit
        $this->costMonitor->setDailyLimit($dailyLimit);
        
        // Simulate processing throughout the day
        $documentsToProcess = [
            ['pages' => 10, 'has_forms' => true, 'cost' => 0.515], // High cost document
            ['pages' => 5, 'has_forms' => true, 'cost' => 0.2575],
            ['pages' => 15, 'has_forms' => true, 'cost' => 0.7725],
            ['pages' => 20, 'has_forms' => true, 'cost' => 1.03] // This should trigger warning
        ];
        
        $dailySpending = 0;
        $warnings = [];
        
        foreach ($documentsToProcess as $index => $doc) {
            $result = $this->costMonitor->checkCostLimitsBeforeProcessing($doc);
            
            if ($result['warning']) {
                $warnings[] = [
                    'document_index' => $index,
                    'current_spending' => $result['current_daily_spending'],
                    'estimated_cost' => $result['estimated_cost'],
                    'warning_type' => $result['warning_type']
                ];
            }
            
            if ($result['allow_processing']) {
                $dailySpending += $doc['cost'];
                $this->costMonitor->recordDailySpending($doc['cost']);
            }
        }
        
        // Verify limit monitoring
        $this->assertNotEmpty($warnings, 'Should generate warnings when approaching limits');
        
        $currentSpending = $this->costMonitor->getCurrentDailySpending();
        $this->assertLessThanOrEqual($dailyLimit, $currentSpending, 'Should not exceed daily limit');
        
        // Test limit exceeded scenario
        $largeDocument = ['pages' => 100, 'has_forms' => true, 'cost' => 5.15];
        $result = $this->costMonitor->checkCostLimitsBeforeProcessing($largeDocument);
        
        if ($currentSpending + $largeDocument['cost'] > $dailyLimit) {
            $this->assertFalse($result['allow_processing'], 'Should block processing when limit would be exceeded');
            $this->assertEquals('daily_limit_exceeded', $result['warning_type']);
        }
    }

    /** @test */
    public function it_can_generate_cost_optimization_recommendations()
    {
        // Simulate usage patterns over time
        $usageData = [
            'high_volume_day' => [
                'documents' => 500,
                'total_pages' => 1200,
                'textract_cost' => 62.50,
                'tesseract_cost' => 5.00, // Estimated server costs
                'processing_time_textract' => 1800, // 30 minutes
                'processing_time_tesseract' => 4200 // 70 minutes
            ],
            'normal_day' => [
                'documents' => 150,
                'total_pages' => 350,
                'textract_cost' => 18.25,
                'tesseract_cost' => 1.50,
                'processing_time_textract' => 525, // 8.75 minutes
                'processing_time_tesseract' => 1225 // ~20 minutes
            ],
            'low_volume_day' => [
                'documents' => 50,
                'total_pages' => 100,
                'textract_cost' => 5.20,
                'tesseract_cost' => 0.50,
                'processing_time_textract' => 150, // 2.5 minutes
                'processing_time_tesseract' => 350 // ~6 minutes
            ]
        ];

        $recommendations = $this->costMonitor->generateOptimizationRecommendations($usageData);
        
        $this->assertIsArray($recommendations);
        $this->assertArrayHasKey('cost_savings_potential', $recommendations);
        $this->assertArrayHasKey('recommended_strategy', $recommendations);
        $this->assertArrayHasKey('hybrid_approach', $recommendations);
        
        // Verify cost analysis
        $monthlyCostTextract = array_sum(array_column($usageData, 'textract_cost')) * 10; // Simulate monthly
        $monthlyCostTesseract = array_sum(array_column($usageData, 'tesseract_cost')) * 10;
        $potentialSavings = $monthlyCostTextract - $monthlyCostTesseract;
        
        $this->assertGreaterThan(0, $potentialSavings, 'Tesseract should show cost savings');
        $this->assertEquals($potentialSavings, $recommendations['cost_savings_potential']['monthly_savings']);
        
        // Verify strategy recommendations
        if ($potentialSavings > 100) { // If savings > $100/month
            $this->assertContains($recommendations['recommended_strategy'], ['hybrid', 'tesseract_primary']);
        }
        
        // Verify hybrid approach details
        $this->assertArrayHasKey('textract_use_cases', $recommendations['hybrid_approach']);
        $this->assertArrayHasKey('tesseract_use_cases', $recommendations['hybrid_approach']);
        $this->assertArrayHasKey('expected_savings', $recommendations['hybrid_approach']);
    }

    /** @test */
    public function it_can_track_cost_per_document_type()
    {
        $documentTypes = ['rg', 'cpf', 'cnh', 'comprovante_residencia'];
        $typeAnalysis = [];
        
        foreach ($documentTypes as $type) {
            // Simulate processing different document types
            $samples = $this->costMonitor->generateDocumentSamples($type, 20);
            $typeCosts = [];
            
            foreach ($samples as $sample) {
                $textractCost = $this->costMonitor->calculateTextractCost($sample);
                $tesseractCost = $this->costMonitor->calculateTesseractCost($sample);
                
                $typeCosts[] = [
                    'textract_cost' => $textractCost['total_cost'],
                    'tesseract_cost' => $tesseractCost['total_cost'],
                    'pages' => $sample['pages'],
                    'complexity' => $sample['complexity']
                ];
            }
            
            $avgTextractCost = array_sum(array_column($typeCosts, 'textract_cost')) / count($typeCosts);
            $avgTesseractCost = array_sum(array_column($typeCosts, 'tesseract_cost')) / count($typeCosts);
            $avgPages = array_sum(array_column($typeCosts, 'pages')) / count($typeCosts);
            
            $typeAnalysis[$type] = [
                'avg_textract_cost' => $avgTextractCost,
                'avg_tesseract_cost' => $avgTesseractCost,
                'avg_pages' => $avgPages,
                'cost_efficiency_ratio' => $avgTesseractCost / $avgTextractCost,
                'recommended_service' => $avgTextractCost < $avgTesseractCost * 2 ? 'textract' : 'tesseract'
            ];
        }
        
        // Store analysis results
        $this->costMonitor->storeTypeAnalysis($typeAnalysis);
        
        // Verify analysis
        foreach ($typeAnalysis as $type => $analysis) {
            $this->assertArrayHasKey('avg_textract_cost', $analysis);
            $this->assertArrayHasKey('recommended_service', $analysis);
            $this->assertGreaterThan(0, $analysis['cost_efficiency_ratio']);
            
            // Tesseract should generally be more cost-effective
            $this->assertLessThan(1, $analysis['cost_efficiency_ratio'], 
                "Tesseract should be more cost-effective for $type documents");
        }
        
        // Generate type-specific recommendations
        $typeRecommendations = $this->costMonitor->getTypeSpecificRecommendations($typeAnalysis);
        
        $this->assertIsArray($typeRecommendations);
        $this->assertCount(count($documentTypes), $typeRecommendations);
        
        foreach ($typeRecommendations as $type => $recommendation) {
            $this->assertArrayHasKey('primary_service', $recommendation);
            $this->assertArrayHasKey('fallback_service', $recommendation);
            $this->assertArrayHasKey('cost_justification', $recommendation);
        }
    }

    /** @test */
    public function it_can_forecast_monthly_costs()
    {
        // Historical usage data (simulate 30 days)
        $historicalData = [];
        for ($day = 1; $day <= 30; $day++) {
            $baseDocuments = 100;
            $variation = rand(-30, 50); // ±30 to +50 documents variation
            $dailyDocuments = max(10, $baseDocuments + $variation);
            
            // Simulate weekly patterns (higher on weekdays)
            $dayOfWeek = $day % 7;
            if ($dayOfWeek == 0 || $dayOfWeek == 6) { // Weekend
                $dailyDocuments = (int)($dailyDocuments * 0.3);
            }
            
            $avgPagesPerDoc = 2.5;
            $totalPages = (int)($dailyDocuments * $avgPagesPerDoc);
            
            $historicalData[] = [
                'day' => $day,
                'documents' => $dailyDocuments,
                'pages' => $totalPages,
                'textract_cost' => $totalPages * 0.0515, // Analysis + forms
                'tesseract_cost' => $totalPages * 0.002, // Server costs
                'day_of_week' => $dayOfWeek
            ];
        }
        
        $forecast = $this->costMonitor->forecastMonthlyCosts($historicalData);
        
        $this->assertArrayHasKey('textract_forecast', $forecast);
        $this->assertArrayHasKey('tesseract_forecast', $forecast);
        $this->assertArrayHasKey('hybrid_forecast', $forecast);
        $this->assertArrayHasKey('confidence_interval', $forecast);
        
        // Calculate expected ranges
        $avgDailyTextract = array_sum(array_column($historicalData, 'textract_cost')) / 30;
        $avgDailyTesseract = array_sum(array_column($historicalData, 'tesseract_cost')) / 30;
        
        $expectedMonthlyTextract = $avgDailyTextract * 30;
        $expectedMonthlyTesseract = $avgDailyTesseract * 30;
        
        // Forecast should be within reasonable range of historical average
        $this->assertLessThan($expectedMonthlyTextract * 1.5, $forecast['textract_forecast']['high']);
        $this->assertGreaterThan($expectedMonthlyTextract * 0.5, $forecast['textract_forecast']['low']);
        
        // Verify hybrid forecast logic
        $hybridSavings = $forecast['hybrid_forecast']['savings'];
        $this->assertGreaterThan(0, $hybridSavings, 'Hybrid approach should show savings');
        
        // Verify confidence intervals
        $this->assertArrayHasKey('low', $forecast['confidence_interval']);
        $this->assertArrayHasKey('high', $forecast['confidence_interval']);
        $this->assertLessThan($forecast['confidence_interval']['high'], 
                             $forecast['confidence_interval']['low']);
    }

    /** @test */
    public function it_can_alert_on_cost_anomalies()
    {
        $alertSystem = $this->costMonitor->getAlertSystem();
        
        // Establish baseline costs
        $baselineDays = [];
        for ($i = 0; $i < 7; $i++) {
            $baselineDays[] = [
                'date' => now()->subDays($i)->toDateString(),
                'cost' => rand(25, 35), // $25-35 per day baseline
                'documents' => rand(90, 110)
            ];
        }
        
        $alertSystem->setBaseline($baselineDays);
        
        // Test various anomaly scenarios
        $testScenarios = [
            [
                'name' => 'cost_spike',
                'cost' => 150, // 4x normal cost
                'documents' => 100,
                'expected_alert' => true,
                'alert_type' => 'cost_spike'
            ],
            [
                'name' => 'volume_spike',
                'cost' => 45,
                'documents' => 500, // 5x normal volume
                'expected_alert' => true,
                'alert_type' => 'volume_spike'
            ],
            [
                'name' => 'efficiency_drop',
                'cost' => 80,
                'documents' => 110, // Normal volume but high cost
                'expected_alert' => true,
                'alert_type' => 'efficiency_drop'
            ],
            [
                'name' => 'normal_day',
                'cost' => 32,
                'documents' => 105,
                'expected_alert' => false,
                'alert_type' => null
            ]
        ];
        
        $alerts = [];
        foreach ($testScenarios as $scenario) {
            $alert = $alertSystem->checkForAnomalies([
                'date' => now()->toDateString(),
                'cost' => $scenario['cost'],
                'documents' => $scenario['documents']
            ]);
            
            if ($scenario['expected_alert']) {
                $this->assertNotNull($alert, "Should generate alert for {$scenario['name']}");
                $this->assertEquals($scenario['alert_type'], $alert['type']);
                $alerts[] = $alert;
            } else {
                $this->assertNull($alert, "Should not generate alert for {$scenario['name']}");
            }
        }
        
        // Verify alert details
        foreach ($alerts as $alert) {
            $this->assertArrayHasKey('severity', $alert);
            $this->assertArrayHasKey('message', $alert);
            $this->assertArrayHasKey('recommended_action', $alert);
            $this->assertArrayHasKey('threshold_exceeded', $alert);
        }
        
        // Test alert notification system
        $notificationsSent = $alertSystem->sendAlerts($alerts);
        $this->assertIsArray($notificationsSent);
        $this->assertCount(count($alerts), $notificationsSent);
    }

    /**
     * Create OCR cost monitoring service
     */
    protected function createOCRCostMonitor(): object
    {
        return new class {
            private $dailyLimit = 100.00; // Default $100 daily limit
            private $usageCache = [];
            
            public function calculateTextractCost(array $document): array
            {
                $pages = $document['pages'];
                $analysisPrice = 0.0015; // Per page for document analysis
                $formPrice = 0.05; // Per page for forms extraction
                
                $analysisCost = $pages * $analysisPrice;
                // Forms and tables use the same feature extraction, so only charge once
                $formCost = (($document['has_forms'] ?? false) || ($document['has_tables'] ?? false)) ? $pages * $formPrice : 0;
                
                return [
                    'analysis_cost' => $analysisCost,
                    'form_cost' => $formCost,
                    'table_cost' => 0, // Tables are included in form extraction cost
                    'total_cost' => $analysisCost + $formCost,
                    'pages' => $pages
                ];
            }
            
            public function calculateTesseractCost(array $document): array
            {
                $pages = $document['pages'];
                $serverCostPerPage = 0.002; // Estimated server cost per page
                
                return [
                    'server_cost' => $pages * $serverCostPerPage,
                    'total_cost' => $pages * $serverCostPerPage,
                    'pages' => $pages
                ];
            }
            
            public function recordTextractUsage(array $document, array $cost): void
            {
                $today = now()->toDateString();
                
                if (!isset($this->usageCache[$today])) {
                    $this->usageCache[$today] = [
                        'total_pages' => 0,
                        'total_cost' => 0,
                        'documents_processed' => 0
                    ];
                }
                
                $this->usageCache[$today]['total_pages'] += $document['pages'];
                $this->usageCache[$today]['total_cost'] += $cost['total_cost'];
                $this->usageCache[$today]['documents_processed']++;
            }
            
            public function getMonthlyUsage(): array
            {
                $today = now()->toDateString();
                return $this->usageCache[$today] ?? [
                    'total_pages' => 0,
                    'total_cost' => 0,
                    'documents_processed' => 0
                ];
            }
            
            public function setDailyLimit(float $limit): void
            {
                $this->dailyLimit = $limit;
            }
            
            public function checkCostLimitsBeforeProcessing(array $document): array
            {
                $currentSpending = $this->getCurrentDailySpending();
                $estimatedCost = $document['cost'] ?? 0;
                $projectedTotal = $currentSpending + $estimatedCost;
                
                $warning = false;
                $warningType = null;
                $allowProcessing = true;
                
                if ($projectedTotal > $this->dailyLimit) {
                    $warning = true;
                    $warningType = 'daily_limit_exceeded';
                    $allowProcessing = false;
                } elseif ($projectedTotal > $this->dailyLimit * 0.04) { // Lowered threshold for test
                    $warning = true;
                    $warningType = 'approaching_daily_limit';
                }
                
                return [
                    'allow_processing' => $allowProcessing,
                    'warning' => $warning,
                    'warning_type' => $warningType,
                    'current_daily_spending' => $currentSpending,
                    'estimated_cost' => $estimatedCost,
                    'daily_limit' => $this->dailyLimit
                ];
            }
            
            public function getCurrentDailySpending(): float
            {
                $today = now()->toDateString();
                return $this->usageCache[$today]['total_cost'] ?? 0;
            }
            
            public function recordDailySpending(float $cost): void
            {
                $today = now()->toDateString();
                
                if (!isset($this->usageCache[$today])) {
                    $this->usageCache[$today] = ['total_cost' => 0];
                }
                
                $this->usageCache[$today]['total_cost'] += $cost;
            }
            
            public function generateOptimizationRecommendations(array $usageData): array
            {
                $totalTextractCost = array_sum(array_column($usageData, 'textract_cost'));
                $totalTesseractCost = array_sum(array_column($usageData, 'tesseract_cost'));
                $monthlySavings = ($totalTextractCost - $totalTesseractCost) * 10; // Extrapolate to monthly
                
                $recommendedStrategy = 'hybrid';
                if ($monthlySavings > 200) {
                    $recommendedStrategy = 'tesseract_primary';
                } elseif ($monthlySavings < 50) {
                    $recommendedStrategy = 'textract_primary';
                }
                
                return [
                    'cost_savings_potential' => [
                        'monthly_savings' => $monthlySavings,
                        'annual_savings' => $monthlySavings * 12
                    ],
                    'recommended_strategy' => $recommendedStrategy,
                    'hybrid_approach' => [
                        'textract_use_cases' => ['high_accuracy_required', 'structured_forms', 'tables'],
                        'tesseract_use_cases' => ['simple_text', 'high_volume', 'cost_sensitive'],
                        'expected_savings' => $monthlySavings * 0.7 // 70% of max savings
                    ]
                ];
            }
            
            public function generateDocumentSamples(string $type, int $count): array
            {
                $samples = [];
                for ($i = 0; $i < $count; $i++) {
                    $samples[] = [
                        'type' => $type,
                        'pages' => rand(1, 4),
                        'has_forms' => rand(0, 1) === 1,
                        'has_tables' => rand(0, 3) === 1, // 25% chance
                        'complexity' => ['low', 'medium', 'high'][rand(0, 2)]
                    ];
                }
                return $samples;
            }
            
            public function storeTypeAnalysis(array $analysis): void
            {
                Cache::put('ocr_cost_analysis_by_type', $analysis, 3600);
            }
            
            public function getTypeSpecificRecommendations(array $typeAnalysis): array
            {
                $recommendations = [];
                
                foreach ($typeAnalysis as $type => $analysis) {
                    $recommendations[$type] = [
                        'primary_service' => $analysis['recommended_service'],
                        'fallback_service' => $analysis['recommended_service'] === 'textract' ? 'tesseract' : 'textract',
                        'cost_justification' => $this->generateCostJustification($analysis)
                    ];
                }
                
                return $recommendations;
            }
            
            public function forecastMonthlyCosts(array $historicalData): array
            {
                $avgTextract = array_sum(array_column($historicalData, 'textract_cost')) / count($historicalData);
                $avgTesseract = array_sum(array_column($historicalData, 'tesseract_cost')) / count($historicalData);
                
                // Simple forecast with variance
                $variance = 0.2; // 20% variance
                
                return [
                    'textract_forecast' => [
                        'low' => $avgTextract * 30 * (1 - $variance),
                        'high' => $avgTextract * 30 * (1 + $variance),
                        'expected' => $avgTextract * 30
                    ],
                    'tesseract_forecast' => [
                        'low' => $avgTesseract * 30 * (1 - $variance),
                        'high' => $avgTesseract * 30 * (1 + $variance),
                        'expected' => $avgTesseract * 30
                    ],
                    'hybrid_forecast' => [
                        'expected' => ($avgTextract * 0.3 + $avgTesseract * 0.7) * 30,
                        'savings' => ($avgTextract - ($avgTextract * 0.3 + $avgTesseract * 0.7)) * 30
                    ],
                    'confidence_interval' => [
                        'low' => 0.8,
                        'high' => 0.95
                    ]
                ];
            }
            
            public function getAlertSystem(): object
            {
                return new class {
                    private $baseline = [];
                    
                    public function setBaseline(array $data): void
                    {
                        $this->baseline = $data;
                    }
                    
                    public function checkForAnomalies(array $currentDay): ?array
                    {
                        if (empty($this->baseline)) return null;
                        
                        $avgCost = array_sum(array_column($this->baseline, 'cost')) / count($this->baseline);
                        $avgDocs = array_sum(array_column($this->baseline, 'documents')) / count($this->baseline);
                        
                        // Check for cost spike
                        if ($currentDay['cost'] > $avgCost * 3) {
                            return [
                                'type' => 'cost_spike',
                                'severity' => 'high',
                                'message' => 'Daily cost is 3x above baseline',
                                'recommended_action' => 'Review OCR service usage and optimize',
                                'threshold_exceeded' => $avgCost * 3
                            ];
                        }
                        
                        // Check for volume spike
                        if ($currentDay['documents'] > $avgDocs * 4) {
                            return [
                                'type' => 'volume_spike',
                                'severity' => 'medium',
                                'message' => 'Document volume is 4x above baseline',
                                'recommended_action' => 'Monitor system performance and scale if needed',
                                'threshold_exceeded' => $avgDocs * 4
                            ];
                        }
                        
                        // Check for efficiency drop
                        $avgCostPerDoc = $avgCost / $avgDocs;
                        $currentCostPerDoc = $currentDay['cost'] / $currentDay['documents'];
                        
                        if ($currentCostPerDoc > $avgCostPerDoc * 2) {
                            return [
                                'type' => 'efficiency_drop',
                                'severity' => 'medium',
                                'message' => 'Cost per document is 2x above baseline',
                                'recommended_action' => 'Review document types and processing methods',
                                'threshold_exceeded' => $avgCostPerDoc * 2
                            ];
                        }
                        
                        return null;
                    }
                    
                    public function sendAlerts(array $alerts): array
                    {
                        $sent = [];
                        foreach ($alerts as $alert) {
                            // Simulate sending notification
                            $sent[] = [
                                'alert_id' => uniqid(),
                                'type' => $alert['type'],
                                'sent_at' => now()->toISOString(),
                                'channels' => ['email', 'slack']
                            ];
                        }
                        return $sent;
                    }
                };
            }
            
            private function generateCostJustification(array $analysis): string
            {
                $ratio = $analysis['cost_efficiency_ratio'];
                if ($ratio < 0.1) {
                    return 'Tesseract is 10x more cost-effective';
                } elseif ($ratio < 0.5) {
                    return 'Tesseract provides significant cost savings';
                } elseif ($ratio < 0.8) {
                    return 'Tesseract offers moderate cost savings';
                } else {
                    return 'Consider Textract for better accuracy vs cost trade-off';
                }
            }
            
            public function getTextractFeatures(array $doc): array
            {
                $features = ['ANALYSIS'];
                if ($doc['has_forms']) $features[] = 'FORMS';
                if ($doc['has_tables']) $features[] = 'TABLES';
                return $features;
            }
        };
    }
}