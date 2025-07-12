'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { LGPDDataExport } from '@/components/lgpd/LGPDDataExport';
import { LGPDPrivacySettings } from '@/components/lgpd/LGPDPrivacySettings';
import { LGPDConsentHistory } from '@/components/lgpd/LGPDConsentHistory';
import { LGPDAccountDeletion } from '@/components/lgpd/LGPDAccountDeletion';
import { LGPDDataProcessingActivities } from '@/components/lgpd/LGPDDataProcessingActivities';
import { useAuth } from '@/hooks/useAuth';
import { useLGPD } from '@/hooks/useLGPD';
import { 
  Shield, 
  Download, 
  Settings, 
  History, 
  Trash2, 
  Activity,
  Info,
  CheckCircle,
  Eye,
  Clock
} from 'lucide-react';

export default function LGPDPage() {
  const { user } = useAuth();
  const { 
    privacySettings, 
    dataProcessingActivities,
    fetchPrivacySettings,
    fetchConsentHistory,
    fetchDataProcessingActivities
  } = useLGPD();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    fetchPrivacySettings();
    fetchConsentHistory();
    fetchDataProcessingActivities();
  }, [fetchPrivacySettings, fetchConsentHistory, fetchDataProcessingActivities]);

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: Shield },
    { id: 'export', label: 'Exportar Dados', icon: Download },
    { id: 'privacy', label: 'Privacidade', icon: Settings },
    { id: 'consent', label: 'Consentimentos', icon: History },
    { id: 'activities', label: 'Atividades', icon: Activity },
    { id: 'deletion', label: 'Exclusão', icon: Trash2 },
  ];

  const getConsentStatus = () => {
    if (!user?.lgpd_consent) {
      return { status: 'warning', text: 'Consentimento pendente', color: 'bg-yellow-100 text-yellow-800' };
    }
    
    if (user.lgpd_consent_at) {
      const consentDate = new Date(user.lgpd_consent_at);
      const daysSinceConsent = Math.floor((Date.now() - consentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceConsent > 365) {
        return { status: 'warning', text: 'Consentimento antigo', color: 'bg-yellow-100 text-yellow-800' };
      }
    }
    
    return { status: 'success', text: 'Consentimento válido', color: 'bg-green-100 text-green-800' };
  };

  const consentStatus = getConsentStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Privacidade e Proteção de Dados
              </h1>
              <p className="text-gray-600">
                Gerencie suas configurações de privacidade conforme a LGPD
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowInfoModal(true)}
              className="flex items-center space-x-2"
            >
              <Info className="w-4 h-4" />
              <span>Sobre a LGPD</span>
            </Button>
          </div>
        </div>

        {/* Status Card */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Status de Conformidade</h3>
                <p className="text-gray-600">
                  Sua conta está em conformidade com a LGPD
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge className={consentStatus.color}>
                {consentStatus.text}
              </Badge>
              {user?.lgpd_consent_at && (
                <p className="text-sm text-gray-500 mt-1">
                  Consentimento: {new Date(user.lgpd_consent_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Quick Stats */}
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Consentimentos Ativos</p>
                    <p className="text-2xl font-bold">
                      {privacySettings ? 
                        Object.values(privacySettings.settings).filter(Boolean).length : 0
                      }
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Atividades Registradas</p>
                    <p className="text-2xl font-bold">
                      {dataProcessingActivities?.total_records || 0}
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Último Acesso</p>
                    <p className="text-2xl font-bold">
                      {user?.last_login_at ? 
                        new Date(user.last_login_at).toLocaleDateString('pt-BR') : 
                        'Nunca'
                      }
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-purple-500" />
                </div>
              </Card>

              {/* Rights Information */}
              <Card className="p-6 md:col-span-2 lg:col-span-3">
                <h3 className="font-semibold text-lg mb-4">Seus Direitos sob a LGPD</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <Eye className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Direito de Acesso</h4>
                      <p className="text-sm text-gray-600">
                        Você pode solicitar acesso aos seus dados pessoais
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Settings className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Direito de Correção</h4>
                      <p className="text-sm text-gray-600">
                        Você pode corrigir dados incompletos ou incorretos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Download className="w-5 h-5 text-purple-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Direito de Portabilidade</h4>
                      <p className="text-sm text-gray-600">
                        Você pode exportar seus dados em formato legível
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Trash2 className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Direito de Exclusão</h4>
                      <p className="text-sm text-gray-600">
                        Você pode solicitar a exclusão dos seus dados
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'export' && <LGPDDataExport />}
          {activeTab === 'privacy' && <LGPDPrivacySettings />}
          {activeTab === 'consent' && <LGPDConsentHistory />}
          {activeTab === 'activities' && <LGPDDataProcessingActivities />}
          {activeTab === 'deletion' && <LGPDAccountDeletion />}
        </div>
      </div>

      {/* LGPD Information Modal */}
      <Modal
        open={showInfoModal}
        onOpenChange={(open) => setShowInfoModal(open)}
      >
        <ModalHeader>
          <ModalTitle>Sobre a LGPD</ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Lei Geral de Proteção de Dados</h3>
            <p className="text-gray-600">
              A LGPD é a lei brasileira que regula o tratamento de dados pessoais, 
              garantindo maior controle aos titulares sobre suas informações.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Seus Direitos</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• <strong>Acesso:</strong> Saber quais dados temos sobre você</li>
              <li>• <strong>Correção:</strong> Corrigir dados incompletos ou incorretos</li>
              <li>• <strong>Portabilidade:</strong> Exportar seus dados</li>
              <li>• <strong>Exclusão:</strong> Solicitar a remoção dos seus dados</li>
              <li>• <strong>Revogação:</strong> Retirar consentimento a qualquer momento</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Nossa Responsabilidade</h3>
            <p className="text-gray-600">
              Tratamos seus dados com transparência, segurança e apenas para 
              finalidades específicas, seguindo rigorosamente a LGPD.
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={() => setShowInfoModal(false)}
              className="w-full"
            >
              Entendi
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}