<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Services\EnhancedOCRService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ImageProcessingController extends Controller
{
    protected $ocrService;

    public function __construct(EnhancedOCRService $ocrService)
    {
        $this->ocrService = $ocrService;
    }

    /**
     * Process image with OCR
     */
    public function processImage(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'image' => 'required|file|mimes:jpeg,jpg,png,pdf|max:10240', // 10MB max
                'document_type' => 'required|string|in:rg,cpf,cnh,comprovante_residencia,foto_3x4',
                'quality_level' => 'sometimes|string|in:low,medium,high',
                'expected_data' => 'sometimes|array'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'type' => 'error',
                    'error' => [
                        'type' => 'invalid_request_error',
                        'message' => 'Invalid request parameters',
                        'details' => $validator->errors()
                    ]
                ], 400);
            }

            $file = $request->file('image');
            $documentType = $request->input('document_type');
            $qualityLevel = $request->input('quality_level', 'medium');
            $expectedData = $request->input('expected_data', []);

            // Validate file integrity
            if (!$file->isValid()) {
                return response()->json([
                    'type' => 'error',
                    'error' => [
                        'type' => 'invalid_request_error',
                        'message' => 'Could not process image - file is corrupted or invalid'
                    ]
                ], 400);
            }

            // Check file size and format
            if ($file->getSize() > 10 * 1024 * 1024) { // 10MB
                return response()->json([
                    'type' => 'error',
                    'error' => [
                        'type' => 'invalid_request_error',
                        'message' => 'Image file too large. Maximum size is 10MB.'
                    ]
                ], 400);
            }

            // Validate image format
            $allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!in_array($file->getMimeType(), $allowedMimes)) {
                return response()->json([
                    'type' => 'error',
                    'error' => [
                        'type' => 'invalid_request_error',
                        'message' => 'Invalid image format. Only JPEG, PNG, and PDF files are supported.'
                    ]
                ], 400);
            }

            // Store file temporarily
            $tempPath = $file->store('temp/ocr', 'local');
            
            try {
                // Process with OCR service
                $ocrResult = $this->ocrService->processDocument(
                    storage_path('app/' . $tempPath),
                    [
                        'document_type' => $documentType,
                        'quality_level' => $qualityLevel,
                        'expected_data' => $expectedData
                    ]
                );

                // Clean up temp file
                Storage::disk('local')->delete($tempPath);

                // Validate result quality
                if (!isset($ocrResult['success']) || !$ocrResult['success']) {
                    $errorMessage = $ocrResult['error'] ?? 'Could not process image';
                    
                    return response()->json([
                        'type' => 'error',
                        'error' => [
                            'type' => 'processing_error',
                            'message' => $errorMessage,
                            'suggestions' => $this->getProcessingSuggestions($errorMessage)
                        ]
                    ], 400);
                }

                return response()->json([
                    'type' => 'success',
                    'data' => [
                        'text' => $ocrResult['text'] ?? '',
                        'confidence' => $ocrResult['confidence'] ?? 0,
                        'extracted_data' => $ocrResult['extracted_data'] ?? [],
                        'validation' => $ocrResult['validation'] ?? null,
                        'processing_time' => $ocrResult['processing_time'] ?? 0
                    ]
                ]);

            } catch (\Exception $e) {
                // Clean up temp file on error
                Storage::disk('local')->delete($tempPath);
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Image processing failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => Auth::id(),
                'request_data' => $request->except(['image'])
            ]);

            $errorMessage = $this->categorizeError($e);
            
            return response()->json([
                'type' => 'error',
                'error' => [
                    'type' => 'invalid_request_error',
                    'message' => $errorMessage,
                    'suggestions' => $this->getProcessingSuggestions($errorMessage)
                ]
            ], 400);
        }
    }

    /**
     * Get processing status for async operations
     */
    public function getProcessingStatus(Request $request, string $processingId): JsonResponse
    {
        try {
            // Implementation for checking async processing status
            // This would be used for long-running OCR operations
            
            return response()->json([
                'type' => 'success',
                'data' => [
                    'status' => 'processing',
                    'progress' => 75,
                    'estimated_completion' => now()->addSeconds(30)->toISOString()
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'type' => 'error',
                'error' => [
                    'type' => 'not_found_error',
                    'message' => 'Processing job not found'
                ]
            ], 404);
        }
    }

    /**
     * Categorize error types for better user experience
     */
    private function categorizeError(\Exception $e): string
    {
        $message = $e->getMessage();

        if (str_contains($message, 'corrupted') || str_contains($message, 'invalid format')) {
            return 'Could not process image - the file appears to be corrupted or in an unsupported format';
        }

        if (str_contains($message, 'quality') || str_contains($message, 'resolution')) {
            return 'Could not process image - image quality is too low for text recognition';
        }

        if (str_contains($message, 'timeout') || str_contains($message, 'network')) {
            return 'Could not process image - processing timeout, please try again';
        }

        if (str_contains($message, 'memory') || str_contains($message, 'resource')) {
            return 'Could not process image - image is too large or complex to process';
        }

        if (str_contains($message, 'tesseract') || str_contains($message, 'ocr')) {
            return 'Could not process image - text recognition service is temporarily unavailable';
        }

        // Generic fallback
        return 'Could not process image';
    }

    /**
     * Provide helpful suggestions based on error type
     */
    private function getProcessingSuggestions(string $errorMessage): array
    {
        $suggestions = [];

        if (str_contains($errorMessage, 'corrupted') || str_contains($errorMessage, 'format')) {
            $suggestions[] = 'Try uploading a different image file';
            $suggestions[] = 'Ensure the file is a valid JPEG, PNG, or PDF';
            $suggestions[] = 'Take a new photo if the original is damaged';
        }

        if (str_contains($errorMessage, 'quality') || str_contains($errorMessage, 'low')) {
            $suggestions[] = 'Take a clearer photo with better lighting';
            $suggestions[] = 'Ensure the document is flat and in focus';
            $suggestions[] = 'Avoid shadows and reflections on the document';
            $suggestions[] = 'Use a higher resolution camera if possible';
        }

        if (str_contains($errorMessage, 'timeout') || str_contains($errorMessage, 'network')) {
            $suggestions[] = 'Check your internet connection';
            $suggestions[] = 'Try again in a few moments';
            $suggestions[] = 'Consider uploading a smaller or simpler image';
        }

        if (str_contains($errorMessage, 'large') || str_contains($errorMessage, 'complex')) {
            $suggestions[] = 'Compress the image before uploading';
            $suggestions[] = 'Crop the image to show only the document';
            $suggestions[] = 'Ensure the image is under 10MB';
        }

        if (empty($suggestions)) {
            $suggestions[] = 'Try taking a new, clear photo of the document';
            $suggestions[] = 'Ensure good lighting and the document is fully visible';
            $suggestions[] = 'Contact support if the problem persists';
        }

        return $suggestions;
    }
}