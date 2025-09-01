import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { adminApi } from '@/lib/api/admin';

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
  const [permissions, setPermissions] = useState<Permission[]>([]);
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
        const response = await adminApi.getPermissions();
        if (response.success && response.data) {
          setPermissions(response.data.permissions || []);
          setRoles(response.data.roles || []);
        }
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