import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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
    await axios.get(`${API_BASE_URL}/sanctum/csrf-cookie`, {
      withCredentials: true,
    });
    
    // Extract XSRF token from cookies
    const cookies = document.cookie.split(';');
    const xsrfCookie = cookies.find(c => c.trim().startsWith('XSRF-TOKEN='));
    
    if (xsrfCookie) {
      csrfToken = decodeURIComponent(xsrfCookie.split('=')[1]);
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
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

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request timestamp for performance monitoring
    config.metadata = { startTime: Date.now() };

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
    const config: any = response.config;
    if (config.metadata) {
      const duration = Date.now() - config.metadata.startTime;
      if (duration > 1000) {
        console.warn(`Slow API call to ${config.url}: ${duration}ms`);
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

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
      console.error('Network error:', error.message);
      throw new Error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

// Performance optimization: Request deduplication
const pendingRequests = new Map<string, Promise<AxiosResponse>>();

/**
 * Make deduplicated GET request
 */
export async function getCached(url: string, config?: any): Promise<AxiosResponse> {
  const key = `${url}-${JSON.stringify(config?.params || {})}`;
  
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

// Initialize CSRF token on module load
if (typeof window !== 'undefined') {
  fetchCsrfToken();
}

// Export configured client and utilities
export default apiClient;

export const api = {
  get: (url: string, config?: any) => apiClient.get(url, config),
  post: (url: string, data?: any, config?: any) => apiClient.post(url, data, config),
  put: (url: string, data?: any, config?: any) => apiClient.put(url, data, config),
  patch: (url: string, data?: any, config?: any) => apiClient.patch(url, data, config),
  delete: (url: string, config?: any) => apiClient.delete(url, config),
  getCached,
};

// Performance monitoring utilities
export const performanceMonitor = {
  startTimer: () => Date.now(),
  
  endTimer: (startTime: number, operation: string) => {
    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.warn(`Slow operation "${operation}": ${duration}ms`);
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
      console.error(`API call "${operation}" failed after ${duration}ms:`, error);
      throw error;
    }
  },
};