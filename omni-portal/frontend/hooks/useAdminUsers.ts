import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { User } from '@/types/auth';

export interface AdminUser extends User {
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  isActive: boolean;
  company?: {
    id: string;
    name: string;
  };
}

export interface UseAdminUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
  filters?: {
    role?: string;
    status?: string;
    companyId?: string;
  };
}

export const useAdminUsers = (options: UseAdminUsersOptions = {}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const { page = 1, limit = 10, search = '', filters = {} } = options;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getUsers({ page, limit, search, ...filters });
      
      if (response.success && response.data) {
        setUsers(response.data.users || []);
        setTotalUsers(response.data.total || 0);
        setTotalPages(response.data.totalPages || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filters]);

  const updateUser = async (userId: string, updates: Partial<AdminUser>) => {
    try {
      const response = await adminApi.updateUser(userId, updates);
      if (response.success) {
        await fetchUsers();
        return response.data;
      }
      throw new Error(response.error?.message || 'Failed to update user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      throw err;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const response = await adminApi.deleteUser(userId);
      if (response.success) {
        await fetchUsers();
        return true;
      }
      throw new Error(response.error?.message || 'Failed to delete user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      throw err;
    }
  };

  const toggleUserStatus = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    return updateUser(userId, { isActive: !user.isActive });
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    totalUsers,
    totalPages,
    fetchUsers,
    updateUser,
    deleteUser,
    toggleUserStatus,
  };
};