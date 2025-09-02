'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  ShieldCheckIcon,
  BellIcon,
  XMarkIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon, permission: 'view_admin_dashboard' },
  { name: 'Usuários', href: '/admin/users', icon: UsersIcon, permission: 'view_users' },
  { name: 'Funções', href: '/admin/roles', icon: ShieldCheckIcon, permission: 'manage_roles' },
  { name: 'Documentos', href: '/admin/documents', icon: DocumentTextIcon, permission: 'view_all_documents' },
  { name: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon, permission: 'view_analytics' },
  { name: 'Segurança', href: '/admin/security', icon: ShieldCheckIcon, permission: 'view_security_logs' },
  { name: 'Configurações', href: '/admin/settings', icon: CogIcon, permission: 'manage_system_settings' },
  { name: 'Notificações', href: '/admin/notifications', icon: BellIcon, permission: 'send_notifications' },
];

export function AdminNavigation() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const userPermissions = user?.permissions?.map((p: { name: string }) => p.name) || [];
  const userRoles = user?.roles?.map((r: { name: string }) => r.name) || [];

  const hasPermission = (permission: string) => {
    return userRoles.includes('super-admin') || userPermissions.includes(permission);
  };

  const filteredNavigation = navigation.filter(item => hasPermission(item.permission));

  return (
    <>
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-xl font-semibold text-gray-900">Admin Portal</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <nav className="flex-1 space-y-1 px-2 py-4">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-6 w-6 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.name?.charAt(0) || 'A'}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">
                  {userRoles.join(', ')}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full text-left text-sm text-gray-500 hover:text-gray-700"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">Admin Portal</h1>
          </div>
          
          <nav className="flex-1 space-y-1 px-2 py-4">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <item.icon className="mr-3 h-6 w-6 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.name?.charAt(0) || 'A'}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">
                  {userRoles.join(', ')}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full text-left text-sm text-gray-500 hover:text-gray-700"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="sticky top-0 z-40 lg:hidden">
        <div className="flex items-center justify-between bg-white px-4 py-2 shadow-sm border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-gray-400 hover:text-gray-600"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Admin Portal</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>
    </>
  );
}