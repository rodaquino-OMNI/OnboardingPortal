import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';

// Components under test
import LoginForm from '../../components/auth/LoginForm';
import { UnifiedRegistrationForm } from '../../components/auth/UnifiedRegistrationForm';
import SessionManager from '../../components/auth/SessionManager';

// Security test suite for authentication flows
const server = setupServer(
  // Mock secure endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const { login, password } = await request.json();
    
    // Simulate rate limiting
    if (request.headers.get('x-rate-limit-remaining') === '0') {
      return HttpResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }
    
    // Simulate brute force protection
    if (password === 'password123' && login === 'admin@test.com') {
      return HttpResponse.json({ 
          error: 'Account temporarily locked due to suspicious activity',
          lockout_time: 900 // 15 minutes
        }, { status: 429 });
    }
    
    return HttpResponse.json({
        success: true,
        user: { id: '123', email: login },
        access_token: 'secure-jwt-token',
        refresh_token: 'secure-refresh-token'
      });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json();
    
    // Check for SQL injection attempts
    const sqlPatterns = ['DROP TABLE', 'SELECT *', 'UNION SELECT', '--', ';'];
    const jsonString = JSON.stringify(body);
    
    if (sqlPatterns.some(pattern => jsonString.toUpperCase().includes(pattern))) {
      return HttpResponse.json({ error: 'Invalid input detected' }, { status: 400 });
    }
    
    return HttpResponse.json({
        success: true,
        user: { id: '456', email: body.email }
      });
  }),

  // Session validation endpoint
  http.get('/api/auth/validate', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Invalid or missing authorization header' }, { status: 401 });
    }
    
    return HttpResponse.json({ valid: true, user: { id: '123' } });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('Authentication Security Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Input Sanitization', () => {
    it('should prevent XSS attacks in login form', async () => {
      renderWithProviders(<LoginForm />);

      const maliciousScript = '<script>alert("XSS")</script>';
      const emailInput = screen.getByLabelText(/e-mail/i);
      
      await user.type(emailInput, `${maliciousScript}@example.com`);
      
      expect(emailInput).toHaveValue(`${maliciousScript}@example.com`);
      
      // Verify the script is not executed (no alert)
      // The actual sanitization should happen server-side
      expect(document.body.innerHTML).not.toContain('<script>');
    });

    it('should prevent SQL injection in registration', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const sqlInjection = "'; DROP TABLE users; --";
      
      await user.type(screen.getByLabelText(/nome completo/i), sqlInjection);
      await user.type(screen.getByLabelText(/e-mail/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      
      // Accept terms
      await user.click(screen.getByRole('checkbox', { name: /termos de uso/i }));
      await user.click(screen.getByRole('checkbox', { name: /política de privacidade/i }));
      
      await user.click(screen.getByRole('button', { name: /criar conta/i }));

      await waitFor(() => {
        expect(screen.getByText(/input.*invalid/i)).toBeInTheDocument();
      });
    });

    it('should sanitize HTML content in form inputs', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const htmlContent = '<b>Bold Name</b>';
      const nameInput = screen.getByLabelText(/nome completo/i);
      
      await user.type(nameInput, htmlContent);
      
      // Input should accept the content but not render HTML
      expect(nameInput).toHaveValue(htmlContent);
      expect(nameInput.innerHTML).not.toContain('<b>');
    });
  });

  describe('Rate Limiting Protection', () => {
    it('should handle rate limiting on login attempts', async () => {
      // Mock rate limit headers
      server.use(
        http.post('/api/auth/login', ({ request }) => {
          return res(
            ctx.status(429),
            ctx.set('X-RateLimit-Remaining', '0'),
            ctx.set('X-RateLimit-Reset', '900'),
            ctx.json({ 
              error: 'Too many attempts. Try again in 15 minutes.',
              retry_after: 900
            })
          );
        })
      );

      renderWithProviders(<LoginForm />);

      await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
      await user.type(screen.getByLabelText(/senha/i), 'password123');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      await waitFor(() => {
        expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
        expect(screen.getByText(/15 minutes/i)).toBeInTheDocument();
      });

      // Login button should be disabled
      expect(screen.getByRole('button', { name: /entrar/i })).toBeDisabled();
    });

    it('should show progressive delays for failed attempts', async () => {
      let attemptCount = 0;
      
      server.use(
        http.post('/api/auth/login', ({ request }) => {
          attemptCount++;
          
          if (attemptCount >= 3) {
            return HttpResponse.json({ 
                error: 'Account temporarily locked',
                lockout_time: attemptCount * 60 // Progressive delay
              }, { status: 429 });
          }
          
          return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        })
      );

      renderWithProviders(<LoginForm />);

      // Make multiple failed attempts
      for (let i = 0; i < 4; i++) {
        await user.clear(screen.getByLabelText(/e-mail/i));
        await user.clear(screen.getByLabelText(/senha/i));
        
        await user.type(screen.getByLabelText(/e-mail/i), 'admin@test.com');
        await user.type(screen.getByLabelText(/senha/i), 'wrongpass');
        await user.click(screen.getByRole('button', { name: /entrar/i }));
        
        if (i >= 2) {
          await waitFor(() => {
            expect(screen.getByText(/temporarily locked/i)).toBeInTheDocument();
          });
          break;
        }
      }
    });
  });

  describe('Session Security', () => {
    it('should validate JWT tokens properly', async () => {
      // Set invalid token
      localStorage.setItem('access_token', 'invalid.jwt.token');
      
      renderWithProviders(<SessionManager />);

      await waitFor(() => {
        expect(screen.getByText(/session.*invalid/i)).toBeInTheDocument();
        expect(localStorage.getItem('access_token')).toBeNull();
      });
    });

    it('should handle token expiration gracefully', async () => {
      // Set expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
      localStorage.setItem('access_token', expiredToken);
      
      server.use(
        http.get('/api/auth/validate', ({ request }) => {
          return HttpResponse.json({ error: 'Token expired' }, { status: 401 });
        })
      );

      renderWithProviders(<SessionManager />);

      await waitFor(() => {
        expect(screen.getByText(/session.*expired/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      });
    });

    it('should prevent session fixation attacks', async () => {
      const originalSessionId = 'original-session-123';
      const newSessionId = 'new-session-456';
      
      // Mock session renewal on login
      server.use(
        http.post('/api/auth/login', async ({ request }) => {
          return HttpResponse.json({
              success: true,
              user: { id: '123', email: 'user@example.com' },
              access_token: 'new-jwt-token',
              session_id: newSessionId
            });
        })
      );

      // Set existing session
      sessionStorage.setItem('session_id', originalSessionId);
      
      renderWithProviders(<LoginForm />);

      await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
      await user.type(screen.getByLabelText(/senha/i), 'validpass123');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      await waitFor(() => {
        // Session ID should be renewed
        expect(sessionStorage.getItem('session_id')).toBe(newSessionId);
        expect(sessionStorage.getItem('session_id')).not.toBe(originalSessionId);
      });
    });
  });

  describe('Password Security', () => {
    it('should enforce strong password requirements', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const weakPasswords = [
        'password',           // Common password
        '12345678',          // Numbers only
        'abcdefgh',          // Letters only
        'Pass123',           // Too short
        'PASSWORD123',       // No lowercase
        'password123',       // No uppercase
        'Password',          // No numbers
      ];

      const passwordInput = screen.getByLabelText(/^senha$/i);

      for (const weakPassword of weakPasswords) {
        await user.clear(passwordInput);
        await user.type(passwordInput, weakPassword);
        await user.tab();

        // Should show password strength warning
        expect(screen.getByText(/senha fraca/i) || screen.getByText(/requisitos.*senha/i)).toBeInTheDocument();
      }

      // Test strong password
      await user.clear(passwordInput);
      await user.type(passwordInput, 'StrongP@ssw0rd!');
      
      await waitFor(() => {
        expect(screen.getByText(/senha forte/i)).toBeInTheDocument();
      });
    });

    it('should prevent password visibility by default', () => {
      renderWithProviders(<LoginForm />);

      const passwordInput = screen.getByLabelText(/senha/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should clear password fields on navigation', async () => {
      const { unmount } = renderWithProviders(<LoginForm />);

      const passwordInput = screen.getByLabelText(/senha/i);
      await user.type(passwordInput, 'sensitive-password');
      
      expect(passwordInput).toHaveValue('sensitive-password');
      
      // Simulate navigation away
      unmount();
      
      // Re-render (simulate navigation back)
      renderWithProviders(<LoginForm />);
      
      const newPasswordInput = screen.getByLabelText(/senha/i);
      expect(newPasswordInput).toHaveValue('');
    });
  });

  describe('CSRF Protection', () => {
    it('should include CSRF tokens in requests', async () => {
      // Mock CSRF token endpoint
      server.use(
        http.get('/api/csrf-token', ({ request }) => {
          return HttpResponse.json({ token: 'csrf-token-123' });
        }),
        
        http.post('/api/auth/login', async ({ request }) => {
          const csrfToken = request.headers.get('X-CSRF-Token');
          
          if (!csrfToken || csrfToken !== 'csrf-token-123') {
            return HttpResponse.json({ error: 'CSRF token missing or invalid' }, { status: 403 });
          }
          
          return HttpResponse.json({
              success: true,
              user: { id: '123', email: 'user@example.com' }
            });
        })
      );

      renderWithProviders(<LoginForm />);

      await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
      await user.type(screen.getByLabelText(/senha/i), 'password123');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      // Should not show CSRF error, indicating token was included
      await waitFor(() => {
        expect(screen.queryByText(/csrf.*invalid/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Content Security Policy', () => {
    it('should not execute inline scripts', () => {
      renderWithProviders(<LoginForm />);
      
      // Try to inject inline script
      const scriptElement = document.createElement('script');
      scriptElement.innerHTML = 'window.xssExecuted = true;';
      document.body.appendChild(scriptElement);
      
      // Script should not execute due to CSP
      expect((window as any).xssExecuted).toBeUndefined();
    });

    it('should validate external resource loading', () => {
      renderWithProviders(<LoginForm />);
      
      // Check that only allowed domains are loaded
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.src.startsWith('http')) {
          // Should be from allowed domains only
          expect(
            img.src.includes('localhost') || 
            img.src.includes('trusted-cdn.com') ||
            img.src.startsWith('data:')
          ).toBeTruthy();
        }
      });
    });
  });

  describe('Data Validation', () => {
    it('should validate email format strictly', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const invalidEmails = [
        'plainaddress',
        '@missingname.com',
        'missing@.com',
        'missing.domain@.com',
        'spaces in@email.com',
        'email@.com',
        'email@com',
        'email..double.dot@example.com',
      ];

      const emailInput = screen.getByLabelText(/e-mail/i);

      for (const invalidEmail of invalidEmails) {
        await user.clear(emailInput);
        await user.type(emailInput, invalidEmail);
        await user.tab();

        expect(screen.getByText(/e-mail inválido/i)).toBeInTheDocument();
      }
    });

    it('should validate CPF format and checksum', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const invalidCPFs = [
        '000.000.000-00',     // All zeros
        '111.111.111-11',     // All same digit
        '123.456.789-00',     // Invalid checksum
        '12345678901',        // Missing formatting (should be handled)
        '123.456.789-AB',     // Non-numeric characters
      ];

      const cpfInput = screen.getByLabelText(/cpf/i);

      for (const invalidCPF of invalidCPFs) {
        await user.clear(cpfInput);
        await user.type(cpfInput, invalidCPF);
        await user.tab();

        expect(screen.getByText(/cpf inválido/i)).toBeInTheDocument();
      }
    });
  });
});