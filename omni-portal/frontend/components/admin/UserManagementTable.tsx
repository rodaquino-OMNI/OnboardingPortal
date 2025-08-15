'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { AdminUser } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { formatDate } from '@/lib/utils';
import { 
  Search, 
  MoreVertical, 
  UserPlus, 
  Filter,
  RefreshCw,
  Download,
  Shield,
  UserX
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const UserManagementTable: React.FC = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  const { hasPermission } = useAdminPermissions();
  const {
    users,
    loading,
    error,
    totalUsers,
    totalPages,
    fetchUsers,
    updateUser,
    deleteUser,
    toggleUserStatus,
  } = useAdminUsers({
    page,
    limit: 10,
    search,
    filters: {
      role: roleFilter,
      status: statusFilter,
    },
  });

  const canEdit = hasPermission('users', 'update');
  const canDelete = hasPermission('users', 'delete');
  const canManageRoles = hasPermission('roles', 'assign');

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!canManageRoles) {
      toast({ title: 'Erro', description: 'You do not have permission to change roles', variant: 'destructive' });
      return;
    }

    try {
      await updateUser(userId, { role: newRole });
      toast({ title: 'Sucesso', description: 'User role updated successfully' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Failed to update user role', variant: 'destructive' });
    }
  };

  const handleStatusToggle = async (userId: string) => {
    if (!canEdit) {
      toast({ title: 'Erro', description: 'You do not have permission to change user status', variant: 'destructive' });
      return;
    }

    try {
      await toggleUserStatus(userId);
      toast({ title: 'Sucesso', description: 'User status updated successfully' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Failed to update user status', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!canDelete) {
      toast({ title: 'Erro', description: 'You do not have permission to delete users', variant: 'destructive' });
      return;
    }

    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await deleteUser(userId);
      toast({ title: 'Sucesso', description: 'User deleted successfully' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Failed to delete user', variant: 'destructive' });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'hr':
        return 'default';
      case 'beneficiary':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error loading users: {error}</p>
            <Button onClick={fetchUsers} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>User Management</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchUsers}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="beneficiary">Beneficiary</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name || 'N/A'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role || 'beneficiary')}>
                        {user.role || 'beneficiary'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleStatusToggle(user.id.toString())}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.department || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>View details</DropdownMenuItem>
                          {canEdit && (
                            <DropdownMenuItem>Edit user</DropdownMenuItem>
                          )}
                          {canManageRoles && (
                            <DropdownMenuItem>
                              <Shield className="w-4 h-4 mr-2" />
                              Change role
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteUser(user.id.toString())}
                            >
                              <UserX className="w-4 h-4 mr-2" />
                              Delete user
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, totalUsers)} of {totalUsers} users
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};