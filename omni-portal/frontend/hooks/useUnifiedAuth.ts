'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api/auth';
import type { LoginResponse } from '@/types/auth';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';
import type { AppError } from '@/types';
import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { authTokenManager } from '@/lib/auth-token-fix';
import { logger } from '@/lib/logger';

interface AuthResult {
  success: boolean;
  error?: string;
  requires_2fa?: boolean;
  session_token?: string;
}

interface UnifiedAuthState {
  user: LoginResponse['user'] | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginData) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  socialLogin: (provider: 'google' | 'facebook' | 'instagram') => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  cancelAllRequests: () => void;
}

/**
 * Unified Authentication Store
 * Single source of truth for all authentication needs
 * Consolidates all previous fragmented implementations
 */
export const useUnifiedAuthStore = create<UnifiedAuthState>()(
  persist(
    (set, get) => {
      // Request manager for cancellation
      let activeRequests = new Set<AbortController>();
      
      const makeRequest = (asyncFn: (signal: AbortSignal) => Promise<any>, options?: { timeout?: number }) => {
        const controller = new AbortController();
        activeRequests.add(controller);
        
        const promise = Promise.race([
          asyncFn(controller.signal),
          ...(options?.timeout ? [
            new Promise((_, reject) => {
              setTimeout(() => {
                controller.abort();
                reject(new Error('Request timeout'));
              }, options.timeout);
            })
          ] : [])
        ]).finally(() => {
          activeRequests.delete(controller);
        });
        
        return {
          promise,
          isCancelled: () => controller.signal.aborted,
          cancel: () => controller.abort()
        };
      };
      
      const cancelAll = () => {
        activeRequests.forEach(controller => controller.abort());
        activeRequests.clear();
      };

      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        login: async (data: LoginData): Promise<AuthResult> => {
          console.log('%c[UnifiedAuth] Login started', 'color: blue; font-weight: bold');
          set({ isLoading: true, error: null });
          
          const request = makeRequest(
            async (signal: AbortSignal) => {
              const response = await authApi.login(data, signal);
              if (signal.aborted) throw new Error('Login cancelled');
              return response;
            },
            { timeout: 15000 }
          );
          
          try {
            const response = await request.promise;
            
            if (!request.isCancelled()) {
              console.log('%c[UnifiedAuth] Login successful', 'color: green; font-weight: bold');
              
              set({
                user: response.user,
                token: response.token,
                isAuthenticated: true,
                isLoading: false,
              });
              
              // Emit event for gamification integration
              eventBus.emit(EventTypes.AUTH_LOGIN, {
                user: response.user,
                token: response.token,
                timestamp: Date.now()
              }, {
                priority: 'high',
                source: 'useUnifiedAuth.login'
              });
              
              // Use centralized token manager
              if (typeof window !== 'undefined') {
                authTokenManager.setToken(response.token, response.user);
                
                // Set onboarding session for route access
                if (typeof document !== 'undefined') {
                  document.cookie = `onboarding_session=authenticated; path=/; max-age=7200; SameSite=Lax`;
                }
              }
              
              return { success: true };
            }
            
            return { success: false, error: 'Request was cancelled' };
          } catch (error) {
            console.error('%c[UnifiedAuth] Login failed:', 'color: red; font-weight: bold', error);
            
            if (!request.isCancelled()) {
              const appError = error as AppError;
              const errorMessage = appError.message || 'Erro ao fazer login';
              
              set({
                error: errorMessage,
                isLoading: false,
              });
              
              // Check for specific error types
              if (errorMessage.includes('registration incomplete')) {
                return {
                  success: false,
                  error: errorMessage,
                  requires_2fa: false
                };
              }
              
              return { success: false, error: errorMessage };
            }
            
            return { success: false, error: 'Request was cancelled' };
          }
        },

        register: async (data: RegisterData): Promise<AuthResult> => {
          set({ isLoading: true, error: null });
          
          const request = makeRequest(
            async (signal: AbortSignal) => {
              const response = await authApi.register(data);
              if (signal.aborted) throw new Error('Registration cancelled');
              return response;
            },
            { timeout: 30000 }
          );
          
          try {
            const response = await request.promise;
            
            if (!request.isCancelled()) {
              set({
                user: response.user,
                token: response.token,
                isAuthenticated: true,
                isLoading: false,
              });
              
              // Emit event for gamification integration
              eventBus.emit(EventTypes.AUTH_LOGIN, {
                user: response.user,
                token: response.token,
                timestamp: Date.now(),
                source: 'registration'
              }, {
                priority: 'high',
                source: 'useUnifiedAuth.register'
              });
              
              return { success: true };
            }
            
            return { success: false, error: 'Request was cancelled' };
          } catch (error) {
            if (!request.isCancelled()) {
              const appError = error as AppError;
              const errorMessage = appError.message || 'Erro ao registrar';
              
              set({
                error: errorMessage,
                isLoading: false,
              });
              
              return { success: false, error: errorMessage };
            }
            
            return { success: false, error: 'Request was cancelled' };
          }
        },

        socialLogin: async (provider) => {
          set({ isLoading: true, error: null });
          try {
            const response = await authApi.getSocialRedirect(provider);
            window.location.href = response.url;
          } catch (error) {
            const appError = error as AppError;
            set({
              error: appError.message || 'Erro ao fazer login social',
              isLoading: false,
            });
            throw error;
          }
        },

        logout: async () => {
          set({ isLoading: true });
          try {
            await authApi.logout();
          } catch (error) {
            console.error('Logout error:', error);
          } finally {
            // Emit event before clearing data
            const currentUser = get().user;
            eventBus.emit(EventTypes.AUTH_LOGOUT, {
              user: currentUser,
              timestamp: Date.now()
            }, {
              priority: 'high',
              source: 'useUnifiedAuth.logout'
            });
            
            // Use centralized token manager for cleanup
            if (typeof window !== 'undefined') {
              authTokenManager.clearToken();
            }
            
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
          }
        },

        clearError: () => set({ error: null }),

        checkAuth: async () => {
          const state = get();
          const now = Date.now();
          const lastAuthCheck = (state as any)._lastAuthCheck || 0;
          const AUTH_CHECK_THROTTLE = 500;
          
          // Throttle auth checks
          if (now - lastAuthCheck < AUTH_CHECK_THROTTLE && state.isAuthenticated && state.user && !state.isLoading) {
            return;
          }
          
          console.log('%c[UnifiedAuth] Starting auth check', 'color: blue; font-weight: bold');
          set({ isLoading: true, _lastAuthCheck: now, error: null } as any);
          
          // SSR guard
          if (typeof document === 'undefined') {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }
          
          const cookies = document.cookie;
          console.log('[UnifiedAuth] Current cookies:', cookies);
          const hasAuthCookie = cookies.includes('authenticated=true') || 
                                cookies.includes('auth_token=') ||
                                cookies.includes('austa_health_portal_session=') ||
                                cookies.includes('laravel_session=') ||
                                cookies.includes('XSRF-TOKEN=');
          
          if (!hasAuthCookie) {
            console.log('[UnifiedAuth] No auth cookies found, clearing state');
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          } else {
            console.log('[UnifiedAuth] Auth cookies found, proceeding with profile check');
          }
          
          const request = makeRequest(
            async (signal: AbortSignal) => {
              const response = await authApi.getProfile();
              if (signal.aborted) throw new Error('Auth check cancelled');
              return response;
            },
            { timeout: 8000 }
          );
          
          try {
            const response = await request.promise;
            
            if (!request.isCancelled()) {
              set({
                user: response,
                isAuthenticated: true,
                isLoading: false,
              });
              
              // Emit event for session restore
              eventBus.emit(EventTypes.AUTH_STATE_CHANGED, {
                user: response,
                isAuthenticated: true,
                timestamp: Date.now(),
                source: 'session_restore'
              }, {
                priority: 'normal',
                source: 'useUnifiedAuth.checkAuth'
              });
            }
          } catch (error) {
            console.log('%c[UnifiedAuth] checkAuth failed:', 'color: red; font-weight: bold', error);
            
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Authentication check failed'
            });
            
            // Clear cookies on client
            if (typeof document !== 'undefined') {
              const cookiesToClear = [
                'authenticated', 'auth_token', 'onboarding_session', 'basic_auth',
                'XSRF-TOKEN', 'austa_health_portal_session', 'omni_onboarding_portal_session'
              ];
              
              cookiesToClear.forEach(name => {
                document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; domain=localhost`;
                document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
              });
            }
          }
        },

        cancelAllRequests: cancelAll,
      };
    },
    {
      name: 'unified-auth-storage',
      partialize: (state) => ({}), // Don't persist anything for security
    }
  )
);

/**
 * Unified Authentication Hook
 * Single entry point for all authentication needs
 * Replaces all previous fragmented hooks
 */
export function useUnifiedAuth() {
  const authStore = useUnifiedAuthStore();
  
  logger.info('Using unified authentication implementation', {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  }, 'UnifiedAuth');
  
  // Store implementation info for debugging
  if (typeof window !== 'undefined') {
    (window as any).__AUTH_VERSION__ = 'unified';
    (window as any).__AUTH_IMPLEMENTATION__ = {
      version: 'unified',
      timestamp: Date.now(),
      consolidated: true
    };
  }
  
  return authStore;
}

/**
 * Main export - use this everywhere
 */
export const useAuth = useUnifiedAuth;

/**
 * Legacy compatibility exports - will be removed after migration
 * @deprecated Use useAuth() instead
 */
export const useAuthLegacy = useUnifiedAuth;
export const useAuthStore = useUnifiedAuthStore;