'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Activity, 
  Users, 
  TrendingUp,
  Clock,
  FileText,
  Shield,
  Bell,
  AlertOctagon,
  Heart,
  Brain,
  Pill,
  CircleDollarSign,
  ShieldAlert
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { healthRisksApi } from '@/lib/api/admin/health-risks';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

interface DashboardData {
  overview: {
    totalAlerts: number;
    pendingAlerts: number;
    criticalAlerts: number;
    resolvedToday: number;
  };
  alertsByPriority: {
    emergency: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  alertsByCategory: {
    cardiovascular: number;
    mental_health: number;
    substance_abuse: number;
    chronic_disease: number;
    safety_risk: number;
  };
  recentAlerts: Array<{
    id: string;
    beneficiary_name: string;
    alert_type: string;
    category: string;
    priority: string;
    created_at: string;
    sla_status: string;
  }>;
  metrics: {
    averageResponseTime: number;
    slaCompliance: number;
    interventionSuccess: number;
  };
}

export default function HealthRisksDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('7days');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [timeframe]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthRisksApi.dashboard(timeframe);
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-600';
      case 'urgent': return 'bg-orange-600';
      case 'high': return 'bg-yellow-600';
      case 'medium': return 'bg-blue-600';
      case 'low': return 'bg-gray-600';
      default: return 'bg-gray-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cardiovascular': return <Heart className="w-5 h-5" />;
      case 'mental_health': return <Brain className="w-5 h-5" />;
      case 'substance_abuse': return <Pill className="w-5 h-5" />;
      case 'safety_risk': return <ShieldAlert className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="m-8 border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Central de Riscos de Saúde
          </h1>
          <p className="text-gray-600 mt-1">
            Monitoramento e gestão de alertas clínicos
          </p>
        </div>
        
        <div className="flex gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24hours">Últimas 24 horas</option>
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
          </select>
          
          <Link href="/admin/health-risks/reports/generate">
            <Button>
              <FileText className="w-4 h-4 mr-2" />
              Gerar Relatório
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Alertas</p>
              <p className="text-3xl font-bold mt-1">{dashboardData.overview.totalAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alertas Pendentes</p>
              <p className="text-3xl font-bold mt-1">{dashboardData.overview.pendingAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alertas Críticos</p>
              <p className="text-3xl font-bold mt-1">{dashboardData.overview.criticalAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertOctagon className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Resolvidos Hoje</p>
              <p className="text-3xl font-bold mt-1">{dashboardData.overview.resolvedToday}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts by Priority and Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Distribuição por Prioridade</h3>
          <div className="space-y-3">
            {Object.entries(dashboardData.alertsByPriority).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getPriorityColor(priority)}`} />
                  <span className="capitalize">{priority}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{count}</span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getPriorityColor(priority)}`}
                      style={{ width: `${(count / dashboardData.overview.totalAlerts) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Category Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Distribuição por Categoria</h3>
          <div className="space-y-3">
            {Object.entries(dashboardData.alertsByCategory).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getCategoryIcon(category)}
                  <span className="capitalize">{category.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{count}</span>
                  <Badge variant="outline">{((count / dashboardData.overview.totalAlerts) * 100).toFixed(0)}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Alertas Recentes</h3>
          <Link href="/admin/health-risks/alerts">
            <Button variant="outline" size="sm">
              Ver Todos
            </Button>
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Beneficiário</th>
                <th className="text-left py-3 px-4">Categoria</th>
                <th className="text-left py-3 px-4">Prioridade</th>
                <th className="text-left py-3 px-4">Criado</th>
                <th className="text-left py-3 px-4">SLA</th>
                <th className="text-left py-3 px-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.recentAlerts.map((alert) => (
                <tr key={alert.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium">{alert.beneficiary_name}</div>
                    <div className="text-sm text-gray-600">{alert.alert_type}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(alert.category)}
                      <span className="capitalize">{alert.category.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={getPriorityColor(alert.priority)}>
                      {alert.priority}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {formatDistanceToNow(new Date(alert.created_at), { 
                      addSuffix: true,
                      locale: ptBR 
                    })}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={alert.sla_status === 'overdue' ? 'destructive' : 'outline'}>
                      {alert.sla_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/admin/health-risks/alerts/${alert.id}`}>
                      <Button size="sm" variant="outline">
                        Visualizar
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold">Tempo Médio de Resposta</h4>
          </div>
          <p className="text-2xl font-bold">{dashboardData.metrics.averageResponseTime}h</p>
          <p className="text-sm text-gray-600 mt-1">Média do período</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold">Conformidade SLA</h4>
          </div>
          <p className="text-2xl font-bold">{dashboardData.metrics.slaCompliance}%</p>
          <p className="text-sm text-gray-600 mt-1">Alertas dentro do prazo</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <CircleDollarSign className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold">Taxa de Sucesso</h4>
          </div>
          <p className="text-2xl font-bold">{dashboardData.metrics.interventionSuccess}%</p>
          <p className="text-sm text-gray-600 mt-1">Intervenções bem-sucedidas</p>
        </Card>
      </div>
    </div>
  );
}