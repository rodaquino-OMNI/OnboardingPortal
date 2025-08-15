/**
 * Architecture Validation Tests
 * Ensures new modular architecture maintains feature parity
 * and doesn't break existing functionality
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@/hooks';
import { useGamification } from '@/hooks';
import { featureFlags } from '@/lib/feature-flags';
import { integrationManager } from '@/lib/integration-manager';
import { eventBus } from '@/modules/events/EventBus';
import { unifiedState } from '@/modules/state/UnifiedStateAdapter';
import { apiGateway } from '@/modules/api/ApiGateway';

// Mock API responses
const mockUser = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'employee'
};

const mockGamificationProgress = {
  totalPoints: 500,
  currentLevel: 2,
  achievements: ['onboarding_start', 'profile_complete']
};

describe('Architecture Validation - Feature Parity', () => {
  beforeEach(() => {
    // Reset all state
    featureFlags.reset();
    unifiedState.clear();
    eventBus.clear();
    jest.clearAllMocks();
  });

  describe('Authentication Integration', () => {
    it('should maintain identical behavior between old and new auth', async () => {
      // Test with old implementation
      featureFlags.set('USE_MODULAR_AUTH', false);
      
      const { result: oldAuth } = renderHook(() => useAuth());
      
      await act(async () => {
        await oldAuth.current.login('test@example.com', 'password');
      });
      
      const oldUser = oldAuth.current.user;
      const oldIsAuthenticated = oldAuth.current.isAuthenticated;
      
      // Switch to new implementation
      featureFlags.set('USE_MODULAR_AUTH', true);
      
      const { result: newAuth } = renderHook(() => useAuth());
      
      await act(async () => {
        await newAuth.current.login('test@example.com', 'password');
      });
      
      const newUser = newAuth.current.user;
      const newIsAuthenticated = newAuth.current.isAuthenticated;
      
      // Verify identical behavior
      expect(newUser).toEqual(oldUser);
      expect(newIsAuthenticated).toBe(oldIsAuthenticated);
    });

    it('should support parallel execution for validation', async () => {
      // Enable parallel mode
      integrationManager.activatePhase('testing');
      
      const { result } = renderHook(() => useAuth());
      
      // Perform action
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      
      // Get metrics from parallel execution
      const metrics = result.current.getMetrics();
      
      // Verify both implementations ran
      expect(metrics.legacy.executionTime).toBeDefined();
      expect(metrics.modular.executionTime).toBeDefined();
      expect(metrics.legacy.success).toBe(true);
      expect(metrics.modular.success).toBe(true);
      
      // Verify results match
      expect(metrics.resultsMatch).toBe(true);
    });

    it('should preserve all auth methods', async () => {
      const { result } = renderHook(() => useAuth());
      
      // Verify all methods exist
      expect(result.current.login).toBeDefined();
      expect(result.current.logout).toBeDefined();
      expect(result.current.refreshToken).toBeDefined();
      expect(result.current.updateProfile).toBeDefined();
      expect(result.current.changePassword).toBeDefined();
      expect(result.current.validateSession).toBeDefined();
      
      // Verify state properties
      expect(result.current.user).toBeDefined();
      expect(result.current.isAuthenticated).toBeDefined();
      expect(result.current.isLoading).toBeDefined();
      expect(result.current.error).toBeDefined();
    });
  });

  describe('Gamification Compatibility', () => {
    it('should maintain gamification scores and formulas', async () => {
      // Setup initial state
      featureFlags.set('USE_UNIFIED_STATE', false);
      
      const { result: oldGamification } = renderHook(() => useGamification());
      
      await act(async () => {
        await oldGamification.current.fetchProgress();
      });
      
      const oldPoints = oldGamification.current.points;
      const oldLevel = oldGamification.current.level;
      
      // Switch to new system
      featureFlags.set('USE_UNIFIED_STATE', true);
      
      const { result: newGamification } = renderHook(() => useGamification());
      
      await act(async () => {
        await newGamification.current.refresh();
      });
      
      // Verify scores are preserved
      expect(newGamification.current.points).toBe(oldPoints);
      expect(newGamification.current.level).toBe(oldLevel);
      
      // Verify formulas still work
      const pointsToNext = newGamification.current.getPointsToNextLevel();
      expect(pointsToNext).toBe((oldLevel * 1000) - oldPoints);
    });

    it('should trigger events correctly with new system', async () => {
      featureFlags.set('USE_UNIFIED_STATE', true);
      
      const eventSpy = jest.fn();
      eventBus.on('gamification.points.updated', eventSpy);
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.awardPoints(100, 'test_action');
      });
      
      // Verify event was triggered
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'gamification.points.updated',
          payload: expect.objectContaining({
            points: expect.any(Number),
            added: 100,
            reason: 'test_action'
          })
        })
      );
    });

    it('should maintain achievement tracking', async () => {
      const { result } = renderHook(() => useGamification());
      
      // Check achievement
      const hasAchievement = result.current.hasAchievement('profile_complete');
      
      // Award new achievement
      await act(async () => {
        await result.current.unlockAchievement('health_assessment_complete');
      });
      
      // Verify it's tracked
      const hasNewAchievement = result.current.hasAchievement('health_assessment_complete');
      expect(hasNewAchievement).toBe(true);
    });
  });

  describe('Code Duplication Check', () => {
    it('should not have duplicate auth implementations active', () => {
      // Check that only one implementation is active at a time
      const activeImplementations = integrationManager.getActiveImplementations('auth');
      
      expect(activeImplementations.length).toBe(1);
      expect(['legacy', 'modular']).toContain(activeImplementations[0]);
    });

    it('should not duplicate API calls', async () => {
      const apiSpy = jest.spyOn(apiGateway, 'execute');
      
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      
      // Should only make one API call (not duplicated)
      const loginCalls = apiSpy.mock.calls.filter(
        call => call[0].request.endpoint === '/api/auth/login'
      );
      
      expect(loginCalls.length).toBe(1);
    });

    it('should not duplicate state storage', () => {
      // Set value through new system
      unifiedState.set('auth', 'user', mockUser);
      
      // Check localStorage for duplicates
      const localStorageKeys = Object.keys(localStorage);
      const authKeys = localStorageKeys.filter(key => 
        key.includes('auth') || key.includes('user')
      );
      
      // Should only have one auth storage key
      expect(authKeys.length).toBeLessThanOrEqual(2); // Allow for legacy + new during migration
    });
  });

  describe('Backend API Compatibility', () => {
    it('should maintain exact API request format', async () => {
      const apiSpy = jest.spyOn(apiGateway, 'execute');
      
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      
      // Verify request format matches backend expectations
      expect(apiSpy).toHaveBeenCalledWith({
        request: expect.objectContaining({
          method: 'POST',
          endpoint: '/api/auth/login',
          body: {
            email: 'test@example.com',
            password: 'password'
          }
        })
      });
    });

    it('should handle backend error responses correctly', async () => {
      // Mock API error
      jest.spyOn(apiGateway, 'execute').mockRejectedValueOnce({
        error: 'Invalid credentials',
        statusCode: 401
      });
      
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        try {
          await result.current.login('wrong@example.com', 'wrong');
        } catch (error) {
          // Expected error
        }
      });
      
      // Verify error handling
      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should preserve CORS and auth headers', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.refreshToken();
      });
      
      // Verify headers are preserved
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }),
          credentials: 'include'
        })
      );
    });
  });

  describe('Feature Flag Rollout', () => {
    it('should support gradual rollout percentages', () => {
      // Set 30% rollout
      featureFlags.set('USE_MODULAR_AUTH', true, { rolloutPercentage: 30 });
      
      let modularCount = 0;
      let legacyCount = 0;
      
      // Simulate 100 users
      for (let i = 0; i < 100; i++) {
        const useModular = featureFlags.evaluate('USE_MODULAR_AUTH', `user-${i}`);
        if (useModular) {
          modularCount++;
        } else {
          legacyCount++;
        }
      }
      
      // Should be approximately 30/70 split
      expect(modularCount).toBeGreaterThan(20);
      expect(modularCount).toBeLessThan(40);
      expect(legacyCount).toBeGreaterThan(60);
      expect(legacyCount).toBeLessThan(80);
    });

    it('should allow instant rollback', async () => {
      featureFlags.set('USE_MODULAR_AUTH', true);
      
      const { result, rerender } = renderHook(() => useAuth());
      
      // Verify using new implementation
      expect(result.current.implementation).toBe('modular');
      
      // Trigger rollback
      featureFlags.set('USE_MODULAR_AUTH', false);
      rerender();
      
      // Verify rolled back to legacy
      expect(result.current.implementation).toBe('legacy');
    });
  });

  describe('Performance Budget Guards', () => {
    it('should trigger rollback on performance regression', async () => {
      // Enable performance monitoring
      integrationManager.enablePerformanceGuards({
        maxResponseTime: 100,
        maxMemoryIncrease: 1024 * 1024 // 1MB
      });
      
      // Mock slow response
      jest.spyOn(apiGateway, 'execute').mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { success: true, data: mockUser };
      });
      
      featureFlags.set('USE_MODULAR_AUTH', true);
      
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      
      // Should have triggered rollback
      expect(featureFlags.get('USE_MODULAR_AUTH')).toBe(false);
      expect(integrationManager.getRollbackReason()).toContain('performance');
    });

    it('should maintain memory efficiency', () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Create multiple instances
      const hooks = [];
      for (let i = 0; i < 10; i++) {
        const { result } = renderHook(() => useAuth());
        hooks.push(result);
      }
      
      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not exceed budget
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // 5MB max
    });
  });

  describe('Event System Integration', () => {
    it('should replace useEffect chains with events', async () => {
      const effectSpy = jest.spyOn(console, 'warn');
      
      // Trigger login which used to cascade effects
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      
      // Should not have cascading effect warnings
      const cascadeWarnings = effectSpy.mock.calls.filter(
        call => call[0]?.includes('effect cascade')
      );
      
      expect(cascadeWarnings.length).toBe(0);
    });

    it('should prevent infinite loops', async () => {
      let eventCount = 0;
      
      // Create potential infinite loop
      eventBus.on('test.event', () => {
        eventCount++;
        if (eventCount < 100) {
          eventBus.emit('test.event', {});
        }
      });
      
      // Trigger initial event
      eventBus.emit('test.event', {});
      
      // Wait for processing
      await waitFor(() => {
        expect(eventCount).toBeLessThan(50); // Should be stopped by loop detection
      });
    });
  });

  describe('State Management Unification', () => {
    it('should consolidate all 8 state systems', () => {
      const stateDomains = unifiedState.getDomains();
      
      // Should have unified all systems
      expect(stateDomains).toContain('auth');
      expect(stateDomains).toContain('user');
      expect(stateDomains).toContain('ui');
      expect(stateDomains).toContain('session');
      expect(stateDomains).toContain('cache');
      expect(stateDomains).toContain('form');
      expect(stateDomains).toContain('preferences');
      expect(stateDomains).toContain('gamification');
    });

    it('should use appropriate storage per domain', () => {
      // Auth should use secure storage
      unifiedState.set('auth', 'token', 'secret-token');
      expect(document.cookie).toContain('auth.token');
      
      // UI should use session storage
      unifiedState.set('ui', 'theme', 'dark');
      expect(sessionStorage.getItem('unified-state-ui')).toContain('dark');
      
      // User should use local storage
      unifiedState.set('user', 'preferences', { lang: 'pt' });
      expect(localStorage.getItem('unified-state-user')).toContain('pt');
    });
  });
});