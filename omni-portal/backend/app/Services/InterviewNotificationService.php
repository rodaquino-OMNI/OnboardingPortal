<?php

namespace App\Services;

use App\Models\Interview;
use App\Models\User;
use App\Notifications\Interview\InterviewScheduledNotification;
use App\Notifications\Interview\InterviewRescheduledNotification;
use App\Notifications\Interview\InterviewCancelledNotification;
use App\Notifications\Interview\InterviewReminderNotification;
use App\Notifications\Interview\InterviewStartedNotification;
use App\Notifications\Interview\InterviewCompletedNotification;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class InterviewNotificationService
{
    private WhatsAppService $whatsappService;
    private SMSService $smsService;
    private EmailService $emailService;
    
    public function __construct(
        WhatsAppService $whatsappService,
        SMSService $smsService,
        EmailService $emailService
    ) {
        $this->whatsappService = $whatsappService;
        $this->smsService = $smsService;
        $this->emailService = $emailService;
    }

    /**
     * Send interview scheduled notification
     */
    public function sendInterviewScheduledNotification(Interview $interview): void
    {
        try {
            $beneficiary = $interview->beneficiary;
            $channels = $this->getUserPreferredChannels($beneficiary);

            // Send through preferred channels
            foreach ($channels as $channel) {
                $this->sendNotification($channel, new InterviewScheduledNotification($interview, 'beneficiary'));
            }

            // Notify healthcare professional
            $healthcareProfessional = $interview->healthcareProfessional;
            if ($healthcareProfessional) {
                $healthcareProfessional->notify(new InterviewScheduledNotification($interview, 'healthcare_professional'));
            }

            // Multi-channel specific notifications
            if (in_array('whatsapp', $channels)) {
                $this->whatsappService->sendInterviewScheduledNotification($interview);
            }
            
            if (in_array('sms', $channels)) {
                $this->smsService->sendInterviewScheduledSMS($interview);
            }

            // Schedule reminder notifications
            $this->scheduleMultipleReminders($interview);

            Log::info('Interview scheduled notifications sent', [
                'interview_id' => $interview->id,
                'booking_reference' => $interview->booking_reference,
                'channels' => $channels
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send interview scheduled notifications', [
                'interview_id' => $interview->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Send interview rescheduled notification
     */
    public function sendInterviewRescheduledNotification(Interview $interview, Carbon $oldScheduledAt): void
    {
        try {
            // Notify beneficiary
            $beneficiary = $interview->beneficiary;
            if ($beneficiary && $beneficiary->user) {
                $beneficiary->user->notify(new InterviewRescheduledNotification($interview, $oldScheduledAt, 'beneficiary'));
            }

            // Notify healthcare professional
            $healthcareProfessional = $interview->healthcareProfessional;
            if ($healthcareProfessional) {
                $healthcareProfessional->notify(new InterviewRescheduledNotification($interview, $oldScheduledAt, 'healthcare_professional'));
            }

            // Cancel old reminder and schedule new one
            $this->scheduleReminderNotification($interview);

            Log::info('Interview rescheduled notifications sent', [
                'interview_id' => $interview->id,
                'old_scheduled_at' => $oldScheduledAt->toDateTimeString(),
                'new_scheduled_at' => $interview->scheduled_at->toDateTimeString()
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send interview rescheduled notifications', [
                'interview_id' => $interview->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Send interview cancelled notification
     */
    public function sendInterviewCancelledNotification(Interview $interview): void
    {
        try {
            // Notify beneficiary
            $beneficiary = $interview->beneficiary;
            if ($beneficiary && $beneficiary->user) {
                $beneficiary->user->notify(new InterviewCancelledNotification($interview, 'beneficiary'));
            }

            // Notify healthcare professional
            $healthcareProfessional = $interview->healthcareProfessional;
            if ($healthcareProfessional) {
                $healthcareProfessional->notify(new InterviewCancelledNotification($interview, 'healthcare_professional'));
            }

            Log::info('Interview cancelled notifications sent', [
                'interview_id' => $interview->id,
                'cancellation_reason' => $interview->cancellation_reason
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send interview cancelled notifications', [
                'interview_id' => $interview->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Send interview reminder notification
     */
    public function sendInterviewReminderNotification(Interview $interview): void
    {
        try {
            // Only send reminders for scheduled/confirmed interviews
            if (!in_array($interview->status, ['scheduled', 'confirmed'])) {
                return;
            }

            // Notify beneficiary
            $beneficiary = $interview->beneficiary;
            if ($beneficiary && $beneficiary->user) {
                $beneficiary->user->notify(new InterviewReminderNotification($interview, 'beneficiary'));
            }

            // Notify healthcare professional
            $healthcareProfessional = $interview->healthcareProfessional;
            if ($healthcareProfessional) {
                $healthcareProfessional->notify(new InterviewReminderNotification($interview, 'healthcare_professional'));
            }

            // Update reminder sent timestamp
            $interview->update(['reminder_sent_at' => now()]);

            Log::info('Interview reminder notifications sent', [
                'interview_id' => $interview->id,
                'scheduled_at' => $interview->scheduled_at->toDateTimeString()
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send interview reminder notifications', [
                'interview_id' => $interview->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Send interview started notification
     */
    public function sendInterviewStartedNotification(Interview $interview): void
    {
        try {
            // Notify beneficiary
            $beneficiary = $interview->beneficiary;
            if ($beneficiary && $beneficiary->user) {
                $beneficiary->user->notify(new InterviewStartedNotification($interview, 'beneficiary'));
            }

            Log::info('Interview started notification sent', [
                'interview_id' => $interview->id,
                'started_at' => $interview->started_at->toDateTimeString()
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send interview started notification', [
                'interview_id' => $interview->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Send interview completed notification
     */
    public function sendInterviewCompletedNotification(Interview $interview): void
    {
        try {
            // Notify beneficiary
            $beneficiary = $interview->beneficiary;
            if ($beneficiary && $beneficiary->user) {
                $beneficiary->user->notify(new InterviewCompletedNotification($interview, 'beneficiary'));
            }

            // Notify healthcare professional
            $healthcareProfessional = $interview->healthcareProfessional;
            if ($healthcareProfessional) {
                $healthcareProfessional->notify(new InterviewCompletedNotification($interview, 'healthcare_professional'));
            }

            Log::info('Interview completed notifications sent', [
                'interview_id' => $interview->id,
                'duration' => $interview->actual_duration_minutes
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send interview completed notifications', [
                'interview_id' => $interview->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Send bulk notifications for multiple interviews
     */
    public function sendBulkNotifications(array $interviews, string $notificationType, array $data = []): array
    {
        $results = [
            'success' => 0,
            'failed' => 0,
            'errors' => []
        ];

        foreach ($interviews as $interview) {
            try {
                switch ($notificationType) {
                    case 'reminder':
                        $this->sendInterviewReminderNotification($interview);
                        break;
                    case 'cancelled':
                        $this->sendInterviewCancelledNotification($interview);
                        break;
                    default:
                        throw new \InvalidArgumentException("Unknown notification type: {$notificationType}");
                }

                $results['success']++;

            } catch (\Exception $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'interview_id' => $interview->id,
                    'error' => $e->getMessage()
                ];
            }
        }

        Log::info('Bulk notifications processed', [
            'type' => $notificationType,
            'total' => count($interviews),
            'success' => $results['success'],
            'failed' => $results['failed']
        ]);

        return $results;
    }

    /**
     * Get notification preferences for user
     */
    public function getNotificationPreferences(User $user): array
    {
        $preferences = $user->notification_preferences ?? [];

        return array_merge([
            'interview_scheduled' => ['database', 'mail'],
            'interview_rescheduled' => ['database', 'mail'],
            'interview_cancelled' => ['database', 'mail', 'sms'],
            'interview_reminder' => ['database', 'mail', 'sms'],
            'interview_started' => ['database'],
            'interview_completed' => ['database', 'mail']
        ], $preferences);
    }

    /**
     * Update notification preferences for user
     */
    public function updateNotificationPreferences(User $user, array $preferences): void
    {
        $validChannels = ['database', 'mail', 'sms', 'push'];
        $validTypes = [
            'interview_scheduled',
            'interview_rescheduled', 
            'interview_cancelled',
            'interview_reminder',
            'interview_started',
            'interview_completed'
        ];

        $filteredPreferences = [];

        foreach ($preferences as $type => $channels) {
            if (in_array($type, $validTypes) && is_array($channels)) {
                $filteredPreferences[$type] = array_intersect($channels, $validChannels);
            }
        }

        $user->update(['notification_preferences' => $filteredPreferences]);

        Log::info('Notification preferences updated', [
            'user_id' => $user->id,
            'preferences' => $filteredPreferences
        ]);
    }

    /**
     * Schedule reminder notification (24 hours before interview)
     */
    private function scheduleReminderNotification(Interview $interview): void
    {
        // Calculate reminder time (24 hours before interview)
        $reminderTime = $interview->scheduled_at->subHours(24);

        // Only schedule if reminder time is in the future
        if ($reminderTime->isFuture()) {
            // In a production environment, you would use Laravel's job scheduling
            // For now, we'll just log the scheduled reminder
            Log::info('Interview reminder scheduled', [
                'interview_id' => $interview->id,
                'reminder_time' => $reminderTime->toDateTimeString(),
                'interview_time' => $interview->scheduled_at->toDateTimeString()
            ]);

            // TODO: Implement actual job scheduling
            // dispatch(new SendInterviewReminderJob($interview))->delay($reminderTime);
        }
    }

    /**
     * Process scheduled reminders (to be called by cron job)
     */
    public function processScheduledReminders(): array
    {
        // Get interviews scheduled for tomorrow that haven't been reminded
        $interviewsToRemind = Interview::with(['beneficiary.user', 'healthcareProfessional'])
            ->whereIn('status', ['scheduled', 'confirmed'])
            ->whereBetween('scheduled_at', [
                now()->addDay()->startOfDay(),
                now()->addDay()->endOfDay()
            ])
            ->whereNull('reminder_sent_at')
            ->get();

        $results = [
            'processed' => 0,
            'success' => 0,
            'failed' => 0,
            'errors' => []
        ];

        foreach ($interviewsToRemind as $interview) {
            $results['processed']++;
            
            try {
                $this->sendInterviewReminderNotification($interview);
                $results['success']++;
            } catch (\Exception $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'interview_id' => $interview->id,
                    'error' => $e->getMessage()
                ];
            }
        }

        Log::info('Scheduled reminders processed', $results);

        return $results;
    }

    /**
     * Get user preferred notification channels
     */
    private function getUserPreferredChannels($beneficiary): array
    {
        $preferences = $beneficiary->user->notification_preferences ?? [];
        
        // Default fallback channels
        if (empty($preferences)) {
            return ['email', 'sms'];
        }

        // Filter by availability and user preference
        $availableChannels = [];
        
        if (in_array('email', $preferences) || empty($preferences)) {
            $availableChannels[] = 'email';
        }
        
        if ((in_array('sms', $preferences) || empty($preferences)) && $this->smsService->isAvailable()) {
            $availableChannels[] = 'sms';
        }
        
        if (in_array('whatsapp', $preferences) && $this->whatsappService->isAvailable()) {
            $availableChannels[] = 'whatsapp';
        }
        
        if (in_array('push', $preferences)) {
            $availableChannels[] = 'push';
        }
        
        return $availableChannels;
    }

    /**
     * Send notification through specific channel
     */
    private function sendNotification(string $channel, $notification): void
    {
        try {
            switch ($channel) {
                case 'email':
                    $this->emailService->send($notification);
                    break;
                    
                case 'sms':
                    $this->smsService->send($notification);
                    break;
                    
                case 'whatsapp':
                    $this->whatsappService->send($notification);
                    break;
                    
                case 'push':
                    // Push notification implementation would go here
                    Log::info('Push notification not yet implemented');
                    break;
                    
                default:
                    throw new \InvalidArgumentException("Unsupported channel: {$channel}");
            }
        } catch (\Exception $e) {
            Log::error("Notification failed for channel {$channel}", [
                'error' => $e->getMessage(),
                'notification' => get_class($notification)
            ]);

            // Retry with fallback channel
            if ($channel !== 'email') {
                $this->sendNotification('email', $notification);
            }
        }
    }

    /**
     * Schedule multiple reminder notifications
     */
    private function scheduleMultipleReminders(Interview $interview): void
    {
        $reminders = [
            ['hours' => 48, 'channels' => ['email']],
            ['hours' => 24, 'channels' => ['email', 'sms']],
            ['hours' => 2, 'channels' => ['sms', 'whatsapp']],
            ['hours' => 0.25, 'channels' => ['push']], // 15 minutes before
        ];

        foreach ($reminders as $reminder) {
            $reminderTime = $interview->scheduled_at->subHours($reminder['hours']);
            
            if ($reminderTime->isFuture()) {
                // In production, use job scheduling
                Log::info('Interview reminder scheduled', [
                    'interview_id' => $interview->id,
                    'reminder_time' => $reminderTime->toDateTimeString(),
                    'hours_before' => $reminder['hours'],
                    'channels' => $reminder['channels']
                ]);
                
                // TODO: Implement actual job scheduling
                // dispatch(new SendInterviewReminderJob($interview, $reminder['channels']))
                //     ->delay($reminderTime);
            }
        }
    }

    /**
     * Check if channel is available for user
     */
    private function isChannelAvailable(string $channel, $beneficiary): bool
    {
        switch ($channel) {
            case 'email':
                return !empty($beneficiary->user->email);
                
            case 'sms':
                return !empty($beneficiary->phone) && 
                       $this->smsService->isAvailable() &&
                       $this->smsService->validatePhoneNumber($beneficiary->phone);
                       
            case 'whatsapp':
                return !empty($beneficiary->phone) && 
                       $this->whatsappService->isAvailable() &&
                       $this->whatsappService->validatePhoneNumber($beneficiary->phone);
                       
            case 'push':
                // Check if user has push tokens registered
                return false; // Not implemented yet
                
            default:
                return false;
        }
    }
}