import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';

/**
 * INTEGRATION TEST TEMPLATE: User Registration Flow
 * 
 * This template demonstrates best practices for integration testing:
 * - Real component rendering (no mocking)
 * - API mocking with MSW (Mock Service Worker)
 * - Complete user journey testing
 * - Proper async handling
 * - AAA pattern (Arrange-Act-Assert)
 * - Accessibility testing
 * - Error scenario coverage
 */

describe('User Registration Integration Flow', () => {
  // Setup MSW server for API mocking
  const server = setupServer(
    // Mock registration endpoint
    http.post('/api/auth/register', async ({ request }) => {
      const body = await request.json();
      
      // Validate request
      if (!body.email || !body.password) {
        return HttpResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      // Check for existing user
      if (body.email === 'existing@example.com') {
        return HttpResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
      
      // Success response
      return HttpResponse.json({
          user: {
            id: '123',
            email: body.email,
            name: body.name,
          },
          token: 'fake-jwt-token'
        }, { status: 201 });
    }),
    
    // Mock email verification
    http.post('/api/auth/verify-email', ({ request }) => {
      return HttpResponse.json({ verified: true });
    }),
    
    // Mock social auth
    http.post('/api/auth/social/:provider', ({ request }) => {
      const { provider } = params;
      return HttpResponse.json({
          user: { id: '124', email: `user@${provider}.com` },
          token: 'social-auth-token'
        });
    }),
  );

  // Test utilities
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    user = userEvent.setup();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  // Helper function to render with providers
  const renderWithProviders = (initialRoute = '/register') => {
    window.history.pushState({}, '', initialRoute);
    
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Successful Registration Flow', () => {
    it('should complete multi-step registration successfully', async () => {
      // Arrange
      renderWithProviders();
      
      // Act & Assert - Step 1: Basic Information
      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      
      // Check password strength indicator
      expect(screen.getByText(/strong password/i)).toBeInTheDocument();
      
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Step 2: Personal Information
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /personal information/i })).toBeInTheDocument();
      });
      
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      await user.type(screen.getByLabelText(/phone/i), '(11) 98765-4321');
      await user.selectOptions(screen.getByLabelText(/gender/i), 'male');
      
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Step 3: Terms and Consent
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /terms and conditions/i })).toBeInTheDocument();
      });
      
      // LGPD consent
      await user.click(screen.getByRole('checkbox', { name: /i agree to the terms/i }));
      await user.click(screen.getByRole('checkbox', { name: /i consent to data processing/i }));
      
      await user.click(screen.getByRole('button', { name: /create account/i }));
      
      // Verify success
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome/i })).toBeInTheDocument();
        expect(screen.getByText(/verification email sent/i)).toBeInTheDocument();
      });
      
      // Verify user is logged in
      expect(localStorage.getItem('auth-token')).toBe('fake-jwt-token');
    });

    it('should handle social authentication', async () => {
      // Arrange
      renderWithProviders();
      
      // Act - Click Google sign up
      await user.click(screen.getByRole('button', { name: /sign up with google/i }));
      
      // Assert - Should redirect to dashboard after social auth
      await waitFor(() => {
        expect(window.location.pathname).toBe('/dashboard');
      });
    });
  });

  describe('Validation and Error Handling', () => {
    it('should validate email format', async () => {
      // Arrange
      renderWithProviders();
      
      // Act
      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.tab(); // Trigger blur event
      
      // Assert
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });

    it('should validate password requirements', async () => {
      // Arrange
      renderWithProviders();
      
      // Act - Weak password
      await user.type(screen.getByLabelText(/^password$/i), 'weak');
      
      // Assert
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/weak password/i)).toBeInTheDocument();
    });

    it('should handle duplicate email registration', async () => {
      // Arrange
      renderWithProviders();
      
      // Act
      await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/email already registered/i);
      });
    });

    it('should handle network errors gracefully', async () => {
      // Arrange - Override handler to simulate network error
      server.use(
        http.post('/api/auth/register', ({ request }) => {
          return res.networkError('Failed to connect');
        })
      );
      
      renderWithProviders();
      
      // Complete form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Navigate through steps...
      // (abbreviated for template)
      
      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and State Management', () => {
    it('should maintain form state when navigating between steps', async () => {
      // Arrange
      renderWithProviders();
      
      // Act - Fill step 1
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Go to step 2
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /personal information/i })).toBeInTheDocument();
      });
      
      // Go back to step 1
      await user.click(screen.getByRole('button', { name: /back/i }));
      
      // Assert - Email should still be filled
      expect(screen.getByLabelText(/email/i)).toHaveValue('test@example.com');
    });

    it('should prevent navigation with unsaved changes', async () => {
      // Arrange
      renderWithProviders();
      
      // Act - Start filling form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      
      // Try to navigate away
      await user.click(screen.getByRole('link', { name: /login/i }));
      
      // Assert - Should show confirmation dialog
      expect(screen.getByRole('dialog')).toHaveTextContent(/unsaved changes/i);
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      // Arrange
      renderWithProviders();
      
      // Act - Navigate with keyboard
      await user.tab(); // Focus email field
      expect(screen.getByLabelText(/email/i)).toHaveFocus();
      
      await user.tab(); // Focus password field
      expect(screen.getByLabelText(/password/i)).toHaveFocus();
      
      await user.tab(); // Focus confirm password
      expect(screen.getByLabelText(/confirm password/i)).toHaveFocus();
      
      await user.tab(); // Focus next button
      expect(screen.getByRole('button', { name: /next/i })).toHaveFocus();
    });

    it('should announce errors to screen readers', async () => {
      // Arrange
      renderWithProviders();
      
      // Act - Submit empty form
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Assert - Errors should be in alert role
      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(2); // Email and password errors
        expect(alerts[0]).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should have proper ARIA labels', () => {
      // Arrange
      renderWithProviders();
      
      // Assert
      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Registration form');
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-describedby', expect.stringContaining('password-requirements'));
    });
  });

  describe('Performance', () => {
    it('should render registration form within performance budget', () => {
      // Arrange
      const start = performance.now();
      
      // Act
      renderWithProviders();
      
      // Assert
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // 100ms budget
    });

    it('should handle rapid form submissions', async () => {
      // Arrange
      renderWithProviders();
      let submissionCount = 0;
      
      server.use(
        http.post('/api/auth/register', ({ request }) => {
          submissionCount++;
          return HttpResponse.json({ success: true });
        })
      );
      
      // Act - Rapid clicks
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      const submitButton = screen.getByRole('button', { name: /next/i });
      
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);
      
      // Assert - Should only submit once
      await waitFor(() => {
        expect(submissionCount).toBe(1);
      });
    });
  });

  describe('Data Persistence', () => {
    it('should save form progress to localStorage', async () => {
      // Arrange
      renderWithProviders();
      
      // Act
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
      
      // Assert
      const savedData = JSON.parse(localStorage.getItem('registration-progress') || '{}');
      expect(savedData.email).toBe('test@example.com');
      expect(savedData.password).toBeUndefined(); // Password should not be saved
    });

    it('should restore form progress on return', async () => {
      // Arrange - Set saved progress
      localStorage.setItem('registration-progress', JSON.stringify({
        email: 'saved@example.com',
        currentStep: 1
      }));
      
      // Act
      renderWithProviders();
      
      // Assert
      expect(screen.getByLabelText(/email/i)).toHaveValue('saved@example.com');
    });
  });
});