<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Messages\SlackMessage;
use Illuminate\Notifications\Notification;

class SystemAlert extends Notification implements ShouldQueue
{
    use Queueable;

    private array $alertData;

    /**
     * Create a new notification instance.
     */
    public function __construct(array $alertData)
    {
        $this->alertData = $alertData;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $channels = ['mail', 'database'];

        // Add Slack for critical alerts
        if (($this->alertData['severity'] ?? 'info') === 'critical') {
            $channels[] = 'slack';
        }

        return $channels;
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $severity = strtoupper($this->alertData['severity'] ?? 'INFO');
        $type = str_replace('_', ' ', $this->alertData['type'] ?? 'system');
        
        $mail = (new MailMessage)
            ->subject("[{$severity}] OCR System Alert: {$type}")
            ->greeting("Hello {$notifiable->name},")
            ->line("A {$severity} alert has been triggered in the OCR system.")
            ->line($this->alertData['message'])
            ->when(
                $severity === 'CRITICAL' || $severity === 'ERROR',
                fn($mail) => $mail->error()
            );

        // Add metadata if available
        if (!empty($this->alertData['metadata'])) {
            $mail->line('Additional Details:');
            foreach ($this->alertData['metadata'] as $key => $value) {
                if (!in_array($key, ['type', 'severity', 'message'])) {
                    $mail->line("• " . ucfirst(str_replace('_', ' ', $key)) . ": " . (is_scalar($value) ? $value : json_encode($value)));
                }
            }
        }

        // Add action button for critical alerts
        if ($severity === 'CRITICAL' || $severity === 'ERROR') {
            $mail->action('View Alert Details', url("/admin/alerts/{$this->alertData['alert_id']}"));
        }

        return $mail->line('Please review and take appropriate action.');
    }

    /**
     * Get the Slack representation of the notification.
     */
    public function toSlack(object $notifiable): SlackMessage
    {
        $severity = $this->alertData['severity'] ?? 'info';
        $color = match ($severity) {
            'critical' => 'danger',
            'error' => 'danger',
            'warning' => 'warning',
            default => 'good',
        };

        return (new SlackMessage)
            ->from('OCR Monitor', ':robot_face:')
            ->to('#ocr-alerts')
            ->content('OCR System Alert')
            ->attachment(function ($attachment) use ($color) {
                $attachment->title($this->alertData['type'] ?? 'System Alert')
                    ->content($this->alertData['message'])
                    ->color($color)
                    ->fields([
                        'Severity' => strtoupper($this->alertData['severity'] ?? 'info'),
                        'Alert ID' => $this->alertData['alert_id'] ?? 'N/A',
                        'Time' => now()->format('Y-m-d H:i:s'),
                    ])
                    ->footer('OCR Monitoring System')
                    ->timestamp(now());
            });
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'alert_id' => $this->alertData['alert_id'] ?? null,
            'type' => $this->alertData['type'] ?? 'system',
            'severity' => $this->alertData['severity'] ?? 'info',
            'message' => $this->alertData['message'],
            'metadata' => $this->alertData['metadata'] ?? [],
            'created_at' => now()->toIso8601String(),
        ];
    }
}