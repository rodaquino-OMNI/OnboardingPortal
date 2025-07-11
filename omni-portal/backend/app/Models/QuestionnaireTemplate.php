<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuestionnaireTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'category_id',
        'questions',
        'scoring_rules',
        'is_active',
        'version',
        'created_by',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'questions' => 'array',
        'scoring_rules' => 'array',
        'is_active' => 'boolean',
        'approved_at' => 'datetime',
    ];
}