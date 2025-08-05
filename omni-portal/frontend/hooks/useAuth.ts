'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, type AuthResponse } from '@/lib/api/auth';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';
import type { AppError } from '@/types';
import { useCancellableRequest } from '@/lib/async-utils';
import { useEffect, useRef } from 'react';

interface AuthState {
  user: AuthResponse['user'] | null;
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
  _requestManager?: { makeRequest: any; cancelAll: () => void };
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => {
      // Initialize request manager
      let requestManager: { makeRequest: any; cancelAll: () => void } | null = null;
      
      const initRequestManager = () => {
        if (!requestManager) {
          // Create a simple request manager without using hooks inside Zustand
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
            
            // Only update state if request wasn't cancelled
            if (!request.isCancelled()) {
              set({
                user: response.user,
                token: response.token, // Keep for backward compatibility
                isAuthenticated: true,
                isLoading: false,
              });
            }
            
            // Return success result
            return {
              success: true,
              user: response.user,
              requires_2fa: false
            };
          } catch (error) {
            if (!request.isCancelled()) {
              const appError = error as AppError;
              set({
                error: appError.message || 'Erro ao fazer login',
                isLoading: false,
              });
            }
            
            // Return error result
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Erro ao fazer login',
              requires_2fa: false
            };
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
            { timeout: 30000 } // Registration can take longer
          );
          
          try {
            const response = await request.promise;
            
            if (!request.isCancelled()) {
              set({
                user: response.user,
                token: response.token, // Keep for backward compatibility
                isAuthenticated: true,
                isLoading: false,
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
          // Get OAuth redirect URL from backend
          const response = await authApi.getSocialRedirect(provider);
          
          // Redirect to OAuth provider
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
          // localStorage.removeItem('authToken'); // Remove this - cookies handled by backend
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
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              points: currentUser.points + points,
              level: Math.floor((currentUser.points + points) / 1000) + 1,
            },
          });
        }
      },

        checkAuth: async () => {
          set({ isLoading: true });
          
          const manager = initRequestManager();
          const request = manager.makeRequest(
            async (signal: AbortSignal) => {
              const response = await authApi.getProfile();
              
              if (signal.aborted) {
                throw new Error('Auth check cancelled');
              }
              
              return response;
            },
            { timeout: 10000 }
          );
          
          try {
            const response = await request.promise;
            
            if (!request.isCancelled()) {
              set({
                user: response,
                isAuthenticated: true,
                isLoading: false,
              });
            }
          } catch (error) {
            if (!request.isCancelled()) {
              set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
              });
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
      partialize: (state) => ({ user: state.user, token: state.token }), // Don't persist isAuthenticated to prevent race condition
    }
  )
);

/**
 * Hook to safely use auth with automatic cleanup
 */
export const useAuthWithCleanup = () => {
  const auth = useAuth();
  const cleanupRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    // Set up cleanup function
    cleanupRef.current = () => {
      auth.cancelAllRequests();
    };
    
    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [auth]);
  
  return auth;
};