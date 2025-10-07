<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * FeatureFlag Model
 *
 * Represents a feature toggle for gradual rollout and A/B testing
 *
 * Fields:
 * - key: Unique identifier (e.g., 'sliceB_documents')
 * - enabled: Global on/off switch
 * - rollout_percentage: Percentage of users who see the feature (0-100)
 * - environments: Array of allowed environments (['production', 'staging', 'testing'])
 * - description: Human-readable description
 *
 * @property string $key
 * @property bool $enabled
 * @property int $rollout_percentage
 * @property array $environments
 * @property string|null $description
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class FeatureFlag extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'key',
        'enabled',
        'rollout_percentage',
        'environments',
        'description',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'enabled' => 'boolean',
        'rollout_percentage' => 'integer',
        'environments' => 'array',
    ];

    /**
     * Scope: Get enabled flags only
     */
    public function scopeEnabled($query)
    {
        return $query->where('enabled', true);
    }

    /**
     * Scope: Get flags for current environment
     */
    public function scopeForEnvironment($query, string $environment)
    {
        return $query->whereJsonContains('environments', $environment);
    }
}
