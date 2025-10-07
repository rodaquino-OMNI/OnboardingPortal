<?php

namespace App\Modules\Health\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;
use App\Traits\EncryptsAttributes;
use App\Modules\Health\Guards\PHIEncryptionGuard;

/**
 * QuestionnaireResponse Model
 *
 * Stores encrypted health questionnaire responses with PHI protection.
 *
 * Part of Phase 1 - Database Schema with PHI Encryption (ADR-004)
 * Implements Slice C following SPARC methodology
 *
 * CRITICAL SECURITY IMPLEMENTATION:
 * - Uses EncryptsAttributes trait for automatic AES-256-GCM encryption
 * - answers_encrypted_json: ENCRYPTED storage of all user responses (PHI)
 * - answers_hash: SHA-256 hash for deduplication without decryption
 * - score_redacted: Deterministic risk score (0-100) without PHI
 * - risk_band: Categorical risk level (low, moderate, high, critical)
 *
 * ENCRYPTION CONFIGURATION:
 * - protected $encrypted = ['answers_encrypted_json']
 * - protected $hashed = ['answers_encrypted_json' => 'answers_hash']
 * - Automatic encryption on save, decryption on retrieve
 * - Hash auto-generated for deduplication checks
 *
 * AUDIT LOGGING:
 * - All access to answers_encrypted_json logged via EncryptsAttributes trait
 * - Create/update operations linked to audit_logs via audit_ref
 * - No PHI in Laravel logs (answers_encrypted_json in $hidden)
 *
 * SECURITY RULES:
 * 1. NEVER expose answers_encrypted_json via API
 * 2. NEVER log decrypted answers
 * 3. ALWAYS use scopes for user isolation
 * 4. Score must be deterministic (same answers = same score)
 * 5. Audit trail required for compliance
 *
 * @property int $id
 * @property int $questionnaire_id
 * @property int $user_id
 * @property string $answers_encrypted_json ENCRYPTED PHI data
 * @property string $answers_hash SHA-256 hash for deduplication
 * @property int|null $score_redacted Redacted risk score 0-100
 * @property string|null $risk_band Risk category (low, moderate, high, critical)
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property string|null $audit_ref Reference to audit_logs
 * @property array|null $metadata Non-PHI metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @property-read Questionnaire $questionnaire
 * @property-read User $user
 *
 * @see app/Traits/EncryptsAttributes.php
 * @see app/Modules/Health/Models/Questionnaire.php
 * @see docs/phase8/ENCRYPTION_POLICY.md
 */
