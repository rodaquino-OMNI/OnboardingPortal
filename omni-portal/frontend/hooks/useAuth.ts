'use client';

import { useAuthStore } from './stores/useAuthStore';
import { featureFlags } from '@/lib/feature-flags';
import { usageMonitor } from '@/lib/usage-monitor';
import { useEffect, useRef, useState } from 'react';

interface AuthResult {
  success: boolean;
  error?: string;
  requires_2fa?: boolean;
  session_token?: string;
}

/**
 * Main authentication hook - Router that decides which implementation to use
 * This is the SINGLE ENTRY POINT for all authentication needs
 */
export function useAuth() {
  // SSR hydration fix: Track when we're on client side
  const [isClient, setIsClient] = useState(false);
  
  // Determine which implementation to use (only on client)
  const shouldUseModular = isClient ? featureFlags.get('USE_MODULAR_AUTH') : false;
  
  // Get auth store functions
  const authStore = useAuthStore();
  
  // Track which version is being used
  const versionRef = useRef<string>('');

  // SSR hydration fix: Set client flag
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    // SSR guard: Only run on client side
    if (!isClient || typeof window === 'undefined') {
      return;
    }

    const version = shouldUseModular ? 'modular' : 'store';
    
    if (versionRef.current !== version) {
      // Log version change
      console.log(
        `%c[AUTH ROUTER] Using ${version} implementation`,
        `color: ${version === 'modular' ? 'green' : 'orange'}; font-weight: bold`,
        {
          timestamp: new Date().toISOString(),
          featureFlag: shouldUseModular,
          environment: process.env.NODE_ENV
        }
      );
      
      // Track usage
      usageMonitor.track('auth.router', version, {
        timestamp: Date.now(),
        featureFlag: shouldUseModular
      });
      
      // Store in window for debugging (client-side only)
      (window as any).__AUTH_VERSION__ = version;
      (window as any).__AUTH_IMPLEMENTATION__ = {
        version,
        timestamp: Date.now(),
        featureFlags: {
          USE_MODULAR_AUTH: shouldUseModular,
          USE_UNIFIED_STATE: featureFlags.get('USE_UNIFIED_STATE'),
          USE_API_GATEWAY: featureFlags.get('USE_API_GATEWAY'),
          USE_EVENT_BUS: featureFlags.get('USE_EVENT_BUS')
        }
      };
      
      versionRef.current = version;
    }
  }, [isClient, shouldUseModular]);
  
  // Wrap the store methods to provide the expected interface
  const wrappedLogin = async (data: any): Promise<AuthResult> => {
    try {
      await authStore.login(data);
      return { success: true };
    } catch (error) {
      console.error('[useAuth] Login error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  };

  const wrappedRegister = async (data: any): Promise<AuthResult> => {
    try {
      await authStore.register(data);
      return { success: true };
    } catch (error) {
      console.error('[useAuth] Register error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  };
  
  // Return the wrapped store implementation
  return {
    ...authStore,
    login: wrappedLogin,
    register: wrappedRegister,
  };
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use useAuth() instead
 */
export const useAuthLegacy = useAuthStore;

/**
 * Hook with automatic cleanup
 */
export function useAuthWithCleanup() {
  const auth = useAuth();
  const cleanupRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    // Set up cleanup function
    cleanupRef.current = () => {
      if ('cancelAllRequests' in auth) {
        auth.cancelAllRequests();
      }
    };
    
    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [auth]);
  
  return auth;
}

/**
 * Verification hook for development
 * Logs all auth state changes for debugging
 */
export function useAuthWithVerification() {
  const auth = useAuth();
  const prevStateRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);
  
  // SSR hydration fix
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    // SSR guard: Only run on client side
    if (!isClient || typeof window === 'undefined') {
      return;
    }

    const currentState = {
      isAuthenticated: auth.isAuthenticated,
      hasUser: !!auth.user,
      isLoading: auth.isLoading,
      hasError: !!auth.error,
      implementation: (window as any).__AUTH_VERSION__
    };
    
    if (prevStateRef.current && JSON.stringify(prevStateRef.current) !== JSON.stringify(currentState)) {
      console.log(
        '%c[AUTH VERIFICATION] State changed',
        'color: purple; font-weight: bold',
        {
          from: prevStateRef.current,
          to: currentState,
          timestamp: new Date().toISOString()
        }
      );
      
      // Emit event for monitoring (client-side only)
      window.dispatchEvent(new CustomEvent('auth-state-change', {
        detail: {
          previous: prevStateRef.current,
          current: currentState,
          timestamp: Date.now()
        }
      }));
    }
    
    prevStateRef.current = currentState;
  }, [isClient, auth.isAuthenticated, auth.user, auth.isLoading, auth.error]);
  
  return auth;
}

// Runtime verification on load (client-side only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Check after a short delay to ensure everything is loaded
  setTimeout(() => {
    // Additional check to ensure we're really on the client
    if (typeof window === 'undefined') return;
    
    const implementation = (window as any).__AUTH_IMPLEMENTATION__;
    if (implementation) {
      console.log(
        '%c[AUTH RUNTIME CHECK] Authentication system initialized',
        'color: blue; font-weight: bold',
        implementation
      );
      
      // Verify feature flags match implementation
      if (implementation.featureFlags.USE_MODULAR_AUTH && implementation.version !== 'modular') {
        console.error(
          '%c[AUTH RUNTIME ERROR] Feature flag enabled but modular auth not running!',
          'color: red; font-weight: bold'
        );
      }
    }
  }, 1000);
}