<?php

namespace App\Modules\Health\Services;

use App\Models\HealthQuestionnaire;
use Illuminate\Support\Facades\Log;

/**
 * Export Service - PHI-Safe Data Export for Health Plans
 *
 * Security Features:
 * - SUPPRESSES all answer content
 * - SUPPRESSES user identifiers (uses hashed IDs only)
 * - Includes only aggregated, de-identified data
 * - NO raw answers exposed in any export format
 * - PDF reports contain only risk bands and recommendations
 *
 * Use Cases:
 * - Health plan integration (aggregated data only)
 * - Clinical reports (risk assessment without PHI)
 * - Analytics exports (de-identified metrics)
 */
class ExportService
{
    public function __construct(
        private ScoringService $scoringService
    ) {}

    /**
     * Export questionnaire for health plan integration
     *
     * Returns:
     * - Version and timestamp
     * - Score (redacted/aggregated)
     * - Risk band (low/moderate/high/critical)
     * - Recommendations (clinical guidance)
     *
     * SUPPRESSES:
     * - All answer content
     * - User identifiers (uses SHA-256 hashed ID)
     * - Free text responses
     * - Any PHI
     *
     * @param HealthQuestionnaire $response Questionnaire response
     * @return array De-identified export data
     */
    public function exportForHealthPlan(HealthQuestionnaire $response): array
    {
        // Audit log - NO PHI
        Log::channel('audit')->info('health_plan_export', [
            'questionnaire_id' => $response->id,
            'user_hashed_id' => hash('sha256', $response->beneficiary_id),
            'risk_band' => $response->risk_level,
            'timestamp' => now()->toIso8601String(),
        ]);

        // Get redacted score data
        $scoreData = $response->risk_scores ?? [];
        $redactedScore = $this->scoringService->redactForAnalytics([
            'score_redacted' => $response->score ?? 0,
            'risk_band' => $response->risk_level ?? 'unknown',
            'categories' => $scoreData,
        ]);

        return [
            // De-identified user reference
            'patient_hash' => hash('sha256', $response->beneficiary_id),

            // Questionnaire metadata
            'questionnaire_version' => $response->template?->version ?? 1,
            'questionnaire_type' => $response->questionnaire_type ?? 'comprehensive',
            'completed_at' => $response->completed_at?->toIso8601String(),

            // Risk assessment (aggregated only)
            'risk_band' => $response->risk_level ?? 'unknown',
            'risk_assessment' => $redactedScore,

            // Clinical recommendations (no PHI)
            'recommendations' => $response->recommendations ?? [],
            'follow_up_required' => $response->follow_up_required ?? false,
            'follow_up_timeframe' => $this->getFollowUpTimeframe($response->risk_level),

            // Flags (boolean only)
            'flags' => [
                'has_safety_concerns' => $redactedScore['has_safety_triggers'] ?? false,
                'has_allergy_risks' => $redactedScore['has_allergy_risks'] ?? false,
                'requires_urgent_attention' => $response->risk_level === 'critical',
            ],

            // Export metadata
            'export_timestamp' => now()->toIso8601String(),
            'data_classification' => 'de-identified',
            'phi_removed' => true,
        ];
    }

