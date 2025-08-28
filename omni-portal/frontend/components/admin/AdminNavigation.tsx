'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import RoleBasedAccess, { PERMISSIONS, SYSTEM_ROLES, usePermissions } from '@/components/admin/RoleBasedAccess';
import { useRealTimeAlerts } from '@/components/admin/health-risks/RealTimeAlertsProvider';
import {
  LayoutDashboard,
  Users,
  Shield,
  FileText,
  Activity,
  BarChart3,
  Settings,
  AlertTriangle,
  Database,
  UserCheck,
  Eye,
  Download,
  Bell
} from 'lucide-react';

interface AdminNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  badge?: string | number;
  description?: string;
}

// ===== NAVIGATION CONFIGURATION =====
const getNavigationItems = (unreadAlerts: number): AdminNavItem[] => [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    requiredPermissions: [PERMISSIONS.ADMIN_READ],
    description: 'System overview and key metrics'
  },
  {
    name: 'User Management',
    href: '/admin/users',
    icon: Users,
    requiredPermissions: [PERMISSIONS.USER_READ],
    description: 'Manage user accounts and profiles'
  },
  {
    name: 'Role Management',
    href: '/admin/roles',
    icon: UserCheck,
    requiredPermissions: [PERMISSIONS.ADMIN_READ],
    description: 'Configure roles and permissions'
  },
  {
    name: 'Health Intelligence',
    href: '/admin/health',
    icon: Activity,
    requiredPermissions: [PERMISSIONS.HEALTH_READ],
    description: 'Health questionnaires and risk management'
  },
  {
    name: 'Document Review',
    href: '/admin/documents',
    icon: FileText,
    requiredPermissions: [PERMISSIONS.DOCUMENT_READ],
    description: 'Review and approve user documents'
  },
  {
    name: 'Security Center',
    href: '/admin/security',
    icon: Shield,
    requiredPermissions: [PERMISSIONS.SECURITY_MONITOR],
    description: 'Security monitoring and audit logs'
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    requiredPermissions: [PERMISSIONS.REPORT_READ],
    description: 'Business intelligence and reports'
  },
  {
    name: 'Alerts',
    href: '/admin/alerts',
    icon: Bell,
    requiredPermissions: [PERMISSIONS.SECURITY_MONITOR],
    badge: unreadAlerts > 0 ? unreadAlerts : undefined,
    description: 'System alerts and notifications'
  },
  {
    name: 'System Monitoring',
    href: '/admin/monitoring',
    icon: Database,
    requiredPermissions: [PERMISSIONS.SYSTEM_LOGS],
    description: 'System health and performance'
  },
  {
    name: 'Audit Trail',
    href: '/admin/audit',
    icon: Eye,
    requiredPermissions: [PERMISSIONS.SECURITY_AUDIT],
    description: 'User activity and security logs'
  },
  {
    name: 'Data Export',
    href: '/admin/export',
    icon: Download,
    requiredPermissions: [PERMISSIONS.HEALTH_EXPORT, PERMISSIONS.REPORT_EXPORT],
    requireAll: false,
    description: 'Export system data and reports'
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    requiredRoles: [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.SYSTEM_ADMIN],
    requireAll: false,
    description: 'System configuration and settings'
  }
];

// ===== NAVIGATION ITEM COMPONENT =====
interface NavItemProps {
  item: AdminNavItem;
  isActive: boolean;
  collapsed?: boolean;
}

function NavItem({ item, isActive, collapsed = false }: NavItemProps) {
  const { checkPermission, checkRole, checkAccess } = usePermissions();
  
  // Check if user has required access
  const hasAccess = React.useMemo(() => {
    const permissions = item.requiredPermissions || [];
    const roles = item.requiredRoles || [];
    
    if (permissions.length === 0 && roles.length === 0) return true;
    
    return checkAccess(
      permissions, 
      roles, 
      (item as any).requireAll !== false
    );
  }, [item, checkAccess]);

  if (!hasAccess) return null;

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
        'hover:bg-gray-100 hover:text-gray-900',
        isActive
          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
          : 'text-gray-700 hover:text-gray-900',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.name : item.description}
    >
      <Icon className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
      {!collapsed && (
        <>
          <span className="flex-1">{item.name}</span>
          {item.badge && (
            <Badge 
              variant={typeof item.badge === 'number' && item.badge > 0 ? 'destructive' : 'secondary'}
              className="ml-auto"
            >
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  );
}

// ===== SECTION COMPONENT =====
interface NavSectionProps {
  title: string;
  items: AdminNavItem[];
  currentPath: string;
  collapsed?: boolean;
}

function NavSection({ title, items, currentPath, collapsed = false }: NavSectionProps) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </h3>
      )}
      <nav className="space-y-1">
        {items.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={currentPath === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </div>
  );
}

