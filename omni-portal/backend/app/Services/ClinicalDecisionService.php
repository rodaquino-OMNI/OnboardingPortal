<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class ClinicalDecisionService
{
    /**
     * Analyze questionnaire responses and generate clinical decisions
     */
    public function analyzeResponses(array $responses): array
    {
        $clinicalDecisions = [];
        
        // Analyze PHQ-9 (Depression Screening)
        $phq9Analysis = $this->analyzePHQ9($responses);
        if ($phq9Analysis) {
            $clinicalDecisions[] = $phq9Analysis;
        }
        
        // Analyze GAD-7 (Anxiety Screening) 
        $gad7Analysis = $this->analyzeGAD7($responses);
        if ($gad7Analysis) {
            $clinicalDecisions[] = $gad7Analysis;
        }
        
        // Check for emergency situations
        $emergencyAnalysis = $this->checkEmergencyIndicators($responses);
        if ($emergencyAnalysis['emergency_detected']) {
            $clinicalDecisions[] = $emergencyAnalysis;
        }
        
        return [
            'clinical_decisions' => $clinicalDecisions,
            'overall_risk_level' => $this->calculateOverallRisk($clinicalDecisions),
            'recommended_interventions' => $this->generateInterventions($clinicalDecisions),
            'analysis_timestamp' => now()->toISOString()
        ];
    }
    
    /**
     * Analyze PHQ-9 Depression Screening
     */
    private function analyzePHQ9(array $responses): ?array
    {
        $phq9Questions = ['phq9_1', 'phq9_2', 'phq9_3', 'phq9_4', 'phq9_5', 'phq9_6', 'phq9_7', 'phq9_8', 'phq9_9'];
        
        $totalScore = 0;
        $answeredQuestions = 0;
        
        foreach ($phq9Questions as $question) {
            if (isset($responses[$question]) && is_numeric($responses[$question])) {
                $totalScore += (int) $responses[$question];
                $answeredQuestions++;
            }
        }
        
        // Need at least 7 questions answered for valid analysis
        if ($answeredQuestions < 7) {
            return null;
        }
        
        // Suicide risk assessment (PHQ-9 item 9)
        $suicideRisk = isset($responses['phq9_9']) ? (int) $responses['phq9_9'] : 0;
        
        $severity = $this->getDepressionSeverity($totalScore);
        $icd10Code = $this->getDepressionICD10($totalScore, $suicideRisk);
        
        return [
            'condition' => 'Depression Screening',
            'tool_used' => 'PHQ-9',
            'total_score' => $totalScore,
            'severity' => $severity,
            'icd10_code' => $icd10Code,
            'suicide_risk_level' => $suicideRisk,
            'confidence_score' => $this->calculateConfidence($answeredQuestions, 9, $totalScore),
            'recommendations' => $this->getDepressionRecommendations($severity, $suicideRisk),
            'emergency_required' => $suicideRisk > 0,
            'time_to_intervention' => $this->getTimeToIntervention($severity, $suicideRisk)
        ];
    }
    
    /**
     * Analyze GAD-7 Anxiety Screening
     */
    private function analyzeGAD7(array $responses): ?array
    {
        $gad7Questions = ['gad7_1', 'gad7_2', 'gad7_3', 'gad7_4', 'gad7_5', 'gad7_6', 'gad7_7'];
        
        $totalScore = 0;
        $answeredQuestions = 0;
        
        foreach ($gad7Questions as $question) {
            if (isset($responses[$question]) && is_numeric($responses[$question])) {
                $totalScore += (int) $responses[$question];
                $answeredQuestions++;
            }
        }
        
        if ($answeredQuestions < 6) {
            return null;
        }
        
        $severity = $this->getAnxietySeverity($totalScore);
        $icd10Code = $this->getAnxietyICD10($totalScore);
        
        return [
            'condition' => 'Anxiety Screening',
            'tool_used' => 'GAD-7',
            'total_score' => $totalScore,
            'severity' => $severity,
            'icd10_code' => $icd10Code,
            'confidence_score' => $this->calculateConfidence($answeredQuestions, 7, $totalScore),
            'recommendations' => $this->getAnxietyRecommendations($severity),
            'emergency_required' => false,
            'time_to_intervention' => $this->getTimeToIntervention($severity)
        ];
    }
    
    /**
     * Check for emergency indicators
     */
    private function checkEmergencyIndicators(array $responses): array
    {
        $emergencyFlags = [];
        
        // Suicide ideation (PHQ-9 item 9)
        if (isset($responses['phq9_9']) && $responses['phq9_9'] > 0) {
            $emergencyFlags[] = [
                'type' => 'suicide_ideation',
                'severity' => $responses['phq9_9'] >= 2 ? 'critical' : 'high',
                'source' => 'PHQ-9 Item 9',
                'value' => $responses['phq9_9']
            ];
        }
        
        // Self-harm indicators
        if (isset($responses['self_harm']) && $responses['self_harm'] === true) {
            $emergencyFlags[] = [
                'type' => 'self_harm',
                'severity' => 'critical',
                'source' => 'Direct Question',
                'value' => true
            ];
        }
        
        $emergencyDetected = !empty($emergencyFlags);
        
        return [
            'emergency_detected' => $emergencyDetected,
            'emergency_flags' => $emergencyFlags,
            'emergency_protocol' => $emergencyDetected ? $this->getEmergencyProtocol($emergencyFlags) : null,
            'emergency_timestamp' => $emergencyDetected ? now()->toISOString() : null
        ];
    }
    
    /**
     * Get depression severity based on PHQ-9 score
     */
    private function getDepressionSeverity(int $score): string
    {
        if ($score >= 20) return 'severe';
        if ($score >= 15) return 'moderately_severe';
        if ($score >= 10) return 'moderate';
        if ($score >= 5) return 'mild';
        return 'minimal';
    }
    
    /**
     * Get anxiety severity based on GAD-7 score
     */
    private function getAnxietySeverity(int $score): string
    {
        if ($score >= 15) return 'severe';
        if ($score >= 10) return 'moderate';
        if ($score >= 5) return 'mild';
        return 'minimal';
    }
    
    /**
     * Get ICD-10 code for depression
     */
    private function getDepressionICD10(int $score, int $suicideRisk): string
    {
        if ($suicideRisk > 0) {
            return 'F32.9'; // Major depressive disorder with suicidal ideation
        }
        
        if ($score >= 20) return 'F32.2'; // Major depressive disorder, severe
        if ($score >= 15) return 'F32.1'; // Major depressive disorder, moderate
        if ($score >= 10) return 'F32.0'; // Major depressive disorder, mild
        if ($score >= 5) return 'F32.9';  // Major depressive disorder, unspecified
        
        return 'Z13.89'; // Encounter for screening
    }
    
    /**
     * Get ICD-10 code for anxiety
     */
    private function getAnxietyICD10(int $score): string
    {
        if ($score >= 10) return 'F41.1'; // Generalized anxiety disorder
        if ($score >= 5) return 'F41.9';  // Anxiety disorder, unspecified
        
        return 'Z13.89'; // Encounter for screening
    }
    
    /**
     * Calculate confidence score
     */
    private function calculateConfidence(int $answered, int $total, int $score): int
    {
        $completionRate = ($answered / $total) * 100;
        $scoreReliability = min(100, ($score > 0 ? 80 : 60) + ($completionRate * 0.2));
        
        return (int) round($scoreReliability);
    }
    
    /**
     * Get time to intervention in hours
     */
    private function getTimeToIntervention(string $severity, int $suicideRisk = 0): int
    {
        if ($suicideRisk > 0) return 0; // Immediate
        
        switch ($severity) {
            case 'severe':
            case 'critical':
                return 24;
            case 'moderately_severe':
            case 'moderate':
                return 72;
            case 'mild':
                return 168; // 1 week
            default:
                return 720; // 30 days
        }
    }
    
    /**
     * Get depression recommendations
     */
    private function getDepressionRecommendations(string $severity, int $suicideRisk): array
    {
        $recommendations = [];
        
        if ($suicideRisk > 0) {
            $recommendations[] = [
                'type' => 'immediate',
                'action' => 'Emergency psychiatric evaluation',
                'priority' => 10,
                'timeframe' => 'Immediate'
            ];
            $recommendations[] = [
                'type' => 'immediate', 
                'action' => 'Safety plan development',
                'priority' => 9,
                'timeframe' => 'Within 1 hour'
            ];
        }
        
        switch ($severity) {
            case 'severe':
                $recommendations[] = [
                    'type' => 'urgent',
                    'action' => 'Psychiatric evaluation within 24-48 hours',
                    'priority' => 8,
                    'timeframe' => '24-48 hours'
                ];
                break;
            case 'moderate':
                $recommendations[] = [
                    'type' => 'routine',
                    'action' => 'Mental health counseling referral',
                    'priority' => 6,
                    'timeframe' => '1-2 weeks'
                ];
                break;
        }
        
        return $recommendations;
    }
    
    /**
     * Get anxiety recommendations
     */
    private function getAnxietyRecommendations(string $severity): array
    {
        $recommendations = [];
        
        switch ($severity) {
            case 'severe':
                $recommendations[] = [
                    'type' => 'urgent',
                    'action' => 'Anxiety disorder evaluation',
                    'priority' => 7,
                    'timeframe' => '1 week'
                ];
                break;
            case 'moderate':
                $recommendations[] = [
                    'type' => 'routine',
                    'action' => 'Cognitive behavioral therapy referral',
                    'priority' => 5,
                    'timeframe' => '2-3 weeks'
                ];
                break;
        }
        
        return $recommendations;
    }
    
    /**
     * Calculate overall risk level
     */
    private function calculateOverallRisk(array $decisions): string
    {
        $maxRisk = 'minimal';
        
        foreach ($decisions as $decision) {
            if (isset($decision['emergency_required']) && $decision['emergency_required']) {
                return 'critical';
            }
            
            $severity = $decision['severity'] ?? 'minimal';
            if ($severity === 'severe' && $maxRisk !== 'critical') {
                $maxRisk = 'severe';
            } elseif ($severity === 'moderate' && !in_array($maxRisk, ['severe', 'critical'])) {
                $maxRisk = 'moderate';
            } elseif ($severity === 'mild' && $maxRisk === 'minimal') {
                $maxRisk = 'mild';
            }
        }
        
        return $maxRisk;
    }
    
    /**
     * Generate intervention recommendations
     */
    private function generateInterventions(array $decisions): array
    {
        $interventions = [];
        
        foreach ($decisions as $decision) {
            if (isset($decision['recommendations'])) {
                $interventions = array_merge($interventions, $decision['recommendations']);
            }
        }
        
        // Sort by priority (highest first)
        usort($interventions, function($a, $b) {
            return ($b['priority'] ?? 0) - ($a['priority'] ?? 0);
        });
        
        return $interventions;
    }
    
    /**
     * Get emergency protocol
     */
    private function getEmergencyProtocol(array $flags): array
    {
        $highestSeverity = 'moderate';
        
        foreach ($flags as $flag) {
            if ($flag['severity'] === 'critical') {
                $highestSeverity = 'critical';
                break;
            } elseif ($flag['severity'] === 'high' && $highestSeverity !== 'critical') {
                $highestSeverity = 'high';
            }
        }
        
        return [
            'severity' => $highestSeverity,
            'immediate_actions' => [
                'Do not leave person alone',
                'Remove access to means of self-harm',
                'Contact emergency services if immediate danger'
            ],
            'contact_numbers' => [
                ['name' => 'CVV - Centro de Valorização da Vida', 'number' => '188', 'available_24h' => true],
                ['name' => 'SAMU', 'number' => '192', 'available_24h' => true],
                ['name' => 'Emergência Psiquiátrica', 'number' => '190', 'available_24h' => true]
            ],
            'follow_up_required' => true,
            'safety_plan' => [
                'Identify warning signs',
                'Create coping strategies', 
                'Identify support persons',
                'Remove or secure lethal means',
                'Create emergency contact list'
            ]
        ];
    }
}