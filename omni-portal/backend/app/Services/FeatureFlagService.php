<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\User;

/**
 * Feature Flag Service for gradual rollout of admin features
 * Implements technical excellence with no workarounds
 */
class FeatureFlagService
{
    /**
     * Feature flag definitions with default states
     */
    private const FEATURES = [
        'admin.role_management_ui' => [
            'name' => 'Role Management UI',
            'description' => 'Enable frontend UI for role management',
            'default' => false,
            'rollout_percentage' => 0,
            'allowed_roles' => ['super-admin'],
        ],
        'admin.security_audit_ui' => [
            'name' => 'Security Audit UI',
            'description' => 'Enable frontend UI for security audit',
            'default' => false,
            'rollout_percentage' => 0,
            'allowed_roles' => ['super-admin', 'admin'],
        ],
        'admin.system_settings_ui' => [
            'name' => 'System Settings UI',
            'description' => 'Enable frontend UI for system settings',
            'default' => false,
            'rollout_percentage' => 0,
            'allowed_roles' => ['super-admin'],
        ],
        'admin.user_management_enhanced' => [
            'name' => 'Enhanced User Management',
            'description' => 'Enable enhanced user management features',
            'default' => false,
            'rollout_percentage' => 0,
            'allowed_roles' => ['super-admin', 'admin', 'hr'],
        ],
        'admin.custom_role_system' => [
            'name' => 'Custom Role System',
            'description' => 'Use custom admin role system instead of Spatie',
            'default' => false,
            'rollout_percentage' => 0,
            'allowed_roles' => ['super-admin'],
        ],
        'admin.real_time_analytics' => [
            'name' => 'Real-time Analytics',
            'description' => 'Enable real-time analytics dashboard',
            'default' => false,
            'rollout_percentage' => 0,
            'allowed_roles' => ['super-admin', 'admin'],
        ],
        'admin.bulk_operations' => [
            'name' => 'Bulk Operations',
            'description' => 'Enable bulk operations on users and documents',
            'default' => false,
            'rollout_percentage' => 0,
            'allowed_roles' => ['super-admin', 'admin'],
        ],
        'admin.advanced_security' => [
            'name' => 'Advanced Security Features',
            'description' => 'Enable advanced security monitoring and alerts',
            'default' => false,
            'rollout_percentage' => 0,
            'allowed_roles' => ['super-admin'],
        ],
    ];

    /**
     * Check if a feature is enabled for a user
     */
    public static function isEnabled(string $feature, ?User $user = null): bool
    {
        // Check if feature exists
        if (!isset(self::FEATURES[$feature])) {
            return false;
        }

        $config = self::FEATURES[$feature];

        // Check database override first
        $override = self::getDatabaseOverride($feature, $user);
        if ($override !== null) {
            return $override;
        }

        // Check user-specific flag
        if ($user && self::hasUserFlag($feature, $user)) {
            return true;
        }

        // Check role-based access
        if ($user && !self::hasRoleAccess($feature, $user)) {
            return false;
        }

        // Check rollout percentage
        if ($user && self::isInRolloutPercentage($feature, $user)) {
            return true;
        }

        // Return default value
        return $config['default'];
    }

