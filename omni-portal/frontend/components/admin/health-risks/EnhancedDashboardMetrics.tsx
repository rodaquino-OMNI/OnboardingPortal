'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  Clock, 
  Target, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  LineChart,
  PieChart,
  RefreshCw
} from 'lucide-react';
import { healthRisksApi, type DashboardData } from '@/lib/api/admin/health-risks';
import { useRealTimeAlerts } from './RealTimeAlertsProvider';

// Chart components using basic CSS/SVG (avoiding heavy chart libraries)
interface SimpleBarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
}

function SimpleBarChart({ data, height = 200 }: SimpleBarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center gap-2 flex-1">
          <div className="text-xs font-medium text-center">{item.value}</div>
          <div 
            className={`w-full ${item.color || 'bg-blue-500'} rounded-t transition-all duration-1000`}
            style={{ height: `${(item.value / maxValue) * (height - 60)}px`, minHeight: '4px' }}
          />
          <div className="text-xs text-gray-600 text-center break-words">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

interface SimpleLineChartProps {
  data: { period: string; value: number }[];
  color?: string;
  height?: number;
}

function SimpleLineChart({ data, color = '#3b82f6', height = 150 }: SimpleLineChartProps) {
  if (data.length === 0) return <div className="flex items-center justify-center h-32 text-gray-500">Sem dados</div>;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const width = 300;
  const padding = 20;
  
  const points = data.map((item, idx) => {
    const x = (idx / (data.length - 1)) * (width - 2 * padding) + padding;
    const y = height - ((item.value - minValue) / range) * (height - 2 * padding) - padding;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points}
        />
        {data.map((item, idx) => {
          const x = (idx / (data.length - 1)) * (width - 2 * padding) + padding;
          const y = height - ((item.value - minValue) / range) * (height - 2 * padding) - padding;
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="4"
              fill={color}
              className="hover:r-6 transition-all"
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-gray-600 mt-2">
        {data.map((item, idx) => (
          <span key={idx}>{item.period}</span>
        ))}
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon: React.ElementType;
  color: string;
  description?: string;
}

function MetricCard({ title, value, change, icon: Icon, color, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {change && (
            <div className={`flex items-center gap-1 text-sm ${
              change.type === 'increase' ? 'text-green-600' : 'text-red-600'
            }`}>
              {change.type === 'increase' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {change.value}%
            </div>
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function EnhancedDashboardMetrics() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [timeframe, setTimeframe] = useState('7days');
  const [refreshing, setRefreshing] = useState(false);
  const { newAlertsCount, subscribed } = useRealTimeAlerts();

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await healthRisksApi.dashboard(timeframe);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Auto refresh when new alerts arrive
  useEffect(() => {
    if (newAlertsCount > 0) {
      loadDashboardData();
    }
  }, [newAlertsCount, loadDashboardData]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!dashboardData) return null;

  const priorityChartData = [
    { label: 'Emergência', value: dashboardData.alertsByPriority.emergency, color: 'bg-red-500' },
    { label: 'Urgente', value: dashboardData.alertsByPriority.urgent, color: 'bg-orange-500' },
    { label: 'Alta', value: dashboardData.alertsByPriority.high, color: 'bg-yellow-500' },
    { label: 'Média', value: dashboardData.alertsByPriority.medium, color: 'bg-blue-500' },
    { label: 'Baixa', value: dashboardData.alertsByPriority.low, color: 'bg-gray-500' }
  ];

  const categoryChartData = [
    { label: 'Cardiovascular', value: dashboardData.alertsByCategory.cardiovascular, color: 'bg-red-400' },
    { label: 'Saúde Mental', value: dashboardData.alertsByCategory.mental_health, color: 'bg-purple-400' },
    { label: 'Abuso de Substâncias', value: dashboardData.alertsByCategory.substance_abuse, color: 'bg-orange-400' },
    { label: 'Doença Crônica', value: dashboardData.alertsByCategory.chronic_disease, color: 'bg-blue-400' },
    { label: 'Risco de Segurança', value: dashboardData.alertsByCategory.safety_risk, color: 'bg-yellow-400' }
  ];

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Métricas do Dashboard</h2>
          <p className="text-gray-600">Monitoramento em tempo real de alertas de saúde</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            subscribed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${subscribed ? 'bg-green-500' : 'bg-red-500'}`} />
            {subscribed ? 'Online' : 'Offline'}
          </div>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24hours">Últimas 24 horas</option>
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Alertas"
          value={dashboardData.overview.totalAlerts}
          change={{ value: 12, type: 'increase' }}
          icon={Activity}
          color="text-blue-600"
          description="Total no período"
        />
        <MetricCard
          title="Alertas Pendentes"
          value={dashboardData.overview.pendingAlerts}
          change={{ value: 5, type: 'decrease' }}
          icon={Clock}
          color="text-yellow-600"
          description="Requerem atenção"
        />
        <MetricCard
          title="Alertas Críticos"
          value={dashboardData.overview.criticalAlerts}
          change={{ value: 8, type: 'increase' }}
          icon={AlertTriangle}
          color="text-red-600"
          description="Prioridade emergência/urgente"
        />
        <MetricCard
          title="Resolvidos Hoje"
          value={dashboardData.overview.resolvedToday}
          change={{ value: 15, type: 'increase' }}
          icon={CheckCircle}
          color="text-green-600"
          description="Sucesso nas intervenções"
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Tempo Médio de Resposta
            </CardTitle>
            <CardDescription>Tempo para primeira intervenção</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {dashboardData.metrics.averageResponseTime}h
            </div>
            <Progress value={75} className="mb-2" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>Meta: 4h</span>
              <span>75% da meta</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Conformidade SLA
            </CardTitle>
            <CardDescription>Alertas resolvidos dentro do prazo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {dashboardData.metrics.slaCompliance}%
            </div>
            <Progress value={dashboardData.metrics.slaCompliance} className="mb-2" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>Meta: 95%</span>
              <span className={dashboardData.metrics.slaCompliance >= 95 ? 'text-green-600' : 'text-red-600'}>
                {dashboardData.metrics.slaCompliance >= 95 ? '✓ Atingida' : '⚠ Abaixo'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Taxa de Sucesso
            </CardTitle>
            <CardDescription>Intervenções bem-sucedidas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {dashboardData.metrics.interventionSuccess}%
            </div>
            <Progress value={dashboardData.metrics.interventionSuccess} className="mb-2" />
            <div className="text-sm text-gray-600">
              Baseado em acompanhamento de 30 dias
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="priority" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="priority" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Por Prioridade
          </TabsTrigger>
          <TabsTrigger value="category" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Por Categoria
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <LineChart className="w-4 h-4" />
            Tendências
          </TabsTrigger>
          <TabsTrigger value="geography" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Geografia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="priority" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Prioridade</CardTitle>
              <CardDescription>
                Alertas categorizados por nível de urgência
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={priorityChartData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Categoria</CardTitle>
              <CardDescription>
                Alertas agrupados por tipo de condição de saúde
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={categoryChartData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Volume de Alertas</CardTitle>
                <CardDescription>Tendência ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleLineChart
                  data={[
                    { period: 'Seg', value: 12 },
                    { period: 'Ter', value: 19 },
                    { period: 'Qua', value: 15 },
                    { period: 'Qui', value: 22 },
                    { period: 'Sex', value: 18 },
                    { period: 'Sáb', value: 8 },
                    { period: 'Dom', value: 6 }
                  ]}
                  color="#3b82f6"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tempo de Resposta</CardTitle>
                <CardDescription>Média diária em horas</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleLineChart
                  data={[
                    { period: 'Seg', value: 4.2 },
                    { period: 'Ter', value: 3.8 },
                    { period: 'Qua', value: 4.1 },
                    { period: 'Qui', value: 4.5 },
                    { period: 'Sex', value: 3.9 },
                    { period: 'Sáb', value: 5.1 },
                    { period: 'Dom', value: 4.8 }
                  ]}
                  color="#10b981"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição Geográfica</CardTitle>
              <CardDescription>
                Alertas por região
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">São Paulo - Capital</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '65%' }} />
                    </div>
                    <span className="text-sm text-gray-600">45 alertas</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">Rio de Janeiro</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }} />
                    </div>
                    <span className="text-sm text-gray-600">32 alertas</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">Minas Gerais</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '35%' }} />
                    </div>
                    <span className="text-sm text-gray-600">24 alertas</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}