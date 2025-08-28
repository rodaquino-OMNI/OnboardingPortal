/**
 * Regression Tests for Infinite Loop Prevention
 * Ensures previously identified infinite loop scenarios don't reoccur
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { UnifiedRegistrationForm } from '@/components/auth/UnifiedRegistrationForm';

// Mock dependencies
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

describe('Infinite Loop Regression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Issue #001: useAuth hook infinite loop', () => {
    test('REGRESSION: useAuth checkAuth should not cause infinite re-renders', async () => {
      const renderTracker = jest.fn();
      
      function TestComponent() {
        renderTracker();
        const auth = useAuth();
        
        // This specific pattern was causing infinite loops
        React.useEffect(() => {
          if (!auth.isAuthenticated && !auth.isLoading) {
            auth.checkAuth();
          }
        }, [auth.isAuthenticated, auth.isLoading]); // Previously this caused loops
        
        return <div data-testid="auth-status">{auth.isAuthenticated ? 'authenticated' : 'not authenticated'}</div>;
      }

      render(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should not exceed reasonable render count
      expect(renderTracker).toHaveBeenCalledTimes(2); // Initial + result (no loading state change)
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/maximum.*update.*depth.*exceeded/i)
      );
    });

    test('REGRESSION: Multiple concurrent checkAuth calls should not loop', async () => {
      const { result } = renderHook(() => useAuth());
      
      // This pattern was causing race conditions and loops
      await act(async () => {
        const promises = [
          result.current.checkAuth(),
          result.current.checkAuth(),
          result.current.checkAuth()
        ];
        
        await Promise.allSettled(promises);
      });

      expect(result.current.error).toBe(null);
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/loop|infinite/i));
    });
  });

  describe('Issue #002: Form setValue infinite loop', () => {
    test('REGRESSION: Email input should not cause setValue loops', async () => {
      const user = userEvent.setup();
      const renderTracker = jest.fn();
      
      function TestForm() {
        renderTracker();
        return <UnifiedRegistrationForm onSubmit={jest.fn()} />;
      }
      
      render(<TestForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      
      // This specific typing pattern was causing setValue loops
      await user.type(emailInput, 'test@example.com', { delay: 10 });
      
      await waitFor(() => {
        expect(emailInput).toHaveValue('test@example.com');
      });

      // Should not cause excessive re-renders
      expect(renderTracker).toHaveBeenCalledTimes(1); // Only initial render
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/too.*many.*re.*renders/i)
      );
    });

    test('REGRESSION: Password confirmation should not trigger loops', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm onSubmit={jest.fn()} />);
      
      // Fill password and confirmation
      const passwordInput = screen.getByLabelText(/^senha$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmar senha/i);
      
      // This pattern was causing formatting loops
      await user.type(passwordInput, 'securepass123', { delay: 5 });
      await user.type(confirmPasswordInput, 'securepass123', { delay: 5 });
      
      await waitFor(() => {
        expect(passwordInput).toHaveValue('securepass123');
        expect(confirmPasswordInput).toHaveValue('securepass123');
      });

      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/infinite.*loop/i));
    });
  });

  describe('Issue #003: Step navigation loop', () => {
    test('REGRESSION: Form validation should not cause navigation loops', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm onSubmit={jest.fn()} />);
      
      // Try to submit without filling required fields - this was causing loops
      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      
      // Multiple rapid clicks that previously caused loops
      await act(async () => {
        await user.click(submitButton);
        await user.click(submitButton);
        await user.click(submitButton);
        await user.click(submitButton);
        await user.click(submitButton);
      });
      
      // Should show validation errors without loops
      expect(screen.getByText(/nome é obrigatório/i)).toBeInTheDocument();
      expect(screen.getByText(/email é obrigatório/i)).toBeInTheDocument();
      
      // Should not cause infinite loops
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/maximum.*update.*depth|too.*many.*re.*renders/i)
      );
    });

    test('REGRESSION: Form state updates should not loop with rapid changes', async () => {
      const user = userEvent.setup();
      render(<UnifiedRegistrationForm onSubmit={jest.fn()} />);
      
      // Fill and change fields rapidly - this pattern caused loops
      const nameInput = screen.getByLabelText(/nome completo/i);
      const emailInput = screen.getByLabelText(/email/i);
      
      for (let i = 0; i < 5; i++) {
        await user.clear(nameInput);
        await user.type(nameInput, `User ${i}`);
        await user.clear(emailInput);
        await user.type(emailInput, `user${i}@example.com`);
      }
      
      // Should stabilize with final values
      await waitFor(() => {
        expect(nameInput).toHaveValue('User 4');
        expect(emailInput).toHaveValue('user4@example.com');
      });
      
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/loop|infinite/i));
    });
  });

  describe('Issue #004: Async state update loops', () => {
    test('REGRESSION: Async operations should not cause state update loops', async () => {
      const { result } = renderHook(() => useAuth());
      
      // This pattern of rapid async calls was causing loops
      await act(async () => {
        const promises = Array.from({ length: 10 }, (_, i) => 
          result.current.login({ 
            email: `test${i}@example.com`, 
            password: 'password' 
          })
        );
        
        await Promise.allSettled(promises);
      });
      
      // Should stabilize without loops
      expect(result.current.isLoading).toBe(false);
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/update.*depth.*exceeded/i)
      );
    });

    test('REGRESSION: Request cancellation should prevent loops', async () => {
      const { result } = renderHook(() => useAuth());
      
      // Start multiple requests and cancel them - this was causing loops
      await act(async () => {
        // Start requests
        result.current.login({ email: 'test1@example.com', password: 'pass' });
        result.current.login({ email: 'test2@example.com', password: 'pass' });
        result.current.checkAuth();
        
        // Cancel all
        result.current.cancelAllRequests();
      });
      
      // Should not cause memory leaks or loops
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/memory.*leak|infinite/i));
    });
  });

  describe('Issue #005: Effect dependency loops', () => {
    test('REGRESSION: useEffect with object dependencies should not loop', async () => {
      const effectTracker = jest.fn();
      
      function TestComponent() {
        const auth = useAuth();
        const [config] = React.useState({ theme: 'light', lang: 'pt' });
        
        // This dependency pattern was causing loops
        React.useEffect(() => {
          effectTracker();
          if (auth.user && config.theme) {
            // Some operation based on user and config
            console.log('User config updated');
          }
        }, [auth.user, config]); // Object in dependency array
        
        return <div>Test Component</div>;
      }
      
      render(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Component')).toBeInTheDocument();
      });
      
      // Effect should run reasonable number of times
      expect(effectTracker).toHaveBeenCalledTimes(1);
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/infinite.*loop/i));
    });

    test('REGRESSION: Nested state updates should not cause loops', async () => {
      const StateComponent = () => {
        const [count, setCount] = React.useState(0);
        const [derived, setDerived] = React.useState(0);
        const [final, setFinal] = React.useState(0);
        
        // This cascading pattern was causing loops
        React.useEffect(() => {
          if (count > 0) {
            setDerived(count * 2);
          }
        }, [count]);
        
        React.useEffect(() => {
          if (derived > 0) {
            setFinal(derived + 1);
          }
        }, [derived]);
        
        // This could potentially cause loops if not handled correctly
        React.useEffect(() => {
          if (final > 0 && final < 10) {
            setCount(prev => prev + 1);
          }
        }, [final]);
        
        return (
          <div>
            <button onClick={() => setCount(1)}>Start</button>
            <div data-testid="final">{final}</div>
          </div>
        );
      };
      
      const user = userEvent.setup();
      render(<StateComponent />);
      
      await user.click(screen.getByText('Start'));
      
      await waitFor(() => {
        const finalValue = parseInt(screen.getByTestId('final').textContent || '0');
        expect(finalValue).toBeGreaterThan(0);
        expect(finalValue).toBeLessThan(20); // Should stabilize
      }, { timeout: 3000 });
      
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/maximum.*update.*depth/i)
      );
    });
  });

  describe('Performance Regression Tests', () => {
    test('REGRESSION: Component render time should not degrade', async () => {
      const renderTimes: number[] = [];
      
      function TimedComponent() {
        const startTime = React.useRef(performance.now());
        
        React.useEffect(() => {
          const endTime = performance.now();
          renderTimes.push(endTime - startTime.current);
        });
        
        return <UnifiedRegistrationForm onSubmit={jest.fn()} />;
      }
      
      // Render multiple times to check for performance degradation
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<TimedComponent />);
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
        });
        unmount();
      }
      
      // Render times should not increase significantly (no memory leaks)
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      expect(avgRenderTime).toBeLessThan(500); // 500ms average render time
      
      // Last render should not be significantly slower than first
      const firstRender = renderTimes[0];
      const lastRender = renderTimes[renderTimes.length - 1];
      expect(lastRender).toBeLessThan(firstRender * 2); // Not more than 2x slower
    });

    test('REGRESSION: Memory usage should not grow with repeated operations', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const user = userEvent.setup();
      
      // Perform repeated operations that previously caused memory leaks
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<UnifiedRegistrationForm onSubmit={jest.fn()} />);
        
        // Simulate user interactions
        await user.type(screen.getByLabelText(/nome completo/i), `User ${i}`);
        await user.type(screen.getByLabelText(/email/i), `user${i}@example.com`);
        
        unmount();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        const maxAcceptableGrowth = 5 * 1024 * 1024; // 5MB
        
        expect(memoryGrowth).toBeLessThan(maxAcceptableGrowth);
      }
    });
  });
});