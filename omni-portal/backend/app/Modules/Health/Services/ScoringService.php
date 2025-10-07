<?php

namespace App\Modules\Health\Services;

/**
 * Scoring Service - Deterministic Clinical Risk Scoring
 *
 * Implements clinical scoring algorithms from ground truth documentation:
 * - PHQ-9 (Depression): 0-27 score range
 * - GAD-7 (Anxiety): 0-21 score range
 * - AUDIT-C (Alcohol): 0-12 score range
 * - Safety triggers: Suicide ideation, violence risk
 * - Allergy risks: Anaphylaxis without EpiPen
 *
 * DETERMINISTIC GUARANTEE:
 * Same answers ALWAYS produce same score (no randomness, no external API calls)
 *
 * PHI Protection:
 * - NEVER returns raw answers
 * - Only returns: band (low/moderate/high/critical), category scores, boolean flags
 * - NO free text content
 * - NO answer values
 */
class ScoringService
{
    /**
     * Risk bands (points-based thresholds)
     */
    private const RISK_BANDS = [
        'low' => [0, 30],
        'moderate' => [31, 70],
        'high' => [71, 120],
        'critical' => [121, PHP_INT_MAX],
    ];

    /**
     * PHQ-9 Depression scoring ranges
     */
    private const PHQ9_RANGES = [
        [0, 4, 0],      // Minimal depression -> 0 points
        [5, 9, 10],     // Mild depression -> 10 points
        [10, 14, 20],   // Moderate depression -> 20 points
        [15, 19, 40],   // Moderately severe -> 40 points
        [20, 27, 60],   // Severe depression -> 60 points
    ];

    /**
     * GAD-7 Anxiety scoring ranges
     */
    private const GAD7_RANGES = [
        [0, 4, 0],      // Minimal anxiety -> 0 points
        [5, 9, 10],     // Mild anxiety -> 10 points
        [10, 14, 20],   // Moderate anxiety -> 20 points
        [15, 21, 40],   // Severe anxiety -> 40 points
    ];

    /**
     * AUDIT-C Alcohol use scoring ranges
     */
    private const AUDITC_RANGES = [
        [0, 2, 0],      // Low risk -> 0 points
        [3, 4, 10],     // Moderate risk -> 10 points
        [5, 7, 20],     // High risk -> 20 points
        [8, 12, 40],    // Very high risk -> 40 points
    ];

    /**
     * Safety trigger points
     */
    private const SAFETY_TRIGGERS = [
        'suicide_ideation' => 50,           // Critical - immediate intervention
        'violence_risk' => 30,              // High - safety planning needed
        'self_harm' => 25,                  // High - intervention needed
        'anaphylaxis_no_epipen' => 60,      // Critical - medical urgency
        'severe_allergy_no_plan' => 20,     // Moderate - care coordination needed
    ];

    /**
     * Calculate comprehensive risk score
     *
     * DETERMINISTIC: Same answers always produce same score
     *
     * @param array $answers User's questionnaire answers
     * @return array ['score_redacted' => int, 'risk_band' => string, 'categories' => array]
     */
    public function calculateRiskScore(array $answers): array
    {
        $totalPoints = 0;
        $categories = [];

        // 1. PHQ-9 Depression Score
        $phq9Score = $this->calculatePHQ9($answers);
        $phq9Points = $this->mapScoreToPoints($phq9Score, self::PHQ9_RANGES);
        $totalPoints += $phq9Points;
        $categories['depression'] = [
            'raw_score' => $phq9Score,
            'risk_points' => $phq9Points,
            'severity' => $this->getPHQ9Severity($phq9Score),
        ];

        // 2. GAD-7 Anxiety Score
        $gad7Score = $this->calculateGAD7($answers);
        $gad7Points = $this->mapScoreToPoints($gad7Score, self::GAD7_RANGES);
        $totalPoints += $gad7Points;
        $categories['anxiety'] = [
            'raw_score' => $gad7Score,
            'risk_points' => $gad7Points,
            'severity' => $this->getGAD7Severity($gad7Score),
        ];

        // 3. AUDIT-C Alcohol Use Score
        $auditcScore = $this->calculateAUDITC($answers);
        $auditcPoints = $this->mapScoreToPoints($auditcScore, self::AUDITC_RANGES);
        $totalPoints += $auditcPoints;
        $categories['alcohol_use'] = [
            'raw_score' => $auditcScore,
            'risk_points' => $auditcPoints,
            'severity' => $this->getAUDITCSeverity($auditcScore),
        ];

        // 4. Safety Triggers (critical risk factors)
        $safetyTriggers = $this->evaluateSafetyTriggers($answers);
        $safetyPoints = array_sum(array_values($safetyTriggers));
        $totalPoints += $safetyPoints;
        $categories['safety_triggers'] = $safetyTriggers;

        // 5. Allergy Risks
        $allergyRisks = $this->evaluateAllergyRisks($answers);
        $allergyPoints = array_sum(array_values($allergyRisks));
        $totalPoints += $allergyPoints;
        $categories['allergy_risks'] = $allergyRisks;

        // Determine risk band
        $riskBand = $this->determineRiskBand($totalPoints);

        return [
            'score_redacted' => $totalPoints,
            'risk_band' => $riskBand,
            'categories' => $categories,
            'recommendations' => $this->generateRecommendations($riskBand, $categories),
        ];
    }

