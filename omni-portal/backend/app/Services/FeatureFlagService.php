<?php

namespace App\Services;

use App\Models\FeatureFlag;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * FeatureFlagService - Feature flag management with caching
 *
 * Purpose: Manage feature toggles for gradual rollout and A/B testing
 *
 * Features:
 * - Environment-based filtering (production, staging, testing)
 * - Percentage-based rollout (0-100%)
 * - Cache invalidation on updates
 * - Default values for missing flags
 * - Audit logging for flag changes
 *
 * Caching:
 * - TTL: 5 minutes (configurable)
 * - Invalidation on flag update
 * - Per-flag cache keys
 *
 * Usage:
 * ```php
 * if ($featureFlags->isEnabled('sliceB_documents')) {
 *     // Execute new flow
 * } else {
 *     // Execute legacy flow
 * }
 * ```
 *
 * @see app/Models/FeatureFlag.php
 * @see database/migrations/2025_09_30_000001_create_feature_flags_table.php
 */
class FeatureFlagService
{
    /**
     * Cache TTL in seconds (5 minutes)
     */
    private const CACHE_TTL = 300;

    /**
     * Cache key prefix
     */
    private const CACHE_PREFIX = 'feature_flag:';

    /**
     * Check if a feature flag is enabled
     *
     * @param string $key Feature flag key
     * @param int|null $userId User ID for percentage rollout (optional)
     * @return bool True if enabled, false otherwise
     */
    public function isEnabled(string $key, ?int $userId = null): bool
    {
        $cacheKey = self::CACHE_PREFIX . $key;

        // Check cache first
        $flag = Cache::remember($cacheKey, self::CACHE_TTL, function () use ($key) {
            return FeatureFlag::where('key', $key)->first();
        });

        // Flag not found - return default (false)
        if (!$flag) {
            Log::debug("Feature flag not found: {$key} - defaulting to disabled");
            return false;
        }

        // Check global enabled status
        if (!$flag->enabled) {
            return false;
        }

        // Check environment filtering
        if (!$this->isEnvironmentAllowed($flag)) {
            return false;
        }

        // Check percentage rollout
        if (!$this->isWithinRolloutPercentage($flag, $userId)) {
            return false;
        }

        return true;
    }

    /**
     * Create or update a feature flag
     *
     * @param string $key Feature flag key
     * @param bool $enabled Enabled status
     * @param int $rolloutPercentage Rollout percentage (0-100)
     * @param array $environments Allowed environments
     * @param string|null $description Flag description
     * @return FeatureFlag Created or updated flag
     */
    public function set(
        string $key,
        bool $enabled = true,
        int $rolloutPercentage = 100,
        array $environments = ['production', 'staging', 'testing'],
        ?string $description = null
    ): FeatureFlag {
        // Validate rollout percentage
        if ($rolloutPercentage < 0 || $rolloutPercentage > 100) {
            throw new \InvalidArgumentException('Rollout percentage must be between 0 and 100');
        }

        // Create or update flag
        $flag = FeatureFlag::updateOrCreate(
            ['key' => $key],
            [
                'enabled' => $enabled,
                'rollout_percentage' => $rolloutPercentage,
                'environments' => $environments,
                'description' => $description,
            ]
        );

        // Invalidate cache
        $this->invalidateCache($key);

        // Audit log
        Log::info('Feature flag updated', [
            'key' => $key,
            'enabled' => $enabled,
            'rollout_percentage' => $rolloutPercentage,
            'environments' => $environments,
        ]);

        return $flag;
    }

    /**
     * Toggle a feature flag on/off
     *
     * @param string $key Feature flag key
     * @return bool New enabled status
     */
    public function toggle(string $key): bool
    {
        $flag = FeatureFlag::where('key', $key)->firstOrFail();
        $flag->enabled = !$flag->enabled;
        $flag->save();

        // Invalidate cache
        $this->invalidateCache($key);

        // Audit log
        Log::info('Feature flag toggled', [
            'key' => $key,
            'enabled' => $flag->enabled,
        ]);

        return $flag->enabled;
    }

    /**
     * Get all feature flags
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function all()
    {
        return FeatureFlag::orderBy('key')->get();
    }

    /**
     * Delete a feature flag
     *
     * @param string $key Feature flag key
     * @return bool Success
     */
    public function delete(string $key): bool
    {
        $flag = FeatureFlag::where('key', $key)->first();

        if (!$flag) {
            return false;
        }

        $flag->delete();

        // Invalidate cache
        $this->invalidateCache($key);

        // Audit log
        Log::info('Feature flag deleted', ['key' => $key]);

        return true;
    }

    /**
     * Invalidate cache for a feature flag
     *
     * @param string $key Feature flag key
     * @return void
     */
    public function invalidateCache(string $key): void
    {
        Cache::forget(self::CACHE_PREFIX . $key);
    }

    /**
     * Clear all feature flag cache
     *
     * @return void
     */
    public function clearAllCache(): void
    {
        $flags = FeatureFlag::all();

        foreach ($flags as $flag) {
            $this->invalidateCache($flag->key);
        }

        Log::info('All feature flag cache cleared');
    }

    /**
     * Check if current environment is allowed for flag
     *
     * @param FeatureFlag $flag Feature flag
     * @return bool True if allowed
     */
    private function isEnvironmentAllowed(FeatureFlag $flag): bool
    {
        $currentEnv = app()->environment();
        $allowedEnvs = $flag->environments ?? [];

        // If no environments specified, allow all
        if (empty($allowedEnvs)) {
            return true;
        }

        return in_array($currentEnv, $allowedEnvs);
    }

    /**
     * Check if user/request falls within rollout percentage
     *
     * Uses consistent hashing for stable user assignment
     *
     * @param FeatureFlag $flag Feature flag
     * @param int|null $userId User ID (optional)
     * @return bool True if within percentage
     */
    private function isWithinRolloutPercentage(FeatureFlag $flag, ?int $userId = null): bool
    {
        // 100% rollout - everyone gets it
        if ($flag->rollout_percentage >= 100) {
            return true;
        }

        // 0% rollout - nobody gets it
        if ($flag->rollout_percentage <= 0) {
            return false;
        }

        // Use user ID for consistent hashing, or fall back to session/IP
        $identifier = $userId ?? request()->session()?->getId() ?? request()->ip();

        // Hash identifier to get consistent number (0-99)
        $hash = crc32($flag->key . $identifier) % 100;

        return $hash < $flag->rollout_percentage;
    }
}
