'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle,
  Search,
  Filter,
  Download,
  Clock,
  AlertOctagon,
  Heart,
  Brain,
  Pill,
  ShieldAlert,
  Activity
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { healthRisksApi, AlertFilters } from '@/lib/api/admin/health-risks';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

interface ClinicalAlert {
  id: string;
  beneficiary_id: string;
  beneficiary_name: string;
  alert_type: string;
  category: string;
  priority: string;
  status: string;
  risk_score: number;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  sla_deadline: string;
  sla_status: string;
  assigned_to?: string;
}

interface AlertsResponse {
  data: ClinicalAlert[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export default function AlertsListPage() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [meta, setMeta] = useState<AlertsResponse['meta'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState<AlertFilters>({
    page: 1,
    per_page: 20,
    status: '',
    priority: '',
    category: '',
    search: ''
  });
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    loadAlerts();
  }, [filters]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthRisksApi.alerts.list(filters);
      setAlerts(response.data.data);
      setMeta(response.data.meta);
    } catch (err) {
      console.error('Error loading alerts:', err);
      setError('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleFilterChange = (key: keyof AlertFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'acknowledged': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'escalated': return 'bg-red-100 text-red-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Alertas Clínicos
          </h1>
          <p className="text-gray-600 mt-1">
            Gerenciar e responder a alertas de risco de saúde
          </p>
        </div>
        
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Buscar por nome do beneficiário..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
          </div>
          
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="acknowledged">Reconhecido</option>
            <option value="in_progress">Em Progresso</option>
            <option value="resolved">Resolvido</option>
            <option value="escalated">Escalado</option>
            <option value="dismissed">Dispensado</option>
          </select>
          
          <select
            value={filters.priority || ''}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as Prioridades</option>
            <option value="emergency">Emergência</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
          
          <select
            value={filters.category || ''}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as Categorias</option>
            <option value="cardiovascular">Cardiovascular</option>
            <option value="mental_health">Saúde Mental</option>
            <option value="substance_abuse">Uso de Substâncias</option>
            <option value="chronic_disease">Doença Crônica</option>
            <option value="safety_risk">Risco de Segurança</option>
          </select>
        </div>
      </Card>

      {/* Alerts Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Beneficiário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prioridade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risco
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SLA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {alert.beneficiary_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {alert.beneficiary_id}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(alert.category)}
                      <span className="text-sm capitalize">
                        {alert.category.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getPriorityColor(alert.priority)}>
                      {alert.priority}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getStatusColor(alert.status)}>
                      {alert.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{alert.risk_score}</div>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-red-500"
                          style={{ width: `${alert.risk_score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {alert.sla_status === 'overdue' ? (
                        <>
                          <AlertOctagon className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-600">Vencido</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {formatDistanceToNow(new Date(alert.sla_deadline), { 
                              addSuffix: true,
                              locale: ptBR 
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDistanceToNow(new Date(alert.created_at), { 
                      addSuffix: true,
                      locale: ptBR 
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                variant="outline"
                disabled={meta.current_page === 1}
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page! - 1 }))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={meta.current_page === meta.last_page}
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page! + 1 }))}
              >
                Próximo
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{(meta.current_page - 1) * meta.per_page + 1}</span> até{' '}
                  <span className="font-medium">
                    {Math.min(meta.current_page * meta.per_page, meta.total)}
                  </span>{' '}
                  de <span className="font-medium">{meta.total}</span> resultados
                </p>
              </div>
              <div className="flex gap-2">
                {[...Array(meta.last_page)].map((_, i) => (
                  <Button
                    key={i + 1}
                    variant={meta.current_page === i + 1 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, page: i + 1 }))}
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}