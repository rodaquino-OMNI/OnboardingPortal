'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/auth/useAuth';
import type { AuthResult } from '@/hooks/auth/useAuth';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';
import type { LoginResponse } from '@/types/auth';
import { logger } from '@/lib/logger';

// ===== CONTEXT TYPES =====
interface AuthContextType {
  // State
  user: LoginResponse['user'] | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (data: LoginData) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  socialLogin: (provider: 'google' | 'facebook' | 'instagram') => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  
  // Utilities
  clearError: () => void;
  refreshToken: () => Promise<boolean>;
  cancelAllRequests: () => void;
}

// ===== CONTEXT =====
const AuthContext = createContext<AuthContextType | null>(null);

// ===== PROVIDER PROPS =====
interface AuthProviderProps {
  children: ReactNode;
}

// ===== MAIN PROVIDER =====
export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  useEffect(() => {
    // logger.info('AuthProvider initialized with consolidated auth hook'); // Commented to reduce console spam
    
    // Check authentication on mount
    auth.checkAuth();
    
    // Handle cleanup on unmount
    return () => {
      // logger.debug('AuthProvider unmounting, cancelling requests'); // Commented to reduce console spam
      auth.cancelAllRequests();
    };
  }, []); // Empty dependency array - only run once on mount

  const contextValue: AuthContextType = {
    // State
    user: auth.user,
    token: auth.token,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    
    // Actions
    login: auth.login,
    register: auth.register,
    socialLogin: auth.socialLogin,
    logout: auth.logout,
    checkAuth: auth.checkAuth,
    
    // Utilities
    clearError: auth.clearError,
    refreshToken: auth.refreshToken,
    cancelAllRequests: auth.cancelAllRequests
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ===== HOOK TO USE CONTEXT =====
export function useAuthContext() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}

// ===== EXPORTS =====
export default AuthProvider;

// Legacy exports for backward compatibility
export { AuthProvider as AuthContextProvider };
export { useAuthContext as useAuth };