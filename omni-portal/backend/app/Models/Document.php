<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToTenant;

class Document extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'beneficiary_id',
        'company_id',
        'uploaded_by',
        'document_type',
        'type',
        'document_category',
        'description',
        'original_name',
        'original_filename',
        'stored_name',
        'file_path',
        'mime_type',
        'file_size',
        'file_extension',
        'status',
        'rejection_reason',
        'verified_by',
        'verified_at',
        'expiration_date',
        'is_encrypted',
        'encryption_key',
        'metadata',
        'ocr_data',
        'extracted_data',
        'validation_results',
        'validation_status',
        'processing_method',
        'processing_options',
        'quality_score',
        'confidence_score',
        'processing_started_at',
        'processing_completed_at',
        'processed_at',
        'error_message',
        'is_sensitive',
        'checksum',
        'version',
        'parent_document_id',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
        'expiration_date' => 'date',
        'processed_at' => 'datetime',
        'processing_started_at' => 'datetime',
        'processing_completed_at' => 'datetime',
        'metadata' => 'array',
        'ocr_data' => 'array',
        'extracted_data' => 'array',
        'validation_results' => 'array',
        'processing_options' => 'array',
        'quality_score' => 'float',
        'confidence_score' => 'float',
        'is_encrypted' => 'boolean',
        'is_sensitive' => 'boolean',
        'file_size' => 'integer',
        'version' => 'integer',
    ];

    /**
     * Get the beneficiary that owns the document.
     */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    /**
     * Get the document type.
     */
    public function documentType(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class);
    }

    /**
     * Get the user who verified the document.
     */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /**
     * Get the user who uploaded the document.
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}