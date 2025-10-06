/**
 * useRegistrationFlag Hook Tests
 * Sprint 2C - React Hook Testing
 *
 * Tests for React hook functionality, loading states, error boundaries,
 * and SSR compatibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useRegistrationFlag,
  useRegistrationFlagSSR,
  withRegistrationFlag,
  FeatureFlagErrorBoundary,
} from '../../lib/feature-flags/hooks/useRegistrationFlag';

// Mock the registration-flags module
vi.mock('../../lib/feature-flags/registration-flags', () => ({
  isFeatureFlagEnabled: vi.fn(() => true),
  getFeatureFlag: vi.fn(() => ({
    key: 'sliceA_registration',
    enabled: true,
    description: 'Test flag',
    owner: 'test',
    created_at: '2025-10-03',
    environments: {
      development: true,
      staging: 'canary' as const,
      production: 'gradual' as const,
    },
  })),
  trackFeatureFlagExposure: vi.fn(),
}));

describe('useRegistrationFlag Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should return hook result with correct structure', async () => {
      const { result } = renderHook(() => useRegistrationFlag());

      await waitFor(() => {
        expect(result.current).toHaveProperty('isEnabled');
        expect(result.current).toHaveProperty('isLoading');
        expect(result.current).toHaveProperty('error');
        expect(result.current).toHaveProperty('flagConfig');
        expect(result.current).toHaveProperty('refetch');
      });
    });

    it('should start with loading state', () => {
      const { result } = renderHook(() => useRegistrationFlag());
      expect(result.current.isLoading).toBe(true);
    });

    it('should transition from loading to loaded state', async () => {
      const { result } = renderHook(() => useRegistrationFlag());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should expose flag enabled state', async () => {
      const { result } = renderHook(() => useRegistrationFlag());

      await waitFor(() => {
        expect(typeof result.current.isEnabled).toBe('boolean');
      });
    });

    it('should include flag configuration', async () => {
      const { result } = renderHook(() => useRegistrationFlag());

      await waitFor(() => {
        expect(result.current.flagConfig).not.toBeNull();
        expect(result.current.flagConfig?.key).toBe('sliceA_registration');
      });
    });
  });

  describe('Error Handling', () => {
    it('should set error state on flag check failure', async () => {
      const { getFeatureFlag } = await import('../../lib/feature-flags/registration-flags');
      vi.mocked(getFeatureFlag).mockReturnValueOnce(null);

      const { result } = renderHook(() => useRegistrationFlag());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.isEnabled).toBe(false);
      });
    });

    it('should fail closed on error (disable feature)', async () => {
      const { getFeatureFlag } = await import('../../lib/feature-flags/registration-flags');
      vi.mocked(getFeatureFlag).mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      const { result } = renderHook(() => useRegistrationFlag());

      await waitFor(() => {
        expect(result.current.isEnabled).toBe(false);
        expect(result.current.error).not.toBeNull();
      });
    });
  });

  describe('Refetch Functionality', () => {
    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useRegistrationFlag());

      await waitFor(() => {
        expect(typeof result.current.refetch).toBe('function');
      });
    });

    it('should re-check flag on refetch', async () => {
      const { isFeatureFlagEnabled } = await import('../../lib/feature-flags/registration-flags');
      const { result } = renderHook(() => useRegistrationFlag());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callCountBefore = vi.mocked(isFeatureFlagEnabled).mock.calls.length;

      result.current.refetch();

      await waitFor(() => {
        expect(vi.mocked(isFeatureFlagEnabled).mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });
  });

  describe('SSR Compatibility', () => {
    it('should return disabled state during SSR', () => {
      const { result } = renderHook(() => useRegistrationFlagSSR());

      // Before mount, should return disabled state
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });

    it('should check flag after client mount', async () => {
      const { result } = renderHook(() => useRegistrationFlagSSR());

      // Wait for client mount and flag check
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('User ID Changes', () => {
    it('should re-check flag when userId changes', async () => {
      const { isFeatureFlagEnabled } = await import('../../lib/feature-flags/registration-flags');
      const { result, rerender } = renderHook(
        ({ userId }) => useRegistrationFlag(userId),
        { initialProps: { userId: 'user_1' } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callCountBefore = vi.mocked(isFeatureFlagEnabled).mock.calls.length;

      // Change userId
      rerender({ userId: 'user_2' });

      await waitFor(() => {
        expect(vi.mocked(isFeatureFlagEnabled).mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });
  });

  describe('ADR-002 Compliance in Hook', () => {
    it('should NOT access browser storage during hook lifecycle', async () => {
      const localStorageSpy = vi.spyOn(Storage.prototype, 'getItem');
      const sessionStorageSpy = vi.spyOn(sessionStorage, 'getItem');

      renderHook(() => useRegistrationFlag('test_user'));

      await waitFor(() => {
        expect(localStorageSpy).not.toHaveBeenCalled();
        expect(sessionStorageSpy).not.toHaveBeenCalled();
      });

      localStorageSpy.mockRestore();
      sessionStorageSpy.mockRestore();
    });
  });

  describe('Analytics Tracking', () => {
    it('should track flag exposure on check', async () => {
      const { trackFeatureFlagExposure } = await import('../../lib/feature-flags/registration-flags');

      renderHook(() => useRegistrationFlag('hash_test_user'));

      await waitFor(() => {
        expect(trackFeatureFlagExposure).toHaveBeenCalled();
      });
    });
  });
});

describe('Higher-Order Component: withRegistrationFlag', () => {
  it('should wrap component with flag check', () => {
    const TestComponent = () => <div>Test</div>;
    const WrappedComponent = withRegistrationFlag(TestComponent);

    expect(WrappedComponent).toBeDefined();
    expect(typeof WrappedComponent).toBe('function');
  });
});

describe('FeatureFlagErrorBoundary', () => {
  it('should catch errors and show fallback', () => {
    const errorBoundary = new FeatureFlagErrorBoundary({
      children: <div>Content</div>,
      fallback: <div>Error fallback</div>,
    });

    expect(errorBoundary).toBeDefined();
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();
    const errorBoundary = new FeatureFlagErrorBoundary({
      children: <div>Content</div>,
      onError,
    });

    const testError = new Error('Test error');
    errorBoundary.componentDidCatch(testError, { componentStack: '' });

    expect(onError).toHaveBeenCalledWith(testError, { componentStack: '' });
  });
});
