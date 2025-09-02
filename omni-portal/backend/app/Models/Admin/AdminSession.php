<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * AdminSession Model
 * 
 * Tracks admin user sessions for security and audit purposes
 */
class AdminSession extends Model
{
    protected $fillable = [
        'user_id',
        'session_id',
        'ip_address',
        'user_agent',
        'device_info',
        'login_at',
        'last_activity_at',
        'logout_at',
        'logout_reason',
        'is_active',
        'security_flags',
        'permissions_snapshot',
    ];

    protected $casts = [
        'device_info' => 'array',
        'security_flags' => 'array',
        'permissions_snapshot' => 'array',
        'login_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'logout_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    /**
     * Get the user this session belongs to
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope query to only active sessions
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope query to recent sessions within specified minutes
     */
    public function scopeRecent($query, $minutes = 30)
    {
        return $query->where('last_activity_at', '>=', now()->subMinutes($minutes));
    }

    /**
     * Scope query to sessions from a specific IP
     */
    public function scopeFromIp($query, $ipAddress)
    {
        return $query->where('ip_address', $ipAddress);
    }

    /**
     * Check if session is expired (inactive for more than specified minutes)
     */
    public function isExpired($inactiveMinutes = 30): bool
    {
        if (!$this->is_active) {
            return true;
        }
        
        return $this->last_activity_at->addMinutes($inactiveMinutes)->isPast();
    }

    /**
     * Mark session as logged out
     */
    public function logout($reason = 'manual'): void
    {
        $this->update([
            'is_active' => false,
            'logout_at' => now(),
            'logout_reason' => $reason,
        ]);
    }

    /**
     * Update last activity timestamp
     */
    public function touchActivity(): void
    {
        $this->update(['last_activity_at' => now()]);
    }

    /**
     * Add a security flag to the session
     */
    public function addSecurityFlag($flag, $details = null): void
    {
        $flags = $this->security_flags ?? [];
        $flags[] = [
            'flag' => $flag,
            'details' => $details,
            'timestamp' => now()->toISOString(),
        ];
        
        $this->update(['security_flags' => $flags]);
    }

    /**
     * Get session duration in minutes
     */
    public function getDurationInMinutes(): ?int
    {
        if (!$this->login_at) {
            return null;
        }
        
        $endTime = $this->logout_at ?? now();
        return $this->login_at->diffInMinutes($endTime);
    }
}