// ===== MAIN NAVIGATION COMPONENT =====
interface AdminNavigationProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AdminNavigation({ collapsed = false, onToggleCollapse }: AdminNavigationProps) {
  const pathname = usePathname();
  const { userRoles, userPermissions, isSuperAdmin } = usePermissions();
  const { unreadCount } = useRealTimeAlerts();
  
  const navigationItems = React.useMemo(
    () => getNavigationItems(unreadCount),
    [unreadCount]
  );

  // Group navigation items by category
  const mainItems = navigationItems.filter(item => 
    ['Dashboard', 'User Management', 'Role Management', 'Health Intelligence'].includes(item.name)
  );
  
  const managementItems = navigationItems.filter(item => 
    ['Document Review', 'Security Center', 'Analytics', 'Alerts'].includes(item.name)
  );
  
  const systemItems = navigationItems.filter(item => 
    ['System Monitoring', 'Audit Trail', 'Data Export', 'Settings'].includes(item.name)
  );

  return (
    <div className={cn(
      'flex flex-col h-full bg-white border-r border-gray-200',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between p-4 border-b border-gray-200',
        collapsed && 'justify-center px-2'
      )}>
        {!collapsed && (
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">
              {isSuperAdmin ? 'Super Administrator' : 'Administrator'}
            </p>
          </div>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <LayoutDashboard className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="text-sm">
            <p className="font-medium text-gray-900">
              {userRoles.length} Active Role{userRoles.length !== 1 ? 's' : ''}
            </p>
            <p className="text-gray-600 text-xs">
              {userPermissions.length} Permission{userPermissions.length !== 1 ? 's' : ''}
            </p>
          </div>
          {userRoles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {userRoles.slice(0, 2).map((role) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role.replace('_', ' ')}
                </Badge>
              ))}
              {userRoles.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{userRoles.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        <NavSection
          title="Main"
          items={mainItems}
          currentPath={pathname}
          collapsed={collapsed}
        />
        
        <NavSection
          title="Management"
          items={managementItems}
          currentPath={pathname}
          collapsed={collapsed}
        />
        
        <NavSection
          title="System"
          items={systemItems}
          currentPath={pathname}
          collapsed={collapsed}
        />
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            <p>Admin Dashboard v2.0</p>
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== MOBILE NAVIGATION =====
export function MobileAdminNavigation() {
  const pathname = usePathname();
  const { checkAccess } = usePermissions();
  const { unreadCount } = useRealTimeAlerts();
  
  const navigationItems = getNavigationItems(unreadCount);
  
  // Show only most important items for mobile
  const mobileItems = navigationItems.filter(item =>
    ['Dashboard', 'Users', 'Health Intelligence', 'Alerts', 'Settings'].includes(item.name)
  );

  return (
    <nav className="flex justify-around bg-white border-t border-gray-200 px-2 py-1">
      {mobileItems.map((item) => {
        const permissions = item.requiredPermissions || [];
        const roles = item.requiredRoles || [];
        
        const hasAccess = permissions.length === 0 && roles.length === 0 
          ? true 
          : checkAccess(permissions, roles, (item as any).requireAll !== false);
          
        if (!hasAccess) return null;
        
        const Icon = item.icon;
        const isActive = pathname === item.href;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center space-y-1 p-2 rounded-lg text-xs font-medium',
              'hover:bg-gray-100 hover:text-gray-900 transition-all',
              isActive 
                ? 'text-blue-700 bg-blue-50' 
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {item.badge && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center"
                >
                  {item.badge}
                </Badge>
              )}
            </div>
            <span className="truncate max-w-16">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ===== BREADCRUMB COMPONENT =====
export function AdminBreadcrumb() {
  const pathname = usePathname();
  const { unreadCount } = useRealTimeAlerts();
  const navigationItems = getNavigationItems(unreadCount);
  
  const currentItem = navigationItems.find(item => item.href === pathname);
  
  if (!currentItem) return null;
  
  return (
    <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
      <Link href="/admin" className="hover:text-gray-700">
        Admin
      </Link>
      <span>/</span>
      <span className="text-gray-900 font-medium">{currentItem.name}</span>
    </div>
  );
}