<?php

namespace App\Jobs;

use App\Models\Document;
use App\Services\OptimizedTextractService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ProcessDocumentOCR implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The document instance.
     *
     * @var \App\Models\Document
     */
    protected $document;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout = 300; // 5 minutes

    /**
     * The number of seconds to wait before retrying the job.
     *
     * @var int
     */
    public $backoff = 60;

    /**
     * Create a new job instance.
     *
     * @param  \App\Models\Document  $document
     * @return void
     */
    public function __construct(Document $document)
    {
        $this->document = $document;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle(OptimizedTextractService $textractService)
    {
        Log::info('Starting OCR processing', [
            'document_id' => $this->document->id,
            'type' => $this->document->type,
            'attempt' => $this->attempts()
        ]);

        try {
            // Get file path
            $filePath = $this->document->file_path;
            
            // Check if file exists
            if (!Storage::exists($filePath)) {
                throw new \Exception('Document file not found: ' . $filePath);
            }

            // Get absolute path for OCR processing
            $absolutePath = Storage::path($filePath);

            // Prepare processing options
            $options = $this->document->processing_options ?? [];
            
            // Force Textract if specified
            if ($options['force_textract'] ?? false) {
                $result = $textractService->processWithTextractOptimized($absolutePath, $options);
            } else {
                // Use optimized processing with automatic fallback
                $result = $textractService->processDocumentOptimized($absolutePath, $options);
            }

            // Validate OCR results
            if (empty($result) || !isset($result['raw_text'])) {
                throw new \Exception('Invalid OCR result structure');
            }

            // Extract and validate data based on document type
            $validationResults = $this->validateDocumentData($result, $this->document->type);

            // Update document with results
            $this->document->update([
                'status' => 'completed',
                'processed_at' => now(),
                'ocr_data' => $result,
                'validation_results' => $validationResults,
                'error_message' => null,
            ]);

            // Dispatch events for post-processing
            event(new \App\Events\DocumentProcessed($this->document));

            Log::info('OCR processing completed successfully', [
                'document_id' => $this->document->id,
                'confidence' => $result['average_confidence'] ?? 0,
                'quality' => $result['quality_metrics']['overall_quality'] ?? 0,
            ]);

        } catch (\Exception $e) {
            $this->handleProcessingError($e);
        }
    }

    /**
     * Handle processing errors
     */
    protected function handleProcessingError(\Exception $e): void
    {
        Log::error('OCR processing failed', [
            'document_id' => $this->document->id,
            'attempt' => $this->attempts(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        // Update document status
        if ($this->attempts() >= $this->tries) {
            // Final failure
            $this->document->update([
                'status' => 'failed',
                'error_message' => 'OCR processing failed: ' . $e->getMessage(),
                'processed_at' => now(),
            ]);

            // Dispatch failure event
            event(new \App\Events\DocumentProcessingFailed($this->document, $e));
        } else {
            // Temporary failure, will retry
            $this->document->update([
                'status' => 'processing',
                'error_message' => 'Processing attempt ' . $this->attempts() . ' failed, retrying...',
            ]);
        }
    }

    /**
     * Validate document data based on type
     */
    protected function validateDocumentData(array $ocrData, string $documentType): array
    {
        $validation = [
            'status' => 'passed',
            'checks' => [],
            'warnings' => [],
        ];

        switch ($documentType) {
            case 'rg':
                $validation = $this->validateRG($ocrData);
                break;
                
            case 'cnh':
                $validation = $this->validateCNH($ocrData);
                break;
                
            case 'cpf':
                $validation = $this->validateCPFDocument($ocrData);
                break;
                
            case 'comprovante_residencia':
                $validation = $this->validateAddressProof($ocrData);
                break;
                
            case 'laudo_medico':
                $validation = $this->validateMedicalReport($ocrData);
                break;
                
            case 'formulario':
                $validation = $this->validateForm($ocrData);
                break;
        }

        // Add confidence check
        $confidence = $ocrData['average_confidence'] ?? 0;
        if ($confidence < 70) {
            $validation['warnings'][] = 'Low confidence score: ' . round($confidence, 2) . '%';
        }

        // Check overall validation status
        $hasFailed = false;
        foreach ($validation['checks'] as $check => $result) {
            if ($result === false) {
                $hasFailed = true;
                break;
            }
        }
        
        if ($hasFailed) {
            $validation['status'] = 'failed';
        } elseif (!empty($validation['warnings'])) {
            $validation['status'] = 'passed_with_warnings';
        }

        return $validation;
    }

    /**
     * Validate RG document
     */
    protected function validateRG(array $ocrData): array
    {
        $validation = [
            'status' => 'passed',
            'checks' => [],
            'warnings' => [],
        ];

        // Check for required fields
        $validation['checks']['has_name'] = !empty($ocrData['normalized_name'] ?? $ocrData['query_responses']['FULL_NAME']['text'] ?? null);
        $validation['checks']['has_rg_number'] = !empty($ocrData['rg'] ?? $ocrData['query_responses']['RG']['text'] ?? null);
        
        // CPF is optional in RG but validate if present
        if (!empty($ocrData['cpf'])) {
            $validation['checks']['cpf_valid'] = $ocrData['cpf_valid'] ?? false;
        }

        // Check for date
        $validation['checks']['has_birth_date'] = !empty($ocrData['parsed_dates'] ?? $ocrData['query_responses']['BIRTH_DATE']['text'] ?? null);

        return $validation;
    }

    /**
     * Validate CNH document
     */
    protected function validateCNH(array $ocrData): array
    {
        $validation = [
            'status' => 'passed',
            'checks' => [],
            'warnings' => [],
        ];

        $validation['checks']['has_name'] = !empty($ocrData['normalized_name'] ?? $ocrData['query_responses']['FULL_NAME']['text'] ?? null);
        $validation['checks']['has_registration'] = !empty($ocrData['query_responses']['DOCUMENT_NUMBER']['text'] ?? null);
        $validation['checks']['has_cpf'] = !empty($ocrData['cpf'] ?? $ocrData['query_responses']['CPF']['text'] ?? null);
        
        // Check for validity date
        if (!empty($ocrData['parsed_dates']) && count($ocrData['parsed_dates']) > 1) {
            $validityDate = $ocrData['parsed_dates'][1]['iso'] ?? null;
            if ($validityDate) {
                $validation['checks']['not_expired'] = strtotime($validityDate) > time();
                if (!$validation['checks']['not_expired']) {
                    $validation['warnings'][] = 'CNH appears to be expired';
                }
            }
        }

        return $validation;
    }

    /**
     * Validate CPF document
     */
    protected function validateCPFDocument(array $ocrData): array
    {
        $validation = [
            'status' => 'passed',
            'checks' => [],
            'warnings' => [],
        ];

        $validation['checks']['has_cpf'] = !empty($ocrData['cpf']);
        $validation['checks']['cpf_valid'] = $ocrData['cpf_valid'] ?? false;

        if (!$validation['checks']['cpf_valid']) {
            $validation['warnings'][] = 'CPF number validation failed';
        }

        return $validation;
    }

    /**
     * Validate address proof
     */
    protected function validateAddressProof(array $ocrData): array
    {
        $validation = [
            'status' => 'passed',
            'checks' => [],
            'warnings' => [],
        ];

        // Check for address
        $hasAddress = false;
        if (!empty($ocrData['forms'])) {
            foreach ($ocrData['forms'] as $form) {
                if (stripos($form['key'], 'endere') !== false && !empty($form['value'])) {
                    $hasAddress = true;
                    break;
                }
            }
        }
        
        // Fallback to raw text search
        if (!$hasAddress && !empty($ocrData['raw_text'])) {
            $hasAddress = preg_match('/(?:rua|av|avenida|travessa|alameda)[\s\S]+?\d{5}-?\d{3}/i', $ocrData['raw_text']);
        }
        
        $validation['checks']['has_address'] = $hasAddress;

        // Check for name
        $hasName = false;
        if (!empty($ocrData['forms'])) {
            foreach ($ocrData['forms'] as $form) {
                if ((stripos($form['key'], 'nome') !== false || stripos($form['key'], 'cliente') !== false) && !empty($form['value'])) {
                    $hasName = true;
                    break;
                }
            }
        }
        
        $validation['checks']['has_name'] = $hasName;

        // Check for recent date (within 3 months)
        if (!empty($ocrData['parsed_dates'])) {
            $mostRecentDate = null;
            foreach ($ocrData['parsed_dates'] as $date) {
                if ($date['iso'] && (!$mostRecentDate || $date['iso'] > $mostRecentDate)) {
                    $mostRecentDate = $date['iso'];
                }
            }
            
            if ($mostRecentDate) {
                $threeMonthsAgo = date('Y-m-d', strtotime('-3 months'));
                $validation['checks']['recent_document'] = $mostRecentDate >= $threeMonthsAgo;
                
                if (!$validation['checks']['recent_document']) {
                    $validation['warnings'][] = 'Document appears to be older than 3 months';
                }
            }
        }

        return $validation;
    }

    /**
     * Validate medical report
     */
    protected function validateMedicalReport(array $ocrData): array
    {
        $validation = [
            'status' => 'passed',
            'checks' => [],
            'warnings' => [],
        ];

        $validation['checks']['has_patient_name'] = !empty($ocrData['query_responses']['PATIENT_NAME']['text'] ?? null);
        $validation['checks']['has_exam_date'] = !empty($ocrData['query_responses']['EXAM_DATE']['text'] ?? null);
        $validation['checks']['has_results'] = !empty($ocrData['query_responses']['EXAM_RESULT']['text'] ?? null) || !empty($ocrData['medical_terms']);
        
        // Check for medical terminology
        $validation['checks']['contains_medical_terms'] = !empty($ocrData['medical_terms']) || !empty($ocrData['measurements']);

        return $validation;
    }

    /**
     * Validate form document
     */
    protected function validateForm(array $ocrData): array
    {
        $validation = [
            'status' => 'passed',
            'checks' => [],
            'warnings' => [],
        ];

        // Check for form fields
        $validation['checks']['has_form_fields'] = !empty($ocrData['forms']) && count($ocrData['forms']) > 2;
        
        // Check for tables if expected
        $validation['checks']['structure_detected'] = !empty($ocrData['forms']) || !empty($ocrData['tables']);

        // Check completeness
        $emptyFields = 0;
        if (!empty($ocrData['forms'])) {
            foreach ($ocrData['forms'] as $form) {
                if (empty($form['value'])) {
                    $emptyFields++;
                }
            }
            
            $completionRate = (count($ocrData['forms']) - $emptyFields) / count($ocrData['forms']) * 100;
            $validation['checks']['form_completion'] = $completionRate > 70;
            
            if ($completionRate < 70) {
                $validation['warnings'][] = 'Form appears to be incomplete (' . round($completionRate) . '% filled)';
            }
        }

        return $validation;
    }

    /**
     * Handle job failure
     *
     * @param  \Throwable  $exception
     * @return void
     */
    public function failed(Throwable $exception)
    {
        Log::error('OCR job permanently failed', [
            'document_id' => $this->document->id,
            'exception' => $exception->getMessage(),
        ]);

        $this->document->update([
            'status' => 'failed',
            'error_message' => 'Processing permanently failed: ' . $exception->getMessage(),
        ]);

        event(new \App\Events\DocumentProcessingFailed($this->document, $exception));
    }

    /**
     * Get the tags that should be assigned to the job.
     *
     * @return array
     */
    public function tags()
    {
        return ['ocr', 'document:' . $this->document->id, 'type:' . $this->document->type];
    }
}