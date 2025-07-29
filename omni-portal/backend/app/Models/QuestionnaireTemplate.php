<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuestionnaireTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'type',
        'health_category_id',
        'sections',
        'scoring_rules',
        'risk_assessment_rules',
        'is_active',
        'version',
        'estimated_minutes',
        'required_for',
        'languages',
    ];

    protected $casts = [
        'sections' => 'array',
        'scoring_rules' => 'array',
        'risk_assessment_rules' => 'array',
        'required_for' => 'array',
        'languages' => 'array',
        'is_active' => 'boolean',
    ];
}