<?php

namespace App\Services;

use App\Models\HealthQuestionnaire;
use App\Models\Beneficiary;
use App\Jobs\ProcessHealthRisksJob;
use App\Services\GamificationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * Health Data Coordinator Service
 * 
 * Coordinates the processing of health questionnaires to prevent race conditions
 * between gamification and clinical alerts processing.
 * 
 * Flow:
 * 1. Lock questionnaire to prevent concurrent processing
 * 2. Process gamification first (immediate)
 * 3. Create snapshot of risk_scores 
 * 4. Dispatch clinical alerts job with delay
 * 
 * This ensures gamification always processes with the original data
 * and clinical alerts can't modify scores that have already been used.
 */
class HealthDataCoordinator
{
    protected GamificationService $gamificationService;
    
    public function __construct(GamificationService $gamificationService)
    {
        $this->gamificationService = $gamificationService;
    }
    
    /**
     * Process a completed health questionnaire with proper coordination
     * 
     * @param HealthQuestionnaire $questionnaire
     * @return array Processing results
     */
    public function processQuestionnaire(HealthQuestionnaire $questionnaire): array
    {
        $lockKey = "questionnaire_processing_{$questionnaire->id}";
        $lock = Cache::lock($lockKey, 60); // 60 second lock
        
        if (!$lock->get()) {
            Log::warning("Failed to acquire lock for questionnaire {$questionnaire->id}");
            return [
                'success' => false,
                'message' => 'Questionnaire is already being processed'
            ];
        }
        
        try {
            DB::beginTransaction();
            
            // 1. Create snapshot of current risk scores BEFORE any processing
            $riskScoresSnapshot = $questionnaire->risk_scores;
            $questionnaire->risk_scores_snapshot = $riskScoresSnapshot;
            
            // 2. Update processing status
            $processingStatus = $questionnaire->processing_status ?? [];
            $processingStatus['started_at'] = now()->toDateTimeString();
            $processingStatus['coordinator_version'] = '1.0';
            $questionnaire->processing_status = $processingStatus;
            $questionnaire->save();
            
            // 3. Process gamification FIRST (immediate)
            $gamificationResult = $this->processGamification($questionnaire);
            
            // 4. Update processing status with gamification result
            $processingStatus['gamification_processed'] = true;
            $processingStatus['gamification_processed_at'] = now()->toDateTimeString();
            $processingStatus['gamification_points'] = $gamificationResult['points_awarded'] ?? 0;
            $processingStatus['gamification_badges'] = $gamificationResult['badges_earned'] ?? [];
            $questionnaire->processing_status = $processingStatus;
            $questionnaire->save();
            
            // 5. Dispatch clinical alerts job with delay (30 seconds)
            // This ensures gamification is fully processed before clinical analysis
            ProcessHealthRisksJob::dispatch($questionnaire)
                ->delay(now()->addSeconds(30));
            
            // 6. Log coordination event
            Log::info("Health questionnaire {$questionnaire->id} coordinated successfully", [
                'beneficiary_id' => $questionnaire->beneficiary_id,
                'gamification_points' => $gamificationResult['points_awarded'] ?? 0,
                'risk_scores_snapshot' => $riskScoresSnapshot,
                'processing_delay' => 30
            ]);
            
            DB::commit();
            
            return [
                'success' => true,
                'message' => 'Questionnaire processing coordinated successfully',
                'gamification' => $gamificationResult,
                'clinical_alerts_scheduled' => true,
                'processing_delay_seconds' => 30
            ];
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error coordinating questionnaire {$questionnaire->id}: " . $e->getMessage());
            
            return [
                'success' => false,
                'message' => 'Error processing questionnaire',
                'error' => $e->getMessage()
            ];
        } finally {
            $lock->release();
        }
    }
    
