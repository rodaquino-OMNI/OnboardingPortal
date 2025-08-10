<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Models\HealthQuestionnaire;
use App\Models\ClinicalAlert;
use App\Models\AlertWorkflow;
use App\Models\Beneficiary;
use App\Notifications\CriticalHealthAlertNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ProcessHealthRisksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes
    public $tries = 3;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info('Starting health risk processing job');

        try {
            // Process recently completed questionnaires
            $this->processRecentQuestionnaires();
            
            // Check for trend-based alerts
            $this->checkForTrendAlerts();
            
            // Check for overdue follow-ups
            $this->checkOverdueFollowUps();
            
            // Update SLA statuses
            $this->updateSlaStatuses();
            
            Log::info('Health risk processing job completed successfully');
        } catch (\Exception $e) {
            Log::error('Health risk processing job failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Process questionnaires completed in the last 24 hours
     */
    private function processRecentQuestionnaires(): void
    {
        $questionnaires = HealthQuestionnaire::where('status', 'completed')
            ->where('completed_at', '>=', now()->subHours(24))
            ->whereDoesntHave('alerts')
            ->where(function($query) {
                $query->whereNull('processing_status')
                    ->orWhereRaw("JSON_EXTRACT(processing_status, '$.clinical_alerts_processed') != true");
            })
            ->with('beneficiary')
            ->get();

        Log::info("Processing {$questionnaires->count()} recent questionnaires");

        foreach ($questionnaires as $questionnaire) {
            $this->analyzeQuestionnaire($questionnaire);
        }
    }

    /**
     * Analyze a single questionnaire for risk factors
     */
    private function analyzeQuestionnaire(HealthQuestionnaire $questionnaire): void
    {
        $riskScores = $questionnaire->risk_scores ?? [];
        $alerts = [];

        // Check for critical safety risks
        if ($this->hasCriticalSafetyRisk($riskScores)) {
            $alerts[] = $this->createSafetyAlert($questionnaire, $riskScores);
        }

        // Check for high mental health risk
        if ($this->hasHighMentalHealthRisk($riskScores)) {
            $alerts[] = $this->createMentalHealthAlert($questionnaire, $riskScores);
        }

        // Check for substance abuse risk
        if ($this->hasSubstanceAbuseRisk($riskScores)) {
            $alerts[] = $this->createSubstanceAbuseAlert($questionnaire, $riskScores);
        }

        // Check for cardiovascular risk
        if ($this->hasCardiovascularRisk($riskScores)) {
            $alerts[] = $this->createCardiovascularAlert($questionnaire, $riskScores);
        }

        // Check for combined risk factors
        if ($this->hasCombinedRiskFactors($riskScores)) {
            $alerts[] = $this->createCombinedRiskAlert($questionnaire, $riskScores);
        }

        // Create alerts and notify
        $alertsCreated = 0;
        foreach (array_filter($alerts) as $alertData) {
            $alert = ClinicalAlert::create($alertData);
            $alertsCreated++;
            
            // Create initial workflow entry
            AlertWorkflow::create([
                'alert_id' => $alert->id,
                'beneficiary_id' => $alert->beneficiary_id,
                'action_type' => 'alert_created',
                'action_description' => 'Alert automatically generated based on risk assessment',
                'performed_by' => null // System generated
            ]);

            // Send notifications for high priority alerts
            if (in_array($alert->priority, ['urgent', 'emergency'])) {
                $this->sendCriticalAlertNotifications($alert);
            }
        }
        
        // Update processing status to mark clinical alerts as processed
        $processingStatus = $questionnaire->processing_status ?? [];
        $processingStatus['clinical_alerts_processed'] = true;
        $processingStatus['clinical_alerts_processed_at'] = now()->toDateTimeString();
        $processingStatus['alerts_created'] = $alertsCreated;
        $processingStatus['risk_scores_used'] = $questionnaire->risk_scores_snapshot ?? $questionnaire->risk_scores;
        $questionnaire->processing_status = $processingStatus;
        $questionnaire->save();
    }

    /**
     * Check for critical safety risks
     */
    private function hasCriticalSafetyRisk(array $riskScores): bool
    {
        $safetyScore = $riskScores['categories']['safety_risk'] ?? 0;
        $flags = $riskScores['flags'] ?? [];

        return $safetyScore >= 35 || 
               in_array('suicide_risk', $flags) || 
               in_array('current_violence_exposure', $flags) ||
               in_array('recent_suicide_attempt', $flags);
    }

    /**
     * Create safety alert
     */
    private function createSafetyAlert(HealthQuestionnaire $questionnaire, array $riskScores): array
    {
        $flags = $riskScores['flags'] ?? [];
        $safetyScore = $riskScores['categories']['safety_risk'] ?? 0;
        
        $priority = 'high';
        $title = 'Safety Risk Identified';
        $message = 'Patient shows elevated safety risk indicators.';

        if (in_array('suicide_risk', $flags) || in_array('recent_suicide_attempt', $flags)) {
            $priority = 'emergency';
            $title = 'Critical Safety Risk - Suicide Ideation';
            $message = 'Patient has indicated suicidal ideation or recent attempt. Immediate intervention required.';
        } elseif (in_array('current_violence_exposure', $flags)) {
            $priority = 'urgent';
            $title = 'Safety Risk - Violence Exposure';
            $message = 'Patient reports current exposure to violence. Safety protocol activation recommended.';
        }

        return [
            'beneficiary_id' => $questionnaire->beneficiary_id,
            'questionnaire_id' => $questionnaire->id,
            'alert_type' => 'risk_threshold',
            'category' => 'allergy_safety',
            'priority' => $priority,
            'risk_score' => $safetyScore,
            'risk_factors' => [
                'safety_score' => $safetyScore,
                'flags' => $flags
            ],
            'risk_scores_detail' => $riskScores,
            'title' => $title,
            'message' => $message,
            'clinical_recommendations' => $this->getSafetyRecommendations($flags, $safetyScore),
            'intervention_options' => [
                'immediate_assessment',
                'crisis_intervention',
                'safety_planning'
            ]
        ];
    }

    /**
     * Check for high mental health risk
     */
    private function hasHighMentalHealthRisk(array $riskScores): bool
    {
        $mentalHealthScore = $riskScores['categories']['mental_health'] ?? 0;
        $flags = $riskScores['flags'] ?? [];

        return $mentalHealthScore >= 25 || 
               in_array('severe_depression', $flags) || 
               in_array('severe_anxiety', $flags);
    }

    /**
     * Create mental health alert
     */
    private function createMentalHealthAlert(HealthQuestionnaire $questionnaire, array $riskScores): array
    {
        $mentalHealthScore = $riskScores['categories']['mental_health'] ?? 0;
        $flags = $riskScores['flags'] ?? [];

        $priority = 'high';
        if (in_array('severe_depression', $flags) || in_array('severe_anxiety', $flags)) {
            $priority = 'urgent';
        }

        return [
            'beneficiary_id' => $questionnaire->beneficiary_id,
            'questionnaire_id' => $questionnaire->id,
            'alert_type' => 'risk_threshold',
            'category' => 'mental_health',
            'priority' => $priority,
            'risk_score' => $mentalHealthScore,
            'risk_factors' => [
                'mental_health_score' => $mentalHealthScore,
                'flags' => $flags,
                'phq9_score' => $this->extractPhq9Score($questionnaire),
                'gad7_score' => $this->extractGad7Score($questionnaire)
            ],
            'risk_scores_detail' => $riskScores,
            'title' => 'Mental Health Risk Identified',
            'message' => 'Patient shows elevated mental health risk indicators requiring clinical attention.',
            'clinical_recommendations' => $this->getMentalHealthRecommendations($flags, $mentalHealthScore),
            'intervention_options' => [
                'mental_health_assessment',
                'psychiatry_referral',
                'therapy_enrollment'
            ]
        ];
    }

    /**
     * Check for substance abuse risk
     */
    private function hasSubstanceAbuseRisk(array $riskScores): bool
    {
        $substanceScore = $riskScores['categories']['substance_abuse'] ?? 0;
        $flags = $riskScores['flags'] ?? [];

        return $substanceScore >= 30 || 
               in_array('high_risk_alcohol_use', $flags) || 
               in_array('illegal_drug_use', $flags);
    }

    /**
     * Create substance abuse alert
     */
    private function createSubstanceAbuseAlert(HealthQuestionnaire $questionnaire, array $riskScores): array
    {
        $substanceScore = $riskScores['categories']['substance_abuse'] ?? 0;
        $flags = $riskScores['flags'] ?? [];

        return [
            'beneficiary_id' => $questionnaire->beneficiary_id,
            'questionnaire_id' => $questionnaire->id,
            'alert_type' => 'risk_threshold',
            'category' => 'substance_abuse',
            'priority' => 'high',
            'risk_score' => $substanceScore,
            'risk_factors' => [
                'substance_score' => $substanceScore,
                'flags' => $flags,
                'audit_c_score' => $this->extractAuditCScore($questionnaire)
            ],
            'risk_scores_detail' => $riskScores,
            'title' => 'Substance Use Risk Identified',
            'message' => 'Patient shows elevated substance use risk requiring intervention.',
            'clinical_recommendations' => $this->getSubstanceAbuseRecommendations($flags, $substanceScore),
            'intervention_options' => [
                'substance_assessment',
                'counseling_referral',
                'treatment_program'
            ]
        ];
    }

    /**
     * Check for cardiovascular risk
     */
    private function hasCardiovascularRisk(array $riskScores): bool
    {
        $cvScore = $riskScores['categories']['cardiovascular'] ?? 0;
        return $cvScore >= 60; // 5+ risk factors
    }

    /**
     * Create cardiovascular alert
     */
    private function createCardiovascularAlert(HealthQuestionnaire $questionnaire, array $riskScores): array
    {
        $cvScore = $riskScores['categories']['cardiovascular'] ?? 0;
        
        return [
            'beneficiary_id' => $questionnaire->beneficiary_id,
            'questionnaire_id' => $questionnaire->id,
            'alert_type' => 'risk_threshold',
            'category' => 'cardiovascular',
            'priority' => 'medium',
            'risk_score' => $cvScore,
            'risk_factors' => [
                'cardiovascular_score' => $cvScore,
                'risk_factor_count' => intval($cvScore / 12)
            ],
            'risk_scores_detail' => $riskScores,
            'title' => 'Cardiovascular Risk Factors Identified',
            'message' => 'Patient has multiple cardiovascular risk factors requiring preventive intervention.',
            'clinical_recommendations' => $this->getCardiovascularRecommendations($cvScore),
            'intervention_options' => [
                'lifestyle_counseling',
                'cardiology_referral',
                'preventive_screening'
            ]
        ];
    }

    /**
     * Check for combined risk factors
     */
    private function hasCombinedRiskFactors(array $riskScores): bool
    {
        $overallScore = $riskScores['overall'] ?? 0;
        $highRiskCategories = 0;

        foreach ($riskScores['categories'] ?? [] as $category => $score) {
            if ($score >= 20) {
                $highRiskCategories++;
            }
        }

        return $overallScore >= 100 && $highRiskCategories >= 3;
    }

    /**
     * Create combined risk alert
     */
    private function createCombinedRiskAlert(HealthQuestionnaire $questionnaire, array $riskScores): array
    {
        $overallScore = $riskScores['overall'] ?? 0;
        
        return [
            'beneficiary_id' => $questionnaire->beneficiary_id,
            'questionnaire_id' => $questionnaire->id,
            'alert_type' => 'combined_factors',
            'category' => 'preventive_care',
            'priority' => 'high',
            'risk_score' => $overallScore,
            'risk_factors' => $riskScores['categories'] ?? [],
            'risk_scores_detail' => $riskScores,
            'title' => 'Multiple Risk Factors Identified',
            'message' => 'Patient presents with multiple elevated risk factors requiring comprehensive care coordination.',
            'clinical_recommendations' => $this->getCombinedRiskRecommendations($riskScores),
            'intervention_options' => [
                'comprehensive_assessment',
                'care_coordination',
                'multidisciplinary_review'
            ]
        ];
    }

    /**
     * Check for trend-based alerts
     */
    private function checkForTrendAlerts(): void
    {
        // Get beneficiaries with multiple recent assessments
        $beneficiariesWithTrends = HealthQuestionnaire::select('beneficiary_id')
            ->where('completed_at', '>=', now()->subDays(90))
            ->whereNotNull('risk_scores')
            ->groupBy('beneficiary_id')
            ->havingRaw('COUNT(*) >= 2')
            ->pluck('beneficiary_id');

        foreach ($beneficiariesWithTrends as $beneficiaryId) {
            $this->analyzeTrends($beneficiaryId);
        }
    }

    /**
     * Analyze trends for a beneficiary
     */
    private function analyzeTrends(int $beneficiaryId): void
    {
        $recentAssessments = HealthQuestionnaire::where('beneficiary_id', $beneficiaryId)
            ->whereNotNull('risk_scores')
            ->orderBy('completed_at', 'desc')
            ->limit(5)
            ->get();

        if ($recentAssessments->count() < 2) return;

        $latestScores = $recentAssessments->first()->risk_scores;
        $previousScores = $recentAssessments->skip(1)->first()->risk_scores;

        // Check for worsening trends
        foreach ($latestScores['categories'] ?? [] as $category => $score) {
            $previousScore = $previousScores['categories'][$category] ?? 0;
            $increase = $score - $previousScore;
            $percentIncrease = $previousScore > 0 ? ($increase / $previousScore) * 100 : 0;

            if ($increase >= 10 && $percentIncrease >= 25) {
                $this->createTrendAlert($beneficiaryId, $category, $score, $previousScore, $recentAssessments->first());
            }
        }
    }

    /**
     * Create trend-based alert
     */
    private function createTrendAlert(int $beneficiaryId, string $category, int $currentScore, int $previousScore, HealthQuestionnaire $questionnaire): void
    {
        $alert = ClinicalAlert::create([
            'beneficiary_id' => $beneficiaryId,
            'questionnaire_id' => $questionnaire->id,
            'alert_type' => 'risk_trend',
            'category' => $this->mapRiskCategory($category),
            'priority' => 'medium',
            'risk_score' => $currentScore,
            'risk_factors' => [
                'current_score' => $currentScore,
                'previous_score' => $previousScore,
                'increase' => $currentScore - $previousScore,
                'percent_increase' => round((($currentScore - $previousScore) / $previousScore) * 100, 2)
            ],
            'risk_scores_detail' => $questionnaire->risk_scores,
            'title' => 'Worsening Risk Trend Detected',
            'message' => "Patient's {$category} risk has increased significantly since last assessment.",
            'clinical_recommendations' => ["Review recent changes", "Consider intervention escalation"],
            'intervention_options' => ['trend_review', 'intervention_adjustment']
        ]);

        AlertWorkflow::create([
            'alert_id' => $alert->id,
            'beneficiary_id' => $beneficiaryId,
            'action_type' => 'alert_created',
            'action_description' => 'Trend-based alert generated due to worsening risk scores',
            'performed_by' => null
        ]);
    }

    /**
     * Check for overdue follow-ups
     */
    private function checkOverdueFollowUps(): void
    {
        $overdueWorkflows = AlertWorkflow::whereNotNull('next_review_date')
            ->where('next_review_date', '<', now())
            ->whereDoesntHave('alert', function ($query) {
                $query->whereIn('status', ['resolved', 'dismissed']);
            })
            ->with('alert')
            ->get();

        foreach ($overdueWorkflows as $workflow) {
            $this->createFollowUpAlert($workflow);
        }
    }

    /**
     * Create follow-up alert
     */
    private function createFollowUpAlert(AlertWorkflow $workflow): void
    {
        $alert = ClinicalAlert::create([
            'beneficiary_id' => $workflow->beneficiary_id,
            'questionnaire_id' => $workflow->alert->questionnaire_id,
            'alert_type' => 'follow_up_due',
            'category' => $workflow->alert->category,
            'priority' => 'medium',
            'risk_score' => $workflow->alert->risk_score,
            'risk_factors' => [
                'original_alert_id' => $workflow->alert_id,
                'days_overdue' => now()->diffInDays($workflow->next_review_date)
            ],
            'risk_scores_detail' => $workflow->alert->risk_scores_detail,
            'title' => 'Follow-up Overdue',
            'message' => 'Scheduled follow-up for previous alert is overdue.',
            'clinical_recommendations' => ['Contact patient', 'Review previous intervention outcomes'],
            'intervention_options' => ['follow_up_assessment', 'intervention_review']
        ]);

        AlertWorkflow::create([
            'alert_id' => $alert->id,
            'beneficiary_id' => $workflow->beneficiary_id,
            'action_type' => 'alert_created',
            'action_description' => 'Follow-up alert generated for overdue review',
            'performed_by' => null
        ]);
    }

    /**
     * Update SLA statuses
     */
    private function updateSlaStatuses(): void
    {
        ClinicalAlert::active()
            ->where('sla_breached', false)
            ->where('sla_deadline', '<', now())
            ->update(['sla_breached' => true]);
    }

    /**
     * Send critical alert notifications
     */
    private function sendCriticalAlertNotifications(ClinicalAlert $alert): void
    {
        // Get users with appropriate roles
        $notifyUsers = \App\Models\User::role(['clinical_admin', 'clinical_staff'])
            ->where('is_active', true)
            ->get();

        if ($notifyUsers->isNotEmpty()) {
            try {
                Notification::send($notifyUsers, new CriticalHealthAlertNotification($alert));
            } catch (\Exception $e) {
                Log::error('Failed to send critical alert notifications', [
                    'alert_id' => $alert->id,
                    'error' => $e->getMessage()
                ]);
            }
        }
    }

    // Helper methods

    private function extractPhq9Score(HealthQuestionnaire $questionnaire): ?int
    {
        $responses = $questionnaire->responses ?? [];
        $score = 0;
        
        for ($i = 1; $i <= 9; $i++) {
            $score += $responses["phq9_{$i}"] ?? 0;
        }
        
        return $score;
    }

    private function extractGad7Score(HealthQuestionnaire $questionnaire): ?int
    {
        $responses = $questionnaire->responses ?? [];
        $score = 0;
        
        for ($i = 1; $i <= 7; $i++) {
            $score += $responses["gad7_{$i}"] ?? 0;
        }
        
        return $score;
    }

    private function extractAuditCScore(HealthQuestionnaire $questionnaire): ?int
    {
        $responses = $questionnaire->responses ?? [];
        
        return ($responses['audit_c_1'] ?? 0) + 
               ($responses['audit_c_2'] ?? 0) + 
               ($responses['audit_c_3'] ?? 0);
    }

    private function mapRiskCategory(string $category): string
    {
        $mapping = [
            'cardiovascular' => 'cardiovascular',
            'mental_health' => 'mental_health',
            'substance_abuse' => 'substance_abuse',
            'chronic_disease' => 'chronic_disease',
            'allergy_risk' => 'allergy_safety',
            'safety_risk' => 'allergy_safety'
        ];

        return $mapping[$category] ?? 'preventive_care';
    }

    private function getSafetyRecommendations(array $flags, int $score): array
    {
        $recommendations = [];

        if (in_array('suicide_risk', $flags)) {
            $recommendations[] = 'Immediate psychiatric evaluation required';
            $recommendations[] = 'Activate crisis intervention protocol';
            $recommendations[] = 'Ensure 24/7 crisis hotline access';
        }

        if (in_array('current_violence_exposure', $flags)) {
            $recommendations[] = 'Activate domestic violence protocol';
            $recommendations[] = 'Provide safety resources and shelter information';
            $recommendations[] = 'Consider law enforcement involvement if appropriate';
        }

        if ($score >= 35) {
            $recommendations[] = 'Comprehensive safety assessment needed';
            $recommendations[] = 'Develop safety plan with patient';
        }

        return $recommendations;
    }

    private function getMentalHealthRecommendations(array $flags, int $score): array
    {
        $recommendations = [];

        if (in_array('severe_depression', $flags)) {
            $recommendations[] = 'Urgent psychiatric referral';
            $recommendations[] = 'Consider medication evaluation';
            $recommendations[] = 'Intensive outpatient program evaluation';
        }

        if (in_array('severe_anxiety', $flags)) {
            $recommendations[] = 'Anxiety disorder assessment';
            $recommendations[] = 'Consider CBT referral';
            $recommendations[] = 'Evaluate need for anxiolytic medication';
        }

        if ($score >= 25) {
            $recommendations[] = 'Mental health professional consultation within 48 hours';
            $recommendations[] = 'Regular therapy sessions recommended';
        }

        return $recommendations;
    }

    private function getSubstanceAbuseRecommendations(array $flags, int $score): array
    {
        $recommendations = [];

        if (in_array('high_risk_alcohol_use', $flags)) {
            $recommendations[] = 'SBIRT (Screening, Brief Intervention, Referral to Treatment)';
            $recommendations[] = 'Consider alcohol cessation program';
            $recommendations[] = 'Medical evaluation for withdrawal risk';
        }

        if (in_array('illegal_drug_use', $flags)) {
            $recommendations[] = 'Substance abuse counseling referral';
            $recommendations[] = 'Consider MAT (Medication-Assisted Treatment)';
            $recommendations[] = 'Harm reduction education';
        }

        if ($score >= 30) {
            $recommendations[] = 'Comprehensive substance use assessment';
            $recommendations[] = 'Consider intensive outpatient or inpatient treatment';
        }

        return $recommendations;
    }

    private function getCardiovascularRecommendations(int $score): array
    {
        $riskFactorCount = intval($score / 12);
        $recommendations = [];

        if ($riskFactorCount >= 5) {
            $recommendations[] = 'Urgent cardiology referral';
            $recommendations[] = 'Comprehensive cardiovascular screening';
        }

        $recommendations[] = 'Lifestyle modification counseling';
        $recommendations[] = 'Nutritional consultation';
        $recommendations[] = 'Exercise program development';
        $recommendations[] = 'Regular blood pressure monitoring';

        if ($riskFactorCount >= 3) {
            $recommendations[] = 'Consider statin therapy evaluation';
            $recommendations[] = 'Diabetes screening if not done';
        }

        return $recommendations;
    }

    private function getCombinedRiskRecommendations(array $riskScores): array
    {
        return [
            'Multidisciplinary team review required',
            'Comprehensive care plan development',
            'Case management enrollment',
            'Regular monitoring and follow-up schedule',
            'Patient education on multiple risk factors',
            'Family/caregiver involvement if appropriate'
        ];
    }
}