'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminAPI from '@/lib/api/admin';
import { AdminDashboardData } from '@/types/admin';
import { MetricCard } from './MetricCard';
import { ActivityFeed } from './ActivityFeed';
import { AlertsPanel } from './AlertsPanel';
import { SystemStatusPanel } from './SystemStatusPanel';
import { QuickActions } from './QuickActions';
import { PerformanceChart } from './PerformanceChart';
import { UserAnalyticsChart } from './UserAnalyticsChart';
import {
  UsersIcon,
  DocumentTextIcon,
  ChartBarSquareIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export function DashboardOverview() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: dashboard, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: AdminAPI.getDashboard,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Set up WebSocket for real-time updates
  useEffect(() => {
    const ws = AdminAPI.connectWebSocket({
      onDashboardUpdate: (data) => {
        // Update dashboard data in real-time
        refetch();
      },
      onNewAlert: (alert) => {
        // Handle new alerts
        refetch();
      },
    });

    return () => {
      if (ws) ws.close();
    };
  }, [refetch]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-32"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-200 rounded-lg h-96"></div>
          <div className="bg-gray-200 rounded-lg h-96"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading dashboard</h3>
        <p className="mt-1 text-sm text-gray-500">Unable to fetch dashboard data</p>
        <button
          onClick={() => refetch()}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Real-time overview of system performance and activity
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <ArrowPathIcon className={`-ml-1 mr-2 h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {dashboard.alerts && dashboard.alerts.length > 0 && (
        <AlertsPanel alerts={dashboard.alerts} />
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total de Usuários"
          value={dashboard.summary.total_users}
          icon={UsersIcon}
          color="blue"
          trend={{
            value: 12.5,
            isPositive: true,
          }}
          href="/admin/users"
        />
        <MetricCard
          title="Usuários Ativos"
          value={dashboard.summary.active_users}
          icon={CheckCircleIcon}
          color="green"
          subtitle={`${Math.round((dashboard.summary.active_users / dashboard.summary.total_users) * 100)}% do total`}
        />
        <MetricCard
          title="Documentos Pendentes"
          value={dashboard.summary.pending_documents}
          icon={ClockIcon}
          color="yellow"
          href="/admin/documents?status=pending"
          alert={dashboard.summary.pending_documents > 50}
        />
        <MetricCard
          title="Alertas do Sistema"
          value={dashboard.summary.system_alerts}
          icon={ExclamationTriangleIcon}
          color="red"
          href="/admin/alerts"
          alert={dashboard.summary.system_alerts > 0}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="New Users Today"
          value={dashboard.summary.new_users_today}
          icon={UsersIcon}
          color="purple"
        />
        <MetricCard
          title="Total Beneficiaries"
          value={dashboard.summary.total_beneficiaries}
          icon={UsersIcon}
          color="indigo"
        />
        <MetricCard
          title="Completed Questionnaires"
          value={dashboard.summary.completed_questionnaires}
          icon={ChartBarSquareIcon}
          color="green"
        />
        <MetricCard
          title="System Health"
          value={dashboard.system_status?.status || 'healthy'}
          icon={ShieldCheckIcon}
          color={dashboard.system_status?.status === 'healthy' ? 'green' : 'red'}
          isText
        />
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Analytics Chart */}
        {dashboard.user_analytics && (
          <UserAnalyticsChart data={dashboard.user_analytics} />
        )}

        {/* Performance Metrics Chart */}
        {dashboard.performance_metrics && (
          <PerformanceChart data={dashboard.performance_metrics} />
        )}
      </div>

      {/* Activity Feed and System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity (2/3 width) */}
        <div className="lg:col-span-2">
          {dashboard.recent_activity && (
            <ActivityFeed activities={dashboard.recent_activity} />
          )}
        </div>

        {/* System Status (1/3 width) */}
        <div>
          {dashboard.system_status && (
            <SystemStatusPanel status={dashboard.system_status} />
          )}
        </div>
      </div>
    </div>
  );
}