    /**
     * Generate clinical report (PDF-ready format)
     *
     * Returns formatted data for PDF generation:
     * - Risk band visualization
     * - Clinical recommendations
     * - Next steps for patient
     * - Disclaimer about score interpretation
     *
     * NO raw answers exposed
     * NO user identifiers included
     *
     * @param HealthQuestionnaire $response Questionnaire response
     * @return string PDF-ready HTML content
     */
    public function generateClinicalReport(HealthQuestionnaire $response): string
    {
        // Audit log
        Log::channel('audit')->info('clinical_report_generation', [
            'questionnaire_id' => $response->id,
            'user_hashed_id' => hash('sha256', $response->beneficiary_id),
            'timestamp' => now()->toIso8601String(),
        ]);

        $riskBand = $response->risk_level ?? 'unknown';
        $riskColor = $this->getRiskBandColor($riskBand);
        $recommendations = $response->recommendations ?? [];

        // Build HTML report (no PHI)
        $html = <<<HTML
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Health Risk Assessment Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .risk-badge {
                    display: inline-block;
                    padding: 10px 20px;
                    background: {$riskColor};
                    color: white;
                    border-radius: 5px;
                    font-size: 18px;
                    font-weight: bold;
                }
                .section { margin: 20px 0; }
                .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
                .recommendation {
                    padding: 10px;
                    margin: 5px 0;
                    background: #f5f5f5;
                    border-left: 4px solid #007bff;
                }
                .disclaimer {
                    margin-top: 40px;
                    padding: 15px;
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                    font-size: 12px;
                }
                .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Health Risk Assessment Report</h1>
                <p>Generated: {$response->completed_at?->format('F d, Y')}</p>
                <div class="risk-badge">{$this->getRiskBandLabel($riskBand)}</div>
            </div>

            <div class="section">
                <div class="section-title">Risk Assessment Summary</div>
                <p>Based on your health questionnaire responses, your overall risk level has been assessed as <strong>{$riskBand}</strong>.</p>
            </div>

            <div class="section">
                <div class="section-title">Clinical Recommendations</div>
        HTML;

        if (!empty($recommendations)) {
            foreach ($recommendations as $recommendation) {
                $html .= "<div class=\"recommendation\">{$recommendation}</div>\n";
            }
        } else {
            $html .= "<p>No specific recommendations at this time. Continue with routine health maintenance.</p>";
        }

        $html .= <<<HTML
            </div>

            <div class="section">
                <div class="section-title">Next Steps</div>
                <ul>
                    {$this->generateNextSteps($riskBand)}
                </ul>
            </div>

            <div class="disclaimer">
                <strong>Important Disclaimer:</strong> This report is a screening tool only and does not constitute
                a medical diagnosis. The risk assessment is based on standardized questionnaires and should be
                reviewed by a qualified healthcare professional. If you are experiencing a medical emergency,
                please call emergency services immediately.
            </div>

            <div class="footer">
                <p>This report contains de-identified health risk assessment data.</p>
                <p>Report ID: {$response->id} | Version: {$response->template?->version ?? 1}</p>
            </div>
        </body>
        </html>
        HTML;

        return $html;
    }

    /**
     * Get risk band color for visualization
     */
    private function getRiskBandColor(string $band): string
    {
        return match ($band) {
            'low' => '#28a745',
            'moderate' => '#ffc107',
            'high' => '#fd7e14',
            'critical' => '#dc3545',
            default => '#6c757d',
        };
    }

    /**
     * Get risk band label
     */
    private function getRiskBandLabel(string $band): string
    {
        return match ($band) {
            'low' => 'Low Risk',
            'moderate' => 'Moderate Risk',
            'high' => 'High Risk',
            'critical' => 'Critical Risk',
            default => 'Unknown',
        };
    }

    /**
     * Get follow-up timeframe based on risk level
     */
    private function getFollowUpTimeframe(string $riskBand): string
    {
        return match ($riskBand) {
            'critical' => 'within_24_hours',
            'high' => 'within_1_week',
            'moderate' => 'within_1_month',
            'low' => 'routine_followup',
            default => 'as_needed',
        };
    }

    /**
     * Generate next steps HTML based on risk band
     */
    private function generateNextSteps(string $riskBand): string
    {
        $steps = match ($riskBand) {
            'critical' => [
                'Contact your healthcare provider immediately',
                'If experiencing emergency, call crisis hotline or 911',
                'Share this report with your care team',
                'Follow safety planning recommendations',
            ],
            'high' => [
                'Schedule appointment with healthcare provider within 1 week',
                'Discuss risk factors identified in assessment',
                'Consider specialist referral if recommended',
                'Follow up on specific recommendations listed above',
            ],
            'moderate' => [
                'Schedule appointment with healthcare provider within 1 month',
                'Monitor symptoms and risk factors',
                'Implement lifestyle recommendations',
                'Follow up if symptoms worsen',
            ],
            'low' => [
                'Continue routine health maintenance',
                'Schedule annual wellness visit',
                'Maintain healthy lifestyle habits',
                'Contact provider if new symptoms develop',
            ],
            default => [
                'Consult with healthcare provider for guidance',
                'Complete any pending health assessments',
            ],
        };

        return implode("\n", array_map(fn($step) => "<li>{$step}</li>", $steps));
    }
}
