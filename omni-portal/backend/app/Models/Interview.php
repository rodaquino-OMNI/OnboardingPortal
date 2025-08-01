<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Interview extends Model
{
    use HasFactory;

    protected $fillable = [
        'beneficiary_id',
        'interview_slot_id',
        'healthcare_professional_id',
        'booking_reference',
        'status',
        'scheduled_at',
        'started_at',
        'ended_at',
        'actual_duration_minutes',
        'interview_type',
        'meeting_type',
        'meeting_link',
        'meeting_platform',
        'notes',
        'session_notes',
        'rating',
        'feedback',
        'cancellation_reason',
        'cancelled_at',
        'cancelled_by',
        'reschedule_reason',
        'reschedule_count',
        'rescheduled_at',
        'rescheduled_by',
        'reminder_sent_at',
        'confirmation_sent_at',
        'follow_up_required',
        'follow_up_notes',
        'emergency_contact',
        'preparation_confirmed',
        'punctuality_score',
        'booked_at',
        'confirmed_at',
        'timezone',
        'beneficiary_timezone',
        'professional_timezone',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'rescheduled_at' => 'datetime',
        'booked_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'confirmation_sent_at' => 'datetime',
        'follow_up_required' => 'boolean',
        'preparation_confirmed' => 'boolean',
        'emergency_contact' => 'array',
    ];

    /**
     * Get the beneficiary that owns the interview.
     */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    /**
     * Get the interview slot.
     */
    public function slot(): BelongsTo
    {
        return $this->belongsTo(InterviewSlot::class, 'interview_slot_id');
    }

    /**
     * Get the healthcare professional (interviewer).
     */
    public function healthcareProfessional(): BelongsTo
    {
        return $this->belongsTo(User::class, 'healthcare_professional_id');
    }

    /**
     * Get the user who cancelled the interview.
     */
    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /**
     * Get the user who rescheduled the interview.
     */
    public function rescheduledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rescheduled_by');
    }

    /**
     * Get the reschedule history for this interview.
     */
    public function rescheduleHistory(): HasMany
    {
        return $this->hasMany(InterviewRescheduleHistory::class);
    }

    /**
     * Get the documents associated with this interview.
     */
    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(Document::class, 'interview_documents')
                    ->withTimestamps()
                    ->withPivot('notes');
    }

    /**
     * Scope for upcoming interviews.
     */
    public function scopeUpcoming($query)
    {
        return $query->whereIn('status', ['scheduled', 'confirmed'])
                     ->where('scheduled_at', '>', now());
    }

    /**
     * Scope for past interviews.
     */
    public function scopePast($query)
    {
        return $query->where('scheduled_at', '<', now());
    }

    /**
     * Scope for today's interviews.
     */
    public function scopeToday($query)
    {
        return $query->whereDate('scheduled_at', today());
    }

    /**
     * Check if interview can be rescheduled.
     */
    public function canBeRescheduled(): bool
    {
        return in_array($this->status, ['scheduled', 'confirmed']) 
               && $this->scheduled_at > now()->addHours(24)
               && $this->reschedule_count < 3;
    }

    /**
     * Check if interview can be cancelled.
     */
    public function canBeCancelled(): bool
    {
        return in_array($this->status, ['scheduled', 'confirmed', 'rescheduled'])
               && $this->scheduled_at > now();
    }

    /**
     * Get display time in user timezone.
     */
    public function getDisplayTimeAttribute(): string
    {
        $timezone = $this->beneficiary_timezone ?? 'America/Sao_Paulo';
        return $this->scheduled_at->setTimezone($timezone)->format('d/m/Y às H:i');
    }

    /**
     * Check if interview is overdue.
     */
    public function isOverdue(): bool
    {
        return $this->status === 'scheduled' && $this->scheduled_at < now();
    }
}