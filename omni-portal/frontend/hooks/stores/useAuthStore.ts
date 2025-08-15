'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api/auth';
import type { LoginResponse } from '@/types/auth';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';
import type { AppError } from '@/types';
import { eventBus, EventTypes } from '@/modules/events/EventBus';

interface AuthState {
  user: LoginResponse['user'] | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  socialLogin: (provider: 'google' | 'facebook' | 'instagram') => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  addPoints: (points: number) => void;
  checkAuth: () => Promise<void>;
  cancelAllRequests: () => void;
  _requestManager?: { makeRequest: any; cancelAll: () => void } | null;
}

/**
 * Pure Zustand store for authentication
 * This is the actual implementation, separated from routing logic
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Error categorization helper
      const categorizeError = (error: any): string => {
        if (!error) return 'unknown';
        
        const message = error.message?.toLowerCase() || '';
        const code = error.code?.toLowerCase() || '';
        
        if (message.includes('network') || code === 'network_error') return 'network';
        if (message.includes('timeout') || code === 'econnaborted') return 'timeout';
        if (message.includes('unauthorized') || error.status === 401) return 'auth';
        if (message.includes('validation') || error.status === 422) return 'validation';
        if (error.status >= 500) return 'server';
        if (error.status >= 400) return 'client';
        
        return 'unknown';
      };
      
      // Request manager for cancellation
      let requestManager: { makeRequest: any; cancelAll: () => void } | null = null;
      
      const initRequestManager = () => {
        if (!requestManager) {
          let activeRequests = new Set<AbortController>();
          
          const makeRequest = (asyncFn: (signal: AbortSignal) => Promise<any>, options?: { timeout?: number }) => {
            const controller = new AbortController();
            activeRequests.add(controller);
            
            const promise = Promise.race([
              asyncFn(controller.signal),
              new Promise((_, reject) => {
                if (options?.timeout) {
                  setTimeout(() => {
                    controller.abort();
                    reject(new Error('Request timeout'));
                  }, options.timeout);
                }
              })
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
          
          requestManager = { makeRequest, cancelAll };
        }
        return requestManager;
      };
      
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        login: async (data) => {
          console.log('%c[AuthStore] Login started', 'color: blue; font-weight: bold');
          set({ isLoading: true, error: null });
          
          const manager = initRequestManager();
          const request = manager.makeRequest(
            async (signal: AbortSignal) => {
              const response = await authApi.login(data);
              
              if (signal.aborted) {
                throw new Error('Login cancelled');
              }
              
              return response;
            },
            { timeout: 15000 }
          );
          
          try {
            const response = await request.promise;
            
            if (!request.isCancelled()) {
              console.log('%c[AuthStore] Login successful', 'color: green; font-weight: bold');
              
              set({
                user: response.user,
                token: response.token,
                isAuthenticated: true,
                isLoading: false,
              });
              
              // 🚀 EMIT EVENT FOR GAMIFICATION INTEGRATION
              eventBus.emit(EventTypes.AUTH_LOGIN, {
                user: response.user,
                token: response.token,
                timestamp: Date.now()
              }, {
                priority: 'high',
                source: 'useAuthStore.login'
              });
              
              // Set client-side cookie for middleware (client-side only)
              if (typeof window !== 'undefined' && typeof document !== 'undefined') {
                document.cookie = `authenticated=true; path=/; max-age=86400; SameSite=Lax; domain=localhost`;
                
                // Store in localStorage with error handling
                try {
                  localStorage.setItem('auth_user', JSON.stringify(response.user));
                  localStorage.setItem('auth_token', response.token || 'authenticated');
                } catch (e) {
                  console.warn('[AuthStore] localStorage error:', e);
                }
              }
            }
          } catch (error) {
            console.error('%c[AuthStore] Login failed:', 'color: red; font-weight: bold', error);
            
            if (!request.isCancelled()) {
              const appError = error as AppError;
              set({
                error: appError.message || 'Erro ao fazer login',
                isLoading: false,
              });
            }
            throw error;
          }
        },

        register: async (data) => {
          set({ isLoading: true, error: null });
          
          const manager = initRequestManager();
          const request = manager.makeRequest(
            async (signal: AbortSignal) => {
              const response = await authApi.register(data);
              
              if (signal.aborted) {
                throw new Error('Registration cancelled');
              }
              
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
              
              // 🚀 EMIT EVENT FOR GAMIFICATION INTEGRATION
              eventBus.emit(EventTypes.AUTH_LOGIN, {
                user: response.user,
                token: response.token,
                timestamp: Date.now(),
                source: 'registration'
              }, {
                priority: 'high',
                source: 'useAuthStore.register'
              });
            }
          } catch (error) {
            if (!request.isCancelled()) {
              const appError = error as AppError;
              set({
                error: appError.message || 'Erro ao registrar',
                isLoading: false,
              });
            }
            throw error;
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
            // 🚀 EMIT EVENT FOR GAMIFICATION INTEGRATION BEFORE CLEARING DATA
            const currentUser = get().user;
            eventBus.emit(EventTypes.AUTH_LOGOUT, {
              user: currentUser,
              timestamp: Date.now()
            }, {
              priority: 'high',
              source: 'useAuthStore.logout'
            });
            
            // Clear all auth data (client-side only)
            if (typeof window !== 'undefined') {
              if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('auth_user');
                localStorage.removeItem('auth_token');
              }
              if (typeof document !== 'undefined') {
                document.cookie = 'authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=localhost';
              }
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

        addPoints: (points) => {
          console.warn(
            '[DEPRECATED] addPoints() called but ignored.',
            'Points are now awarded exclusively by the backend for security.',
            `Attempted to add ${points} points client-side.`
          );
        },

        checkAuth: async () => {
          const state = get();
          const now = Date.now();
          const lastAuthCheck = (state as any)._lastAuthCheck || 0;
          const AUTH_CHECK_THROTTLE = 2000;
          
          if (now - lastAuthCheck < AUTH_CHECK_THROTTLE && state.isAuthenticated) {
            return;
          }
          
          set({ isLoading: true, _lastAuthCheck: now } as any);
          
          // SSR guard: Check for document availability
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
          const hasAuthCookie = cookies.includes('authenticated=true') || 
                                cookies.includes('auth_token=');
          
          if (!hasAuthCookie) {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }
          
          const manager = initRequestManager();
          const request = manager.makeRequest(
            async (signal: AbortSignal) => {
              const response = await authApi.getProfile();
              
              if (signal.aborted) {
                throw new Error('Auth check cancelled');
              }
              
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
              
              // 🚀 EMIT EVENT FOR GAMIFICATION INTEGRATION (session restored)
              eventBus.emit(EventTypes.AUTH_STATE_CHANGED, {
                user: response,
                isAuthenticated: true,
                timestamp: Date.now(),
                source: 'session_restore'
              }, {
                priority: 'normal',
                source: 'useAuthStore.checkAuth'
              });
            }
          } catch (error) {
            const isUnauthorized = error instanceof Error && error.message.includes('401');
            
            if (isUnauthorized) {
              set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
              });
              
              // Clear cookies (client-side only)
              if (typeof document !== 'undefined') {
                document.cookie = 'authenticated=; path=/; max-age=0; SameSite=Lax; domain=localhost';
                document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax; domain=localhost';
              }
            } else {
              set({ isLoading: false });
            }
          }
        },

        cancelAllRequests: () => {
          if (requestManager) {
            requestManager.cancelAll();
          }
        },

        _requestManager: requestManager,
      };
    },
    {
      name: 'auth-storage',
      partialize: (state) => ({}), // Don't persist anything
    }
  )
);