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
     * Check if Textract should be used
     */
    protected function shouldUseTextract(): bool
    {
        return $this->textractClient !== null && 
               !Cache::get('textract_quota_exceeded', false);
    }

    /**
     * Process document with enhanced error handling
     */
    public function processDocument(string $filePath, array $options = []): array
    {
        $startTime = microtime(true);
        $attempt = 0;
        $maxAttempts = $this->config['processing']['max_attempts'] ?? 3;
        $lastException = null;

        while ($attempt < $maxAttempts) {
            $attempt++;
            
            try {
                // Validate file before processing
                if (!file_exists($filePath)) {
                    throw new \InvalidArgumentException('Could not process image - file not found');
                }

                // Check file size
                $fileSize = filesize($filePath);
                if ($fileSize === false || $fileSize === 0) {
                    throw new \InvalidArgumentException('Could not process image - file is empty or corrupted');
                }

                if ($fileSize > 50 * 1024 * 1024) { // 50MB limit
                    throw new \InvalidArgumentException('Could not process image - file too large (max 50MB)');
                }

                // Validate file format
                $mimeType = mime_content_type($filePath);
                $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
                
                if (!in_array($mimeType, $allowedTypes)) {
                    throw new \InvalidArgumentException('Could not process image - unsupported file format. Only JPEG, PNG, and PDF are supported.');
                }

                // Try primary OCR service (Textract)
                if ($this->shouldUseTextract()) {
                    try {
                        $result = $this->processWithTextract($filePath, $options);
                        
                        if ($this->isQualityAcceptable($result)) {
                            $this->usageTracker->recordUsage('textract', 1);
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
                            if ($this->isQualityAcceptable($fallbackResult)) {
                                $this->usageTracker->recordUsage('tesseract', 1);
                                return $this->formatSuccessResult($fallbackResult, 'tesseract_aws_fallback', $attempt);
                            }
                        } catch (\Exception $tesseractException) {
                            Log::error("Tesseract fallback also failed", [
                                'tesseract_error' => $tesseractException->getMessage(),
                                'original_aws_error' => $e->getMessage()
                            ]);
                        }
                    }
                } else {
                    // Use Tesseract directly
                    $result = $this->processWithTesseract($filePath, $options);
                    if ($this->isQualityAcceptable($result)) {
                        $this->usageTracker->recordUsage('tesseract', 1);
                        return $this->formatSuccessResult($result, 'tesseract', $attempt);
                    }
                }

                // If we reach here, both services failed or quality was poor
                if ($attempt < $maxAttempts) {
                    sleep(1); // Wait before retry
                    continue;
                }

            } catch (\Exception $e) {
                $lastException = $e;
                Log::error("OCR processing attempt {$attempt} failed", [
                    'error' => $e->getMessage(),
                    'file_path' => $filePath,
                    'options' => $options
                ]);

                // Don't retry for certain types of errors
                if ($this->isNonRetryableError($e)) {
                    break;
                }

                if ($attempt < $maxAttempts) {
                    sleep($attempt); // Exponential backoff
                    continue;
                }
            }
        }

        // All attempts failed
        $processingTime = (microtime(true) - $startTime) * 1000;
        
        return [
            'success' => false,
            'error' => $this->categorizeError($lastException),
            'processing_time' => $processingTime,
            'attempts' => $attempt,
            'service_used' => 'none'
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
        $minConfidence = $this->config['quality']['min_confidence'] ?? 70;
        $minTextLength = $this->config['quality']['text_length_threshold'] ?? 10;
        
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
     * Categorize errors for better user experience
     */
    private function categorizeError(?\Exception $exception): string
    {
        if (!$exception) {
            return 'Could not process image - unknown error occurred';
        }

        $message = $exception->getMessage();

        // File-related errors
        if (str_contains($message, 'file not found') || str_contains($message, 'No such file')) {
            return 'Could not process image - file not found or has been moved';
        }

        if (str_contains($message, 'empty') || str_contains($message, 'corrupted') || str_contains($message, 'invalid format')) {
            return 'Could not process image - file appears to be corrupted or invalid';
        }

        if (str_contains($message, 'too large') || str_contains($message, 'file size')) {
            return 'Could not process image - file is too large (maximum 50MB)';
        }

        if (str_contains($message, 'unsupported') || str_contains($message, 'format')) {
            return 'Could not process image - unsupported file format';
        }

        // Quality-related errors
        if (str_contains($message, 'quality') || str_contains($message, 'resolution') || str_contains($message, 'blur')) {
            return 'Could not process image - image quality too low for text recognition';
        }

        // Service-related errors
        if (str_contains($message, 'timeout') || str_contains($message, 'network') || str_contains($message, 'connection')) {
            return 'Could not process image - service timeout, please try again';
        }

        if (str_contains($message, 'quota') || str_contains($message, 'limit') || str_contains($message, 'rate')) {
            return 'Could not process image - service temporarily unavailable due to high demand';
        }

        if (str_contains($message, 'memory') || str_contains($message, 'resource')) {
            return 'Could not process image - insufficient resources to process this image';
        }

        // AWS-specific errors
        if ($exception instanceof AwsException) {
            $awsErrorCode = $exception->getAwsErrorCode();
            
            switch ($awsErrorCode) {
                case 'InvalidImageFormatException':
                    return 'Could not process image - unsupported or corrupted image format';
                case 'ImageTooLargeException':
                    return 'Could not process image - image file is too large';
                case 'BadDocumentException':
                    return 'Could not process image - document quality is too poor';
                case 'DocumentTooLargeException':
                    return 'Could not process image - document has too many pages';
                case 'UnsupportedDocumentException':
                    return 'Could not process image - document type not supported';
                case 'ThrottlingException':
                    return 'Could not process image - service busy, please try again in a moment';
                case 'InternalServerError':
                    return 'Could not process image - temporary service error, please try again';
                default:
                    return 'Could not process image - AWS service error: ' . $awsErrorCode;
            }
        }

        // Tesseract-specific errors
        if (str_contains($message, 'tesseract') || str_contains($message, 'TesseractOCR')) {
            if (str_contains($message, 'not found') || str_contains($message, 'command not found')) {
                return 'Could not process image - OCR service not available';
            }
            if (str_contains($message, 'failed to read')) {
                return 'Could not process image - unable to read image file';
            }
            return 'Could not process image - text recognition service error';
        }

        // Generic fallback
        return 'Could not process image';
    }

    /**
     * Check if error should not be retried
     */
    private function isNonRetryableError(\Exception $e): bool
    {
        $message = $e->getMessage();
        
        // File format/corruption errors shouldn't be retried
        if (str_contains($message, 'corrupted') || 
            str_contains($message, 'invalid format') || 
            str_contains($message, 'unsupported') ||
            str_contains($message, 'file not found') ||
            str_contains($message, 'too large')) {
            return true;
        }

        // AWS specific non-retryable errors
        if ($e instanceof AwsException) {
            $nonRetryableCodes = [
                'InvalidImageFormatException',
                'ImageTooLargeException',
                'BadDocumentException',
                'DocumentTooLargeException',
                'UnsupportedDocumentException'
            ];
            
            return in_array($e->getAwsErrorCode(), $nonRetryableCodes);
        }

        return false;
    }

    /**
     * Format successful result with consistent structure
     */
    private function formatSuccessResult(array $result, string $service, int $attempts): array
    {
        return [
            'success' => true,
            'text' => $result['raw_text'] ?? $result['text'] ?? '',
            'confidence' => $result['confidence'] ?? $result['average_confidence'] ?? 0,
            'extracted_data' => $result['extracted_data'] ?? [],
            'blocks' => $result['blocks'] ?? [],
            'forms' => $result['forms'] ?? [],
            'processing_time' => $result['processing_time'] ?? 0,
            'service_used' => $service,
            'attempts' => $attempts,
            'metadata' => [
                'timestamp' => now()->toISOString(),
                'version' => '2.0',
                'confidence_threshold' => $this->config['quality']['min_confidence'] ?? 70
            ]
        ];
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