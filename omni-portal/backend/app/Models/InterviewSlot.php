<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class InterviewSlot extends Model
{
    use HasFactory;

    protected $fillable = [
        'healthcare_professional_id',
        'date',
        'start_time',
        'end_time',
        'duration_minutes',
        'is_available',
        'status',
        'interview_type',
        'meeting_type',
        'meeting_link',
        'meeting_platform',
        'max_bookings',
        'current_bookings',
        'location',
        'notes',
        'price',
        'break_duration',
        'buffer_minutes',
        'recurring_pattern',
        'recurring_end_date',
        'timezone',
        'specialization_required',
        'languages_available',
        'preparation_requirements',
        'cancellation_deadline_hours',
        'reschedule_deadline_hours',
    ];

    protected $casts = [
        'date' => 'date',
        'is_available' => 'boolean',
        'recurring_end_date' => 'date',
        'languages_available' => 'array',
        'preparation_requirements' => 'array',
    ];

    /**
     * Get the healthcare professional who owns this slot.
     */
    public function healthcareProfessional(): BelongsTo
    {
        return $this->belongsTo(User::class, 'healthcare_professional_id');
    }

    /**
     * Get the interviews for this slot.
     */
    public function interviews(): HasMany
    {
        return $this->hasMany(Interview::class, 'interview_slot_id');
    }

    /**
     * Get active interviews (not cancelled).
     */
    public function activeInterviews(): HasMany
    {
        return $this->interviews()->whereNotIn('status', ['cancelled']);
    }

    /**
     * Scope for available slots.
     */
    public function scopeAvailable($query)
    {
        return $query->where('is_available', true)
                     ->where('date', '>=', now()->toDateString())
                     ->whereColumn('current_bookings', '<', 'max_bookings');
    }

    /**
     * Scope for slots on a specific date.
     */
    public function scopeOnDate($query, $date)
    {
        return $query->whereDate('date', $date);
    }

    /**
     * Scope for slots within date range.
     */
    public function scopeDateBetween($query, $startDate, $endDate)
    {
        return $query->whereBetween('date', [$startDate, $endDate]);
    }

    /**
     * Check if slot has capacity.
     */
    public function hasCapacity(): bool
    {
        return $this->is_available && $this->current_bookings < $this->max_bookings;
    }

    /**
     * Get remaining capacity.
     */
    public function getRemainingCapacityAttribute(): int
    {
        return max(0, $this->max_bookings - $this->current_bookings);
    }

    /**
     * Check if slot is in the past.
     */
    public function isPast(): bool
    {
        $slotDateTime = Carbon::parse($this->date->format('Y-m-d') . ' ' . $this->end_time);
        return $slotDateTime->isPast();
    }

    /**
     * Check if slot is today.
     */
    public function isToday(): bool
    {
        return $this->date->isToday();
    }

    /**
     * Check if slot is in the future.
     */
    public function isFuture(): bool
    {
        $slotDateTime = Carbon::parse($this->date->format('Y-m-d') . ' ' . $this->start_time);
        return $slotDateTime->isFuture();
    }

    /**
     * Get slot datetime in specific timezone.
     */
    public function getDateTimeInTimezone(string $timezone = 'America/Sao_Paulo'): Carbon
    {
        $dateTime = Carbon::parse($this->date->format('Y-m-d') . ' ' . $this->start_time, $this->timezone ?? 'America/Sao_Paulo');
        return $dateTime->setTimezone($timezone);
    }

    /**
     * Check if slot can be booked considering cancellation deadline.
     */
    public function canBeBooked(): bool
    {
        if (!$this->hasCapacity()) {
            return false;
        }

        $slotDateTime = Carbon::parse($this->date->format('Y-m-d') . ' ' . $this->start_time);
        $bookingDeadline = $slotDateTime->subHours($this->cancellation_deadline_hours ?? 24);
        
        return now()->lt($bookingDeadline);
    }

    /**
     * Get utilization percentage.
     */
    public function getUtilizationPercentageAttribute(): float
    {
        if ($this->max_bookings === 0) {
            return 0;
        }
        
        return round(($this->current_bookings / $this->max_bookings) * 100, 2);
    }

    /**
     * Format time range for display.
     */
    public function getTimeRangeAttribute(): string
    {
        return Carbon::parse($this->start_time)->format('H:i') . ' - ' . Carbon::parse($this->end_time)->format('H:i');
    }
}