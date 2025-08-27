// Admin API Response Types
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface DashboardData {
  alerts: Alert[];
  metrics: DashboardMetrics;
  reports: Report[];
  users: UserSummary[];
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  completionRate: number;
  averageScore: number;
}

export interface Report {
  id: string;
  title: string;
  type: 'health' | 'analytics' | 'compliance';
  generatedAt: Date;
  downloadUrl?: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  lastActive: Date;
  completionStatus: 'pending' | 'in_progress' | 'completed';
}

export interface ExecutiveSummary {
  totalAssessments: number;
  riskDistribution: RiskDistribution;
  keyMetrics: KeyMetrics;
  trends: Trend[];
  download_url?: string;
}

export interface RiskDistribution {
  low: number;
  moderate: number;
  high: number;
  critical: number;
}

export interface KeyMetrics {
  averageCompletionTime: number;
  satisfactionScore: number;
  followupRate: number;
}

export interface Trend {
  date: string;
  value: number;
  metric: string;
}

export interface PredictiveAnalytics {
  riskPredictions: RiskPrediction[];
  modelAccuracy: number;
  dataQuality: number;
}

export interface RiskPrediction {
  userId: string;
  predictedRisk: 'low' | 'moderate' | 'high' | 'critical';
  confidence: number;
  factors: string[];
}

export interface WebhookTestResult {
  webhook_id: string;
  test_result: {
    success: boolean;
    statusCode: number;
    responseTime: number;
    error?: string;
  };
}