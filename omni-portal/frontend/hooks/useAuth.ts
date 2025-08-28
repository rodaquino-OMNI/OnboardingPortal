'use client';

/**
 * CONSOLIDATED: Main authentication hook
 * This is now the single source of truth for all authentication
 */

import { useAuth as useConsolidatedAuth } from './auth/useAuth';
import { logger } from '@/lib/logger';

/**
 * Main useAuth hook - now consolidated single implementation
 */
export function useAuth() {
  logger.info('Using consolidated authentication implementation');
  return useConsolidatedAuth();
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use useAuth() instead
 */
export const useAuthLegacy = useAuth;

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
  const prevStateRef = useRef<{
    isAuthenticated: boolean;
    hasUser: boolean;
    isLoading: boolean;
    hasError: boolean;
    implementation: string;
  } | null>(null);
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
      implementation: typeof window !== 'undefined' ? (window as any).__AUTH_VERSION__ : 'unknown'
    };
    
    if (prevStateRef.current && JSON.stringify(prevStateRef.current) !== JSON.stringify(currentState)) {
      logger.debug('Auth state changed', {
        from: prevStateRef.current,
        to: currentState,
        timestamp: new Date().toISOString()
      }, 'AuthVerification');
      
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
      logger.info('Authentication system initialized', implementation, 'AuthRuntimeCheck');
      
      // Verify feature flags match implementation
      if (implementation.featureFlags.USE_MODULAR_AUTH && implementation.version !== 'modular') {
        logger.error('Feature flag mismatch: USE_MODULAR_AUTH enabled but modular auth not running', 
          null, { featureFlags: implementation.featureFlags, version: implementation.version }, 'AuthRuntimeCheck');
      }
    }
  }, 1000);
}