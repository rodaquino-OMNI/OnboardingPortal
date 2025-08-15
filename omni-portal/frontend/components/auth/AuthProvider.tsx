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

    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] Initializing authentication...');
        
        // Check for existing authentication
        await checkAuth();
        
        console.log('[AuthProvider] Authentication initialized successfully');
        setIsInitialized(true);
        setInitializationError(null);
        
      } catch (error) {
        console.error('[AuthProvider] Failed to initialize authentication:', error);
        setInitializationError(error instanceof Error ? error.message : 'Authentication initialization failed');
        setIsInitialized(true); // Still set as initialized so app can continue
      }
    };

    // Add a small delay to ensure the store is ready
    const timeoutId = setTimeout(initializeAuth, 100);
    
    return () => clearTimeout(timeoutId);
  }, [isClient, checkAuth]);

  // Provide context value
  const contextValue: AuthContextType = {
    isInitialized,
    initializationError,
  };

  // Show loading state during initialization (only on client)
  if (isClient && !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;