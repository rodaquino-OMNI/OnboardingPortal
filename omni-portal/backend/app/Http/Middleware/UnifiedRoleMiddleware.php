<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Unified Role Middleware
 * 
 * Consolidates role checking across database enum roles and Spatie permission system
 * to prevent authorization bypass opportunities and ensure consistent access control.
 * 
 * Features:
 * - Database enum role mapping to Spatie roles
 * - Consistent role hierarchy enforcement
 * - Comprehensive logging for security auditing
 * - Backward compatibility with both systems
 */
class UnifiedRoleMiddleware
{
    /**
     * Role hierarchy mapping from database enum to permissions
     * Higher numbers indicate more permissions
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
     * Role mapping between database enum and Spatie roles
     */
    private const ROLE_MAPPING = [
        'super_admin' => ['super-admin', 'admin', 'manager'],
        'company_admin' => ['admin', 'manager', 'hr'],
        'beneficiary' => []
    ];

    /**
     * Handle an incoming request with unified role checking
     */
    public function handle(Request $request, Closure $next, ...$requiredRoles): Response
    {
        if (!Auth::check()) {
            return $this->unauthorizedResponse('Authentication required');
        }

        $user = Auth::user();
        
        // If no roles specified, just ensure authentication
        if (empty($requiredRoles)) {
            return $next($request);
        }

        // Check if user has any of the required roles using unified approach
        $hasAccess = $this->checkUnifiedRoles($user, $requiredRoles);

        if (!$hasAccess) {
            $this->logAccessDenied($user, $requiredRoles, $request);
            
            return $this->forbiddenResponse(
                'Insufficient privileges',
                'Required roles: ' . implode(', ', $requiredRoles)
            );
        }

        // Log successful access
        $this->logSuccessfulAccess($user, $requiredRoles, $request);

        // Add unified role context to request
        $request->merge([
            'unified_role_context' => [
                'user_id' => $user->id,
                'database_role' => $user->role,
                'spatie_roles' => $this->getUserSpatieRoles($user),
                'effective_roles' => $this->getEffectiveRoles($user),
                'hierarchy_level' => $this->getUserHierarchyLevel($user),
                'granted_permissions' => $this->getUnifiedPermissions($user),
            ]
        ]);

        return $next($request);
    }

