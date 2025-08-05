<?php

namespace App\Listeners;

use App\Events\DocumentProcessed;
use App\Services\GamificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class ProcessDocumentGamification implements ShouldQueue
{
    use InteractsWithQueue;

    protected GamificationService $gamificationService;

    /**
     * Create the event listener.
     */
    public function __construct(GamificationService $gamificationService)
    {
        $this->gamificationService = $gamificationService;
    }

    /**
     * Handle the event.
     */
    public function handle(DocumentProcessed $event): void
    {
        try {
            // Get document and beneficiary
            $document = $event->document;
            $beneficiary = $document->beneficiary;
            
            if (!$beneficiary) {
                Log::warning('Document has no associated beneficiary', [
                    'document_id' => $document->id
                ]);
                return;
            }

            // Check if document processing was successful
            if ($document->status !== 'completed') {
                Log::info('Document not completed, skipping gamification', [
                    'document_id' => $document->id,
                    'status' => $document->status
                ]);
                return;
            }

            // Extract OCR data and metrics
            $ocrData = $event->ocrResult;
            $validationResults = $document->validation_results ?? [];
            
            // Prepare gamification metadata
            $metadata = $this->prepareGamificationMetadata($document, $ocrData, $validationResults);
            
            // Award OCR processing points
            $pointsAwarded = $this->gamificationService->awardPoints(
                $beneficiary,
                'ocr_processing_completed',
                $metadata
            );

            // Check for progressive quality bonus
            $this->checkProgressiveQualityBonus($beneficiary, $metadata);

            // Check and award relevant badges
            $this->gamificationService->checkAndAwardBadges($beneficiary);

            Log::info('OCR gamification processing completed', [
                'document_id' => $document->id,
                'beneficiary_id' => $beneficiary->id,
                'points_awarded' => $pointsAwarded,
                'confidence' => $metadata['confidence'],
                'quality' => $metadata['quality'],
                'validation_status' => $metadata['validation_status']
            ]);

        } catch (\Exception $e) {
            Log::error('Error processing OCR gamification', [
                'document_id' => $event->document->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Don't fail silently - throw to retry
            throw $e;
        }
    }

    /**
     * Prepare metadata for gamification calculation
     */
    protected function prepareGamificationMetadata($document, array $ocrData, array $validationResults): array
    {
        // Extract confidence score
        $confidence = $ocrData['average_confidence'] ?? 0;
        
        // Extract quality metrics
        $quality = 0;
        if (isset($ocrData['quality_metrics']['overall_quality'])) {
            $quality = $ocrData['quality_metrics']['overall_quality'];
        } elseif ($confidence > 0) {
            // Fallback: use confidence as quality indicator
            $quality = $confidence;
        }

        // Determine validation status
        $validationStatus = $validationResults['status'] ?? 'unknown';
        
        // Calculate validation success score
        $validationScore = 0;
        if (isset($validationResults['checks'])) {
            $totalChecks = count($validationResults['checks']);
            $passedChecks = count(array_filter($validationResults['checks']));
            $validationScore = $totalChecks > 0 ? ($passedChecks / $totalChecks) * 100 : 0;
        }

        return [
            'document_id' => $document->id,
            'document_type' => $document->type,
            'confidence' => $confidence,
            'quality' => $quality,
            'validation_status' => $validationStatus,
            'validation_score' => $validationScore,
            'has_warnings' => !empty($validationResults['warnings']),
            'warning_count' => count($validationResults['warnings'] ?? []),
            'processing_method' => $ocrData['processing_metadata']['method'] ?? 'unknown',
            'progressive_bonus' => false, // Will be calculated separately
        ];
    }

    /**
     * Check for progressive quality bonus for consistent high-quality processing
     */
    protected function checkProgressiveQualityBonus($beneficiary, array $metadata): void
    {
        try {
            // Get recent document processing history (last 5 documents)
            $recentDocuments = $beneficiary->documents()
                ->where('status', 'completed')
                ->where('processed_at', '>', now()->subDays(30))
                ->orderBy('processed_at', 'desc')
                ->limit(5)
                ->get();

            if ($recentDocuments->count() < 3) {
                return; // Not enough history for progressive bonus
            }

            $highQualityCount = 0;
            foreach ($recentDocuments as $doc) {
                $docOcrData = $doc->ocr_data ?? [];
                $docConfidence = $docOcrData['average_confidence'] ?? 0;
                $docValidation = $doc->validation_results ?? [];
                
                // Consider high quality if confidence > 85% AND validation passed
                if ($docConfidence >= 85 && ($docValidation['status'] ?? '') === 'passed') {
                    $highQualityCount++;
                }
            }

            // Award progressive bonus if 80% or more are high quality
            $qualityRate = $highQualityCount / $recentDocuments->count();
            if ($qualityRate >= 0.8) {
                $this->gamificationService->awardPoints(
                    $beneficiary,
                    'ocr_progressive_quality',
                    [
                        'quality_rate' => $qualityRate,
                        'high_quality_count' => $highQualityCount,
                        'total_recent_documents' => $recentDocuments->count(),
                    ]
                );

                Log::info('Progressive quality bonus awarded', [
                    'beneficiary_id' => $beneficiary->id,
                    'quality_rate' => $qualityRate,
                    'high_quality_count' => $highQualityCount,
                ]);
            }

        } catch (\Exception $e) {
            Log::warning('Error calculating progressive quality bonus', [
                'beneficiary_id' => $beneficiary->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Handle failed job
     */
    public function failed(DocumentProcessed $event, \Throwable $exception): void
    {
        Log::error('OCR gamification listener failed permanently', [
            'document_id' => $event->document->id,
            'exception' => $exception->getMessage(),
        ]);
    }
}