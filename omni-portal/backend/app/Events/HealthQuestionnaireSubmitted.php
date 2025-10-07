<?php

namespace App\Events;

use App\Models\HealthQuestionnaire;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Health Questionnaire Submitted Event
 *
 * Triggered when a user completes and submits a health questionnaire
 *
 * PHI Protection:
 * - Event carries only metadata and score data
 * - NO raw answers included
 * - Used for downstream processing (AI analysis, alerts, gamification)
 */
class HealthQuestionnaireSubmitted
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public HealthQuestionnaire $questionnaire;
    public array $scoreData;

    /**
     * Create a new event instance.
     *
     * @param HealthQuestionnaire $questionnaire The submitted questionnaire (answers encrypted)
     * @param array $scoreData Score and risk assessment data
     */
    public function __construct(HealthQuestionnaire $questionnaire, array $scoreData)
    {
        // Ensure PHI is hidden
        $this->questionnaire = $questionnaire->makeHidden(['responses']);
        $this->scoreData = $scoreData;
    }

    /**
     * Get risk band from score data
     */
    public function getRiskBand(): string
    {
        return $this->scoreData['risk_band'] ?? 'unknown';
    }

    /**
     * Check if critical risk level
     */
    public function isCritical(): bool
    {
        return $this->getRiskBand() === 'critical';
    }

    /**
     * Get de-identified event data for logging
     */
    public function getAuditData(): array
    {
        return [
            'questionnaire_id' => $this->questionnaire->id,
            'user_hashed_id' => hash('sha256', $this->questionnaire->beneficiary_id),
            'risk_band' => $this->getRiskBand(),
            'score_redacted' => $this->scoreData['score_redacted'] ?? 0,
            'template_version' => $this->questionnaire->template?->version ?? null,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
