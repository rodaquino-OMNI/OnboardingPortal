'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp,
  TrendingDown,
  Activity,
  Heart,
  Brain,
  Pill,
  ShieldAlert,
  AlertTriangle,
  Calendar,
  Download
} from 'lucide-react';
import { healthRisksApi } from '@/lib/api/admin/health-risks';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalyticsData {
  riskDistribution: {
    categories: Record<string, number>;
    priorities: Record<string, number>;
    riskScores: number[];
  };
  trends: {
    dates: string[];
    alertsCount: number[];
    averageRiskScore: number[];
    resolvedCount: number[];
  };
  metrics: {
    totalAlerts: number;
    averageRiskScore: number;
    resolutionRate: number;
    averageResolutionTime: number;
    highRiskPercentage: number;
    trendsDirection: 'up' | 'down' | 'stable';
  };
  topBeneficiaries: Array<{
    id: string;
    name: string;
    alertCount: number;
    averageRiskScore: number;
  }>;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('30days');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load risk distribution
      const distributionResponse = await healthRisksApi.analytics.riskDistribution(timeframe);
      
      // Load trends
      const trendsResponse = await healthRisksApi.analytics.trends('alerts', timeframe);
      
      // Mock analytics data (replace with actual API responses when ready)
      const mockData: AnalyticsData = {
        riskDistribution: distributionResponse.data.data || {
          categories: {
            cardiovascular: 45,
            mental_health: 120,
            substance_abuse: 30,
            chronic_disease: 75,
            safety_risk: 15
          },
          priorities: {
            emergency: 5,
            urgent: 20,
            high: 60,
            medium: 120,
            low: 80
          },
          riskScores: Array.from({ length: 100 }, () => Math.floor(Math.random() * 100))
        },
        trends: trendsResponse.data.data || {
          dates: eachDayOfInterval({
            start: subDays(new Date(), 29),
            end: new Date()
          }).map(date => format(date, 'dd/MM')),
          alertsCount: Array.from({ length: 30 }, () => Math.floor(Math.random() * 50) + 10),
          averageRiskScore: Array.from({ length: 30 }, () => Math.floor(Math.random() * 30) + 40),
          resolvedCount: Array.from({ length: 30 }, () => Math.floor(Math.random() * 30) + 5)
        },
        metrics: {
          totalAlerts: 285,
          averageRiskScore: 62.5,
          resolutionRate: 78.5,
          averageResolutionTime: 14.2,
          highRiskPercentage: 28.4,
          trendsDirection: 'up'
        },
        topBeneficiaries: [
          { id: '1', name: 'João Silva', alertCount: 12, averageRiskScore: 78 },
          { id: '2', name: 'Maria Santos', alertCount: 10, averageRiskScore: 82 },
          { id: '3', name: 'Pedro Oliveira', alertCount: 8, averageRiskScore: 65 },
          { id: '4', name: 'Ana Costa', alertCount: 7, averageRiskScore: 71 },
          { id: '5', name: 'Carlos Ferreira', alertCount: 6, averageRiskScore: 69 }
        ]
      };
      
      setAnalyticsData(mockData);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]); // Include loadAnalytics dependency

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      cardiovascular: '#ef4444',
      mental_health: '#8b5cf6',
      substance_abuse: '#f59e0b',
      chronic_disease: '#3b82f6',
      safety_risk: '#eab308'
    };
    return colors[category] || '#6b7280';
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

  if (error || !analyticsData) {
    return (
      <Alert className="m-8 border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          {error || 'Erro ao carregar dados'}
        </AlertDescription>
      </Alert>
    );
  }

  // Chart configurations
  const trendsChartData = {
    labels: analyticsData.trends.dates,
    datasets: [
      {
        label: 'Novos Alertas',
        data: analyticsData.trends.alertsCount,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      },
      {
        label: 'Alertas Resolvidos',
        data: analyticsData.trends.resolvedCount,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4
      }
    ]
  };

  const riskScoreChartData = {
    labels: analyticsData.trends.dates,
    datasets: [
      {
        label: 'Score de Risco Médio',
        data: analyticsData.trends.averageRiskScore,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const categoryChartData = {
    labels: Object.keys(analyticsData.riskDistribution.categories).map(cat => 
      cat.replace('_', ' ').charAt(0).toUpperCase() + cat.replace('_', ' ').slice(1)
    ),
    datasets: [{
      data: Object.values(analyticsData.riskDistribution.categories),
      backgroundColor: Object.keys(analyticsData.riskDistribution.categories).map(cat => 
        getCategoryColor(cat)
      ),
      borderWidth: 0
    }]
  };

  const priorityChartData = {
    labels: Object.keys(analyticsData.riskDistribution.priorities),
    datasets: [{
      label: 'Alertas por Prioridade',
      data: Object.values(analyticsData.riskDistribution.priorities),
      backgroundColor: [
        '#dc2626',
        '#ea580c',
        '#f59e0b',
        '#3b82f6',
        '#6b7280'
      ]
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Analytics de Riscos de Saúde
          </h1>
          <p className="text-gray-600 mt-1">
            Análise visual de tendências e distribuições
          </p>
        </div>
        
        <div className="flex gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
            <option value="90days">Últimos 90 dias</option>
          </select>
          
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Alertas</p>
              <p className="text-2xl font-bold mt-1">{analyticsData.metrics.totalAlerts}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Score Médio</p>
              <p className="text-2xl font-bold mt-1">{analyticsData.metrics.averageRiskScore.toFixed(1)}</p>
            </div>
            {analyticsData.metrics.trendsDirection === 'up' ? (
              <TrendingUp className="w-8 h-8 text-red-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-green-600" />
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Taxa de Resolução</p>
              <p className="text-2xl font-bold mt-1">{analyticsData.metrics.resolutionRate}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold">✓</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tempo Médio</p>
              <p className="text-2xl font-bold mt-1">{analyticsData.metrics.averageResolutionTime}h</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alto Risco</p>
              <p className="text-2xl font-bold mt-1">{analyticsData.metrics.highRiskPercentage}%</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Tendência de Alertas</h3>
          <div className="h-64">
            <Line data={trendsChartData} options={chartOptions} />
          </div>
        </Card>

        {/* Risk Score Trend */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Evolução do Score de Risco</h3>
          <div className="h-64">
            <Line data={riskScoreChartData} options={chartOptions} />
          </div>
        </Card>

        {/* Category Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Distribuição por Categoria</h3>
          <div className="h-64">
            <Doughnut data={categoryChartData} options={chartOptions} />
          </div>
        </Card>

        {/* Priority Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Distribuição por Prioridade</h3>
          <div className="h-64">
            <Bar data={priorityChartData} options={chartOptions} />
          </div>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Detalhamento por Categoria</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(analyticsData.riskDistribution.categories).map(([category, count]) => (
            <div 
              key={category}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
              style={{ borderColor: getCategoryColor(category) + '40' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ 
                    backgroundColor: getCategoryColor(category) + '20',
                    color: getCategoryColor(category)
                  }}
                >
                  {getCategoryIcon(category)}
                </div>
                <div className="text-2xl font-bold">{count}</div>
              </div>
              <p className="text-sm text-gray-600 capitalize">
                {category.replace('_', ' ')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {((count / analyticsData.metrics.totalAlerts) * 100).toFixed(1)}% do total
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Top Beneficiaries */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Beneficiários com Mais Alertas</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">#</th>
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3 px-4">Alertas</th>
                <th className="text-left py-3 px-4">Score Médio</th>
                <th className="text-left py-3 px-4">Risco</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topBeneficiaries.map((beneficiary, index) => (
                <tr key={beneficiary.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{index + 1}</td>
                  <td className="py-3 px-4 font-medium">{beneficiary.name}</td>
                  <td className="py-3 px-4">{beneficiary.alertCount}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span>{beneficiary.averageRiskScore}</span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-red-500"
                          style={{ width: `${beneficiary.averageRiskScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={beneficiary.averageRiskScore >= 70 ? 'error' : 'outline'}
                    >
                      {beneficiary.averageRiskScore >= 70 ? 'Alto' : 'Moderado'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}