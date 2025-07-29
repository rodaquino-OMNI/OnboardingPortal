<?php

namespace App\Services;

use App\Models\Beneficiary;
use Aws\Textract\TextractClient;
use Aws\Exception\AwsException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class OptimizedTextractService extends EnhancedOCRService
{
    private const COST_THRESHOLDS = [
        'daily' => 1000.00,   // $1000 daily limit
        'monthly' => 25000.00, // $25000 monthly limit
    ];

    protected TextractCostOptimizationService $costService;
    protected DocumentPreprocessingService $preprocessingService;
    protected TextractMonitoringService $monitoringService;

    public function __construct(
        TesseractOCRService $tesseractService,
        TextractCostOptimizationService $costService,
        DocumentPreprocessingService $preprocessingService,
        TextractMonitoringService $monitoringService
    ) {
        parent::__construct($tesseractService);
        $this->costService = $costService;
        $this->preprocessingService = $preprocessingService;
        $this->monitoringService = $monitoringService;
    }

    /**
     * Optimized document processing with cost management
     */
    public function processDocumentOptimized(string $filePath, array $options = []): array
    {
        // Pre-process document to reduce costs
        $optimizedFile = $this->preprocessingService->optimizeForTextract($filePath);

        // Check cost limits before processing
        if (!$this->costService->canProcessDocument($optimizedFile)) {
            Log::warning('Textract processing blocked: cost limit reached', [
                'file_path' => $filePath,
                'daily_usage' => $this->costService->getDailyUsage('textract'),
                'monthly_usage' => $this->costService->getMonthlyUsage('textract'),
            ]);

            // Use Tesseract fallback
            return $this->processWithTesseract($filePath, $options);
        }

        try {
            // Estimate cost before processing
            $estimatedCost = $this->costService->estimateProcessingCost($optimizedFile);
            
            // Process with Textract
            $result = $this->processWithTextractOptimized($optimizedFile, $options);

            // Record actual cost
            $this->costService->recordActualCost($estimatedCost, $result);

            // Monitor performance
            $this->monitoringService->recordProcessingMetrics($filePath, $result);

            return $result;

        } catch (AwsException $e) {
            // Handle specific AWS errors
            return $this->handleTextractError($e, $filePath, $options);
        }
    }

    /**
     * Enhanced Textract processing with intelligent feature selection
     */
    private function processWithTextractOptimized(string $filePath, array $options = []): array
    {
        // Intelligent feature selection based on document type
        $documentType = $this->detectDocumentType($filePath);
        $features = $this->selectOptimalFeatures($documentType, $options);

        // Upload to S3 if not already there
        $s3Path = $this->ensureS3Upload($filePath);

        // Process with optimized parameters
        $result = $this->textractClient->analyzeDocument([
            'Document' => [
                'S3Object' => [
                    'Bucket' => $this->config['drivers']['textract']['bucket'],
                    'Name' => $s3Path
                ]
            ],
            'FeatureTypes' => $features,
            'QueriesConfig' => $this->buildQueriesConfig($documentType),
        ]);

        // Extract and enhance data
        $extractedData = $this->extractEnhancedTextractData($result, $documentType);

        // Post-process for better accuracy
        return $this->postProcessTextractData($extractedData, $documentType);
    }

    /**
     * Intelligent document type detection
     */
    private function detectDocumentType(string $filePath): string
    {
        // Use image analysis for document type detection
        $image = imagecreatefromstring(file_get_contents($filePath));
        
        // Analyze image characteristics
        $width = imagesx($image);
        $height = imagesy($image);
        $aspectRatio = $width / $height;

        // Document type patterns
        if ($aspectRatio > 1.4 && $aspectRatio < 1.6) {
            return 'id_document'; // RG, CNH, etc.
        } elseif ($aspectRatio > 0.7 && $aspectRatio < 0.8) {
            return 'portrait_document'; // CPF, foto 3x4
        } elseif ($this->preprocessingService->hasTableStructure($filePath)) {
            return 'form_document'; // Formulários
        } else {
            return 'general_document';
        }
    }

    /**
     * Select optimal features based on document type
     */
    private function selectOptimalFeatures(string $documentType, array $options = []): array
    {
        $baseFeatures = ['FORMS'];

        $featureMap = [
            'id_document' => ['FORMS'],
            'form_document' => ['FORMS', 'TABLES'],
            'medical_report' => ['FORMS', 'TABLES'],
            'general_document' => ['FORMS'],
        ];

        $features = $featureMap[$documentType] ?? $baseFeatures;

        // Add additional features based on options
        if ($options['extract_signatures'] ?? false) {
            $features[] = 'SIGNATURES';
        }

        if ($options['extract_layout'] ?? false) {
            $features[] = 'LAYOUT';
        }

        return array_unique($features);
    }

    /**
     * Build queries configuration for specific document types
     */
    private function buildQueriesConfig(string $documentType): ?array
    {
        $queries = [];

        switch ($documentType) {
            case 'id_document':
                $queries = [
                    ['Text' => 'Qual é o nome completo?'],
                    ['Text' => 'Qual é o número do documento?'],
                    ['Text' => 'Qual é a data de nascimento?'],
                    ['Text' => 'Qual é o CPF?'],
                ];
                break;

            case 'form_document':
                $queries = [
                    ['Text' => 'Qual é o nome do paciente?'],
                    ['Text' => 'Qual é a data de consulta?'],
                    ['Text' => 'Quais são os sintomas relatados?'],
                ];
                break;
        }

        return empty($queries) ? null : ['Queries' => $queries];
    }

    /**
     * Enhanced data extraction with document-specific logic
     */
    private function extractEnhancedTextractData($result, string $documentType): array
    {
        $extractedData = parent::extractTextractData($result);

        // Apply document-specific enhancements
        switch ($documentType) {
            case 'id_document':
                $extractedData = $this->enhanceIdDocumentData($extractedData);
                break;

            case 'form_document':
                $extractedData = $this->enhanceFormDocumentData($extractedData);
                break;
        }

        // Add quality metrics
        $extractedData['quality_metrics'] = $this->calculateQualityMetrics($extractedData);

        return $extractedData;
    }

    /**
     * Enhance ID document data extraction
     */
    private function enhanceIdDocumentData(array $data): array
    {
        // Look for Brazilian ID patterns
        foreach ($data['forms'] as &$form) {
            // CPF pattern
            if (preg_match('/CPF/i', $form['key'])) {
                $form['value'] = $this->formatCPF($form['value']);
                $form['field_type'] = 'cpf';
            }
            
            // RG pattern
            if (preg_match('/RG|registro geral/i', $form['key'])) {
                $form['value'] = $this->formatRG($form['value']);
                $form['field_type'] = 'rg';
            }
            
            // Date pattern
            if (preg_match('/data|nascimento/i', $form['key'])) {
                $form['value'] = $this->parseBrazilianDate($form['value']);
                $form['field_type'] = 'date';
            }
        }

        return $data;
    }

    /**
     * Enhance form document data extraction
     */
    private function enhanceFormDocumentData(array $data): array
    {
        // Process tables for better structure
        foreach ($data['tables'] as &$table) {
            // Identify header rows
            if (count($table['rows']) > 0) {
                $table['headers'] = $table['rows'][0];
                $table['data_rows'] = array_slice($table['rows'], 1);
            }
        }

        return $data;
    }

    /**
     * Calculate quality metrics for extracted data
     */
    private function calculateQualityMetrics(array $data): array
    {
        $metrics = [
            'confidence_distribution' => $this->calculateConfidenceDistribution($data),
            'completeness_score' => $this->calculateCompletenessScore($data),
            'data_quality_score' => $this->calculateDataQualityScore($data),
            'processing_recommendations' => $this->generateProcessingRecommendations($data),
        ];

        return $metrics;
    }

    /**
     * Post-process data for improved accuracy
     */
    private function postProcessTextractData(array $data, string $documentType): array
    {
        // Apply document-specific post-processing
        $processor = match ($documentType) {
            'id_document' => new IdDocumentProcessor(),
            'form_document' => new FormDocumentProcessor(),
            default => new GeneralDocumentProcessor(),
        };

        // Check if processor exists, if not use default processing
        if (!class_exists($processor::class)) {
            return $this->defaultPostProcessing($data);
        }

        return $processor->process($data);
    }

    /**
     * Default post-processing for documents
     */
    private function defaultPostProcessing(array $data): array
    {
        // Basic post-processing
        $data['processed'] = true;
        $data['processing_timestamp'] = now()->toISOString();
        
        return $data;
    }

    /**
     * Handle Textract-specific errors with intelligent fallbacks
     */
    private function handleTextractError(AwsException $e, string $filePath, array $options = []): array
    {
        $errorCode = $e->getAwsErrorCode();
        $errorType = $e->getAwsErrorType();

        Log::error('Textract processing error', [
            'error_code' => $errorCode,
            'error_type' => $errorType,
            'message' => $e->getMessage(),
            'file_path' => $filePath,
        ]);

        // Handle specific error types
        switch ($errorCode) {
            case 'ThrottlingException':
                // Implement exponential backoff
                return $this->handleThrottling($filePath, $options);

            case 'InvalidS3ObjectException':
                // Re-upload and retry
                return $this->handleInvalidS3Object($filePath, $options);

            case 'UnsupportedDocumentException':
                // Use Tesseract for unsupported formats
                return $this->processWithTesseract($filePath, $options);

            case 'AccessDeniedException':
                // Check and fix permissions
                return $this->handleAccessDenied($filePath, $options);

            default:
                // Generic fallback to Tesseract
                return $this->processWithTesseract($filePath, $options);
        }
    }

    /**
     * Handle throttling with exponential backoff
     */
    private function handleThrottling(string $filePath, array $options): array
    {
        static $retryCount = 0;
        $maxRetries = 3;
        
        if ($retryCount >= $maxRetries) {
            $retryCount = 0;
            return $this->processWithTesseract($filePath, $options);
        }
        
        $retryCount++;
        $delay = pow(2, $retryCount) * 1000; // Exponential backoff in milliseconds
        usleep($delay * 1000);
        
        return $this->processDocumentOptimized($filePath, $options);
    }

    /**
     * Handle invalid S3 object error
     */
    private function handleInvalidS3Object(string $filePath, array $options): array
    {
        // Re-upload the file
        $s3Path = $this->uploadToS3($filePath, true); // Force re-upload
        
        if ($s3Path) {
            return $this->processDocumentOptimized($filePath, $options);
        }
        
        return $this->processWithTesseract($filePath, $options);
    }

    /**
     * Handle access denied error
     */
    private function handleAccessDenied(string $filePath, array $options): array
    {
        Log::error('AWS Textract access denied. Check IAM permissions.');
        
        // Fallback to Tesseract
        return $this->processWithTesseract($filePath, $options);
    }

    /**
     * Ensure file is uploaded to S3
     */
    private function ensureS3Upload(string $filePath): string
    {
        $s3Path = 'ocr-documents/' . basename($filePath);
        
        if (!Storage::disk('s3')->exists($s3Path)) {
            Storage::disk('s3')->put($s3Path, file_get_contents($filePath));
        }
        
        return $s3Path;
    }

    /**
     * Upload file to S3
     */
    private function uploadToS3(string $filePath, bool $force = false): ?string
    {
        try {
            $s3Path = 'ocr-documents/' . uniqid() . '_' . basename($filePath);
            Storage::disk('s3')->put($s3Path, file_get_contents($filePath));
            return $s3Path;
        } catch (\Exception $e) {
            Log::error('S3 upload failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Format CPF number
     */
    private function formatCPF(string $cpf): string
    {
        $cpf = preg_replace('/[^0-9]/', '', $cpf);
        if (strlen($cpf) === 11) {
            return sprintf('%s.%s.%s-%s',
                substr($cpf, 0, 3),
                substr($cpf, 3, 3),
                substr($cpf, 6, 3),
                substr($cpf, 9, 2)
            );
        }
        return $cpf;
    }

    /**
     * Format RG number
     */
    private function formatRG(string $rg): string
    {
        // RG format varies by state, so just clean it
        return preg_replace('/[^0-9A-Za-z\-]/', '', $rg);
    }

    /**
     * Parse Brazilian date format
     */
    private function parseBrazilianDate(string $date): string
    {
        // Try to parse DD/MM/YYYY format
        if (preg_match('/(\d{1,2})\/(\d{1,2})\/(\d{4})/', $date, $matches)) {
            return sprintf('%04d-%02d-%02d', $matches[3], $matches[2], $matches[1]);
        }
        return $date;
    }

    /**
     * Calculate confidence distribution
     */
    private function calculateConfidenceDistribution(array $data): array
    {
        $scores = $data['confidence_scores'] ?? [];
        if (empty($scores)) {
            return [];
        }

        return [
            'min' => min($scores),
            'max' => max($scores),
            'average' => array_sum($scores) / count($scores),
            'median' => $this->calculateMedian($scores),
            'high_confidence_percentage' => count(array_filter($scores, fn($s) => $s >= 90)) / count($scores) * 100,
        ];
    }

    /**
     * Calculate completeness score
     */
    private function calculateCompletenessScore(array $data): float
    {
        $score = 0;
        $weights = [
            'raw_text' => 0.2,
            'forms' => 0.3,
            'tables' => 0.2,
            'blocks' => 0.3,
        ];

        foreach ($weights as $key => $weight) {
            if (!empty($data[$key])) {
                $score += $weight;
            }
        }

        return $score * 100;
    }

    /**
     * Calculate data quality score
     */
    private function calculateDataQualityScore(array $data): float
    {
        $avgConfidence = $data['average_confidence'] ?? 0;
        $completeness = $this->calculateCompletenessScore($data) / 100;
        
        return ($avgConfidence * 0.7 + $completeness * 0.3);
    }

    /**
     * Generate processing recommendations
     */
    private function generateProcessingRecommendations(array $data): array
    {
        $recommendations = [];
        
        $avgConfidence = $data['average_confidence'] ?? 0;
        if ($avgConfidence < 80) {
            $recommendations[] = 'Consider improving image quality or resolution';
        }
        
        if (empty($data['forms']) && empty($data['tables'])) {
            $recommendations[] = 'Document may not contain structured data';
        }
        
        return $recommendations;
    }

    /**
     * Calculate median value
     */
    private function calculateMedian(array $values): float
    {
        sort($values);
        $count = count($values);
        $middle = floor(($count - 1) / 2);
        
        if ($count % 2) {
            return $values[$middle];
        } else {
            return ($values[$middle] + $values[$middle + 1]) / 2;
        }
    }
}