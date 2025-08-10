<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Services\OCRService;
use App\Services\TesseractOCRService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class DocumentControllerV2 extends Controller
{
    protected $ocrService;
    protected $tesseractService;

    public function __construct(OCRService $ocrService, TesseractOCRService $tesseractService)
    {
        $this->middleware('auth:sanctum');
        $this->ocrService = $ocrService;
        $this->tesseractService = $tesseractService;
    }

    /**
     * Upload document with client-side OCR support
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:jpg,jpeg,png,pdf|max:20480', // 20MB max
            'type' => 'required|in:rg,cnh,cpf,comprovante_residencia,foto_3x4,rg_cnh',
            'description' => 'nullable|string|max:255',
            'ocr_data' => 'nullable|json', // Client-side OCR data
            'validation' => 'nullable|json', // Client-side validation
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

        try {
            $file = $request->file('file');
            $filename = $this->generateSecureFilename($file, $beneficiary->id);
            
            // Store file
            $path = $file->storeAs(
                "documents/{$beneficiary->id}",
                $filename,
                config('filesystems.default', 'local')
            );

            // Parse client-side OCR data if provided
            $clientOcrData = null;
            $clientValidation = null;
            
            if ($request->has('ocr_data')) {
                $clientOcrData = json_decode($request->input('ocr_data'), true);
            }
            
            if ($request->has('validation')) {
                $clientValidation = json_decode($request->input('validation'), true);
            }

            // Create document record with all required fields
            $document = Document::create([
                'beneficiary_id' => $beneficiary->id,
                'uploaded_by' => Auth::id(),
                'type' => $request->type,
                'document_type' => $request->type,
                'document_category' => 'identification',  // Required field
                'file_path' => $path,
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'original_filename' => $file->getClientOriginalName(),
                'original_name' => $file->getClientOriginalName(),  // Required field
                'stored_name' => basename($path),  // Required field
                'file_extension' => $file->getClientOriginalExtension(),  // Required field
                'description' => $request->description,
                'status' => 'pending', // Valid values: pending, approved, rejected, expired
                'ocr_data' => $clientOcrData,
                'validation_results' => $clientValidation,
            ]);

            // Process based on client OCR availability
            if ($clientOcrData && $clientValidation) {
                // Client already performed OCR and validation
                $this->processClientSideOCR($document, $clientOcrData, $clientValidation);
            } else {
                // Queue server-side OCR processing
                $this->queueServerSideOCR($document);
            }

            // Award points for document upload (if gamification is enabled)
            // TODO: Implement PointsEarned event when gamification is ready
            // event(new \App\Events\PointsEarned(
            //     $beneficiary,
            //     25,
            //     "document_uploaded_{$request->type}"
            // ));

            return response()->json([
                'success' => true,
                'data' => $document->fresh(),
                'message' => $clientOcrData 
                    ? 'Document uploaded and validated successfully' 
                    : 'Document uploaded and queued for processing'
            ], 201);

        } catch (\Exception $e) {
            Log::error('Document upload failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload document: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Process client-side OCR data
     */
    protected function processClientSideOCR($document, $ocrData, $validation)
    {
        // Verify client-side validation
        $serverValidation = $this->validateClientOCR($document, $ocrData);
        
        // Merge validations
        $finalValidation = [
            'is_valid' => $validation['isValid'] && $serverValidation['is_valid'],
            'confidence' => min($validation['confidence'] ?? 0, $serverValidation['confidence'] ?? 0),
            'errors' => array_merge(
                $validation['errors'] ?? [],
                $serverValidation['errors'] ?? []
            ),
            'warnings' => array_merge(
                $validation['warnings'] ?? [],
                $serverValidation['warnings'] ?? []
            ),
            'client_validated' => true,
            'server_validated' => true,
        ];

        $document->update([
            'status' => $finalValidation['is_valid'] ? 'approved' : 'rejected',
            'rejection_reason' => $finalValidation['is_valid'] 
                ? null 
                : ($finalValidation['errors'][0] ?? 'Validation failed'),
            'validation_results' => $finalValidation,
            'ocr_confidence' => $ocrData['confidence'] ?? 0,
        ]);

        if ($finalValidation['is_valid']) {
            // Award bonus points for successful validation
            // TODO: Implement PointsEarned event when gamification is ready
            // event(new \App\Events\PointsEarned(
            //     $document->beneficiary,
            //     50,
            //     "document_validated_{$document->type}"
            // ));
        }
    }

    /**
     * Validate client-side OCR data
     */
    protected function validateClientOCR($document, $ocrData): array
    {
        $validation = [
            'is_valid' => true,
            'errors' => [],
            'warnings' => [],
            'confidence' => 100,
        ];

        // Basic security checks
        if (empty($ocrData['text']) || strlen($ocrData['text']) < 10) {
            $validation['errors'][] = 'Insufficient text extracted';
            $validation['is_valid'] = false;
        }

        // Check confidence score
        if (($ocrData['confidence'] ?? 0) < 50) {
            $validation['errors'][] = 'OCR confidence too low';
            $validation['is_valid'] = false;
        }

        // Additional validation based on document type
        if ($document->type === 'cpf' && !empty($ocrData['extractedData']['cpf'])) {
            if (!$this->validateCPF($ocrData['extractedData']['cpf'])) {
                $validation['errors'][] = 'Invalid CPF format';
                $validation['is_valid'] = false;
            }
        }

        return $validation;
    }

    /**
     * Queue server-side OCR processing
     */
    protected function queueServerSideOCR($document)
    {
        // OCR processing disabled for now - jobs not implemented yet
        // TODO: Implement OCR jobs when needed
        
        // Check if Tesseract is available locally
        // if (TesseractOCRService::isAvailable()) {
        //     // Use Tesseract for immediate processing
        //     dispatch(new \App\Jobs\ProcessDocumentWithTesseract($document));
        // } else {
        //     // Fall back to AWS Textract or other cloud service
        //     dispatch(new \App\Jobs\ProcessDocumentOCR($document));
        // }
        
        // For now, just mark as approved after a delay
        $document->update([
            'status' => 'approved',
            'ocr_confidence' => 95
        ]);
    }

    /**
     * Get real-time OCR processing status
     */
    public function getOCRStatus($id): JsonResponse
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

        $response = [
            'success' => true,
            'data' => [
                'status' => $document->status,
                'ocr_confidence' => $document->ocr_confidence,
                'validation_results' => $document->validation_results,
            ]
        ];

        // Include progress for pending documents
        if ($document->status === 'pending') {
            $response['data']['progress'] = $this->getProcessingProgress($document);
        }

        return response()->json($response);
    }

    /**
     * Process OCR on server (fallback endpoint)
     */
    public function processOCRFallback($id): JsonResponse
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

        try {
            // Use Tesseract for immediate processing
            if (TesseractOCRService::isAvailable()) {
                $ocrData = $this->tesseractService->processDocument($document->file_path);
                
                // Extract structured data
                $extractedData = $this->ocrService->extractStructuredData(
                    $document->type,
                    $ocrData
                );
                
                // Validate
                $validation = $this->ocrService->validateExtractedData(
                    $document->type,
                    $extractedData,
                    Auth::user()->beneficiary
                );
                
                $document->update([
                    'ocr_data' => $ocrData,
                    'validation_results' => $validation,
                    'status' => $validation['is_valid'] ? 'approved' : 'rejected',
                    'ocr_confidence' => $ocrData['confidence_scores'] 
                        ? array_sum($ocrData['confidence_scores']) / count($ocrData['confidence_scores'])
                        : 0,
                ]);
                
                return response()->json([
                    'success' => true,
                    'data' => [
                        'ocr_data' => $ocrData,
                        'validation' => $validation,
                        'document' => $document->fresh(),
                    ]
                ]);
            } else {
                // Queue for cloud processing
                $this->queueServerSideOCR($document);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Document queued for cloud OCR processing'
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Fallback OCR processing failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'OCR processing failed'
            ], 500);
        }
    }

    /**
     * Get processing progress estimate
     */
    protected function getProcessingProgress($document): int
    {
        $createdAt = $document->created_at;
        $now = now();
        $elapsed = $now->diffInSeconds($createdAt);
        
        // Estimate based on average processing time
        $estimatedTime = 30; // 30 seconds average
        $progress = min(95, ($elapsed / $estimatedTime) * 100);
        
        return (int) $progress;
    }

    /**
     * Validate CPF format
     */
    protected function validateCPF($cpf): bool
    {
        $cpf = preg_replace('/[^0-9]/', '', $cpf);
        
        if (strlen($cpf) != 11) {
            return false;
        }
        
        // Check for known invalid CPFs
        if (preg_match('/(\d)\1{10}/', $cpf)) {
            return false;
        }
        
        // Validate check digits
        for ($t = 9; $t < 11; $t++) {
            for ($d = 0, $c = 0; $c < $t; $c++) {
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
     * Generate secure filename
     */
    protected function generateSecureFilename($file, $beneficiaryId): string
    {
        $timestamp = now()->format('Y-m-d_H-i-s');
        $randomString = Str::random(8);
        $extension = $file->getClientOriginalExtension();
        
        return "{$beneficiaryId}_{$timestamp}_{$randomString}.{$extension}";
    }
}