import axios from 'axios';
import type { LoginData, RegisterData, ForgotPasswordData, ResetPasswordData } from '@/lib/schemas/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const BASE_URL = API_BASE_URL.replace('/api', '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
    points: number;
    level: number;
    lgpd_consent?: boolean;
    lgpd_consent_at?: string;
    last_login_at?: string;
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]> | undefined;
}

export const authApi = {
  getSocialRedirect: async (provider: 'google' | 'facebook' | 'instagram'): Promise<{ url: string }> => {
    const response = await api.get<{ url: string }>(`/auth/${provider}/redirect`);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    // Get CSRF cookie first
    await axios.get(`${BASE_URL}/sanctum/csrf-cookie`, { withCredentials: true });
    
    // The backend expects 'email' field even when using CPF or email
    const response = await api.post<any>('/auth/login', {
      email: data.login, // Send login (CPF or email) in the email field
      password: data.password,
    });
    
    // Check if registration is incomplete
    if (response.data.registration_step && response.data.registration_step !== 'completed') {
      throw new Error(`Registration incomplete. Please complete step: ${response.data.registration_step}`);
    }
    
    // Return the response in the expected format
    return {
      token: response.data.token,
      user: {
        id: response.data.user.id,
        fullName: response.data.user.name,
        email: response.data.user.email,
        cpf: response.data.user.cpf,
        points: response.data.user.gamification_progress?.points || 0,
        level: response.data.user.gamification_progress?.level || 1,
        lgpd_consent: response.data.user.lgpd_consent,
        lgpd_consent_at: response.data.user.lgpd_consent_at,
        last_login_at: response.data.user.last_login_at,
      }
    };
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    // Step 1: Create user with basic info
    const step1Response = await api.post<any>('/register/step1', {
      name: data.fullName,
      email: data.email,
      cpf: data.cpf,
      lgpd_consent: true,
    });
    
    // Return the response in the expected format
    return {
      token: step1Response.data.token,
      user: {
        id: step1Response.data.user_id,
        fullName: data.fullName,
        email: data.email,
        cpf: data.cpf,
        points: 0,
        level: 1,
      }
    };
  },

  forgotPassword: async (data: ForgotPasswordData): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/forgot-password', data);
    return response.data;
  },

  resetPassword: async (data: ResetPasswordData): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/reset-password', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    localStorage.removeItem('authToken');
  },

  getProfile: async (): Promise<AuthResponse['user']> => {
    const response = await api.get<{ user: AuthResponse['user'] }>('/auth/profile');
    return response.data.user;
  },
};

export default api;