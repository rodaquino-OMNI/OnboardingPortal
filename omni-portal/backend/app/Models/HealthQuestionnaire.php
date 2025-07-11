<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HealthQuestionnaire extends Model
{
    use HasFactory;

    protected $fillable = [
        'beneficiary_id',
        'template_id',
        'responses',
        'score',
        'risk_level',
        'completed_at',
        'reviewed_by',
        'reviewed_at',
        'notes',
        'recommendations',
        'follow_up_required',
        'follow_up_date',
    ];

    protected $casts = [
        'responses' => 'array',
        'recommendations' => 'array',
        'completed_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'follow_up_date' => 'date',
        'follow_up_required' => 'boolean',
    ];

    /**
     * Get the beneficiary that owns the questionnaire.
     */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    /**
     * Get the questionnaire template.
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(QuestionnaireTemplate::class, 'template_id');
    }

    /**
     * Get the user who reviewed the questionnaire.
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}