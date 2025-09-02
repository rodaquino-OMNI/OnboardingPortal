'use client';

// DEPRECATED: This file is kept for backward compatibility only
// Use useUnifiedAuth from @/lib/auth/unified-auth instead

import { useUnifiedAuth } from '@/lib/auth/unified-auth';
import type { AuthUser } from '@/types/auth';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';
import { logger } from '@/lib/logger';

// Legacy imports for backward compatibility
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api/auth';
import type { LoginResponse } from '@/types/auth';
import type { AppError } from '@/types';
import { eventBus, EventTypes } from '@/modules/events/EventBus';

// ===== TYPES =====
interface AuthResult {
  success: boolean;
  error?: string;
  requires_2fa?: boolean;
  session_token?: string;
  user?: LoginResponse['user'];
}

interface AuthState {
  user: LoginResponse['user'] | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Core authentication methods
  login: (data: LoginData) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  socialLogin: (provider: 'google' | 'facebook' | 'instagram') => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  
  // Utility methods
  clearError: () => void;
  refreshToken: () => Promise<boolean>;
  cancelAllRequests: () => void;
  
  // Internal state management
  _setLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
  _setUser: (user: LoginResponse['user'] | null) => void;
  _lastAuthCheck: number;
}

// ===== REQUEST MANAGEMENT =====
class RequestManager {
  private activeRequests = new Set<AbortController>();
  
