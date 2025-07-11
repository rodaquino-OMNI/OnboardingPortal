<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'is_required',
        'max_file_size',
        'allowed_extensions',
        'category',
        'sort_order',
        'validation_rules',
        'example_file',
        'instructions',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'allowed_extensions' => 'array',
        'validation_rules' => 'array',
    ];
}