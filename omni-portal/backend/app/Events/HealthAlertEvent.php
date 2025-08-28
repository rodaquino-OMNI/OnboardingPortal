<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;
use App\Models\HealthQuestionnaire;

/**
 * Health Alert Event for real-time health notifications
 * Broadcasts critical health alerts to admin dashboard
 */
class HealthAlertEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $alertData;
    public $severity;
    public $userId;
    public $timestamp;
    public $metadata;

    /**
     * Create a new event instance.
     */
    public function __construct(
        array $alertData,
        string $severity = 'medium',
        ?int $userId = null,
        ?array $metadata = null
    ) {
        $this->alertData = $alertData;
        $this->severity = $severity;
        $this->userId = $userId;
        $this->timestamp = now()->toISOString();
        $this->metadata = $metadata ?? [];
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('admin.health-alerts'),
            new PrivateChannel('health.alerts.' . $this->userId),
        ];
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => uniqid('alert_', true),
            'type' => $this->severity === 'critical' ? 'critical' : 'warning',
            'category' => 'health',
            'title' => $this->alertData['title'] ?? 'Health Alert',
            'message' => $this->alertData['message'] ?? 'Health condition requires attention',
            'timestamp' => $this->timestamp,
            'priority' => $this->severity,
            'resolved' => false,
            'source' => 'health_questionnaire',
            'actionRequired' => in_array($this->severity, ['critical', 'high']),
            'autoResolve' => $this->severity === 'low',
            'escalationLevel' => $this->getEscalationLevel(),
            'userId' => $this->userId,
            'metadata' => array_merge($this->metadata, [
                'questionnaire_id' => $this->alertData['questionnaire_id'] ?? null,
                'health_scores' => $this->alertData['health_scores'] ?? null,
                'risk_factors' => $this->alertData['risk_factors'] ?? [],
                'recommended_actions' => $this->alertData['recommended_actions'] ?? [],
            ])
        ];
    }

    /**
     * Get the broadcast event name.
     */
    public function broadcastAs(): string
    {
        return 'health.alert';
    }

    /**
     * Determine if this event should broadcast.
     */
    public function shouldBroadcast(): bool
    {
        // Only broadcast for medium, high, and critical severity
        return in_array($this->severity, ['medium', 'high', 'critical']);
    }

    /**
     * Get escalation level based on severity
     */
    private function getEscalationLevel(): int
    {
        return match($this->severity) {
            'critical' => 3,
            'high' => 2,
            'medium' => 1,
            default => 0,
        };
    }

    /**
     * Create health alert from questionnaire
     */
    public static function fromQuestionnaire(
        HealthQuestionnaire $questionnaire, 
        array $healthScores,
        string $severity = 'medium'
    ): self {
        $alertData = [
            'title' => 'Health Assessment Alert',
            'message' => self::generateAlertMessage($healthScores, $severity),
            'questionnaire_id' => $questionnaire->id,
            'health_scores' => $healthScores,
            'risk_factors' => self::identifyRiskFactors($healthScores),
            'recommended_actions' => self::getRecommendedActions($healthScores, $severity)
        ];

        $metadata = [
            'questionnaire_type' => $questionnaire->questionnaire_type,
            'submitted_at' => $questionnaire->created_at->toISOString(),
            'user_demographics' => [
                'age_group' => $questionnaire->age ?? 'unknown',
                'gender' => $questionnaire->gender ?? 'unknown'
            ]
        ];

        return new self($alertData, $severity, $questionnaire->user_id, $metadata);
    }

    /**
     * Generate alert message based on health scores
     */
    private static function generateAlertMessage(array $healthScores, string $severity): string
    {
        $messages = [
            'critical' => [
                'Severe mental health symptoms detected requiring immediate attention',
                'Critical health risk identified in patient assessment',
                'Urgent intervention required based on questionnaire responses'
            ],
            'high' => [
                'Significant health concerns identified in assessment',
                'Elevated risk factors detected requiring clinical review',
                'Multiple concerning symptoms reported by patient'
            ],
            'medium' => [
                'Moderate health concerns detected in questionnaire',
                'Patient responses indicate potential health risks',
                'Clinical evaluation recommended based on assessment'
            ]
        ];

        $categoryMessages = $messages[$severity] ?? $messages['medium'];
        return $categoryMessages[array_rand($categoryMessages)];
    }

    /**
     * Identify risk factors from health scores
     */
    private static function identifyRiskFactors(array $healthScores): array
    {
        $riskFactors = [];

        if (isset($healthScores['phq9_score']) && $healthScores['phq9_score'] >= 15) {
            $riskFactors[] = 'Severe Depression (PHQ-9)';
        } elseif (isset($healthScores['phq9_score']) && $healthScores['phq9_score'] >= 10) {
            $riskFactors[] = 'Moderate Depression (PHQ-9)';
        }

        if (isset($healthScores['gad7_score']) && $healthScores['gad7_score'] >= 15) {
            $riskFactors[] = 'Severe Anxiety (GAD-7)';
        } elseif (isset($healthScores['gad7_score']) && $healthScores['gad7_score'] >= 10) {
            $riskFactors[] = 'Moderate Anxiety (GAD-7)';
        }

        if (isset($healthScores['suicide_risk']) && $healthScores['suicide_risk'] === 'high') {
            $riskFactors[] = 'Suicide Risk Indicators';
        }

        if (isset($healthScores['substance_use']) && $healthScores['substance_use'] === 'concerning') {
            $riskFactors[] = 'Substance Use Concerns';
        }

        return $riskFactors;
    }

    /**
     * Get recommended actions based on health scores and severity
     */
    private static function getRecommendedActions(array $healthScores, string $severity): array
    {
        $actions = [];

        if ($severity === 'critical') {
            $actions[] = 'Contact patient immediately for crisis intervention';
            $actions[] = 'Schedule urgent psychiatric evaluation';
            $actions[] = 'Consider emergency department referral if needed';
        } elseif ($severity === 'high') {
            $actions[] = 'Schedule clinical assessment within 48 hours';
            $actions[] = 'Initiate care coordination with mental health team';
            $actions[] = 'Provide crisis resources and support contacts';
        } else {
            $actions[] = 'Schedule follow-up appointment within one week';
            $actions[] = 'Review questionnaire results with patient';
            $actions[] = 'Consider referral to appropriate specialists';
        }

        return $actions;
    }
}