<?php

namespace Tests\Performance;

use Tests\TestCase;
use App\Services\OCRService;
use App\Services\TesseractOCRService;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

class OCRLoadTest extends TestCase
{
    use RefreshDatabase;

    protected $users = [];
    protected $beneficiaries = [];
    protected $baseDocuments = [];

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create multiple test users and beneficiaries for load testing
        for ($i = 0; $i < 10; $i++) {
            $user = User::factory()->create([
                'name' => "Test User $i",
                'email' => "testuser{$i}@example.com"
            ]);
            
            $beneficiary = Beneficiary::factory()->create([
                'user_id' => $user->id,
                'full_name' => "João Silva Santos $i",
                'cpf' => sprintf('%03d.%03d.%03d-%02d', 
                    100 + $i, 200 + $i, 300 + $i, 10 + $i)
            ]);
            
            $this->users[] = $user;
            $this->beneficiaries[] = $beneficiary;
        }

        // Define base documents for load testing
        $this->baseDocuments = [
            'rg_batch_1' => ['type' => 'rg', 'size_kb' => 250],
            'rg_batch_2' => ['type' => 'rg', 'size_kb' => 450],
            'cpf_batch_1' => ['type' => 'cpf', 'size_kb' => 180],
            'cpf_batch_2' => ['type' => 'cpf', 'size_kb' => 320],
            'cnh_batch_1' => ['type' => 'cnh', 'size_kb' => 380],
            'cnh_batch_2' => ['type' => 'cnh', 'size_kb' => 520],
            'address_batch_1' => ['type' => 'comprovante_residencia', 'size_kb' => 600],
            'address_batch_2' => ['type' => 'comprovante_residencia', 'size_kb' => 850]
        ];
    }

    /** @test */
    public function it_can_handle_concurrent_ocr_requests()
    {
        $concurrentRequests = 20;
        $documentsPerRequest = 3;
        $startTime = microtime(true);
        
        $processes = [];
        $results = [];

        // Simulate concurrent API requests
        for ($i = 0; $i < $concurrentRequests; $i++) {
            $user = $this->users[$i % count($this->users)];
            $beneficiary = $this->beneficiaries[$i % count($this->beneficiaries)];
            
            Sanctum::actingAs($user);
            
            // Create multiple documents for this request
            $requestDocuments = [];
            for ($j = 0; $j < $documentsPerRequest; $j++) {
                $docName = array_keys($this->baseDocuments)[$j % count($this->baseDocuments)];
                $docInfo = $this->baseDocuments[$docName];
                
                $document = Document::factory()->create([
                    'beneficiary_id' => $beneficiary->id,
                    'type' => $docInfo['type'],
                    'status' => 'processing',
                    'file_path' => "documents/load_test_{$i}_{$j}.jpg",
                    'file_size' => $docInfo['size_kb'] * 1024
                ]);
                
                $requestDocuments[] = $document;
            }
            
            // Process documents concurrently (simulate with array processing)
            $requestStart = microtime(true);
            try {
                $requestResults = $this->processDocumentsConcurrently($requestDocuments);
                $requestTime = (microtime(true) - $requestStart) * 1000;
                
                $results[] = [
                    'request_id' => $i,
                    'user_id' => $user->id,
                    'documents_processed' => count($requestDocuments),
                    'processing_time_ms' => $requestTime,
                    'success' => true,
                    'documents' => $requestResults
                ];
            } catch (\Exception $e) {
                $results[] = [
                    'request_id' => $i,
                    'user_id' => $user->id,
                    'processing_time_ms' => (microtime(true) - $requestStart) * 1000,
                    'success' => false,
                    'error' => $e->getMessage()
                ];
            }
        }

        $totalTime = (microtime(true) - $startTime) * 1000;

        // Analyze results
        $successfulRequests = array_filter($results, fn($r) => $r['success']);
        $failedRequests = array_filter($results, fn($r) => !$r['success']);
        
        $successRate = (count($successfulRequests) / count($results)) * 100;
        $avgProcessingTime = array_sum(array_column($successfulRequests, 'processing_time_ms')) / max(count($successfulRequests), 1);
        $maxProcessingTime = max(array_column($results, 'processing_time_ms'));
        $minProcessingTime = min(array_column($successfulRequests, 'processing_time_ms') ?: [0]);

        // Store load test results
        $this->storeLoadTestResults('concurrent_requests', [
            'test_config' => [
                'concurrent_requests' => $concurrentRequests,
                'documents_per_request' => $documentsPerRequest,
                'total_documents' => $concurrentRequests * $documentsPerRequest
            ],
            'results' => [
                'total_time_ms' => $totalTime,
                'success_rate' => $successRate,
                'avg_processing_time_ms' => $avgProcessingTime,
                'max_processing_time_ms' => $maxProcessingTime,
                'min_processing_time_ms' => $minProcessingTime,
                'successful_requests' => count($successfulRequests),
                'failed_requests' => count($failedRequests)
            ],
            'detailed_results' => $results
        ]);

        // Assert performance requirements
        $this->assertGreaterThan(80, $successRate, 'Success rate should be > 80%');
        $this->assertLessThan(30000, $maxProcessingTime, 'Max processing time should be < 30 seconds');
        $this->assertLessThan(10000, $avgProcessingTime, 'Average processing time should be < 10 seconds');
        
        Log::info("Load Test Results - Success Rate: {$successRate}%, Avg Time: {$avgProcessingTime}ms");
    }

    /** @test */
    public function it_can_handle_high_volume_document_processing()
    {
        $totalDocuments = 100;
        $batchSize = 10;
        $batches = ceil($totalDocuments / $batchSize);
        
        $allResults = [];
        $memoryUsage = [];
        $startTime = microtime(true);

        for ($batch = 0; $batch < $batches; $batch++) {
            $batchStart = microtime(true);
            $batchDocuments = [];
            
            // Create batch of documents
            for ($i = 0; $i < $batchSize && ($batch * $batchSize + $i) < $totalDocuments; $i++) {
                $docIndex = $batch * $batchSize + $i;
                $beneficiary = $this->beneficiaries[$docIndex % count($this->beneficiaries)];
                $docName = array_keys($this->baseDocuments)[$docIndex % count($this->baseDocuments)];
                $docInfo = $this->baseDocuments[$docName];
                
                $document = Document::factory()->create([
                    'beneficiary_id' => $beneficiary->id,
                    'type' => $docInfo['type'],
                    'status' => 'processing',
                    'file_path' => "documents/volume_test_{$docIndex}.jpg",
                    'file_size' => $docInfo['size_kb'] * 1024
                ]);
                
                $batchDocuments[] = $document;
            }

            // Process batch
            try {
                $batchResults = $this->processBatchDocuments($batchDocuments);
                $batchTime = (microtime(true) - $batchStart) * 1000;
                
                $allResults[] = [
                    'batch_number' => $batch + 1,
                    'documents_in_batch' => count($batchDocuments),
                    'processing_time_ms' => $batchTime,
                    'success' => true,
                    'documents_processed' => count($batchResults),
                    'avg_time_per_doc' => $batchTime / count($batchDocuments)
                ];
                
                // Track memory usage
                $memoryUsage[] = [
                    'batch' => $batch + 1,
                    'memory_mb' => memory_get_usage(true) / 1024 / 1024,
                    'peak_memory_mb' => memory_get_peak_usage(true) / 1024 / 1024
                ];
                
                // Force garbage collection to prevent memory leaks
                gc_collect_cycles();
                
            } catch (\Exception $e) {
                $allResults[] = [
                    'batch_number' => $batch + 1,
                    'success' => false,
                    'error' => $e->getMessage(),
                    'processing_time_ms' => (microtime(true) - $batchStart) * 1000
                ];
            }
            
            // Brief pause between batches to simulate real-world conditions
            usleep(100000); // 100ms
        }

        $totalTime = (microtime(true) - $startTime) * 1000;
        $successfulBatches = array_filter($allResults, fn($r) => $r['success']);
        $totalDocsProcessed = array_sum(array_column($successfulBatches, 'documents_processed'));

        // Calculate performance metrics
        $throughput = $totalDocsProcessed / ($totalTime / 1000); // Documents per second
        $avgBatchTime = array_sum(array_column($successfulBatches, 'processing_time_ms')) / max(count($successfulBatches), 1);
        $peakMemory = max(array_column($memoryUsage, 'peak_memory_mb'));

        // Store volume test results
        $this->storeLoadTestResults('high_volume', [
            'test_config' => [
                'total_documents' => $totalDocuments,
                'batch_size' => $batchSize,
                'total_batches' => $batches
            ],
            'results' => [
                'total_time_ms' => $totalTime,
                'total_documents_processed' => $totalDocsProcessed,
                'throughput_docs_per_second' => round($throughput, 2),
                'avg_batch_time_ms' => $avgBatchTime,
                'successful_batches' => count($successfulBatches),
                'failed_batches' => count($allResults) - count($successfulBatches),
                'peak_memory_mb' => $peakMemory
            ],
            'batch_results' => $allResults,
            'memory_usage' => $memoryUsage
        ]);

        // Assert performance requirements for high volume
        $this->assertGreaterThan(0.5, $throughput, 'Should process at least 0.5 documents per second');
        $this->assertLessThan(500, $peakMemory, 'Peak memory usage should be < 500MB');
        $this->assertGreaterThanOrEqual(90, (count($successfulBatches) / count($allResults)) * 100, 'Batch success rate should be >= 90%');
        
        Log::info("Volume Test Results - Throughput: {$throughput} docs/sec, Peak Memory: {$peakMemory}MB");
    }

    /** @test */
    public function it_can_handle_memory_pressure_gracefully()
    {
        // Simulate memory-intensive processing
        $largeDocuments = [];
        $memoryLimit = 256 * 1024 * 1024; // 256MB limit for test
        
        // Create progressively larger documents
        for ($i = 0; $i < 20; $i++) {
            $beneficiary = $this->beneficiaries[$i % count($this->beneficiaries)];
            $docSize = (1 + $i) * 2 * 1024 * 1024; // 2MB, 4MB, 6MB, etc.
            
            $document = Document::factory()->create([
                'beneficiary_id' => $beneficiary->id,
                'type' => 'rg',
                'status' => 'processing',
                'file_path' => "documents/large_test_{$i}.jpg",
                'file_size' => $docSize
            ]);
            
            $largeDocuments[] = $document;
        }

        $results = [];
        $memoryEvents = [];
        $startTime = microtime(true);

        foreach ($largeDocuments as $index => $document) {
            $beforeMemory = memory_get_usage(true);
            $beforePeak = memory_get_peak_usage(true);
            
            try {
                $docStart = microtime(true);
                
                // Check if approaching memory limit
                if ($beforeMemory > $memoryLimit * 0.8) {
                    $memoryEvents[] = [
                        'event' => 'memory_pressure_detected',
                        'document_index' => $index,
                        'memory_usage_mb' => $beforeMemory / 1024 / 1024,
                        'action' => 'trigger_gc'
                    ];
                    
                    // Force garbage collection
                    gc_collect_cycles();
                }
                
                // Simulate processing with memory allocation
                $result = $this->processLargeDocument($document);
                $processingTime = (microtime(true) - $docStart) * 1000;
                
                $afterMemory = memory_get_usage(true);
                $afterPeak = memory_get_peak_usage(true);
                
                $results[] = [
                    'document_index' => $index,
                    'file_size_mb' => $document->file_size / 1024 / 1024,
                    'processing_time_ms' => $processingTime,
                    'memory_before_mb' => $beforeMemory / 1024 / 1024,
                    'memory_after_mb' => $afterMemory / 1024 / 1024,
                    'memory_delta_mb' => ($afterMemory - $beforeMemory) / 1024 / 1024,
                    'peak_memory_mb' => $afterPeak / 1024 / 1024,
                    'success' => true
                ];
                
                // Simulate memory cleanup
                if ($afterMemory > $memoryLimit * 0.9) {
                    $memoryEvents[] = [
                        'event' => 'critical_memory_usage',
                        'document_index' => $index,
                        'memory_usage_mb' => $afterMemory / 1024 / 1024,
                        'action' => 'aggressive_cleanup'
                    ];
                    
                    // Aggressive cleanup
                    unset($result);
                    gc_collect_cycles();
                }
                
            } catch (\Exception $e) {
                $results[] = [
                    'document_index' => $index,
                    'file_size_mb' => $document->file_size / 1024 / 1024,
                    'success' => false,
                    'error' => $e->getMessage(),
                    'memory_before_mb' => $beforeMemory / 1024 / 1024
                ];
                
                if (strpos($e->getMessage(), 'memory') !== false) {
                    $memoryEvents[] = [
                        'event' => 'memory_error',
                        'document_index' => $index,
                        'error' => $e->getMessage()
                    ];
                }
            }
        }

        $totalTime = (microtime(true) - $startTime) * 1000;
        $successfulDocs = array_filter($results, fn($r) => $r['success']);
        $memoryErrors = array_filter($results, fn($r) => !$r['success'] && strpos($r['error'] ?? '', 'memory') !== false);

        // Store memory pressure test results
        $this->storeLoadTestResults('memory_pressure', [
            'test_config' => [
                'total_documents' => count($largeDocuments),
                'memory_limit_mb' => $memoryLimit / 1024 / 1024,
                'max_doc_size_mb' => max(array_column($results, 'file_size_mb'))
            ],
            'results' => [
                'total_time_ms' => $totalTime,
                'successful_documents' => count($successfulDocs),
                'memory_errors' => count($memoryErrors),
                'max_memory_usage_mb' => max(array_column($results, 'memory_after_mb')),
                'avg_memory_per_doc_mb' => array_sum(array_column($successfulDocs, 'memory_delta_mb')) / max(count($successfulDocs), 1)
            ],
            'document_results' => $results,
            'memory_events' => $memoryEvents
        ]);

        // Assert memory handling requirements
        $this->assertLessThan(3, count($memoryErrors), 'Should handle memory pressure with minimal errors');
        $maxMemoryUsage = max(array_column($results, 'memory_after_mb'));
        $this->assertLessThan(400, $maxMemoryUsage, 'Memory usage should stay reasonable'); // Allow some overhead
        
        Log::info("Memory Pressure Test - Max Memory: {$maxMemoryUsage}MB, Memory Events: " . count($memoryEvents));
    }

    /** @test */
    public function it_can_maintain_database_performance_under_load()
    {
        $documentsToCreate = 500;
        $queryBatches = 50;
        
        $dbMetrics = [];
        $startTime = microtime(true);

        // Create many documents to stress database
        $createdDocuments = [];
        for ($i = 0; $i < $documentsToCreate; $i++) {
            $beneficiary = $this->beneficiaries[$i % count($this->beneficiaries)];
            $docName = array_keys($this->baseDocuments)[$i % count($this->baseDocuments)];
            $docInfo = $this->baseDocuments[$docName];
            
            $document = Document::factory()->create([
                'beneficiary_id' => $beneficiary->id,
                'type' => $docInfo['type'],
                'status' => ['processing', 'approved', 'rejected', 'pending'][rand(0, 3)],
                'file_path' => "documents/db_load_test_{$i}.jpg",
                'ocr_data' => $this->generateMockOcrData($docInfo['type']),
                'validation_results' => $this->generateMockValidationResults()
            ]);
            
            $createdDocuments[] = $document;
        }

        // Test various database operations under load
        for ($batch = 0; $batch < $queryBatches; $batch++) {
            $batchStart = microtime(true);
            
            // Test different query patterns
            $queries = [
                // Simple queries
                fn() => Document::where('status', 'approved')->count(),
                fn() => Document::where('type', 'rg')->limit(10)->get(),
                
                // Complex queries with joins
                fn() => Document::with('beneficiary.user')
                    ->where('status', 'processing')
                    ->whereHas('beneficiary', function($q) {
                        $q->where('full_name', 'LIKE', 'João%');
                    })->get(),
                
                // Aggregation queries
                fn() => Document::selectRaw('type, COUNT(*) as count, AVG(file_size) as avg_size')
                    ->groupBy('type')->get(),
                
                // Full-text search simulation
                fn() => Document::whereRaw("JSON_EXTRACT(ocr_data, '$.raw_text') LIKE ?", ['%JOÃO%'])->limit(5)->get()
            ];
            
            $batchQueries = [];
            foreach ($queries as $queryIndex => $query) {
                $queryStart = microtime(true);
                try {
                    $result = $query();
                    $queryTime = (microtime(true) - $queryStart) * 1000;
                    
                    $batchQueries[] = [
                        'query_index' => $queryIndex,
                        'execution_time_ms' => $queryTime,
                        'success' => true,
                        'result_count' => is_countable($result) ? count($result) : ($result ?? 0)
                    ];
                } catch (\Exception $e) {
                    $batchQueries[] = [
                        'query_index' => $queryIndex,
                        'execution_time_ms' => (microtime(true) - $queryStart) * 1000,
                        'success' => false,
                        'error' => $e->getMessage()
                    ];
                }
            }
            
            $batchTime = (microtime(true) - $batchStart) * 1000;
            $dbMetrics[] = [
                'batch_number' => $batch + 1,
                'batch_time_ms' => $batchTime,
                'queries' => $batchQueries,
                'avg_query_time_ms' => array_sum(array_column($batchQueries, 'execution_time_ms')) / count($batchQueries)
            ];
        }

        $totalTime = (microtime(true) - $startTime) * 1000;
        $allQueries = array_merge(...array_column($dbMetrics, 'queries'));
        $successfulQueries = array_filter($allQueries, fn($q) => $q['success']);
        $avgQueryTime = array_sum(array_column($successfulQueries, 'execution_time_ms')) / max(count($successfulQueries), 1);
        $slowQueries = array_filter($successfulQueries, fn($q) => $q['execution_time_ms'] > 1000); // > 1 second

        // Store database performance results
        $this->storeLoadTestResults('database_performance', [
            'test_config' => [
                'documents_created' => $documentsToCreate,
                'query_batches' => $queryBatches,
                'queries_per_batch' => count($queries),
                'total_queries' => count($allQueries)
            ],
            'results' => [
                'total_time_ms' => $totalTime,
                'avg_query_time_ms' => $avgQueryTime,
                'successful_queries' => count($successfulQueries),
                'failed_queries' => count($allQueries) - count($successfulQueries),
                'slow_queries' => count($slowQueries),
                'queries_per_second' => count($successfulQueries) / ($totalTime / 1000)
            ],
            'batch_metrics' => $dbMetrics
        ]);

        // Assert database performance requirements
        $this->assertLessThan(500, $avgQueryTime, 'Average query time should be < 500ms');
        $this->assertLessThan(5, count($slowQueries), 'Should have < 5 slow queries');
        $this->assertGreaterThan(95, (count($successfulQueries) / count($allQueries)) * 100, 'Query success rate should be > 95%');
        
        Log::info("Database Performance - Avg Query Time: {$avgQueryTime}ms, Slow Queries: " . count($slowQueries));
    }

    /**
     * Process multiple documents concurrently (simulated)
     */
    protected function processDocumentsConcurrently(array $documents): array
    {
        $results = [];
        
        foreach ($documents as $document) {
            $startTime = microtime(true);
            
            // Simulate OCR processing time based on file size
            $processingTime = max(500, ($document->file_size / 1024) * 2); // 2ms per KB, minimum 500ms
            usleep($processingTime * 1000); // Convert to microseconds
            
            // Simulate occasional failures
            if (rand(0, 20) === 0) { // 5% failure rate
                throw new \Exception('Simulated OCR processing failure');
            }
            
            $actualTime = (microtime(true) - $startTime) * 1000;
            
            $results[] = [
                'document_id' => $document->id,
                'type' => $document->type,
                'file_size_kb' => $document->file_size / 1024,
                'processing_time_ms' => $actualTime,
                'service_used' => rand(0, 1) ? 'textract' : 'tesseract'
            ];
            
            // Update document status
            $document->update([
                'status' => 'approved',
                'ocr_data' => $this->generateMockOcrData($document->type)
            ]);
        }
        
        return $results;
    }

    /**
     * Process batch of documents
     */
    protected function processBatchDocuments(array $documents): array
    {
        return $this->processDocumentsConcurrently($documents);
    }

    /**
     * Process large document with memory simulation
     */
    protected function processLargeDocument(Document $document): array
    {
        // Simulate memory-intensive OCR processing
        $fileSizeMB = $document->file_size / 1024 / 1024;
        
        // Allocate memory proportional to file size (simulating image loading)
        $memoryToAllocate = min($fileSizeMB * 0.5 * 1024 * 1024, 50 * 1024 * 1024); // Max 50MB
        $mockImageData = str_repeat('x', (int)$memoryToAllocate);
        
        // Simulate processing time
        usleep(($fileSizeMB * 100000)); // 100ms per MB
        
        $result = [
            'raw_text' => 'Mock OCR text for large document',
            'forms' => [
                ['key' => 'Nome', 'value' => 'João Silva', 'confidence' => 90.0]
            ],
            'file_size_mb' => $fileSizeMB,
            'memory_allocated_mb' => $memoryToAllocate / 1024 / 1024
        ];
        
        // Clean up allocated memory
        unset($mockImageData);
        
        return $result;
    }

    /**
     * Generate mock OCR data for testing
     */
    protected function generateMockOcrData(string $type): array
    {
        $mockData = [
            'rg' => [
                'raw_text' => 'REGISTRO GERAL\nJOÃO SILVA SANTOS\n12.345.678-9',
                'forms' => [
                    ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 95.0],
                    ['key' => 'RG', 'value' => '12.345.678-9', 'confidence' => 98.0]
                ]
            ],
            'cpf' => [
                'raw_text' => 'CPF: 123.456.789-00\nJOÃO SILVA SANTOS',
                'forms' => [
                    ['key' => 'CPF', 'value' => '123.456.789-00', 'confidence' => 99.0],
                    ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 94.0]
                ]
            ],
            'cnh' => [
                'raw_text' => 'CNH: 12345678901\nJOÃO SILVA SANTOS\nValid até: 15/05/2028',
                'forms' => [
                    ['key' => 'CNH', 'value' => '12345678901', 'confidence' => 97.0],
                    ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 96.0]
                ]
            ],
            'comprovante_residencia' => [
                'raw_text' => 'CONTA DE LUZ\nJOÃO SILVA SANTOS\nRua das Flores, 123',
                'forms' => [
                    ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 91.0],
                    ['key' => 'Endereco', 'value' => 'Rua das Flores, 123', 'confidence' => 88.0]
                ]
            ]
        ];
        
        return $mockData[$type] ?? $mockData['rg'];
    }

    /**
     * Generate mock validation results
     */
    protected function generateMockValidationResults(): array
    {
        return [
            'is_valid' => rand(0, 9) > 1, // 90% valid
            'confidence_score' => rand(70, 99),
            'errors' => [],
            'warnings' => rand(0, 2) ? [] : ['Minor formatting difference detected']
        ];
    }

    /**
     * Store load test results
     */
    protected function storeLoadTestResults(string $testType, array $results): void
    {
        $filePath = storage_path("logs/ocr_load_test_{$testType}_" . date('Y-m-d_H-i-s') . '.json');
        
        $testData = [
            'timestamp' => now()->toISOString(),
            'test_type' => $testType,
            'results' => $results,
            'environment' => [
                'php_version' => PHP_VERSION,
                'memory_limit' => ini_get('memory_limit'),
                'max_execution_time' => ini_get('max_execution_time'),
                'database' => config('database.default')
            ]
        ];
        
        file_put_contents($filePath, json_encode($testData, JSON_PRETTY_PRINT));
        
        Log::info("OCR load test results stored: $filePath");
    }
}