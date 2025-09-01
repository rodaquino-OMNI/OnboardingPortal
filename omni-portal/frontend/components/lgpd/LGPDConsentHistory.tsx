'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useLGPD } from '@/hooks/useLGPD';
import { 
  History, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Monitor, 
  MapPin, 
  Calendar,
  Clock,
  Info,
  Eye,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface ConsentHistoryItem {
  date: string;
  type: string;
  action: string;
  details: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
}

export function LGPDConsentHistory() {
  const { consentHistory, fetchConsentHistory, isLoading } = useLGPD();
  const [selectedItem, setSelectedItem] = useState<ConsentHistoryItem | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchConsentHistory();
  }, [fetchConsentHistory]);

  const getEventTypeInfo = (type: string) => {
    const typeInfo = {
      consent_given: {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800',
        label: 'Consentimento Dado',
        description: 'Você deu consentimento para processamento de dados'
      },
      consent_withdrawn: {
        icon: XCircle,
        color: 'bg-red-100 text-red-800',
        label: 'Consentimento Retirado',
        description: 'Você retirou o consentimento para processamento de dados'
      },
      privacy_settings_update: {
        icon: AlertCircle,
        color: 'bg-blue-100 text-blue-800',
        label: 'Configurações Atualizadas',
        description: 'Suas configurações de privacidade foram modificadas'
      },
      data_export: {
        icon: Download,
        color: 'bg-purple-100 text-purple-800',
        label: 'Exportação de Dados',
        description: 'Você solicitou exportação dos seus dados'
      },
      account_deletion: {
        icon: Trash2,
        color: 'bg-gray-100 text-gray-800',
        label: 'Exclusão de Conta',
        description: 'Você solicitou exclusão da sua conta'
      }
    };
    
    return typeInfo[type as keyof typeof typeInfo] || {
      icon: Info,
      color: 'bg-gray-100 text-gray-800',
      label: 'Evento Desconhecido',
      description: 'Evento não identificado'
    };
  };

  const getActionInfo = (action: string) => {
    const actionInfo = {
      create: 'Criação',
      update: 'Atualização',
      delete: 'Exclusão',
      read: 'Leitura',
      consent: 'Consentimento',
      withdraw: 'Retirada'
    };
    
    return actionInfo[action as keyof typeof actionInfo] || action;
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
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutos atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} horas atrás`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} dias atrás`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} meses atrás`;
    return `${Math.floor(diffInSeconds / 31536000)} anos atrás`;
  };

  const getBrowserInfo = (userAgent: string) => {
    // Simple browser detection
    if (userAgent.includes('Chrome')) return { name: 'Chrome', icon: '🌐' };
    if (userAgent.includes('Firefox')) return { name: 'Firefox', icon: '🦊' };
    if (userAgent.includes('Safari')) return { name: 'Safari', icon: '🧭' };
    if (userAgent.includes('Edge')) return { name: 'Edge', icon: '🔷' };
    return { name: 'Navegador', icon: '🌐' };
  };

  const getFilteredHistory = () => {
    if (!consentHistory?.consent_history) return [];
    
    if (filterType === 'all') {
      return consentHistory.consent_history;
    }
    
    return consentHistory.consent_history.filter(item => item.type === filterType);
  };

  const filteredHistory = getFilteredHistory();

  const eventTypes = [
    { value: 'all', label: 'Todos os Eventos', count: consentHistory?.consent_history.length || 0 },
    { value: 'consent_given', label: 'Consentimentos Dados', count: 0 },
    { value: 'consent_withdrawn', label: 'Consentimentos Retirados', count: 0 },
    { value: 'privacy_settings_update', label: 'Configurações Atualizadas', count: 0 },
    { value: 'data_export', label: 'Exportações', count: 0 }
  ];

  // Calculate counts for each event type
  consentHistory?.consent_history.forEach(item => {
    const eventType = eventTypes.find(type => type.value === item.type);
    if (eventType) {
      eventType.count++;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <History className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Histórico de Consentimentos</h3>
              <p className="text-gray-600">
                Registro completo de todas as suas decisões de privacidade
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchConsentHistory()}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        </div>
      </Card>

      {/* Current Consent Status */}
      {consentHistory?.current_consent && (
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Status Atual do Consentimento</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${consentHistory.current_consent.lgpd_consent ? 'bg-green-100' : 'bg-red-100'}`}>
                {consentHistory.current_consent.lgpd_consent ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {consentHistory.current_consent.lgpd_consent ? 'Consentimento Ativo' : 'Consentimento Inativo'}
                </p>
                <p className="text-sm text-gray-600">Status principal</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">
                  {consentHistory.current_consent.consent_date ? 
                    new Date(consentHistory.current_consent.consent_date).toLocaleDateString('pt-BR') : 
                    'Não informado'
                  }
                </p>
                <p className="text-sm text-gray-600">Data do consentimento</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">
                  {consentHistory.current_consent.consent_ip ? 
                    `${consentHistory.current_consent.consent_ip.substring(0, 7)}...` : 
                    'Não informado'
                  }
                </p>
                <p className="text-sm text-gray-600">IP do consentimento</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Filtros</h4>
          <Badge variant="secondary">
            {filteredHistory.length} {filteredHistory.length === 1 ? 'evento' : 'eventos'}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {eventTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                filterType === type.value
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm">{type.label}</div>
              <div className="text-xs text-gray-500 mt-1">{type.count} eventos</div>
            </button>
          ))}
        </div>
      </Card>

      {/* History Timeline */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Linha do Tempo</h4>
        
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {filterType === 'all' ? 'Nenhum evento registrado' : 'Nenhum evento encontrado para este filtro'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item, index) => {
              const eventInfo = getEventTypeInfo(item.type);
              const dateInfo = formatDate(item.date);
              const browserInfo = getBrowserInfo(item.user_agent);
              const Icon = eventInfo.icon;
              
              return (
                <div
                  key={index}
                  className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className={`p-2 rounded-full ${eventInfo.color.replace('text-', 'text-white ')}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{eventInfo.label}</p>
                        <p className="text-sm text-gray-600">{eventInfo.description}</p>
                      </div>
                      <Badge className={eventInfo.color}>
                        {getActionInfo(item.action)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{dateInfo.date} às {dateInfo.time}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Monitor className="w-4 h-4" />
                        <span>{browserInfo.icon} {browserInfo.name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{item.ip_address.substring(0, 7)}...</span>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <span className="text-xs text-gray-400">{dateInfo.relative}</span>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedItem(item)}
                      className="p-2"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Item Detail Modal */}
      <Modal
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        {selectedItem && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Informações Básicas</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Tipo:</span>
                  <p className="font-medium">{getEventTypeInfo(selectedItem.type).label}</p>
                </div>
                <div>
                  <span className="text-gray-600">Ação:</span>
                  <p className="font-medium">{getActionInfo(selectedItem.action)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Data:</span>
                  <p className="font-medium">{formatDate(selectedItem.date).date}</p>
                </div>
                <div>
                  <span className="text-gray-600">Hora:</span>
                  <p className="font-medium">{formatDate(selectedItem.date).time}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Informações Técnicas</h4>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">IP Address:</span>
                  <p className="font-medium font-mono">{selectedItem.ip_address}</p>
                </div>
                <div>
                  <span className="text-gray-600">Navegador:</span>
                  <p className="font-medium">{selectedItem.user_agent}</p>
                </div>
              </div>
            </div>
            
            {selectedItem.details && (
              <div>
                <h4 className="font-semibold mb-2">Detalhes Adicionais</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(selectedItem.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}