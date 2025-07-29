'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, type AuthResponse } from '@/lib/api/auth';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';
import type { AppError } from '@/types';

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
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(data);
          // Token is now handled via httpOnly cookies
          // localStorage.setItem('authToken', response.token); // Remove this
          set({
            user: response.user,
            token: response.token, // Keep for backward compatibility
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          const appError = error as AppError;
          set({
            error: appError.message || 'Erro ao fazer login',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(data);
          // Token is now handled via httpOnly cookies
          // localStorage.setItem('authToken', response.token); // Remove this
          set({
            user: response.user,
            token: response.token, // Keep for backward compatibility
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          const appError = error as AppError;
          set({
            error: appError.message || 'Erro ao registrar',
            isLoading: false,
          });
          throw error;
        }
      },

      socialLogin: async (provider) => {
        set({ isLoading: true, error: null });
        try {
          // Get OAuth redirect URL from backend
          const response = await authApi.getSocialRedirect(provider);
          
          // Redirect to OAuth provider
          window.location.href = response.url;
        } catch (error) {
          const appError = error as AppError;
          set({
            error: appError.message || 'Erro ao fazer login social',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // localStorage.removeItem('authToken'); // Remove this - cookies handled by backend
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      clearError: () => set({ error: null }),

      addPoints: (points) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              points: currentUser.points + points,
              level: Math.floor((currentUser.points + points) / 1000) + 1,
            },
          });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const response = await authApi.getProfile();
          set({
            user: response,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }), // Don't persist isAuthenticated to prevent race condition
    }
  )
);