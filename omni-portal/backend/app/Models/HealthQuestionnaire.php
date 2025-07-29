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
        'questionnaire_type',
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
        // Controller required fields
        'status',
        'current_section',
        'started_at',
        'last_saved_at',
        'ai_insights',
        'risk_scores',
        'metadata',
        // Fraud detection fields
        'fraud_detection_score',
        'consistency_score',
        'response_time_analysis',
        // Progressive screening fields
        'progressive_layer',
        'progressive_scores',
        'progressive_actions',
        'progressive_next_steps',
    ];

    protected $casts = [
        'responses' => 'array',
        'recommendations' => 'array',
        'completed_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'follow_up_date' => 'date',
        'follow_up_required' => 'boolean',
        'response_time_analysis' => 'array',
        'progressive_scores' => 'array',
        'progressive_actions' => 'array',
        'progressive_next_steps' => 'array',
        // New casts for controller fields
        'started_at' => 'datetime',
        'last_saved_at' => 'datetime',
        'ai_insights' => 'array',
        'risk_scores' => 'array',
        'metadata' => 'array',
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

    /**
     * Get sections completed in the questionnaire
     */
    public function getSectionsCompleted(): array
    {
        if (!$this->template || !$this->responses) {
            return [];
        }

        $sectionsCompleted = [];
        $templateSections = $this->template->sections ?? [];
        $responses = $this->responses ?? [];

        foreach ($templateSections as $sectionKey => $section) {
            $questions = $section['questions'] ?? [];
            $sectionResponses = 0;
            
            foreach ($questions as $question) {
                $questionId = $question['id'] ?? $question['key'] ?? null;
                if ($questionId && isset($responses[$questionId])) {
                    $sectionResponses++;
                }
            }
            
            if ($sectionResponses > 0) {
                $sectionsCompleted[] = [
                    'section' => $sectionKey,
                    'name' => $section['name'] ?? $sectionKey,
                    'completed_questions' => $sectionResponses,
                    'total_questions' => count($questions),
                    'completion_percentage' => count($questions) > 0 ? round(($sectionResponses / count($questions)) * 100) : 0
                ];
            }
        }

        return $sectionsCompleted;
    }
}