import { useState, useCallback } from 'react';
import { api } from '@/services/api';

interface PrivacySettings {
  settings: {
    lgpd_consent: boolean;
    lgpd_consent_at: string;
    marketing_consent: boolean;
    analytics_consent: boolean;
    communication_consent: boolean;
    data_sharing_consent: boolean;
    profile_visibility: 'private' | 'company' | 'public';
    activity_tracking: boolean;
    automated_processing: boolean;
    third_party_integrations: boolean;
    data_retention_preference: 'minimal' | 'standard' | 'extended';
    last_privacy_update: string;
  };
  available_options: Record<string, string>;
  legal_basis: Record<string, string>;
  data_categories: Record<string, string>;
}

interface ConsentHistoryItem {
  date: string;
  type: string;
  action: string;
  details: any;
  ip_address: string;
  user_agent: string;
}

interface ConsentHistory {
  consent_history: ConsentHistoryItem[];
  total_records: number;
  current_consent: {
    lgpd_consent: boolean;
    consent_date: string;
    consent_ip: string;
  };
}

interface DataProcessingActivity {
  date: string;
  activity: string;
  purpose: string;
  legal_basis: string;
  data_type: string;
  action: string;
  user_consent: boolean;
}

interface DataProcessingActivities {
  activities: DataProcessingActivity[];
  total_records: number;
  summary: {
    total_data_access: number;
    total_data_modifications: number;
    total_data_exports: number;
    consent_based_activities: number;
  };
}

interface ExportResponse {
  message: string;
  download_url: string;
  expires_at: string;
  file_size: number;
  records_count?: number;
}

interface AccountDeletionResponse {
  message: string;
  deleted_at: string;
  data_removed: Record<string, string>;
}

