<?php

namespace App\Modules\Health\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\User;

/**
 * Questionnaire Model
 *
 * Represents a health questionnaire template/version in the system.
 * Stores question structure and configuration (no PHI).
 *
 * Part of Phase 1 - Database Schema for Health Questionnaire System
 * Implements Slice C following SPARC methodology
 *
 * Features:
 * - Versioning support for regulatory compliance
 * - JSON schema storage for flexible question structures
 * - Status lifecycle: draft -> submitted -> reviewed
 * - Multi-tenancy ready (future company_id support)
 *
 * Security:
 * - No PHI stored in this table (template only)
 * - User responses stored separately in QuestionnaireResponse
 * - Scopes for filtering active/published versions
 *
 * @property int $id
 * @property int $user_id Creator/owner of this version
 * @property int $version Version number
 * @property array $schema_json Question structure (cast to array)
 * @property string $status Lifecycle status (draft, submitted, reviewed)
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property bool $is_active Whether this version is currently active
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @property-read User $user Creator of this questionnaire
 * @property-read \Illuminate\Database\Eloquent\Collection|QuestionnaireResponse[] $responses
 *
 * @see app/Modules/Health/Models/QuestionnaireResponse.php
 * @see docs/phase8/ENCRYPTION_POLICY.md
 */
class Questionnaire extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'questionnaires';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'version',
        'schema_json',
        'status',
        'published_at',
        'is_active',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'schema_json' => 'array',
        'is_active' => 'boolean',
        'published_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [];

    /**
     * Status constants for type safety
     */
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_REVIEWED = 'reviewed';

    /**
     * Get the user who created this questionnaire.
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all responses for this questionnaire.
     *
     * @return HasMany
     */
    public function responses(): HasMany
    {
        return $this->hasMany(QuestionnaireResponse::class);
    }

    /**
     * Scope: Filter only active questionnaires.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: Filter only published questionnaires.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopePublished($query)
    {
        return $query->whereNotNull('published_at');
    }

    /**
     * Scope: Filter by status.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $status
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Check if questionnaire is in draft status.
     *
     * @return bool
     */
    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    /**
     * Check if questionnaire is submitted.
     *
     * @return bool
     */
    public function isSubmitted(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }

    /**
     * Check if questionnaire is reviewed.
     *
     * @return bool
     */
    public function isReviewed(): bool
    {
        return $this->status === self::STATUS_REVIEWED;
    }

    /**
     * Publish this questionnaire version.
     *
     * @return bool
     */
    public function publish(): bool
    {
        $this->published_at = now();
        $this->status = self::STATUS_REVIEWED;
        $this->is_active = true;

        return $this->save();
    }

    /**
     * Deactivate this questionnaire version.
     *
     * @return bool
     */
    public function deactivate(): bool
    {
        $this->is_active = false;

        return $this->save();
    }

    /**
     * Get total number of responses.
     *
     * @return int
     */
    public function getResponseCountAttribute(): int
    {
        return $this->responses()->count();
    }

    /**
     * Get number of submitted responses.
     *
     * @return int
     */
    public function getSubmittedResponseCountAttribute(): int
    {
        return $this->responses()->submitted()->count();
    }
}
