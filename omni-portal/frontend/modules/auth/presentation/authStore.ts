/**
 * authStore - Zustand store for modular auth state
 * Separated from business logic
 */

import { create } from 'zustand';
import type { AuthResponse } from '@/lib/api/auth';

interface AuthStoreState {
  user: AuthResponse['user'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: AuthResponse['user']) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  // State
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Actions
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  clear: () => set({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  })
}));