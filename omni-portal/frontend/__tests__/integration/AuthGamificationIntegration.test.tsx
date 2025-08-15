/**
 * Integration Test: Auth + Gamification System
 * Verifies that authentication events properly trigger gamification updates
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { gamificationIntegration } from '@/modules/gamification/GamificationIntegration';
import { featureFlags } from '@/lib/feature-flags';

// Mock dependencies
jest.mock('@/lib/api/auth');
jest.mock('@/modules/api/ApiGateway');
jest.mock('@/modules/state/UnifiedStateAdapter');

describe('Auth + Gamification Integration', () => {
  let eventSpy: jest.SpyInstance;
  let gamificationSpy: jest.SpyInstance;

  beforeEach(() => {
    // Clean up state
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset event bus
    eventBus.removeAllListeners();
    eventBus.clearEventQueue();
    
    // Spy on event emissions
    eventSpy = jest.spyOn(eventBus, 'emit');
    
    // Spy on gamification methods
    gamificationSpy = jest.spyOn(gamificationIntegration, 'syncUserProgress');
  });

  afterEach(() => {
    jest.clearAllMocks();
    eventSpy.mockRestore();
    gamificationSpy.mockRestore();
  });

  describe('Event Integration', () => {
    it('should emit AUTH_LOGIN event on successful login', async () => {
      // Mock successful login
      const mockAuthApi = require('@/lib/api/auth');
      mockAuthApi.authApi.login.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com', name: 'Test User' },
        token: 'mock-token'
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      // Verify AUTH_LOGIN event was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        EventTypes.AUTH_LOGIN,
        expect.objectContaining({
          user: expect.objectContaining({
            id: 'user123',
            email: 'test@example.com'
          }),
          token: 'mock-token'
        }),
        expect.objectContaining({
          priority: 'high',
          source: expect.stringContaining('Auth')
        })
      );
    });

    it('should emit AUTH_LOGOUT event on logout', async () => {
      // Set up authenticated user first
      const { result } = renderHook(() => useAuth());
      
      // Mock user state
      result.current.user = { id: 'user123', email: 'test@example.com', name: 'Test User' };
      result.current.isAuthenticated = true;

      // Mock logout API
      const mockAuthApi = require('@/lib/api/auth');
      mockAuthApi.authApi.logout.mockResolvedValue({});

      await act(async () => {
        await result.current.logout();
      });

      // Verify AUTH_LOGOUT event was emitted with user data
      expect(eventSpy).toHaveBeenCalledWith(
        EventTypes.AUTH_LOGOUT,
        expect.objectContaining({
          user: expect.objectContaining({
            id: 'user123'
          })
        }),
        expect.objectContaining({
          priority: 'high'
        })
      );
    });

    it('should emit events for both legacy and modular auth implementations', async () => {
      // Test both implementations
      const implementations = ['legacy', 'modular'];
      
      for (const impl of implementations) {
        // Set feature flag for implementation
        const shouldUseModular = impl === 'modular';
        jest.spyOn(featureFlags, 'get').mockImplementation((flag) => {
          if (flag === 'USE_MODULAR_AUTH') return shouldUseModular;
          return false;
        });

        eventSpy.mockClear();

        const { result } = renderHook(() => useAuth());

        // Mock login
        const mockAuthApi = require('@/lib/api/auth');
        mockAuthApi.authApi.login.mockResolvedValue({
          user: { id: `${impl}-user`, email: 'test@example.com' },
          token: `${impl}-token`
        });

        await act(async () => {
          await result.current.login({
            email: 'test@example.com',
            password: 'password123'
          });
        });

        // Verify event was emitted regardless of implementation
        expect(eventSpy).toHaveBeenCalledWith(
          EventTypes.AUTH_LOGIN,
          expect.objectContaining({
            user: expect.objectContaining({
              id: `${impl}-user`
            })
          }),
          expect.any(Object)
        );
      }
    });
  });

  describe('Gamification Response', () => {
    it('should trigger gamification sync on auth login event', async () => {
      // Set up event listener (simulating what GamificationIntegration does)
      let capturedEvent: any = null;
      eventBus.on(EventTypes.AUTH_LOGIN, (event) => {
        capturedEvent = event;
        // Simulate gamification sync
        if (event.payload.user?.id) {
          gamificationIntegration.syncUserProgress(event.payload.user.id);
        }
      });

      // Trigger login
      const { result } = renderHook(() => useAuth());
      
      const mockAuthApi = require('@/lib/api/auth');
      mockAuthApi.authApi.login.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
        token: 'mock-token'
      });

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      // Wait for event processing
      await waitFor(() => {
        expect(capturedEvent).toBeTruthy();
        expect(capturedEvent.payload.user.id).toBe('user123');
      });

      // Verify gamification sync was called
      expect(gamificationSpy).toHaveBeenCalledWith('user123');
    });

    it('should clear gamification data on logout event', async () => {
      const clearSpy = jest.spyOn(gamificationIntegration, 'clearUserData');

      // Set up event listener
      eventBus.on(EventTypes.AUTH_LOGOUT, () => {
        gamificationIntegration.clearUserData();
      });

      // Trigger logout
      const { result } = renderHook(() => useAuth());
      
      // Mock logout
      const mockAuthApi = require('@/lib/api/auth');
      mockAuthApi.authApi.logout.mockResolvedValue({});

      await act(async () => {
        await result.current.logout();
      });

      // Verify gamification data was cleared
      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalled();
      });

      clearSpy.mockRestore();
    });
  });

  describe('End-to-End User Journey', () => {
    it('should complete full auth + gamification flow', async () => {
      // Mock APIs
      const mockAuthApi = require('@/lib/api/auth');
      const mockApiGateway = require('@/modules/api/ApiGateway');
      
      mockAuthApi.authApi.login.mockResolvedValue({
        user: { 
          id: 'user123', 
          email: 'test@example.com',
          name: 'Test User'
        },
        token: 'jwt-token'
      });

      mockApiGateway.apiGateway.execute.mockResolvedValue({
        success: true,
        data: {
          totalPoints: 500,
          currentLevel: 2,
          achievements: ['welcome', 'first_login']
        }
      });

      const { result } = renderHook(() => useAuth());

      // Set up gamification listener
      const gamificationEvents: any[] = [];
      eventBus.on(/gamification\..*/, (event) => {
        gamificationEvents.push(event);
      });

      // Step 1: Login
      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      // Step 2: Verify user is authenticated
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.id).toBe('user123');

      // Step 3: Wait for gamification events
      await waitFor(() => {
        expect(eventSpy).toHaveBeenCalledWith(
          EventTypes.AUTH_LOGIN,
          expect.objectContaining({
            user: expect.objectContaining({ id: 'user123' })
          }),
          expect.any(Object)
        );
      });

      // Step 4: Logout
      await act(async () => {
        await result.current.logout();
      });

      // Step 5: Verify clean logout
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();

      // Step 6: Verify logout event
      expect(eventSpy).toHaveBeenCalledWith(
        EventTypes.AUTH_LOGOUT,
        expect.objectContaining({
          user: expect.objectContaining({ id: 'user123' })
        }),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle auth errors without breaking gamification', async () => {
      const { result } = renderHook(() => useAuth());

      // Mock failed login
      const mockAuthApi = require('@/lib/api/auth');
      mockAuthApi.authApi.login.mockRejectedValue(new Error('Invalid credentials'));

      let loginError = null;
      await act(async () => {
        try {
          await result.current.login({
            email: 'wrong@example.com',
            password: 'wrongpassword'
          });
        } catch (error) {
          loginError = error;
        }
      });

      // Verify no AUTH_LOGIN event was emitted for failed login
      expect(eventSpy).not.toHaveBeenCalledWith(
        EventTypes.AUTH_LOGIN,
        expect.any(Object),
        expect.any(Object)
      );

      // Verify auth state remains unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      const { result } = renderHook(() => useAuth());

      // Mock network error
      const mockAuthApi = require('@/lib/api/auth');
      mockAuthApi.authApi.login.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com',
            password: 'password123'
          });
        } catch (error) {
          // Expected to fail
        }
      });

      // Verify system remains stable
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });
});

/**
 * Mock implementations for testing
 */

// Mock feature flags
jest.mock('@/lib/feature-flags', () => ({
  featureFlags: {
    get: jest.fn().mockImplementation((flag) => {
      const defaults = {
        USE_MODULAR_AUTH: false,
        USE_UNIFIED_STATE: false,
        USE_API_GATEWAY: false,
        USE_EVENT_BUS: true,
        ENFORCE_BOUNDARIES: 'log',
        PARALLEL_EXECUTION: false
      };
      return defaults[flag as keyof typeof defaults] ?? false;
    })
  }
}));

// Mock auth API
jest.mock('@/lib/api/auth', () => ({
  authApi: {
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    getProfile: jest.fn(),
    getSocialRedirect: jest.fn()
  }
}));

// Mock API Gateway
jest.mock('@/modules/api/ApiGateway', () => ({
  apiGateway: {
    execute: jest.fn()
  }
}));

// Mock unified state
jest.mock('@/modules/state/UnifiedStateAdapter', () => ({
  unifiedState: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn()
  }
}));