<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * AdminActionLog Model
 * 
 * Comprehensive audit trail for all admin actions
 * Records who did what, when, and from where
 */
class AdminActionLog extends Model
{
    protected $fillable = [
        'user_id',
        'admin_session_id',
        'action_type',
        'resource_type',
        'resource_id',
        'resource_identifier',
        'action_data',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
        'request_method',
        'request_url',
        'request_payload',
        'response_status',
        'execution_time_ms',
        'risk_level',
        'requires_approval',
        'is_approved',
        'approved_by',
        'approved_at',
        'approval_notes',
        'security_context',
        'is_successful',
    ];

    protected $casts = [
        'action_data' => 'array',
        'old_values' => 'array',
        'new_values' => 'array',
        'request_payload' => 'array',
        'security_context' => 'array',
        'requires_approval' => 'boolean',
        'is_approved' => 'boolean',
        'is_successful' => 'boolean',
        'approved_at' => 'datetime',
        'execution_time_ms' => 'decimal:3',
    ];

    /**
     * Risk level constants
     */
    const RISK_LOW = 'low';
    const RISK_MEDIUM = 'medium';
    const RISK_HIGH = 'high';
    const RISK_CRITICAL = 'critical';

    /**
     * Get the user who performed this action
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the admin session during which this action was performed
     */
    public function adminSession(): BelongsTo
    {
        return $this->belongsTo(AdminSession::class);
    }

    /**
     * Get the user who approved this action (if applicable)
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Scope query to high risk actions
     */
    public function scopeHighRisk($query)
    {
        return $query->whereIn('risk_level', [self::RISK_HIGH, self::RISK_CRITICAL]);
    }

    /**
     * Scope query to actions pending approval
     */
    public function scopePendingApproval($query)
    {
        return $query->where('requires_approval', true)
                    ->whereNull('is_approved');
    }

    /**
     * Scope query to actions by a specific user
     */
    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope query to actions on a specific resource
     */
    public function scopeForResource($query, $resourceType, $resourceId = null)
    {
        $query->where('resource_type', $resourceType);
        
        if ($resourceId !== null) {
            $query->where('resource_id', $resourceId);
        }
        
        return $query;
    }

    /**
     * Scope query to successful actions only
     */
    public function scopeSuccessful($query)
    {
        return $query->where('is_successful', true);
    }

    /**
     * Scope query to failed actions only
     */
    public function scopeFailed($query)
    {
        return $query->where('is_successful', false);
    }

    /**
     * Check if this action is high risk
     */
    public function isHighRisk(): bool
    {
        return in_array($this->risk_level, [self::RISK_HIGH, self::RISK_CRITICAL]);
    }

    /**
     * Check if this action needs approval
     */
    public function needsApproval(): bool
    {
        return $this->requires_approval && !$this->is_approved;
    }

    /**
     * Approve this action
     */
    public function approve($userId, $notes = null): void
    {
        $this->update([
            'is_approved' => true,
            'approved_by' => $userId,
            'approved_at' => now(),
            'approval_notes' => $notes,
        ]);
    }

    /**
     * Reject this action
     */
    public function reject($userId, $notes): void
    {
        $this->update([
            'is_approved' => false,
            'approved_by' => $userId,
            'approved_at' => now(),
            'approval_notes' => $notes,
        ]);
    }

    /**
     * Get a human-readable description of the action
     */
    public function getDescription(): string
    {
        $user = $this->user->name ?? 'Unknown User';
        $action = str_replace('_', ' ', $this->action_type);
        $resource = str_replace('_', ' ', $this->resource_type);
        
        $description = "{$user} performed {$action} on {$resource}";
        
        if ($this->resource_identifier) {
            $description .= " ({$this->resource_identifier})";
        }
        
        return $description;
    }

    /**
     * Calculate the risk score (0-100)
     */
    public function calculateRiskScore(): int
    {
        $score = 0;
        
        // Base score by risk level
        $score += match($this->risk_level) {
            self::RISK_CRITICAL => 75,
            self::RISK_HIGH => 50,
            self::RISK_MEDIUM => 25,
            default => 10,
        };
        
        // Add points for certain action types
        if (in_array($this->action_type, ['delete', 'remove', 'destroy'])) {
            $score += 15;
        }
        
        if (in_array($this->action_type, ['export', 'download'])) {
            $score += 10;
        }
        
        // Add points for failed actions
        if (!$this->is_successful) {
            $score += 10;
        }
        
        // Add points for unusual access patterns
        if ($this->created_at->hour < 6 || $this->created_at->hour > 22) {
            $score += 5;
        }
        
        return min($score, 100);
    }
}