class QuestionnaireResponse extends Model
{
    use HasFactory, EncryptsAttributes, PHIEncryptionGuard;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'questionnaire_responses';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'questionnaire_id',
        'user_id',
        'answers_encrypted_json',
        'score_redacted',
        'risk_band',
        'submitted_at',
        'audit_ref',
        'metadata',
    ];

    /**
     * Encrypted attributes (field-level encryption via EncryptsAttributes trait)
     *
     * CRITICAL: answers_encrypted_json contains ALL PHI
     * Automatically encrypted on save, decrypted on retrieve using AES-256-GCM
     *
     * @var array<int, string>
     */
    protected $encrypted = [
        'answers_encrypted_json',
    ];

    /**
     * Hash column mappings for searchable encrypted fields
     *
     * Format: ['encrypted_field' => 'hash_column_name']
     * SHA-256 hash auto-generated for deduplication without decryption
     *
     * @var array<string, string>
     */
    protected $hashed = [
        'answers_encrypted_json' => 'answers_hash',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * CRITICAL: NEVER expose encrypted data or hash in API responses
     * This prevents PHI leakage and ensures compliance with ADR-004
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'answers_encrypted_json',  // NEVER expose encrypted PHI
        'answers_hash',            // Hash column hidden from API
    ];

    /**
     * The attributes that should be cast.
     *
     * Note: answers_encrypted_json is automatically decrypted by EncryptsAttributes
     * trait before casting to array. The trait handles encryption/decryption
     * transparently.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'answers_encrypted_json' => 'array',  // Auto-decrypted then cast
        'score_redacted' => 'integer',
        'metadata' => 'array',
        'submitted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Risk band constants for type safety
     */
    public const RISK_BAND_LOW = 'low';
    public const RISK_BAND_MODERATE = 'moderate';
    public const RISK_BAND_HIGH = 'high';
    public const RISK_BAND_CRITICAL = 'critical';

    /**
     * Get the questionnaire template for this response.
     *
     * @return BelongsTo
     */
    public function questionnaire(): BelongsTo
    {
        return $this->belongsTo(Questionnaire::class);
    }

    /**
     * Get the user who submitted this response.
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope: Filter only submitted responses.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeSubmitted($query)
    {
        return $query->whereNotNull('submitted_at');
    }

    /**
     * Scope: Filter by risk band.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $riskBand
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByRiskBand($query, string $riskBand)
    {
        return $query->where('risk_band', $riskBand);
    }

    /**
     * Scope: Filter by score range.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param int $min
     * @param int $max
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByScoreRange($query, int $min, int $max)
    {
        return $query->whereBetween('score_redacted', [$min, $max]);
    }

    /**
     * Scope: Filter responses for current authenticated user only.
     *
     * SECURITY: Ensures users can only access their own responses
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOwnedBy($query)
    {
        return $query->where('user_id', auth()->id());
    }

    /**
     * Check if response has been submitted.
     *
     * @return bool
     */
    public function isSubmitted(): bool
    {
        return !is_null($this->submitted_at);
    }

    /**
     * Mark response as submitted.
     *
     * @return bool
     */
    public function markAsSubmitted(): bool
    {
        $this->submitted_at = now();

        return $this->save();
    }

    /**
     * Calculate and set risk band based on score.
     *
     * Risk bands:
     * - low: 0-24
     * - moderate: 25-49
     * - high: 50-74
     * - critical: 75-100
     *
     * @return void
     */
    public function calculateRiskBand(): void
    {
        if (is_null($this->score_redacted)) {
            $this->risk_band = null;
            return;
        }

        $score = $this->score_redacted;

        if ($score >= 0 && $score <= 24) {
            $this->risk_band = self::RISK_BAND_LOW;
        } elseif ($score >= 25 && $score <= 49) {
            $this->risk_band = self::RISK_BAND_MODERATE;
        } elseif ($score >= 50 && $score <= 74) {
            $this->risk_band = self::RISK_BAND_HIGH;
        } else {
            $this->risk_band = self::RISK_BAND_CRITICAL;
        }
    }

    /**
     * Get decrypted answers (use with caution, audit logged).
     *
     * SECURITY WARNING: This method decrypts PHI.
     * - Access is automatically logged by EncryptsAttributes trait
     * - Only use when absolutely necessary
     * - Never expose this data via API
     *
     * @return array|null
     */
    public function getDecryptedAnswers(): ?array
    {
        // Access to answers_encrypted_json triggers audit logging
        return $this->answers_encrypted_json;
    }

    /**
     * Set encrypted answers and auto-calculate hash.
     *
     * @param array $answers
     * @return void
     */
    public function setEncryptedAnswers(array $answers): void
    {
        // EncryptsAttributes trait handles encryption + hash generation
        $this->answers_encrypted_json = $answers;
    }

    /**
     * Get safe metadata for API responses (no PHI).
     *
     * @return array
     */
    public function getSafeMetadata(): array
    {
        return [
            'id' => $this->id,
            'questionnaire_id' => $this->questionnaire_id,
            'score_redacted' => $this->score_redacted,
            'risk_band' => $this->risk_band,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'metadata' => $this->metadata,
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }

    /**
     * Boot the model.
     *
     * Auto-calculate risk band when score changes
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($response) {
            // Auto-calculate risk band when score is set
            if ($response->isDirty('score_redacted')) {
                $response->calculateRiskBand();
            }
        });
    }
}
