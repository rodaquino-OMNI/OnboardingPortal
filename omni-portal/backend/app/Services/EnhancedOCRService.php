<?php

namespace App\Services;

use App\Models\Beneficiary;
use Aws\Textract\TextractClient;
use Aws\Exception\AwsException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use thiagoalessio\TesseractOCR\TesseractOCR;
use Intervention\Image\Facades\Image;

class EnhancedOCRService
{
    protected $textractClient;
    protected $tesseractService;
    protected $config;
    protected $usageTracker;

    public function __construct(TesseractOCRService $tesseractService)
    {
        $this->config = Config::get('ocr');
        $this->tesseractService = $tesseractService;
        $this->usageTracker = new OCRUsageTracker();
        
        // Check if in test environment and allow mock injection
        if (app()->environment('testing')) {
            // In test environment, textractClient can be injected via setTextractClient method
            Log::info('EnhancedOCRService initialized in test environment');
        } else {
            $this->initializeTextractClient();
        }
    }
    
    /**
     * Set TextractClient for testing purposes
     */
    public function setTextractClient($client): void
    {
        $this->textractClient = $client;
    }

    /**
     * Initialize AWS Textract client with enhanced configuration
     */
    protected function initializeTextractClient(): void
    {
        // Skip AWS client initialization in test environment
        if (app()->environment('testing') && empty($this->config['drivers']['textract']['credentials']['key'])) {
            Log::info('Skipping AWS Textract client initialization in test environment');
            return;
        }

        try {
            $textractConfig = $this->config['drivers']['textract'];
            
            $this->textractClient = new TextractClient([
                'version' => $textractConfig['version'],
                'region' => $textractConfig['region'],
                'credentials' => [
                    'key' => $textractConfig['credentials']['key'],
                    'secret' => $textractConfig['credentials']['secret'],
                ],
                'http' => [
                    'timeout' => $this->config['drivers']['enhanced']['timeout'],
                    'connect_timeout' => 10,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to initialize AWS Textract client', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw new \Exception('OCR service initialization failed: ' . $e->getMessage());
        }
    }

    /**
     * Process document with enhanced OCR (primary: Textract, fallback: Tesseract)
     */
    public function processDocument(string $filePath, array $options = []): array
    {
        $cacheKey = $this->getCacheKey($filePath, $options);
        
        // Check cache first
        if ($this->config['cache']['enabled'] && Cache::has($cacheKey)) {
            Log::info('OCR result retrieved from cache', ['file_path' => $filePath]);
            return Cache::get($cacheKey);
        }

        // Check cost limits
        if (!$this->usageTracker->canProcessDocument()) {
            Log::warning('OCR processing blocked: budget limit reached');
            throw new \Exception('Daily OCR budget limit reached');
        }

        $result = $this->processWithRetry($filePath, $options);
        
        // Cache the result
        if ($this->config['cache']['enabled'] && $result['success']) {
            Cache::put($cacheKey, $result, $this->config['cache']['ttl']);
        }

        return $result;
    }

    /**
     * Process document with retry logic and fallback mechanisms
     */
    protected function processWithRetry(string $filePath, array $options = []): array
    {
        $maxRetries = $this->config['drivers']['enhanced']['max_retries'];
        $retryDelay = $this->config['drivers']['enhanced']['retry_delay'];
        
        $lastException = null;
        
        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                Log::info("OCR processing attempt {$attempt}", ['file_path' => $filePath]);
                
                // Try AWS Textract first
                $result = $this->processWithTextract($filePath, $options);
                
                // Validate quality
                if ($this->isQualityAcceptable($result)) {
                    $this->usageTracker->recordUsage('textract', $this->estimatePages($filePath));
                    return $this->formatSuccessResult($result, 'textract', $attempt);
                }
                
                Log::warning('Textract result quality below threshold', [
                    'confidence' => $result['average_confidence'] ?? 0,
                    'threshold' => $this->config['quality']['fallback_threshold']
                ]);
                
                // Fallback to Tesseract if quality is poor
                $fallbackResult = $this->processWithTesseract($filePath, $options);
                
                if ($this->isQualityAcceptable($fallbackResult)) {
                    $this->usageTracker->recordUsage('tesseract', 1);
                    return $this->formatSuccessResult($fallbackResult, 'tesseract_fallback', $attempt);
                }
                
            } catch (AwsException $e) {
                $lastException = $e;
                Log::error("AWS Textract error on attempt {$attempt}", [
                    'error' => $e->getMessage(),
                    'code' => $e->getAwsErrorCode(),
                    'type' => $e->getAwsErrorType()
                ]);
                
                // Try Tesseract fallback for AWS errors
                try {
                    $fallbackResult = $this->processWithTesseract($filePath, $options);
                    $this->usageTracker->recordUsage('tesseract', 1);
                    return $this->formatSuccessResult($fallbackResult, 'tesseract_fallback', $attempt);
                } catch (\Exception $fallbackException) {
                    Log::error("Tesseract fallback failed on attempt {$attempt}", [
                        'error' => $fallbackException->getMessage()
                    ]);
                }
                
            } catch (\Exception $e) {
                $lastException = $e;
                Log::error("OCR processing error on attempt {$attempt}", [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
            }
            
            // Wait before retry (except for last attempt)
            if ($attempt < $maxRetries) {
                usleep($retryDelay * 1000);
                $retryDelay *= 2; // Exponential backoff
            }
        }
        
        // All attempts failed
        Log::error('All OCR processing attempts failed', [
            'file_path' => $filePath,
            'attempts' => $maxRetries,
            'last_error' => $lastException?->getMessage()
        ]);
        
        return [
            'success' => false,
            'error' => 'OCR processing failed after ' . $maxRetries . ' attempts',
            'last_exception' => $lastException?->getMessage(),
            'attempts' => $maxRetries
        ];
    }

    /**
     * Process document with AWS Textract
     */
    protected function processWithTextract(string $filePath, array $options = []): array
    {
        // Check if TextractClient is available
        if (!$this->textractClient) {
            throw new \Exception('AWS Textract client not initialized');
        }
        
        $bucket = $this->config['drivers']['textract']['bucket'];
        $features = $options['features'] ?? $this->config['drivers']['textract']['features'];
        
        $result = $this->textractClient->analyzeDocument([
            'Document' => [
                'S3Object' => [
                    'Bucket' => $bucket,
                    'Name' => $filePath
                ]
            ],
            'FeatureTypes' => $features
        ]);

        return $this->extractTextractData($result);
    }

    /**
     * Process document with Tesseract OCR fallback
     */
    protected function processWithTesseract(string $filePath, array $options = []): array
    {
        return $this->tesseractService->processDocument($filePath);
    }

    /**
     * Extract structured data from AWS Textract response
     */
    protected function extractTextractData($result): array
    {
        $blocks = $result['Blocks'];
        $extractedData = [
            'raw_text' => '',
            'blocks' => [],
            'forms' => [],
            'tables' => [],
            'confidence_scores' => [],
            'signatures' => []
        ];

        $blockMap = [];
        $keyMap = [];
        $valueMap = [];

        // Build block map
        foreach ($blocks as $block) {
            $blockMap[$block['Id']] = $block;
        }

        // Extract text blocks and confidence scores
        foreach ($blocks as $block) {
            switch ($block['BlockType']) {
                case 'LINE':
                    $extractedData['raw_text'] .= $block['Text'] . "\n";
                    $extractedData['confidence_scores'][] = $block['Confidence'];
                    $extractedData['blocks'][] = [
                        'text' => $block['Text'],
                        'confidence' => $block['Confidence'],
                        'bbox' => $block['Geometry']['BoundingBox'] ?? null
                    ];
                    break;
                    
                case 'KEY_VALUE_SET':
                    if (isset($block['EntityTypes']) && in_array('KEY', $block['EntityTypes'])) {
                        $keyMap[$block['Id']] = $block;
                    } elseif (isset($block['EntityTypes']) && in_array('VALUE', $block['EntityTypes'])) {
                        $valueMap[$block['Id']] = $block;
                    }
                    break;
                    
                case 'TABLE':
                    $extractedData['tables'][] = $this->extractTableData($block, $blockMap);
                    break;
                    
                case 'SIGNATURE':
                    $extractedData['signatures'][] = [
                        'confidence' => $block['Confidence'],
                        'bbox' => $block['Geometry']['BoundingBox'] ?? null
                    ];
                    break;
            }
        }

        // Process key-value pairs
        $extractedData['forms'] = $this->processKeyValuePairs($keyMap, $valueMap, $blockMap);
        
        // Calculate average confidence
        if (!empty($extractedData['confidence_scores'])) {
            $extractedData['average_confidence'] = array_sum($extractedData['confidence_scores']) / count($extractedData['confidence_scores']);
        }

        return $extractedData;
    }

    /**
     * Process key-value pairs from Textract
     */
    protected function processKeyValuePairs(array $keyMap, array $valueMap, array $blockMap): array
    {
        $forms = [];
        
        foreach ($keyMap as $keyId => $keyBlock) {
            $keyText = $this->getTextFromBlock($keyBlock, $blockMap);
            $valueText = '';

            if (isset($keyBlock['Relationships'])) {
                foreach ($keyBlock['Relationships'] as $relationship) {
                    if ($relationship['Type'] === 'VALUE') {
                        foreach ($relationship['Ids'] as $valueId) {
                            if (isset($valueMap[$valueId])) {
                                $valueText = $this->getTextFromBlock($valueMap[$valueId], $blockMap);
                                break;
                            }
                        }
                    }
                }
            }

            if ($keyText && $valueText) {
                $forms[] = [
                    'key' => trim($keyText),
                    'value' => trim($valueText),
                    'confidence' => $keyBlock['Confidence'],
                    'key_bbox' => $keyBlock['Geometry']['BoundingBox'] ?? null,
                    'value_bbox' => isset($valueMap[$valueId]) ? $valueMap[$valueId]['Geometry']['BoundingBox'] ?? null : null
                ];
            }
        }

        return $forms;
    }

    /**
     * Extract table data from Textract
     */
    protected function extractTableData($tableBlock, array $blockMap): array
    {
        $table = [
            'rows' => [],
            'confidence' => $tableBlock['Confidence'],
            'bbox' => $tableBlock['Geometry']['BoundingBox'] ?? null
        ];

        if (!isset($tableBlock['Relationships'])) {
            return $table;
        }

        $cells = [];
        foreach ($tableBlock['Relationships'] as $relationship) {
            if ($relationship['Type'] === 'CHILD') {
                foreach ($relationship['Ids'] as $cellId) {
                    if (isset($blockMap[$cellId]) && $blockMap[$cellId]['BlockType'] === 'CELL') {
                        $cells[] = $blockMap[$cellId];
                    }
                }
            }
        }

        // Organize cells into rows and columns
        $cellMap = [];
        foreach ($cells as $cell) {
            $rowIndex = $cell['RowIndex'] - 1;
            $colIndex = $cell['ColumnIndex'] - 1;
            
            $cellMap[$rowIndex][$colIndex] = [
                'text' => $this->getTextFromBlock($cell, $blockMap),
                'confidence' => $cell['Confidence'],
                'row_span' => $cell['RowSpan'] ?? 1,
                'column_span' => $cell['ColumnSpan'] ?? 1
            ];
        }

        // Convert to ordered array
        ksort($cellMap);
        foreach ($cellMap as $rowIndex => $row) {
            ksort($row);
            $table['rows'][] = array_values($row);
        }

        return $table;
    }

    /**
     * Get text content from a block and its children
     */
    protected function getTextFromBlock($block, array $blockMap): string
    {
        $text = '';
        
        if (isset($block['Relationships'])) {
            foreach ($block['Relationships'] as $relationship) {
                if ($relationship['Type'] === 'CHILD') {
                    foreach ($relationship['Ids'] as $childId) {
                        if (isset($blockMap[$childId]) && $blockMap[$childId]['BlockType'] === 'WORD') {
                            $text .= $blockMap[$childId]['Text'] . ' ';
                        }
                    }
                }
            }
        }

        return trim($text);
    }

    /**
     * Check if OCR result quality is acceptable
     */
    protected function isQualityAcceptable(array $result): bool
    {
        $minConfidence = $this->config['quality']['min_confidence'];
        $minTextLength = $this->config['quality']['text_length_threshold'];
        
        // Check average confidence
        $avgConfidence = $result['average_confidence'] ?? 0;
        if ($avgConfidence < $minConfidence) {
            return false;
        }
        
        // Check text length
        $textLength = strlen($result['raw_text'] ?? '');
        if ($textLength < $minTextLength) {
            return false;
        }
        
        return true;
    }

    /**
     * Format successful result
     */
    protected function formatSuccessResult(array $result, string $method, int $attempts): array
    {
        return array_merge($result, [
            'success' => true,
            'processing_method' => $method,
            'attempts' => $attempts,
            'processed_at' => now()->toISOString(),
            'quality_score' => $this->calculateQualityScore($result)
        ]);
    }

    /**
     * Calculate quality score for the OCR result
     */
    protected function calculateQualityScore(array $result): float
    {
        $score = 0;
        
        // Confidence score weight (50%)
        $avgConfidence = $result['average_confidence'] ?? 0;
        $score += ($avgConfidence / 100) * 50;
        
        // Text length weight (20%)
        $textLength = strlen($result['raw_text'] ?? '');
        $textScore = min(100, ($textLength / 100) * 100); // Normalize to 100
        $score += ($textScore / 100) * 20;
        
        // Forms detected weight (15%)
        $formsCount = count($result['forms'] ?? []);
        $formsScore = min(100, $formsCount * 10);
        $score += ($formsScore / 100) * 15;
        
        // Tables detected weight (10%)
        $tablesCount = count($result['tables'] ?? []);
        $tablesScore = min(100, $tablesCount * 20);
        $score += ($tablesScore / 100) * 10;
        
        // Blocks detected weight (5%)
        $blocksCount = count($result['blocks'] ?? []);
        $blocksScore = min(100, $blocksCount * 2);
        $score += ($blocksScore / 100) * 5;
        
        return round($score, 2);
    }

    /**
     * Generate cache key for OCR result
     */
    protected function getCacheKey(string $filePath, array $options = []): string
    {
        $key = $this->config['cache']['prefix'] . '_' . md5($filePath . serialize($options));
        return $key;
    }

    /**
     * Estimate number of pages in document
     */
    protected function estimatePages(string $filePath): int
    {
        try {
            // For now, assume 1 page for images and estimate for PDFs
            $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
            
            if ($extension === 'pdf') {
                // Could implement PDF page counting here
                return 1; // Default assumption
            }
            
            return 1;
        } catch (\Exception $e) {
            return 1;
        }
    }

    /**
     * Extract structured data based on document type
     */
    public function extractStructuredData(string $documentType, array $ocrData): array
    {
        // Delegate to existing OCRService for document-specific extraction
        $ocrService = new OCRService();
        return $ocrService->extractStructuredData($documentType, $ocrData);
    }

    /**
     * Validate extracted data against beneficiary information
     */
    public function validateExtractedData(string $documentType, array $extractedData, Beneficiary $beneficiary): array
    {
        // Delegate to existing OCRService for validation
        $ocrService = new OCRService();
        return $ocrService->validateExtractedData($documentType, $extractedData, $beneficiary);
    }
}