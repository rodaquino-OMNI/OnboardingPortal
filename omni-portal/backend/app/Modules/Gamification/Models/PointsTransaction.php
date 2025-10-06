<?php

namespace App\Modules\Gamification\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * PointsTransaction Model
 *
 * Represents an immutable points transaction record.
 * All point changes MUST go through this model for audit trail.
 *
 * @property int $id
 * @property int $user_id
 * @property string $idempotency_key SHA-256 hash (unique constraint)
 * @property string $action Action identifier
 * @property int $points Point value (positive = award, negative = deduction)
 * @property array $metadata Additional context (no PHI)
 * @property string $source 'system', 'manual', 'bonus'
 * @property \Carbon\Carbon $processed_at
 *
 * @see docs/GAMIFICATION_SPEC.md - Point values and rules
 * @see App\Modules\Gamification\Services\PointsEngine - Transaction creator
 */
class PointsTransaction extends Model
{
    /**
     * Table name
     */
    protected $table = 'points_transactions';

    /**
     * Disable updated_at (transactions are immutable)
     */
    public $timestamps = false;

    /**
     * Fillable fields (mass assignment)
     */
    protected $fillable = [
        'user_id',
        'idempotency_key',
        'action',
        'points',
        'metadata',
        'source',
        'processed_at',
    ];

    /**
     * Guarded fields (never mass-assignable)
     */
    protected $guarded = [
        'id',
    ];

    /**
     * Cast attributes
     */
    protected $casts = [
        'metadata' => 'array',
        'processed_at' => 'datetime',
        'points' => 'integer',
    ];

    /**
     * Relationship: Transaction belongs to User
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope: Get transactions for a specific action
     */
    public function scopeForAction($query, string $action)
    {
        return $query->where('action', $action);
    }

    /**
     * Scope: Get transactions within date range
     */
    public function scopeWithinDateRange($query, \DateTimeInterface $start, \DateTimeInterface $end)
    {
        return $query->whereBetween('processed_at', [$start, $end]);
    }

    /**
     * Accessor: Get human-readable action name
     */
    public function getActionNameAttribute(): string
    {
        return match($this->action) {
            'registration' => 'Registration Complete',
            'profile_basic' => 'Profile Created',
            'profile_optional' => 'Profile Enhanced',
            'health_question_required' => 'Health Question Answered',
            'health_question_optional' => 'Optional Health Question',
            'document_upload' => 'Document Uploaded',
            'document_approved' => 'Document Approved',
            'interview_scheduled' => 'Interview Scheduled',
            'interview_attended' => 'Interview Attended',
            'onboarding_complete' => 'Onboarding Completed',
            default => ucfirst(str_replace('_', ' ', $this->action)),
        };
    }
}
