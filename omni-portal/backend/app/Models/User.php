<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Traits\EncryptsAttributes;

/**
 * User Model
 *
 * Represents a user in the onboarding portal system
 * with gamification tracking and authentication
 *
 * Security Features (ADR-004):
 * - Field-level encryption for PHI/PII (cpf, birthdate, phone, address)
 * - SHA-256 hash columns for searchable encrypted fields
 * - Automatic audit logging for sensitive field access
 *
 * @see docs/phase8/ENCRYPTION_POLICY.md
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-004
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, EncryptsAttributes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'email',
        'password',
        'name',
        'cpf',
        'birthdate',
        'phone',
        'address',
        'lgpd_consent',
        'terms_accepted',
        'email_verification_token',
        'email_verified_at',
        'points_balance',
        'current_level',
        'current_streak',
        'last_action_at',
        'streak_started_at',
    ];

    /**
     * Encrypted attributes (field-level encryption via EncryptsAttributes trait)
     *
     * @var array<int, string>
     */
    protected $encrypted = [
        'cpf',
        'birthdate',
        'phone',
        'address',
    ];

    /**
     * Hash column mappings for searchable encrypted fields
     * Format: ['encrypted_field' => 'hash_column_name']
     *
     * @var array<string, string>
     */
    protected $hashed = [
        'cpf' => 'cpf_hash',
        'phone' => 'phone_hash',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'email_verification_token',
        'cpf_hash',      // Hide hash columns from API responses
        'phone_hash',    // Hide hash columns from API responses
    ];

    /**
     * The attributes that should be cast.
     *
     * Note: Encrypted fields (cpf, birthdate, phone, address) are automatically
     * decrypted by EncryptsAttributes trait before casting.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'lgpd_consent' => 'boolean',
        'terms_accepted' => 'boolean',
        'points_balance' => 'integer',
        'current_level' => 'integer',
        'current_streak' => 'integer',
        'last_action_at' => 'datetime',
        'streak_started_at' => 'datetime',
        'birthdate' => 'date',
        'address' => 'json',
    ];

    /**
     * Get hashed user ID for analytics (SHA-256)
     * IMPORTANT: Never send plain user_id to analytics
     */
    public function getHashedIdAttribute(): string
    {
        return hash('sha256', $this->id);
    }
}
