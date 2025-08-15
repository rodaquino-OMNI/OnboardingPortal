'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useLGPD } from '@/hooks/useLGPD';
import { 
  Shield, 
  Mail, 
  BarChart, 
  Share2, 
  Activity, 
  Zap, 
  Globe,
  CheckCircle,
  AlertCircle,
  Info,
  Save,
  RotateCcw
} from 'lucide-react';

interface PrivacySetting {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'communications' | 'data_processing' | 'visibility' | 'integrations';
  level: 'essential' | 'functional' | 'optional';
  legalBasis: string;
}

export function LGPDPrivacySettings() {
  const { privacySettings, updatePrivacySettings, isLoading } = useLGPD();
  const [localSettings, setLocalSettings] = useState<Record<string, boolean | string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<PrivacySetting | null>(null);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  useEffect(() => {
    if (privacySettings?.settings) {
      setLocalSettings(privacySettings.settings);
    }
  }, [privacySettings]);

  const privacySettingsConfig: PrivacySetting[] = [
    {
      key: 'marketing_consent',
      label: 'Comunicações de Marketing',
      description: 'Receber e-mails promocionais, newsletters e ofertas especiais',
      icon: Mail as any,
      category: 'communications',
      level: 'optional',
      legalBasis: 'Consentimento'
    },
    {
      key: 'analytics_consent',
      label: 'Análise de Uso',
      description: 'Permitir coleta de dados para análise de comportamento e melhorias',
      icon: BarChart as any,
      category: 'data_processing',
      level: 'functional',
      legalBasis: 'Interesse legítimo'
    },
    {
      key: 'communication_consent',
      label: 'Comunicações Gerais',
      description: 'Receber notificações importantes sobre sua conta e serviços',
      icon: Mail as any,
      category: 'communications',
      level: 'essential',
      legalBasis: 'Execução de contrato'
    },
    {
      key: 'data_sharing_consent',
      label: 'Compartilhamento de Dados',
      description: 'Permitir compartilhamento de dados com parceiros autorizados',
      icon: Share2 as any,
      category: 'data_processing',
      level: 'optional',
      legalBasis: 'Consentimento'
    },
    {
      key: 'activity_tracking',
      label: 'Rastreamento de Atividades',
      description: 'Monitorar interações no sistema para personalização',
      icon: Activity as any,
      category: 'data_processing',
      level: 'functional',
      legalBasis: 'Interesse legítimo'
    },
    {
      key: 'automated_processing',
      label: 'Processamento Automatizado',
      description: 'Permitir tomada de decisões automatizadas baseadas em seus dados',
      icon: Zap as any,
      category: 'data_processing',
      level: 'functional',
      legalBasis: 'Interesse legítimo'
    },
    {
      key: 'third_party_integrations',
      label: 'Integrações com Terceiros',
      description: 'Conectar com serviços externos para funcionalidades adicionais',
      icon: Globe as any,
      category: 'integrations',
      level: 'optional',
      legalBasis: 'Consentimento'
    }
  ];

  const profileVisibilityOptions = [
    { value: 'private', label: 'Privado', description: 'Visível apenas para você' },
    { value: 'company', label: 'Empresa', description: 'Visível para funcionários da empresa' },
    { value: 'public', label: 'Público', description: 'Visível para todos os usuários' }
  ];

  const dataRetentionOptions = [
    { value: 'minimal', label: 'Mínima', description: 'Manter apenas pelo tempo necessário' },
    { value: 'standard', label: 'Padrão', description: 'Manter conforme política padrão' },
    { value: 'extended', label: 'Estendida', description: 'Manter por período estendido' }
  ];

  const handleToggle = (key: string) => {
    const newSettings = { ...localSettings, [key]: !localSettings[key] };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSelectChange = (key: string, value: string) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updatePrivacySettings(localSettings);
      setSaveStatus({
        type: 'success',
        message: 'Configurações de privacidade atualizadas com sucesso!'
      });
      setHasChanges(false);
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } catch (error: unknown) {
      console.error('Error saving privacy settings:', error);
      setSaveStatus({
        type: 'error',
        message: 'Erro ao salvar configurações. Tente novamente.'
      });
    }
  };

  const handleReset = () => {
    if (privacySettings?.settings) {
      setLocalSettings(privacySettings.settings);
      setHasChanges(false);
    }
  };

  const getCategoryTitle = (category: string) => {
    const titles = {
      communications: 'Comunicações',
      data_processing: 'Processamento de Dados',
      visibility: 'Visibilidade',
      integrations: 'Integrações'
    };
    return titles[category as keyof typeof titles] || category;
  };

  const getLevelColor = (level: string) => {
    const colors = {
      essential: 'bg-red-100 text-red-800',
      functional: 'bg-yellow-100 text-yellow-800',
      optional: 'bg-green-100 text-green-800'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getLevelLabel = (level: string) => {
    const labels = {
      essential: 'Essencial',
      functional: 'Funcional',
      optional: 'Opcional'
    };
    return labels[level as keyof typeof labels] || level;
  };

  const groupedSettings = privacySettingsConfig.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category]?.push(setting);
    return acc;
  }, {} as Record<string, PrivacySetting[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Configurações de Privacidade</h3>
              <p className="text-gray-600">
                Controle como seus dados são processados e utilizados
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowInfoModal(true)}
            className="flex items-center space-x-2"
          >
            <Info className="w-4 h-4" />
            <span>Ajuda</span>
          </Button>
        </div>
      </Card>

      {/* Save Status */}
      {saveStatus.type && (
        <Alert variant={saveStatus.type}>
          <div className="flex items-center space-x-2">
            {saveStatus.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {saveStatus.type === 'error' && <AlertCircle className="w-5 h-5" />}
            <span>{saveStatus.message}</span>
          </div>
        </Alert>
      )}

      {/* Settings by Category */}
      {Object.entries(groupedSettings).map(([category, settings]) => (
        <Card key={category} className="p-6">
          <h3 className="font-semibold text-lg mb-4">{getCategoryTitle(category)}</h3>
          <div className="space-y-4">
            {settings.map((setting) => {
              const Icon = setting.icon;
              return (
                <div
                  key={setting.key}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <Icon className="w-5 h-5 text-gray-600" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{setting.label}</h4>
                        <Badge className={getLevelColor(setting.level)}>
                          {getLevelLabel(setting.level)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{setting.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Base legal: {setting.legalBasis}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSetting(setting)}
                      className="p-2"
                    >
                      <Info className="w-4 h-4" />
                    </Button>
                    <button
                      onClick={() => handleToggle(setting.key)}
                      disabled={setting.level === 'essential'}
                      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                        localSettings[setting.key]
                          ? 'bg-blue-600'
                          : 'bg-gray-200'
                      } ${setting.level === 'essential' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          localSettings[setting.key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                        style={{ marginTop: '4px' }}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Profile Visibility */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Visibilidade do Perfil</h3>
        <div className="space-y-4">
          {profileVisibilityOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-3">
              <input
                type="radio"
                id={`visibility-${option.value}`}
                name="profile_visibility"
                value={option.value}
                checked={localSettings.profile_visibility === option.value}
                onChange={(e) => handleSelectChange('profile_visibility', e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor={`visibility-${option.value}`} className="flex-1">
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-gray-600">{option.description}</div>
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* Data Retention */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Retenção de Dados</h3>
        <div className="space-y-4">
          {dataRetentionOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-3">
              <input
                type="radio"
                id={`retention-${option.value}`}
                name="data_retention_preference"
                value={option.value}
                checked={localSettings.data_retention_preference === option.value}
                onChange={(e) => handleSelectChange('data_retention_preference', e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor={`retention-${option.value}`} className="flex-1">
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-gray-600">{option.description}</div>
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* Action Buttons */}
      {hasChanges && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-amber-800">
                Você tem alterações não salvas
              </span>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isLoading}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Descartar</span>
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Information Modal */}
      <Modal
        open={showInfoModal}
        onOpenChange={(open) => setShowInfoModal(open)}
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Níveis de Configuração</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Badge className="bg-red-100 text-red-800">Essencial</Badge>
                <span className="text-sm">Necessário para o funcionamento básico</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-yellow-100 text-yellow-800">Funcional</Badge>
                <span className="text-sm">Melhora a experiência do usuário</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-100 text-green-800">Opcional</Badge>
                <span className="text-sm">Recursos adicionais não essenciais</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Seus Direitos</h4>
            <ul className="text-sm space-y-1">
              <li>• Você pode alterar essas configurações a qualquer momento</li>
              <li>• Configurações essenciais não podem ser desabilitadas</li>
              <li>• Retirar consentimento não afeta a licitude do processamento anterior</li>
              <li>• Algumas funcionalidades podem ser limitadas se você desabilitar certas opções</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Setting Detail Modal */}
      <Modal
        open={!!selectedSetting}
        onOpenChange={(open) => !open && setSelectedSetting(null)}
      >
        {selectedSetting && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Descrição</h4>
              <p className="text-gray-600">{selectedSetting.description}</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Base Legal</h4>
              <p className="text-gray-600">{selectedSetting.legalBasis}</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Nível</h4>
              <Badge className={getLevelColor(selectedSetting.level)}>
                {getLevelLabel(selectedSetting.level)}
              </Badge>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Impacto de Desabilitar</h4>
              <p className="text-gray-600">
                {selectedSetting.level === 'essential' 
                  ? 'Esta configuração não pode ser desabilitada pois é essencial para o funcionamento do sistema.'
                  : selectedSetting.level === 'functional'
                  ? 'Desabilitar esta opção pode limitar algumas funcionalidades do sistema.'
                  : 'Desabilitar esta opção não afeta o funcionamento básico do sistema.'
                }
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}