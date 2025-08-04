<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TelemedicineAppointmentType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'default_duration_minutes',
        'base_price',
        'required_documents',
        'preparation_checklist',
        'requires_prescription_review',
        'allows_emergency_booking',
        'advance_booking_days',
        'minimum_notice_hours',
        'specializations_required',
        'is_active',
    ];

    protected $casts = [
        'required_documents' => 'array',
        'preparation_checklist' => 'array',
        'requires_prescription_review' => 'boolean',
        'allows_emergency_booking' => 'boolean',
        'specializations_required' => 'array',
        'is_active' => 'boolean',
        'base_price' => 'decimal:2',
    ];

    /**
     * Get the interviews for this appointment type.
     */
    public function interviews(): HasMany
    {
        return $this->hasMany(Interview::class, 'appointment_type_id');
    }

    /**
     * Get the recurring appointments for this type.
     */
    public function recurringAppointments(): HasMany
    {
        return $this->hasMany(TelemedicineRecurringAppointment::class, 'appointment_type_id');
    }

    /**
     * Get the waitlist entries for this type.
     */
    public function waitlistEntries(): HasMany
    {
        return $this->hasMany(TelemedicineWaitlist::class, 'appointment_type_id');
    }

    /**
     * Scope for active appointment types.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope for emergency booking allowed types.
     */
    public function scopeAllowsEmergencyBooking($query)
    {
        return $query->where('allows_emergency_booking', true);
    }

    /**
     * Check if this appointment type can be booked for the given date.
     */
    public function canBeBookedFor(\DateTime $date): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $now = new \DateTime();
        $daysDifference = $date->diff($now)->days;

        // Check minimum notice
        if ($date->diff($now)->invert === 1 && $date->diff($now)->h < $this->minimum_notice_hours) {
            return false;
        }

        // Check advance booking limit
        if ($daysDifference > $this->advance_booking_days) {
            return false;
        }

        return true;
    }

    /**
     * Get the preparation time needed for this appointment type.
     */
    public function getPreparationTimeMinutes(): int
    {
        // Base preparation time logic - can be customized per appointment type
        return match($this->slug) {
            'initial-consultation' => 15,
            'mental-health' => 20,
            'urgent-care' => 5,
            'follow-up' => 10,
            default => 10,
        };
    }

    /**
     * Check if the healthcare professional has the required specializations.
     */
    public function professionalMeetsRequirements(User $professional): bool
    {
        if (!$this->specializations_required || empty($this->specializations_required)) {
            return true;
        }

        // This would typically check against professional's specializations
        // For now, we'll assume all healthcare professionals meet requirements
        return $professional->user_type === 'healthcare_professional';
    }

    /**
     * Get formatted price display.
     */
    public function getFormattedPriceAttribute(): string
    {
        return '$' . number_format($this->base_price, 2);
    }

    /**
     * Get estimated total duration including preparation.
     */
    public function getTotalDurationMinutesAttribute(): int
    {
        return $this->default_duration_minutes + $this->getPreparationTimeMinutes();
    }

    /**
     * Check if all required documents are available for a beneficiary.
     */
    public function beneficiaryHasRequiredDocuments(Beneficiary $beneficiary): bool
    {
        if (!$this->required_documents || empty($this->required_documents)) {
            return true;
        }

        $beneficiaryDocumentTypes = $beneficiary->documents()
            ->where('status', 'approved')
            ->whereHas('documentType', function ($query) {
                $query->whereIn('name', $this->required_documents);
            })
            ->count();

        return $beneficiaryDocumentTypes >= count($this->required_documents);
    }

    /**
     * Get the next available slot for this appointment type.
     */
    public function getNextAvailableSlot(?User $preferredProfessional = null): ?InterviewSlot
    {
        $query = InterviewSlot::available()
            ->where('is_telemedicine_enabled', true)
            ->whereJsonContains('supported_appointment_types', $this->id)
            ->where('date', '>=', now()->addHours($this->minimum_notice_hours)->toDateString())
            ->orderBy('date')
            ->orderBy('start_time');

        if ($preferredProfessional) {
            $query->where('healthcare_professional_id', $preferredProfessional->id);
        }

        return $query->first();
    }
}