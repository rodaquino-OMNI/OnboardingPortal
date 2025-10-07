<?php

namespace App\Modules\Health\Events;

use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * HealthQuestionnaireStarted - Domain event
 *
 * Emitted when user first loads questionnaire schema
 *
 * Payload:
 * - user_hash (SHA-256) - NO plaintext user ID
 * - questionnaire_id
 * - version
 * - timestamp
 *
 * NO PHI in event payload
 *
 * @see app/Http/Controllers/Api/Health/QuestionnaireController.php
 */
class HealthQuestionnaireStarted
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * User who started the questionnaire
     */
    public User $user;

    /**
     * Questionnaire ID
     */
    public int $questionnaireId;

    /**
     * Questionnaire version
     */
    public int $version;

    /**
     * Event timestamp
     */
    public \Carbon\Carbon $timestamp;

    /**
     * Create a new event instance
     *
     * @param User $user User who started questionnaire
     * @param int $questionnaireId Questionnaire ID
     * @param int $version Questionnaire version
     */
    public function __construct(User $user, int $questionnaireId, int $version)
    {
        $this->user = $user;
        $this->questionnaireId = $questionnaireId;
        $this->version = $version;
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
            'questionnaire_id' => $this->questionnaireId,
            'version' => $this->version,
            'timestamp' => $this->timestamp->toIso8601String(),
        ];
    }
}
