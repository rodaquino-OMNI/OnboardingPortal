<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * QuestionnaireTemplate Model
 *
 * Represents a questionnaire template with detailed configuration.
 * This is an alias/extension of the Questionnaire model with additional
 * attributes expected by QuestionnaireService.
 *
 * Note: This model provides compatibility with legacy code that expects
 * QuestionnaireTemplate. The underlying table is 'questionnaires'.
 *
 * @property int $id
 * @property int $user_id
 * @property int $version
 * @property string $name Questionnaire name (extracted from schema_json)
 * @property string $code Questionnaire code identifier
 * @property string $description Questionnaire description
 * @property string $type Questionnaire type (e.g., 'health', 'survey')
 * @property int $estimated_minutes Estimated completion time
 * @property array $sections Question sections (from schema_json)
 * @property array $scoring_rules Scoring configuration
 * @property array $risk_assessment_rules Risk assessment rules
 * @property array $languages Supported languages
 * @property string $status
 * @property \Carbon\Carbon|null $published_at
 * @property bool $is_active
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 *
 * @see app/Modules/Health/Models/Questionnaire.php
 * @see app/Modules/Health/Services/QuestionnaireService.php
 */
class QuestionnaireTemplate extends Model
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
     * The accessors to append to the model's array form.
     *
     * @var array
     */
    protected $appends = [
        'name',
        'code',
        'description',
        'type',
        'estimated_minutes',
        'sections',
        'scoring_rules',
        'risk_assessment_rules',
        'languages',
    ];

    /**
     * Get questionnaire name from schema_json.
     *
     * @return string
     */
    public function getNameAttribute(): string
    {
        return $this->schema_json['title'] ?? 'Untitled Questionnaire';
    }

    /**
     * Get questionnaire code.
     *
     * @return string
     */
    public function getCodeAttribute(): string
    {
        return $this->schema_json['code'] ?? 'questionnaire_' . $this->id;
    }

    /**
     * Get questionnaire description from schema_json.
     *
     * @return string
     */
    public function getDescriptionAttribute(): string
    {
        return $this->schema_json['description'] ?? '';
    }

    /**
     * Get questionnaire type.
     *
     * @return string
     */
    public function getTypeAttribute(): string
    {
        return $this->schema_json['type'] ?? 'health';
    }

    /**
     * Get estimated completion minutes.
     *
     * @return int
     */
    public function getEstimatedMinutesAttribute(): int
    {
        return $this->schema_json['estimated_minutes'] ?? 5;
    }

    /**
     * Get sections from schema_json.
     *
     * @return array
     */
    public function getSectionsAttribute(): array
    {
        return $this->schema_json['sections'] ?? [];
    }

    /**
     * Get scoring rules from schema_json.
     *
     * @return array
     */
    public function getScoringRulesAttribute(): array
    {
        return $this->schema_json['scoring_rules'] ?? [];
    }

    /**
     * Get risk assessment rules from schema_json.
     *
     * @return array
     */
    public function getRiskAssessmentRulesAttribute(): array
    {
        return $this->schema_json['risk_assessment_rules'] ?? [];
    }

    /**
     * Get supported languages.
     *
     * @return array
     */
    public function getLanguagesAttribute(): array
    {
        return $this->schema_json['languages'] ?? ['en'];
    }

    /**
     * Relationship: Has many responses.
     *
     * @return HasMany
     */
    public function responses(): HasMany
    {
        return $this->hasMany(\App\Modules\Health\Models\QuestionnaireResponse::class, 'questionnaire_id');
    }

    /**
     * Scope: Active templates only.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: Published templates only.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopePublished($query)
    {
        return $query->whereNotNull('published_at');
    }
}
