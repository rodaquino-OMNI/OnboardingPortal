<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DocumentsService;
use App\Services\FeatureFlagService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * SliceBDocumentsController - Slice B Documents API
 *
 * Purpose: Handle Slice B document upload flow behind feature flag
 *
 * Endpoints:
 * - POST /api/v1/documents/presign - Generate presigned upload URL
 * - POST /api/v1/documents/submit - Submit document after upload
 * - GET /api/v1/documents/{id}/status - Get document status
 *
 * Feature Flag: sliceB_documents (must be enabled)
 *
 * Security:
 * - All endpoints require authentication (auth:sanctum)
 * - Feature flag check on every request
 * - Rate limiting: 60 requests per minute per user
 *
 * @see app/Services/DocumentsService.php
 * @see app/Services/FeatureFlagService.php
 */
class SliceBDocumentsController extends Controller
{
    /**
     * Feature flag key
     */
    private const FEATURE_FLAG = 'sliceB_documents';

    /**
     * Constructor with dependency injection
     */
    public function __construct(
        private DocumentsService $documentsService,
        private FeatureFlagService $featureFlags
    ) {
        // Require authentication for all endpoints
        $this->middleware('auth:sanctum');

        // Rate limiting: 60 requests per minute
        $this->middleware('throttle:60,1');
    }

    /**
     * Generate presigned URL for document upload
     *
     * POST /api/v1/documents/presign
     *
     * Request Body:
     * {
     *   "filename": "rg-frente.pdf",
     *   "type": "rg"
     * }
     *
     * Response (200):
     * {
     *   "upload_url": "https://s3.amazonaws.com/...",
     *   "path": "documents/123/uuid_random.pdf",
     *   "expires_at": "2025-10-06T18:15:00Z"
     * }
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function presign(Request $request): JsonResponse
    {
        // Feature flag check
        if (!$this->featureFlags->isEnabled(self::FEATURE_FLAG)) {
            return response()->json([
                'error' => 'Feature not available',
                'message' => 'Slice B documents flow is not enabled for your account',
            ], 403);
        }

        // Validate request
        try {
            $validated = $request->validate([
                'filename' => 'required|string|max:255',
                'type' => 'required|string|in:rg,cpf,proof_of_address,medical_certificate',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'error' => 'Validation failed',
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        }

        // Generate presigned URL
        try {
            $result = $this->documentsService->generatePresignedUrl(
                $request->user(),
                $validated['filename'],
                $validated['type']
            );

            return response()->json($result, 200);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => 'Invalid request',
                'message' => $e->getMessage(),
            ], 400);
        } catch (\Exception $e) {
            // Log unexpected errors
            \Log::error('Presigned URL generation failed', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server error',
                'message' => 'Failed to generate upload URL',
            ], 500);
        }
    }

    /**
     * Submit document after S3 upload completes
     *
     * POST /api/v1/documents/submit
     *
     * Request Body:
     * {
     *   "path": "documents/123/uuid_random.pdf",
     *   "type": "rg",
     *   "metadata": {
     *     "document_number": "12.345.678-9" // (optional)
     *   }
     * }
     *
     * Response (201):
     * {
     *   "document_id": 456,
     *   "status": "pending_review",
     *   "submitted_at": "2025-10-06T18:00:00Z"
     * }
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function submit(Request $request): JsonResponse
    {
        // Feature flag check
        if (!$this->featureFlags->isEnabled(self::FEATURE_FLAG)) {
            return response()->json([
                'error' => 'Feature not available',
                'message' => 'Slice B documents flow is not enabled for your account',
            ], 403);
        }

        // Validate request
        try {
            $validated = $request->validate([
                'path' => 'required|string|max:500',
                'type' => 'required|string|in:rg,cpf,proof_of_address,medical_certificate',
                'metadata' => 'nullable|array',
                'metadata.*' => 'nullable|string|max:500', // Prevent large metadata
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'error' => 'Validation failed',
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        }

        // Submit document
        try {
            $document = $this->documentsService->submitDocument(
                $request->user(),
                $validated['path'],
                $validated['type'],
                $validated['metadata'] ?? []
            );

            return response()->json([
                'document_id' => $document->id,
                'status' => $document->status,
                'submitted_at' => $document->submitted_at->toIso8601String(),
                'message' => 'Document submitted successfully and is pending review',
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => 'Invalid request',
                'message' => $e->getMessage(),
            ], 400);
        } catch (\RuntimeException $e) {
            return response()->json([
                'error' => 'File not found',
                'message' => $e->getMessage(),
            ], 404);
        } catch (\Exception $e) {
            // Log unexpected errors
            \Log::error('Document submission failed', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server error',
                'message' => 'Failed to submit document',
            ], 500);
        }
    }

    /**
     * Get document status
     *
     * GET /api/v1/documents/{documentId}/status
     *
     * Response (200):
     * {
     *   "document_id": 456,
     *   "status": "approved",
     *   "type": "rg",
     *   "submitted_at": "2025-10-06T18:00:00Z",
     *   "reviewed_at": "2025-10-06T19:30:00Z"
     * }
     *
     * @param Request $request
     * @param int $documentId
     * @return JsonResponse
     */
    public function status(Request $request, int $documentId): JsonResponse
    {
        // Feature flag check
        if (!$this->featureFlags->isEnabled(self::FEATURE_FLAG)) {
            return response()->json([
                'error' => 'Feature not available',
                'message' => 'Slice B documents flow is not enabled for your account',
            ], 403);
        }

        // Get document status
        $document = $this->documentsService->getStatus($request->user(), $documentId);

        if (!$document) {
            return response()->json([
                'error' => 'Not found',
                'message' => 'Document not found or does not belong to your account',
            ], 404);
        }

        // Build response
        $response = [
            'document_id' => $document->id,
            'status' => $document->status,
            'type' => $document->documentType->slug,
            'submitted_at' => $document->submitted_at->toIso8601String(),
        ];

        // Add review information if available
        if ($document->reviewed_at) {
            $response['reviewed_at'] = $document->reviewed_at->toIso8601String();
        }

        if ($document->status === 'rejected' && $document->review_notes) {
            $response['rejection_reason'] = $document->review_notes;
        }

        return response()->json($response, 200);
    }
}
