<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

/**
 * DocumentsController - Document management endpoints (stub) per API_SPEC.yaml
 *
 * Endpoints:
 * - POST /documents/upload - Upload document for OCR
 * - GET /documents - List user documents
 * - GET /documents/{id}/status - Get document status
 * - POST /documents/{id}/approve - Approve document (admin)
 *
 * @see docs/API_SPEC.yaml - Full contract specification
 *
 * NOTE: This is a STUB implementation. Full OCR integration will be
 * implemented in Slice B (Sprint 2).
 */
class DocumentsController extends Controller
{
    /**
     * Upload document
     *
     * POST /documents/upload
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'], // 10MB
            'document_type' => ['required', 'in:rg,cpf,proof_of_address,health_card'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // TODO: Implement file upload, storage, OCR processing
        // For now, return stub response

        return response()->json([
            'message' => 'Documento enviado para processamento',
            'document_id' => rand(1000, 9999),
            'status' => 'processing',
            'upload_url' => 'https://example.com/uploads/doc-' . uniqid(),
        ], 201);
    }

    /**
     * List user documents
     *
     * GET /documents
     */
    public function index(Request $request): JsonResponse
    {
        // TODO: Query user documents from database
        // For now, return stub response

        return response()->json([
            'documents' => [
                [
                    'id' => 1,
                    'type' => 'rg',
                    'status' => 'approved',
                    'uploaded_at' => now()->subDays(2)->toIso8601String(),
                ],
            ],
        ]);
    }

    /**
     * Get document status
     *
     * GET /documents/{id}/status
     */
    public function status(Request $request, int $id): JsonResponse
    {
        // TODO: Query document from database
        // For now, return stub response

        return response()->json([
            'id' => $id,
            'type' => 'rg',
            'status' => 'processing',
            'ocr_confidence' => 0.95,
            'extracted_data' => [
                'document_number' => '12.345.678-9',
                'issue_date' => '2020-01-15',
            ],
        ]);
    }

    /**
     * Approve document (Admin only)
     *
     * POST /documents/{id}/approve
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        // TODO: Implement approval logic with admin authorization
        // For now, return stub response

        return response()->json([
            'message' => 'Documento aprovado',
            'document' => [
                'id' => $id,
                'status' => 'approved',
                'approved_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Reject document (Admin only)
     *
     * POST /documents/{id}/reject
     */
    public function reject(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reason' => ['required', 'string', 'max:500'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // TODO: Implement rejection logic
        // For now, return stub response

        return response()->json([
            'message' => 'Documento rejeitado',
            'document' => [
                'id' => $id,
                'status' => 'rejected',
                'rejection_reason' => $request->reason,
                'rejected_at' => now()->toIso8601String(),
            ],
        ]);
    }
}
