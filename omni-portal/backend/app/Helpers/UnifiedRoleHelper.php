<?php

namespace App\Helpers;

use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Unified Role Helper
 * 
 * Centralized helper class for role management across database enum,
 * Spatie permissions, and custom admin role systems.
 * 
 * This helper provides static methods for consistent role checking
 * throughout the application.
 */
class UnifiedRoleHelper
{
    /**
     * Role hierarchy levels for authorization
     */
    private const ROLE_HIERARCHY = [
        // Database enum roles
        'super_admin' => 100,
        'company_admin' => 50,
        'beneficiary' => 10,
        
        // Spatie roles
        'super-admin' => 100,
        'admin' => 90,
        'manager' => 70,
        'hr' => 60,
        'moderator' => 40,
    ];

    /**
     * Role equivalence mapping
     */
    private const ROLE_EQUIVALENTS = [
        'super_admin' => ['super-admin'],
        'company_admin' => ['admin', 'manager'],
        'admin' => ['company_admin'],
        'super-admin' => ['super_admin'],
        'manager' => ['company_admin'],
    ];

    /**
     * Check if a user has any of the specified roles using unified system
     */
    public static function userHasRole(User $user, $requiredRoles): bool
    {
        $requiredRoles = is_array($requiredRoles) ? $requiredRoles : [$requiredRoles];
        $effectiveRoles = self::getEffectiveRoles($user);
        $userHierarchyLevel = self::getUserHierarchyLevel($user);

        foreach ($requiredRoles as $requiredRole) {
            // Direct role match
            if (in_array($requiredRole, $effectiveRoles)) {
                return true;
            }

            // Check role equivalents
            $equivalents = self::ROLE_EQUIVALENTS[$requiredRole] ?? [];
            if (array_intersect($equivalents, $effectiveRoles)) {
                return true;
            }

            // Hierarchy-based check
            $requiredLevel = self::ROLE_HIERARCHY[$requiredRole] ?? 0;
            if ($userHierarchyLevel >= $requiredLevel) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all effective roles for a user from all systems
     */
    public static function getEffectiveRoles(User $user): array
    {
        $roles = [];

        // Database enum role
        if ($user->role) {
            $roles[] = $user->role;
        }

        // Spatie roles
        try {
            if ($user->roles) {
                $spatieRoles = $user->roles->pluck('name')->toArray();
                $roles = array_merge($roles, $spatieRoles);
            }
        } catch (\Exception $e) {
            Log::debug('Could not load Spatie roles', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
        }

        // Custom admin roles
        try {
            if (method_exists($user, 'adminRoles') && $user->adminRoles) {
                $adminRoles = $user->adminRoles->pluck('name')->toArray();
                $roles = array_merge($roles, $adminRoles);
            }
        } catch (\Exception $e) {
            Log::debug('Could not load admin roles', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
        }

        return array_unique($roles);
    }

    /**
     * Get user's highest hierarchy level from all role systems
     */
    public static function getUserHierarchyLevel(User $user): int
    {
        $effectiveRoles = self::getEffectiveRoles($user);
        $maxLevel = 0;

        foreach ($effectiveRoles as $role) {
            $level = self::ROLE_HIERARCHY[$role] ?? 0;
            $maxLevel = max($maxLevel, $level);
        }

        // Check custom admin role hierarchy levels
        try {
            if (method_exists($user, 'adminRoles') && $user->adminRoles) {
                foreach ($user->adminRoles as $adminRole) {
                    if (isset($adminRole->hierarchy_level)) {
                        $maxLevel = max($maxLevel, $adminRole->hierarchy_level);
                    }
                }
            }
        } catch (\Exception $e) {
            // Continue silently
        }

        return $maxLevel;
    }

    /**
     * Check if user is admin using unified system
     */
    public static function isAdmin(User $user): bool
    {
        return self::userHasRole($user, [
            'admin', 'super-admin', 'manager', 'hr', 'moderator',
            'super_admin', 'company_admin'
        ]);
    }

    /**
     * Check if user is super admin using unified system
     */
    public static function isSuperAdmin(User $user): bool
    {
        return self::userHasRole($user, ['super-admin', 'super_admin']);
    }

    /**
     * Get user's permissions from all systems
     */
    public static function getUserPermissions(User $user): array
    {
        $permissions = [];

        // Spatie permissions
        try {
            if (method_exists($user, 'getAllPermissions') && $user->getAllPermissions()) {
                $spatiePermissions = $user->getAllPermissions()->pluck('name')->toArray();
                $permissions = array_merge($permissions, $spatiePermissions);
            }
        } catch (\Exception $e) {
            Log::debug('Could not load Spatie permissions', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
        }

        // Database role-based implicit permissions
        if ($user->role) {
            $rolePermissions = self::getImplicitPermissions($user->role);
            $permissions = array_merge($permissions, $rolePermissions);
        }

        // Custom admin permissions
        try {
            if (method_exists($user, 'adminRoles') && $user->adminRoles) {
                foreach ($user->adminRoles as $role) {
                    if (method_exists($role, 'adminPermissions') && $role->adminPermissions) {
                        $adminPermissions = $role->adminPermissions->pluck('identifier')->toArray();
                        $permissions = array_merge($permissions, $adminPermissions);
                    }
                }
            }
        } catch (\Exception $e) {
            Log::debug('Could not load admin permissions', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
        }

        return array_unique($permissions);
    }

    /**
     * Get implicit permissions for database enum roles
     */
    private static function getImplicitPermissions(string $role): array
    {
        $permissions = [
            'super_admin' => [
                'admin.full_access',
                'users.manage',
                'system.configure',
                'security.audit',
                'roles.manage',
                'permissions.grant',
                'data.export',
                'settings.modify'
            ],
            'company_admin' => [
                'users.view',
                'users.edit',
                'reports.view',
                'company.manage',
                'documents.review',
                'interviews.schedule',
                'health_risks.view'
            ],
            'beneficiary' => [
                'profile.edit',
                'documents.upload',
                'health.questionnaire',
                'interviews.book',
                'rewards.claim'
            ]
        ];

        return $permissions[$role] ?? [];
    }

    /**
     * Authorize a user for a specific permission
     */
    public static function authorize(User $user, string $permission): bool
    {
        $userPermissions = self::getUserPermissions($user);
        
        // Direct permission check
        if (in_array($permission, $userPermissions)) {
            return true;
        }

        // Wildcard permission check (e.g., admin.* covers admin.users)
        foreach ($userPermissions as $userPermission) {
            if (str_ends_with($userPermission, '.*')) {
                $prefix = str_replace('.*', '', $userPermission);
                if (str_starts_with($permission, $prefix)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Log role-related security events
     */
    public static function logRoleEvent(User $user, string $action, array $context = []): void
    {
        Log::info("Unified role system: {$action}", array_merge([
            'user_id' => $user->id,
            'user_email' => $user->email,
            'database_role' => $user->role,
            'effective_roles' => self::getEffectiveRoles($user),
            'hierarchy_level' => self::getUserHierarchyLevel($user),
            'timestamp' => now()->toISOString(),
        ], $context));
    }

    /**
     * Get role hierarchy for display purposes
     */
    public static function getRoleHierarchy(): array
    {
        return self::ROLE_HIERARCHY;
    }

    /**
     * Check if a role can access another role's resources
     */
    public static function canAccessRole(User $user, string $targetRole): bool
    {
        $userLevel = self::getUserHierarchyLevel($user);
        $targetLevel = self::ROLE_HIERARCHY[$targetRole] ?? 0;
        
        return $userLevel >= $targetLevel;
    }

    /**
     * Get user's role display name for UI
     */
    public static function getUserRoleDisplay(User $user): string
    {
        $effectiveRoles = self::getEffectiveRoles($user);
        $hierarchyLevel = self::getUserHierarchyLevel($user);
        
        // Return the highest role for display
        $roleDisplayMap = [
            100 => 'Super Administrator',
            90 => 'Administrator',
            70 => 'Manager',
            60 => 'HR Personnel',
            50 => 'Company Admin',
            40 => 'Moderator',
            10 => 'Beneficiary',
            0 => 'User'
        ];
        
        // Find the highest matching role
        foreach ($roleDisplayMap as $level => $display) {
            if ($hierarchyLevel >= $level) {
                return $display;
            }
        }
        
        return 'User';
    }
}