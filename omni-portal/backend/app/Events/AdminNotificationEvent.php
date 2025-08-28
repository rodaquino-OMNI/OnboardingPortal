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

/**
 * Admin Notification Event for real-time admin alerts
 * Broadcasts system notifications to admin users
 */
class AdminNotificationEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $notificationData;
    public $category;
    public $priority;
    public $targetUsers;
    public $timestamp;
    public $metadata;

    /**
     * Create a new event instance.
     */
    public function __construct(
        array $notificationData,
        string $category = 'system',
        string $priority = 'medium',
        ?array $targetUsers = null,
        ?array $metadata = null
    ) {
        $this->notificationData = $notificationData;
        $this->category = $category;
        $this->priority = $priority;
        $this->targetUsers = $targetUsers;
        $this->timestamp = now()->toISOString();
        $this->metadata = $metadata ?? [];
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('admin.notifications'),
        ];

        // Add specific user channels if target users are specified
        if ($this->targetUsers) {
            foreach ($this->targetUsers as $userId) {
                $channels[] = new PrivateChannel('admin.notifications.' . $userId);
            }
        }

        // Add category-specific channels
        $channels[] = new PrivateChannel('admin.' . $this->category);

        return $channels;
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => uniqid('admin_notif_', true),
            'type' => $this->getNotificationType(),
            'category' => $this->category,
            'title' => $this->notificationData['title'] ?? 'Admin Notification',
            'message' => $this->notificationData['message'] ?? 'System notification',
            'timestamp' => $this->timestamp,
            'priority' => $this->priority,
            'resolved' => false,
            'source' => 'admin_system',
            'actionRequired' => in_array($this->priority, ['critical', 'high']),
            'autoResolve' => in_array($this->category, ['info', 'success']),
            'escalationLevel' => $this->getEscalationLevel(),
            'targetUsers' => $this->targetUsers,
            'metadata' => array_merge($this->metadata, [
                'notification_type' => $this->notificationData['type'] ?? 'general',
                'actions' => $this->notificationData['actions'] ?? [],
                'context' => $this->notificationData['context'] ?? null,
                'expires_at' => $this->notificationData['expires_at'] ?? null,
            ])
        ];
    }

    /**
     * Get the broadcast event name.
     */
    public function broadcastAs(): string
    {
        return 'admin.notification';
    }

    /**
     * Determine if this event should broadcast.
     */
    public function shouldBroadcast(): bool
    {
        // Always broadcast admin notifications
        return true;
    }

    /**
     * Get notification type based on category and priority
     */
    private function getNotificationType(): string
    {
        if ($this->priority === 'critical') {
            return 'critical';
        }
        
        return match($this->category) {
            'security' => 'warning',
            'error', 'failure' => 'warning',
            'success', 'completed' => 'success',
            'warning', 'alert' => 'warning',
            default => 'info',
        };
    }

    /**
     * Get escalation level based on priority
     */
    private function getEscalationLevel(): int
    {
        return match($this->priority) {
            'critical' => 3,
            'high' => 2,
            'medium' => 1,
            default => 0,
        };
    }

    /**
     * Create security notification
     */
    public static function security(
        string $message,
        string $priority = 'high',
        ?array $context = null
    ): self {
        $notificationData = [
            'title' => 'Security Alert',
            'message' => $message,
            'type' => 'security_alert',
            'context' => $context,
            'actions' => [
                'review_logs' => 'Review Security Logs',
                'block_ip' => 'Block Suspicious IP',
                'notify_security_team' => 'Notify Security Team'
            ]
        ];

        return new self($notificationData, 'security', $priority, null, [
            'requires_immediate_action' => $priority === 'critical',
            'security_level' => $priority,
            'incident_id' => uniqid('sec_', true)
        ]);
    }

    /**
     * Create system notification
     */
    public static function system(
        string $message,
        string $title = 'System Notification',
        string $priority = 'medium',
        ?array $context = null
    ): self {
        $notificationData = [
            'title' => $title,
            'message' => $message,
            'type' => 'system_notification',
            'context' => $context
        ];

        return new self($notificationData, 'system', $priority);
    }

    /**
     * Create performance notification
     */
    public static function performance(
        string $message,
        array $metrics = [],
        string $priority = 'medium'
    ): self {
        $notificationData = [
            'title' => 'Performance Alert',
            'message' => $message,
            'type' => 'performance_alert',
            'context' => $metrics,
            'actions' => [
                'view_metrics' => 'View Performance Metrics',
                'scale_resources' => 'Scale Resources',
                'investigate_issues' => 'Investigate Issues'
            ]
        ];

        return new self($notificationData, 'performance', $priority, null, [
            'performance_metrics' => $metrics,
            'alert_threshold_exceeded' => true
        ]);
    }

    /**
     * Create compliance notification
     */
    public static function compliance(
        string $message,
        string $complianceType,
        string $priority = 'high'
    ): self {
        $notificationData = [
            'title' => 'Compliance Alert',
            'message' => $message,
            'type' => 'compliance_alert',
            'context' => ['compliance_type' => $complianceType],
            'actions' => [
                'review_compliance' => 'Review Compliance Status',
                'generate_report' => 'Generate Compliance Report',
                'schedule_audit' => 'Schedule Audit'
            ]
        ];

        return new self($notificationData, 'compliance', $priority, null, [
            'compliance_type' => $complianceType,
            'requires_documentation' => true
        ]);
    }

    /**
     * Create user activity notification
     */
    public static function userActivity(
        string $message,
        int $userId,
        string $activity,
        string $priority = 'low'
    ): self {
        $notificationData = [
            'title' => 'User Activity Alert',
            'message' => $message,
            'type' => 'user_activity',
            'context' => [
                'user_id' => $userId,
                'activity' => $activity
            ]
        ];

        return new self($notificationData, 'user_activity', $priority, null, [
            'user_id' => $userId,
            'activity_type' => $activity,
            'timestamp' => now()->toISOString()
        ]);
    }

    /**
     * Create data processing notification
     */
    public static function dataProcessing(
        string $message,
        string $processType,
        bool $success = true,
        ?array $details = null
    ): self {
        $category = $success ? 'success' : 'error';
        $priority = $success ? 'low' : 'medium';

        $notificationData = [
            'title' => $success ? 'Data Processing Completed' : 'Data Processing Failed',
            'message' => $message,
            'type' => 'data_processing',
            'context' => array_merge(['process_type' => $processType], $details ?? [])
        ];

        return new self($notificationData, $category, $priority, null, [
            'process_type' => $processType,
            'processing_result' => $success ? 'success' : 'failure',
            'details' => $details
        ]);
    }
}