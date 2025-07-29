// LGPD (Lei Geral de Proteção de Dados) Types with Strict TypeScript

export interface LGPDPrivacySettings {
  id: string;
  marketing_consent: boolean;
  data_sharing_consent: boolean;
  analytics_consent: boolean;
  personalization_consent: boolean;
  communication_preference: 'email' | 'sms' | 'both' | 'none';
  data_retention_period: number; // in months
  updated_at: string;
}

export interface LGPDConsentHistoryEntry {
  id: string;
  consent_type: 'data_processing' | 'marketing' | 'analytics' | 'data_sharing';
  action: 'granted' | 'withdrawn' | 'updated';
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  legal_basis: string;
  purpose: string;
}

export interface LGPDDataProcessingActivity {
  id: string;
  activity_name: string;
  purpose: string;
  legal_basis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  data_categories: string[];
  recipients: string[];
  transfer_countries?: string[];
  retention_period: string;
  security_measures: string[];
  created_at: string;
  updated_at: string;
}

export interface LGPDConsentWithdrawal {
  consent_type: 'marketing' | 'analytics' | 'data_sharing' | 'all';
  reason?: string;
  confirmation: boolean;
}

export interface LGPDAccountDeletionRequest {
  reason: 'privacy_concerns' | 'no_longer_needed' | 'data_portability' | 'other';
  confirmation: boolean;
  password: string;
  delete_all_data: boolean;
  keep_legal_records: boolean;
}

export interface LGPDDataExportRequest {
  format: 'json' | 'csv' | 'pdf';
  include_activity_log: boolean;
  include_consent_history: boolean;
  include_personal_data: boolean;
}

export interface LGPDDataExportResponse {
  download_url: string;
  expires_at: string;
  file_size: number;
  format: string;
  generated_at: string;
}

// Type guards for LGPD
export function isValidConsentType(type: string): type is LGPDConsentWithdrawal['consent_type'] {
  return ['marketing', 'analytics', 'data_sharing', 'all'].includes(type);
}

export function isValidLegalBasis(basis: string): basis is LGPDDataProcessingActivity['legal_basis'] {
  return ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'].includes(basis);
}