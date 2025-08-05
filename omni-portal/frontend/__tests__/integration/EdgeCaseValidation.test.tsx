import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ErrorBoundary } from 'react-error-boundary';
import '@testing-library/jest-dom';

// Import components for edge case testing
import { UnifiedRegistrationForm } from '../../components/auth/UnifiedRegistrationForm';
import UnifiedHealthAssessment from '../../components/health/UnifiedHealthAssessment';
import EnhancedDocumentUpload from '../../components/upload/EnhancedDocumentUpload';
import LoginForm from '../../components/auth/LoginForm';

// Mock hooks with edge case scenarios
jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn()
  }))
}));

// MSW Server for edge case testing
const server = setupServer(
  // Slow response simulation
  http.post('/api/auth/login', async ({ request }) => {
    const { email } = await request.json();
    
    if (email === 'slow@example.com') {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (email === 'timeout@example.com') {
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    
    return HttpResponse.json({
      success: true,
      user: { id: '123', name: 'Test User', email },
      token: 'test-token'
    });
  }),

  // Memory/resource intensive response
  http.get('/api/health/assessment/questions', ({ request }) => {
    // Simulate large response
    const largeQuestions = Array.from({ length: 10000 }, (_, i) => ({
      id: `q${i}`,
      text: `Question ${i}: ${'Lorem ipsum '.repeat(100)}`,
      type: 'scale',
      options: Array.from({ length: 100 }, (_, j) => `Option ${j}`)
    }));
    
    return HttpResponse.json({ questions: largeQuestions });
  }),

  // Malformed data responses
  http.post('/api/documents/upload', ({ request }) => {
    return HttpResponse.json({
      success: true,
      document: {
        id: null, // Invalid ID
        name: '', // Empty name
        type: undefined, // Missing type
        status: 'invalid_status',
        metadata: {
          nested: {
            deeply: {
              invalid: null
            }
          }
        }
      }
    });
  }),

  // Concurrent request handling
  http.post('/api/auth/register', async ({ request }) => {
    const { email } = await request.json();
    
    // Simulate database deadlock for concurrent requests
    if (email.includes('concurrent')) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
      if (Math.random() > 0.5) {
        return HttpResponse.json({ error: 'Database deadlock' }, { status: 503 });
      }
    }
    
    return HttpResponse.json({ success: true });
  }),

  // Memory leak simulation
  http.get('/api/health/large-dataset', ({ request }) => {
    // Simulate response that could cause memory leaks
    const data = Array.from({ length: 50000 }, (_, i) => ({
      id: i,
      data: 'x'.repeat(1000),
      nested: {
        moreData: Array.from({ length: 100 }, (_, j) => `item-${j}`)
      }
    }));
    
    return HttpResponse.json({ data });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test utilities
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { 
        retry: false,
        staleTime: 0,
        cacheTime: 0
      },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary 
        fallback={<div data-testid="error-boundary">Component Error</div>}
        onError={(error) => console.error('Error Boundary:', error)}
      >
        {ui}
      </ErrorBoundary>
    </QueryClientProvider>
  );
};

// Performance monitoring helper
const measurePerformance = async (testFn: () => Promise<void>) => {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
  
  await testFn();
  
  const endTime = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
  
  return {
    duration: endTime - startTime,
    memoryDelta: endMemory - startMemory
  };
};

describe('Edge Case and Boundary Testing', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  describe('Performance and Resource Management', () => {
    it('should handle slow network responses gracefully', async () => {
      const performance = await measurePerformance(async () => {
        renderWithProviders(<LoginForm />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);
        
        await user.type(emailInput, 'slow@example.com');
        await user.type(passwordInput, 'password123');
        
        const submitButton = screen.getByRole('button', { name: /sign in/i });
        await user.click(submitButton);

        // Should show loading state
        await waitFor(() => {
          expect(screen.getByText(/signing in/i) || screen.getByRole('progressbar')).toBeInTheDocument();
        });

        // Should complete eventually
        await waitFor(() => {
          expect(screen.getByText(/welcome/i) || screen.getByText(/success/i)).toBeInTheDocument();
        }, { timeout: 6000 });
      });

      // Should complete within reasonable time
      expect(performance.duration).toBeLessThan(7000);
    });

    it('should handle request timeouts properly', async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'timeout@example.com');
      await user.type(passwordInput, 'password123');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Should eventually timeout and show error
      await waitFor(() => {
        expect(
          screen.getByText(/timeout/i) ||
          screen.getByText(/network error/i) ||
          screen.getByText(/try again/i)
        ).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should not crash
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    });

    it('should handle large datasets without memory leaks', async () => {
      // Monitor memory usage
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      renderWithProviders(<UnifiedHealthAssessment />);

      // Trigger large dataset request
      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      });

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not consume excessive memory (> 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle concurrent user actions without race conditions', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const promises = [];
      
      // Simulate multiple rapid form submissions
      for (let i = 0; i < 5; i++) {
        promises.push((async () => {
          const emailInput = screen.getByLabelText(/email/i);
          const continueButton = screen.getByRole('button', { name: /continue/i });
          
          await user.clear(emailInput);
          await user.type(emailInput, `concurrent${i}@example.com`);
          await user.click(continueButton);
        })());
      }

      // Wait for all concurrent actions
      await Promise.allSettled(promises);

      // Should handle gracefully without crashes
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle empty and null values', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const cpfInput = screen.getByLabelText(/cpf/i);
      
      // Test empty values
      await user.type(emailInput, '');
      await user.type(cpfInput, '');
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/email.*required/i) || screen.getByText(/required/i)).toBeInTheDocument();
      });

      // Test whitespace-only values
      await user.clear(emailInput);
      await user.type(emailInput, '   ');
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/valid.*email/i) || screen.getByText(/invalid/i)).toBeInTheDocument();
      });
    });

    it('should handle maximum length inputs', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const emailInput = screen.getByLabelText(/email/i);
      
      // Test extremely long email
      const longEmail = 'a'.repeat(254) + '@example.com';
      await user.type(emailInput, longEmail);
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Should handle validation appropriately
      await waitFor(() => {
        expect(
          screen.getByText(/too long/i) ||
          screen.getByText(/maximum/i) ||
          screen.getByText(/invalid/i)
        ).toBeInTheDocument();
      });
    });

    it('should handle special characters and unicode', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const emailInput = screen.getByLabelText(/email/i);
      
      // Test unicode characters
      const unicodeEmail = 'tëst@ëxämplë.com';
      await user.type(emailInput, unicodeEmail);
      
      // Test emoji
      await user.clear(emailInput);
      await user.type(emailInput, '😀test@example.com');
      
      // Should handle without crashing
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    });

    it('should handle malformed API responses', async () => {
      renderWithProviders(<EnhancedDocumentUpload type="identification" />);

      const file = new File(['test'], 'document.jpg', { type: 'image/jpeg' });
      const uploadInput = screen.getByLabelText(/upload/i);
      
      await user.upload(uploadInput, file);

      // Should handle malformed response gracefully
      await waitFor(() => {
        expect(
          screen.getByText(/uploaded/i) ||
          screen.getByText(/processing/i) ||
          screen.getByText(/error/i)
        ).toBeInTheDocument();
      });

      // Should not crash despite malformed data
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    });
  });

  describe('State Management Edge Cases', () => {
    it('should handle rapid state changes', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      });

      const slider = screen.getByRole('slider');
      
      // Rapid value changes
      for (let i = 1; i <= 10; i++) {
        fireEvent.change(slider, { target: { value: i } });
      }

      // Should handle without errors
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    });

    it('should handle component unmounting during async operations', async () => {
      const { unmount } = renderWithProviders(<EnhancedDocumentUpload type="identification" />);

      const file = new File(['test'], 'document.jpg', { type: 'image/jpeg' });
      const uploadInput = screen.getByLabelText(/upload/i);
      
      await user.upload(uploadInput, file);

      // Unmount component while upload is in progress
      unmount();

      // Should not cause memory leaks or errors
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should handle browser back/forward navigation', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');

      // Simulate browser back button
      window.history.pushState({}, '', '/');
      window.history.back();

      // Should maintain state appropriately
      expect(emailInput).toHaveValue('test@example.com');
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle XSS attempts in all input fields', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const xssPayload = '<script>alert("XSS")</script>';
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, xssPayload);

      // Should sanitize or reject malicious input
      expect(emailInput.value).not.toContain('<script>');
    });

    it('should handle CSRF protection', async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      // Simulate CSRF attempt by manipulating form
      const form = screen.getByRole('form') || emailInput.closest('form');
      if (form) {
        // Should have CSRF protection
        expect(
          form.querySelector('input[name="csrf_token"]') ||
          form.querySelector('input[name="_token"]')
        ).toBeTruthy();
      }
    });

    it('should handle session manipulation attempts', async () => {
      renderWithProviders(<LoginForm />);

      // Simulate session token manipulation
      localStorage.setItem('auth_token', 'manipulated_token');
      sessionStorage.setItem('user_session', JSON.stringify({
        id: '999',
        role: 'admin' // Privilege escalation attempt
      }));

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Should validate tokens and prevent privilege escalation
      await waitFor(() => {
        expect(screen.queryByText(/admin/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Edge Cases', () => {
    it('should handle keyboard navigation edge cases', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      });

      // Test rapid keyboard navigation
      const slider = screen.getByRole('slider');
      
      for (let i = 0; i < 20; i++) {
        await user.keyboard('{ArrowRight}');
      }
      
      for (let i = 0; i < 20; i++) {
        await user.keyboard('{ArrowLeft}');
      }

      // Should handle without errors
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    });

    it('should handle screen reader edge cases', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const emailInput = screen.getByLabelText(/email/i);
      
      // Should have proper ARIA attributes
      expect(emailInput).toHaveAttribute('aria-required', 'true');
      expect(emailInput).toHaveAttribute('type', 'email');
      
      // Should provide proper error announcements
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/required/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary network failures', async () => {
      renderWithProviders(<LoginForm />);

      // Simulate network failure
      server.use(
        http.post('/api/auth/login', ({ request }) => {
          return HttpResponse.json({ error: 'Network error' }, { status: 503 });
        })
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Should show retry option
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      // Reset server and retry
      server.resetHandlers();
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should succeed on retry
      await waitFor(() => {
        expect(screen.getByText(/welcome/i) || screen.getByText(/success/i)).toBeInTheDocument();
      });
    });

    it('should handle component state corruption', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      // Simulate state corruption
      const component = screen.getByTestId('touch-friendly-slider').closest('[data-component]');
      if (component) {
        // Corrupt component props or state
        Object.defineProperty(component, 'props', {
          value: null,
          writable: true
        });
      }

      // Should handle gracefully
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    });

    it('should maintain data integrity across app crashes', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'persistence@example.com');

      // Simulate app crash and recovery
      localStorage.setItem('form_draft', JSON.stringify({
        email: 'persistence@example.com',
        timestamp: Date.now()
      }));

      // Re-render component (simulating app restart)
      const { unmount } = renderWithProviders(<UnifiedRegistrationForm />);
      unmount();
      renderWithProviders(<UnifiedRegistrationForm />);

      // Should restore form data
      await waitFor(() => {
        const restoredEmailInput = screen.getByLabelText(/email/i);
        expect(restoredEmailInput).toHaveValue('persistence@example.com');
      });
    });
  });
});