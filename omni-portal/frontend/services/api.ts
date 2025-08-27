import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, GamificationStats, GamificationBadge, LeaderboardEntry } from '@/types';
import { DashboardSummary, GamificationLevel } from '@/types/api';
import { LGPDPrivacySettings, LGPDConsentHistoryEntry, LGPDDataProcessingActivity, LGPDConsentWithdrawal, LGPDAccountDeletionRequest } from '@/types/lgpd';
import { getApiUrl } from '@/lib/api-config';

class ApiService {
  private client: AxiosInstance;
  private csrfInitialized = false;

  constructor() {
    // Use the proper URL based on server/client context
    const baseURL = getApiUrl();
    
    if (!baseURL) {
      throw new Error('API base URL is not configured');
    }
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: true, // Enable cookies for CSRF
    });

    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Ensure CSRF cookie is set before first request
        if (!this.csrfInitialized) {
          await this.initializeCsrf();
        }

        // Auth is now handled via httpOnly cookies by CookieAuth middleware
        // No need to manually add Authorization header

        // Add CSRF token from cookie
        const csrfToken = this.getCsrfToken();
        if (csrfToken) {
          config.headers['X-CSRF-TOKEN'] = csrfToken;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Handle CSRF token mismatch
        if (error.response?.status === 419) {
          // Reset CSRF and retry once
          this.csrfInitialized = false;
          await this.initializeCsrf();
          
          // Retry the original request
          const originalRequest = error.config;
          originalRequest.headers['X-CSRF-TOKEN'] = this.getCsrfToken();
          return this.client.request(originalRequest);
        }

        if (error.response?.status === 401) {
          // Handle unauthorized access
          this.clearAuthToken();
          // SSR guard: Only redirect on client side
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Initialize CSRF cookie
  private async initializeCsrf(): Promise<void> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
      await axios.get(`${baseUrl}/sanctum/csrf-cookie`, { withCredentials: true });
      this.csrfInitialized = true;
    } catch (error) {
      console.error('Failed to initialize CSRF cookie:', error);
    }
  }

  // Get CSRF token from cookie
  private getCsrfToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    const value = `; ${document.cookie}`;
    const parts = value.split(`; XSRF-TOKEN=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift() || null;
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
  }

  // Auth token management - now handled via httpOnly cookies
  private getAuthToken(): string | null {
    // Token is now in httpOnly cookie, no need to get from localStorage
    return null;
  }

  private setAuthToken(token: string): void {
    // Token is now in httpOnly cookie, no need to store in localStorage
  }

  private clearAuthToken(): void {
    // Token is now in httpOnly cookie, cleared by backend
  }

  // Generic request methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.get(url, config);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data, config);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.put(url, data, config);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(url, config);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // File upload
  async uploadFile(url: string, file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<{ url: string; filename: string }>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await this.client.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Error handling
  private handleError(error: unknown): ApiResponse<never> {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        data: null as never,
        status: error.response?.status || 500,
        error: {
          code: error.response?.data?.error?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data?.error?.details,
        },
      };
    }
    return {
      success: false,
      data: null as any,
      status: 500,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      },
    };
  }

  // Auth methods
  setAuth(token: string): void {
    this.setAuthToken(token);
  }

  clearAuth(): void {
    this.clearAuthToken();
  }

  // Gamification API methods with proper typing
  async getGamificationProgress(): Promise<ApiResponse<GamificationProgress>> {
    return this.get('/gamification/progress');
  }

  async getGamificationStats(): Promise<ApiResponse<GamificationStats>> {
    return this.get('/gamification/stats');
  }

  async getAchievements(): Promise<ApiResponse<GamificationBadge[]>> {
    return this.get('/gamification/badges');
  }

  async getLeaderboard(limit: number = 10): Promise<ApiResponse<LeaderboardEntry[]>> {
    return this.get(`/gamification/leaderboard?limit=${limit}`);
  }

  async getActivityFeed(limit: number = 20): Promise<ApiResponse<Activity[]>> {
    return this.get(`/gamification/activity-feed?limit=${limit}`);
  }

  async getDashboardSummary(): Promise<ApiResponse<DashboardSummary>> {
    return this.get('/gamification/dashboard');
  }

  async getGamificationLevels(): Promise<ApiResponse<GamificationLevel[]>> {
    return this.get('/gamification/levels');
  }

  // Registration methods
  async registerStep1(data: RegisterStep1Data): Promise<ApiResponse<RegisterStep1Response>> {
    return this.post('/register/step1', data);
  }

  async registerStep2(data: RegisterStep2Data): Promise<ApiResponse<RegisterStep2Response>> {
    return this.post('/register/step2', data);
  }

  async registerStep3(data: RegisterStep3Data): Promise<ApiResponse<RegisterStep3Response>> {
    return this.post('/register/step3', data);
  }

  async getRegistrationProgress(): Promise<ApiResponse<RegistrationProgressResponse>> {
    return this.get('/register/progress');
  }

  async cancelRegistration(): Promise<ApiResponse<void>> {
    return this.delete('/register/cancel');
  }

  // Profile methods
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    return this.get('/auth/user');
  }

  async updateProfile(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.put('/profile', data);
  }

  async uploadProfilePhoto(file: File): Promise<ApiResponse<{ url: string }>> {
    return this.uploadFile('/profile/photo', file);
  }

  // LGPD methods with proper typing
  async getLGPDPrivacySettings(): Promise<ApiResponse<LGPDPrivacySettings>> {
    return this.get('/lgpd/privacy-settings');
  }

  async updateLGPDPrivacySettings(settings: LGPDPrivacySettings): Promise<ApiResponse<LGPDPrivacySettings>> {
    return this.put('/lgpd/privacy-settings', { preferences: settings });
  }

  async getLGPDConsentHistory(): Promise<ApiResponse<LGPDConsentHistoryEntry[]>> {
    return this.get('/lgpd/consent-history');
  }

  async getLGPDDataProcessingActivities(): Promise<ApiResponse<LGPDDataProcessingActivity[]>> {
    return this.get('/lgpd/data-processing-activities');
  }

  async exportLGPDUserData(): Promise<ApiResponse<{ download_url: string; expires_at: string }>> {
    return this.get('/lgpd/export-data');
  }

  async exportLGPDUserDataPdf(): Promise<ApiResponse<{ download_url: string; expires_at: string }>> {
    return this.get('/lgpd/export-data-pdf');
  }

  async withdrawLGPDConsent(data: LGPDConsentWithdrawal): Promise<ApiResponse<{ message: string }>> {
    return this.post('/lgpd/withdraw-consent', data);
  }

  async deleteLGPDAccount(data: LGPDAccountDeletionRequest): Promise<ApiResponse<{ message: string }>> {
    return this.delete('/lgpd/delete-account', { data });
  }
}

// Registration Data Types
export interface RegisterStep1Data {
  name: string;
  email: string;
  cpf: string;
  lgpd_consent: boolean;
}

export interface RegisterStep1Response {
  message: string;
  user_id: string;
  registration_step: string;
  token: string;
}

export interface RegisterStep2Data {
  phone: string;
  department: string;
  job_title: string;
  employee_id: string;
  start_date: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'other';
  preferred_language?: string;
}

export interface RegisterStep2Response {
  message: string;
  registration_step: string;
}

export interface RegisterStep3Data {
  password: string;
  password_confirmation: string;
  security_question: string;
  security_answer: string;
  two_factor_enabled?: boolean;
}

export interface RegisterStep3Response {
  message: string;
  user: UserProfile;
  token: string;
  token_type: string;
  gamification: {
    points_earned: number;
    total_points: number;
    level: number;
  };
}

export interface RegistrationProgressResponse {
  current_step: string;
  steps: {
    [key: string]: {
      completed: boolean;
      title: string;
    };
  };
  completed: boolean;
}

// Profile and Gamification Types
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  department?: string;
  job_title?: string;
  employee_id?: string;
  start_date?: string;
  birth_date?: string;
  gender?: string;
  marital_status?: string;
  preferred_language?: string;
  photo_url?: string;
  points: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface GamificationProgress {
  points: number;
  level: number;
  badges_earned: number;
  next_level_points: number;
  progress_percentage: number;
  recent_activities: Activity[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  earned_at?: string;
  points_awarded: number;
}

export interface Activity {
  id: string;
  action: string;
  points_earned: number;
  created_at: string;
}


export default new ApiService();