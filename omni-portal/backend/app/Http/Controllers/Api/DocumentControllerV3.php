<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Services\OptimizedTextractService;
use App\Services\TesseractOCRService;
use App\Jobs\ProcessDocumentOCR;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class DocumentControllerV3 extends Controller
{
    protected $textractService;
    protected $tesseractService;

    public function __construct(
        OptimizedTextractService $textractService,
        TesseractOCRService $tesseractService
    ) {
        $this->middleware('auth:sanctum');
        $this->textractService = $textractService;
        $this->tesseractService = $tesseractService;
    }

    /**
     * Upload document with optimized OCR processing
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:jpg,jpeg,png,pdf|max:20480', // 20MB max
            'type' => 'required|in:rg,cnh,cpf,comprovante_residencia,foto_3x4,rg_cnh,laudo_medico,formulario',
            'description' => 'nullable|string|max:255',
            'ocr_data' => 'nullable|json', // Client-side OCR data
            'validation' => 'nullable|json', // Client-side validation
            'priority' => 'nullable|in:low,medium,high',
            'extract_signatures' => 'nullable|boolean',
            'extract_layout' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $beneficiary = Auth::user()->beneficiary;
        
        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Beneficiary profile not found'
            ], 404);
        }

        DB::beginTransaction();
        
        try {
            $file = $request->file('file');
            $filename = $this->generateSecureFilename($file, $beneficiary->id);
            
            // Store file
            $path = $file->storeAs(
                "documents/{$beneficiary->id}",
                $filename,
                config('filesystems.default', 'local')
            );

            // Parse client-side data if provided
            $clientOcrData = null;
            $clientValidation = null;
            
            if ($request->has('ocr_data')) {
                $clientOcrData = json_decode($request->input('ocr_data'), true);
            }
            
            if ($request->has('validation')) {
                $clientValidation = json_decode($request->input('validation'), true);
            }

            // Create document record
            $document = Document::create([
                'beneficiary_id' => $beneficiary->id,
                'type' => $request->type,
                'file_path' => $path,
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'original_filename' => $file->getClientOriginalName(),
                'description' => $request->description,
                'status' => 'processing',
                'ocr_data' => $clientOcrData,
                'validation_results' => $clientValidation,
                'processing_options' => [
                    'extract_signatures' => $request->boolean('extract_signatures', false),
                    'extract_layout' => $request->boolean('extract_layout', false),
                    'priority' => $request->input('priority', 'medium'),
                ],
            ]);

            DB::commit();

            // Determine processing strategy
            if ($clientOcrData && $this->isClientOcrSufficient($clientOcrData, $clientValidation)) {
                // Client OCR is sufficient, just validate server-side
                $this->validateClientOCR($document, $clientOcrData, $clientValidation);
            } else {
                // Need server-side OCR processing
                $this->processServerSideOCR($document, $request->input('priority', 'medium'));
            }

            return response()->json([
                'success' => true,
                'message' => 'Document uploaded successfully',
                'data' => [
                    'id' => $document->id,
                    'status' => $document->status,
                    'processing_started' => true,
                ]
            ], 201);

        } catch (\Exception $e) {
            DB::rollback();
            
            Log::error('Document upload failed', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to upload document',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get document processing status with real-time updates
     */
    public function status($id): JsonResponse
    {
        $document = Document::where('id', $id)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
            ->first();

        if (!$document) {
            return response()->json([
                'success' => false,
                'message' => 'Document not found'
            ], 404);
        }

        // Get processing metrics if available
        $metrics = null;
        if ($document->status === 'completed' || $document->status === 'failed') {
            $metrics = DB::table('ocr_processing_metrics')
                ->where('file_path', $document->file_path)
                ->orderBy('created_at', 'desc')
                ->first();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $document->id,
                'status' => $document->status,
                'type' => $document->type,
                'processed_at' => $document->processed_at,
                'validation_status' => $document->validation_results['status'] ?? null,
                'confidence_score' => $document->ocr_data['average_confidence'] ?? null,
                'quality_score' => $document->ocr_data['quality_metrics']['overall_quality'] ?? null,
                'processing_metrics' => $metrics ? [
                    'processing_time' => $metrics->processing_time,
                    'document_type_detected' => $metrics->document_type,
                    'pages_processed' => $metrics->pages_processed,
                ] : null,
            ]
        ]);
    }

    /**
     * Get OCR results for a processed document
     */
    public function getOcrResults($id): JsonResponse
    {
        $document = Document::where('id', $id)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
            ->first();

        if (!$document) {
            return response()->json([
                'success' => false,
                'message' => 'Document not found'
            ], 404);
        }

        if ($document->status !== 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Document processing not completed',
                'status' => $document->status
            ], 400);
        }

        // Prepare OCR data for response
        $ocrData = $document->ocr_data ?? [];
        
        // Remove sensitive internal data
        unset($ocrData['blocks']); // Raw block data can be large
        
        // Add extracted fields based on document type
        $extractedFields = $this->getExtractedFields($document);

        return response()->json([
            'success' => true,
            'data' => [
                'document_id' => $document->id,
                'document_type' => $document->type,
                'detected_type' => $ocrData['document_type'] ?? null,
                'confidence_score' => $ocrData['average_confidence'] ?? null,
                'quality_metrics' => $ocrData['quality_metrics'] ?? null,
                'extracted_text' => $ocrData['raw_text'] ?? '',
                'extracted_fields' => $extractedFields,
                'forms' => $ocrData['forms'] ?? [],
                'tables' => $ocrData['tables'] ?? [],
                'signatures_detected' => !empty($ocrData['signatures']),
                'query_responses' => $ocrData['query_responses'] ?? [],
                'validation_results' => $document->validation_results,
            ]
        ]);
    }

    /**
     * Reprocess a document with different options
     */
    public function reprocess(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'extract_signatures' => 'nullable|boolean',
            'extract_layout' => 'nullable|boolean',
            'force_textract' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $document = Document::where('id', $id)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
            ->first();

        if (!$document) {
            return response()->json([
                'success' => false,
                'message' => 'Document not found'
            ], 404);
        }

        try {
            // Update processing options
            $processingOptions = $document->processing_options ?? [];
            $processingOptions['extract_signatures'] = $request->boolean('extract_signatures', false);
            $processingOptions['extract_layout'] = $request->boolean('extract_layout', false);
            $processingOptions['force_textract'] = $request->boolean('force_textract', false);
            
            $document->update([
                'status' => 'processing',
                'processing_options' => $processingOptions,
            ]);

            // Queue for reprocessing
            ProcessDocumentOCR::dispatch($document)
                ->onQueue('high-priority');

            return response()->json([
                'success' => true,
                'message' => 'Document queued for reprocessing',
                'data' => [
                    'id' => $document->id,
                    'status' => 'processing',
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Document reprocessing failed', [
                'document_id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to reprocess document'
            ], 500);
        }
    }

    /**
     * Get OCR performance report
     */
    public function performanceReport(Request $request): JsonResponse
    {
        // This would typically require admin permissions
        // For now, return basic stats for the user's documents
        
        $beneficiary = Auth::user()->beneficiary;
        
        $stats = Document::where('beneficiary_id', $beneficiary->id)
            ->selectRaw('
                COUNT(*) as total_documents,
                COUNT(CASE WHEN status = "completed" THEN 1 END) as completed,
                COUNT(CASE WHEN status = "failed" THEN 1 END) as failed,
                AVG(JSON_EXTRACT(ocr_data, "$.average_confidence")) as avg_confidence,
                AVG(JSON_EXTRACT(ocr_data, "$.quality_metrics.overall_quality")) as avg_quality
            ')
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'total_documents' => $stats->total_documents,
                'completed' => $stats->completed,
                'failed' => $stats->failed,
                'success_rate' => $stats->total_documents > 0 
                    ? round(($stats->completed / $stats->total_documents) * 100, 2) 
                    : 0,
                'average_confidence' => round($stats->avg_confidence ?? 0, 2),
                'average_quality' => round($stats->avg_quality ?? 0, 2),
            ]
        ]);
    }

    /**
     * Check if client OCR is sufficient
     */
    protected function isClientOcrSufficient($ocrData, $validation): bool
    {
        // Check if client OCR has minimum required data
        if (!$ocrData || !isset($ocrData['text']) || empty($ocrData['text'])) {
            return false;
        }

        // Check confidence threshold
        $confidence = $ocrData['confidence'] ?? 0;
        if ($confidence < 80) {
            return false;
        }

        // Check validation status
        if ($validation && isset($validation['status']) && $validation['status'] === 'failed') {
            return false;
        }

        return true;
    }

    /**
     * Validate client-side OCR data
     */
    protected function validateClientOCR(Document $document, array $ocrData, ?array $validation): void
    {
        try {
            // Perform server-side validation
            $validationResults = $this->validateOcrData($ocrData, $document->type);
            
            $document->update([
                'status' => 'completed',
                'processed_at' => now(),
                'validation_results' => array_merge($validation ?? [], $validationResults),
            ]);

        } catch (\Exception $e) {
            Log::error('Client OCR validation failed', [
                'document_id' => $document->id,
                'error' => $e->getMessage()
            ]);

            $document->update([
                'status' => 'failed',
                'error_message' => 'Validation failed',
            ]);
        }
    }

    /**
     * Process document with server-side OCR
     */
    protected function processServerSideOCR(Document $document, string $priority = 'medium'): void
    {
        $queue = match($priority) {
            'high' => 'high-priority',
            'low' => 'low-priority',
            default => 'default'
        };

        ProcessDocumentOCR::dispatch($document)->onQueue($queue);
    }

    /**
     * Validate OCR data based on document type
     */
    protected function validateOcrData(array $ocrData, string $documentType): array
    {
        $validation = [
            'status' => 'passed',
            'checks' => [],
        ];

        switch ($documentType) {
            case 'cpf':
                $validation['checks']['cpf_valid'] = $this->validateCPF($ocrData['cpf'] ?? '');
                break;
                
            case 'rg':
            case 'cnh':
                $validation['checks']['has_name'] = !empty($ocrData['name'] ?? '');
                $validation['checks']['has_document_number'] = !empty($ocrData['document_number'] ?? '');
                break;
                
            case 'comprovante_residencia':
                $validation['checks']['has_address'] = !empty($ocrData['address'] ?? '');
                break;
        }

        // Check if any validation failed
        foreach ($validation['checks'] as $check) {
            if (!$check) {
                $validation['status'] = 'failed';
                break;
            }
        }

        return $validation;
    }

    /**
     * Validate CPF number
     */
    protected function validateCPF(string $cpf): bool
    {
        $cpf = preg_replace('/[^0-9]/', '', $cpf);
        
        if (strlen($cpf) != 11) {
            return false;
        }
        
        if (preg_match('/(\d)\1{10}/', $cpf)) {
            return false;
        }
        
        for ($t = 9; $t < 11; $t++) {
            $d = 0;
            for ($c = 0; $c < $t; $c++) {
                $d += $cpf[$c] * (($t + 1) - $c);
            }
            $d = ((10 * $d) % 11) % 10;
            if ($cpf[$c] != $d) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Get extracted fields based on document type
     */
    protected function getExtractedFields(Document $document): array
    {
        $ocrData = $document->ocr_data ?? [];
        $fields = [];

        switch ($document->type) {
            case 'rg':
                $fields = [
                    'nome' => $ocrData['normalized_name'] ?? $ocrData['query_responses']['FULL_NAME']['text'] ?? null,
                    'rg' => $ocrData['rg'] ?? $ocrData['query_responses']['RG']['text'] ?? null,
                    'cpf' => $ocrData['cpf'] ?? $ocrData['query_responses']['CPF']['text'] ?? null,
                    'data_nascimento' => $ocrData['parsed_dates'][0]['formatted'] ?? null,
                ];
                break;
                
            case 'cnh':
                $fields = [
                    'nome' => $ocrData['normalized_name'] ?? $ocrData['query_responses']['FULL_NAME']['text'] ?? null,
                    'numero_registro' => $ocrData['query_responses']['DOCUMENT_NUMBER']['text'] ?? null,
                    'cpf' => $ocrData['cpf'] ?? $ocrData['query_responses']['CPF']['text'] ?? null,
                    'validade' => $ocrData['parsed_dates'][1]['formatted'] ?? null,
                ];
                break;
                
            case 'cpf':
                $fields = [
                    'cpf' => $ocrData['cpf'] ?? null,
                    'cpf_valido' => $ocrData['cpf_valid'] ?? false,
                ];
                break;
                
            case 'comprovante_residencia':
                $fields = [
                    'endereco' => $this->extractAddress($ocrData),
                    'nome' => $this->extractNameFromUtilityBill($ocrData),
                ];
                break;
                
            case 'laudo_medico':
                $fields = [
                    'paciente' => $ocrData['query_responses']['PATIENT_NAME']['text'] ?? null,
                    'data_exame' => $ocrData['query_responses']['EXAM_DATE']['text'] ?? null,
                    'resultado' => $ocrData['query_responses']['EXAM_RESULT']['text'] ?? null,
                    'termos_medicos' => $ocrData['medical_terms'] ?? [],
                    'medicoes' => $ocrData['standardized_measurements'] ?? [],
                ];
                break;
        }

        return $fields;
    }

    /**
     * Extract address from OCR data
     */
    protected function extractAddress(array $ocrData): ?string
    {
        // Try structured form data first
        if (!empty($ocrData['forms'])) {
            foreach ($ocrData['forms'] as $form) {
                if (stripos($form['key'], 'endere') !== false) {
                    return $form['value'];
                }
            }
        }

        // Try to extract from raw text
        $text = $ocrData['raw_text'] ?? '';
        if (preg_match('/(?:rua|av|avenida|travessa|alameda)[\s\S]+?(?:cep|código postal)?\s*\d{5}-?\d{3}/i', $text, $matches)) {
            return trim($matches[0]);
        }

        return null;
    }

    /**
     * Extract name from utility bill
     */
    protected function extractNameFromUtilityBill(array $ocrData): ?string
    {
        // Try structured form data
        if (!empty($ocrData['forms'])) {
            foreach ($ocrData['forms'] as $form) {
                if (stripos($form['key'], 'nome') !== false || stripos($form['key'], 'cliente') !== false) {
                    return $form['value'];
                }
            }
        }

        return null;
    }

    /**
     * Generate secure filename
     */
    protected function generateSecureFilename($file, $beneficiaryId): string
    {
        $extension = $file->getClientOriginalExtension();
        $timestamp = now()->format('Y-m-d_His');
        $random = Str::random(8);
        
        return "{$beneficiaryId}_{$timestamp}_{$random}.{$extension}";
    }
}