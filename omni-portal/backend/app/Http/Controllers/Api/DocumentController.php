<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Services\OCRService;
use App\Services\OptimizedTextractService;
use App\Services\SecureFileUploadService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class DocumentController extends Controller
{
    protected $ocrService;

    public function __construct(OCRService $ocrService)
    {
        $this->middleware('auth:sanctum');
        $this->ocrService = $ocrService;
    }

    /**
     * Get all documents for the authenticated beneficiary
     */
    public function index(): JsonResponse
    {
        $beneficiary = Auth::user()->beneficiary;
        
        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Beneficiary profile not found'
            ], 404);
        }

        $documents = Document::where('beneficiary_id', $beneficiary->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $documents
        ]);
    }

    /**
     * Upload a new document
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:jpg,jpeg,png,pdf,txt|max:10240', // 10MB max, added txt for testing
            'type' => 'required|in:rg,cnh,cpf,comprovante_residencia,foto_3x4,rg_cnh',
            'description' => 'nullable|string|max:255'
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
            
            // Use secure file upload service
            $uploadService = new SecureFileUploadService();
            
            try {
                $fileData = $uploadService->validateAndProcess(
                    $file,
                    $request->type,
                    $beneficiary->id
                );
            } catch (\Exception $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'File validation failed: ' . $e->getMessage()
                ], 422);
            }
            
            // Additional antivirus scan if available
            if (!$uploadService->scanWithAntivirus(storage_path('app/' . $fileData['path']))) {
                // Delete the file immediately
                Storage::delete($fileData['path']);
                
                return response()->json([
                    'success' => false,
                    'message' => 'File failed security scan. Please ensure the file is safe and try again.'
                ], 422);
            }

            // Create document record with secure file data
            $document = Document::create([
                'beneficiary_id' => $beneficiary->id,
                'uploaded_by' => Auth::id(),
                'document_type' => $request->type,
                'document_category' => $this->getDocumentCategory($request->type),
                'original_name' => $file->getClientOriginalName(),
                'stored_name' => $fileData['filename'],
                'file_path' => $fileData['path'],
                'mime_type' => $fileData['mime_type'],
                'file_size' => $fileData['size'],
                'file_extension' => $fileData['extension'],
                'file_hash' => $fileData['hash'],
                'status' => 'pending',
                'is_encrypted' => false,
                'metadata' => [
                    'description' => $request->description,
                    'upload_ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'security_validated' => true,
                    'validation_timestamp' => now()->toIso8601String(),
                ]
            ]);

            // Queue OCR processing
            dispatch(new \App\Jobs\ProcessDocumentOCR($document));

            // Award points for document upload
            event(new \App\Events\PointsEarned(
                $beneficiary,
                50,
                "document_uploaded_{$request->type}"
            ));

            return response()->json([
                'success' => true,
                'data' => $document,
                'message' => 'Document uploaded successfully and is being processed'
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload document: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get document details including OCR results
     */
    public function show($id): JsonResponse
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

        return response()->json([
            'success' => true,
            'data' => $document
        ]);
    }

    /**
     * Download document file
     */
    public function download($id): JsonResponse
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
            $disk = config('filesystems.default', 'local');
            
            if ($disk === 's3') {
                $url = Storage::disk($disk)->temporaryUrl(
                    $document->file_path,
                    now()->addMinutes(10)
                );
            } else {
                // For local storage, create a temporary signed URL
                $url = URL::temporarySignedRoute(
                    'document.download',
                    now()->addMinutes(10),
                    ['document' => $document->id]
                );
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'download_url' => $url,
                    'expires_at' => now()->addMinutes(10)->toISOString()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate download URL'
            ], 500);
        }
    }

    /**
     * Delete a document
     */
    public function destroy($id): JsonResponse
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
            // Delete file from storage
            $disk = config('filesystems.default', 'local');
            Storage::disk($disk)->delete($document->file_path);
            
            // Delete database record
            $document->delete();

            return response()->json([
                'success' => true,
                'message' => 'Document deleted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete document'
            ], 500);
        }
    }

    /**
     * Process OCR for a document manually
     */
    public function processOCR($id): JsonResponse
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

        if ($document->status === 'processing') {
            return response()->json([
                'success' => false,
                'message' => 'Document is already being processed'
            ], 409);
        }

        try {
            $document->update(['status' => 'processing']);
            
            // Queue OCR processing
            dispatch(new \App\Jobs\ProcessDocumentOCR($document));

            return response()->json([
                'success' => true,
                'message' => 'OCR processing initiated'
            ]);
        } catch (\Exception $e) {
            $document->update(['status' => 'failed']);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to process OCR: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validate document data extracted from OCR
     */
    public function validateOCR($id): JsonResponse
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

        if (!$document->ocr_data) {
            return response()->json([
                'success' => false,
                'message' => 'No OCR data available for validation'
            ], 400);
        }

        try {
            $validation = $this->ocrService->validateExtractedData(
                $document->type,
                $document->ocr_data,
                Auth::user()->beneficiary
            );

            $document->update([
                'validation_results' => $validation,
                'status' => $validation['is_valid'] ? 'approved' : 'rejected',
                'rejection_reason' => $validation['is_valid'] ? null : $validation['errors'][0] ?? 'Validation failed'
            ]);

            if ($validation['is_valid']) {
                // Award points for successful validation
                event(new \App\Events\PointsEarned(
                    Auth::user()->beneficiary,
                    100,
                    "document_validated_{$document->type}"
                ));
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'validation' => $validation,
                    'document' => $document->fresh()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get validation progress for all documents
     */
    public function getValidationProgress(): JsonResponse
    {
        $beneficiary = Auth::user()->beneficiary;
        
        $documents = Document::where('beneficiary_id', $beneficiary->id)
            ->select('type', 'status')
            ->get()
            ->groupBy('type');

        $requiredTypes = ['rg', 'cpf', 'comprovante_residencia', 'foto_3x4'];
        $progress = [];

        foreach ($requiredTypes as $type) {
            $typeDocuments = $documents->get($type, collect());
            $latestDocument = $typeDocuments->sortByDesc('created_at')->first();
            
            $progress[$type] = [
                'uploaded' => $typeDocuments->isNotEmpty(),
                'status' => $latestDocument?->status ?? 'missing',
                'document_id' => $latestDocument?->id,
                'required' => true
            ];
        }

        $overallProgress = collect($progress)
            ->where('status', 'approved')
            ->count() / count($requiredTypes) * 100;

        return response()->json([
            'success' => true,
            'data' => [
                'progress' => $progress,
                'overall_percentage' => round($overallProgress, 2),
                'completed_documents' => collect($progress)->where('status', 'approved')->count(),
                'total_required' => count($requiredTypes)
            ]
        ]);
    }

    /**
     * Generate secure filename for uploaded documents
     */
    protected function generateSecureFilename($file, $beneficiaryId): string
    {
        $timestamp = now()->format('Y-m-d_H-i-s');
        $randomString = Str::random(8);
        $extension = $file->getClientOriginalExtension();
        
        return "{$beneficiaryId}_{$timestamp}_{$randomString}.{$extension}";
    }

    /**
     * Get document category based on type
     */
    protected function getDocumentCategory($type): string
    {
        $categories = [
            'rg' => 'personal',
            'cnh' => 'personal',
            'rg_cnh' => 'personal',
            'cpf' => 'personal',
            'comprovante_residencia' => 'personal',
            'foto_3x4' => 'personal',
        ];

        return $categories[$type] ?? 'other';
    }
}