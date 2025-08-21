'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from '@/hooks/stores/useAuthStore';

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

  // Get auth store functions
  const { checkAuth, isLoading, error } = useAuthStore();

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

    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] Initializing authentication...');
        
        // Check for existing authentication with timeout
        await Promise.race([
          checkAuth(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Auth initialization timeout')), 10000)
          )
        ]);
        
        if (isMounted) {
          console.log('[AuthProvider] Authentication initialized successfully');
          setIsInitialized(true);
          setInitializationError(null);
        }
        
      } catch (error) {
        console.error('[AuthProvider] Failed to initialize authentication:', error);
        
        if (isMounted) {
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`[AuthProvider] Retrying authentication (${retryCount}/${maxRetries})...`);
            setTimeout(initializeAuth, 1000 * retryCount); // Exponential backoff
          } else {
            setInitializationError(error instanceof Error ? error.message : 'Authentication initialization failed');
            setIsInitialized(true); // Still set as initialized so app can continue
          }
        }
      }
    };

    // Start initialization immediately when client is ready
    initializeAuth();
    
    return () => {
      isMounted = false;
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