  makeRequest<T>(
    asyncFn: (signal: AbortSignal) => Promise<T>, 
    options?: { timeout?: number }
  ) {
    const controller = new AbortController();
    this.activeRequests.add(controller);
    
    const timeoutPromise = options?.timeout 
      ? new Promise<never>((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timeout after ${options.timeout}ms`));
          }, options.timeout);
        })
      : null;
    
    const promise = Promise.race([
      asyncFn(controller.signal),
      ...(timeoutPromise ? [timeoutPromise] : [])
    ]).finally(() => {
      this.activeRequests.delete(controller);
    });
    
    return {
      promise,
      isCancelled: () => controller.signal.aborted,
      cancel: () => controller.abort()
    };
  }
  
  cancelAll() {
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
  }
  
  get activeCount() {
    return this.activeRequests.size;
  }
}

// ===== COOKIE MANAGER =====
class CookieManager {
  private static COOKIE_NAMES = {
    AUTH_TOKEN: 'auth_token',
    SESSION: 'laravel_session',
    CSRF: 'XSRF-TOKEN',
    AUTHENTICATED: 'authenticated',
    ONBOARDING_SESSION: 'onboarding_session'
  } as const;
  
  static setAuthCookie(token: string, maxAge = 7200) {
    if (typeof document === 'undefined') return;
    
    const cookieOptions = [
      `${this.COOKIE_NAMES.AUTH_TOKEN}=${token}`,
      'path=/',
      `max-age=${maxAge}`,
      'SameSite=Lax',
      'Secure'
    ].join('; ');
    
    document.cookie = cookieOptions;
    document.cookie = `${this.COOKIE_NAMES.AUTHENTICATED}=true; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `${this.COOKIE_NAMES.ONBOARDING_SESSION}=authenticated; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
  
  static clearAuthCookies() {
    if (typeof document === 'undefined') return;
    
    const cookiesToClear = Object.values(this.COOKIE_NAMES);
    const expireOptions = 'path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    
    cookiesToClear.forEach(name => {
      document.cookie = `${name}=; ${expireOptions}`;
      document.cookie = `${name}=; ${expireOptions}; domain=localhost`;
    });
  }
  
  static hasAuthCookie(): boolean {
    if (typeof document === 'undefined') return false;
    
    const cookies = document.cookie;
    return Object.values(this.COOKIE_NAMES).some(name => 
      cookies.includes(`${name}=`)
    );
  }
}

// ===== MAIN STORE =====
const requestManager = new RequestManager();

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _lastAuthCheck: 0,

      // ===== LOGIN =====
      login: async (data: LoginData): Promise<AuthResult> => {
        logger.info('Login attempt started', { email: data.email });
        set({ isLoading: true, error: null });
        
        const request = requestManager.makeRequest(
          async (signal) => {
            const response = await authApi.login(data, signal);
            if (signal.aborted) throw new Error('Login cancelled');
            return response;
          },
          { timeout: 15000 }
        );
        
        try {
          const response = await request.promise;
          
          if (!request.isCancelled()) {
            logger.info('Login successful', { userId: response.user.id });
            
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            // Set httpOnly cookies
            CookieManager.setAuthCookie(response.token);
            
            // Emit event for other systems
            eventBus.emit(EventTypes.AUTH_LOGIN, {
              user: response.user,
              token: response.token,
              timestamp: Date.now()
            }, {
              priority: 'high',
              source: 'useAuth.login'
            });
            
            return { success: true, user: response.user };
          }
          
          return { success: false, error: 'Request was cancelled' };
        } catch (error) {
          logger.error('Login failed', error);
          
          if (!request.isCancelled()) {
            const appError = error as AppError;
            const errorMessage = appError.message || 'Login failed';
            
            set({ error: errorMessage, isLoading: false });
            return { success: false, error: errorMessage };
          }
          
          return { success: false, error: 'Request was cancelled' };
        }
      },

      // ===== REGISTER =====
      register: async (data: RegisterData): Promise<AuthResult> => {
        logger.info('Registration attempt started', { email: data.email });
        set({ isLoading: true, error: null });
        
        const request = requestManager.makeRequest(
          async (signal) => {
            const response = await authApi.register(data);
            if (signal.aborted) throw new Error('Registration cancelled');
            return response;
          },
          { timeout: 30000 }
        );
        
        try {
          const response = await request.promise;
          
          if (!request.isCancelled()) {
            logger.info('Registration successful', { userId: response.user.id });
            
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            CookieManager.setAuthCookie(response.token);
            
            eventBus.emit(EventTypes.AUTH_LOGIN, {
              user: response.user,
              token: response.token,
              timestamp: Date.now(),
              source: 'registration'
            }, {
              priority: 'high',
              source: 'useAuth.register'
            });
            
            return { success: true, user: response.user };
          }
          
          return { success: false, error: 'Request was cancelled' };
        } catch (error) {
          logger.error('Registration failed', error);
          
          if (!request.isCancelled()) {
            const appError = error as AppError;
            const errorMessage = appError.message || 'Registration failed';
            
            set({ error: errorMessage, isLoading: false });
            return { success: false, error: errorMessage };
          }
          
          return { success: false, error: 'Request was cancelled' };
        }
      },

      // ===== SOCIAL LOGIN =====
      socialLogin: async (provider) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.getSocialRedirect(provider);
          if (typeof window !== 'undefined') {
            window.location.href = response.url;
          }
        } catch (error) {
          const appError = error as AppError;
          const errorMessage = appError.message || 'Social login failed';
          
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      // ===== LOGOUT =====
      logout: async () => {
        logger.info('Logout started');
        set({ isLoading: true });
        
        try {
          await authApi.logout();
        } catch (error) {
          logger.warn('Logout API call failed', error);
        } finally {
          const currentUser = get().user;
          
          // Emit logout event before clearing state
          eventBus.emit(EventTypes.AUTH_LOGOUT, {
            user: currentUser,
            timestamp: Date.now()
          }, {
            priority: 'high',
            source: 'useAuth.logout'
          });
          
          // Clear cookies
          CookieManager.clearAuthCookies();
          
          // Cancel all pending requests
          requestManager.cancelAll();
          
          // Clear state
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            _lastAuthCheck: 0
          });
          
          logger.info('Logout completed');
        }
      },

      // ===== CHECK AUTH =====
      checkAuth: async () => {
        const state = get();
        const now = Date.now();
        const AUTH_CHECK_THROTTLE = 1000; // 1 second throttle
        
        // Circuit breaker: prevent infinite auth check loops
        const recursionKey = '_authCheckRecursionCount';
        const maxRecursion = 3;
        if (typeof window !== 'undefined') {
          const recursionCount = (window as any)[recursionKey] || 0;
          if (recursionCount > maxRecursion) {
            console.warn('Auth check recursion limit reached, breaking loop');
            return;
          }
          (window as any)[recursionKey] = recursionCount + 1;
          setTimeout(() => {
            (window as any)[recursionKey] = 0;
          }, 5000); // Reset after 5 seconds
        }
        
        // Throttle auth checks to prevent excessive calls
        if (
          now - state._lastAuthCheck < AUTH_CHECK_THROTTLE && 
          state.isAuthenticated && 
          state.user && 
          !state.isLoading
        ) {
          return;
        }
        
        // logger.debug('Auth check started'); // Commented to reduce console spam
        set({ isLoading: true, _lastAuthCheck: now });
        
        // SSR guard
        if (typeof document === 'undefined') {
          set({ 
            user: null, 
            token: null, 
            isAuthenticated: false, 
            isLoading: false 
          });
          return;
        }
        
        // Check for auth cookies first
        if (!CookieManager.hasAuthCookie()) {
          // logger.debug('No auth cookies found, clearing state'); // Commented to reduce console spam
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
          return;
        }
        
        const request = requestManager.makeRequest(
          async (signal) => {
            const response = await authApi.getProfile();
            if (signal.aborted) throw new Error('Auth check cancelled');
            return response;
          },
          { timeout: 8000 }
        );
        
        try {
          const response = await request.promise;
          
          if (!request.isCancelled()) {
            // logger.debug('Auth check successful'); // Commented to reduce console spam
            
            set({
              user: response,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            eventBus.emit(EventTypes.AUTH_STATE_CHANGED, {
              user: response,
              isAuthenticated: true,
              timestamp: Date.now(),
              source: 'auth_check'
            }, {
              priority: 'normal',
              source: 'useAuth.checkAuth'
            });
          }
        } catch (error) {
          logger.warn('Auth check failed', error);
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Authentication expired'
          });
          
          CookieManager.clearAuthCookies();
        }
      },

      // ===== TOKEN REFRESH =====
      refreshToken: async (): Promise<boolean> => {
        logger.debug('Token refresh started');
        
        const request = requestManager.makeRequest(
          async (signal) => {
            // Assuming we have a refresh token endpoint
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'include',
              signal
            });
            
            if (!response.ok) throw new Error('Token refresh failed');
            return response.json();
          },
          { timeout: 5000 }
        );
        
        try {
          const response = await request.promise;
          
          if (!request.isCancelled() && response.token) {
            CookieManager.setAuthCookie(response.token);
            
            set({
              token: response.token,
              isAuthenticated: true,
              error: null
            });
            
            logger.debug('Token refresh successful');
            return true;
          }
        } catch (error) {
          logger.warn('Token refresh failed', error);
        }
        
        return false;
      },

      // ===== UTILITY METHODS =====
      clearError: () => set({ error: null }),
      
      cancelAllRequests: () => {
        requestManager.cancelAll();
      },
      
      _setLoading: (loading: boolean) => set({ isLoading: loading }),
      _setError: (error: string | null) => set({ error }),
      _setUser: (user: LoginResponse['user'] | null) => set({ user })
    }),
    {
      name: 'auth-storage',
      partialize: () => ({}), // Don't persist anything for security
    }
  )
);

// ===== MAIN HOOK (UNIFIED IMPLEMENTATION) =====
export function useAuth() {
  logger.warn('useAuth is deprecated, use useUnifiedAuth instead');
  
  const unifiedStore = useUnifiedAuth();
  
  // Transform unified auth user to legacy format for compatibility
  const legacyUser = unifiedStore.user ? {
    id: unifiedStore.user.id,
    name: unifiedStore.user.fullName,
    email: unifiedStore.user.email,
    cpf: unifiedStore.user.cpf,
    gamification_progress: {
      points: unifiedStore.user.points,
      level: unifiedStore.user.level
    },
    lgpd_consent: unifiedStore.user.lgpd_consent,
    lgpd_consent_at: unifiedStore.user.lgpd_consent_at,
    last_login_at: unifiedStore.user.last_login_at
  } : null;
  
  // Return legacy-compatible interface
  return {
    user: legacyUser,
    token: 'managed-by-httponly-cookies', // Legacy compatibility
    isAuthenticated: unifiedStore.isAuthenticated,
    isLoading: unifiedStore.isLoading,
    error: unifiedStore.error,
    
    // Methods
    login: unifiedStore.login,
    register: unifiedStore.register,
    socialLogin: unifiedStore.socialLogin,
    logout: unifiedStore.logout,
    checkAuth: unifiedStore.checkAuth,
    clearError: unifiedStore.clearError,
    refreshToken: unifiedStore.refreshToken,
    cancelAllRequests: unifiedStore.cancelAllRequests,
    
    // Internal methods
    _setLoading: unifiedStore._setLoading,
    _setError: unifiedStore._setError,
    _setUser: (user: LoginResponse['user'] | null) => {
      if (user) {
        const authUser: AuthUser = {
          id: user.id,
          fullName: user.name,
          email: user.email,
          cpf: user.cpf,
          points: user.gamification_progress?.points || 0,
          level: user.gamification_progress?.level || 1,
          lgpd_consent: user.lgpd_consent || false,
          lgpd_consent_at: user.lgpd_consent_at,
          last_login_at: user.last_login_at
        };
        unifiedStore._setUser(authUser);
      } else {
        unifiedStore._setUser(null);
      }
    },
    _lastAuthCheck: unifiedStore.lastAuthCheck
  };
}

// ===== EXPORTS =====
export default useAuth;

// Forward compatibility exports
export { useUnifiedAuth } from '@/lib/auth/unified-auth';
export const useAuthIntegration = useAuth;
export const useAuthWithMigration = useAuth;

// Legacy store (deprecated)
export const useAuthStoreCompat = useAuthStore;