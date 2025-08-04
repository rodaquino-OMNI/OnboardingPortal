<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelemedicineNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'interview_id',
        'recipient_user_id',
        'notification_type',
        'delivery_method',
        'status',
        'scheduled_for',
        'sent_at',
        'delivered_at',
        'message_data',
        'failure_reason',
        'retry_count',
        'expires_at',
    ];

    protected $casts = [
        'scheduled_for' => 'datetime',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'expires_at' => 'datetime',
        'message_data' => 'array',
    ];

    /**
     * Get the interview this notification belongs to.
     */
    public function interview(): BelongsTo
    {
        return $this->belongsTo(Interview::class);
    }

    /**
     * Get the recipient user.
     */
    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    /**
     * Scope for pending notifications.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending')
                    ->where('scheduled_for', '<=', now())
                    ->where(function ($q) {
                        $q->whereNull('expires_at')
                          ->orWhere('expires_at', '>', now());
                    });
    }

    /**
     * Scope for failed notifications that can be retried.
     */
    public function scopeRetryable($query)
    {
        return $query->where('status', 'failed')
                    ->where('retry_count', '<', 3)
                    ->where('scheduled_for', '>=', now()->subHours(24));
    }

    /**
     * Mark notification as sent.
     */
    public function markSent(): bool
    {
        return $this->update([
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }

    /**
     * Mark notification as delivered.
     */
    public function markDelivered(): bool
    {
        return $this->update([
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);
    }

    /**
     * Mark notification as failed.
     */
    public function markFailed(string $reason = null): bool
    {
        return $this->update([
            'status' => 'failed',
            'failure_reason' => $reason,
            'retry_count' => $this->retry_count + 1,
        ]);
    }

    /**
     * Check if notification can be retried.
     */
    public function canRetry(): bool
    {
        return $this->status === 'failed' && 
               $this->retry_count < 3 && 
               $this->scheduled_for >= now()->subHours(24);
    }

    /**
     * Get human-readable notification type.
     */
    public function getTypeDisplayAttribute(): string
    {
        return match($this->notification_type) {
            'appointment_confirmation' => 'Appointment Confirmation',
            'appointment_reminder_24h' => '24-Hour Reminder',
            'appointment_reminder_1h' => '1-Hour Reminder',
            'setup_checklist_reminder' => 'Setup Checklist Reminder',
            'technical_check_reminder' => 'Technical Check Reminder',
            'appointment_cancelled' => 'Appointment Cancelled',
            'appointment_rescheduled' => 'Appointment Rescheduled',
            'followup_required' => 'Follow-up Required',
            'waitlist_match_found' => 'Waitlist Match Found',
            'prescription_ready' => 'Prescription Ready',
            default => ucwords(str_replace('_', ' ', $this->notification_type)),
        };
    }
}