import { useState, useEffect, useCallback } from 'react';
import AdminAPI from '@/lib/api/admin';
import { User } from '@/types/auth';
import { AdminUser, PaginatedResponse } from '@/types/admin';

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
      const response = await AdminAPI.getUsers({ page, per_page: limit, search, ...filters });
      
      // Handle PaginatedResponse<AdminUser>
      setUsers(response.data || []);
      setTotalUsers(response.pagination?.total || 0);
      setTotalPages(response.pagination?.last_page || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filters]);

  const updateUser = async (userId: string, updates: Partial<AdminUser>) => {
    try {
      const updatedUser = await AdminAPI.updateUser(parseInt(userId), updates);
      await fetchUsers();
      return updatedUser;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      throw err;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // TODO: Implement deleteUser method in AdminAPI
      throw new Error('Delete user functionality not yet implemented');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      throw err;
    }
  };

  const toggleUserStatus = async (userId: string) => {
    const user = users.find(u => u.id.toString() === userId);
    if (!user) return;
    
    return updateUser(userId, { is_active: !user.is_active });
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