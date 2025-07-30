import api from '@/services/api';
import { 
  AdminDashboardData, 
  AdminUser, 
  AdminRole, 
  AdminPermission,
  AdminAnalytics,
  AdminSecurityLog,
  AdminSystemSetting,
  PaginatedResponse 
} from '@/types/admin';

/**
 * Admin API Service
 * Provides comprehensive admin functionality with type safety
 */
export class AdminAPI {
  private static BASE_PATH = '/api/admin';

  // Dashboard & Analytics
  static async getDashboard(): Promise<AdminDashboardData> {
    const response = await api.get(`${this.BASE_PATH}/dashboard`);
    return response.data.data;
  }

  static async getAnalytics(params: {
    period?: '1d' | '7d' | '30d' | '90d' | '1y';
    metrics?: string[];
  }) {
    const response = await api.get(`${this.BASE_PATH}/analytics`, { params });
    return response.data.data;
  }

  static async getRealTimeAnalytics() {
    const response = await api.get(`${this.BASE_PATH}/analytics/real-time`);
    return response.data.data;
  }

  // User Management
  static async getUsers(params: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    role?: string;
    department?: string;
    registration_step?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<AdminUser>> {
    const response = await api.get(`${this.BASE_PATH}/users`, { params });
    return response.data;
  }

  static async getUserDetails(userId: number): Promise<AdminUser> {
    const response = await api.get(`${this.BASE_PATH}/users/${userId}`);
    return response.data.data;
  }

  static async updateUser(userId: number, data: Partial<AdminUser>) {
    const response = await api.put(`${this.BASE_PATH}/users/${userId}`, data);
    return response.data;
  }

  static async lockUser(userId: number, reason: string) {
    const response = await api.post(`${this.BASE_PATH}/users/${userId}/lock`, { reason });
    return response.data;
  }

  static async unlockUser(userId: number) {
    const response = await api.post(`${this.BASE_PATH}/users/${userId}/unlock`);
    return response.data;
  }

  static async resetUserPassword(userId: number) {
    const response = await api.post(`${this.BASE_PATH}/users/${userId}/reset-password`);
    return response.data;
  }

  static async getUserActivity(userId: number) {
    const response = await api.get(`${this.BASE_PATH}/users/${userId}/activity`);
    return response.data.data;
  }

  static async getUserAuditTrail(userId: number) {
    const response = await api.get(`${this.BASE_PATH}/users/${userId}/audit-trail`);
    return response.data.data;
  }

  // Role & Permission Management
  static async getRoles(): Promise<AdminRole[]> {
    const response = await api.get(`${this.BASE_PATH}/roles`);
    return response.data.data;
  }

  static async createRole(data: {
    name: string;
    display_name: string;
    description?: string;
    hierarchy_level: number;
    permissions?: number[];
  }) {
    const response = await api.post(`${this.BASE_PATH}/roles`, data);
    return response.data;
  }

  static async updateRole(roleId: number, data: Partial<AdminRole>) {
    const response = await api.put(`${this.BASE_PATH}/roles/${roleId}`, data);
    return response.data;
  }

  static async deleteRole(roleId: number) {
    const response = await api.delete(`${this.BASE_PATH}/roles/${roleId}`);
    return response.data;
  }

  static async assignRole(data: {
    user_id: number;
    role_id: number;
    expires_at?: string;
    assignment_reason?: string;
  }) {
    const response = await api.post(`${this.BASE_PATH}/roles/assign`, data);
    return response.data;
  }

  static async revokeRole(data: {
    user_id: number;
    role_id: number;
  }) {
    const response = await api.post(`${this.BASE_PATH}/roles/revoke`, data);
    return response.data;
  }

  static async getPermissions(): Promise<AdminPermission[]> {
    const response = await api.get(`${this.BASE_PATH}/permissions`);
    return response.data.data;
  }

  // Security Audit
  static async getSecurityAudit(params: {
    start_date?: string;
    end_date?: string;
    event_type?: string;
    user_id?: number;
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<AdminSecurityLog>> {
    const response = await api.get(`${this.BASE_PATH}/security-audit`, { params });
    return response.data;
  }

  static async getThreatAlerts() {
    const response = await api.get(`${this.BASE_PATH}/security/threats`);
    return response.data.data;
  }

  static async getComplianceReport() {
    const response = await api.get(`${this.BASE_PATH}/security/compliance`);
    return response.data.data;
  }

  // System Settings
  static async getSystemSettings(): Promise<Record<string, AdminSystemSetting[]>> {
    const response = await api.get(`${this.BASE_PATH}/system-settings`);
    return response.data.data;
  }

  static async updateSystemSetting(key: string, value: any) {
    const response = await api.put(`${this.BASE_PATH}/system-settings`, { key, value });
    return response.data;
  }

  // Data Export
  static async exportData(params: {
    type: 'users' | 'logs' | 'analytics' | 'reports';
    format?: 'csv' | 'xlsx' | 'pdf';
    start_date?: string;
    end_date?: string;
    filters?: Record<string, any>;
  }) {
    const response = await api.post(`${this.BASE_PATH}/export`, params);
    return response.data;
  }

  // Document Management
  static async getDocuments(params: {
    page?: number;
    per_page?: number;
    status?: string;
    user_id?: number;
  }) {
    const response = await api.get(`${this.BASE_PATH}/documents`, { params });
    return response.data;
  }

  static async approveDocument(documentId: number) {
    const response = await api.post(`${this.BASE_PATH}/documents/${documentId}/approve`);
    return response.data;
  }

  static async rejectDocument(documentId: number, reason: string) {
    const response = await api.post(`${this.BASE_PATH}/documents/${documentId}/reject`, { reason });
    return response.data;
  }

  // Health Questionnaires
  static async getHealthQuestionnaires(params: {
    page?: number;
    per_page?: number;
    status?: string;
    risk_level?: string;
  }) {
    const response = await api.get(`${this.BASE_PATH}/health-questionnaires`, { params });
    return response.data;
  }

  static async reviewHealthQuestionnaire(id: number, data: {
    review_notes: string;
    risk_assessment: string;
    recommendations: string[];
  }) {
    const response = await api.post(`${this.BASE_PATH}/health-questionnaires/${id}/review`, data);
    return response.data;
  }

  // System Monitoring
  static async getSystemHealth() {
    const response = await api.get(`${this.BASE_PATH}/system/health`);
    return response.data.data;
  }

  static async getSystemMetrics() {
    const response = await api.get(`${this.BASE_PATH}/system/metrics`);
    return response.data.data;
  }

  // Alert Management
  static async getAlerts(params: {
    status?: 'active' | 'resolved' | 'acknowledged';
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    const response = await api.get(`${this.BASE_PATH}/alerts`, { params });
    return response.data.data;
  }

  static async acknowledgeAlert(alertId: number) {
    const response = await api.post(`${this.BASE_PATH}/alerts/${alertId}/acknowledge`);
    return response.data;
  }

  static async resolveAlert(alertId: number, resolution: string) {
    const response = await api.post(`${this.BASE_PATH}/alerts/${alertId}/resolve`, { resolution });
    return response.data;
  }

  // Bulk Operations
  static async bulkUserAction(data: {
    user_ids: number[];
    action: 'activate' | 'deactivate' | 'lock' | 'unlock' | 'delete';
    reason?: string;
  }) {
    const response = await api.post(`${this.BASE_PATH}/bulk/users`, data);
    return response.data;
  }

  static async bulkDocumentAction(data: {
    document_ids: number[];
    action: 'approve' | 'reject';
    reason?: string;
  }) {
    const response = await api.post(`${this.BASE_PATH}/bulk/documents`, data);
    return response.data;
  }

  // WebSocket connection for real-time updates
  static connectWebSocket(callbacks: {
    onDashboardUpdate?: (data: any) => void;
    onNewAlert?: (alert: any) => void;
    onUserActivity?: (activity: any) => void;
    onSystemMetric?: (metric: any) => void;
  }) {
    if (typeof window === 'undefined') return null;
    
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'dashboard-update':
          callbacks.onDashboardUpdate?.(data.payload);
          break;
        case 'new-alert':
          callbacks.onNewAlert?.(data.payload);
          break;
        case 'user-activity':
          callbacks.onUserActivity?.(data.payload);
          break;
        case 'system-metric':
          callbacks.onSystemMetric?.(data.payload);
          break;
      }
    };
    
    return ws;
  }
}

export default AdminAPI;