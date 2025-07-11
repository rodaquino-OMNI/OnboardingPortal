import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse } from '@/types';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${process.env.NEXT_PUBLIC_API_URL}/${process.env.NEXT_PUBLIC_API_VERSION}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
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
        if (error.response?.status === 401) {
          // Handle unauthorized access
          this.clearAuthToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth token management
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  private setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  private clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
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

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data, config);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
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
  async uploadFile(url: string, file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<any>> {
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
  private handleError(error: any): ApiResponse<any> {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: {
          code: error.response?.data?.error?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data?.error?.details,
        },
      };
    }
    return {
      success: false,
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

  // Gamification API methods
  async getGamificationProgress(): Promise<ApiResponse<any>> {
    return this.get('/gamification/progress');
  }

  async getGamificationStats(): Promise<ApiResponse<any>> {
    return this.get('/gamification/stats');
  }

  async getAchievements(): Promise<ApiResponse<any>> {
    return this.get('/gamification/badges');
  }

  async getLeaderboard(limit: number = 10): Promise<ApiResponse<any>> {
    return this.get(`/gamification/leaderboard?limit=${limit}`);
  }

  async getActivityFeed(limit: number = 20): Promise<ApiResponse<any>> {
    return this.get(`/gamification/activity-feed?limit=${limit}`);
  }

  async getDashboardSummary(): Promise<ApiResponse<any>> {
    return this.get('/gamification/dashboard');
  }

  async getGamificationLevels(): Promise<ApiResponse<any>> {
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
    return this.get('/profile');
  }

  async updateProfile(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.put('/profile', data);
  }

  async uploadProfilePhoto(file: File): Promise<ApiResponse<{ url: string }>> {
    return this.uploadFile('/profile/photo', file);
  }

  // Gamification methods
  async getGamificationProgress(): Promise<ApiResponse<GamificationProgress>> {
    return this.get('/gamification/progress');
  }

  async getBadges(): Promise<ApiResponse<Badge[]>> {
    return this.get('/gamification/badges');
  }

  async getLeaderboard(): Promise<ApiResponse<LeaderboardEntry[]>> {
    return this.get('/gamification/leaderboard');
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

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  points: number;
  level: number;
  rank: number;
  avatar_url?: string;
}

export default new ApiService();