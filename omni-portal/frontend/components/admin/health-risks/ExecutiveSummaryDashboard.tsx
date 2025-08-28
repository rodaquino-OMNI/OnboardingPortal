'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import RoleBasedAccess, { PERMISSIONS, SYSTEM_ROLES } from '@/components/admin/RoleBasedAccess';
import { usePermissions } from '@/components/admin/RoleBasedAccess';
import type { AdminAnalytics, HealthAnalytics, SecurityAnalytics, TimeSeriesData, ChartData } from '@/types/admin';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Shield, Users, Activity, BarChart3 } from 'lucide-react';

// ===== TYPES =====
interface ExecutiveSummaryData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    criticalAlerts: number;
    systemHealth: 'healthy' | 'warning' | 'critical';
    complianceScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  healthMetrics: {
    questionnairesCompleted: number;
    highRiskUsers: number;
    averageRiskScore: number;
    completionRate: number;
    pendingReviews: number;
  };
  securityMetrics: {
    threatLevel: 'low' | 'medium' | 'high';
    securityIncidents: number;
    failedLogins: number;
    suspiciousActivity: number;
  };
  performanceMetrics: {
    systemUptime: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  trends: {
    userGrowth: TimeSeriesData[];
    healthRiskTrends: TimeSeriesData[];
    securityEvents: TimeSeriesData[];
    performanceTrends: TimeSeriesData[];
  };
  riskDistribution: ChartData[];
  alerts: {
    id: string;
    type: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: string;
    resolved: boolean;
  }[];
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'good' | 'warning' | 'critical';
  description?: string;
}

// ===== MOCK DATA GENERATOR =====
function generateMockData(): ExecutiveSummaryData {
  const now = new Date();
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (29 - i));
    return date;
  });

  return {
    overview: {
      totalUsers: 12847,
      activeUsers: 8956,
      criticalAlerts: 3,
      systemHealth: 'healthy',
      complianceScore: 96.5,
      riskLevel: 'medium'
    },
    healthMetrics: {
      questionnairesCompleted: 9834,
      highRiskUsers: 287,
      averageRiskScore: 3.2,
      completionRate: 87.4,
      pendingReviews: 45
    },
    securityMetrics: {
      threatLevel: 'low',
      securityIncidents: 2,
      failedLogins: 23,
      suspiciousActivity: 8
    },
    performanceMetrics: {
      systemUptime: 99.8,
      averageResponseTime: 142,
      errorRate: 0.12,
      activeConnections: 1247
    },
    trends: {
      userGrowth: last30Days.map(date => ({
        timestamp: date.toISOString(),
        value: Math.floor(Math.random() * 50) + 100,
        label: date.toLocaleDateString()
      })),
      healthRiskTrends: last30Days.map(date => ({
        timestamp: date.toISOString(),
        value: Math.random() * 2 + 3,
        label: date.toLocaleDateString()
      })),
      securityEvents: last30Days.map(date => ({
        timestamp: date.toISOString(),
        value: Math.floor(Math.random() * 5),
        label: date.toLocaleDateString()
      })),
      performanceTrends: last30Days.map(date => ({
        timestamp: date.toISOString(),
        value: Math.random() * 50 + 120,
        label: date.toLocaleDateString()
      }))
    },
    riskDistribution: [
      { label: 'Low Risk', value: 65.2, color: '#10B981' },
      { label: 'Medium Risk', value: 28.8, color: '#F59E0B' },
      { label: 'High Risk', value: 4.9, color: '#EF4444' },
      { label: 'Critical Risk', value: 1.1, color: '#7C2D12' }
    ],
    alerts: [
      {
        id: '1',
        type: 'critical',
        title: 'High Risk User Detected',
        message: 'User ID 7842 has been flagged with critical health risk indicators',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolved: false
      },
      {
        id: '2',
        type: 'warning',
        title: 'System Performance Degradation',
        message: 'Response times have increased by 15% in the last hour',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        resolved: false
      },
      {
        id: '3',
        type: 'info',
        title: 'Scheduled Maintenance Complete',
        message: 'Database optimization completed successfully',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        resolved: true
      }
    ]
  };
}

