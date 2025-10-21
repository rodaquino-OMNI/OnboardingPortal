<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * AuditLog Model
 *
 * Immutable audit trail for HIPAA/LGPD compliance.
 * Records all security-relevant actions with context.
 *
 * 5W1H Audit Pattern:
 * - Who: user_id + who (e.g., "user:123", "system")
 * - What: action identifier (e.g., "health.questionnaire.submitted")
 * - When: created_at (automatically recorded)
 * - Where: IP address (hashed for privacy)
 * - How: HTTP method + endpoint or CLI command
 * - Why: Implicitly captured via action + details
 *
 * HIPAA/LGPD Compliance:
 * - 7-year retention (handled by scheduled purge)
 * - IP addresses are hashed (SHA-256)
 * - Append-only (no updates after creation)
 * - Request correlation via request_id
 *
 * PHI Access Tracking:
 * - phi_accessed flag for health data access
 * - resource_type + resource_id for granular tracking
 *
 * @property string $id UUID primary key
 * @property int|null $user_id User ID (nullable for system actions)
 * @property string $who Human-readable identifier (e.g., "user:123")
 * @property string $what Action identifier
 * @property string $where Hashed IP address (SHA-256)
 * @property string $how HTTP method + endpoint or CLI command
 * @property array|null $details Additional context (no PHI)
 * @property string $request_id X-Request-ID for correlation
 * @property string|null $session_id Session identifier
 * @property string|null $action Action performed (simplified for QuestionnaireController)
 * @property string|null $resource_type Resource type (e.g., 'questionnaire_response')
 * @property int|null $resource_id Resource ID
 * @property string|null $ip_address Raw IP address (for QuestionnaireController compatibility)
 * @property string|null $user_agent User agent string
 * @property bool $phi_accessed Whether PHI was accessed
 * @property \Carbon\Carbon $occurred_at When action occurred
 * @property \Carbon\Carbon $created_at When record was created
 * @property \Carbon\Carbon $updated_at When record was last updated
 *
 * @see app/Modules/Audit/Repositories/EloquentAuditLogRepository.php
 * @see app/Modules/Audit/Repositories/AuditLogRepository.php
 * @see app/Http/Controllers/Api/Health/QuestionnaireController.php
 */
class AuditLog extends Model
{
    use HasFactory, HasUuids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'audit_logs';

    /**
     * The primary key type.
     *
     * @var string
     */
    protected $keyType = 'string';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        // 5W1H audit pattern fields
        'user_id',
        'who',
        'what',
        'where',
        'how',
        'details',
        'request_id',
        'session_id',

        // Simplified fields for controller compatibility
        'action',
        'resource_type',
        'resource_id',
        'ip_address',
        'user_agent',
        'phi_accessed',
        'occurred_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'details' => 'array',
        'phi_accessed' => 'boolean',
        'occurred_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array<string>
     */
    protected $hidden = [
        'ip_address', // Sensitive data
        'user_agent', // Sensitive data
        'where',      // Hashed IP
    ];

    /**
     * Get the route key for the model.
     *
     * @return string
     */
    public function getRouteKeyName(): string
    {
        return 'id';
    }

    /**
     * Boot the model.
     *
     * Automatically populate 5W1H fields from simplified fields
     * to maintain compatibility with both audit patterns.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($auditLog) {
            // Auto-populate 5W1H fields if not set
            if (!$auditLog->who && $auditLog->user_id) {
                $auditLog->who = "user:{$auditLog->user_id}";
            } elseif (!$auditLog->who) {
                $auditLog->who = 'system';
            }

            if (!$auditLog->what && $auditLog->action) {
                $auditLog->what = $auditLog->action;
            }

            if (!$auditLog->where && $auditLog->ip_address) {
                $auditLog->where = hash('sha256', $auditLog->ip_address);
            }

            if (!$auditLog->how) {
                $auditLog->how = request()->method() . ' ' . request()->path();
            }

            if (!$auditLog->request_id) {
                $auditLog->request_id = request()->header('X-Request-ID')
                    ?? \Illuminate\Support\Str::uuid();
            }

            if (!$auditLog->occurred_at) {
                $auditLog->occurred_at = now();
            }

            // Build details array from resource info if not set
            if (!$auditLog->details && ($auditLog->resource_type || $auditLog->resource_id)) {
                $auditLog->details = [
                    'resource_type' => $auditLog->resource_type,
                    'resource_id' => $auditLog->resource_id,
                    'phi_accessed' => $auditLog->phi_accessed ?? false,
                ];
            }
        });
    }

    /**
     * Relationship: Belongs to User
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope query to PHI access logs only
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopePhiAccess($query)
    {
        return $query->where('phi_accessed', true);
    }

    /**
     * Scope query to logs by user
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param int $userId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope query to logs by action
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $action
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByAction($query, string $action)
    {
        return $query->where(function ($q) use ($action) {
            $q->where('action', $action)
              ->orWhere('what', $action);
        });
    }

    /**
     * Scope query to logs by request ID
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $requestId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByRequestId($query, string $requestId)
    {
        return $query->where('request_id', $requestId);
    }

    /**
     * Scope query to logs in date range
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param \Carbon\Carbon $start
     * @param \Carbon\Carbon $end
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeInDateRange($query, $start, $end)
    {
        return $query->whereBetween('occurred_at', [$start, $end]);
    }

    /**
     * Scope query to logs older than given date
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param \Carbon\Carbon $date
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOlderThan($query, $date)
    {
        return $query->where('created_at', '<', $date);
    }
}
