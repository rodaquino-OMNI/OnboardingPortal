<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class TelemedicineRecurringAppointment extends Model
{
    use HasFactory;

    protected $fillable = [
        'beneficiary_id',
        'healthcare_professional_id',
        'appointment_type_id',
        'recurrence_pattern',
        'recurrence_interval',
        'recurrence_days',
        'preferred_start_time',
        'preferred_end_time',
        'series_start_date',
        'series_end_date',
        'max_occurrences',
        'created_appointments_count',
        'skip_dates',
        'status',
        'notes',
    ];

    protected $casts = [
        'recurrence_days' => 'array',
        'preferred_start_time' => 'datetime:H:i',
        'preferred_end_time' => 'datetime:H:i',
        'series_start_date' => 'date',
        'series_end_date' => 'date',
        'skip_dates' => 'array',
    ];

    /**
     * Get the beneficiary for this recurring appointment.
     */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    /**
     * Get the healthcare professional for this recurring appointment.
     */
    public function healthcareProfessional(): BelongsTo
    {
        return $this->belongsTo(User::class, 'healthcare_professional_id');
    }

    /**
     * Get the appointment type for this recurring appointment.
     */
    public function appointmentType(): BelongsTo
    {
        return $this->belongsTo(TelemedicineAppointmentType::class, 'appointment_type_id');
    }

    /**
     * Get the interviews created from this recurring appointment.
     */
    public function interviews(): HasMany
    {
        return $this->hasMany(Interview::class, 'recurring_appointment_id');
    }

    /**
     * Scope for active recurring appointments.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope for recurring appointments that need new appointments created.
     */
    public function scopeNeedsAppointmentCreation($query)
    {
        return $query->where('status', 'active')
                    ->where('series_start_date', '<=', now()->addDays(30)) // Look ahead 30 days
                    ->where(function ($q) {
                        $q->whereNull('series_end_date')
                          ->orWhere('series_end_date', '>=', now());
                    })
                    ->where(function ($q) {
                        $q->whereNull('max_occurrences')
                          ->orWhereColumn('created_appointments_count', '<', 'max_occurrences');
                    });
    }

    /**
     * Generate the next appointment date based on recurrence pattern.
     */
    public function getNextAppointmentDate(): ?Carbon
    {
        $lastAppointment = $this->interviews()
            ->orderBy('scheduled_at', 'desc')
            ->first();

        $baseDate = $lastAppointment 
            ? Carbon::parse($lastAppointment->scheduled_at)->startOfDay()
            : Carbon::parse($this->series_start_date);

        return $this->calculateNextDate($baseDate);
    }

    /**
     * Calculate the next date based on recurrence pattern.
     */
    private function calculateNextDate(Carbon $baseDate): ?Carbon
    {
        switch ($this->recurrence_pattern) {
            case 'weekly':
                return $this->getNextWeeklyDate($baseDate);
            case 'biweekly':
                return $this->getNextBiweeklyDate($baseDate);
            case 'monthly':
                return $this->getNextMonthlyDate($baseDate);
            case 'quarterly':
                return $this->getNextQuarterlyDate($baseDate);
            default:
                return null;
        }
    }

    /**
     * Get next weekly appointment date.
     */
    private function getNextWeeklyDate(Carbon $baseDate): ?Carbon
    {
        if (!$this->recurrence_days || empty($this->recurrence_days)) {
            return $baseDate->addWeeks($this->recurrence_interval);
        }

        // Find next occurrence of any of the specified days
        $nextDate = $baseDate->copy()->addDay();
        $weeksAdded = 0;
        
        while ($weeksAdded < 8) { // Safety limit
            $dayName = strtolower($nextDate->format('l'));
            
            if (in_array($dayName, $this->recurrence_days)) {
                return $nextDate;
            }
            
            $nextDate->addDay();
            
            // If we've gone through a full week, add the interval weeks
            if ($nextDate->dayOfWeek === $baseDate->dayOfWeek && $weeksAdded === 0) {
                $nextDate->addWeeks($this->recurrence_interval - 1);
                $weeksAdded++;
            }
        }

        return null;
    }

    /**
     * Get next biweekly appointment date.
     */
    private function getNextBiweeklyDate(Carbon $baseDate): ?Carbon
    {
        return $baseDate->addWeeks(2 * $this->recurrence_interval);
    }

    /**
     * Get next monthly appointment date.
     */
    private function getNextMonthlyDate(Carbon $baseDate): ?Carbon
    {
        return $baseDate->addMonths($this->recurrence_interval);
    }

    /**
     * Get next quarterly appointment date.
     */
    private function getNextQuarterlyDate(Carbon $baseDate): ?Carbon
    {
        return $baseDate->addMonths(3 * $this->recurrence_interval);
    }

    /**
     * Check if a date should be skipped.
     */
    public function shouldSkipDate(Carbon $date): bool
    {
        if (!$this->skip_dates || empty($this->skip_dates)) {
            return false;
        }

        $dateString = $date->format('Y-m-d');
        return in_array($dateString, $this->skip_dates);
    }

    /**
     * Check if the recurring appointment series has ended.
     */
    public function hasSeriesEnded(): bool
    {
        // Check end date
        if ($this->series_end_date && Carbon::parse($this->series_end_date)->isPast()) {
            return true;
        }

        // Check max occurrences
        if ($this->max_occurrences && $this->created_appointments_count >= $this->max_occurrences) {
            return true;
        }

        return false;
    }

    /**
     * Create the next appointment in the series.
     */
    public function createNextAppointment(): ?Interview
    {
        if ($this->hasSeriesEnded() || $this->status !== 'active') {
            return null;
        }

        $nextDate = $this->getNextAppointmentDate();
        if (!$nextDate) {
            return null;
        }

        // Skip if date should be skipped
        if ($this->shouldSkipDate($nextDate)) {
            // Add to skip dates and try next date
            $skipDates = $this->skip_dates ?? [];
            $skipDates[] = $nextDate->format('Y-m-d');
            $this->update(['skip_dates' => $skipDates]);
            return $this->createNextAppointment(); // Recursive call for next date
        }

        // Find available slot
        $slot = $this->findAvailableSlot($nextDate);
        if (!$slot) {
            // Could add to waitlist or notify about unavailability
            return null;
        }

        // Create the appointment
        $appointment = Interview::create([
            'beneficiary_id' => $this->beneficiary_id,
            'interview_slot_id' => $slot->id,
            'healthcare_professional_id' => $this->healthcare_professional_id,
            'appointment_type_id' => $this->appointment_type_id,
            'recurring_appointment_id' => $this->id,
            'booking_reference' => 'REC-' . uniqid(),
            'status' => 'scheduled',
            'scheduled_at' => $nextDate->setTimeFromTimeString($this->preferred_start_time->format('H:i')),
            'is_telemedicine' => true,
            'interview_type' => 'recurring_telemedicine',
            'meeting_type' => 'video_conference',
            'timezone' => 'America/Sao_Paulo',
            'booked_at' => now(),
        ]);

        // Update the slot
        $slot->increment('current_bookings');

        // Update created appointments count
        $this->increment('created_appointments_count');

        return $appointment;
    }

    /**
     * Find available slot for the given date.
     */
    private function findAvailableSlot(Carbon $date): ?InterviewSlot
    {
        return InterviewSlot::where('healthcare_professional_id', $this->healthcare_professional_id)
            ->where('date', $date->format('Y-m-d'))
            ->where('start_time', '<=', $this->preferred_start_time->format('H:i:s'))
            ->where('end_time', '>=', $this->preferred_end_time->format('H:i:s'))
            ->where('is_available', true)
            ->where('is_telemedicine_enabled', true)
            ->whereColumn('current_bookings', '<', 'max_bookings')
            ->whereJsonContains('supported_appointment_types', $this->appointment_type_id)
            ->first();
    }

    /**
     * Pause the recurring appointment series.
     */
    public function pause(): bool
    {
        return $this->update(['status' => 'paused']);
    }

    /**
     * Resume the recurring appointment series.
     */
    public function resume(): bool
    {
        return $this->update(['status' => 'active']);
    }

    /**
     * Cancel the recurring appointment series.
     */
    public function cancel(): bool
    {
        // Cancel future appointments
        $this->interviews()
            ->where('status', 'scheduled')
            ->where('scheduled_at', '>', now())
            ->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason' => 'Recurring series cancelled'
            ]);

        return $this->update(['status' => 'cancelled']);
    }

    /**
     * Get human-readable recurrence description.
     */
    public function getRecurrenceDescriptionAttribute(): string
    {
        $interval = $this->recurrence_interval > 1 ? " {$this->recurrence_interval}" : '';
        
        $pattern = match($this->recurrence_pattern) {
            'weekly' => $interval . ' week' . ($this->recurrence_interval > 1 ? 's' : ''),
            'biweekly' => 'every 2 weeks',
            'monthly' => $interval . ' month' . ($this->recurrence_interval > 1 ? 's' : ''),
            'quarterly' => 'every 3 months',
            default => $this->recurrence_pattern,
        };

        $days = '';
        if ($this->recurrence_days && !empty($this->recurrence_days)) {
            $days = ' on ' . implode(', ', array_map('ucfirst', $this->recurrence_days));
        }

        return "Every {$pattern}{$days}";
    }
}