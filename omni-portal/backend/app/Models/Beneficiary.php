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
        'cpf',
        'full_name',
        'birth_date',
        'gender',
        'phone',
        'mobile_phone',
        'address',
        'number',
        'complement',
        'neighborhood',
        'city',
        'state',
        'zip_code',
        'country',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relationship',
        'marital_status',
        'occupation',
        'monthly_income',
        'has_health_insurance',
        'health_insurance_provider',
        'health_insurance_number',
        'onboarding_status',
        'onboarding_step',
        'onboarding_completed_at',
        'custom_fields',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'onboarding_completed_at' => 'datetime',
        'custom_fields' => 'array',
        'has_health_insurance' => 'boolean',
        'monthly_income' => 'decimal:2',
        'onboarding_step' => 'integer',
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
            ->withPivot('earned_at')
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