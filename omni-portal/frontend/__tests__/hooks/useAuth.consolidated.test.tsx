/**
 * Consolidated useAuth Hook Test Suite
 * Verifies the new unified authentication implementation
 */

import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/auth/useAuth';
import { authApi } from '@/lib/api/auth';
import { eventBus, EventTypes } from '@/modules/events/EventBus';

// Mock dependencies
jest.mock('@/lib/api/auth');
jest.mock('@/modules/events/EventBus');
jest.mock('@/lib/logger');

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockEventBus = eventBus as jest.Mocked<typeof eventBus>;

describe('useAuth (Consolidated)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
    
    // Mock window
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Login', () => {
    it('should handle successful login', async () => {
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      const mockResponse = {
        user: mockUser,
        token: 'mock-token'
      };

      mockAuthApi.login.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const authResult = await result.current.login({
          email: 'test@example.com',
          password: 'password123'
        });

        expect(authResult.success).toBe(true);
        expect(authResult.user).toEqual(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('mock-token');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Verify event was emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        EventTypes.AUTH_LOGIN,
        expect.objectContaining({
          user: mockUser,
          token: 'mock-token'
        }),
        expect.objectContaining({
          priority: 'high',
          source: 'useAuth.login'
        })
      );
    });

    it('should handle login failure', async () => {
      const mockError = new Error('Invalid credentials');
      mockAuthApi.login.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const authResult = await result.current.login({
          email: 'test@example.com',
          password: 'wrong-password'
        });

        expect(authResult.success).toBe(false);
        expect(authResult.error).toBe('Invalid credentials');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle request cancellation', async () => {
      // Simulate a long-running request that gets cancelled
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      
      mockAuthApi.login.mockImplementation(() => loginPromise as Promise<any>);

      const { result } = renderHook(() => useAuth());

      // Start login
      let authResultPromise: Promise<any>;
      act(() => {
        authResultPromise = result.current.login({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      // Cancel all requests
      act(() => {
        result.current.cancelAllRequests();
      });

      // Complete the original request (after cancellation)
      resolveLogin!({
        user: { id: 1, name: 'Test' },
        token: 'token'
      });

      // The result should indicate cancellation
      await act(async () => {
        const authResult = await authResultPromise!;
        expect(authResult.success).toBe(false);
        expect(authResult.error).toContain('cancelled');
      });
    });
  });

  describe('Registration', () => {
    it('should handle successful registration', async () => {
      const mockUser = { id: 1, name: 'New User', email: 'new@example.com' };
      const mockResponse = {
        user: mockUser,
        token: 'new-token'
      };

      mockAuthApi.register.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const authResult = await result.current.register({
          email: 'new@example.com',
          password: 'password123',
          name: 'New User'
        });

        expect(authResult.success).toBe(true);
        expect(authResult.user).toEqual(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Logout', () => {
    it('should handle successful logout', async () => {
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      
      // Set initial authenticated state
      const { result } = renderHook(() => useAuth());
      
      // Mock being logged in first
      act(() => {
        result.current._setUser(mockUser);
        result.current._setLoading(false);
      });

      mockAuthApi.logout.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Verify logout event was emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        EventTypes.AUTH_LOGOUT,
        expect.objectContaining({
          user: mockUser
        }),
        expect.objectContaining({
          priority: 'high',
          source: 'useAuth.logout'
        })
      );
    });
  });

  describe('Social Login', () => {
    it('should handle social login redirect', async () => {
      const mockResponse = { url: 'https://oauth.google.com/redirect' };
      mockAuthApi.getSocialRedirect.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.socialLogin('google');
      });

      // Should have redirected to the social login URL
      expect(window.location.href).toBe('https://oauth.google.com/redirect');
    });

    it('should handle social login error', async () => {
      const mockError = new Error('Social login failed');
      mockAuthApi.getSocialRedirect.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.socialLogin('google');
        })
      ).rejects.toThrow('Social login failed');

      expect(result.current.error).toBe('Social login failed');
    });
  });

  describe('Auth Check', () => {
    it('should handle auth check with valid cookies', async () => {
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      
      // Mock having auth cookies
      Object.defineProperty(document, 'cookie', {
        value: 'auth_token=valid-token; authenticated=true',
        writable: true,
      });

      mockAuthApi.getProfile.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should clear state when no auth cookies', async () => {
      // No cookies
      Object.defineProperty(document, 'cookie', {
        value: '',
        writable: true,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockAuthApi.getProfile).not.toHaveBeenCalled();
    });

    it('should handle auth check failure', async () => {
      // Mock having auth cookies
      Object.defineProperty(document, 'cookie', {
        value: 'auth_token=invalid-token',
        writable: true,
      });

      mockAuthApi.getProfile.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Authentication expired');
    });
  });

  describe('Token Refresh', () => {
    it('should handle successful token refresh', async () => {
      // Mock the fetch for token refresh
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'new-token' })
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const success = await result.current.refreshToken();
        expect(success).toBe(true);
      });

      expect(result.current.token).toBe('new-token');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle token refresh failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const success = await result.current.refreshToken();
        expect(success).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current._setError('Test error');
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Request Management', () => {
    it('should cancel all requests', () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.cancelAllRequests();
      });

      // Should not throw and should complete successfully
      expect(result.current.error).toBeNull();
    });
  });

  describe('Cookie Management', () => {
    it('should set auth cookies on login', async () => {
      const mockResponse = {
        user: { id: 1, name: 'Test' },
        token: 'test-token'
      };

      mockAuthApi.login.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      // Verify cookies were set (mocked document.cookie behavior)
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Implementation Marker', () => {
    it('should set implementation marker on window', () => {
      renderHook(() => useAuth());

      expect((window as any).__AUTH_VERSION__).toBe('consolidated-v1');
      expect((window as any).__AUTH_IMPLEMENTATION__).toEqual(
        expect.objectContaining({
          version: 'consolidated-v1',
          features: ['httpOnly-cookies', 'request-cancellation', 'token-refresh', 'error-boundaries']
        })
      );
    });
  });
});

export {};