    /**
     * Redact score data for analytics (remove all PHI)
     *
     * @param array $score Full score data
     * @return array Redacted score suitable for analytics
     */
    public function redactForAnalytics(array $score): array
    {
        return [
            'risk_band' => $score['risk_band'],
            'has_depression_risk' => ($score['categories']['depression']['risk_points'] ?? 0) > 0,
            'has_anxiety_risk' => ($score['categories']['anxiety']['risk_points'] ?? 0) > 0,
            'has_alcohol_risk' => ($score['categories']['alcohol_use']['risk_points'] ?? 0) > 0,
            'has_safety_triggers' => !empty($score['categories']['safety_triggers'] ?? []),
            'has_allergy_risks' => !empty($score['categories']['allergy_risks'] ?? []),
            'total_risk_points_band' => $this->getPointsBand($score['score_redacted']),
        ];
    }

    /**
     * Calculate PHQ-9 depression score (0-27)
     */
    private function calculatePHQ9(array $answers): int
    {
        $score = 0;
        $phq9Questions = ['phq9_q1', 'phq9_q2', 'phq9_q3', 'phq9_q4', 'phq9_q5',
                         'phq9_q6', 'phq9_q7', 'phq9_q8', 'phq9_q9'];

        foreach ($phq9Questions as $question) {
            $score += (int) ($answers[$question] ?? 0);
        }

        return min($score, 27); // Cap at maximum
    }

    /**
     * Calculate GAD-7 anxiety score (0-21)
     */
    private function calculateGAD7(array $answers): int
    {
        $score = 0;
        $gad7Questions = ['gad7_q1', 'gad7_q2', 'gad7_q3', 'gad7_q4', 'gad7_q5', 'gad7_q6', 'gad7_q7'];

        foreach ($gad7Questions as $question) {
            $score += (int) ($answers[$question] ?? 0);
        }

        return min($score, 21); // Cap at maximum
    }

    /**
     * Calculate AUDIT-C alcohol use score (0-12)
     */
    private function calculateAUDITC(array $answers): int
    {
        $score = 0;
        $auditcQuestions = ['auditc_q1', 'auditc_q2', 'auditc_q3'];

        foreach ($auditcQuestions as $question) {
            $score += (int) ($answers[$question] ?? 0);
        }

        return min($score, 12); // Cap at maximum
    }

    /**
     * Evaluate safety triggers (suicide, violence, self-harm)
     */
    private function evaluateSafetyTriggers(array $answers): array
    {
        $triggers = [];

        // PHQ-9 Question 9: Suicide ideation
        if (($answers['phq9_q9'] ?? 0) > 0) {
            $triggers['suicide_ideation'] = self::SAFETY_TRIGGERS['suicide_ideation'];
        }

        // Violence risk question
        if (($answers['violence_risk'] ?? 'no') === 'yes') {
            $triggers['violence_risk'] = self::SAFETY_TRIGGERS['violence_risk'];
        }

        // Self-harm question
        if (($answers['self_harm'] ?? 'no') === 'yes') {
            $triggers['self_harm'] = self::SAFETY_TRIGGERS['self_harm'];
        }

        return $triggers;
    }

