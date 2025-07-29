<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\User;
use App\Models\AdminAction;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Notification;

class DocumentReviewController extends Controller
{
    /**
     * Get documents pending review with filters
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => 'integer|min:1',
            'per_page' => 'integer|min:1|max:100',
            'status' => 'in:pending,approved,rejected,under_review,all',
            'document_type_id' => 'integer|exists:document_types,id',
            'user_search' => 'string|max:255',
            'date_from' => 'date',
            'date_to' => 'date|after_or_equal:date_from',
            'sort_by' => 'in:created_at,updated_at,file_name,status',
            'sort_order' => 'in:asc,desc',
        ]);

        try {
            $query = Document::with(['user', 'documentType', 'verifiedBy'])
                ->when($request->status && $request->status !== 'all', function ($q) use ($request) {
                    $q->where('status', $request->status);
                })
                ->when($request->document_type_id, function ($q) use ($request) {
                    $q->where('document_type_id', $request->document_type_id);
                })
                ->when($request->user_search, function ($q) use ($request) {
                    $q->whereHas('user', function ($userQuery) use ($request) {
                        $search = $request->user_search;
                        $userQuery->where('name', 'like', "%{$search}%")
                                  ->orWhere('email', 'like', "%{$search}%")
                                  ->orWhere('cpf', 'like', "%{$search}%");
                    });
                })
                ->when($request->date_from, function ($q) use ($request) {
                    $q->whereDate('created_at', '>=', $request->date_from);
                })
                ->when($request->date_to, function ($q) use ($request) {
                    $q->whereDate('created_at', '<=', $request->date_to);
                });

            // Apply sorting
            $sortBy = $request->sort_by ?? 'created_at';
            $sortOrder = $request->sort_order ?? 'desc';
            $query->orderBy($sortBy, $sortOrder);

            $documents = $query->paginate($request->per_page ?? 20);

            AdminAction::logAction(
                auth()->id(),
                'documents_review_list',
                'Visualizou lista de documentos para revisão',
                null,
                $request->only(['status', 'document_type_id', 'user_search', 'date_from', 'date_to'])
            );

            return response()->json($documents);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao carregar documentos',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single document details for review
     */
    public function show(int $id): JsonResponse
    {
        try {
            $document = Document::with([
                'user', 
                'documentType', 
                'verifiedBy',
                'user.beneficiary'
            ])->findOrFail($id);

            // Get document content/preview if possible
            $preview = null;
            if (Storage::disk('local')->exists($document->file_path)) {
                $mimeType = Storage::disk('local')->mimeType($document->file_path);
                
                if (str_starts_with($mimeType, 'image/')) {
                    $preview = [
                        'type' => 'image',
                        'url' => route('documents.preview', ['document' => $document->id])
                    ];
                } elseif ($mimeType === 'application/pdf') {
                    $preview = [
                        'type' => 'pdf',
                        'url' => route('documents.preview', ['document' => $document->id])
                    ];
                }
            }

            // Get OCR data if available
            $ocrData = $document->ocr_data ? json_decode($document->ocr_data, true) : null;

            AdminAction::logAction(
                auth()->id(),
                'document_review_view',
                "Visualizou documento para revisão: {$document->file_name}",
                null,
                ['document_id' => $document->id, 'user_id' => $document->user_id]
            );

            return response()->json([
                'document' => $document,
                'preview' => $preview,
                'ocr_data' => $ocrData,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Documento não encontrado',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Approve document
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $document = Document::findOrFail($id);

            if ($document->status === 'approved') {
                return response()->json([
                    'message' => 'Documento já foi aprovado'
                ], 400);
            }

            $document->update([
                'status' => 'approved',
                'verified_by' => auth()->id(),
                'verified_at' => now(),
                'notes' => $request->notes,
            ]);

            // Notify user about approval
            $this->notifyUser($document, 'approved', $request->notes);

            AdminAction::logAction(
                auth()->id(),
                'document_approve',
                "Aprovou documento: {$document->file_name}",
                $document->user_id,
                [
                    'document_id' => $document->id,
                    'notes' => $request->notes,
                ]
            );

            return response()->json([
                'message' => 'Documento aprovado com sucesso',
                'document' => $document->load(['verifiedBy'])
            ]);

        } catch (\Exception $e) {
            AdminAction::logAction(
                auth()->id(),
                'document_approve',
                'Erro ao aprovar documento',
                null,
                ['document_id' => $id],
                false,
                $e->getMessage()
            );

            return response()->json([
                'message' => 'Erro ao aprovar documento',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject document
     */
    public function reject(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'rejection_reason' => 'required|string|max:1000',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $document = Document::findOrFail($id);

            if ($document->status === 'rejected') {
                return response()->json([
                    'message' => 'Documento já foi rejeitado'
                ], 400);
            }

            $document->update([
                'status' => 'rejected',
                'verified_by' => auth()->id(),
                'verified_at' => now(),
                'rejection_reason' => $request->rejection_reason,
                'notes' => $request->notes,
            ]);

            // Notify user about rejection
            $this->notifyUser($document, 'rejected', $request->rejection_reason, $request->notes);

            AdminAction::logAction(
                auth()->id(),
                'document_reject',
                "Rejeitou documento: {$document->file_name}",
                $document->user_id,
                [
                    'document_id' => $document->id,
                    'rejection_reason' => $request->rejection_reason,
                    'notes' => $request->notes,
                ]
            );

            return response()->json([
                'message' => 'Documento rejeitado com sucesso',
                'document' => $document->load(['verifiedBy'])
            ]);

        } catch (\Exception $e) {
            AdminAction::logAction(
                auth()->id(),
                'document_reject',
                'Erro ao rejeitar documento',
                null,
                ['document_id' => $id],
                false,
                $e->getMessage()
            );

            return response()->json([
                'message' => 'Erro ao rejeitar documento',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Request additional information
     */
    public function requestInfo(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|max:1000',
        ]);

        try {
            $document = Document::findOrFail($id);

            $document->update([
                'status' => 'info_requested',
                'verified_by' => auth()->id(),
                'verified_at' => now(),
                'notes' => $request->message,
            ]);

            // Notify user about info request
            $this->notifyUser($document, 'info_requested', $request->message);

            AdminAction::logAction(
                auth()->id(),
                'document_request_info',
                "Solicitou informações adicionais para documento: {$document->file_name}",
                $document->user_id,
                [
                    'document_id' => $document->id,
                    'message' => $request->message,
                ]
            );

            return response()->json([
                'message' => 'Solicitação de informações enviada com sucesso',
                'document' => $document->load(['verifiedBy'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao solicitar informações',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk review operations
     */
    public function bulkReview(Request $request): JsonResponse
    {
        $request->validate([
            'operation' => 'required|in:approve,reject',
            'document_ids' => 'required|array|min:1',
            'document_ids.*' => 'integer|exists:documents,id',
            'notes' => 'nullable|string|max:1000',
            'rejection_reason' => 'required_if:operation,reject|string|max:1000',
        ]);

        try {
            $documentIds = $request->document_ids;
            $operation = $request->operation;
            $results = ['success' => [], 'failed' => []];

            foreach ($documentIds as $documentId) {
                try {
                    $document = Document::findOrFail($documentId);

                    if ($operation === 'approve') {
                        $document->update([
                            'status' => 'approved',
                            'verified_by' => auth()->id(),
                            'verified_at' => now(),
                            'notes' => $request->notes,
                        ]);
                        $this->notifyUser($document, 'approved', $request->notes);
                    } else {
                        $document->update([
                            'status' => 'rejected',
                            'verified_by' => auth()->id(),
                            'verified_at' => now(),
                            'rejection_reason' => $request->rejection_reason,
                            'notes' => $request->notes,
                        ]);
                        $this->notifyUser($document, 'rejected', $request->rejection_reason, $request->notes);
                    }

                    $results['success'][] = $documentId;

                } catch (\Exception $e) {
                    $results['failed'][] = ['document_id' => $documentId, 'error' => $e->getMessage()];
                }
            }

            AdminAction::logAction(
                auth()->id(),
                'documents_bulk_review',
                "Executou revisão em massa: {$operation}",
                null,
                [
                    'operation' => $operation,
                    'total_documents' => count($documentIds),
                    'successful' => count($results['success']),
                    'failed' => count($results['failed'])
                ]
            );

            return response()->json([
                'message' => 'Revisão em massa executada',
                'results' => $results
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro na revisão em massa',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get document review statistics
     */
    public function statistics(Request $request): JsonResponse
    {
        $request->validate([
            'period' => 'in:today,week,month,quarter,year',
        ]);

        try {
            $period = $request->period ?? 'month';
            $startDate = match($period) {
                'today' => now()->startOfDay(),
                'week' => now()->startOfWeek(),
                'month' => now()->startOfMonth(),
                'quarter' => now()->startOfQuarter(),
                'year' => now()->startOfYear(),
            };

            $statistics = [
                'total_documents' => Document::where('created_at', '>=', $startDate)->count(),
                'pending_review' => Document::where('status', 'pending')
                    ->where('created_at', '>=', $startDate)->count(),
                'approved' => Document::where('status', 'approved')
                    ->where('verified_at', '>=', $startDate)->count(),
                'rejected' => Document::where('status', 'rejected')
                    ->where('verified_at', '>=', $startDate)->count(),
                'info_requested' => Document::where('status', 'info_requested')
                    ->where('verified_at', '>=', $startDate)->count(),
                'average_review_time' => $this->getAverageReviewTime($startDate),
                'reviewer_performance' => $this->getReviewerPerformance($startDate),
            ];

            AdminAction::logAction(
                auth()->id(),
                'document_review_statistics',
                'Visualizou estatísticas de revisão de documentos',
                null,
                ['period' => $period]
            );

            return response()->json([
                'statistics' => $statistics,
                'period' => $period,
                'start_date' => $startDate->toDateString(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao carregar estatísticas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Notify user about document status change
     */
    private function notifyUser(Document $document, string $status, string $message, ?string $notes = null): void
    {
        // This would typically send email/SMS notifications
        // For now, we'll just log the action
        $notificationData = [
            'document_id' => $document->id,
            'document_name' => $document->file_name,
            'status' => $status,
            'message' => $message,
            'notes' => $notes,
        ];

        // Here you would implement actual notification logic
        // Notification::send($document->user, new DocumentStatusChanged($notificationData));
    }

    /**
     * Get average review time
     */
    private function getAverageReviewTime($startDate): ?float
    {
        $reviews = Document::whereNotNull('verified_at')
            ->where('verified_at', '>=', $startDate)
            ->get();

        if ($reviews->isEmpty()) {
            return null;
        }

        $totalHours = $reviews->sum(function ($document) {
            return $document->created_at->diffInHours($document->verified_at);
        });

        return round($totalHours / $reviews->count(), 2);
    }

    /**
     * Get reviewer performance
     */
    private function getReviewerPerformance($startDate): array
    {
        return Document::with('verifiedBy')
            ->whereNotNull('verified_by')
            ->where('verified_at', '>=', $startDate)
            ->get()
            ->groupBy('verified_by')
            ->map(function ($documents) {
                return [
                    'reviewer' => $documents->first()->verifiedBy->name,
                    'total_reviews' => $documents->count(),
                    'approved' => $documents->where('status', 'approved')->count(),
                    'rejected' => $documents->where('status', 'rejected')->count(),
                    'average_time_hours' => round($documents->avg(function ($doc) {
                        return $doc->created_at->diffInHours($doc->verified_at);
                    }), 2),
                ];
            })
            ->values()
            ->toArray();
    }
}