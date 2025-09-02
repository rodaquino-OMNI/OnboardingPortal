// Admin Dashboard Types

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface AdminDashboardData {
  summary: {
    total_users: number;
    active_users: number;
    new_users_today: number;
    total_beneficiaries: number;
    pending_documents: number;
    completed_questionnaires: number;
    system_alerts: number;
  };
  recent_activity: AdminActionLog[];
  alerts: AdminAlert[];
  performance_metrics: PerformanceMetric[];
  user_analytics: UserAnalytic[];
  system_status: SystemStatus;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  cpf?: string;
  employee_id?: string;
  status: 'active' | 'inactive' | 'locked' | 'pending';
  is_active: boolean;
  is_admin: boolean;
  registration_step: string;
  department?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  email_verified_at?: string;
  beneficiary?: Beneficiary;
  adminRoles?: AdminRole[];
  documents?: Document[];
  healthQuestionnaires?: HealthQuestionnaire[];
  gamificationProgress?: GamificationProgress;
}

export interface AdminRole {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  hierarchy_level: number;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
  adminPermissions?: AdminPermission[];
  userAssignments?: AdminUserRole[];
}

export interface AdminPermission {
  id: number;
  identifier: string;
  display_name: string;
  description?: string;
  resource: string;
  action: string;
  scope?: string;
  conditions?: any;
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRole {
  id: number;
  user_id: number;
  admin_role_id: number;
  assigned_at: string;
  expires_at?: string;
  assigned_by: number;
  assignment_reason?: string;
  is_active: boolean;
  user?: AdminUser;
  adminRole?: AdminRole;
}

export interface AdminActionLog {
  id: number;
  user_id: number;
  admin_session_id?: number;
  action_type: string;
  resource_type: string;
  resource_id?: number;
  action_data?: any;
  ip_address: string;
  user_agent: string;
  request_method: string;
  request_url: string;
  response_status: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  user?: AdminUser;
}

export interface AdminAlert {
  id: number;
  type: 'error' | 'warning' | 'info' | 'success';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  action?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  resolved_at?: string;
  resolved_by?: number;
  metadata?: any;
}

export interface AdminSecurityLog {
  id: number;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_id?: number;
  ip_address: string;
  user_agent: string;
  description: string;
  metadata?: any;
  created_at: string;
  user?: AdminUser;
}

export interface AdminSystemSetting {
  id: number;
  category: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_sensitive: boolean;
  validation_rules?: any;
  last_modified_by?: number;
  last_modified_at?: string;
}

export interface PerformanceMetric {
  id: number;
  metric_name: string;
  metric_value: number;
  metric_type: string;
  period: string;
  aggregation_method: string;
  dimensions?: any;
  created_at: string;
}

export interface UserAnalytic {
  id: number;
  date: string;
  new_users: number;
  active_users: number;
  retention_rate: number;
  completion_rate: number;
  avg_session_duration: number;
  device_breakdown?: any;
  location_breakdown?: any;
}

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  response_time: number;
  error_rate: number;
  active_sessions: number;
  queue_size: number;
  last_check: string;
}

export interface Beneficiary {
  id: number;
  user_id: number;
  full_name: string;
  birth_date: string;
  gender?: string;
  marital_status?: string;
  dependents_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: number;
  user_id: number;
  beneficiary_id?: number;
  type: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  uploaded_at: string;
  reviewed_at?: string;
  reviewed_by?: number;
}

export interface HealthQuestionnaire {
  id: number;
  user_id: number;
  beneficiary_id?: number;
  status: 'draft' | 'completed' | 'reviewed';
  risk_level?: 'low' | 'medium' | 'high';
  completed_at?: string;
  reviewed_at?: string;
  reviewed_by?: number;
  responses?: any;
  ai_analysis?: any;
}

export interface GamificationProgress {
  id: number;
  user_id: number;
  total_points: number;
  current_level: number;
  badges_earned: string[];
  achievements: any[];
  last_activity: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
  };
  summary?: any;
}

export interface AdminAnalytics {
  users?: UserAnalytics;
  documents?: DocumentAnalytics;
  health?: HealthAnalytics;
  gamification?: GamificationAnalytics;
  performance?: PerformanceAnalytics;
  security?: SecurityAnalytics;
}

export interface UserAnalytics {
  total_users: number;
  new_users: TimeSeriesData[];
  active_users: TimeSeriesData[];
  registration_funnel: FunnelData;
  demographics: DemographicData;
}

export interface DocumentAnalytics {
  total_documents: number;
  documents_by_type: ChartData[];
  approval_rate: number;
  processing_time: TimeSeriesData[];
  rejection_reasons: ChartData[];
}

export interface HealthAnalytics {
  total_questionnaires: number;
  completion_rate: number;
  risk_distribution: ChartData[];
  common_conditions: ChartData[];
  ai_engagement: TimeSeriesData[];
}

export interface GamificationAnalytics {
  participation_rate: number;
  average_points: number;
  level_distribution: ChartData[];
  badge_distribution: ChartData[];
  engagement_trends: TimeSeriesData[];
}

export interface PerformanceAnalytics {
  response_times: TimeSeriesData[];
  error_rates: TimeSeriesData[];
  concurrent_users: TimeSeriesData[];
  resource_usage: ResourceUsage;
}

export interface SecurityAnalytics {
  failed_logins: TimeSeriesData[];
  security_events: SecurityEvent[];
  threat_level: 'low' | 'medium' | 'high';
  compliance_score: number;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface ChartData {
  label: string;
  value: number;
  color?: string;
}

export interface FunnelData {
  stage: string;
  count: number;
  percentage: number;
}

export interface DemographicData {
  age_groups: ChartData[];
  gender_distribution: ChartData[];
  location_distribution: ChartData[];
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface SecurityEvent {
  id: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  description: string;
  user_id?: number;
  ip_address?: string;
}