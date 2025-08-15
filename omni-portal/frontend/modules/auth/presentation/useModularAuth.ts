/**
 * useModularAuth - Clean, modular authentication hook
 * Maximum 50 lines - single responsibility
 */

'use client';

import { useCallback, useEffect } from 'react';
import { useAuthStore } from './authStore';
import { authContainer } from '../container';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';

export function useModularAuth() {
  const store = useAuthStore();

  // Login
  const login = useCallback(async (data: LoginData) => {
    store.setLoading(true);
    store.clearError();

    const loginUseCase = authContainer.getLoginUseCase();
    const result = await loginUseCase.execute(data);

    if (result.success) {
      store.setUser(result.user!);
      store.setAuthenticated(true);
    } else {
      store.setError(result.error || 'Login failed');
    }

    store.setLoading(false);
    return result;
  }, [store]);

  // Logout
  const logout = useCallback(async () => {
    store.setLoading(true);
    
    const logoutUseCase = authContainer.getLogoutUseCase();
    await logoutUseCase.execute();
    
    store.clear();
  }, [store]);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const checkAuthUseCase = authContainer.getCheckAuthUseCase();
      const result = await checkAuthUseCase.execute();
      
      if (result.authenticated && result.user) {
        store.setUser(result.user);
        store.setAuthenticated(true);
      }
    };

    checkAuth();
  }, [store]);

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    login,
    logout,
    clearError: store.clearError
  };
}