    /**
     * Evaluate allergy risks
     */
    private function evaluateAllergyRisks(array $answers): array
    {
        $risks = [];

        // Anaphylaxis risk without EpiPen
        $hasAnaphylaxis = ($answers['has_anaphylaxis'] ?? 'no') === 'yes';
        $hasEpiPen = ($answers['has_epipen'] ?? 'no') === 'yes';

        if ($hasAnaphylaxis && !$hasEpiPen) {
            $risks['anaphylaxis_no_epipen'] = self::SAFETY_TRIGGERS['anaphylaxis_no_epipen'];
        }

        // Severe allergy without action plan
        $hasSevereAllergy = ($answers['severe_allergy'] ?? 'no') === 'yes';
        $hasActionPlan = ($answers['allergy_action_plan'] ?? 'no') === 'yes';

        if ($hasSevereAllergy && !$hasActionPlan) {
            $risks['severe_allergy_no_plan'] = self::SAFETY_TRIGGERS['severe_allergy_no_plan'];
        }

        return $risks;
    }

    /**
     * Map clinical score to risk points
     */
    private function mapScoreToPoints(int $score, array $ranges): int
    {
        foreach ($ranges as [$min, $max, $points]) {
            if ($score >= $min && $score <= $max) {
                return $points;
            }
        }
        return 0;
    }

    /**
     * Determine risk band from total points
     */
    private function determineRiskBand(int $totalPoints): string
    {
        foreach (self::RISK_BANDS as $band => [$min, $max]) {
            if ($totalPoints >= $min && $totalPoints <= $max) {
                return $band;
            }
        }
        return 'critical'; // Default to critical for safety
    }

    /**
     * Get PHQ-9 severity label
     */
    private function getPHQ9Severity(int $score): string
    {
        return match (true) {
            $score <= 4 => 'minimal',
            $score <= 9 => 'mild',
            $score <= 14 => 'moderate',
            $score <= 19 => 'moderately_severe',
            default => 'severe',
        };
    }

    /**
     * Get GAD-7 severity label
     */
    private function getGAD7Severity(int $score): string
    {
        return match (true) {
            $score <= 4 => 'minimal',
            $score <= 9 => 'mild',
            $score <= 14 => 'moderate',
            default => 'severe',
        };
    }

    /**
     * Get AUDIT-C severity label
     */
    private function getAUDITCSeverity(int $score): string
    {
        return match (true) {
            $score <= 2 => 'low_risk',
            $score <= 4 => 'moderate_risk',
            $score <= 7 => 'high_risk',
            default => 'very_high_risk',
        };
    }

    /**
     * Get points band for analytics
     */
    private function getPointsBand(int $points): string
    {
        return match (true) {
            $points <= 10 => '0-10',
            $points <= 30 => '11-30',
            $points <= 70 => '31-70',
            $points <= 120 => '71-120',
            default => '121+',
        };
    }

    /**
     * Generate clinical recommendations based on risk profile
     */
    private function generateRecommendations(string $riskBand, array $categories): array
    {
        $recommendations = [];

        // Critical risk band
        if ($riskBand === 'critical') {
            $recommendations[] = 'Immediate clinical intervention recommended';
            $recommendations[] = 'Contact crisis hotline if experiencing emergency';
        }

        // Safety trigger recommendations
        if (!empty($categories['safety_triggers'])) {
            if (isset($categories['safety_triggers']['suicide_ideation'])) {
                $recommendations[] = 'Safety planning and crisis intervention needed';
                $recommendations[] = 'Consider psychiatric evaluation';
            }
            if (isset($categories['safety_triggers']['anaphylaxis_no_epipen'])) {
                $recommendations[] = 'Obtain EpiPen prescription immediately';
                $recommendations[] = 'Consult with allergist for action plan';
            }
        }

        // Depression recommendations
        $depressionSeverity = $categories['depression']['severity'] ?? 'minimal';
        if (in_array($depressionSeverity, ['moderate', 'moderately_severe', 'severe'])) {
            $recommendations[] = 'Consider evaluation for depression treatment';
        }

        // Anxiety recommendations
        $anxietySeverity = $categories['anxiety']['severity'] ?? 'minimal';
        if (in_array($anxietySeverity, ['moderate', 'severe'])) {
            $recommendations[] = 'Consider evaluation for anxiety management';
        }

        // Alcohol use recommendations
        $alcoholSeverity = $categories['alcohol_use']['severity'] ?? 'low_risk';
        if (in_array($alcoholSeverity, ['high_risk', 'very_high_risk'])) {
            $recommendations[] = 'Consider substance use counseling';
        }

        return $recommendations;
    }
}
