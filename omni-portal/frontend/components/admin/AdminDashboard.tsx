'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RoleBasedAccess, { PERMISSIONS, SYSTEM_ROLES, usePermissions } from '@/components/admin/RoleBasedAccess';
import { useRealTimeAlerts } from '@/components/admin/health-risks/RealTimeAlertsProvider';
import ExecutiveSummaryDashboard from '@/components/admin/health-risks/ExecutiveSummaryDashboard';
import AdminAPI from '@/lib/api/admin';
import type { AdminDashboardData, AdminUser, PaginatedResponse } from '@/types/admin';
import { 
  Users, 
  Shield, 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Settings, 
  RefreshCw,
  Eye,
  FileText,
  Clock,
  TrendingUp,
  Database,
  Bell
} from 'lucide-react';

// ===== LOADING COMPONENTS =====
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

// ===== METRIC CARD COMPONENT =====
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  status?: 'good' | 'warning' | 'critical';
  description?: string;
  onClick?: () => void;
}

function MetricCard({ title, value, icon, trend, status = 'good', description, onClick }: MetricCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-green-200 bg-green-50';
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    return trend > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <Card 
      className={`${getStatusColor()} border transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend !== undefined && (
                <span className={`text-sm font-medium flex items-center ${getTrendColor()}`}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
          <div className="p-3 rounded-full bg-white/80">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== RECENT ACTIVITY COMPONENT =====
function RecentActivity({ activities }: { activities: any[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.slice(0, 10).map((activity, index) => (
        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex-shrink-0">
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {activity.action_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </p>
            <p className="text-xs text-gray-500">
              {activity.resource_type} • {new Date(activity.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={activity.risk_level === 'high' ? 'destructive' : 'secondary'}>
            {activity.risk_level}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ===== SYSTEM STATUS COMPONENT =====
function SystemStatus({ status }: { status: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'down': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg border ${getStatusColor(status?.status || 'unknown')}`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">System Status</h4>
            <p className="text-sm capitalize">{status?.status || 'Unknown'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{status?.uptime || 0}% uptime</p>
            <p className="text-xs text-gray-500">
              {status?.response_time || 0}ms avg response
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded">
          <p className="text-xs text-gray-500">Active Sessions</p>
          <p className="text-lg font-semibold">{status?.active_sessions || 0}</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded">
          <p className="text-xs text-gray-500">Error Rate</p>
          <p className="text-lg font-semibold">{status?.error_rate || 0}%</p>
        </div>
      </div>
    </div>
  );
}

// ===== USER MANAGEMENT COMPONENT =====
function UserManagementPanel() {
  const [users, setUsers] = useState<PaginatedResponse<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const { checkPermission } = usePermissions();

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await AdminAPI.getUsers({ per_page: 10 });
        setUsers(data);
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Recent Users</h3>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Manage All
        </Button>
      </div>
      
      <div className="space-y-2">
        {users?.data?.slice(0, 5).map(user => (
          <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <p className="font-medium text-sm">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={user.is_active ? 'default' : 'secondary'}>
                {user.status}
              </Badge>
              {checkPermission(PERMISSIONS.USER_UPDATE) && (
                <Button variant="ghost" size="sm">
                  <Eye className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )) || (
          <div className="text-center py-8 text-gray-500">
            No users found
          </div>
        )}
      </div>
      
      {users && (
        <div className="text-center pt-2">
          <p className="text-sm text-gray-500">
            Showing {users.data?.length || 0} of {users.pagination?.total || 0} users
          </p>
        </div>
      )}
    </div>
  );
}

// ===== MAIN DASHBOARD COMPONENT =====
export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const { checkPermission, isSuperAdmin } = usePermissions();
  const { alerts, unreadCount, isConnected } = useRealTimeAlerts();

  // Load dashboard data
  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const data = await AdminAPI.getDashboard();
        setDashboardData(data);
        setLastRefresh(new Date());
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const data = await AdminAPI.getDashboard();
      setDashboardData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RoleBasedAccess
      requiredPermissions={[PERMISSIONS.ADMIN_READ]}
      fallback={
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need admin permissions to access this dashboard.
          </AlertDescription>
        </Alert>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive system management and monitoring
            </p>
            <div className="flex items-center space-x-4 mt-2">
              <p className="text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleString()}
              </p>
              <div className="flex items-center space-x-1">
                <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount} alerts
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isSuperAdmin && (
              <Button variant="default">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            )}
          </div>
        </div>

        {/* Critical Alerts */}
        {alerts.filter(a => a.type === 'critical' && !a.resolved).length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Critical Alerts</AlertTitle>
            <AlertDescription className="text-red-700">
              {alerts.filter(a => a.type === 'critical' && !a.resolved).length} critical alert(s) require immediate attention.
            </AlertDescription>
          </Alert>
        )}

        {isLoading && !dashboardData ? (
          <DashboardSkeleton />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="executive">Executive</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title="Total Users"
                  value={dashboardData?.summary?.total_users?.toLocaleString() || '0'}
                  icon={<Users className="h-6 w-6 text-blue-600" />}
                  trend={5.2}
                  description="All registered users"
                />
                <MetricCard
                  title="Active Users"
                  value={dashboardData?.summary?.active_users?.toLocaleString() || '0'}
                  icon={<Activity className="h-6 w-6 text-green-600" />}
                  trend={2.8}
                  description="Currently active"
                />
                <MetricCard
                  title="System Alerts"
                  value={dashboardData?.summary?.system_alerts || 0}
                  icon={<AlertTriangle className="h-6 w-6 text-yellow-600" />}
                  status={dashboardData?.summary?.system_alerts > 0 ? 'warning' : 'good'}
                  description="Active alerts"
                />
                <MetricCard
                  title="Health Assessments"
                  value={dashboardData?.summary?.completed_questionnaires?.toLocaleString() || '0'}
                  icon={<FileText className="h-6 w-6 text-purple-600" />}
                  trend={12.1}
                  description="Completed this month"
                />
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>
                      Latest system and user activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentActivity activities={dashboardData?.recent_activity || []} />
                  </CardContent>
                </Card>

                {/* System Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Database className="h-5 w-5 mr-2" />
                      System Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SystemStatus status={dashboardData?.system_status} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              <RoleBasedAccess requiredPermissions={[PERMISSIONS.USER_READ]}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>User Management</CardTitle>
                      <CardDescription>
                        Manage user accounts and permissions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <UserManagementPanel />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>User Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">New Users Today</span>
                          <span className="font-semibold">{dashboardData?.summary?.new_users_today || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Beneficiaries</span>
                          <span className="font-semibold">{dashboardData?.summary?.total_beneficiaries || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Pending Documents</span>
                          <span className="font-semibold">{dashboardData?.summary?.pending_documents || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </RoleBasedAccess>
            </TabsContent>

            {/* Health Tab */}
            <TabsContent value="health">
              <RoleBasedAccess requiredPermissions={[PERMISSIONS.HEALTH_READ]}>
                <Card>
                  <CardHeader>
                    <CardTitle>Health Management</CardTitle>
                    <CardDescription>
                      Monitor health questionnaires and risk assessments
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Health management features coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              </RoleBasedAccess>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security">
              <RoleBasedAccess requiredPermissions={[PERMISSIONS.SECURITY_MONITOR]}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                          <span>Threat Level</span>
                          <Badge variant="secondary">Low</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                          <span>Active Sessions</span>
                          <span className="font-semibold">
                            {dashboardData?.system_status?.active_sessions || 0}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {alerts.slice(0, 5).map(alert => (
                          <div key={alert.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                            <Bell className="h-4 w-4 text-blue-500" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{alert.title}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(alert.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant={alert.type === 'critical' ? 'destructive' : 'default'}>
                              {alert.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </RoleBasedAccess>
            </TabsContent>

            {/* Executive Tab */}
            <TabsContent value="executive">
              <RoleBasedAccess 
                requiredPermissions={[PERMISSIONS.HEALTH_ANALYTICS, PERMISSIONS.REPORT_READ]}
                fallback={
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                      Executive summary requires analytics and reporting permissions.
                    </AlertDescription>
                  </Alert>
                }
              >
                <Suspense fallback={<DashboardSkeleton />}>
                  <ExecutiveSummaryDashboard />
                </Suspense>
              </RoleBasedAccess>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </RoleBasedAccess>
  );
}