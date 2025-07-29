<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminAction extends Model
{
    use HasFactory;

    protected $fillable = [
        'admin_user_id',
        'target_user_id',
        'action_type',
        'action_data',
        'description',
        'ip_address',
        'user_agent',
        'success',
        'error_message',
        'performed_at',
    ];

    protected $casts = [
        'action_data' => 'array',
        'success' => 'boolean',
        'performed_at' => 'datetime',
    ];

    /**
     * The admin user who performed the action
     */
    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }

    /**
     * The target user (if applicable)
     */
    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    /**
     * Log an admin action
     */
    public static function logAction(
        int $adminUserId,
        string $actionType,
        string $description,
        ?int $targetUserId = null,
        ?array $actionData = null,
        bool $success = true,
        ?string $errorMessage = null
    ): self {
        return self::create([
            'admin_user_id' => $adminUserId,
            'target_user_id' => $targetUserId,
            'action_type' => $actionType,
            'action_data' => $actionData,
            'description' => $description,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'success' => $success,
            'error_message' => $errorMessage,
            'performed_at' => now(),
        ]);
    }

    /**
     * Get actions by type
     */
    public function scopeByType($query, string $type)
    {
        return $query->where('action_type', $type);
    }

    /**
     * Get successful actions only
     */
    public function scopeSuccessful($query)
    {
        return $query->where('success', true);
    }

    /**
     * Get failed actions only
     */
    public function scopeFailed($query)
    {
        return $query->where('success', false);
    }

    /**
     * Get recent actions
     */
    public function scopeRecent($query, int $days = 7)
    {
        return $query->where('performed_at', '>=', now()->subDays($days));
    }
}