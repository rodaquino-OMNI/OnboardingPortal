<?php

namespace App\Services;

use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Mail\Mailable;
use App\Mail\InterviewScheduledMail;
use App\Mail\InterviewReminderMail;
use App\Mail\InterviewCancelledMail;
use App\Mail\InterviewRescheduledMail;
use App\Mail\InterviewCompletedMail;

class EmailService
{
    private bool $enabled;
    private array $config;

    public function __construct()
    {
        $this->enabled = config('mail.enabled', true);
        $this->config = [
            'from_address' => config('mail.from.address'),
            'from_name' => config('mail.from.name'),
            'reply_to' => config('mail.reply_to.address'),
        ];
    }

    /**
     * Send email notification
     */
    public function send($notification): bool
    {
        if (!$this->enabled) {
            Log::info('Email service is disabled');
            return false;
        }

        try {
            $recipient = $notification->notifiable;
            
            if (!$recipient || !$recipient->email) {
                Log::warning('No valid email address for recipient', [
                    'recipient_id' => $recipient->id ?? 'unknown'
                ]);
                return false;
            }

            // Convert notification to mailable
            $mailable = $this->notificationToMailable($notification);
            
            if (!$mailable) {
                // Fall back to standard notification
                $recipient->notify($notification);
                return true;
            }

            // Send the email
            Mail::to($recipient->email)->send($mailable);
            
            Log::info('Email sent successfully', [
                'recipient' => $recipient->email,
                'notification_type' => get_class($notification)
            ]);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Email service error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Send interview scheduled email
     */
    public function sendInterviewScheduledEmail($interview): bool
    {
        try {
            $mailable = new InterviewScheduledMail($interview);
            Mail::to($interview->beneficiary->user->email)->send($mailable);
            
            Log::info('Interview scheduled email sent', [
                'interview_id' => $interview->id,
                'recipient' => $interview->beneficiary->user->email
            ]);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Failed to send interview scheduled email', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Send interview reminder email
     */
    public function sendInterviewReminderEmail($interview): bool
    {
        try {
            $mailable = new InterviewReminderMail($interview);
            Mail::to($interview->beneficiary->user->email)->send($mailable);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Failed to send interview reminder email', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Send interview cancelled email
     */
    public function sendInterviewCancelledEmail($interview): bool
    {
        try {
            $mailable = new InterviewCancelledMail($interview);
            Mail::to($interview->beneficiary->user->email)->send($mailable);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Failed to send interview cancelled email', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Send interview rescheduled email
     */
    public function sendInterviewRescheduledEmail($interview, $oldScheduledAt): bool
    {
        try {
            $mailable = new InterviewRescheduledMail($interview, $oldScheduledAt);
            Mail::to($interview->beneficiary->user->email)->send($mailable);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Failed to send interview rescheduled email', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Send interview completed email
     */
    public function sendInterviewCompletedEmail($interview): bool
    {
        try {
            $mailable = new InterviewCompletedMail($interview);
            Mail::to($interview->beneficiary->user->email)->send($mailable);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Failed to send interview completed email', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Send custom email
     */
    public function sendCustomEmail(string $to, string $subject, string $body, array $attachments = []): bool
    {
        if (!$this->enabled) {
            return false;
        }

        try {
            Mail::raw($body, function ($message) use ($to, $subject, $attachments) {
                $message->to($to)
                        ->subject($subject)
                        ->from($this->config['from_address'], $this->config['from_name']);
                
                if ($this->config['reply_to']) {
                    $message->replyTo($this->config['reply_to']);
                }
                
                foreach ($attachments as $attachment) {
                    if (is_string($attachment) && file_exists($attachment)) {
                        $message->attach($attachment);
                    }
                }
            });
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Failed to send custom email', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Send bulk emails
     */
    public function sendBulkEmails(array $recipients, Mailable $mailable): array
    {
        $results = [
            'success' => 0,
            'failed' => 0,
            'errors' => []
        ];

        foreach ($recipients as $recipient) {
            try {
                Mail::to($recipient)->send(clone $mailable);
                $results['success']++;
                
            } catch (\Exception $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'recipient' => $recipient,
                    'error' => $e->getMessage()
                ];
            }
        }

        Log::info('Bulk email results', $results);
        
        return $results;
    }

    /**
     * Convert notification to mailable
     */
    private function notificationToMailable($notification): ?Mailable
    {
        $notificationClass = get_class($notification);
        
        $mailableMap = [
            'InterviewScheduledNotification' => InterviewScheduledMail::class,
            'InterviewReminderNotification' => InterviewReminderMail::class,
            'InterviewCancelledNotification' => InterviewCancelledMail::class,
            'InterviewRescheduledNotification' => InterviewRescheduledMail::class,
            'InterviewCompletedNotification' => InterviewCompletedMail::class,
        ];

        $baseName = class_basename($notificationClass);
        
        if (isset($mailableMap[$baseName])) {
            $mailableClass = $mailableMap[$baseName];
            
            // Extract the interview from notification
            $interview = $notification->interview ?? null;
            
            if ($interview) {
                return new $mailableClass($interview);
            }
        }

        return null;
    }

    /**
     * Check if email service is available
     */
    public function isAvailable(): bool
    {
        return $this->enabled && 
               !empty($this->config['from_address']) && 
               !empty(config('mail.default'));
    }

    /**
     * Validate email address
     */
    public function validateEmailAddress(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Get email statistics (if using a service like SendGrid or Mailgun)
     */
    public function getEmailStatistics(string $messageId = null): ?array
    {
        // This would be implemented based on your email service provider
        // For example, using SendGrid or Mailgun APIs
        return null;
    }
}