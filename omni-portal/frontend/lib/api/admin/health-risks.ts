import { api } from '@/lib/api/client';

export interface AlertFilters {
  priority?: string;
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface InterventionData {
  action_type: string;
  action_description: string;
  follow_up_date?: string;
  notes?: string;
}

export interface ReportGenerationData {
  report_type: 'summary' | 'detailed' | 'interventions' | 'outcomes';
  format: 'pdf' | 'excel' | 'json' | 'csv';
  timeframe: string;
  filters?: {
    priority?: string[];
    categories?: string[];
    beneficiary_ids?: string[];
  };
  include_charts?: boolean;
  include_recommendations?: boolean;
}

export const healthRisksApi = {
  // Dashboard
  dashboard: (timeframe: string = '7days') => 
    api.get(`/admin/health-risks/dashboard?timeframe=${timeframe}`),
  
  // Alerts Management
  alerts: {
    list: (filters: AlertFilters = {}) => 
      api.get('/admin/health-risks/alerts', { params: filters }),
    
    get: (id: string) => 
      api.get(`/admin/health-risks/alerts/${id}`),
    
    acknowledge: (id: string) => 
      api.post(`/admin/health-risks/alerts/${id}/acknowledge`),
    
    updateStatus: (id: string, status: string, notes?: string) =>
      api.put(`/admin/health-risks/alerts/${id}/status`, { status, notes }),
    
    createIntervention: (id: string, data: InterventionData) =>
      api.post(`/admin/health-risks/alerts/${id}/intervention`, data),
    
    dismiss: (id: string, reason: string) =>
      api.post(`/admin/health-risks/alerts/${id}/dismiss`, { reason }),
    
    escalate: (id: string, escalation_notes: string) =>
      api.post(`/admin/health-risks/alerts/${id}/escalate`, { escalation_notes }),
    
    getWorkflow: (id: string) =>
      api.get(`/admin/health-risks/alerts/${id}/workflow`)
  },
  
  // Reports
  reports: {
    list: () => 
      api.get('/admin/health-risks/reports'),
    
    generate: (data: ReportGenerationData) =>
      api.post('/admin/health-risks/reports/generate', data),
    
    download: (id: string) =>
      api.get(`/admin/health-risks/reports/${id}/download`, { 
        responseType: 'blob' 
      }),
    
    getStatus: (id: string) =>
      api.get(`/admin/health-risks/reports/${id}/status`)
  },
  
  // Analytics
  analytics: {
    riskDistribution: (timeframe: string = '30days') =>
      api.get(`/admin/health-risks/analytics/risk-distribution?timeframe=${timeframe}`),
    
    trends: (metric: string, timeframe: string = '30days') =>
      api.get(`/admin/health-risks/analytics/trends`, { 
        params: { metric, timeframe } 
      }),
    
    beneficiaryRisks: (beneficiaryId: string) =>
      api.get(`/admin/health-risks/analytics/beneficiary/${beneficiaryId}`)
  },
  
  // Workflow Templates
  workflows: {
    list: () =>
      api.get('/admin/health-risks/workflows'),
    
    create: (data: any) =>
      api.post('/admin/health-risks/workflows', data),
    
    update: (id: string, data: any) =>
      api.put(`/admin/health-risks/workflows/${id}`, data),
    
    delete: (id: string) =>
      api.delete(`/admin/health-risks/workflows/${id}`)
  },
  
  // SLA Management
  sla: {
    getMetrics: () =>
      api.get('/admin/health-risks/sla/metrics'),
    
    getOverdue: () =>
      api.get('/admin/health-risks/sla/overdue'),
    
    updateThresholds: (data: any) =>
      api.put('/admin/health-risks/sla/thresholds', data)
  }
};