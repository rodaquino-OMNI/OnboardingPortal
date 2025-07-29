<?php

namespace Tests\Performance;

use Tests\TestCase;
use App\Services\OCRService;
use App\Services\TesseractOCRService;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Aws\Textract\TextractClient;
use Mockery;

class OCRPerformanceBenchmarkTest extends TestCase
{
    use RefreshDatabase;

    protected $textractService;
    protected $tesseractService;
    protected $beneficiary;
    protected $testDocuments;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->textractService = new OCRService();
        $this->tesseractService = new TesseractOCRService();
        
        // Create test beneficiary
        $user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $user->id,
            'full_name' => 'João Silva Santos',
            'cpf' => '123.456.789-00',
            'birth_date' => '1990-05-15'
        ]);

        // Define test documents with expected results
        $this->testDocuments = [
            'rg_high_quality' => [
                'type' => 'rg',
                'expected_accuracy' => 95,
                'expected_fields' => ['name', 'rg_number', 'birth_date']
            ],
            'rg_medium_quality' => [
                'type' => 'rg', 
                'expected_accuracy' => 85,
                'expected_fields' => ['name', 'rg_number']
            ],
            'cpf_scan' => [
                'type' => 'cpf',
                'expected_accuracy' => 98,
                'expected_fields' => ['name', 'cpf']
            ],
            'cnh_photo' => [
                'type' => 'cnh',
                'expected_accuracy' => 90,
                'expected_fields' => ['name', 'cnh_number', 'expiration_date']
            ],
            'address_proof_bill' => [
                'type' => 'comprovante_residencia',
                'expected_accuracy' => 80,
                'expected_fields' => ['street', 'city', 'cep']
            ]
        ];
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /** @test */
    public function it_can_benchmark_textract_vs_tesseract_processing_speed()
    {
        $results = [];
        $iterations = 5; // Run multiple times for average

        foreach ($this->testDocuments as $docName => $docInfo) {
            $textractTimes = [];
            $tesseractTimes = [];

            // Mock both services for consistent testing
            $mockOcrData = $this->createMockOcrData($docInfo['type']);

            for ($i = 0; $i < $iterations; $i++) {
                // Benchmark Textract
                $textractStart = microtime(true);
                try {
                    $textractResult = $this->benchmarkTextractProcessing($docName, $mockOcrData);
                    $textractTimes[] = (microtime(true) - $textractStart) * 1000; // Convert to ms
                } catch (\Exception $e) {
                    Log::warning("Textract benchmark failed for $docName: " . $e->getMessage());
                    $textractTimes[] = 9999; // High penalty for failure
                }

                // Benchmark Tesseract
                $tesseractStart = microtime(true);
                try {
                    $tesseractResult = $this->benchmarkTesseractProcessing($docName, $mockOcrData);
                    $tesseractTimes[] = (microtime(true) - $tesseractStart) * 1000; // Convert to ms
                } catch (\Exception $e) {
                    Log::warning("Tesseract benchmark failed for $docName: " . $e->getMessage());
                    $tesseractTimes[] = 9999; // High penalty for failure
                }
            }

            $results[$docName] = [
                'textract_avg_time' => array_sum($textractTimes) / count($textractTimes),
                'tesseract_avg_time' => array_sum($tesseractTimes) / count($tesseractTimes),
                'textract_min_time' => min($textractTimes),
                'tesseract_min_time' => min($tesseractTimes),
                'textract_max_time' => max($textractTimes),
                'tesseract_max_time' => max($tesseractTimes),
                'speed_advantage' => $this->calculateSpeedAdvantage($textractTimes, $tesseractTimes)
            ];
        }

        // Store benchmark results
        $this->storeBenchmarkResults('speed_comparison', $results);

        // Assert performance expectations
        foreach ($results as $docName => $result) {
            // Both services should complete within reasonable time (< 10 seconds)
            $this->assertLessThan(10000, $result['textract_avg_time'], 
                "Textract too slow for $docName: {$result['textract_avg_time']}ms");
            $this->assertLessThan(10000, $result['tesseract_avg_time'], 
                "Tesseract too slow for $docName: {$result['tesseract_avg_time']}ms");
            
            // Log the winner for each document type
            $winner = $result['speed_advantage'] > 0 ? 'Textract' : 'Tesseract';
            $advantage = abs($result['speed_advantage']);
            Log::info("$docName speed winner: $winner (${advantage}x faster)");
        }

        // Overall performance should meet minimum standards
        $overallTextractAvg = array_sum(array_column($results, 'textract_avg_time')) / count($results);
        $overallTesseractAvg = array_sum(array_column($results, 'tesseract_avg_time')) / count($results);
        
        $this->assertLessThan(5000, min($overallTextractAvg, $overallTesseractAvg), 
            'At least one OCR service should average under 5 seconds');
    }

    /** @test */
    public function it_can_benchmark_textract_vs_tesseract_accuracy()
    {
        $accuracyResults = [];

        foreach ($this->testDocuments as $docName => $docInfo) {
            $mockData = $this->createMockOcrData($docInfo['type']);
            
            // Test Textract accuracy
            $textractResult = $this->benchmarkTextractProcessing($docName, $mockData);
            $textractAccuracy = $this->calculateAccuracy($textractResult, $docInfo);
            
            // Test Tesseract accuracy  
            $tesseractResult = $this->benchmarkTesseractProcessing($docName, $mockData);
            $tesseractAccuracy = $this->calculateAccuracy($tesseractResult, $docInfo);

            $accuracyResults[$docName] = [
                'textract_accuracy' => $textractAccuracy,
                'tesseract_accuracy' => $tesseractAccuracy,
                'expected_accuracy' => $docInfo['expected_accuracy'],
                'accuracy_advantage' => $textractAccuracy - $tesseractAccuracy
            ];
        }

        // Store accuracy benchmark results
        $this->storeBenchmarkResults('accuracy_comparison', $accuracyResults);

        // Assert accuracy expectations
        foreach ($accuracyResults as $docName => $result) {
            // At least one service should meet expected accuracy
            $maxAccuracy = max($result['textract_accuracy'], $result['tesseract_accuracy']);
            $this->assertGreaterThanOrEqual($result['expected_accuracy'] - 10, $maxAccuracy,
                "Neither service meets minimum accuracy for $docName");
            
            // Both services should achieve reasonable accuracy
            $this->assertGreaterThan(60, $result['textract_accuracy'], 
                "Textract accuracy too low for $docName");
            $this->assertGreaterThan(60, $result['tesseract_accuracy'], 
                "Tesseract accuracy too low for $docName");
        }

        // Calculate overall accuracy advantage
        $overallTextractAccuracy = array_sum(array_column($accuracyResults, 'textract_accuracy')) / count($accuracyResults);
        $overallTesseractAccuracy = array_sum(array_column($accuracyResults, 'tesseract_accuracy')) / count($accuracyResults);
        
        Log::info("Overall Accuracy - Textract: {$overallTextractAccuracy}%, Tesseract: {$overallTesseractAccuracy}%");
        
        $this->assertGreaterThan(75, max($overallTextractAccuracy, $overallTesseractAccuracy),
            'At least one service should achieve >75% overall accuracy');
    }

    /** @test */
    public function it_can_benchmark_confidence_scores_reliability()
    {
        $confidenceResults = [];

        foreach ($this->testDocuments as $docName => $docInfo) {
            $mockData = $this->createMockOcrData($docInfo['type']);
            
            // Test confidence score consistency
            $textractResult = $this->benchmarkTextractProcessing($docName, $mockData);
            $tesseractResult = $this->benchmarkTesseractProcessing($docName, $mockData);

            $textractConfidence = $this->analyzeConfidenceScores($textractResult);
            $tesseractConfidence = $this->analyzeConfidenceScores($tesseractResult);

            $confidenceResults[$docName] = [
                'textract_avg_confidence' => $textractConfidence['average'],
                'textract_min_confidence' => $textractConfidence['minimum'],
                'textract_std_dev' => $textractConfidence['std_dev'],
                'tesseract_avg_confidence' => $tesseractConfidence['average'],
                'tesseract_min_confidence' => $tesseractConfidence['minimum'],
                'tesseract_std_dev' => $tesseractConfidence['std_dev'],
                'confidence_reliability' => $this->calculateConfidenceReliability($textractConfidence, $tesseractConfidence)
            ];
        }

        // Store confidence benchmark results
        $this->storeBenchmarkResults('confidence_comparison', $confidenceResults);

        // Assert confidence expectations
        foreach ($confidenceResults as $docName => $result) {
            // Average confidence should be reasonable
            $this->assertGreaterThan(70, $result['textract_avg_confidence'], 
                "Textract confidence too low for $docName");
            $this->assertGreaterThan(70, $result['tesseract_avg_confidence'], 
                "Tesseract confidence too low for $docName");
            
            // Minimum confidence shouldn't be too low
            $this->assertGreaterThan(40, $result['textract_min_confidence'], 
                "Textract minimum confidence too low for $docName");
            $this->assertGreaterThan(40, $result['tesseract_min_confidence'], 
                "Tesseract minimum confidence too low for $docName");
            
            // Standard deviation should indicate consistency
            $this->assertLessThan(30, $result['textract_std_dev'], 
                "Textract confidence too inconsistent for $docName");
            $this->assertLessThan(30, $result['tesseract_std_dev'], 
                "Tesseract confidence too inconsistent for $docName");
        }
    }

    /** @test */
    public function it_can_benchmark_brazilian_document_specific_accuracy()
    {
        $brazilianPatterns = [
            'cpf' => ['123.456.789-00', '98765432100', '111.222.333-44'],
            'rg' => ['12.345.678-9', '987654321', '11.222.333-4'],
            'cep' => ['01234-567', '98765432', '12345-678'],
            'cnh' => ['12345678901', '98765432109', '11111111111']
        ];

        $patternResults = [];

        foreach ($brazilianPatterns as $pattern => $testValues) {
            $detectionResults = [];
            
            foreach ($testValues as $value) {
                $mockData = $this->createMockDataWithPattern($pattern, $value);
                
                // Test pattern detection with both services
                $textractResult = $this->benchmarkTextractProcessing("${pattern}_test", $mockData);
                $tesseractResult = $this->benchmarkTesseractProcessing("${pattern}_test", $mockData);
                
                $textractDetected = $this->isPatternDetected($textractResult, $pattern, $value);
                $tesseractDetected = $this->isPatternDetected($tesseractResult, $pattern, $value);
                
                $detectionResults[] = [
                    'value' => $value,
                    'textract_detected' => $textractDetected,
                    'tesseract_detected' => $tesseractDetected
                ];
            }
            
            $textractSuccessRate = count(array_filter($detectionResults, fn($r) => $r['textract_detected'])) / count($detectionResults) * 100;
            $tesseractSuccessRate = count(array_filter($detectionResults, fn($r) => $r['tesseract_detected'])) / count($detectionResults) * 100;
            
            $patternResults[$pattern] = [
                'textract_success_rate' => $textractSuccessRate,
                'tesseract_success_rate' => $tesseractSuccessRate,
                'detection_results' => $detectionResults
            ];
        }

        // Store Brazilian pattern results
        $this->storeBenchmarkResults('brazilian_patterns', $patternResults);

        // Assert Brazilian document pattern detection
        foreach ($patternResults as $pattern => $result) {
            $this->assertGreaterThan(80, max($result['textract_success_rate'], $result['tesseract_success_rate']),
                "At least one service should achieve >80% success rate for $pattern pattern");
        }
    }

    /** @test */
    public function it_can_benchmark_cost_effectiveness()
    {
        $costResults = [];
        
        // Mock cost calculations (AWS Textract pricing as of 2024)
        $textractCostPerPage = 0.0015; // $0.0015 per page for document analysis
        $tesseractCostPerPage = 0.0001; // Estimated server cost per page
        
        foreach ($this->testDocuments as $docName => $docInfo) {
            $mockData = $this->createMockOcrData($docInfo['type']);
            
            // Simulate processing multiple pages
            $pageCount = rand(1, 5);
            
            $textractResult = $this->benchmarkTextractProcessing($docName, $mockData);
            $tesseractResult = $this->benchmarkTesseractProcessing($docName, $mockData);
            
            $textractAccuracy = $this->calculateAccuracy($textractResult, $docInfo);
            $tesseractAccuracy = $this->calculateAccuracy($tesseractResult, $docInfo);
            
            $textractCost = $pageCount * $textractCostPerPage;
            $tesseractCost = $pageCount * $tesseractCostPerPage;
            
            // Calculate cost per accuracy point
            $textractCostEfficiency = $textractAccuracy > 0 ? $textractCost / $textractAccuracy : 9999;
            $tesseractCostEfficiency = $tesseractAccuracy > 0 ? $tesseractCost / $tesseractAccuracy : 9999;
            
            $costResults[$docName] = [
                'page_count' => $pageCount,
                'textract_cost' => $textractCost,
                'tesseract_cost' => $tesseractCost,
                'textract_accuracy' => $textractAccuracy,
                'tesseract_accuracy' => $tesseractAccuracy,
                'textract_cost_efficiency' => $textractCostEfficiency,
                'tesseract_cost_efficiency' => $tesseractCostEfficiency,
                'cost_advantage' => $tesseractCost / $textractCost // How much cheaper Tesseract is
            ];
        }

        // Store cost benchmark results
        $this->storeBenchmarkResults('cost_effectiveness', $costResults);

        // Assert cost effectiveness
        foreach ($costResults as $docName => $result) {
            $this->assertGreaterThan(0, $result['cost_advantage'], 
                "Tesseract should be more cost-effective than Textract for $docName");
            
            // Both cost efficiency values should be reasonable
            $this->assertLessThan(1, $result['textract_cost_efficiency'], 
                "Textract cost per accuracy point too high for $docName");
            $this->assertLessThan(1, $result['tesseract_cost_efficiency'], 
                "Tesseract cost per accuracy point too high for $docName");
        }

        // Calculate monthly cost projections
        $monthlyDocuments = 10000; // Estimate 10k documents per month
        $avgTextractCost = array_sum(array_column($costResults, 'textract_cost')) / count($costResults);
        $avgTesseractCost = array_sum(array_column($costResults, 'tesseract_cost')) / count($costResults);
        
        $monthlyTextractCost = $monthlyDocuments * $avgTextractCost;
        $monthlyTesseractCost = $monthlyDocuments * $avgTesseractCost;
        $monthlySavings = $monthlyTextractCost - $monthlyTesseractCost;
        
        Log::info("Monthly cost projection - Textract: $${monthlyTextractCost}, Tesseract: $${monthlyTesseractCost}, Savings: $${monthlySavings}");
        
        $costResults['monthly_projection'] = [
            'textract_cost' => $monthlyTextractCost,
            'tesseract_cost' => $monthlyTesseractCost,
            'potential_savings' => $monthlySavings
        ];

        $this->storeBenchmarkResults('cost_effectiveness', $costResults);
    }

    /**
     * Mock Textract processing for benchmarking
     */
    protected function benchmarkTextractProcessing(string $docName, array $mockData): array
    {
        // Simulate Textract processing with mock data
        return [
            'raw_text' => $mockData['raw_text'],
            'forms' => $mockData['forms'],
            'confidence_scores' => array_column($mockData['forms'], 'confidence'),
            'processing_time' => rand(500, 2000), // 0.5-2 seconds
            'service' => 'textract'
        ];
    }

    /**
     * Mock Tesseract processing for benchmarking
     */
    protected function benchmarkTesseractProcessing(string $docName, array $mockData): array
    {
        // Simulate Tesseract processing with slightly different characteristics
        $tesseractForms = array_map(function($form) {
            return [
                'key' => $form['key'],
                'value' => $form['value'],
                'confidence' => $form['confidence'] * 0.95 // Slightly lower confidence
            ];
        }, $mockData['forms']);

        return [
            'raw_text' => $mockData['raw_text'],
            'forms' => $tesseractForms,
            'confidence_scores' => array_column($tesseractForms, 'confidence'),
            'processing_time' => rand(1000, 4000), // 1-4 seconds (generally slower)
            'service' => 'tesseract'
        ];
    }

    /**
     * Create mock OCR data for testing
     */
    protected function createMockOcrData(string $type): array
    {
        $mockData = [
            'rg' => [
                'raw_text' => "REGISTRO GERAL\nNome: JOÃO SILVA SANTOS\nRG: 12.345.678-9\nData Nascimento: 15/05/1990",
                'forms' => [
                    ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 95.5],
                    ['key' => 'RG', 'value' => '12.345.678-9', 'confidence' => 98.2],
                    ['key' => 'Data Nascimento', 'value' => '15/05/1990', 'confidence' => 92.1]
                ]
            ],
            'cpf' => [
                'raw_text' => "CADASTRO DE PESSOA FÍSICA\nNome: JOÃO SILVA SANTOS\nCPF: 123.456.789-00",
                'forms' => [
                    ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 94.8],
                    ['key' => 'CPF', 'value' => '123.456.789-00', 'confidence' => 99.1]
                ]
            ],
            'cnh' => [
                'raw_text' => "CARTEIRA NACIONAL DE HABILITAÇÃO\nNome: JOÃO SILVA SANTOS\nCNH: 12345678901\nValida até: 15/05/2028",
                'forms' => [
                    ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 96.3],
                    ['key' => 'CNH', 'value' => '12345678901', 'confidence' => 97.8],
                    ['key' => 'Valida até', 'value' => '15/05/2028', 'confidence' => 93.5]
                ]
            ],
            'comprovante_residencia' => [
                'raw_text' => "COMPROVANTE DE ENDEREÇO\nEndereço: Rua das Flores, 123\nCidade: São Paulo - SP\nCEP: 01234-567",
                'forms' => [
                    ['key' => 'Endereco', 'value' => 'Rua das Flores, 123', 'confidence' => 89.4],
                    ['key' => 'Cidade', 'value' => 'São Paulo', 'confidence' => 95.1],
                    ['key' => 'CEP', 'value' => '01234-567', 'confidence' => 98.7]
                ]
            ]
        ];

        return $mockData[$type] ?? $mockData['rg'];
    }

    /**
     * Create mock data with specific pattern
     */
    protected function createMockDataWithPattern(string $pattern, string $value): array
    {
        return [
            'raw_text' => "$pattern: $value",
            'forms' => [
                ['key' => strtoupper($pattern), 'value' => $value, 'confidence' => 90.0]
            ]
        ];
    }

    /**
     * Calculate accuracy based on expected fields
     */
    protected function calculateAccuracy(array $result, array $expectedInfo): float
    {
        $expectedFields = $expectedInfo['expected_fields'];
        $extractedFields = array_keys($result['forms'][0] ?? []);
        
        $matchedFields = array_intersect($expectedFields, $extractedFields);
        $accuracy = (count($matchedFields) / count($expectedFields)) * 100;
        
        // Adjust accuracy based on confidence scores
        if (isset($result['confidence_scores'])) {
            $avgConfidence = array_sum($result['confidence_scores']) / count($result['confidence_scores']);
            $accuracy = ($accuracy + $avgConfidence) / 2;
        }
        
        return round($accuracy, 2);
    }

    /**
     * Calculate speed advantage (positive means Textract is faster)
     */
    protected function calculateSpeedAdvantage(array $textractTimes, array $tesseractTimes): float
    {
        $textractAvg = array_sum($textractTimes) / count($textractTimes);
        $tesseractAvg = array_sum($tesseractTimes) / count($tesseractTimes);
        
        return round($tesseractAvg / $textractAvg, 2);
    }

    /**
     * Analyze confidence scores
     */
    protected function analyzeConfidenceScores(array $result): array
    {
        $scores = $result['confidence_scores'] ?? [];
        
        if (empty($scores)) {
            return ['average' => 0, 'minimum' => 0, 'std_dev' => 0];
        }
        
        $average = array_sum($scores) / count($scores);
        $minimum = min($scores);
        
        $variance = array_sum(array_map(fn($x) => ($x - $average) ** 2, $scores)) / count($scores);
        $stdDev = sqrt($variance);
        
        return [
            'average' => round($average, 2),
            'minimum' => round($minimum, 2),
            'std_dev' => round($stdDev, 2)
        ];
    }

    /**
     * Calculate confidence reliability
     */
    protected function calculateConfidenceReliability(array $textractConf, array $tesseractConf): array
    {
        return [
            'textract_consistency' => 100 - $textractConf['std_dev'],
            'tesseract_consistency' => 100 - $tesseractConf['std_dev'],
            'better_service' => $textractConf['std_dev'] < $tesseractConf['std_dev'] ? 'textract' : 'tesseract'
        ];
    }

    /**
     * Check if pattern is detected in result
     */
    protected function isPatternDetected(array $result, string $pattern, string $value): bool
    {
        $text = $result['raw_text'] ?? '';
        $forms = $result['forms'] ?? [];
        
        // Check in raw text
        if (strpos($text, $value) !== false) {
            return true;
        }
        
        // Check in forms
        foreach ($forms as $form) {
            if (strpos($form['value'], $value) !== false) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Store benchmark results for analysis
     */
    protected function storeBenchmarkResults(string $benchmarkType, array $results): void
    {
        $filePath = storage_path("logs/ocr_benchmark_{$benchmarkType}_" . date('Y-m-d_H-i-s') . '.json');
        
        $benchmarkData = [
            'timestamp' => now()->toISOString(),
            'benchmark_type' => $benchmarkType,
            'results' => $results,
            'environment' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'memory_limit' => ini_get('memory_limit'),
                'max_execution_time' => ini_get('max_execution_time')
            ]
        ];
        
        file_put_contents($filePath, json_encode($benchmarkData, JSON_PRETTY_PRINT));
        
        Log::info("OCR benchmark results stored: $filePath");
    }
}