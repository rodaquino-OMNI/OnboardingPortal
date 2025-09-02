'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SecureTokenManager } from './secure-token-manager';
import { unifiedAuthApi } from '@/lib/api/unified-auth';
import type { AuthUser, AuthResponse } from '@/types/auth';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';
import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { logger } from '@/lib/logger';

// ===== TYPES =====
interface AuthResult {
  success: boolean;
  error?: string;
  requires_2fa?: boolean;
  user?: AuthUser;
}

interface UnifiedAuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastAuthCheck: number;
  
  // Core authentication methods
  login: (data: LoginData) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  socialLogin: (provider: 'google' | 'facebook' | 'instagram') => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  
  // Token management
  refreshToken: () => Promise<boolean>;
  isTokenValid: () => boolean;
  
  // Utility methods
  clearError: () => void;
  cancelAllRequests: () => void;
  
  // Internal state management
  _setLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
  _setUser: (user: AuthUser | null) => void;
  _setAuthenticated: (authenticated: boolean) => void;
}

// ===== REQUEST MANAGEMENT =====
class RequestManager {
  private activeRequests = new Set<AbortController>();
  private static instance: RequestManager;
  
  static getInstance(): RequestManager {
    if (!this.instance) {
      this.instance = new RequestManager();
    }
    return this.instance;
  }
  