    /**
     * Enable a feature globally or for specific users/roles
     */
    public static function enable(string $feature, array $options = []): bool
    {
        try {
            if (!self::ensureTableExists()) {
                return false;
            }

            $data = [
                'feature' => $feature,
                'enabled' => true,
                'rollout_percentage' => $options['rollout_percentage'] ?? 100,
                'allowed_roles' => json_encode($options['allowed_roles'] ?? []),
                'allowed_users' => json_encode($options['allowed_users'] ?? []),
                'metadata' => json_encode($options['metadata'] ?? []),
                'updated_at' => now(),
            ];

            DB::table('feature_flags')->updateOrInsert(
                ['feature' => $feature],
                array_merge($data, ['created_at' => now()])
            );

            self::clearCache($feature);
            return true;
        } catch (\Exception $e) {
            \Log::error('Failed to enable feature flag: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Disable a feature
     */
    public static function disable(string $feature): bool
    {
        try {
            if (!self::ensureTableExists()) {
                return false;
            }

            DB::table('feature_flags')
                ->where('feature', $feature)
                ->update([
                    'enabled' => false,
                    'updated_at' => now(),
                ]);

            self::clearCache($feature);
            return true;
        } catch (\Exception $e) {
            \Log::error('Failed to disable feature flag: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Set rollout percentage for gradual deployment
     */
    public static function setRolloutPercentage(string $feature, int $percentage): bool
    {
        if ($percentage < 0 || $percentage > 100) {
            return false;
        }

        try {
            if (!self::ensureTableExists()) {
                return false;
            }

            DB::table('feature_flags')
                ->where('feature', $feature)
                ->update([
                    'rollout_percentage' => $percentage,
                    'updated_at' => now(),
                ]);

            self::clearCache($feature);
            return true;
        } catch (\Exception $e) {
            \Log::error('Failed to set rollout percentage: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get all feature flags with their current states
     */
    public static function getAllFlags(?User $user = null): array
    {
        $flags = [];
        
        foreach (self::FEATURES as $key => $config) {
            $dbFlag = self::getDatabaseFlag($key);
            
            $flags[$key] = [
                'name' => $config['name'],
                'description' => $config['description'],
                'enabled' => self::isEnabled($key, $user),
                'default' => $config['default'],
                'rollout_percentage' => $dbFlag->rollout_percentage ?? $config['rollout_percentage'],
                'allowed_roles' => $dbFlag ? json_decode($dbFlag->allowed_roles, true) : $config['allowed_roles'],
                'user_enabled' => $user ? self::isEnabled($key, $user) : null,
            ];
        }
        
        return $flags;
    }

    /**
     * Enable feature for specific user
     */
    public static function enableForUser(string $feature, User $user): bool
    {
        try {
            if (!self::ensureTableExists()) {
                return false;
            }

            DB::table('feature_flag_users')->updateOrInsert(
                [
                    'feature' => $feature,
                    'user_id' => $user->id,
                ],
                [
                    'enabled' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            self::clearCache($feature);
            return true;
        } catch (\Exception $e) {
            \Log::error('Failed to enable feature for user: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if user has specific feature flag enabled
     */
    private static function hasUserFlag(string $feature, User $user): bool
    {
        if (!Schema::hasTable('feature_flag_users')) {
            return false;
        }

        return Cache::remember(
            "feature_flag:{$feature}:user:{$user->id}",
            300,
            function () use ($feature, $user) {
                return DB::table('feature_flag_users')
                    ->where('feature', $feature)
                    ->where('user_id', $user->id)
                    ->where('enabled', true)
                    ->exists();
            }
        );
    }

    /**
     * Check if user's role has access to feature
     */
    private static function hasRoleAccess(string $feature, User $user): bool
    {
        $config = self::FEATURES[$feature];
        $allowedRoles = $config['allowed_roles'] ?? [];
        
        // Check database override
        $dbFlag = self::getDatabaseFlag($feature);
        if ($dbFlag && $dbFlag->allowed_roles) {
            $allowedRoles = json_decode($dbFlag->allowed_roles, true) ?: $allowedRoles;
        }
        
        if (empty($allowedRoles)) {
            return true; // No role restrictions
        }
        
        // Check user roles
        $userRoles = $user->roles->pluck('name')->toArray();
        return !empty(array_intersect($userRoles, $allowedRoles));
    }

    /**
     * Check if user is in rollout percentage
     */
    private static function isInRolloutPercentage(string $feature, User $user): bool
    {
        $config = self::FEATURES[$feature];
        $percentage = $config['rollout_percentage'] ?? 0;
        
        // Check database override
        $dbFlag = self::getDatabaseFlag($feature);
        if ($dbFlag && $dbFlag->rollout_percentage !== null) {
            $percentage = $dbFlag->rollout_percentage;
        }
        
        if ($percentage >= 100) {
            return true;
        }
        
        if ($percentage <= 0) {
            return false;
        }
        
        // Use consistent hash for user to ensure same result
        $hash = crc32($feature . ':' . $user->id);
        return ($hash % 100) < $percentage;
    }

    /**
     * Get database flag configuration
     */
    private static function getDatabaseFlag(string $feature)
    {
        if (!Schema::hasTable('feature_flags')) {
            return null;
        }

        return Cache::remember(
            "feature_flag:db:{$feature}",
            300,
            function () use ($feature) {
                return DB::table('feature_flags')
                    ->where('feature', $feature)
                    ->first();
            }
        );
    }

    /**
     * Get database override for feature and user
     */
    private static function getDatabaseOverride(string $feature, ?User $user): ?bool
    {
        $dbFlag = self::getDatabaseFlag($feature);
        
        if (!$dbFlag) {
            return null;
        }
        
        // Global override
        if ($dbFlag->enabled !== null) {
            return (bool) $dbFlag->enabled;
        }
        
        return null;
    }

    /**
     * Clear cache for feature flag
     */
    private static function clearCache(string $feature): void
    {
        Cache::forget("feature_flag:db:{$feature}");
        Cache::flush(); // Clear all user-specific caches
    }

    /**
     * Ensure feature flags tables exist
     */
    private static function ensureTableExists(): bool
    {
        try {
            if (!Schema::hasTable('feature_flags')) {
                Schema::create('feature_flags', function ($table) {
                    $table->id();
                    $table->string('feature')->unique();
                    $table->boolean('enabled')->default(false);
                    $table->integer('rollout_percentage')->default(0);
                    $table->json('allowed_roles')->nullable();
                    $table->json('allowed_users')->nullable();
                    $table->json('metadata')->nullable();
                    $table->timestamps();
                    $table->index('enabled');
                });
            }

            if (!Schema::hasTable('feature_flag_users')) {
                Schema::create('feature_flag_users', function ($table) {
                    $table->id();
                    $table->string('feature');
                    $table->foreignId('user_id')->constrained()->onDelete('cascade');
                    $table->boolean('enabled')->default(true);
                    $table->timestamps();
                    $table->unique(['feature', 'user_id']);
                    $table->index('enabled');
                });
            }

            return true;
        } catch (\Exception $e) {
            \Log::error('Failed to create feature flag tables: ' . $e->getMessage());
            return false;
        }
    }
}