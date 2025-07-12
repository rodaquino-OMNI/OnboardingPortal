'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLGPD } from '@/hooks/useLGPD';
import { 
  Activity, 
  Eye, 
  Edit, 
  Download, 
  Trash2, 
  Shield, 
  CheckCircle, 
  XCircle,
  Calendar,
  Clock,
  Database,
  FileText,
  Users,
  RefreshCw,
  Info
} from 'lucide-react';

interface DataProcessingActivity {
  date: string;
  activity: string;
  purpose: string;
  legal_basis: string;
  data_type: string;
  action: string;
  user_consent: boolean;
}

export function LGPDDataProcessingActivities() {
  const { dataProcessingActivities, fetchDataProcessingActivities, isLoading } = useLGPD();
  const [selectedActivity, setSelectedActivity] = useState<DataProcessingActivity | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  useEffect(() => {
    fetchDataProcessingActivities();
  }, [fetchDataProcessingActivities]);

  const getActivityIcon = (activity: string) => {
    const icons = {
      data_access: Eye,
      data_modification: Edit,
      data_export: Download,
      data_deletion: Trash2,
      login: Users,
      logout: Users,
      consent_given: CheckCircle,
      consent_withdrawn: XCircle,
      privacy_settings_update: Shield,
      profile_update: Edit,
      document_upload: FileText,
      document_download: Download,
      health_questionnaire_submit: Shield,
      interview_scheduled: Calendar,
      gamification_update: Activity
    };
    
    return icons[activity as keyof typeof icons] || Activity;
  };

  const getActivityColor = (activity: string) => {
    const colors = {
      data_access: 'bg-blue-100 text-blue-800',
      data_modification: 'bg-yellow-100 text-yellow-800',
      data_export: 'bg-purple-100 text-purple-800',
      data_deletion: 'bg-red-100 text-red-800',
      login: 'bg-green-100 text-green-800',
      logout: 'bg-gray-100 text-gray-800',
      consent_given: 'bg-green-100 text-green-800',
      consent_withdrawn: 'bg-red-100 text-red-800',
      privacy_settings_update: 'bg-blue-100 text-blue-800',
      profile_update: 'bg-yellow-100 text-yellow-800',
      document_upload: 'bg-indigo-100 text-indigo-800',
      document_download: 'bg-purple-100 text-purple-800',
      health_questionnaire_submit: 'bg-emerald-100 text-emerald-800',
      interview_scheduled: 'bg-teal-100 text-teal-800',
      gamification_update: 'bg-pink-100 text-pink-800'
    };
    
    return colors[activity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getActivityLabel = (activity: string) => {
    const labels = {
      data_access: 'Acesso aos Dados',
      data_modification: 'Modificação de Dados',
      data_export: 'Exportação de Dados',
      data_deletion: 'Exclusão de Dados',
      login: 'Login',
      logout: 'Logout',
      consent_given: 'Consentimento Dado',
      consent_withdrawn: 'Consentimento Retirado',
      privacy_settings_update: 'Atualização de Privacidade',
      profile_update: 'Atualização de Perfil',
      document_upload: 'Upload de Documento',
      document_download: 'Download de Documento',
      health_questionnaire_submit: 'Questionário de Saúde',
      interview_scheduled: 'Entrevista Agendada',
      gamification_update: 'Atualização de Gamificação'
    };
    
    return labels[activity as keyof typeof labels] || activity;
  };

  const getActionLabel = (action: string) => {
    const labels = {
      read: 'Leitura',
      create: 'Criação',
      update: 'Atualização',
      delete: 'Exclusão',
      export: 'Exportação',
      share: 'Compartilhamento'
    };
    
    return labels[action as keyof typeof labels] || action;
  };

  const getLegalBasisColor = (legalBasis: string) => {
    const colors = {
      'Consentimento': 'bg-green-100 text-green-800',
      'Execução de contrato': 'bg-blue-100 text-blue-800',
      'Cumprimento de obrigação legal': 'bg-yellow-100 text-yellow-800',
      'Interesse legítimo': 'bg-purple-100 text-purple-800',
      'Direito do titular': 'bg-indigo-100 text-indigo-800'
    };
    
    return colors[legalBasis as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      relative: getRelativeTime(date)
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Agora há pouco';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h atrás`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} dias atrás`;
    return `${Math.floor(diffInSeconds / 2592000)} meses atrás`;
  };

  const getFilteredActivities = () => {
    if (!dataProcessingActivities?.activities) return [];
    
    let filtered = dataProcessingActivities.activities;
    
    // Filter by action
    if (filterAction !== 'all') {
      filtered = filtered.filter(activity => activity.action === filterAction);
    }
    
    // Filter by period
    if (filterPeriod !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filterPeriod) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(activity => new Date(activity.date) >= filterDate);
    }
    
    return filtered;
  };

  const filteredActivities = getFilteredActivities();

  const actionTypes = [
    { value: 'all', label: 'Todas as Ações' },
    { value: 'read', label: 'Leitura' },
    { value: 'create', label: 'Criação' },
    { value: 'update', label: 'Atualização' },
    { value: 'delete', label: 'Exclusão' },
    { value: 'export', label: 'Exportação' }
  ];

  const periodTypes = [
    { value: 'all', label: 'Todo o Período' },
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Última Semana' },
    { value: 'month', label: 'Último Mês' },
    { value: 'year', label: 'Último Ano' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Atividades de Processamento</h3>
              <p className="text-gray-600">
                Registro transparente de como seus dados são processados
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchDataProcessingActivities()}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      {dataProcessingActivities?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Acessos</p>
                <p className="text-2xl font-bold">{dataProcessingActivities.summary.total_data_access}</p>
              </div>
              <Eye className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Modificações</p>
                <p className="text-2xl font-bold">{dataProcessingActivities.summary.total_data_modifications}</p>
              </div>
              <Edit className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Exportações</p>
                <p className="text-2xl font-bold">{dataProcessingActivities.summary.total_data_exports}</p>
              </div>
              <Download className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Com Consentimento</p>
                <p className="text-2xl font-bold">{dataProcessingActivities.summary.consent_based_activities}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Filtros</h4>
          <Badge variant="secondary">
            {filteredActivities.length} {filteredActivities.length === 1 ? 'atividade' : 'atividades'}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Ação
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              {actionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              {periodTypes.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Activities List */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Histórico de Atividades</h4>
        
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              Nenhuma atividade encontrada para os filtros selecionados
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity, index) => {
              const Icon = getActivityIcon(activity.activity);
              const dateInfo = formatDate(activity.date);
              
              return (
                <div
                  key={index}
                  className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className={`p-2 rounded-full ${getActivityColor(activity.activity).replace('text-', 'text-white ')}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {getActivityLabel(activity.activity)}
                        </p>
                        <p className="text-sm text-gray-600">{activity.purpose}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getActivityColor(activity.activity)}>
                          {getActionLabel(activity.action)}
                        </Badge>
                        {activity.user_consent && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Consentido
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{dateInfo.date} às {dateInfo.time}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Database className="w-4 h-4" />
                        <span>{activity.data_type}</span>
                      </div>
                      <Badge className={getLegalBasisColor(activity.legal_basis)}>
                        {activity.legal_basis}
                      </Badge>
                    </div>
                    
                    <div className="mt-1">
                      <span className="text-xs text-gray-400">{dateInfo.relative}</span>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedActivity(activity)}
                      className="p-2"
                    >
                      <Info className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Legal Notice */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <h4 className="font-medium mb-2">Transparência no Processamento</h4>
            <p className="mb-2">
              Este registro atende aos requisitos de transparência da LGPD, permitindo que você 
              acompanhe como seus dados são processados em nossos sistemas.
            </p>
            <ul className="space-y-1">
              <li>• Todas as atividades são registradas automaticamente</li>
              <li>• As informações são mantidas por 7 anos conforme exigido por lei</li>
              <li>• Você pode solicitar esclarecimentos sobre qualquer atividade</li>
              <li>• Os dados são protegidos e acessíveis apenas por você</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Detalhes da Atividade</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedActivity(null)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Atividade</label>
                    <p className="font-medium">{getActivityLabel(selectedActivity.activity)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Ação</label>
                    <p className="font-medium">{getActionLabel(selectedActivity.action)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data</label>
                    <p className="font-medium">{formatDate(selectedActivity.date).date}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Hora</label>
                    <p className="font-medium">{formatDate(selectedActivity.date).time}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Finalidade</label>
                  <p className="font-medium">{selectedActivity.purpose}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Base Legal</label>
                  <Badge className={getLegalBasisColor(selectedActivity.legal_basis)}>
                    {selectedActivity.legal_basis}
                  </Badge>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Tipo de Dados</label>
                  <p className="font-medium">{selectedActivity.data_type}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Consentimento</label>
                  <div className="flex items-center space-x-2">
                    {selectedActivity.user_consent ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="font-medium">
                      {selectedActivity.user_consent ? 'Consentido' : 'Não consentido'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}