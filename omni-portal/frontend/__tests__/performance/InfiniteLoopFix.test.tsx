/**
 * Infinite Loop Fix Validation Tests
 * CRITICAL: Tests to ensure the React infinite loop fix works properly
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { useAuth, useAuthWithCleanup } from '@/hooks/useAuth';
import { UnifiedRegistrationForm } from '@/components/auth/UnifiedRegistrationForm';
import { performanceMonitor } from '@/lib/performance-monitor';

// Mock the API to prevent actual network calls
jest.mock('@/lib/api/unified-auth', () => ({
  unifiedAuthApi: {
    registerStep1: jest.fn(() => Promise.resolve({ token: 'test-token' })),
    registerStep2: jest.fn(() => Promise.resolve({ success: true })),
    registerStep3: jest.fn(() => Promise.resolve({ success: true, token: 'final-token' })),
  }
}));

jest.mock('@/lib/api/auth', () => ({
  authApi: {
    login: jest.fn(() => Promise.resolve({ user: { id: 1, name: 'Test' }, token: 'test' })),
    register: jest.fn(() => Promise.resolve({ user: { id: 1, name: 'Test' }, token: 'test' })),
    getProfile: jest.fn(() => Promise.resolve({ id: 1, name: 'Test' })),
    logout: jest.fn(() => Promise.resolve()),
    getSocialRedirect: jest.fn(() => Promise.resolve({ url: 'https://oauth.test' }))
  }
}));

// Mock performance monitoring
const mockStartTiming = jest.fn(() => jest.fn());
jest.mock('@/lib/performance-monitor', () => ({
  performanceMonitor: {
    startTiming: mockStartTiming,
    recordComponentTiming: jest.fn(),
    clearMetrics: jest.fn(),
    getMetrics: jest.fn(() => []),
  },
  usePerformanceMonitor: jest.fn(() => ({ startTiming: mockStartTiming }))
}));

describe('Infinite Loop Fix Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    performanceMonitor.clearMetrics();
    
    // Mock console methods to track warnings/errors
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Unit Tests - Infinite Loop Scenarios', () => {
    test('should prevent infinite loop in useAuth hook with request cancellation', async () => {
      const renderCount = jest.fn();
      
      function TestComponent() {
        renderCount();
        const auth = useAuth();
        
        // This would previously cause infinite loops
        React.useEffect(() => {
          auth.checkAuth();
        }, [auth]); // Intentionally missing dependencies to test fix
        
        return <div data-testid="test-component">Auth Status: {auth.isAuthenticated ? 'true' : 'false'}</div>;
      }

      render(<TestComponent />);
      
      // Wait for any async operations
      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should not render more than reasonable times (allowing for initial render + effect)
      expect(renderCount).toHaveBeenCalledTimes(3); // Initial + effect + state update
      expect(console.warn).not.toHaveBeenCalledWith(expect.stringMatching(/infinite.*loop/i));
    });

    test('should handle rapid sequential state updates without infinite loops', async () => {
      const { result } = renderHook(() => useAuth());
      
      const startTime = performance.now();
      
      // Simulate rapid state changes that could cause loops
      await act(async () => {
        // Fire multiple login attempts rapidly
        const promises = Array.from({ length: 5 }, () => 
          result.current.login({ email: 'test@test.com', password: 'password' })
        );
        
        await Promise.allSettled(promises);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (not infinite loop)
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(result.current.isLoading).toBe(false);
    });

    test('should properly cancel requests to prevent memory leaks and loops', async () => {
      const { result } = renderHook(() => useAuthWithCleanup());
      
      // Start a request
      await act(async () => {
        result.current.checkAuth();
      });
      
      // Cancel all requests
      await act(async () => {
        result.current.cancelAllRequests();
      });
      
      // Verify no hanging promises or loops
      expect(result.current.isLoading).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
    });

    test('should handle form state updates without triggering re-render loops', async () => {
      const renderCount = jest.fn();
      
      function FormWrapper() {
        renderCount();
        return <UnifiedRegistrationForm />;
      }

      const user = userEvent.setup();
      render(<FormWrapper />);
      
      // Simulate rapid form interactions
      const nameInput = screen.getByLabelText(/nome completo/i);
      
      await act(async () => {
        // Type quickly to test for loops
        await user.type(nameInput, 'Test User', { delay: 1 });
      });
      
      // Should not cause excessive re-renders
      expect(renderCount).toHaveBeenCalledTimes(1); // Only initial render
      expect(console.warn).not.toHaveBeenCalledWith(expect.stringMatching(/re.*render/i));
    });
  });

  describe('2. Integration Tests - Component Interaction', () => {
    test('should handle step navigation without infinite loops', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm />);
      
      const startTime = performance.now();
      
      // Fill first step
      await user.type(screen.getByLabelText(/nome completo/i), 'Test User');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.click(screen.getByLabelText(/aceito o tratamento/i));
      
      // Navigate to next step
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/detalhes do perfil/i)).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete quickly
    });

    test('should handle form validation without causing loops', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm />);
      
      // Try to proceed without filling required fields
      const nextButton = screen.getByRole('button', { name: /próximo/i });
      
      // Click multiple times rapidly
      await act(async () => {
        await user.click(nextButton);
        await user.click(nextButton);
        await user.click(nextButton);
      });
      
      // Should show validation errors without loops
      expect(screen.getByText(/nome deve ter pelo menos/i)).toBeInTheDocument();
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/maximum.*update.*depth/i));
    });

    test('should handle async operations without blocking UI', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm />);
      
      // Fill form rapidly while async operations occur
      await user.type(screen.getByLabelText(/nome completo/i), 'Test User');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      
      // Multiple rapid interactions
      const checkbox = screen.getByLabelText(/aceito o tratamento/i);
      await act(async () => {
        await user.click(checkbox);
        await user.click(checkbox);
        await user.click(checkbox);
      });
      
      // UI should remain responsive
      expect(checkbox).toBeChecked();
      expect(screen.getByLabelText(/nome completo/i)).toHaveValue('Test User');
    });
  });

  describe('3. Performance Tests - Re-render Detection', () => {
    test('should not exceed render budget per component', async () => {
      let renderCount = 0;
      const MAX_RENDERS = 10;
      
      function MonitoredComponent() {
        renderCount++;
        
        if (renderCount > MAX_RENDERS) {
          throw new Error(`Component exceeded render budget: ${renderCount} renders`);
        }
        
        const auth = useAuth();
        
        React.useEffect(() => {
          // Simulate common patterns that might cause loops
          if (!auth.isAuthenticated) {
            auth.checkAuth();
          }
        }, [auth.isAuthenticated]); // Fixed dependency array
        
        return <div>Renders: {renderCount}</div>;
      }
      
      expect(() => {
        render(<MonitoredComponent />);
      }).not.toThrow();
      
      await waitFor(() => {
        expect(renderCount).toBeLessThan(MAX_RENDERS);
      });
    });

    test('should complete operations within performance budget', async () => {
      const PERFORMANCE_BUDGET = 100; // 100ms
      
      const startTime = performance.now();
      
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm />);
      
      // Perform typical user interactions
      await user.type(screen.getByLabelText(/nome completo/i), 'Performance Test');
      await user.type(screen.getByLabelText(/email/i), 'perf@test.com');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_BUDGET);
    });

    test('should not trigger performance warnings', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm />);
      
      // Simulate intensive form interactions
      const nameInput = screen.getByLabelText(/nome completo/i);
      
      await act(async () => {
        // Rapid typing that previously might cause performance issues
        for (let i = 0; i < 50; i++) {
          await user.type(nameInput, 'a', { delay: 1 });
        }
      });
      
      // No performance warnings should be logged
      expect(console.warn).not.toHaveBeenCalledWith(expect.stringMatching(/slow.*render/i));
    });
  });

  describe('4. Regression Tests - Previous Issues', () => {
    test('should not regress on setValue infinite loop fix', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm />);
      
      const cpfInput = screen.getByLabelText(/cpf/i);
      
      // This pattern previously caused infinite loops with setValue
      await user.type(cpfInput, '12345678901');
      
      await waitFor(() => {
        expect(cpfInput).toHaveValue('123.456.789-01'); // Formatted
      });
      
      // Should not cause infinite loops
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/maximum.*update/i));
    });

    test('should handle useEffect dependency arrays correctly', async () => {
      const effectCount = jest.fn();
      
      function TestComponent() {
        const auth = useAuth();
        
        // Previously problematic pattern
        React.useEffect(() => {
          effectCount();
          if (auth.user) {
            // Some operation that might trigger re-render
            auth.addPoints(10);
          }
        }, [auth]); // This was causing loops before fix
        
        return <div>Effect count: {effectCount.calls.length}</div>;
      }
      
      render(<TestComponent />);
      
      await waitFor(() => {
        expect(effectCount).toHaveBeenCalledTimes(1); // Should only run once
      });
    });

    test('should handle form submission without state update loops', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm />);
      
      // Fill complete form
      await user.type(screen.getByLabelText(/nome completo/i), 'Test User');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.click(screen.getByLabelText(/aceito o tratamento/i));
      
      // Go to next step
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/detalhes do perfil/i)).toBeInTheDocument();
      });
      
      // Form submission should not cause loops
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/too many.*re.*renders/i));
    });
  });

  describe('5. Memory Leak Prevention', () => {
    test('should cleanup request handlers on unmount', async () => {
      const { unmount } = render(<UnifiedRegistrationForm />);
      
      // Simulate pending requests
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/nome completo/i), 'Test');
      
      // Unmount component
      unmount();
      
      // Should not cause memory leaks or console errors
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/memory.*leak/i));
    });

    test('should cancel ongoing requests on component unmount', async () => {
      const { result, unmount } = renderHook(() => useAuthWithCleanup());
      
      // Start a request
      await act(async () => {
        result.current.login({ email: 'test@test.com', password: 'pass' });
      });
      
      // Unmount should cleanup
      unmount();
      
      // No hanging promises or errors
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('6. Error Boundary Tests', () => {
    test('should handle errors without causing infinite error loops', async () => {
      const ErrorComponent = () => {
        const [hasError, setHasError] = React.useState(false);
        
        if (hasError) {
          throw new Error('Test error');
        }
        
        return (
          <button onClick={() => setHasError(true)}>
            Trigger Error
          </button>
        );
      };
      
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <ErrorComponent />
        </React.StrictMode>
      );
      
      // This should not cause infinite error loops
      await user.click(screen.getByText('Trigger Error'));
      
      // Error should be contained
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});