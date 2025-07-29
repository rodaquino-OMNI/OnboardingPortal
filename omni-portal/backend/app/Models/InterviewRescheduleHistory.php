<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InterviewRescheduleHistory extends Model
{
    use HasFactory;

    protected $table = 'interview_reschedule_history';

    protected $fillable = [
        'interview_id',
        'old_slot_id',
        'new_slot_id',
        'old_scheduled_at',
        'new_scheduled_at',
        'reason',
        'rescheduled_by',
        'reschedule_count_at_time',
        'notification_sent',
    ];

    protected $casts = [
        'old_scheduled_at' => 'datetime',
        'new_scheduled_at' => 'datetime',
        'notification_sent' => 'boolean',
    ];

    /**
     * Get the interview that was rescheduled.
     */
    public function interview(): BelongsTo
    {
        return $this->belongsTo(Interview::class);
    }

    /**
     * Get the old interview slot.
     */
    public function oldSlot(): BelongsTo
    {
        return $this->belongsTo(InterviewSlot::class, 'old_slot_id');
    }

    /**
     * Get the new interview slot.
     */
    public function newSlot(): BelongsTo
    {
        return $this->belongsTo(InterviewSlot::class, 'new_slot_id');
    }

    /**
     * Get the user who rescheduled the interview.
     */
    public function rescheduledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rescheduled_by');
    }

    /**
     * Get formatted reschedule information.
     */
    public function getFormattedInfoAttribute(): string
    {
        return sprintf(
            'Rescheduled from %s to %s - Reason: %s',
            $this->old_scheduled_at->format('d/m/Y H:i'),
            $this->new_scheduled_at->format('d/m/Y H:i'),
            $this->reason ?? 'Not specified'
        );
    }

    /**
     * Get the time difference between old and new schedule.
     */
    public function getTimeDifferenceAttribute(): array
    {
        $diff = $this->old_scheduled_at->diff($this->new_scheduled_at);
        
        return [
            'days' => $diff->days,
            'hours' => $diff->h,
            'minutes' => $diff->i,
            'total_hours' => ($diff->days * 24) + $diff->h,
            'is_earlier' => $this->new_scheduled_at < $this->old_scheduled_at,
        ];
    }
}