import axios from 'axios';
import type { LoginData, RegisterData, ForgotPasswordData, ResetPasswordData } from '@/lib/schemas/auth';
import type { AuthResponse, AuthUser } from '@/types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const BASE_URL = API_BASE_URL.replace('/api', '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
  timeout: 15000, // 15 second timeout
});

// Add CSRF token to requests - tokens now handled via httpOnly cookies
api.interceptors.request.use((config) => {
  // Add XSRF token for Sanctum stateful requests
  const xsrfToken = getCookie('XSRF-TOKEN');
  if (xsrfToken) {
    // Use X-CSRF-TOKEN header for Laravel CSRF protection
    config.headers['X-CSRF-TOKEN'] = xsrfToken;
  }
  
  // Add AbortSignal support if provided
  if (config.signal) {
    // Axios will handle the AbortSignal automatically
  }
  
  return config;
});

// Helper function to get cookie value (SSR-safe)
function getCookie(name: string): string | null {
  // SSR guard: Return null if document is not available
  if (typeof document === 'undefined') {
    return null;
  }
  
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift() || null;
      // Decode the cookie value as Laravel encodes it
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
  } catch (error) {
    console.warn(`Error reading cookie ${name}:`, error);
  }
  return null;
}

// Handle token refresh on 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.log('[API INTERCEPTOR] 401 Error:', {
        url: error.config?.url,
        method: error.config?.method
      });
      
      // Don't redirect for public endpoints or gamification endpoints
      const isPublicEndpoint = error.config?.url?.includes('/public/') || 
                               error.config?.url?.includes('/gamification/');
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      
      // Don't redirect immediately - check if user is actually authenticated (SSR-safe)
      let hasAuthCookie = false;
      if (typeof document !== 'undefined') {
        hasAuthCookie = document.cookie.includes('authenticated=true') || 
                       document.cookie.includes('auth_token=');
      }
      
      // Only redirect if:
      // 1. Not a public endpoint
      // 2. Not an auth endpoint
      // 3. User doesn't have auth cookies
      // 4. Not already on login page
      // 5. We're on the client side
      if (!isPublicEndpoint && !isAuthEndpoint && !hasAuthCookie && 
          typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        console.log('[API INTERCEPTOR] Redirecting to login');
        window.location.href = '/login';
      }
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

  login: async (data: LoginData, signal?: AbortSignal): Promise<AuthResponse> => {
    // Get CSRF cookie first for stateful authentication
    await axios.get(`${BASE_URL}/sanctum/csrf-cookie`, { 
      withCredentials: true,
      signal,
      timeout: 5000,
    });
    
    // Check cancellation after CSRF call
    if (signal?.aborted) {
      throw new Error('Login request was cancelled');
    }
    
    // Use JSON with proper CSRF handling for SPA stateful authentication
    // Tokens are now managed as httpOnly cookies for enhanced security
    const response = await api.post<LoginResponse>('/auth/login', {
      email: data.login, // Send login (CPF or email) in the email field
      password: data.password,
    }, {
      signal,
      timeout: 10000,
    });
    
    // Check cancellation after login call
    if (signal?.aborted) {
      throw new Error('Login request was cancelled');
    }
    
    // Check if registration is incomplete
    if (response.data.registration_step && response.data.registration_step !== 'completed') {
      throw new Error(`Registration incomplete. Please complete step: ${response.data.registration_step}`);
    }
    
    // Return the response in the expected format (with token if provided)
    return {
      token: response.data.token || 'secured-httponly-cookie', // Use actual token if provided
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
    // Get CSRF cookie first
    await axios.get(`${BASE_URL}/sanctum/csrf-cookie`, { withCredentials: true });
    
    // Step 1: Create user with basic info
    const step1Response = await api.post<{
      token: string;
      user_id: string;
      registration_step: string;
      message: string;
    }>('/register/step1', {
      name: data.fullName,
      cpf: data.cpf.replace(/[.-]/g, ''), // Remove CPF formatting
      email: data.email,
      birth_date: data.birthDate,
      phone: data.phone.replace(/[()\s-]/g, ''), // Remove phone formatting
      lgpd_consent: true,
    });
    
    const userId = step1Response.data.user_id;
    const token = step1Response.data.token;
    
    // Step 2: Add address info
    await api.post('/register/step2', {
      user_id: userId,
      street: data.address.street,
      number: data.address.number,
      complement: data.address.complement || '',
      neighborhood: data.address.neighborhood,
      city: data.address.city,
      state: data.address.state,
      cep: data.address.zipCode.replace(/-/g, ''), // Remove CEP formatting
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    
    // Step 3: Set password and complete registration
    const step3Response = await api.post<{
      message: string;
      user: LoginResponse['user'];
    }>('/register/step3', {
      user_id: userId,
      password: data.password,
      password_confirmation: data.confirmPassword,
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    
    // Return the response in the expected format
    return {
      token: 'secured-httponly-cookie', // Token is now in httpOnly cookie
      user: {
        id: step3Response.data.user.id,
        fullName: step3Response.data.user.name,
        email: step3Response.data.user.email,
        cpf: step3Response.data.user.cpf,
        points: step3Response.data.user.gamification_progress?.points || 0,
        level: step3Response.data.user.gamification_progress?.level || 1,
        lgpd_consent: step3Response.data.user.lgpd_consent || false,
        lgpd_consent_at: step3Response.data.user.lgpd_consent_at || undefined,
        last_login_at: step3Response.data.user.last_login_at || undefined,
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
    try {
      const response = await api.get<{ user: AuthResponse['user'] }>('/auth/user');
      return response.data.user;
    } catch (error: any) {
      // If unauthenticated, throw error to be handled by checkAuth
      if (error.response?.status === 401 || error.response?.data?.message === 'Unauthenticated.') {
        throw new Error('Unauthenticated');
      }
      throw error;
    }
  },
};

export default api;