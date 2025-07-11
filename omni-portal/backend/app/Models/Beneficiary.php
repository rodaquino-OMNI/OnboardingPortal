<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Beneficiary extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'company_id',
        'full_name',
        'email',
        'phone',
        'document_number',
        'date_of_birth',
        'gender',
        'marital_status',
        'address_street',
        'address_number',
        'address_complement',
        'address_neighborhood',
        'address_city',
        'address_state',
        'address_zip_code',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relationship',
        'profile_picture',
        'status',
        'onboarding_step',
        'onboarding_completed_at',
        'health_plan_type',
        'health_plan_number',
        'health_plan_start_date',
        'notes',
        'dependents_count',
        'preferred_language',
        'communication_preferences',
        'is_vip',
        'company_department',
        'employee_id',
        'manager_name',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'health_plan_start_date' => 'date',
        'onboarding_completed_at' => 'datetime',
        'communication_preferences' => 'array',
        'is_vip' => 'boolean',
        'dependents_count' => 'integer',
    ];

    /**
     * Get the user associated with the beneficiary.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the company associated with the beneficiary.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the gamification progress for the beneficiary.
     */
    public function gamificationProgress(): HasOne
    {
        return $this->hasOne(GamificationProgress::class);
    }

    /**
     * Get the badges earned by the beneficiary.
     */
    public function badges(): BelongsToMany
    {
        return $this->belongsToMany(GamificationBadge::class, 'beneficiary_badges')
            ->withPivot('earned_at', 'notified_at')
            ->withTimestamps();
    }

    /**
     * Get the documents uploaded by the beneficiary.
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    /**
     * Get the health questionnaires completed by the beneficiary.
     */
    public function healthQuestionnaires(): HasMany
    {
        return $this->hasMany(HealthQuestionnaire::class);
    }

    /**
     * Get the interviews scheduled by the beneficiary.
     */
    public function interviews(): HasMany
    {
        return $this->hasMany(Interview::class);
    }

    /**
     * Get or create gamification progress.
     */
    public function getOrCreateGamificationProgress(): GamificationProgress
    {
        return $this->gamificationProgress()->firstOrCreate([
            'beneficiary_id' => $this->id
        ]);
    }

    /**
     * Check if beneficiary has earned a specific badge.
     */
    public function hasBadge(string $badgeSlug): bool
    {
        return $this->badges()->where('slug', $badgeSlug)->exists();
    }

    /**
     * Get current level information.
     */
    public function getCurrentLevel(): ?GamificationLevel
    {
        $progress = $this->getOrCreateGamificationProgress();
        return GamificationLevel::where('level_number', $progress->current_level)->first();
    }
}