// ===== METRIC CARD COMPONENT =====
function MetricCard({ title, value, change, icon, trend, status = 'good', description }: MetricCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getTrendIcon = () => {
    if (!change) return null;
    return change > 0 ? (
      <TrendingUp className={`h-4 w-4 ${
        trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'
      }`} />
    ) : (
      <TrendingDown className={`h-4 w-4 ${
        trend === 'down' ? 'text-green-500' : trend === 'up' ? 'text-red-500' : 'text-gray-500'
      }`} />
    );
  };

  return (
    <Card className={`${getStatusColor()} border transition-all hover:shadow-md`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-bold">{value}</p>
              {change !== undefined && (
                <div className="flex items-center space-x-1">
                  {getTrendIcon()}
                  <span className={`text-sm font-medium ${
                    trend === 'up' && change > 0 ? 'text-green-500' :
                    trend === 'down' && change < 0 ? 'text-green-500' :
                    'text-red-500'
                  }`}>
                    {change > 0 ? '+' : ''}{change}%
                  </span>
                </div>
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

// ===== ALERT COMPONENT =====
function AlertItem({ alert, onResolve }: { 
  alert: ExecutiveSummaryData['alerts'][0];
  onResolve?: (id: string) => void;
}) {
  const getAlertIcon = () => {
    switch (alert.type) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertStyle = () => {
    if (alert.resolved) return 'bg-gray-50 border-gray-200';
    
    switch (alert.type) {
      case 'critical': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={`p-4 border rounded-lg ${getAlertStyle()} ${alert.resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {getAlertIcon()}
          <div>
            <h4 className="font-medium text-sm">
              {alert.title}
              {alert.resolved && <Badge variant="secondary" className="ml-2">Resolved</Badge>}
            </h4>
            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
            <p className="text-xs text-gray-400 mt-2">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        {!alert.resolved && onResolve && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResolve(alert.id)}
          >
            Resolve
          </Button>
        )}
      </div>
    </div>
  );
}

// ===== MAIN COMPONENT =====
export default function ExecutiveSummaryDashboard() {
  const [data, setData] = useState<ExecutiveSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { checkPermission } = usePermissions();

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockData = generateMockData();
        setData(mockData);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to load executive summary data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (data) {
        const refreshedData = generateMockData();
        setData(refreshedData);
        setLastUpdated(new Date());
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [data]);

  // Handle alert resolution
  const handleResolveAlert = (alertId: string) => {
    if (!data) return;
    
    const updatedData = {
      ...data,
      alerts: data.alerts.map(alert => 
        alert.id === alertId ? { ...alert, resolved: true } : alert
      )
    };
    setData(updatedData);
  };

  // Manual refresh
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const refreshedData = generateMockData();
      setData(refreshedData);
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  // Computed metrics
  const criticalAlerts = useMemo(() => 
    data?.alerts.filter(alert => alert.type === 'critical' && !alert.resolved) || [],
    [data]
  );

  const systemHealthStatus = useMemo(() => {
    if (!data) return 'unknown';
    
    if (data.overview.criticalAlerts > 0) return 'critical';
    if (data.securityMetrics.threatLevel === 'high' || data.performanceMetrics.errorRate > 1) return 'warning';
    return 'healthy';
  }, [data]);

  if (isLoading && !data) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span>Loading executive summary...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Data</AlertTitle>
        <AlertDescription>
          Unable to load executive summary data. Please refresh the page or contact support.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <RoleBasedAccess
      requiredPermissions={[PERMISSIONS.HEALTH_ANALYTICS, PERMISSIONS.REPORT_READ]}
      fallback={
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need health analytics and report viewing permissions to access the executive summary.
          </AlertDescription>
        </Alert>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Executive Summary</h1>
            <p className="text-gray-600">
              Real-time overview of system health, user metrics, and risk assessment
            </p>
            {lastUpdated && (
              <p className="text-sm text-gray-400 mt-1">
                Last updated: {lastUpdated.toLocaleString()}
              </p>
            )}
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Critical Alerts Require Attention</AlertTitle>
            <AlertDescription className="text-red-700">
              There are {criticalAlerts.length} critical alert(s) that need immediate attention.
            </AlertDescription>
          </Alert>
        )}

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Users"
            value={data.overview.totalUsers.toLocaleString()}
            change={8.2}
            trend="up"
            icon={<Users className="h-6 w-6 text-blue-600" />}
            description="Active registrations"
          />
          <MetricCard
            title="System Health"
            value={systemHealthStatus.charAt(0).toUpperCase() + systemHealthStatus.slice(1)}
            icon={<Activity className="h-6 w-6 text-green-600" />}
            status={systemHealthStatus === 'critical' ? 'critical' : systemHealthStatus === 'warning' ? 'warning' : 'good'}
            description={`${data.performanceMetrics.systemUptime}% uptime`}
          />
          <MetricCard
            title="Compliance Score"
            value={`${data.overview.complianceScore}%`}
            change={2.1}
            trend="up"
            icon={<Shield className="h-6 w-6 text-green-600" />}
            status={data.overview.complianceScore > 95 ? 'good' : 'warning'}
            description="LGPD compliance"
          />
          <MetricCard
            title="Critical Alerts"
            value={data.overview.criticalAlerts}
            icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
            status={data.overview.criticalAlerts > 0 ? 'critical' : 'good'}
            description="Require immediate attention"
          />
        </div>

        {/* Detailed Metrics Tabs */}
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="health">Health Metrics</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          {/* Health Metrics Tab */}
          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Questionnaires Completed"
                value={data.healthMetrics.questionnairesCompleted.toLocaleString()}
                change={5.8}
                trend="up"
                icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
              />
              <MetricCard
                title="High Risk Users"
                value={data.healthMetrics.highRiskUsers}
                change={-2.3}
                trend="down"
                icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                status={data.healthMetrics.highRiskUsers > 300 ? 'warning' : 'good'}
              />
              <MetricCard
                title="Average Risk Score"
                value={data.healthMetrics.averageRiskScore.toFixed(1)}
                icon={<Activity className="h-5 w-5 text-yellow-600" />}
                status={data.healthMetrics.averageRiskScore > 4 ? 'warning' : 'good'}
              />
            </div>

            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>Breakdown of user risk levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.riskDistribution.map((item, index) => (
                    <div key={index} className="flex items-center space-x-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-sm text-gray-600">{item.value}%</span>
                        </div>
                        <Progress value={item.value} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Threat Level"
                value={data.securityMetrics.threatLevel.charAt(0).toUpperCase() + data.securityMetrics.threatLevel.slice(1)}
                icon={<Shield className="h-5 w-5 text-green-600" />}
                status={data.securityMetrics.threatLevel === 'high' ? 'critical' : data.securityMetrics.threatLevel === 'medium' ? 'warning' : 'good'}
              />
              <MetricCard
                title="Security Incidents"
                value={data.securityMetrics.securityIncidents}
                icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                status={data.securityMetrics.securityIncidents > 5 ? 'critical' : 'good'}
              />
              <MetricCard
                title="Failed Logins"
                value={data.securityMetrics.failedLogins}
                icon={<Users className="h-5 w-5 text-yellow-600" />}
              />
              <MetricCard
                title="Suspicious Activity"
                value={data.securityMetrics.suspiciousActivity}
                icon={<Activity className="h-5 w-5 text-orange-600" />}
              />
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="System Uptime"
                value={`${data.performanceMetrics.systemUptime}%`}
                icon={<Activity className="h-5 w-5 text-green-600" />}
                status={data.performanceMetrics.systemUptime > 99.5 ? 'good' : 'warning'}
              />
              <MetricCard
                title="Avg Response Time"
                value={`${data.performanceMetrics.averageResponseTime}ms`}
                icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
                status={data.performanceMetrics.averageResponseTime > 200 ? 'warning' : 'good'}
              />
              <MetricCard
                title="Error Rate"
                value={`${data.performanceMetrics.errorRate}%`}
                icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                status={data.performanceMetrics.errorRate > 1 ? 'critical' : 'good'}
              />
              <MetricCard
                title="Active Connections"
                value={data.performanceMetrics.activeConnections.toLocaleString()}
                icon={<Users className="h-5 w-5 text-purple-600" />}
              />
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Alerts</CardTitle>
                <CardDescription>
                  Recent alerts and notifications requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.alerts.length > 0 ? (
                    data.alerts.map(alert => (
                      <AlertItem
                        key={alert.id}
                        alert={alert}
                        onResolve={checkPermission(PERMISSIONS.ADMIN_UPDATE) ? handleResolveAlert : undefined}
                      />
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">
                      No alerts at this time
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RoleBasedAccess>
  );
}
