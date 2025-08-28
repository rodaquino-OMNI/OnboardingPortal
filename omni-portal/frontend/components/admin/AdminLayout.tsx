'use client';

import React, { useState } from 'react';
import { Inter } from 'next/font/google';
import AdminNavigation, { MobileAdminNavigation, AdminBreadcrumb } from '@/components/admin/AdminNavigation';
import RoleBasedAccess, { PERMISSIONS } from '@/components/admin/RoleBasedAccess';
import { RealTimeAlertsProvider } from '@/components/admin/health-risks/RealTimeAlertsProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <RoleBasedAccess
      requiredPermissions={[PERMISSIONS.ADMIN_READ]}
      fallback={
        <div className={`min-h-screen bg-gray-50 flex items-center justify-center ${inter.className}`}>
          <Alert className="max-w-md">
            <Shield className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You need admin permissions to access this area. Please contact your system administrator.
            </AlertDescription>
          </Alert>
        </div>
      }
    >
      <RealTimeAlertsProvider enableToasts={true} enableSound={false}>
        <div className={`min-h-screen bg-gray-50 ${inter.className}`}>
          {/* Mobile Menu Button */}
          <div className="lg:hidden fixed top-4 left-4 z-50">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMobileMenu}
              className="bg-white shadow-md"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex h-screen">
            {/* Sidebar */}
            <div
              className={cn(
                'fixed inset-y-0 left-0 z-40 transition-all duration-300',
                sidebarCollapsed ? 'w-16' : 'w-64'
              )}
            >
              <AdminNavigation 
                collapsed={sidebarCollapsed} 
                onToggleCollapse={toggleSidebar}
              />
            </div>

            {/* Main Content */}
            <div
              className={cn(
                'flex-1 flex flex-col transition-all duration-300',
                sidebarCollapsed ? 'ml-16' : 'ml-64'
              )}
            >
              {/* Header */}
              <header className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <AdminBreadcrumb />
                    {title && (
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                        {description && (
                          <p className="text-gray-600 mt-1">{description}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </header>

              {/* Page Content */}
              <main className="flex-1 overflow-y-auto p-6">
                <div className="max-w-7xl mx-auto">
                  {children}
                </div>
              </main>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden">
            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-black bg-opacity-25"
                  onClick={toggleMobileMenu}
                />
                <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl">
                  <AdminNavigation />
                </div>
              </>
            )}

            {/* Mobile Content */}
            <div className="flex flex-col min-h-screen">
              {/* Mobile Header */}
              <header className="bg-white border-b border-gray-200 px-4 py-3 pt-16">
                <AdminBreadcrumb />
                {title && (
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                    {description && (
                      <p className="text-gray-600 text-sm mt-1">{description}</p>
                    )}
                  </div>
                )}
              </header>

              {/* Mobile Content */}
              <main className="flex-1 p-4 pb-20">
                {children}
              </main>

              {/* Mobile Navigation */}
              <div className="fixed bottom-0 left-0 right-0 z-30">
                <MobileAdminNavigation />
              </div>
            </div>
          </div>
        </div>
      </RealTimeAlertsProvider>
    </RoleBasedAccess>
  );
}

// ===== ADMIN PAGE WRAPPER =====
interface AdminPageProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
}

export function AdminPage({ 
  children, 
  title, 
  description, 
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false
}: AdminPageProps) {
  return (
    <AdminLayout title={title} description={description}>
      <RoleBasedAccess
        requiredPermissions={requiredPermissions}
        requiredRoles={requiredRoles}
        requireAll={requireAll}
        fallback={
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Insufficient Permissions</AlertTitle>
            <AlertDescription>
              You don't have the required permissions to view this page.
            </AlertDescription>
          </Alert>
        }
      >
        {children}
      </RoleBasedAccess>
    </AdminLayout>
  );
}

// ===== ADMIN CARD WRAPPER =====
interface AdminCardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function AdminCard({ children, title, description, className }: AdminCardProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      {(title || description) && (
        <div className="border-b border-gray-200 px-6 py-4">
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}