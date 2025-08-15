import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import AdminAPI from '@/lib/api/admin';
import type { AdminPermission } from '@/types/admin';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export const useAdminPermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setPermissions([]);
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        setLoading(true);
        const permissions = await AdminAPI.getPermissions();
        setPermissions(permissions || []);
        // Note: roles would need a separate API call if needed
        setRoles([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  const hasPermission = (resource: string, action: string): boolean => {
    return permissions.some(p => p.resource === resource && p.action === action);
  };

  const hasRole = (roleName: string): boolean => {
    return roles.some(r => r.name === roleName);
  };

  return {
    permissions,
    roles,
    loading,
    error,
    hasPermission,
    hasRole,
  };
};