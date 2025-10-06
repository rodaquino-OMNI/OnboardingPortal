<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * AnalyticsEvent Model
 *
 * Represents an analytics event with metadata and context.
 * Events are immutable after creation (no updates).
 *
 * LGPD/HIPAA Compliance:
 * - user_id_hash is HASHED (SHA256), never plaintext
 * - metadata is validated for PII before persistence
 * - Events are pruned after 90 days (see PruneAnalyticsEvents command)
 *
 * Schema Version: 1.0.0
 *
 * @property string $id UUID primary key
 * @property string $event_name Event name (e.g., 'gamification.points_earned')
 * @property string $event_category Extracted category (e.g., 'gamification')
 * @property string $schema_version Schema version for evolution
 * @property string|null $user_id_hash Hashed user ID (SHA256)
 * @property string|null $session_id Session identifier
 * @property array|null $metadata Event-specific data (NO PII)
 * @property array|null $context Request context (endpoint, role, etc.)
 * @property string|null $ip_address Client IP address
 * @property string|null $user_agent Client user agent
 * @property string $environment Environment (production, staging, development)
 * @property \Carbon\Carbon $occurred_at When event occurred
 * @property \Carbon\Carbon $created_at When record was created
 * @property \Carbon\Carbon $updated_at When record was last updated
 *
 * @see app/Services/AnalyticsEventRepository.php - Persistence layer with PII detection
 * @see database/factories/AnalyticsEventFactory.php - Factory for testing
 */
class AnalyticsEvent extends Model
{
    use HasFactory, HasUuids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'analytics_events';

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
        'event_name',
        'event_category',
        'schema_version',
        'user_id_hash',
        'session_id',
        'metadata',
        'context',
        'ip_address',
        'user_agent',
        'environment',
        'occurred_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'metadata' => 'array',
        'context' => 'array',
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
     * Scope query to events in date range
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
     * Scope query to events by category
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $category
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByCategory($query, string $category)
    {
        return $query->where('event_category', $category);
    }

    /**
     * Scope query to events by user hash
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $userIdHash
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByUserHash($query, string $userIdHash)
    {
        return $query->where('user_id_hash', $userIdHash);
    }

    /**
     * Scope query to events older than given date
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param \Carbon\Carbon $date
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOlderThan($query, $date)
    {
        return $query->where('occurred_at', '<', $date);
    }
}
