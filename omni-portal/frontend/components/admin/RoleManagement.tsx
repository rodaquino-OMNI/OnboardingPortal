'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  UserPlusIcon,
  UserMinusIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  hierarchy_level: number;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
  adminPermissions?: Permission[];
  userAssignments?: UserRole[];
}

interface Permission {
  id: number;
  identifier: string;
  display_name: string;
  description?: string;
  resource: string;
  action: string;
  scope?: string;
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: number;
  user_id: number;
  admin_role_id: number;
  assigned_at: string;
  expires_at?: string;
  assigned_by: number;
  assignment_reason?: string;
  is_active: boolean;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

interface User {
  id: number;
  name: string;
  email: string;
  department?: string;
  is_active: boolean;
}

export function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    hierarchy_level: 1,
    permission_ids: [] as number[]
  });
  const [assignmentData, setAssignmentData] = useState({
    user_id: '',
    expires_at: '',
    assignment_reason: ''
  });
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [rolesResponse, permissionsResponse, usersResponse] = await Promise.all([
        apiService.get('/admin/roles'),
        apiService.get('/admin/permissions'),
        apiService.get('/admin/users?limit=100')
      ]);

      if (rolesResponse.success) {
        setRoles(rolesResponse.data);
      } else {
        throw new Error(rolesResponse.error || 'Failed to load roles');
      }

      if (permissionsResponse.success) {
        setPermissions(permissionsResponse.data);
      } else {
        throw new Error(permissionsResponse.error || 'Failed to load permissions');
      }

      if (usersResponse.success) {
        setUsers(usersResponse.data);
      } else {
        throw new Error(usersResponse.error || 'Failed to load users');
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao carregar dados',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      const response = await apiService.post('/admin/roles', {
        ...formData,
        permission_ids: formData.permission_ids
      });

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Função criada com sucesso'
        });
        setIsCreateModalOpen(false);
        resetForm();
        await loadData();
      } else {
        throw new Error(response.error || 'Failed to create role');
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao criar função',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      hierarchy_level: 1,
      permission_ids: []
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Funções</h1>
          <p className="mt-2 text-gray-600">
            Gerencie funções de usuário e permissões do sistema
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="h-4 w-4 mr-2" />
              Nova Função
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Função</DialogTitle>
              <DialogDescription>
                Defina uma nova função com permissões específicas
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nome da Função</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="admin-role"
                  />
                </div>
                <div>
                  <Label htmlFor="display_name">Nome de Exibição</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Administrador"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição da função..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateRole}>
                Criar Função
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShieldCheckIcon className="h-5 w-5 mr-2" />
              Funções do Sistema
            </CardTitle>
            <CardDescription>
              Gerencie funções e suas permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium">{role.display_name}</h3>
                      {role.is_system_role && (
                        <Badge variant="secondary" className="text-xs">
                          Sistema
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {role.description || `Função: ${role.name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}