<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class TelemedicineWaitlist extends Model
{
    use HasFactory;

    protected $table = 'telemedicine_waitlist';

    protected $fillable = [
        'beneficiary_id',
        'appointment_type_id',
        'preferred_professional_id',
        'preferred_time_slots',
        'preferred_days',
        'earliest_date',
        'latest_date',
        'urgency_level',
        'special_requirements',
        'accepts_any_provider',
        'status',
        'matched_at',
        'matched_appointment_id',
        'expires_at',
        'notification_attempts',
        'last_notification_at',
    ];

    protected $casts = [
        'preferred_time_slots' => 'array',
        'preferred_days' => 'array',
        'earliest_date' => 'date',
        'latest_date' => 'date',
        'accepts_any_provider' => 'boolean',
        'matched_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_notification_at' => 'datetime',
    ];

    /**
     * Get the beneficiary for this waitlist entry.
     */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    /**
     * Get the appointment type for this waitlist entry.
     */
    public function appointmentType(): BelongsTo
    {
        return $this->belongsTo(TelemedicineAppointmentType::class, 'appointment_type_id');
    }

    /**
     * Get the preferred healthcare professional.
     */
    public function preferredProfessional(): BelongsTo
    {
        return $this->belongsTo(User::class, 'preferred_professional_id');
    }

    /**
     * Get the matched appointment.
     */
    public function matchedAppointment(): BelongsTo
    {
        return $this->belongsTo(Interview::class, 'matched_appointment_id');
    }

    /**
     * Scope for active waitlist entries.
     */
    public function scopeWaiting($query)
    {
        return $query->where('status', 'waiting')
                    ->where('expires_at', '>', now());
    }

    /**
     * Scope for expired entries.
     */
    public function scopeExpired($query)
    {
        return $query->where('expires_at', '<=', now())
                    ->where('status', 'waiting');
    }

    /**
     * Scope for urgent entries.
     */
    public function scopeUrgent($query)
    {
        return $query->where('urgency_level', 'emergency')
                    ->orWhere('urgency_level', 'urgent');
    }

    /**
     * Scope ordered by priority (urgency and created date).
     */
    public function scopeByPriority($query)
    {
        return $query->orderByRaw("
            CASE urgency_level 
                WHEN 'emergency' THEN 1 
                WHEN 'urgent' THEN 2 
                WHEN 'routine' THEN 3 
                ELSE 4 
            END
        ")->orderBy('created_at');
    }

    /**
     * Check if an interview slot matches this waitlist entry preferences.
     */
    public function matchesSlot(InterviewSlot $slot): bool
    {
        // Check date range
        if ($slot->date < $this->earliest_date || $slot->date > $this->latest_date) {
            return false;
        }

        // Check preferred days
        if ($this->preferred_days && !empty($this->preferred_days)) {
            $dayName = strtolower($slot->date->format('l'));
            if (!in_array($dayName, $this->preferred_days)) {
                return false;
            }
        }

        // Check preferred time slots
        if ($this->preferred_time_slots && !empty($this->preferred_time_slots)) {
            $slotStart = Carbon::parse($slot->start_time);
            $slotEnd = Carbon::parse($slot->end_time);
            
            foreach ($this->preferred_time_slots as $timeSlot) {
                $prefStart = Carbon::parse($timeSlot['start']);
                $prefEnd = Carbon::parse($timeSlot['end']);
                
                // Check if slot overlaps with preferred time
                if ($slotStart < $prefEnd && $slotEnd > $prefStart) {
                    break; // Found a match
                }
            }
            
            // If we got here without breaking, no time match found
            if (!isset($timeSlot)) {
                return false;
            }
        }

        // Check preferred professional
        if ($this->preferred_professional_id && !$this->accepts_any_provider) {
            if ($slot->healthcare_professional_id !== $this->preferred_professional_id) {
                return false;
            }
        }

        // Check if slot supports this appointment type
        if ($slot->supported_appointment_types) {
            if (!in_array($this->appointment_type_id, $slot->supported_appointment_types)) {
                return false;
            }
        }

        // Check if slot is available for telemedicine
        if (!$slot->is_telemedicine_enabled) {
            return false;
        }

        // Check if slot has capacity
        if (!$slot->hasCapacity()) {
            return false;
        }

        return true;
    }

    /**
     * Find matching available slots for this waitlist entry.
     */
    public function findMatchingSlots(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        $query = InterviewSlot::available()
            ->where('is_telemedicine_enabled', true)
            ->where('date', '>=', $this->earliest_date)
            ->where('date', '<=', $this->latest_date);

        // Apply preferred professional filter if specified and not accepting any provider
        if ($this->preferred_professional_id && !$this->accepts_any_provider) {
            $query->where('healthcare_professional_id', $this->preferred_professional_id);
        }

        // Apply preferred days filter
        if ($this->preferred_days && !empty($this->preferred_days)) {
            $query->whereIn(\DB::raw('LOWER(DAYNAME(date))'), $this->preferred_days);
        }

        // Get potential slots and filter by time preferences
        $slots = $query->orderBy('date')->orderBy('start_time')->limit($limit * 2)->get();

        return $slots->filter(function ($slot) {
            return $this->matchesSlot($slot);
        })->take($limit);
    }

    /**
     * Attempt to match this waitlist entry with an available slot.
     */
    public function attemptMatch(): ?Interview
    {
        if ($this->status !== 'waiting' || $this->expires_at <= now()) {
            return null;
        }

        $matchingSlots = $this->findMatchingSlots(1);
        
        if ($matchingSlots->isEmpty()) {
            return null;
        }

        $slot = $matchingSlots->first();
        
        // Create the appointment
        $appointment = Interview::create([
            'beneficiary_id' => $this->beneficiary_id,
            'interview_slot_id' => $slot->id,
            'healthcare_professional_id' => $slot->healthcare_professional_id,
            'appointment_type_id' => $this->appointment_type_id,
            'booking_reference' => 'WL-' . uniqid(),
            'status' => 'scheduled',
            'scheduled_at' => Carbon::parse($slot->date->format('Y-m-d') . ' ' . $slot->start_time),
            'is_telemedicine' => true,
            'interview_type' => 'waitlist_matched',
            'meeting_type' => 'video_conference',
            'timezone' => 'America/Sao_Paulo',
            'booked_at' => now(),
        ]);

        // Update the slot
        $slot->increment('current_bookings');

        // Update waitlist entry
        $this->update([
            'status' => 'matched',
            'matched_at' => now(),
            'matched_appointment_id' => $appointment->id,
        ]);

        // Send notification to beneficiary
        $this->sendMatchNotification($appointment);

        return $appointment;
    }

    /**
     * Send notification about match found.
     */
    private function sendMatchNotification(Interview $appointment): void
    {
        TelemedicineNotification::create([
            'interview_id' => $appointment->id,
            'recipient_user_id' => $this->beneficiary->user_id,
            'notification_type' => 'waitlist_match_found',
            'delivery_method' => 'email',
            'scheduled_for' => now(),
            'message_data' => [
                'appointment_id' => $appointment->id,
                'appointment_date' => $appointment->scheduled_at->format('Y-m-d H:i'),
                'professional_name' => $appointment->healthcareProfessional->name,
                'appointment_type' => $this->appointmentType->name,
            ],
            'expires_at' => now()->addHours(24),
        ]);
    }

    /**
     * Cancel this waitlist entry.
     */
    public function cancel(): bool
    {
        return $this->update(['status' => 'cancelled']);
    }

    /**
     * Mark as expired.
     */
    public function markExpired(): bool
    {
        return $this->update(['status' => 'expired']);
    }

    /**
     * Extend the expiration time.
     */
    public function extend(int $days = 7): bool
    {
        return $this->update([
            'expires_at' => $this->expires_at->addDays($days)
        ]);
    }

    /**
     * Get priority score for sorting (lower is higher priority).
     */
    public function getPriorityScoreAttribute(): int
    {
        $urgencyScore = match($this->urgency_level) {
            'emergency' => 1,
            'urgent' => 10,
            'routine' => 100,
            default => 1000,
        };

        // Add time waiting factor (older entries get higher priority)
        $daysWaiting = $this->created_at->diffInDays(now());
        
        return $urgencyScore - $daysWaiting;
    }

    /**
     * Check if this entry should receive another notification.
     */
    public function shouldSendReminder(): bool
    {
        if ($this->status !== 'waiting') {
            return false;
        }

        // Don't send too many notifications
        if ($this->notification_attempts >= 3) {
            return false;
        }

        // Send reminder if no notification sent yet, or if last notification was > 24 hours ago
        if (!$this->last_notification_at) {
            return true;
        }

        return $this->last_notification_at->diffInHours(now()) >= 24;
    }

    /**
     * Record a notification attempt.
     */
    public function recordNotificationAttempt(): void
    {
        $this->increment('notification_attempts');
        $this->update(['last_notification_at' => now()]);
    }

    /**
     * Get human-readable status.
     */
    public function getStatusDisplayAttribute(): string
    {
        return match($this->status) {
            'waiting' => 'Waiting for Match',
            'matched' => 'Match Found',
            'expired' => 'Expired',
            'cancelled' => 'Cancelled',
            default => ucfirst($this->status),
        };
    }

    /**
     * Get human-readable urgency level.
     */
    public function getUrgencyDisplayAttribute(): string
    {
        return match($this->urgency_level) {
            'emergency' => 'Emergency',
            'urgent' => 'Urgent',
            'routine' => 'Routine',
            default => ucfirst($this->urgency_level),
        };
    }
}