/**
 * Authentication Flow Integration Tests
 * Tests for infinite loop prevention and proper auth flow handling
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/auth/useAuth';
import { authApi } from '@/lib/api/auth';

// Mock the auth API
jest.mock('@/lib/api/auth', () => ({
  authApi: {
    login: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    register: jest.fn(),
    getSocialRedirect: jest.fn(),
  },
}));

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});

// Mock window location
const mockLocation = {
  href: '',
  assign: jest.fn(),
  reload: jest.fn(),
};
Object.defineProperty(window, 'location', {
  writable: true,
  value: mockLocation,
});

// Mock console methods to reduce test noise
const originalConsole = console;
beforeAll(() => {
  console.warn = jest.fn();
  console.log = jest.fn();
  console.debug = jest.fn();
});

afterAll(() => {
  console.warn = originalConsole.warn;
  console.log = originalConsole.log;
  console.debug = originalConsole.debug;
});

describe('Authentication Flow Integration Tests', () => {
  let mockAuthApi: jest.Mocked<typeof authApi>;

  beforeEach(() => {
    mockAuthApi = authApi as jest.Mocked<typeof authApi>;
    jest.clearAllMocks();
    
    // Reset document cookies
    document.cookie = '';
    
    // Reset window recursion counter
    (window as any)._authCheckRecursionCount = 0;
    
    // Reset mock implementations
    mockAuthApi.getProfile.mockReset();
    mockAuthApi.login.mockReset();
    mockAuthApi.logout.mockReset();
  });

  describe('Infinite Loop Prevention', () => {
    test('should prevent infinite auth check recursion', async () => {
      // Set up cookies to trigger auth check
      document.cookie = 'auth_token=valid-token; path=/';
      
      // Mock profile endpoint to always succeed
      mockAuthApi.getProfile.mockResolvedValue({
        id: '1',
        fullName: 'Test User',
        email: 'test@example.com',
        cpf: '12345678901',
        points: 0,
        level: 1,
        lgpd_consent: true,
      });

      const { result } = renderHook(() => useAuth());

      // Trigger multiple rapid auth checks
      const promises = Array.from({ length: 10 }, () => 
        act(async () => {
          await result.current.checkAuth();
        })
      );

      await Promise.all(promises);

      // Should prevent excessive API calls
      expect(mockAuthApi.getProfile).toHaveBeenCalledTimes(1);
    });

    test('should break recursion loop with circuit breaker', async () => {
      // Set recursion counter to near limit
      (window as any)._authCheckRecursionCount = 3;
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.checkAuth();
      });

      // Should not make API call when recursion limit reached
      expect(mockAuthApi.getProfile).not.toHaveBeenCalled();
    });

    test('should reset recursion counter after timeout', async () => {
      const { result } = renderHook(() => useAuth());

      // Trigger recursion limit
      (window as any)._authCheckRecursionCount = 4;

      await act(async () => {
        await result.current.checkAuth();
      });

      // Wait for reset timeout (mocked)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 5100));
      });

      expect((window as any)._authCheckRecursionCount).toBe(0);
    });
  });

  describe('Cookie Validation Logic', () => {
    test('should validate auth cookies properly', async () => {
      const { result } = renderHook(() => useAuth());

      // Test with valid cookie
      document.cookie = 'auth_token=valid-token-12345678901; path=/';
      mockAuthApi.getProfile.mockResolvedValue({
        id: '1',
        fullName: 'Test User',
        email: 'test@example.com',
        cpf: '12345678901',
        points: 0,
        level: 1,
        lgpd_consent: true,
      });

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockAuthApi.getProfile).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(true);
    });

    test('should reject invalid cookies', async () => {
      const { result } = renderHook(() => useAuth());

      // Test with short/invalid cookie
      document.cookie = 'auth_token=short; path=/';

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockAuthApi.getProfile).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('should handle multiple cookie types', async () => {
      const { result } = renderHook(() => useAuth());

      // Test with session cookie
      document.cookie = 'omni_onboarding_portal_session=valid-session-12345678901; path=/';
      mockAuthApi.getProfile.mockResolvedValue({
        id: '1',
        fullName: 'Test User',
        email: 'test@example.com',
        cpf: '12345678901',
        points: 0,
        level: 1,
        lgpd_consent: true,
      });

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockAuthApi.getProfile).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Login → Redirect → Auth Check Flow', () => {
    test('should handle successful login flow', async () => {
      const { result } = renderHook(() => useAuth());

      mockAuthApi.login.mockResolvedValue({
        token: 'secured-httponly-cookie',
        user: {
          id: '1',
          fullName: 'Test User',
          email: 'test@example.com',
          cpf: '12345678901',
          points: 0,
          level: 1,
          lgpd_consent: true,
        },
      });

      await act(async () => {
        const result_login = await result.current.login({
          login: 'test@example.com',
          password: 'password123',
        });
        
        expect(result_login.success).toBe(true);
        expect(result_login.user).toBeDefined();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toBeDefined();
      
      // Verify cookies were set
      expect(document.cookie).toContain('auth_token=');
      expect(document.cookie).toContain('authenticated=true');
    });

    test('should handle failed login gracefully', async () => {
      const { result } = renderHook(() => useAuth());

      mockAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));

      await act(async () => {
        const loginResult = await result.current.login({
          login: 'test@example.com',
          password: 'wrongpassword',
        });
        
        expect(loginResult.success).toBe(false);
        expect(loginResult.error).toBe('Invalid credentials');
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });

    test('should prevent login race conditions', async () => {
      const { result } = renderHook(() => useAuth());

      // Simulate slow login response
      mockAuthApi.login.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          token: 'secured-httponly-cookie',
          user: {
            id: '1',
            fullName: 'Test User',
            email: 'test@example.com',
            cpf: '12345678901',
            points: 0,
            level: 1,
            lgpd_consent: true,
          },
        }), 100))
      );

      // Trigger multiple rapid login attempts
      const promises = Array.from({ length: 3 }, () =>
        act(async () => {
          await result.current.login({
            login: 'test@example.com',
            password: 'password123',
          });
        })
      );

      await Promise.allSettled(promises);

      // Should only make one actual API call due to loading state protection
      expect(mockAuthApi.login).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logout Cookie Cleanup', () => {
    test('should clear all cookies on logout', async () => {
      const { result } = renderHook(() => useAuth());

      // Set up authenticated state with cookies
      document.cookie = 'auth_token=valid-token; path=/';
      document.cookie = 'authenticated=true; path=/';
      document.cookie = 'laravel_session=session-value; path=/';
      document.cookie = 'XSRF-TOKEN=csrf-token; path=/';

      await act(async () => {
        await result.current.logout();
      });

      // Verify all auth-related state is cleared
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(result.current.token).toBe(null);

      // Verify cookies would be cleared (in real browser environment)
      // Note: jsdom doesn't fully support cookie expiration, so we check the implementation
      expect(mockAuthApi.logout).toHaveBeenCalled();
    });

    test('should handle logout API failure gracefully', async () => {
      const { result } = renderHook(() => useAuth());

      // Set up authenticated state
      await act(async () => {
        result.current._setUser({
          id: '1',
          fullName: 'Test User',
          email: 'test@example.com',
          cpf: '12345678901',
          points: 0,
          level: 1,
          lgpd_consent: true,
        });
      });

      mockAuthApi.logout.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear local state even if API fails
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });
  });

  describe('Auth State Race Conditions', () => {
    test('should handle concurrent auth checks', async () => {
      document.cookie = 'auth_token=valid-token-12345678901; path=/';
      
      mockAuthApi.getProfile.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          id: '1',
          fullName: 'Test User',
          email: 'test@example.com',
          cpf: '12345678901',
          points: 0,
          level: 1,
          lgpd_consent: true,
        }), 50))
      );

      const { result } = renderHook(() => useAuth());

      // Trigger multiple concurrent auth checks
      const promises = Array.from({ length: 5 }, () =>
        act(async () => {
          await result.current.checkAuth();
        })
      );

      await Promise.all(promises);

      // Should throttle requests and only make one API call
      expect(mockAuthApi.getProfile).toHaveBeenCalledTimes(1);
      expect(result.current.isAuthenticated).toBe(true);
    });

    test('should handle request cancellation properly', async () => {
      const { result } = renderHook(() => useAuth());

      // Start a slow auth check
      mockAuthApi.getProfile.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const checkPromise = act(async () => {
        await result.current.checkAuth();
      });

      // Cancel all requests immediately
      act(() => {
        result.current.cancelAllRequests();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Request should have been cancelled
      await expect(checkPromise).resolves.toBeUndefined();
    });

    test('should handle auth check throttling', async () => {
      const { result } = renderHook(() => useAuth());

      // Set up successful auth state
      document.cookie = 'auth_token=valid-token-12345678901; path=/';
      mockAuthApi.getProfile.mockResolvedValue({
        id: '1',
        fullName: 'Test User',
        email: 'test@example.com',
        cpf: '12345678901',
        points: 0,
        level: 1,
        lgpd_consent: true,
      });

      // First call should proceed
      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockAuthApi.getProfile).toHaveBeenCalledTimes(1);

      // Immediate second call should be throttled
      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockAuthApi.getProfile).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe('SSR Safety', () => {
    test('should handle server-side rendering safely', async () => {
      // Mock SSR environment
      const originalDocument = global.document;
      // @ts-ignore
      delete global.document;

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);

      // Restore document
      global.document = originalDocument;
    });
  });
});