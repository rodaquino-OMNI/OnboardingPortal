import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Extend Axios config types for our metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: number;
      [key: string]: unknown;
    };
  }
}
import { logger } from '@/lib/logger';
import { authTokenManager } from '@/lib/auth-token-fix';

// API configuration
// Use relative URLs to work with Next.js rewrites/proxy
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance with optimized configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  withCredentials: true, // Enable cookie-based authentication
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// CSRF token management
let csrfToken: string | null = null;

/**
 * Fetch CSRF token from Laravel Sanctum
 */
async function fetchCsrfToken(): Promise<void> {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
    await axios.get(`${baseURL}/sanctum/csrf-cookie`, {
      withCredentials: true,
    });
    
    // Extract XSRF token from cookies
    const cookies = document.cookie.split(';');
    const xsrfCookie = cookies.find(c => c.trim().startsWith('XSRF-TOKEN='));
    
    if (xsrfCookie) {
      const tokenValue = xsrfCookie.split('=')[1];
      if (tokenValue) {
        csrfToken = decodeURIComponent(tokenValue);
      }
    }
  } catch (error) {
    logger.error('Failed to fetch CSRF token', error, null, 'CsrfManager');
  }
}

// Request interceptor for authentication and CSRF
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Ensure CSRF token for state-changing requests
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      if (!csrfToken) {
        await fetchCsrfToken();
      }
      
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken;
      }
    }

    // Use centralized token manager for consistent auth handling
    const authHeader = authTokenManager.getAuthHeader();
    if (authHeader) {
      config.headers.Authorization = authHeader;
      console.debug('[API Client] Auth token attached');
    } else {
      console.warn('[API Client] No valid auth token found');
      // Debug token status in development
      if (process.env.NODE_ENV === 'development') {
        authTokenManager.debugTokenStatus();
      }
    }

    // Add request timestamp for performance monitoring
    if (config.metadata === undefined) {
      config.metadata = {};
    }
    config.metadata.startTime = Date.now();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and performance monitoring
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response time for performance monitoring
    const config = response.config as InternalAxiosRequestConfig & { metadata?: { startTime: number } };
    if (config.metadata?.startTime) {
      const duration = Date.now() - config.metadata.startTime;
      if (duration > 1000) {
        logger.warn(`Slow API call detected`, { url: config.url, duration }, 'PerformanceMonitor');
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle CSRF token mismatch
    if (error.response?.status === 419) {
      csrfToken = null;
      await fetchCsrfToken();
      
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        return apiClient(originalRequest);
      }
    }

    // Handle authentication errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Try to refresh token
      try {
        const refreshResponse = await apiClient.post('/api/auth/refresh');
        const { token } = refreshResponse.data;
        
        if (token) {
          localStorage.setItem('auth_token', token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Redirect to login if refresh fails
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }

    // Handle network errors
    if (!error.response) {
      logger.error('Network error detected', error, { message: error.message }, 'ApiClient');
      throw new Error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

// MEMORY LEAK FIX: Request deduplication with cache limits
const MAX_PENDING_REQUESTS = 50;
const pendingRequests = new Map<string, Promise<AxiosResponse>>();

// Cleanup old pending requests to prevent memory leaks
const cleanupPendingRequests = () => {
  if (pendingRequests.size > MAX_PENDING_REQUESTS) {
    const keysToDelete = Array.from(pendingRequests.keys()).slice(0, pendingRequests.size - MAX_PENDING_REQUESTS);
    keysToDelete.forEach(key => pendingRequests.delete(key));
  }
};

/**
 * Make deduplicated GET request
 */
export async function getCached(url: string, config?: { params?: Record<string, unknown>; [key: string]: unknown }): Promise<AxiosResponse> {
  const key = `${url}-${JSON.stringify(config?.params || {})}`;
  
  // MEMORY LEAK FIX: Clean up cache periodically
  cleanupPendingRequests();
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  const promise = apiClient.get(url, config);
  pendingRequests.set(key, promise);

  try {
    const response = await promise;
    pendingRequests.delete(key);
    return response;
  } catch (error) {
    pendingRequests.delete(key);
    throw error;
  }
}

// MEMORY LEAK FIX: Cache management utilities
export const cacheManager = {
  clearCache: () => {
    pendingRequests.clear();
  },
  getCacheSize: () => pendingRequests.size,
  getCacheKeys: () => Array.from(pendingRequests.keys())
};

// Initialize CSRF token on module load
if (typeof window !== 'undefined') {
  fetchCsrfToken();
}

// Export configured client and utilities
export default apiClient;

export const api = {
  get: <T = unknown>(url: string, config?: Record<string, unknown>) => apiClient.get<T>(url, config),
  post: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => apiClient.post<T>(url, data, config),
  put: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => apiClient.put<T>(url, data, config),
  patch: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => apiClient.patch<T>(url, data, config),
  delete: <T = unknown>(url: string, config?: Record<string, unknown>) => apiClient.delete<T>(url, config),
  getCached,
};

// Performance monitoring utilities
export const performanceMonitor = {
  startTimer: () => Date.now(),
  
  endTimer: (startTime: number, operation: string) => {
    const duration = Date.now() - startTime;
    if (duration > 500) {
      logger.warn('Slow operation detected', { operation, duration }, 'PerformanceMonitor');
    }
    return duration;
  },
  
  measureApiCall: async <T>(
    operation: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = Date.now();
    try {
      const result = await apiCall();
      const duration = Date.now() - startTime;
      
      if (typeof window !== 'undefined' && window.performance) {
        window.performance.mark(`${operation}-end`);
        window.performance.measure(operation, undefined, `${operation}-end`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('API call failed', error, { operation, duration }, 'PerformanceMonitor');
      throw error;
    }
  },
};