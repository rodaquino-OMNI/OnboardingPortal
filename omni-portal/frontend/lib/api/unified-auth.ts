import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
  timeout: 15000,
});

// Helper function to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift() || null;
    // Decode the cookie value as Laravel encodes it
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}

// Add request interceptor for CSRF protection
api.interceptors.request.use(async (config) => {
  // Skip CSRF cookie fetch for certain endpoints to avoid loops
  const skipCSRF = config.url?.includes('/sanctum/csrf-cookie') || 
                   config.url?.includes('/health') ||
                   config._skipCSRF;
  
  if (!skipCSRF) {
    // Check if CSRF token already exists before making request
    const existingToken = getCookie('XSRF-TOKEN');
    
    if (!existingToken) {
      // Only fetch CSRF cookie if we don't have one
      try {
        await axios.get(`${API_BASE_URL.replace('/api', '')}/sanctum/csrf-cookie`, {
          withCredentials: true,
          timeout: 5000,
          _skipCSRF: true // Prevent nested CSRF requests
        });
      } catch (error) {
        console.warn('Failed to get CSRF cookie:', error);
        // Don't fail the request if CSRF fetch fails
      }
    }
  }
  
  // Add XSRF token for Sanctum stateful requests
  const xsrfToken = getCookie('XSRF-TOKEN');
  if (xsrfToken) {
    // Use X-XSRF-TOKEN header for Laravel Sanctum
    config.headers['X-XSRF-TOKEN'] = xsrfToken;
  }
  
  // Add AbortSignal support if provided
  if (config.signal) {
    // Axios will handle the AbortSignal automatically
  }
  
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle CSRF token mismatch (419)
    if (error.response?.status === 419 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Refetch CSRF token and retry
      await axios.get(`${API_BASE_URL.replace('/api', '')}/sanctum/csrf-cookie`, {
        withCredentials: true,
      });
      
      // Retry the original request
      return api(originalRequest);
    }
    
    // Handle authentication errors (401)
    if (error.response?.status === 401) {
      // Clear any client-side state - tokens are httpOnly cookies managed by server
      if (typeof window !== 'undefined') {
        // Clear any non-httpOnly auth cookies
        document.cookie = 'authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        document.cookie = 'onboarding_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        
        // Redirect to login
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export interface UnifiedRegistrationStep1 {
  name: string;
  email: string;
  cpf: string;
}

export interface UnifiedRegistrationStep2 {
  birth_date: string;
  gender: 'masculine' | 'feminine' | 'non_binary' | 'prefer_not_to_say';
  marital_status: 'single' | 'married' | 'divorced' | 'widowed' | 'separated' | 'common_law';
  phone: string;
  department: string;
  job_title: string;
  employee_id: string;
  start_date: string;
  preferred_language?: 'pt-BR' | 'en' | 'es';
  // Optional address fields
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
}

export interface UnifiedRegistrationStep3 {
  password: string;
  password_confirmation: string;
  security_question: string;
  security_answer: string;
  two_factor_enabled: boolean;
}

export interface RegistrationResponse {
  message: string;
  user_id?: string;
  registration_step?: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    cpf: string;
    gamification_progress?: {
      points: number;
      level: number;
    };
  };
}

export const unifiedAuthApi = {
  /**
   * Step 1: Personal information and LGPD consent
   */
  registerStep1: async (data: UnifiedRegistrationStep1): Promise<RegistrationResponse> => {
    const response = await api.post<RegistrationResponse>('/register/step1', {
      name: data.name,
      email: data.email,
      cpf: data.cpf.replace(/\D/g, ''), // Remove formatting
    });
    
    return response.data;
  },

  /**
   * Step 2: Contact, work, and profile information
   */
  registerStep2: async (
    data: UnifiedRegistrationStep2,
    token: string
  ): Promise<RegistrationResponse> => {
    const response = await api.post<RegistrationResponse>(
      '/register/step2',
      {
        // Required fields matching backend validation
        birth_date: data.birth_date,
        gender: data.gender,
        marital_status: data.marital_status,
        phone: data.phone.replace(/\D/g, ''), // Remove formatting
        department: data.department,
        job_title: data.job_title,
        employee_id: data.employee_id,
        start_date: data.start_date,
        preferred_language: data.preferred_language || 'pt-BR',
        
        // Optional address fields
        ...(data.address && { address: data.address }),
        ...(data.number && { number: data.number }),
        ...(data.complement && { complement: data.complement }),
        ...(data.neighborhood && { neighborhood: data.neighborhood }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state.toUpperCase() }),
        ...(data.zip_code && { zip_code: data.zip_code.replace(/\D/g, '') }),
        
        // Emergency contact
        ...(data.emergency_contact_name && { emergency_contact_name: data.emergency_contact_name }),
        ...(data.emergency_contact_phone && { 
          emergency_contact_phone: data.emergency_contact_phone.replace(/\D/g, '') 
        }),
        ...(data.emergency_contact_relationship && { 
          emergency_contact_relationship: data.emergency_contact_relationship 
        }),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    return response.data;
  },

  /**
   * Step 3: Security setup and account completion
   */
  registerStep3: async (
    data: UnifiedRegistrationStep3,
    token: string
  ): Promise<RegistrationResponse> => {
    const response = await api.post<RegistrationResponse>(
      '/register/step3',
      {
        password: data.password,
        password_confirmation: data.password_confirmation,
        security_question: data.security_question,
        security_answer: data.security_answer,
        two_factor_enabled: data.two_factor_enabled,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    return response.data;
  },

  /**
   * Get registration progress
   */
  getRegistrationProgress: async (token: string): Promise<{
    current_step: string;
    steps: Record<string, { completed: boolean; title: string }>;
    completed: boolean;
  }> => {
    const response = await api.get('/register/progress', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    return response.data;
  },

  /**
   * Validate profile completion
   */
  validateProfileCompletion: async (token: string): Promise<{
    is_complete: boolean;
    missing_fields: string[];
    completion_percentage: number;
    profile_quality_score: number;
  }> => {
    const response = await api.post('/register/validate-profile', {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    return response.data;
  },

  /**
   * Cancel incomplete registration
   */
  cancelRegistration: async (token: string): Promise<{ message: string }> => {
    const response = await api.delete('/register/cancel', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    return response.data;
  },

  /**
   * Login with unified response format
   */
  login: async (data: { login: string; password: string }): Promise<{
    message: string;
    user: {
      id: string;
      name: string;
      email: string;
      cpf: string;
      points: number;
      level: number;
      lgpd_consent: boolean;
      lgpd_consent_at?: string;
      last_login_at?: string;
    };
    token?: string;
    token_type?: string;
  }> => {
    const response = await api.post('/auth/login', {
      email: data.login, // Backend expects 'email' field for both email and CPF
      password: data.password,
    });
    
    // Transform response to match frontend expectations
    const result = response.data;
    return {
      message: result.message || 'Login successful',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        cpf: result.user.cpf,
        points: result.user.gamification_progress?.points || 0,
        level: result.user.gamification_progress?.level || 1,
        lgpd_consent: result.user.lgpd_consent || false,
        lgpd_consent_at: result.user.lgpd_consent_at,
        last_login_at: result.user.last_login_at,
      },
      token: result.token,
      token_type: result.token_type || 'Bearer',
    };
  },

  /**
   * Logout
   */
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    // Clear client-accessible cookies - httpOnly cookies are cleared by server
    if (typeof document !== 'undefined') {
      document.cookie = 'authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
      document.cookie = 'onboarding_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    }
  },

  /**
   * Get authenticated user profile
   */
  getProfile: async (): Promise<{
    id: string;
    name: string;
    email: string;
    cpf: string;
    points: number;
    level: number;
    lgpd_consent: boolean;
    lgpd_consent_at?: string;
    last_login_at?: string;
  }> => {
    const response = await api.get('/auth/user');
    const user = response.data.user;
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      points: user.gamification_progress?.points || 0,
      level: user.gamification_progress?.level || 1,
      lgpd_consent: user.lgpd_consent || false,
      lgpd_consent_at: user.lgpd_consent_at,
      last_login_at: user.last_login_at,
    };
  },
};

export default unifiedAuthApi;