    /**
     * Check if user has required roles using unified approach
     */
    private function checkUnifiedRoles($user, array $requiredRoles): bool
    {
        $effectiveRoles = $this->getEffectiveRoles($user);
        $userHierarchyLevel = $this->getUserHierarchyLevel($user);

        foreach ($requiredRoles as $requiredRole) {
            // Direct role match check
            if (in_array($requiredRole, $effectiveRoles)) {
                return true;
            }

            // Hierarchy-based check - higher level roles can access lower level requirements
            $requiredHierarchyLevel = self::ROLE_HIERARCHY[$requiredRole] ?? 0;
            if ($userHierarchyLevel >= $requiredHierarchyLevel) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all effective roles for a user from both systems
     */
    private function getEffectiveRoles($user): array
    {
        $effectiveRoles = [];

        // Add database enum role
        if ($user->role) {
            $effectiveRoles[] = $user->role;
            
            // Add mapped Spatie roles based on database enum
            $mappedRoles = self::ROLE_MAPPING[$user->role] ?? [];
            $effectiveRoles = array_merge($effectiveRoles, $mappedRoles);
        }

        // Add actual Spatie roles
        $spatieRoles = $this->getUserSpatieRoles($user);
        $effectiveRoles = array_merge($effectiveRoles, $spatieRoles);

        // Add custom admin roles if available
        if (method_exists($user, 'adminRoles') && $user->adminRoles) {
            try {
                $adminRoles = $user->adminRoles->pluck('name')->toArray();
                $effectiveRoles = array_merge($effectiveRoles, $adminRoles);
            } catch (\Exception $e) {
                // Silently handle if admin roles can't be loaded
                Log::debug('Could not load admin roles for user', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage()
                ]);
            }
        }

        return array_unique($effectiveRoles);
    }

    /**
     * Get user's Spatie roles safely
     */
    private function getUserSpatieRoles($user): array
    {
        try {
            if (method_exists($user, 'roles') && $user->roles) {
                return $user->roles->pluck('name')->toArray();
            }
        } catch (\Exception $e) {
            Log::debug('Could not load Spatie roles for user', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
        }

        return [];
    }

    /**
     * Get user's hierarchy level based on all their roles
     */
    private function getUserHierarchyLevel($user): int
    {
        $effectiveRoles = $this->getEffectiveRoles($user);
        $maxLevel = 0;

        foreach ($effectiveRoles as $role) {
            $level = self::ROLE_HIERARCHY[$role] ?? 0;
            $maxLevel = max($maxLevel, $level);
        }

        return $maxLevel;
    }

    /**
     * Get unified permissions from all role systems
     */
    private function getUnifiedPermissions($user): array
    {
        $permissions = [];

        // Get Spatie permissions
        try {
            if (method_exists($user, 'permissions') && $user->permissions) {
                $spatiePermissions = $user->permissions->pluck('name')->toArray();
                $permissions = array_merge($permissions, $spatiePermissions);
            }
        } catch (\Exception $e) {
            Log::debug('Could not load Spatie permissions for user', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
        }

        // Get role-based permissions
        try {
            if (method_exists($user, 'getAllPermissions') && $user->getAllPermissions()) {
                $rolePermissions = $user->getAllPermissions()->pluck('name')->toArray();
                $permissions = array_merge($permissions, $rolePermissions);
            }
        } catch (\Exception $e) {
            Log::debug('Could not load role permissions for user', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
        }

        // Add database enum-based permissions (implicit)
        $databaseRole = $user->role;
        if ($databaseRole) {
            $permissions[] = "database_role:{$databaseRole}";
            
            // Add implied permissions based on database role
            switch ($databaseRole) {
                case 'super_admin':
                    $permissions = array_merge($permissions, [
                        'admin.full_access',
                        'users.manage',
                        'system.configure',
                        'security.audit'
                    ]);
                    break;
                case 'company_admin':
                    $permissions = array_merge($permissions, [
                        'users.view',
                        'users.edit',
                        'reports.view',
                        'company.manage'
                    ]);
                    break;
                case 'beneficiary':
                    $permissions = array_merge($permissions, [
                        'profile.edit',
                        'documents.upload',
                        'health.questionnaire'
                    ]);
                    break;
            }
        }

        return array_unique($permissions);
    }

    /**
     * Log access denied for security monitoring
     */
    private function logAccessDenied($user, array $requiredRoles, Request $request): void
    {
        Log::warning('Unified role access denied', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'database_role' => $user->role,
            'spatie_roles' => $this->getUserSpatieRoles($user),
            'effective_roles' => $this->getEffectiveRoles($user),
            'required_roles' => $requiredRoles,
            'hierarchy_level' => $this->getUserHierarchyLevel($user),
            'path' => $request->path(),
            'method' => $request->method(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }

    /**
     * Log successful access for auditing
     */
    private function logSuccessfulAccess($user, array $requiredRoles, Request $request): void
    {
        Log::info('Unified role access granted', [
            'user_id' => $user->id,
            'database_role' => $user->role,
            'effective_roles' => $this->getEffectiveRoles($user),
            'required_roles' => $requiredRoles,
            'hierarchy_level' => $this->getUserHierarchyLevel($user),
            'path' => $request->path(),
            'method' => $request->method(),
        ]);
    }

    /**
     * Return unauthorized response
     */
    private function unauthorizedResponse(string $message): Response
    {
        return response()->json([
            'error' => 'Unauthorized',
            'message' => $message,
            'timestamp' => now()->toISOString(),
        ], 401);
    }

    /**
     * Return forbidden response
     */
    private function forbiddenResponse(string $error, string $message): Response
    {
        return response()->json([
            'error' => $error,
            'message' => $message,
            'timestamp' => now()->toISOString(),
        ], 403);
    }

    /**
     * Static method to check roles from anywhere in the application
     */
    public static function userHasRole($user, $requiredRoles): bool
    {
        $instance = new self();
        $rolesArray = is_array($requiredRoles) ? $requiredRoles : [$requiredRoles];
        return $instance->checkUnifiedRoles($user, $rolesArray);
    }

    /**
     * Get role hierarchy mapping
     */
    public static function getRoleHierarchy(): array
    {
        return self::ROLE_HIERARCHY;
    }

    /**
     * Get role mapping
     */
    public static function getRoleMapping(): array
    {
        return self::ROLE_MAPPING;
    }
}