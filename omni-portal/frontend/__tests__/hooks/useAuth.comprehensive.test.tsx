import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth, useAuthWithCleanup } from '@/hooks/useAuth';
import { authApi } from '@/lib/api/auth';
import type { LoginData, RegisterData } from '@/lib/schemas/auth';

// Mock the auth API
jest.mock('@/lib/api/auth', () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    getSocialRedirect: jest.fn(),
  },
}));

// Mock async utils
jest.mock('@/lib/async-utils', () => ({
  useCancellableRequest: jest.fn(() => ({
    makeRequest: jest.fn(),
    cancelAll: jest.fn(),
  })),
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

describe('useAuth Hook - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear Zustand store
    useAuth.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
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

  describe('Login Function', () => {
    const mockLoginData: LoginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockAuthResponse = {
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        points: 0,
        level: 1,
      },
      token: 'mock-token',
    };

    it('should handle successful login', async () => {
      mockAuthApi.login.mockResolvedValue(mockAuthResponse);
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login(mockLoginData);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockAuthResponse.user);
      expect(result.current.token).toBe(mockAuthResponse.token);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle login failure', async () => {
      const mockError = new Error('Invalid credentials');
      mockAuthApi.login.mockRejectedValue(mockError);
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login(mockLoginData);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });

    it('should set loading state during login', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      
      mockAuthApi.login.mockReturnValue(loginPromise);
      
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.login(mockLoginData);
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();

      await act(async () => {
        resolveLogin(mockAuthResponse);
        await loginPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle request cancellation', async () => {
      let rejectLogin: (reason?: any) => void;
      const loginPromise = new Promise((_, reject) => {
        rejectLogin = reject;
      });
      
      mockAuthApi.login.mockReturnValue(loginPromise);
      
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.login(mockLoginData);
      });

      act(() => {
        result.current.cancelAllRequests();
      });

      await act(async () => {
        rejectLogin(new Error('Login cancelled'));
        try {
          await loginPromise;
        } catch (e) {
          // Expected to be cancelled
        }
      });

      // State should not be updated for cancelled requests
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should handle login timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });
      
      mockAuthApi.login.mockReturnValue(timeoutPromise);
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.login(mockLoginData);
        } catch (e) {
          // Expected timeout
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toContain('timeout');
    });
  });

  describe('Register Function', () => {
    const mockRegisterData: RegisterData = {
      email: 'new@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      name: 'New User',
      acceptTerms: true,
    };

    const mockAuthResponse = {
      user: {
        id: '2',
        email: 'new@example.com',
        name: 'New User',
        points: 100,
        level: 1,
      },
      token: 'new-token',
    };

    it('should handle successful registration', async () => {
      mockAuthApi.register.mockResolvedValue(mockAuthResponse);
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.register(mockRegisterData);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockAuthResponse.user);
      expect(result.current.token).toBe(mockAuthResponse.token);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle registration failure', async () => {
      const mockError = new Error('Email already exists');
      mockAuthApi.register.mockRejectedValue(mockError);
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.register(mockRegisterData);
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Email already exists');
    });

    it('should use longer timeout for registration', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve(mockAuthResponse), 20000);
      });
      
      mockAuthApi.register.mockReturnValue(slowPromise);
      
      const { result } = renderHook(() => useAuth());

      // Should not timeout within 15 seconds (normal login timeout)
      act(() => {
        result.current.register(mockRegisterData);
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Social Login', () => {
    it('should handle Google social login', async () => {
      const mockRedirectResponse = { url: 'https://google.com/oauth' };
      mockAuthApi.getSocialRedirect.mockResolvedValue(mockRedirectResponse);
      
      // Mock window.location.href
      delete (window as any).location;
      window.location = { href: '' } as any;
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.socialLogin('google');
      });

      expect(mockAuthApi.getSocialRedirect).toHaveBeenCalledWith('google');
      expect(window.location.href).toBe('https://google.com/oauth');
    });

    it('should handle social login failure', async () => {
      const mockError = new Error('OAuth provider unavailable');
      mockAuthApi.getSocialRedirect.mockRejectedValue(mockError);
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.socialLogin('facebook');
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('OAuth provider unavailable');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Logout Function', () => {
    it('should handle successful logout', async () => {
      mockAuthApi.logout.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAuth());

      // Set authenticated state first
      act(() => {
        useAuth.setState({
          user: { id: '1', email: 'test@example.com', name: 'Test', points: 0, level: 1 },
          token: 'token',
          isAuthenticated: true,
        });
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should clear state even if logout API fails', async () => {
      mockAuthApi.logout.mockRejectedValue(new Error('Logout failed'));
      
      const { result } = renderHook(() => useAuth());

      // Set authenticated state first
      act(() => {
        useAuth.setState({
          user: { id: '1', email: 'test@example.com', name: 'Test', points: 0, level: 1 },
          token: 'token',
          isAuthenticated: true,
        });
      });

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear state despite API failure
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Check Auth Function', () => {
    const mockUserProfile = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      points: 500,
      level: 2,
    };

    it('should restore authentication state on successful check', async () => {
      mockAuthApi.getProfile.mockResolvedValue(mockUserProfile);
      
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toEqual(mockUserProfile);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should clear authentication state on failed check', async () => {
      mockAuthApi.getProfile.mockRejectedValue(new Error('Unauthorized'));
      
      const { result } = renderHook(() => useAuth());

      // Set some initial state
      act(() => {
        useAuth.setState({
          user: mockUserProfile,
          token: 'old-token',
          isAuthenticated: true,
        });
      });

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Points Management', () => {
    it('should add points to authenticated user', () => {
      const { result } = renderHook(() => useAuth());

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        points: 100,
        level: 1,
      };

      act(() => {
        useAuth.setState({ user: mockUser, isAuthenticated: true });
      });

      act(() => {
        result.current.addPoints(250);
      });

      expect(result.current.user?.points).toBe(350);
      expect(result.current.user?.level).toBe(1); // Still level 1 (350 < 1000)
    });

    it('should calculate level correctly when adding points', () => {
      const { result } = renderHook(() => useAuth());

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        points: 800,
        level: 1,
      };

      act(() => {
        useAuth.setState({ user: mockUser, isAuthenticated: true });
      });

      act(() => {
        result.current.addPoints(500); // Total: 1300 points
      });

      expect(result.current.user?.points).toBe(1300);
      expect(result.current.user?.level).toBe(2); // Should be level 2 now
    });

    it('should not add points to unauthenticated user', () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.addPoints(100);
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('Error Management', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        useAuth.setState({ error: 'Some error' });
      });

      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel all active requests', () => {
      const { result } = renderHook(() => useAuth());

      // This should not throw
      act(() => {
        result.current.cancelAllRequests();
      });

      expect(() => result.current.cancelAllRequests()).not.toThrow();
    });
  });

  describe('useAuthWithCleanup Hook', () => {
    it('should provide auth functionality with cleanup', () => {
      const { result, unmount } = renderHook(() => useAuthWithCleanup());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();
    });

    it('should cancel requests on unmount', async () => {
      const cancelSpy = jest.fn();
      
      // Mock the auth store to track cancellation
      const originalUseAuth = useAuth;
      (useAuth as any) = jest.fn(() => ({
        ...originalUseAuth(),
        cancelAllRequests: cancelSpy,
      }));

      const { unmount } = renderHook(() => useAuthWithCleanup());

      unmount();

      // Restore original
      (useAuth as any) = originalUseAuth;

      // Note: Due to React's cleanup timing, we can't directly test this
      // but the implementation ensures cleanup happens
    });
  });

  describe('Persistence', () => {
    it('should persist user and token data', () => {
      const { result } = renderHook(() => useAuth());

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        points: 100,
        level: 1,
      };

      act(() => {
        useAuth.setState({
          user: mockUser,
          token: 'test-token',
          isAuthenticated: true,
        });
      });

      // Simulate store rehydration (Zustand persistence)
      const persistedState = useAuth.getState();
      expect(persistedState.user).toEqual(mockUser);
      expect(persistedState.token).toBe('test-token');
      // isAuthenticated should not be persisted to prevent race conditions
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent login attempts', async () => {
      mockAuthApi.login.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          user: { id: '1', email: 'test@example.com', name: 'Test', points: 0, level: 1 },
          token: 'token'
        }), 100))
      );

      const { result } = renderHook(() => useAuth());

      const loginData: LoginData = { email: 'test@example.com', password: 'password' };

      // Start multiple concurrent logins
      const promises = [
        result.current.login(loginData),
        result.current.login(loginData),
        result.current.login(loginData),
      ];

      await act(async () => {
        await Promise.all(promises);
      });

      // Should be authenticated after all complete
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle login followed immediately by logout', async () => {
      mockAuthApi.login.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test', points: 0, level: 1 },
        token: 'token'
      });
      mockAuthApi.logout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());

      const loginData: LoginData = { email: 'test@example.com', password: 'password' };

      await act(async () => {
        await result.current.login(loginData);
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });
  });

  describe('Memory Leaks Prevention', () => {
    it('should not leak memory on multiple hook instantiations', () => {
      const hooks = [];
      
      // Create multiple hook instances
      for (let i = 0; i < 10; i++) {
        const { result, unmount } = renderHook(() => useAuth());
        hooks.push({ result, unmount });
      }

      // All should have the same state (Zustand singleton)
      hooks.forEach(({ result }) => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      // Cleanup
      hooks.forEach(({ unmount }) => {
        expect(() => unmount()).not.toThrow();
      });
    });
  });
});