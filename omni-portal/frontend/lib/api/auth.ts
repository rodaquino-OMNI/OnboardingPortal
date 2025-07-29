import axios from 'axios';
import type { LoginData, RegisterData, ForgotPasswordData, ResetPasswordData } from '@/lib/schemas/auth';
import type { AuthResponse, AuthUser } from '@/types/auth';

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

// Add CSRF token to requests - tokens now handled via httpOnly cookies
api.interceptors.request.use((config) => {
  // Add XSRF token for Sanctum stateful requests
  const xsrfToken = getCookie('XSRF-TOKEN');
  if (xsrfToken) {
    // Use X-CSRF-TOKEN header for Laravel CSRF protection
    config.headers['X-CSRF-TOKEN'] = xsrfToken;
  }
  
  return config;
});

// Helper function to get cookie value
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift() || null;
    // Decode the cookie value as Laravel encodes it
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}

// Handle token refresh on 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear any client-side state and redirect to login
      // Tokens are now httpOnly cookies managed by the server
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// AuthResponse and AuthUser types are now imported from @/types/auth

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export const authApi = {
  getSocialRedirect: async (provider: 'google' | 'facebook' | 'instagram'): Promise<{ url: string }> => {
    const response = await api.get<{ url: string }>(`/auth/${provider}/redirect`);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    // Get CSRF cookie first for stateful authentication
    await axios.get(`${BASE_URL}/sanctum/csrf-cookie`, { withCredentials: true });
    
    // Use JSON with proper CSRF handling for SPA stateful authentication
    // Tokens are now managed as httpOnly cookies for enhanced security
    const response = await api.post<{
      success: boolean;
      user: {
        id: string;
        name: string;
        email: string;
        cpf: string;
        gamification_progress?: {
          points: number;
          level: number;
        };
        lgpd_consent?: boolean;
        lgpd_consent_at?: string;
        last_login_at?: string;
      };
      registration_step?: string;
    }>('/auth/login', {
      email: data.login, // Send login (CPF or email) in the email field
      password: data.password,
    });
    
    // Check if registration is incomplete
    if (response.data.registration_step && response.data.registration_step !== 'completed') {
      throw new Error(`Registration incomplete. Please complete step: ${response.data.registration_step}`);
    }
    
    // Return the response in the expected format (no token exposure)
    return {
      token: 'secured-httponly-cookie', // Placeholder - actual token is in httpOnly cookie
      user: {
        id: response.data.user.id,
        fullName: response.data.user.name,
        email: response.data.user.email,
        cpf: response.data.user.cpf,
        points: response.data.user.gamification_progress?.points || 0,
        level: response.data.user.gamification_progress?.level || 1,
        lgpd_consent: response.data.user.lgpd_consent || false,
        lgpd_consent_at: response.data.user.lgpd_consent_at || undefined,
        last_login_at: response.data.user.last_login_at || undefined,
      }
    };
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    // Step 1: Create user with basic info
    const step1Response = await api.post<{
      token: string;
      user_id: string;
      registration_step: string;
    }>('/register/step1', {
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
    // No need to clear localStorage as tokens are now httpOnly cookies
  },

  getProfile: async (): Promise<AuthResponse['user']> => {
    const response = await api.get<{ user: AuthResponse['user'] }>('/auth/user');
    return response.data.user;
  },
};

export default api;