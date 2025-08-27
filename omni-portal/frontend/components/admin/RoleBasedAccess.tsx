'use client';

import React, { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock } from 'lucide-react';

// Define permission hierarchy
const PERMISSION_HIERARCHY = {
  'super-admin': [
    'view_admin_dashboard',
    'manage_users',
    'manage_system_settings',
    'view_all_documents',
    'manage_health_risks',
    'view_health_risks',
    'export_data',
    'manage_interventions',
    'view_sensitive_data',
    'manage_roles',
    'view_analytics',
    'send_notifications',
    'manage_security',
    'view_security_logs'
  ],
  'admin': [
    'view_admin_dashboard',
    'manage_users',
    'view_all_documents',
    'manage_health_risks',
    'view_health_risks',
    'export_data',
    'manage_interventions',
    'view_analytics',
    'send_notifications',
    'view_security_logs'
  ],
  'health-manager': [
    'view_admin_dashboard',
    'view_health_risks',
    'manage_health_risks',
    'export_data',
    'manage_interventions',
    'view_analytics'
  ],
  'medical-director': [
    'view_admin_dashboard',
    'view_health_risks',
    'manage_health_risks',
    'view_sensitive_data',
    'manage_interventions',
    'view_analytics'
  ],
  'care-coordinator': [
    'view_health_risks',
    'manage_interventions',
    'view_analytics'
  ],
  'nurse': [
    'view_health_risks',
    'manage_interventions'
  ],
  'analyst': [
    'view_health_risks',
    'view_analytics',
    'export_data'
  ],
  'hr': [
    'view_admin_dashboard',
    'manage_users',
    'view_analytics'
  ],
  'moderator': [
    'view_admin_dashboard',
    'view_health_risks'
  ]
};

// Data sensitivity levels
const DATA_SENSITIVITY = {
  'public': 0,
  'internal': 1,
  'confidential': 2,
  'restricted': 3,
  'top-secret': 4
};

interface RoleBasedAccessProps {
  children: ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requiredSensitivityLevel?: keyof typeof DATA_SENSITIVITY;
  fallback?: ReactNode;
  showError?: boolean;
}

