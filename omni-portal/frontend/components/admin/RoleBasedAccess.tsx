'use client';

import React, { ReactNode, useCallback, useMemo } from 'react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { AdminRole, AdminPermission, AdminUser } from '@/types/admin';

// ===== ROLE DEFINITIONS =====
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  SYSTEM_ADMIN: 'system_admin',
  SECURITY_ADMIN: 'security_admin',
  COMPLIANCE_OFFICER: 'compliance_officer',
  DATA_ANALYST: 'data_analyst',
  HEALTH_COORDINATOR: 'health_coordinator',
  HR_MANAGER: 'hr_manager',
  DOCUMENT_REVIEWER: 'document_reviewer',
  SUPPORT_AGENT: 'support_agent',
  AUDITOR: 'auditor',
  REPORT_VIEWER: 'report_viewer',
  USER_MANAGER: 'user_manager',
  CONTENT_MODERATOR: 'content_moderator',
  READONLY_ADMIN: 'readonly_admin'
} as const;

export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

// ===== PERMISSION DEFINITIONS =====
export const PERMISSIONS = {
  // User Management
  USER_CREATE: 'user.create',
  USER_READ: 'user.read',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_IMPERSONATE: 'user.impersonate',
  
  // Admin Management
  ADMIN_CREATE: 'admin.create',
  ADMIN_READ: 'admin.read',
  ADMIN_UPDATE: 'admin.update',
  ADMIN_DELETE: 'admin.delete',
  ADMIN_ASSIGN_ROLES: 'admin.assign_roles',
  
  // Health Data
  HEALTH_READ: 'health.read',
  HEALTH_UPDATE: 'health.update',
  HEALTH_DELETE: 'health.delete',
  HEALTH_EXPORT: 'health.export',
  HEALTH_ANALYTICS: 'health.analytics',
  
  // Document Management
  DOCUMENT_READ: 'document.read',
  DOCUMENT_APPROVE: 'document.approve',
  DOCUMENT_REJECT: 'document.reject',
  DOCUMENT_DELETE: 'document.delete',
  
  // System Settings
  SYSTEM_SETTINGS: 'system.settings',
  SYSTEM_MAINTENANCE: 'system.maintenance',
  SYSTEM_BACKUP: 'system.backup',
  SYSTEM_LOGS: 'system.logs',
  
  // Security
  SECURITY_AUDIT: 'security.audit',
  SECURITY_MONITOR: 'security.monitor',
  SECURITY_CONFIG: 'security.config',
  
  // Reports
  REPORT_READ: 'report.read',
  REPORT_CREATE: 'report.create',
  REPORT_EXPORT: 'report.export',
  REPORT_SCHEDULE: 'report.schedule',
  
  // Compliance
  COMPLIANCE_READ: 'compliance.read',
  COMPLIANCE_MANAGE: 'compliance.manage',
  COMPLIANCE_AUDIT: 'compliance.audit'
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ===== ROLE HIERARCHY =====
export const ROLE_HIERARCHY: Record<SystemRole, number> = {
  [SYSTEM_ROLES.SUPER_ADMIN]: 100,
  [SYSTEM_ROLES.SYSTEM_ADMIN]: 90,
  [SYSTEM_ROLES.SECURITY_ADMIN]: 80,
  [SYSTEM_ROLES.COMPLIANCE_OFFICER]: 75,
  [SYSTEM_ROLES.DATA_ANALYST]: 70,
  [SYSTEM_ROLES.HEALTH_COORDINATOR]: 65,
  [SYSTEM_ROLES.HR_MANAGER]: 60,
  [SYSTEM_ROLES.USER_MANAGER]: 55,
  [SYSTEM_ROLES.DOCUMENT_REVIEWER]: 50,
  [SYSTEM_ROLES.AUDITOR]: 45,
  [SYSTEM_ROLES.SUPPORT_AGENT]: 40,
  [SYSTEM_ROLES.CONTENT_MODERATOR]: 35,
  [SYSTEM_ROLES.REPORT_VIEWER]: 30,
  [SYSTEM_ROLES.READONLY_ADMIN]: 10
};

// ===== ROLE PERMISSIONS MAPPING =====
export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  [SYSTEM_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  
  [SYSTEM_ROLES.SYSTEM_ADMIN]: [
    PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_DELETE,
    PERMISSIONS.ADMIN_READ, PERMISSIONS.ADMIN_UPDATE, PERMISSIONS.ADMIN_ASSIGN_ROLES,
    PERMISSIONS.HEALTH_READ, PERMISSIONS.HEALTH_UPDATE, PERMISSIONS.HEALTH_ANALYTICS,
    PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_APPROVE, PERMISSIONS.DOCUMENT_REJECT,
    PERMISSIONS.SYSTEM_SETTINGS, PERMISSIONS.SYSTEM_LOGS,
    PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_CREATE, PERMISSIONS.REPORT_EXPORT
  ],
  
  [SYSTEM_ROLES.SECURITY_ADMIN]: [
    PERMISSIONS.USER_READ, PERMISSIONS.ADMIN_READ,
    PERMISSIONS.SECURITY_AUDIT, PERMISSIONS.SECURITY_MONITOR, PERMISSIONS.SECURITY_CONFIG,
    PERMISSIONS.SYSTEM_LOGS, PERMISSIONS.COMPLIANCE_READ, PERMISSIONS.COMPLIANCE_AUDIT,
    PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_CREATE
  ],
  
  [SYSTEM_ROLES.COMPLIANCE_OFFICER]: [
    PERMISSIONS.USER_READ, PERMISSIONS.HEALTH_READ, PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.COMPLIANCE_READ, PERMISSIONS.COMPLIANCE_MANAGE, PERMISSIONS.COMPLIANCE_AUDIT,
    PERMISSIONS.SECURITY_AUDIT, PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_CREATE
  ],
  
  [SYSTEM_ROLES.DATA_ANALYST]: [
    PERMISSIONS.USER_READ, PERMISSIONS.HEALTH_READ, PERMISSIONS.HEALTH_ANALYTICS,
    PERMISSIONS.HEALTH_EXPORT, PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT, PERMISSIONS.REPORT_SCHEDULE
  ],
  
  [SYSTEM_ROLES.HEALTH_COORDINATOR]: [
    PERMISSIONS.USER_READ, PERMISSIONS.HEALTH_READ, PERMISSIONS.HEALTH_UPDATE,
    PERMISSIONS.HEALTH_ANALYTICS, PERMISSIONS.DOCUMENT_READ, PERMISSIONS.REPORT_READ
  ],
  
  [SYSTEM_ROLES.HR_MANAGER]: [
    PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_CREATE,
    PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_APPROVE, PERMISSIONS.REPORT_READ
  ],
  
  [SYSTEM_ROLES.USER_MANAGER]: [
    PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_CREATE,
    PERMISSIONS.REPORT_READ
  ],
  
  [SYSTEM_ROLES.DOCUMENT_REVIEWER]: [
    PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_APPROVE, PERMISSIONS.DOCUMENT_REJECT,
    PERMISSIONS.USER_READ, PERMISSIONS.REPORT_READ
  ],
  
  [SYSTEM_ROLES.AUDITOR]: [
    PERMISSIONS.USER_READ, PERMISSIONS.HEALTH_READ, PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.SECURITY_AUDIT, PERMISSIONS.COMPLIANCE_AUDIT, PERMISSIONS.SYSTEM_LOGS,
    PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_CREATE
  ],
  
  [SYSTEM_ROLES.SUPPORT_AGENT]: [
    PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE, PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.REPORT_READ
  ],
  
  [SYSTEM_ROLES.CONTENT_MODERATOR]: [
    PERMISSIONS.USER_READ, PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_APPROVE,
    PERMISSIONS.DOCUMENT_REJECT, PERMISSIONS.REPORT_READ
  ],
  
  [SYSTEM_ROLES.REPORT_VIEWER]: [
    PERMISSIONS.REPORT_READ
  ],
  
  [SYSTEM_ROLES.READONLY_ADMIN]: [
    PERMISSIONS.USER_READ, PERMISSIONS.HEALTH_READ, PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.REPORT_READ
  ]
};

// ===== INTERFACES =====
interface RoleBasedAccessProps {
  children: ReactNode;
  requiredPermissions?: Permission[];
  requiredRoles?: SystemRole[];
  requireAll?: boolean; // If true, user must have ALL permissions/roles. If false, ANY is sufficient.
  fallback?: ReactNode;
  allowSuperAdmin?: boolean; // If true, super admin bypasses all checks
}

interface PermissionCheckResult {
  hasAccess: boolean;
  reason?: string;
  missingPermissions?: Permission[];
  missingRoles?: SystemRole[];
}

// ===== MAIN COMPONENT =====
export default function RoleBasedAccess({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  fallback = null,
  allowSuperAdmin = true
}: RoleBasedAccessProps) {
  const { user, isAuthenticated, isLoading } = useAuthContext();

  // Memoized permission check
  const permissionCheck = useMemo<PermissionCheckResult>(() => {
    if (!isAuthenticated || !user) {
      return { hasAccess: false, reason: 'User not authenticated' };
    }

    // Super admin bypass
    if (allowSuperAdmin && hasRole(user, SYSTEM_ROLES.SUPER_ADMIN)) {
      return { hasAccess: true, reason: 'Super admin access' };
    }

    // Check roles if specified
    if (requiredRoles.length > 0) {
      const userRoles = getUserRoles(user);
      const hasRequiredRoles = requireAll
        ? requiredRoles.every(role => userRoles.includes(role))
        : requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRoles) {
        const missingRoles = requiredRoles.filter(role => !userRoles.includes(role));
        return {
          hasAccess: false,
          reason: `Missing required roles: ${missingRoles.join(', ')}`,
          missingRoles
        };
      }
    }

    // Check permissions if specified
    if (requiredPermissions.length > 0) {
      const userPermissions = getUserPermissions(user);
      const hasRequiredPermissions = requireAll
        ? requiredPermissions.every(permission => userPermissions.includes(permission))
        : requiredPermissions.some(permission => userPermissions.includes(permission));

      if (!hasRequiredPermissions) {
        const missingPermissions = requiredPermissions.filter(permission => !userPermissions.includes(permission));
        return {
          hasAccess: false,
          reason: `Missing required permissions: ${missingPermissions.join(', ')}`,
          missingPermissions
        };
      }
    }

    return { hasAccess: true };
  }, [user, isAuthenticated, requiredPermissions, requiredRoles, requireAll, allowSuperAdmin]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">Checking permissions...</span>
      </div>
    );
  }

  // Access denied
  if (!permissionCheck.hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
            <p className="text-sm text-red-700 mt-1">
              {permissionCheck.reason || 'You do not have permission to access this resource.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ===== UTILITY FUNCTIONS =====
export function hasRole(user: AdminUser, role: SystemRole): boolean {
  const userRoles = getUserRoles(user);
  return userRoles.includes(role);
}

export function hasPermission(user: AdminUser, permission: Permission): boolean {
  const userPermissions = getUserPermissions(user);
  return userPermissions.includes(permission);
}

export function hasAnyRole(user: AdminUser, roles: SystemRole[]): boolean {
  const userRoles = getUserRoles(user);
  return roles.some(role => userRoles.includes(role));
}

export function hasAllRoles(user: AdminUser, roles: SystemRole[]): boolean {
  const userRoles = getUserRoles(user);
  return roles.every(role => userRoles.includes(role));
}

export function hasAnyPermission(user: AdminUser, permissions: Permission[]): boolean {
  const userPermissions = getUserPermissions(user);
  return permissions.some(permission => userPermissions.includes(permission));
}

export function hasAllPermissions(user: AdminUser, permissions: Permission[]): boolean {
  const userPermissions = getUserPermissions(user);
  return permissions.every(permission => userPermissions.includes(permission));
}

export function getUserRoles(user: AdminUser): SystemRole[] {
  if (!user?.adminRoles) return [];
  
  return user.adminRoles
    .filter(roleAssignment => roleAssignment.is_active)
    .map(roleAssignment => roleAssignment.adminRole?.name as SystemRole)
    .filter((role): role is SystemRole => 
      role !== undefined && Object.values(SYSTEM_ROLES).includes(role)
    );
}

export function getUserPermissions(user: AdminUser): Permission[] {
  const roles = getUserRoles(user);
  const permissions = new Set<Permission>();

  // Add permissions from roles
  roles.forEach(role => {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    rolePermissions.forEach(permission => permissions.add(permission));
  });

  // Add direct permissions from user's role assignments
  if (user.adminRoles) {
    user.adminRoles.forEach(roleAssignment => {
      if (roleAssignment.is_active && roleAssignment.adminRole?.adminPermissions) {
        roleAssignment.adminRole.adminPermissions.forEach(permissionObj => {
          if (permissionObj.identifier && Object.values(PERMISSIONS).includes(permissionObj.identifier as Permission)) {
            permissions.add(permissionObj.identifier as Permission);
          }
        });
      }
    });
  }

  return Array.from(permissions);
}

export function getHighestRoleLevel(user: AdminUser): number {
  const roles = getUserRoles(user);
  return Math.max(...roles.map(role => ROLE_HIERARCHY[role] || 0), 0);
}

export function canAccessResource(
  user: AdminUser,
  requiredPermissions: Permission[] = [],
  requiredRoles: SystemRole[] = [],
  requireAll = false
): boolean {
  // Super admin bypass
  if (hasRole(user, SYSTEM_ROLES.SUPER_ADMIN)) {
    return true;
  }

  // Check roles
  if (requiredRoles.length > 0) {
    const hasRequiredRoles = requireAll
      ? hasAllRoles(user, requiredRoles)
      : hasAnyRole(user, requiredRoles);
    if (!hasRequiredRoles) return false;
  }

  // Check permissions
  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requireAll
      ? hasAllPermissions(user, requiredPermissions)
      : hasAnyPermission(user, requiredPermissions);
    if (!hasRequiredPermissions) return false;
  }

  return true;
}

// ===== HOOKS =====
export function usePermissions() {
  const { user, isAuthenticated } = useAuthContext();

  const checkPermission = useCallback((permission: Permission): boolean => {
    if (!isAuthenticated || !user) return false;
    return hasPermission(user, permission);
  }, [user, isAuthenticated]);

  const checkRole = useCallback((role: SystemRole): boolean => {
    if (!isAuthenticated || !user) return false;
    return hasRole(user, role);
  }, [user, isAuthenticated]);

  const checkAccess = useCallback((
    requiredPermissions: Permission[] = [],
    requiredRoles: SystemRole[] = [],
    requireAll = false
  ): boolean => {
    if (!isAuthenticated || !user) return false;
    return canAccessResource(user, requiredPermissions, requiredRoles, requireAll);
  }, [user, isAuthenticated]);

  return {
    userRoles: user ? getUserRoles(user) : [],
    userPermissions: user ? getUserPermissions(user) : [],
    highestRoleLevel: user ? getHighestRoleLevel(user) : 0,
    isSuperAdmin: user ? hasRole(user, SYSTEM_ROLES.SUPER_ADMIN) : false,
    checkPermission,
    checkRole,
    checkAccess
  };
}

// ===== COMPONENT WRAPPERS =====
export function withRoleBasedAccess<P extends object>(
  Component: React.ComponentType<P>,
  accessConfig: Omit<RoleBasedAccessProps, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <RoleBasedAccess {...accessConfig}>
        <Component {...props} />
      </RoleBasedAccess>
    );
  };
}

// ===== EXPORTS =====
export {
  type SystemRole,
  type Permission,
  type RoleBasedAccessProps,
  type PermissionCheckResult
};