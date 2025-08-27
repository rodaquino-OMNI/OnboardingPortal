'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { logger } from '@/lib/logger';

interface AuthContextType {
  isInitialized: boolean;
  initializationError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  isInitialized: false,
  initializationError: null,
});

export const useAuthContext = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider - Manages authentication initialization and provides auth context
 * 
 * This component:
 * 1. Ensures authentication is properly initialized on app start
 * 2. Handles SSR-safe authentication checks
 * 3. Provides initialization status to child components
 * 4. Manages auth state synchronization with the Zustand store
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Get unified auth functions
  const { checkAuth, isLoading, error } = useUnifiedAuth();

  // SSR hydration fix: Track when we're on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize authentication on mount
  useEffect(() => {
    // SSR guard: Only run on client side
    if (!isClient || typeof window === 'undefined') {
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    // MEMORY LEAK FIX: AbortController for cleanup
    const abortController = new AbortController();

    const initializeAuth = async () => {
      try {
        // MEMORY LEAK FIX: Check if aborted before proceeding
        if (abortController.signal.aborted) {
          return;
        }
        
        logger.info('Initializing authentication...', null, 'AuthProvider');
        
        // Check for existing authentication with timeout and abort signal
        await Promise.race([
          checkAuth(),
          new Promise((_, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Auth initialization timeout')), 5000); // Reduced timeout
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error('Auth initialization aborted'));
            });
          })
        ]);
        
        if (isMounted && !abortController.signal.aborted) {
          logger.info('Authentication initialized successfully', null, 'AuthProvider');
          setIsInitialized(true);
          setInitializationError(null);
        }
        
      } catch (error) {
        logger.error('Failed to initialize authentication', error, null, 'AuthProvider');
        
        if (isMounted && !abortController.signal.aborted) {
          if (retryCount < maxRetries) {
            retryCount++;
            logger.info(`Retrying authentication (${retryCount}/${maxRetries})`, null, 'AuthProvider');
            const retryTimeoutId = setTimeout(initializeAuth, 1000 * retryCount); // Exponential backoff
            // MEMORY LEAK FIX: Clear timeout on abort
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(retryTimeoutId);
            });
          } else {
            const errorMessage = error instanceof Error ? error.message : 'Authentication initialization failed';
            logger.error('Authentication initialization failed after retries', { error: errorMessage }, 'AuthProvider');
            setInitializationError(errorMessage);
            setIsInitialized(true); // Still set as initialized so app can continue
          }
        }
      }
    };

    // Start initialization immediately when client is ready
    initializeAuth();
    
    return () => {
      isMounted = false;
      // MEMORY LEAK FIX: Abort all pending operations
      abortController.abort();
    };
  }, [isClient, checkAuth]); // Include checkAuth but with proper cleanup

  // Provide context value
  const contextValue: AuthContextType = {
    isInitialized,
    initializationError,
  };

  // Don't show loading state during SSR/hydration to avoid mismatch
  // The loading state causes hydration errors because server renders children
  // but client renders loading spinner initially

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;