export function useLGPD() {
  const [isLoading, setIsLoading] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);
  const [consentHistory, setConsentHistory] = useState<ConsentHistory | null>(null);
  const [dataProcessingActivities, setDataProcessingActivities] = useState<DataProcessingActivities | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPrivacySettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get('/lgpd/privacy-settings');
      setPrivacySettings(response.data);
    } catch (err: any) {
      console.error('Error fetching privacy settings:', err);
      setError(err.response?.data?.message || 'Erro ao carregar configurações de privacidade');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePrivacySettings = useCallback(async (settings: Partial<PrivacySettings['settings']>) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.put('/lgpd/privacy-settings', { preferences: settings });
      
      // Update local state
      if (privacySettings) {
        setPrivacySettings({
          ...privacySettings,
          settings: {
            ...privacySettings.settings,
            ...settings,
            last_privacy_update: new Date().toISOString()
          }
        });
      }
      
      return response.data;
    } catch (err: any) {
      console.error('Error updating privacy settings:', err);
      const errorMessage = err.response?.data?.message || 'Erro ao atualizar configurações de privacidade';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [privacySettings]);

  const fetchConsentHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get('/lgpd/consent-history');
      setConsentHistory(response.data);
    } catch (err: any) {
      console.error('Error fetching consent history:', err);
      setError(err.response?.data?.message || 'Erro ao carregar histórico de consentimentos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDataProcessingActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get('/lgpd/data-processing-activities');
      setDataProcessingActivities(response.data);
    } catch (err: any) {
      console.error('Error fetching data processing activities:', err);
      setError(err.response?.data?.message || 'Erro ao carregar atividades de processamento');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportUserData = useCallback(async (): Promise<ExportResponse> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get('/lgpd/export-data');
      return response.data;
    } catch (err: any) {
      console.error('Error exporting user data:', err);
      const errorMessage = err.response?.data?.message || 'Erro ao exportar dados do usuário';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportUserDataPdf = useCallback(async (): Promise<ExportResponse> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get('/lgpd/export-data-pdf');
      return response.data;
    } catch (err: any) {
      console.error('Error exporting user data PDF:', err);
      const errorMessage = err.response?.data?.message || 'Erro ao exportar dados em PDF';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const withdrawConsent = useCallback(async (consentTypes: string[], reason?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.post('/lgpd/withdraw-consent', {
        consent_types: consentTypes,
        reason
      });
      
      // Refresh consent history
      await fetchConsentHistory();
      
      return response.data;
    } catch (err: any) {
      console.error('Error withdrawing consent:', err);
      const errorMessage = err.response?.data?.message || 'Erro ao retirar consentimento';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchConsentHistory]);

  const deleteAccount = useCallback(async (
    password: string, 
    confirmation: string, 
    reason?: string
  ): Promise<AccountDeletionResponse> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.delete('/lgpd/delete-account', {
        data: {
          password,
          confirmation,
          reason
        }
      });
      
      return response.data;
    } catch (err: any) {
      console.error('Error deleting account:', err);
      const errorMessage = err.response?.data?.message || 'Erro ao excluir conta';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Utility functions
  const getConsentTypesFromSettings = useCallback((settings: PrivacySettings['settings']) => {
    const consentTypes: string[] = [];
    
    if (settings.marketing_consent) consentTypes.push('marketing');
    if (settings.analytics_consent) consentTypes.push('analytics');
    if (settings.communication_consent) consentTypes.push('communication');
    if (settings.data_sharing_consent) consentTypes.push('data_sharing');
    if (settings.automated_processing) consentTypes.push('automated_processing');
    if (settings.third_party_integrations) consentTypes.push('third_party_integrations');
    
    return consentTypes;
  }, []);

  const getPrivacyCompliance = useCallback((settings: PrivacySettings['settings']) => {
    const totalSettings = 7; // Total number of privacy settings
    const enabledSettings = getConsentTypesFromSettings(settings).length;
    
    const score = (enabledSettings / totalSettings) * 100;
    
    let level: 'high' | 'medium' | 'low' = 'low';
    let message = '';
    
    if (score >= 80) {
      level = 'high';
      message = 'Sua privacidade está bem protegida';
    } else if (score >= 50) {
      level = 'medium';
      message = 'Algumas configurações podem ser ajustadas';
    } else {
      level = 'low';
      message = 'Considere revisar suas configurações de privacidade';
    }
    
    return {
      score: Math.round(score),
      level,
      message,
      enabled_count: enabledSettings,
      total_count: totalSettings
    };
  }, [getConsentTypesFromSettings]);

  const getDataRetentionInfo = useCallback((preference: string) => {
    const retentionInfo = {
      minimal: {
        description: 'Dados mantidos pelo menor tempo possível',
        period: '30 dias após término do contrato',
        benefits: ['Menor exposição a riscos', 'Conformidade máxima'],
        limitations: ['Menos personalização', 'Histórico limitado']
      },
      standard: {
        description: 'Retenção padrão conforme políticas da empresa',
        period: '2 anos após término do contrato',
        benefits: ['Melhor experiência', 'Histórico moderado'],
        limitations: ['Exposição moderada a riscos']
      },
      extended: {
        description: 'Retenção estendida para análises avançadas',
        period: '5 anos após término do contrato',
        benefits: ['Máxima personalização', 'Histórico completo'],
        limitations: ['Maior exposição a riscos', 'Menos privacidade']
      }
    };
    
    return retentionInfo[preference as keyof typeof retentionInfo] || retentionInfo.standard;
  }, []);

  return {
    // State
    isLoading,
    error,
    privacySettings,
    consentHistory,
    dataProcessingActivities,
    
    // Actions
    fetchPrivacySettings,
    updatePrivacySettings,
    fetchConsentHistory,
    fetchDataProcessingActivities,
    exportUserData,
    exportUserDataPdf,
    withdrawConsent,
    deleteAccount,
    clearError,
    
    // Utilities
    getConsentTypesFromSettings,
    getPrivacyCompliance,
    getDataRetentionInfo,
  };
}