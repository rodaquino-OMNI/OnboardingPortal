<?php

namespace App\Modules\Health\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * HealthQuestionnaireReviewed - Domain event
 *
 * Emitted when admin reviews a questionnaire submission
 *
 * Payload:
 * - reviewer_id
 * - response_id
 * - review_status (approved, flagged, rejected)
 * - timestamp
 *
 * NO PHI in event payload
 *
 * @see app/Http/Controllers/Api/Health/QuestionnaireController.php
 */
class HealthQuestionnaireReviewed
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Reviewer user ID (admin)
     */
    public int $reviewerId;

    /**
     * Questionnaire response ID
     */
    public int $responseId;

    /**
     * Review status
     */
    public string $reviewStatus;

    /**
     * Event timestamp
     */
    public \Carbon\Carbon $timestamp;

    /**
     * Create a new event instance
     *
     * @param int $reviewerId Admin reviewer ID
     * @param int $responseId Response ID
     * @param string $reviewStatus Review status (approved, flagged, rejected)
     */
    public function __construct(int $reviewerId, int $responseId, string $reviewStatus)
    {
        $this->reviewerId = $reviewerId;
        $this->responseId = $responseId;
        $this->reviewStatus = $reviewStatus;
        $this->timestamp = now();
    }

    /**
     * Get event payload for analytics
     *
     * @return array
     */
    public function toAnalyticsPayload(): array
    {
        return [
            'reviewer_id' => $this->reviewerId,
            'response_id' => $this->responseId,
            'review_status' => $this->reviewStatus,
            'timestamp' => $this->timestamp->toIso8601String(),
        ];
    }
}
