import { api } from '@/lib/api/client';

export interface PopulationMetrics {
  total_population: number;
  risk_distribution: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  risk_percentages: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  category_averages: Record<string, number>;
  top_risk_factors: Array<{
    factor: string;
    count: number;
    percentage: number;
  }>;
}

export interface PredictiveAnalytics {
  population_trends: any;
  high_risk_predictions: Array<{
    beneficiary_id: string;
    current_risk: string;
    predicted_risk: string;
    trajectory: string;
    confidence: number;
    key_factors: any[];
  }>;
  cost_analysis: {
    current_annual_cost: number;
    potential_savings: number;
    intervention_investment: number;
    net_savings: number;
    roi: number;
    break_even_months: number;
  };
  recommended_interventions: any[];
}

export interface WebhookConfig {
  endpoint: string;
  events: string[];
  secret: string;
  retry_policy?: {
    max_attempts: number;
    backoff_seconds: number;
  };
}

export interface ExecutiveSummary {
  executive_overview: {
    period: string;
    total_population_assessed: number;
    high_risk_percentage: number;
    key_achievements: string[];
    areas_of_concern: string[];
  };
  financial_impact: {
    current_risk_cost: number;
    projected_savings: number;
    roi: string;
    payback_period: string;
  };
  strategic_recommendations: string[];
  success_metrics: {
    interventions_completed: number;
    risk_reduction_achieved: number;
    member_engagement_rate: number;
  };
}

export const healthIntelligenceApi = {
  // Population Health Metrics
  getPopulationMetrics: (params?: {
    date_from?: string;
    date_to?: string;
    risk_level?: string;
    categories?: string[];
  }) => api.get<PopulationMetrics>('/api/v1/health-intelligence/population-metrics', { params }),

  // Risk Profiles
  getRiskProfiles: (params: {
    risk_level: 'critical' | 'high' | 'moderate' | 'low';
    date_from: string;
    date_to?: string;
    include_predictions?: boolean;
    include_interventions?: boolean;
    limit?: number;
  }) => api.get('/api/v1/health-intelligence/risk-profiles', { params }),

  // Predictive Analytics
  getPredictiveAnalytics: (params?: {
    prediction_horizon_days?: number;
    categories?: string[];
    confidence_threshold?: number;
    include_interventions?: boolean;
  }) => api.get<PredictiveAnalytics>('/api/v1/health-intelligence/predictive-analytics', { params }),

  // Intervention Effectiveness
  getInterventionEffectiveness: (params: {
    date_from: string;
    date_to?: string;
    intervention_types?: string[];
    outcome_metrics?: string[];
  }) => api.get('/api/v1/health-intelligence/intervention-effectiveness', { params }),

  // Executive Summary
  getExecutiveSummary: (params: {
    period: 'monthly' | 'quarterly' | 'annual';
    include_cost_analysis?: boolean;
    include_roi_metrics?: boolean;
    format?: 'json' | 'pdf';
  }) => api.get<ExecutiveSummary>('/api/v1/health-intelligence/executive-summary', { params }),

  // Webhook Management
  registerWebhook: (config: WebhookConfig) => 
    api.post('/api/v1/health-intelligence/webhooks/critical-alerts', config),

  // Alert Notifications
  notifyAlert: (data: {
    alert_id: string;
    notification_type: 'immediate' | 'scheduled';
    webhook_id: string;
  }) => api.post('/api/v1/health-intelligence/alerts/notify', data)
};

// Internal Admin API for ML predictions
export const mlPredictionsApi = {
  // Get predictions for a specific beneficiary
  getPredictions: (beneficiaryId: number, daysAhead: number = 30) =>
    api.get(`/api/admin/health-risks/predictions/${beneficiaryId}`, { 
      params: { days_ahead: daysAhead } 
    }),

  // Get similar patients
  getSimilarPatients: (beneficiaryId: number, limit: number = 10) =>
    api.get(`/api/admin/health-risks/similar-patients/${beneficiaryId}`, { 
      params: { limit } 
    }),

  // Generate interventions
  generateInterventions: (riskProfile: any) =>
    api.post('/api/admin/health-risks/generate-interventions', { risk_profile: riskProfile }),

  // Train ML models
  trainModels: (trainingData?: any) =>
    api.post('/api/admin/health-risks/train-models', { training_data: trainingData })
};