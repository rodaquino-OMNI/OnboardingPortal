<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentType;
use App\Models\User;
use App\Services\AnalyticsEventRepository;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * DocumentsService - Slice B Documents Flow
 *
 * Purpose: Handle document upload lifecycle with presigned URLs
 *
 * Flow:
 * 1. Generate presigned URL (15-minute expiry)
 * 2. Client uploads directly to S3
 * 3. Client submits document metadata
 * 4. Document enters review queue
 * 5. Reviewer approves/rejects
 * 6. Badge unlocked on approval (via event)
 *
 * Analytics Events:
 * - documents.presigned_generated (user requests upload URL)
 * - documents.submitted (user completes upload and submits)
 * - documents.approved (reviewer approves document)
 * - documents.rejected (reviewer rejects document)
 *
 * Compliance:
 * - ADR-004: All document metadata encrypted at rest
 * - Zero PII in analytics (filename hashed, no plaintext)
 * - Full audit trail in audit_logs table
 *
 * @see app/Http/Controllers/Api/DocumentsController.php
 * @see app/Services/AnalyticsEventRepository.php
 */
class DocumentsService
{
    /**
     * Presigned URL expiry (15 minutes)
     */
    private const PRESIGNED_URL_EXPIRY_MINUTES = 15;

    /**
     * Allowed document types
     */
    private const ALLOWED_TYPES = ['rg', 'cpf', 'proof_of_address', 'medical_certificate'];

    /**
     * Constructor with dependency injection
     */
    public function __construct(
        private AnalyticsEventRepository $analytics
    ) {}

    /**
     * Generate presigned URL for direct S3 upload
     *
     * @param User $user Authenticated user
     * @param string $filename Original filename (NO PII)
     * @param string $type Document type slug
     * @return array{upload_url: string, path: string, expires_at: string}
     * @throws \InvalidArgumentException If type is invalid
     */
    public function generatePresignedUrl(User $user, string $filename, string $type): array
    {
        // Validate document type
        if (!in_array($type, self::ALLOWED_TYPES)) {
            throw new \InvalidArgumentException("Invalid document type: {$type}");
        }

        // Generate secure path with UUID prefix (prevent enumeration)
        $extension = pathinfo($filename, PATHINFO_EXTENSION);
        $secureFilename = Str::uuid() . '_' . Str::random(8) . '.' . $extension;
        $path = "documents/{$user->id}/{$secureFilename}";

        // Generate presigned URL for PUT operation
        $url = Storage::disk('s3')->temporaryUrl(
            $path,
            now()->addMinutes(self::PRESIGNED_URL_EXPIRY_MINUTES),
            [
                'ResponseContentDisposition' => "attachment; filename=\"{$filename}\"",
                'ContentType' => $this->getContentType($extension),
            ]
        );

        // Track analytics event (NO PII - filename hashed)
        $this->analytics->track(
            'documents.presigned_generated',
            [
                'document_type' => $type,
                'filename_hash' => hash('sha256', $filename), // Hashed for privacy
                'file_extension' => $extension,
            ],
            [
                'endpoint' => '/api/documents/presign',
                'user_role' => $user->role ?? 'beneficiary',
            ],
            $user->id
        );

        return [
            'upload_url' => $url,
            'path' => $path,
            'expires_at' => now()->addMinutes(self::PRESIGNED_URL_EXPIRY_MINUTES)->toIso8601String(),
        ];
    }

    /**
     * Submit document after S3 upload completes
     *
     * @param User $user Authenticated user
     * @param string $path S3 path returned from presign
     * @param string $type Document type slug
     * @param array $metadata Additional metadata (NO PII)
     * @return Document Created document record
     * @throws \InvalidArgumentException If type is invalid
     */
    public function submitDocument(User $user, string $path, string $type, array $metadata = []): Document
    {
        // Validate document type
        $documentType = DocumentType::where('slug', $type)->first();
        if (!$documentType) {
            throw new \InvalidArgumentException("Unknown document type: {$type}");
        }

        // Verify file exists in S3
        if (!Storage::disk('s3')->exists($path)) {
            throw new \RuntimeException("File not found at path: {$path}");
        }

        // Get file size for analytics
        $fileSize = Storage::disk('s3')->size($path);

        // Create document record
        $document = Document::create([
            'user_id' => $user->id,
            'document_type_id' => $documentType->id,
            'file_path' => $path,
            'status' => 'pending_review',
            'metadata' => $metadata,
            'submitted_at' => now(),
        ]);

        // Audit log (structured logging)
        Log::channel('audit')->info('Document submitted', [
            'user_id' => $user->id,
            'document_id' => $document->id,
            'document_type' => $type,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'timestamp' => now()->toIso8601String(),
        ]);

        // Analytics event (NO PII)
        $this->analytics->track(
            'documents.submitted',
            [
                'document_type' => $type,
                'file_size_bytes' => $fileSize,
                'status' => 'pending_review',
            ],
            [
                'endpoint' => '/api/documents/submit',
                'user_role' => $user->role ?? 'beneficiary',
            ],
            $user->id
        );

        return $document;
    }

