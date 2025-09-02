/**
 * @jest-environment jsdom
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlag, useFeatureFlags, FeatureFlag } from '../../hooks/useFeatureFlag';
import { useAuth } from '../../hooks/useAuth';
import apiService from '../../services/api';
import { render, screen } from '@testing-library/react';

// Mock dependencies
jest.mock('../../hooks/useAuth');
jest.mock('../../services/api');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('useFeatureFlag Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('useFeatureFlag', () => {
    it('should return default value when no user is authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      const { result } = renderHook(() => useFeatureFlag('admin.role_management_ui'));

      await waitFor(() => {
        expect(result.current).toBe(false); // Default value
      });
    });

    it('should return cached value when available', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      const cacheValue = {
        enabled: true,
        expires: Date.now() + 300000
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(cacheValue));

      const { result } = renderHook(() => useFeatureFlag('admin.role_management_ui'));

      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      expect(mockApiService.get).not.toHaveBeenCalled();
    });

    it('should call API when cache is expired', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      const expiredCacheValue = {
        enabled: false,
        expires: Date.now() - 1000 // Expired
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredCacheValue));

      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          enabled: true,
          user_enabled: true,
          rollout_percentage: 50
        }
      });

      const { result } = renderHook(() => useFeatureFlag('admin.role_management_ui'));

      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('/api/admin/feature-flags/admin.role_management_ui');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should fallback to default on API error', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      mockApiService.get.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useFeatureFlag('admin.role_management_ui'));

      await waitFor(() => {
        expect(result.current).toBe(false); // Default value
      });
    });

    it('should handle invalid flag gracefully', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      // @ts-ignore - Testing invalid flag
      const { result } = renderHook(() => useFeatureFlag('invalid.flag'));

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });
  });

  describe('useFeatureFlags', () => {
    it('should return all flags with defaults when no user', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.flags).toEqual({
          'admin.role_management_ui': false,
          'admin.security_audit_ui': false,
          'admin.system_settings_ui': false,
          'admin.user_management_enhanced': false,
          'admin.custom_role_system': false,
          'admin.real_time_analytics': false,
          'admin.bulk_operations': false,
          'admin.advanced_security': false
        });
      });
    });

    it('should fetch all flags from API when user is authenticated', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      const mockApiResponse = {
        'admin.role_management_ui': { enabled: true, user_enabled: true, rollout_percentage: 100 },
        'admin.security_audit_ui': { enabled: false, user_enabled: false, rollout_percentage: 0 }
      };

      mockApiService.get.mockResolvedValue({
        success: true,
        data: mockApiResponse
      });

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.flags['admin.role_management_ui']).toBe(true);
        expect(result.current.flags['admin.security_audit_ui']).toBe(false);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('/api/admin/feature-flags');
    });
  });

  describe('FeatureFlag Component', () => {
    it('should render children when flag is enabled', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          enabled: true,
          user_enabled: true,
          rollout_percentage: 100
        }
      });

      render(
        <FeatureFlag flag="admin.role_management_ui">
          <div data-testid="feature-content">Feature Content</div>
        </FeatureFlag>
      );

      await waitFor(() => {
        expect(screen.getByTestId('feature-content')).toBeInTheDocument();
      });
    });

    it('should render fallback when flag is disabled', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          enabled: false,
          user_enabled: false,
          rollout_percentage: 0
        }
      });

      render(
        <FeatureFlag 
          flag="admin.role_management_ui"
          fallback={<div data-testid="fallback-content">Fallback Content</div>}
        >
          <div data-testid="feature-content">Feature Content</div>
        </FeatureFlag>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
        expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
      });
    });

    it('should render nothing when flag is disabled and no fallback', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          enabled: false,
          user_enabled: false,
          rollout_percentage: 0
        }
      });

      const { container } = render(
        <FeatureFlag flag="admin.role_management_ui">
          <div data-testid="feature-content">Feature Content</div>
        </FeatureFlag>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('Caching behavior', () => {
    it('should cache API responses for 5 minutes', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          enabled: true,
          user_enabled: true,
          rollout_percentage: 50
        }
      });

      const { result } = renderHook(() => useFeatureFlag('admin.role_management_ui'));

      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'feature_flag:admin.role_management_ui:1',
        expect.stringContaining('"enabled":true')
      );

      const setItemCall = localStorageMock.setItem.mock.calls[0];
      const cachedData = JSON.parse(setItemCall[1]);
      
      // Check that expiry is approximately 5 minutes from now
      const expectedExpiry = Date.now() + 300000;
      expect(cachedData.expires).toBeGreaterThan(expectedExpiry - 1000);
      expect(cachedData.expires).toBeLessThan(expectedExpiry + 1000);
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockApiService.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFeatureFlag('admin.role_management_ui'));

      await waitFor(() => {
        expect(result.current).toBe(false); // Default value
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to check feature flag admin.role_management_ui:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle API failure response gracefully', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        checkAuth: jest.fn(),
        clearAuth: jest.fn()
      });

      mockApiService.get.mockResolvedValue({
        success: false,
        data: null,
        error: 'Unauthorized'
      });

      const { result } = renderHook(() => useFeatureFlag('admin.role_management_ui'));

      await waitFor(() => {
        expect(result.current).toBe(false); // Default value
      });
    });
  });
});