export function RoleBasedAccess({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requiredSensitivityLevel = 'public',
  fallback = null,
  showError = true
}: RoleBasedAccessProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    if (showError) {
      return (
        <Alert className="border-red-200 bg-red-50">
          <Lock className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Você precisa estar logado para acessar este conteúdo.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback;
  }

  const userRoles = user.roles?.map((role: any) => role.name) || [];
  const userPermissions = user.permissions?.map((perm: any) => perm.name) || [];

  // Get all permissions from roles
  const rolePermissions = userRoles.reduce((perms: string[], role: string) => {
    const rolePerms = PERMISSION_HIERARCHY[role as keyof typeof PERMISSION_HIERARCHY] || [];
    return [...perms, ...rolePerms];
  }, []);

  const allUserPermissions = [...new Set([...userPermissions, ...rolePermissions])];

  // Check role requirements
  const hasRequiredRole = requiredRoles.length === 0 || 
    requiredRoles.some(role => userRoles.includes(role)) ||
    userRoles.includes('super-admin'); // Super admin bypasses role checks

  // Check permission requirements
  const hasRequiredPermissions = requiredPermissions.length === 0 ||
    requiredPermissions.every(permission => allUserPermissions.includes(permission)) ||
    userRoles.includes('super-admin'); // Super admin bypasses permission checks

  // Check sensitivity level
  const userSensitivityLevel = getUserSensitivityLevel(userRoles);
  const requiredLevel = DATA_SENSITIVITY[requiredSensitivityLevel];
  const hasSensitivityAccess = userSensitivityLevel >= requiredLevel;

  const hasAccess = hasRequiredRole && hasRequiredPermissions && hasSensitivityAccess;

  if (!hasAccess) {
    if (showError) {
      return (
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            {!hasRequiredRole && 'Função insuficiente. '}
            {!hasRequiredPermissions && 'Permissões insuficientes. '}
            {!hasSensitivityAccess && 'Nível de acesso aos dados insuficiente. '}
            Entre em contato com o administrador.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}

function getUserSensitivityLevel(userRoles: string[]): number {
  // Super admin has highest level
  if (userRoles.includes('super-admin')) {
    return DATA_SENSITIVITY['top-secret'];
  }

  // Medical director and admin have high levels
  if (userRoles.includes('medical-director') || userRoles.includes('admin')) {
    return DATA_SENSITIVITY['restricted'];
  }

  // Health managers have confidential access
  if (userRoles.includes('health-manager')) {
    return DATA_SENSITIVITY['confidential'];
  }

  // Care coordinators and nurses have internal access
  if (userRoles.includes('care-coordinator') || userRoles.includes('nurse')) {
    return DATA_SENSITIVITY['internal'];
  }

  // Default is public access
  return DATA_SENSITIVITY['public'];
}

// Helper hook for checking access programmatically
export function useRoleBasedAccess() {
  const { user } = useAuth();

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    const userRoles = user.roles?.map((role: any) => role.name) || [];
    const userPermissions = user.permissions?.map((perm: any) => perm.name) || [];

    // Super admin bypass
    if (userRoles.includes('super-admin')) return true;

    // Check direct permissions
    if (userPermissions.includes(permission)) return true;

    // Check role-based permissions
    const rolePermissions = userRoles.reduce((perms: string[], role: string) => {
      const rolePerms = PERMISSION_HIERARCHY[role as keyof typeof PERMISSION_HIERARCHY] || [];
      return [...perms, ...rolePerms];
    }, []);

    return rolePermissions.includes(permission);
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    const userRoles = user.roles?.map((r: any) => r.name) || [];
    return userRoles.includes(role) || userRoles.includes('super-admin');
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!user) return false;
    const userRoles = user.roles?.map((r: any) => r.name) || [];
    return roles.some(role => userRoles.includes(role)) || userRoles.includes('super-admin');
  };

  const hasDataAccess = (sensitivityLevel: keyof typeof DATA_SENSITIVITY): boolean => {
    if (!user) return false;
    const userRoles = user.roles?.map((r: any) => r.name) || [];
    const userLevel = getUserSensitivityLevel(userRoles);
    return userLevel >= DATA_SENSITIVITY[sensitivityLevel];
  };

  const canExportData = (): boolean => {
    return hasPermission('export_data');
  };

  const canManageHealthRisks = (): boolean => {
    return hasPermission('manage_health_risks');
  };

  const canViewSensitiveData = (): boolean => {
    return hasPermission('view_sensitive_data') && hasDataAccess('confidential');
  };

  const canManageUsers = (): boolean => {
    return hasPermission('manage_users');
  };

  const canViewAnalytics = (): boolean => {
    return hasPermission('view_analytics');
  };

  return {
    hasPermission,
    hasRole,
    hasAnyRole,
    hasDataAccess,
    canExportData,
    canManageHealthRisks,
    canViewSensitiveData,
    canManageUsers,
    canViewAnalytics,
    userRoles: user?.roles?.map((r: any) => r.name) || [],
    userPermissions: user?.permissions?.map((p: any) => p.name) || []
  };
}

// Component for displaying user's access level
interface AccessLevelIndicatorProps {
  showDetails?: boolean;
}

export function AccessLevelIndicator({ showDetails = false }: AccessLevelIndicatorProps) {
  const { user } = useAuth();
  const { userRoles, userPermissions } = useRoleBasedAccess();

  if (!user) return null;

  const primaryRole = userRoles.find(role => ['super-admin', 'admin', 'medical-director', 'health-manager'].includes(role)) || userRoles[0];
  const sensitivityLevel = getUserSensitivityLevel(userRoles);

  const getSensitivityLabel = (level: number) => {
    const entries = Object.entries(DATA_SENSITIVITY);
    const found = entries.find(([, value]) => value === level);
    return found ? found[0] : 'unknown';
  };

  const getSensitivityColor = (level: number) => {
    if (level >= DATA_SENSITIVITY.restricted) return 'text-red-600 bg-red-50';
    if (level >= DATA_SENSITIVITY.confidential) return 'text-amber-600 bg-amber-50';
    if (level >= DATA_SENSITIVITY.internal) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-600" />
        <span className="font-medium">{primaryRole}</span>
        <div className={`px-2 py-1 rounded text-xs ${getSensitivityColor(sensitivityLevel)}`}>
          Nível: {getSensitivityLabel(sensitivityLevel)}
        </div>
      </div>
      
      {showDetails && (
        <div className="text-xs text-gray-600 space-y-1">
          <div>
            <strong>Funções:</strong> {userRoles.join(', ')}
          </div>
          <div>
            <strong>Permissões:</strong> {userPermissions.length} ativas
          </div>
        </div>
      )}
    </div>
  );
}

// Higher-order component for route protection
export function withRoleBasedAccess<T extends {}>(
  Component: React.ComponentType<T>,
  accessConfig: {
    requiredPermissions?: string[];
    requiredRoles?: string[];
    requiredSensitivityLevel?: keyof typeof DATA_SENSITIVITY;
  }
) {
  return function ProtectedComponent(props: T) {
    return (
      <RoleBasedAccess {...accessConfig}>
        <Component {...props} />
      </RoleBasedAccess>
    );
  };
}