    /**
     * Get document status for user
     *
     * @param User $user Authenticated user
     * @param int $documentId Document ID
     * @return Document|null Document if found and belongs to user
     */
    public function getStatus(User $user, int $documentId): ?Document
    {
        return Document::where('user_id', $user->id)
            ->where('id', $documentId)
            ->with('documentType')
            ->first();
    }

    /**
     * Approve document (admin/reviewer action)
     *
     * @param Document $document Document to approve
     * @param User $reviewer Reviewer user
     * @param string $notes Review notes (optional)
     * @return bool Success
     */
    public function approveDocument(Document $document, User $reviewer, string $notes = ''): bool
    {
        $submittedAt = $document->submitted_at;

        // Update document status
        $document->update([
            'status' => 'approved',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ]);

        // Audit log
        Log::channel('audit')->info('Document approved', [
            'document_id' => $document->id,
            'reviewer_id' => $reviewer->id,
            'user_id' => $document->user_id,
            'document_type' => $document->documentType->slug,
            'review_duration_seconds' => $submittedAt->diffInSeconds(now()),
            'timestamp' => now()->toIso8601String(),
        ]);

        // Analytics event
        $this->analytics->track(
            'documents.approved',
            [
                'document_type' => $document->documentType->slug,
                'review_duration_hours' => round($submittedAt->diffInHours(now()), 2),
                'reviewer_role' => $reviewer->role ?? 'admin',
            ],
            [
                'endpoint' => '/api/admin/documents/approve',
                'user_role' => $reviewer->role ?? 'admin',
            ],
            $document->user_id // Track against document owner
        );

        // Trigger badge unlock event (handled by listener)
        event(new \App\Events\DocumentProcessed($document));

        return true;
    }

    /**
     * Reject document (admin/reviewer action)
     *
     * @param Document $document Document to reject
     * @param User $reviewer Reviewer user
     * @param string $reason Rejection reason
     * @return bool Success
     */
    public function rejectDocument(Document $document, User $reviewer, string $reason): bool
    {
        $submittedAt = $document->submitted_at;

        // Update document status
        $document->update([
            'status' => 'rejected',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_notes' => $reason,
        ]);

        // Audit log
        Log::channel('audit')->info('Document rejected', [
            'document_id' => $document->id,
            'reviewer_id' => $reviewer->id,
            'user_id' => $document->user_id,
            'document_type' => $document->documentType->slug,
            'reason' => $reason,
            'timestamp' => now()->toIso8601String(),
        ]);

        // Analytics event (categorize reason for insights)
        $this->analytics->track(
            'documents.rejected',
            [
                'document_type' => $document->documentType->slug,
                'rejection_reason_category' => $this->categorizeReason($reason),
                'review_duration_hours' => round($submittedAt->diffInHours(now()), 2),
            ],
            [
                'endpoint' => '/api/admin/documents/reject',
                'user_role' => $reviewer->role ?? 'admin',
            ],
            $document->user_id
        );

        return true;
    }

    /**
     * Get content type from file extension
     *
     * @param string $extension File extension
     * @return string MIME type
     */
    private function getContentType(string $extension): string
    {
        return match(strtolower($extension)) {
            'pdf' => 'application/pdf',
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            default => 'application/octet-stream',
        };
    }

    /**
     * Categorize rejection reason for analytics
     *
     * @param string $reason Rejection reason text
     * @return string Category slug
     */
    private function categorizeReason(string $reason): string
    {
        $reasonLower = strtolower($reason);

        // Quality issues
        if (str_contains($reasonLower, 'illegible') ||
            str_contains($reasonLower, 'blurry') ||
            str_contains($reasonLower, 'unclear')) {
            return 'quality_issue';
        }

        // Expired documents
        if (str_contains($reasonLower, 'expired') ||
            str_contains($reasonLower, 'expir')) {
            return 'expired';
        }

        // Wrong document type
        if (str_contains($reasonLower, 'wrong') ||
            str_contains($reasonLower, 'incorrect') ||
            str_contains($reasonLower, 'tipo')) {
            return 'wrong_type';
        }

        // Incomplete documents
        if (str_contains($reasonLower, 'incomplete') ||
            str_contains($reasonLower, 'missing')) {
            return 'incomplete';
        }

        return 'other';
    }
}