  makeRequest<T>(
    asyncFn: (signal: AbortSignal) => Promise<T>, 
    options?: { timeout?: number }
  ) {
    const controller = new AbortController();
    this.activeRequests.add(controller);
    
    const timeoutPromise = options?.timeout 
      ? new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timeout after ${options.timeout}ms`));
          }, options.timeout);
          
          // Clear timeout if request completes
          controller.signal.addEventListener('abort', () => clearTimeout(timeoutId));
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

// ===== AUTHENTICATION CIRCUIT BREAKER =====
class AuthCircuitBreaker {
  private static instance: AuthCircuitBreaker;
  private recursionCount = 0;
  private lastReset = 0;
  private readonly maxRecursion = 3;
  private readonly resetInterval = 5000; // 5 seconds
  
  static getInstance(): AuthCircuitBreaker {
    if (!this.instance) {
      this.instance = new AuthCircuitBreaker();
    }
    return this.instance;
  }
  
  canProceed(): boolean {
    const now = Date.now();
    
    // Reset recursion count after interval
    if (now - this.lastReset > this.resetInterval) {
      this.recursionCount = 0;
      this.lastReset = now;
    }
    
    if (this.recursionCount >= this.maxRecursion) {
      logger.warn('Authentication circuit breaker triggered - too many recursive calls');
      return false;
    }
    
    this.recursionCount++;
    return true;
  }
  
  reset() {
    this.recursionCount = 0;
    this.lastReset = Date.now();
  }
}

// ===== CROSS-TAB SYNC MANAGER =====
class CrossTabSyncManager {
  private static instance: CrossTabSyncManager;
  private listeners: Set<(event: StorageEvent) => void> = new Set();
  
  static getInstance(): CrossTabSyncManager {
    if (!this.instance) {
      this.instance = new CrossTabSyncManager();
    }
    return this.instance;
  }
  
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange.bind(this));
    }
  }
  
  private handleStorageChange(event: StorageEvent) {
    if (event.key === 'auth-sync') {
      this.listeners.forEach(listener => listener(event));
    }
  }
  
  broadcast(type: 'login' | 'logout', data?: any) {
    if (typeof window !== 'undefined') {
      const message = {
        type,
        data,
        timestamp: Date.now()
      };
      localStorage.setItem('auth-sync', JSON.stringify(message));
      localStorage.removeItem('auth-sync'); // Trigger storage event
    }
  }
  
  subscribe(listener: (event: StorageEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// ===== MAIN UNIFIED AUTH STORE =====
const requestManager = RequestManager.getInstance();
const circuitBreaker = AuthCircuitBreaker.getInstance();
const crossTabSync = CrossTabSyncManager.getInstance();

export const useUnifiedAuth = create<UnifiedAuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastAuthCheck: 0,

      // ===== LOGIN =====
      login: async (data: LoginData): Promise<AuthResult> => {
        logger.info('Unified auth login started', { email: data.email });
        set({ isLoading: true, error: null });
        
        const request = requestManager.makeRequest(
          async (signal) => {
            // Use unified auth API with proper CSRF handling
            const response = await unifiedAuthApi.login({
              login: data.login || data.email,
              password: data.password
            });
            
            if (signal.aborted) throw new Error('Login cancelled');
            return response;
          },
          { timeout: 15000 }
        );
        
        try {
          const response = await request.promise;
          
          if (!request.isCancelled()) {
            logger.info('Unified auth login successful', { userId: response.user.id });
            
            const authUser: AuthUser = {
              id: response.user.id,
              fullName: response.user.name,
              email: response.user.email,
              cpf: response.user.cpf,
              points: response.user.points,
              level: response.user.level,
              lgpd_consent: response.user.lgpd_consent,
              lgpd_consent_at: response.user.lgpd_consent_at,
              last_login_at: response.user.last_login_at,
            };
            
            set({
              user: authUser,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              lastAuthCheck: Date.now()
            });
            
            // Broadcast login to other tabs
            crossTabSync.broadcast('login', authUser);
            
            // Reset circuit breaker on successful login
            circuitBreaker.reset();
            
            // Emit event for other systems
            eventBus.emit(EventTypes.AUTH_LOGIN, {
              user: authUser,
              timestamp: Date.now()
            }, {
              priority: 'high',
              source: 'unifiedAuth.login'
            });
            
            return { success: true, user: authUser };
          }
          
          return { success: false, error: 'Request was cancelled' };
        } catch (error) {
          logger.error('Unified auth login failed', error);
          
          if (!request.isCancelled()) {
            const errorMessage = (error as Error).message || 'Login failed';
            
            set({ error: errorMessage, isLoading: false });
            return { success: false, error: errorMessage };
          }
          
          return { success: false, error: 'Request was cancelled' };
        }
      },

      // ===== REGISTER =====
      register: async (data: RegisterData): Promise<AuthResult> => {
        logger.info('Unified auth registration started', { email: data.email });
        set({ isLoading: true, error: null });
        
        // Multi-step registration process
        try {
          // Step 1: Basic info
          const step1Response = await unifiedAuthApi.registerStep1({
            name: data.fullName,
            email: data.email,
            cpf: data.cpf
          });
          
          if (!step1Response.token || !step1Response.user_id) {
            throw new Error('Registration step 1 failed');
          }
          
          // Step 2: Extended profile (simplified for now)
          await unifiedAuthApi.registerStep2({
            birth_date: data.birthDate,
            gender: 'prefer_not_to_say', // Default value
            marital_status: 'single', // Default value
            phone: data.phone,
            department: 'General', // Default value
            job_title: 'Employee', // Default value
            employee_id: `EMP-${Date.now()}`, // Auto-generate
            start_date: new Date().toISOString().split('T')[0],
            // Address fields from registration data
            address: data.address?.street,
            number: data.address?.number,
            complement: data.address?.complement,
            neighborhood: data.address?.neighborhood,
            city: data.address?.city,
            state: data.address?.state,
            zip_code: data.address?.zipCode,
          }, step1Response.token);
          
          // Step 3: Security setup
          const step3Response = await unifiedAuthApi.registerStep3({
            password: data.password,
            password_confirmation: data.confirmPassword,
            security_question: 'What is your favorite color?', // Default
            security_answer: 'Blue', // Default
            two_factor_enabled: false
          }, step1Response.token);
          
          if (!step3Response.user) {
            throw new Error('Registration completion failed');
          }
          
          const authUser: AuthUser = {
            id: step3Response.user.id,
            fullName: step3Response.user.name,
            email: step3Response.user.email,
            cpf: step3Response.user.cpf,
            points: step3Response.user.gamification_progress?.points || 0,
            level: step3Response.user.gamification_progress?.level || 1,
            lgpd_consent: true,
            lgpd_consent_at: new Date().toISOString(),
          };
          
          set({
            user: authUser,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastAuthCheck: Date.now()
          });
          
          // Broadcast login to other tabs
          crossTabSync.broadcast('login', authUser);
          
          // Emit event for other systems
          eventBus.emit(EventTypes.AUTH_LOGIN, {
            user: authUser,
            timestamp: Date.now(),
            source: 'registration'
          }, {
            priority: 'high',
            source: 'unifiedAuth.register'
          });
          
          return { success: true, user: authUser };
          
        } catch (error) {
          logger.error('Unified auth registration failed', error);
          const errorMessage = (error as Error).message || 'Registration failed';
          
          set({ error: errorMessage, isLoading: false });
          return { success: false, error: errorMessage };
        }
      },

      // ===== SOCIAL LOGIN =====
      socialLogin: async (provider) => {
        set({ isLoading: true, error: null });
        try {
          // Social login handled via redirect - tokens managed by httpOnly cookies
          const response = await fetch(`/api/auth/${provider}/redirect`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const { url } = await response.json();
            if (typeof window !== 'undefined') {
              window.location.href = url;
            }
          } else {
            throw new Error(`${provider} login failed`);
          }
        } catch (error) {
          const errorMessage = (error as Error).message || 'Social login failed';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      // ===== LOGOUT =====
      logout: async () => {
        logger.info('Unified auth logout started');
        set({ isLoading: true });
        
        try {
          await unifiedAuthApi.logout();
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
            source: 'unifiedAuth.logout'
          });
          
          // Broadcast logout to other tabs
          crossTabSync.broadcast('logout');
          
          // Cancel all pending requests
          requestManager.cancelAll();
          
          // Clear secure token manager
          SecureTokenManager.clearAll();
          
          // Clear state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            lastAuthCheck: 0
          });
          
          logger.info('Unified auth logout completed');
        }
      },

      // ===== CHECK AUTH =====
      checkAuth: async () => {
        if (!circuitBreaker.canProceed()) {
          return;
        }
        
        const state = get();
        const now = Date.now();
        const AUTH_CHECK_THROTTLE = 1000; // 1 second throttle
        
        // Throttle auth checks
        if (
          now - state.lastAuthCheck < AUTH_CHECK_THROTTLE && 
          state.isAuthenticated && 
          state.user && 
          !state.isLoading
        ) {
          return;
        }
        
        logger.debug('Unified auth check started');
        set({ isLoading: true, lastAuthCheck: now });
        
        // SSR guard
        if (typeof document === 'undefined') {
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false 
          });
          return;
        }
        
        // Check if tokens are available via httpOnly cookies
        if (!SecureTokenManager.hasValidSession()) {
          logger.debug('No valid session found, clearing state');
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
          return;
        }
        
        const request = requestManager.makeRequest(
          async (signal) => {
            const response = await unifiedAuthApi.getProfile();
            if (signal.aborted) throw new Error('Auth check cancelled');
            return response;
          },
          { timeout: 8000 }
        );
        
        try {
          const userProfile = await request.promise;
          
          if (!request.isCancelled()) {
            logger.debug('Unified auth check successful');
            
            const authUser: AuthUser = {
              id: userProfile.id,
              fullName: userProfile.name,
              email: userProfile.email,
              cpf: userProfile.cpf,
              points: userProfile.points,
              level: userProfile.level,
              lgpd_consent: userProfile.lgpd_consent,
              lgpd_consent_at: userProfile.lgpd_consent_at,
              last_login_at: userProfile.last_login_at,
            };
            
            set({
              user: authUser,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            eventBus.emit(EventTypes.AUTH_STATE_CHANGED, {
              user: authUser,
              isAuthenticated: true,
              timestamp: Date.now(),
              source: 'auth_check'
            }, {
              priority: 'normal',
              source: 'unifiedAuth.checkAuth'
            });
          }
        } catch (error) {
          logger.warn('Unified auth check failed', error);
          
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Authentication expired'
          });
          
          SecureTokenManager.clearAll();
        }
      },

      // ===== TOKEN MANAGEMENT =====
      refreshToken: async (): Promise<boolean> => {
        logger.debug('Token refresh started');
        
        const request = requestManager.makeRequest(
          async (signal) => {
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
          await request.promise;
          
          if (!request.isCancelled()) {
            set({
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

      isTokenValid: (): boolean => {
        return SecureTokenManager.hasValidSession();
      },

      // ===== UTILITY METHODS =====
      clearError: () => set({ error: null }),
      
      cancelAllRequests: () => {
        requestManager.cancelAll();
      },
      
      _setLoading: (loading: boolean) => set({ isLoading: loading }),
      _setError: (error: string | null) => set({ error }),
      _setUser: (user: AuthUser | null) => set({ user }),
      _setAuthenticated: (authenticated: boolean) => set({ isAuthenticated: authenticated })
    }),
    {
      name: 'unified-auth-storage',
      partialize: () => ({}), // Don't persist anything for security - use httpOnly cookies
    }
  )
);

// ===== CROSS-TAB SYNCHRONIZATION =====
if (typeof window !== 'undefined') {
  crossTabSync.subscribe((event) => {
    try {
      const message = JSON.parse(event.newValue || '{}');
      const store = useUnifiedAuth.getState();
      
      switch (message.type) {
        case 'login':
          if (message.data && !store.isAuthenticated) {
            store._setUser(message.data);
            store._setAuthenticated(true);
            logger.info('Synchronized login from another tab');
          }
          break;
        case 'logout':
          if (store.isAuthenticated) {
            store._setUser(null);
            store._setAuthenticated(false);
            logger.info('Synchronized logout from another tab');
          }
          break;
      }
    } catch (error) {
      logger.warn('Failed to parse cross-tab sync message', error);
    }
  });
}

// ===== DEBUG INFORMATION =====
if (typeof window !== 'undefined') {
  (window as any).__UNIFIED_AUTH_VERSION__ = '2.0.0';
  (window as any).__UNIFIED_AUTH_IMPLEMENTATION__ = {
    version: '2.0.0',
    timestamp: Date.now(),
    features: [
      'httpOnly-cookies-only',
      'request-cancellation', 
      'token-refresh',
      'error-boundaries',
      'cross-tab-sync',
      'circuit-breaker',
      'unified-api'
    ]
  };
}

export default useUnifiedAuth;