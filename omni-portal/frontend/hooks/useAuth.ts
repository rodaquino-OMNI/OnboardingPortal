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
      // Create a monitored version of set that logs state changes
      const monitoredSet = (partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => {
        const currentState = get();
        const newState = typeof partial === 'function' ? partial(currentState) : partial;
        
        // Log state changes for debugging
        if (typeof window !== 'undefined') {
          const changes: any = {};
          Object.keys(newState).forEach(key => {
            const k = key as keyof AuthState;
            if (currentState[k] !== newState[k]) {
              changes[key] = {
                from: currentState[k],
                to: newState[k]
              };
            }
          });
          
          if (Object.keys(changes).length > 0) {
            console.log('%c[useAuth.STATE_CHANGE]', 'color: purple; font-weight: bold', {
              timestamp: new Date().toISOString(),
              changes
            });
          }
        }
        
        // Call original set
        set(newState);
      };
      
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
          console.log('%c[useAuth.login] Starting login process', 'color: blue; font-weight: bold');
          monitoredSet({ isLoading: true, error: null });
          
          const manager = initRequestManager();
          const request = manager.makeRequest(
            async (signal: AbortSignal) => {
              console.log('[useAuth.login] Making API call to login...');
              const response = await authApi.login(data);
              
              if (signal.aborted) {
                console.log('[useAuth.login] Request was aborted');
                throw new Error('Login cancelled');
              }
              
              console.log('[useAuth.login] Login response received:', {
                hasUser: !!response.user,
                hasToken: !!response.token,
                userId: response.user?.id
              });
              return response;
            },
            { timeout: 15000 }
          );
          
          try {
            const response = await request.promise;
            
            // Only update state if request wasn't cancelled
            if (!request.isCancelled()) {
              console.log('%c[useAuth.login] Login successful, updating state', 'color: green; font-weight: bold');
              
              monitoredSet({
                user: response.user,
                token: response.token, // Keep for backward compatibility
                isAuthenticated: true,
                isLoading: false,
              });
              
              // Set a client-side cookie to help middleware detect auth state
              // This supplements the httpOnly auth_token from backend
              // CRITICAL: Must set domain=localhost to ensure cookie is available to middleware
              const cookieString = `authenticated=true; path=/; max-age=86400; SameSite=Lax; domain=localhost`;
              console.log('[useAuth.login] Setting client-side cookie:', cookieString);
              document.cookie = cookieString;
              
              // Verify cookie was set
              console.log('[useAuth.login] Cookies after setting:', document.cookie);
              
              // Try to store in localStorage but handle quota errors
              try {
                // Clear old data first if quota is exceeded
                if (localStorage.length > 100) {
                  localStorage.clear();
                }
                localStorage.setItem('auth_user', JSON.stringify(response.user));
                localStorage.setItem('auth_token', 'authenticated');
                console.log('[useAuth.login] localStorage updated successfully');
              } catch (e) {
                console.warn('[useAuth.login] localStorage quota exceeded, using cookies only:', e);
                // Clear localStorage if quota exceeded
                try {
                  localStorage.clear();
                } catch (clearError) {
                  console.error('[useAuth.login] Failed to clear localStorage:', clearError);
                }
              }
              
              console.log('%c[useAuth.login] Auth state set, scheduling checkAuth', 'color: green; font-weight: bold');
              
              // Force a checkAuth to sync cookies with state
              // This ensures the authentication state is properly synchronized
              setTimeout(() => {
                console.log('[useAuth.login] Running scheduled checkAuth...');
                get().checkAuth();
              }, 100);
            }
            
            // Return success result
            return {
              success: true,
              user: response.user,
              requires_2fa: false
            };
          } catch (error) {
            console.log('%c[useAuth.login] Login failed:', 'color: red; font-weight: bold', error);
            
            if (!request.isCancelled()) {
              const appError = error as AppError;
              monitoredSet({
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
          monitoredSet({ isLoading: true, error: null });
          
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
              monitoredSet({
                user: response.user,
                token: response.token, // Keep for backward compatibility
                isAuthenticated: true,
                isLoading: false,
              });
            }
          } catch (error) {
            if (!request.isCancelled()) {
              const appError = error as AppError;
              monitoredSet({
                error: appError.message || 'Erro ao registrar',
                isLoading: false,
              });
            }
            throw error;
          }
        },

      socialLogin: async (provider) => {
        monitoredSet({ isLoading: true, error: null });
        try {
          // Get OAuth redirect URL from backend
          const response = await authApi.getSocialRedirect(provider);
          
          // Redirect to OAuth provider
          window.location.href = response.url;
        } catch (error) {
          const appError = error as AppError;
          monitoredSet({
            error: appError.message || 'Erro ao fazer login social',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        monitoredSet({ isLoading: true });
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear all auth data
          localStorage.removeItem('auth_user');
          localStorage.removeItem('auth_token');
          // Clear client-side cookie
          document.cookie = 'authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=localhost';
          
          monitoredSet({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      clearError: () => monitoredSet({ error: null }),

      /**
       * @deprecated Client-side point awarding has been removed for security.
       * All points are now awarded by the backend to ensure integrity.
       * This function is kept only for backwards compatibility but does nothing.
       */
      addPoints: (points) => {
        console.warn(
          '[DEPRECATED] addPoints() called but ignored.',
          'Points are now awarded exclusively by the backend for security.',
          `Attempted to add ${points} points client-side.`
        );
        // DO NOT award points client-side - backend handles all gamification
      },

        checkAuth: async () => {
          console.log('%c[useAuth.checkAuth] Starting auth check', 'color: blue; font-weight: bold');
          console.log('[useAuth.checkAuth] Current state:', {
            isAuthenticated: get().isAuthenticated,
            hasUser: !!get().user,
            isLoading: get().isLoading
          });
          
          monitoredSet({ isLoading: true });
          
          // First check if we have an auth cookie
          const cookies = document.cookie;
          const hasAuthCookie = cookies.includes('authenticated=true') || 
                                cookies.includes('auth_token=');
          
          console.log('[useAuth.checkAuth] Cookie check:', {
            hasAuthCookie,
            cookies: cookies.substring(0, 200),
            authenticatedCookie: cookies.includes('authenticated=true'),
            authTokenCookie: cookies.includes('auth_token=')
          });
          
          if (!hasAuthCookie) {
            // No cookie, not authenticated
            console.log('%c[useAuth.checkAuth] No auth cookie found, clearing auth state', 'color: red; font-weight: bold');
            monitoredSet({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }
          
          // We have a cookie, try to get user profile
          console.log('[useAuth.checkAuth] Auth cookie found, fetching user profile...');
          const manager = initRequestManager();
          const request = manager.makeRequest(
            async (signal: AbortSignal) => {
              console.log('[useAuth.checkAuth] Making API call to getProfile...');
              const response = await authApi.getProfile();
              
              if (signal.aborted) {
                console.log('[useAuth.checkAuth] Request was aborted');
                throw new Error('Auth check cancelled');
              }
              
              console.log('[useAuth.checkAuth] Profile response received:', response);
              return response;
            },
            { timeout: 10000 }
          );
          
          try {
            const response = await request.promise;
            
            if (!request.isCancelled()) {
              console.log('%c[useAuth.checkAuth] Profile fetched successfully, setting authenticated state', 'color: green; font-weight: bold');
              monitoredSet({
                user: response,
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              console.log('[useAuth.checkAuth] Request was cancelled, not updating state');
            }
          } catch (error) {
            console.log('%c[useAuth.checkAuth] Profile fetch failed:', 'color: orange; font-weight: bold', error);
            
            // Even if profile fails, if we have cookie, consider authenticated
            if (!request.isCancelled()) {
              console.log('[useAuth.checkAuth] Keeping authenticated state based on cookie presence');
              monitoredSet({
                user: null,
                token: null,
                isAuthenticated: hasAuthCookie, // Keep authenticated if cookie exists
                isLoading: false,
              });
            }
          }
          
          console.log('[useAuth.checkAuth] Final state after check:', {
            isAuthenticated: get().isAuthenticated,
            hasUser: !!get().user,
            isLoading: get().isLoading
          });
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
      partialize: (state) => ({ 
        // Don't persist anything to force login on every session
        // This ensures users must authenticate each time
      }),
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