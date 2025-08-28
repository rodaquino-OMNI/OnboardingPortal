// Admin API Types - Extended interfaces for API integration

// ===== IMPORT BASE TYPES =====
import type {
  AdminUser,
  AdminRole,
  AdminPermission,
  AdminUserRole,
  AdminDashboardData,
  AdminAnalytics,
  ApiResponse,
  PaginatedResponse
} from './admin';

// ===== LEGACY TYPES (KEEP FOR COMPATIBILITY) =====
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

// ===== NEW API REQUEST TYPES =====
export interface CreateAdminUserRequest {
  name: string;
  email: string;
  password: string;
  roles: string[];
  department?: string;
  employeeId?: string;
}

export interface UpdateAdminUserRequest {
  name?: string;
  email?: string;
  roles?: string[];
  department?: string;
  isActive?: boolean;
}

export interface AssignRoleRequest {
  userId: number;
  roleId: number;
  expiresAt?: string;
  assignmentReason?: string;
}

export interface CreateRoleRequest {
  name: string;
  displayName: string;
  description?: string;
  hierarchyLevel: number;
  permissions: string[];
}

// ===== API RESPONSE TYPES =====
export interface AdminUserResponse extends ApiResponse<AdminUser> {
  data: AdminUser;
}

export interface AdminUsersResponse extends PaginatedResponse<AdminUser> {
  data: AdminUser[];
}

export interface AdminRoleResponse extends ApiResponse<AdminRole> {
  data: AdminRole;
}

export interface AdminRolesResponse extends PaginatedResponse<AdminRole> {
  data: AdminRole[];
}

// ===== FILTER TYPES =====
export interface AdminUserFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'locked' | 'pending';
  role?: string;
  department?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface AdminRoleFilters {
  search?: string;
  hierarchyLevel?: number;
  isSystemRole?: boolean;
}

// ===== WEBHOOK TYPES =====
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  isActive: boolean;
  events: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  name: string;
  description: string;
  category: 'health' | 'user' | 'system' | 'compliance';
  payload: Record<string, unknown>;
}

// ===== DATA EXPORT TYPES =====
export interface DataExportJob {
  id: string;
  name: string;
  type: 'health_data' | 'user_data' | 'analytics' | 'audit_logs';
  format: 'csv' | 'excel' | 'json' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  recordCount?: number;
}

// ===== REAL-TIME ALERTS =====
export interface RealTimeAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'health' | 'security' | 'system' | 'compliance';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}