    /**
     * Process gamification for the questionnaire
     * 
     * @param HealthQuestionnaire $questionnaire
     * @return array Gamification results
     */
    protected function processGamification(HealthQuestionnaire $questionnaire): array
    {
        try {
            $beneficiary = $questionnaire->beneficiary;
            if (!$beneficiary) {
                throw new \Exception('Beneficiary not found for questionnaire');
            }
            
            // Award points for health assessment completion
            $basePoints = 100; // Base points for completing health assessment
            
            // Calculate bonus points based on risk scores (USING SNAPSHOT)
            $riskScores = $questionnaire->risk_scores_snapshot ?? $questionnaire->risk_scores;
            $bonusPoints = $this->calculateBonusPoints($riskScores);
            
            $totalPoints = $basePoints + $bonusPoints;
            
            // Award points through gamification service
            $this->gamificationService->awardPoints(
                $beneficiary,
                $totalPoints,
                'health_assessment_completed',
                'Completed health risk assessment'
            );
            
            // Check for badges related to health assessments
            $badges = [];
            
            // First health assessment badge
            $assessmentCount = HealthQuestionnaire::where('beneficiary_id', $beneficiary->id)
                ->where('status', 'completed')
                ->count();
                
            if ($assessmentCount === 1) {
                $badge = $this->gamificationService->awardBadge($beneficiary, 'first_health_assessment');
                if ($badge) {
                    $badges[] = $badge->slug;
                }
            }
            
            // Health champion badge (5 assessments)
            if ($assessmentCount >= 5) {
                $badge = $this->gamificationService->awardBadge($beneficiary, 'health_champion');
                if ($badge) {
                    $badges[] = $badge->slug;
                }
            }
            
            // Low risk badge (all categories low risk)
            if ($this->hasAllLowRisk($riskScores)) {
                $badge = $this->gamificationService->awardBadge($beneficiary, 'low_risk_champion');
                if ($badge) {
                    $badges[] = $badge->slug;
                }
            }
            
            return [
                'points_awarded' => $totalPoints,
                'base_points' => $basePoints,
                'bonus_points' => $bonusPoints,
                'badges_earned' => $badges,
                'assessment_count' => $assessmentCount
            ];
            
        } catch (\Exception $e) {
            Log::error("Gamification processing error: " . $e->getMessage());
            return [
                'points_awarded' => 0,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Calculate bonus points based on risk scores
     * 
     * @param array $riskScores
     * @return int Bonus points
     */
    protected function calculateBonusPoints(array $riskScores): int
    {
        if (empty($riskScores) || !isset($riskScores['categories'])) {
            return 0;
        }
        
        $bonusPoints = 0;
        $categories = $riskScores['categories'];
        
        // Award bonus points for low risk categories
        foreach ($categories as $category => $score) {
            if ($score < 30) { // Low risk threshold
                $bonusPoints += 10;
            }
        }
        
        // Extra bonus for overall low risk
        $overallScore = $riskScores['overall_risk_score'] ?? 0;
        if ($overallScore < 25) {
            $bonusPoints += 50; // Excellent health bonus
        } elseif ($overallScore < 40) {
            $bonusPoints += 25; // Good health bonus
        }
        
        return $bonusPoints;
    }
    
    /**
     * Check if all risk categories are low
     * 
     * @param array $riskScores
     * @return bool
     */
    protected function hasAllLowRisk(array $riskScores): bool
    {
        if (empty($riskScores) || !isset($riskScores['categories'])) {
            return false;
        }
        
        foreach ($riskScores['categories'] as $score) {
            if ($score >= 30) { // Any category above low risk threshold
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get processing status for a questionnaire
     * 
     * @param int $questionnaireId
     * @return array
     */
    public function getProcessingStatus(int $questionnaireId): array
    {
        $questionnaire = HealthQuestionnaire::find($questionnaireId);
        
        if (!$questionnaire) {
            return [
                'found' => false,
                'message' => 'Questionnaire not found'
            ];
        }
        
        $processingStatus = $questionnaire->processing_status ?? [];
        $lockKey = "questionnaire_processing_{$questionnaireId}";
        $isLocked = Cache::has($lockKey);
        
        return [
            'found' => true,
            'questionnaire_id' => $questionnaireId,
            'is_locked' => $isLocked,
            'processing_status' => $processingStatus,
            'risk_scores_snapshot' => $questionnaire->risk_scores_snapshot,
            'current_risk_scores' => $questionnaire->risk_scores,
            'scores_modified' => $questionnaire->risk_scores_snapshot !== $questionnaire->risk_scores
        ];
    }
    
    /**
     * Reconcile any processing conflicts
     * 
     * @param int $questionnaireId
     * @return array
     */
    public function reconcileProcessing(int $questionnaireId): array
    {
        $questionnaire = HealthQuestionnaire::find($questionnaireId);
        
        if (!$questionnaire) {
            return [
                'success' => false,
                'message' => 'Questionnaire not found'
            ];
        }
        
        $processingStatus = $questionnaire->processing_status ?? [];
        
        // Check if both gamification and clinical alerts have been processed
        $gamificationProcessed = $processingStatus['gamification_processed'] ?? false;
        $clinicalAlertsProcessed = $processingStatus['clinical_alerts_processed'] ?? false;
        
        if (!$gamificationProcessed || !$clinicalAlertsProcessed) {
            return [
                'success' => false,
                'message' => 'Processing not yet complete',
                'gamification_processed' => $gamificationProcessed,
                'clinical_alerts_processed' => $clinicalAlertsProcessed
            ];
        }
        
        // Check if risk scores were modified after gamification
        if ($questionnaire->risk_scores_snapshot !== $questionnaire->risk_scores) {
            Log::warning("Risk scores modified after gamification for questionnaire {$questionnaireId}", [
                'snapshot' => $questionnaire->risk_scores_snapshot,
                'current' => $questionnaire->risk_scores
            ]);
            
            // In this case, gamification used the snapshot (original scores)
            // which is correct. No action needed.
        }
        
        return [
            'success' => true,
            'message' => 'Processing reconciled successfully',
            'gamification_used_snapshot' => true,
            'scores_were_modified' => $questionnaire->risk_scores_snapshot !== $questionnaire->risk_scores
        ];
    }
}