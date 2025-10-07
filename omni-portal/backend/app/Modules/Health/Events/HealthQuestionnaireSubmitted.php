<?php

namespace App\Modules\Health\Events;

use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * HealthQuestionnaireSubmitted - Domain event
 *
 * Emitted when user submits final questionnaire answers
 *
 * Payload:
 * - user_hash (SHA-256) - NO plaintext user ID
 * - version
 * - duration_ms
 * - risk_band (low/medium/high)
 * - score_redacted (bucketed)
 *
 * NO answers, NO free text, NO PHI
 *
 * This event triggers analytics persistence via PersistHealthAnalytics listener
 *
 * @see app/Modules/Health/Listeners/PersistHealthAnalytics.php
 * @see app/Http/Controllers/Api/Health/QuestionnaireController.php
 */
class HealthQuestionnaireSubmitted
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * User who submitted the questionnaire
     */
    public User $user;

    /**
     * Questionnaire response (minimal data)
     */
    public object $response;

    /**
     * Duration in seconds to complete questionnaire
     */
    public int $durationSeconds;

    /**
     * Event timestamp
     */
    public \Carbon\Carbon $timestamp;

    /**
     * Create a new event instance
     *
     * @param User $user User who submitted questionnaire
     * @param object $response Questionnaire response (must have version, risk_band, score_redacted)
     * @param int $durationSeconds Time taken to complete
     */
    public function __construct(User $user, object $response, int $durationSeconds)
    {
        $this->user = $user;
        $this->response = $response;
        $this->durationSeconds = $durationSeconds;
        $this->timestamp = now();
    }

    /**
     * Get hashed user ID for analytics
     *
     * @return string SHA-256 hash
     */
    public function getUserHash(): string
    {
        return hash('sha256', (string) $this->user->id);
    }

    /**
     * Get event payload for analytics (NO PHI)
     *
     * @return array
     */
    public function toAnalyticsPayload(): array
    {
        return [
            'user_hash' => $this->getUserHash(),
            'version' => $this->response->questionnaire->version,
            'duration_ms' => $this->durationSeconds * 1000,
            'risk_band' => $this->response->risk_band,
            'score_redacted' => $this->response->score_redacted,
            'timestamp' => $this->timestamp->toIso8601String(),
        ];
    }

    /**
     * Get duration in milliseconds
     *
     * @return int
     */
    public function getDurationMs(): int
    {
        return $this->durationSeconds * 1000;
    }
}
