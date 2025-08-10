<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * AdminUserRole Model
 * 
 * Pivot model for admin_user_roles table
 * Manages the assignment of admin roles to users
 */
class AdminUserRole extends Model
{
    protected $fillable = [
        'user_id',
        'admin_role_id',
        'assigned_at',
        'expires_at',
        'assigned_by',
        'assignment_reason',
        'is_active',
        'metadata',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
        'metadata' => 'array',
    ];

    /**
     * Get the user this role assignment belongs to
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the admin role being assigned
     */
    public function adminRole(): BelongsTo
    {
        return $this->belongsTo(AdminRole::class);
    }

    /**
     * Get the user who made this assignment
     */
    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    /**
     * Check if this role assignment has expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    /**
     * Check if this role assignment is currently valid
     */
    public function isValid(): bool
    {
        return $this->is_active && !$this->isExpired();
    }

    /**
     * Scope query to only active assignments
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)
                    ->where(function ($q) {
                        $q->whereNull('expires_at')
                          ->orWhere('expires_at', '>', now());
                    });
    }

    /**
     * Scope query to only expired assignments
     */
    public function scopeExpired($query)
    {
        return $query->where('expires_at', '<', now());
    }

    /**
     * Deactivate this role assignment
     */
    public function deactivate(): void
    {
        $this->update(['is_active' => false]);
    }

    /**
     * Extend the expiration date
     */
    public function extend($days = 30): void
    {
        $newExpiry = $this->expires_at 
            ? $this->expires_at->addDays($days) 
            : now()->addDays($days);
            
        $this->update(['expires_at' => $newExpiry]);
    }
}