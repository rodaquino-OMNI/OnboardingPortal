import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';

// Components
import LoginForm from '../../components/auth/LoginForm';
import TwoFactorAuth from '../../components/auth/TwoFactorAuth';
import PasswordReset from '../../components/auth/PasswordReset';
import SocialAuth from '../../components/auth/SocialAuth';
import SessionManager from '../../components/auth/SessionManager';

// Types
import type { LoginResponse, User } from '../../types/auth';

// MSW Server
const server = setupServer(
  // Standard login
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json();
    
    if (email === '2fa@example.com') {
      return HttpResponse.json({
          success: true,
          requires_2fa: true,
          session_token: 'temp-2fa-token',
        });
    }
    
    return HttpResponse.json({
      success: true,
      user: {
        id: '123',
        name: 'Test User',
        email,
        cpf: '12345678901',
      },
    });
  }),

  // 2FA verification
  http.post('/api/auth/2fa/verify', async ({ request }) => {
    const { code, session_token } = await request.json();
    
    if (code === '123456') {
      return HttpResponse.json({
          success: true,
          user: {
            id: '123',
            name: '2FA User',
            email: '2fa@example.com',
            cpf: '12345678901',
          },
          access_token: 'full-access-token',
        });
    }
    
    return HttpResponse.json({ error: 'Invalid 2FA code' }, { status: 401 });
  }),

  // OAuth endpoints
  http.get('/api/auth/oauth/:provider', ({ params }) => {
    const { provider } = params;
    return HttpResponse.json({
        auth_url: `https://oauth.${provider}.com/authorize?client_id=test&redirect_uri=http://localhost:3000/auth/callback`,
      });
  }),

  http.post('/api/auth/oauth/callback', async ({ request }) => {
    const { code, provider } = await request.json();
    
    return HttpResponse.json({
        success: true,
        user: {
          id: '456',
          name: 'OAuth User',
          email: 'oauth@example.com',
          cpf: '98765432101',
          provider,
        },
        access_token: 'oauth-token',
        is_new_user: true,
      });
  }),

  // Password reset
  http.post('/api/auth/password/reset-request', async ({ request }) => {
    const { email } = await request.json();
    
    return HttpResponse.json(
      ({
        success: true,
        message: 'Reset email sent',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      })
    );
  }),

  http.post('/api/auth/password/reset-verify', async ({ request }) => {
    const { token, password } = await request.json();
    
    if (token === 'valid-reset-token') {
      return HttpResponse.json({
          success: true,
          message: 'Password updated successfully',
        });
    }
    
    return HttpResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }),

  // Session management
  http.get('/api/auth/sessions', ({ request }) => {
    return HttpResponse.json(
      ({
        sessions: [
          {
            id: 'session-1',
            device: 'Chrome on Windows',
            ip: '192.168.1.100',
            location: 'São Paulo, BR',
            last_active: new Date().toISOString(),
            current: true,
          },
          {
            id: 'session-2',
            device: 'Safari on iPhone',
            ip: '192.168.1.101',
            location: 'São Paulo, BR',
            last_active: new Date(Date.now() - 3600000).toISOString(),
            current: false,
          },
        ],
      })
    );
  }),

  http.delete('/api/auth/sessions/:sessionId', ({ request }) => {
    return HttpResponse.json({ success: true });
  }),

  // Token refresh
  http.post('/api/auth/refresh', async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader?.includes('expired-token')) {
      return HttpResponse.json({ error: 'Token expired' }, { status: 401 });
    }
    
    return HttpResponse.json({
        access_token: 'new-access-token',
        expires_in: 3600,
      });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test utilities
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

describe('Enhanced Authentication Flow Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Two-Factor Authentication', () => {
    it('should complete login with 2FA verification', async () => {
      renderWithProviders(<LoginForm />);

      // Initial login
      await user.type(screen.getByLabelText(/email/i), '2fa@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should show 2FA screen
      await waitFor(() => {
        expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      // Enter 2FA code
      const codeInputs = screen.getAllByRole('textbox', { name: /digit/i });
      const code = '123456';
      
      for (let i = 0; i < code.length; i++) {
        await user.type(codeInputs[i], code[i]);
      }

      await user.click(screen.getByRole('button', { name: /verify/i }));

      // Verify successful login
      await waitFor(() => {
        expect(localStorage.getItem('access_token')).toBe('full-access-token');
        expect(screen.getByText(/welcome.*2fa user/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid 2FA codes with retry limit', async () => {
      renderWithProviders(<TwoFactorAuth sessionToken="temp-token" />);

      // Try invalid code
      const codeInputs = screen.getAllByRole('textbox', { name: /digit/i });
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        for (let i = 0; i < 6; i++) {
          await user.clear(codeInputs[i]);
          await user.type(codeInputs[i], '0');
        }
        
        await user.click(screen.getByRole('button', { name: /verify/i }));

        await waitFor(() => {
          expect(screen.getByText(/invalid.*code/i)).toBeInTheDocument();
          expect(screen.getByText(new RegExp(`${3 - attempt}.*attempts remaining`))).toBeInTheDocument();
        });
      }

      // After 3 failed attempts
      await waitFor(() => {
        expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /request new code/i })).toBeInTheDocument();
      });
    });

    it('should resend 2FA code with rate limiting', async () => {
      renderWithProviders(<TwoFactorAuth sessionToken="temp-token" />);

      const resendButton = screen.getByRole('button', { name: /resend code/i });
      
      // First resend should work
      await user.click(resendButton);
      
      await waitFor(() => {
        expect(screen.getByText(/code sent/i)).toBeInTheDocument();
        expect(resendButton).toBeDisabled();
      });

      // Should show countdown
      await waitFor(() => {
        expect(screen.getByText(/resend in.*seconds/i)).toBeInTheDocument();
      });

      // Wait for cooldown (mocked to 5 seconds for testing)
      await waitFor(() => {
        expect(resendButton).toBeEnabled();
      }, { timeout: 6000 });
    });
  });

  describe('OAuth Social Authentication', () => {
    it('should authenticate via Google OAuth', async () => {
      renderWithProviders(<SocialAuth />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      
      // Mock window.open for OAuth popup
      const mockOpen = jest.fn();
      window.open = mockOpen;

      await user.click(googleButton);

      // Verify OAuth URL is opened
      expect(mockOpen).toHaveBeenCalledWith(
        expect.stringContaining('oauth.google.com'),
        'oauth-popup',
        expect.any(String)
      );

      // Simulate OAuth callback
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'oauth-callback',
          code: 'google-auth-code',
          provider: 'google',
        },
        origin: 'http://localhost:3000',
      }));

      // Verify successful authentication
      await waitFor(() => {
        expect(screen.getByText(/welcome.*oauth user/i)).toBeInTheDocument();
        expect(localStorage.getItem('access_token')).toBe('oauth-token');
      });
    });

    it('should handle OAuth errors gracefully', async () => {
      renderWithProviders(<SocialAuth />);

      server.use(
        http.post('/api/auth/oauth/callback', ({ request }) => {
          return HttpResponse.json({ error: 'Invalid authorization code' }, { status: 400 });
        })
      );

      const facebookButton = screen.getByRole('button', { name: /continue with facebook/i });
      window.open = jest.fn();

      await user.click(facebookButton);

      // Simulate error callback
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'oauth-callback',
          error: 'access_denied',
          provider: 'facebook',
        },
        origin: 'http://localhost:3000',
      }));

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });
    });

    it('should complete profile after OAuth registration', async () => {
      renderWithProviders(<SocialAuth />);

      const instagramButton = screen.getByRole('button', { name: /continue with instagram/i });
      window.open = jest.fn();

      await user.click(instagramButton);

      // Simulate successful OAuth
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'oauth-callback',
          code: 'instagram-code',
          provider: 'instagram',
        },
        origin: 'http://localhost:3000',
      }));

      // Check if new user needs profile completion
      await waitFor(() => {
        expect(screen.getByText(/complete your profile/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/cpf/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      });

      // Complete profile
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.type(screen.getByLabelText(/phone/i), '11999999999');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      await waitFor(() => {
        expect(screen.getByText(/profile completed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Reset Flow', () => {
    it('should complete password reset process', async () => {
      renderWithProviders(<PasswordReset />);

      // Request reset
      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/reset email sent/i)).toBeInTheDocument();
        expect(screen.getByText(/expires in.*60 minutes/i)).toBeInTheDocument();
      });

      // Simulate clicking reset link (with token)
      renderWithProviders(<PasswordReset token="valid-reset-token" />);

      // Should show password reset form
      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      });

      // Set new password
      await user.type(screen.getByLabelText(/new password/i), 'NewSecure123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'NewSecure123!');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password updated/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
      });
    });

    it('should validate password strength requirements', async () => {
      renderWithProviders(<PasswordReset token="valid-reset-token" />);

      const passwordInput = screen.getByLabelText(/new password/i);
      
      // Weak password
      await user.type(passwordInput, 'weak');
      
      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();
        expect(screen.getByText(/number/i)).toBeInTheDocument();
        expect(screen.getByText(/special character/i)).toBeInTheDocument();
      });

      // Strong password
      await user.clear(passwordInput);
      await user.type(passwordInput, 'Strong123!Pass');

      await waitFor(() => {
        expect(screen.getByText(/strong password/i)).toBeInTheDocument();
        expect(screen.queryByText(/at least 8 characters/i)).not.toBeInTheDocument();
      });
    });

    it('should handle expired reset tokens', async () => {
      server.use(
        http.post('/api/auth/password/reset-verify', ({ request }) => {
          return HttpResponse.json({ error: 'Token expired' }, { status: 400 });
        })
      );

      renderWithProviders(<PasswordReset token="expired-token" />);

      await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/token expired/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /request new link/i })).toBeInTheDocument();
      });
    });
  });

  describe('Session Management', () => {
    it('should display and manage multiple sessions', async () => {
      renderWithProviders(<SessionManager />);

      await waitFor(() => {
        expect(screen.getByText(/active sessions/i)).toBeInTheDocument();
        expect(screen.getByText(/chrome on windows/i)).toBeInTheDocument();
        expect(screen.getByText(/safari on iphone/i)).toBeInTheDocument();
      });

      // Current session should be marked
      const currentSession = screen.getByTestId('session-1');
      expect(within(currentSession).getByText(/current session/i)).toBeInTheDocument();

      // Revoke other session
      const otherSession = screen.getByTestId('session-2');
      const revokeButton = within(otherSession).getByRole('button', { name: /revoke/i });
      
      await user.click(revokeButton);

      await waitFor(() => {
        expect(screen.getByText(/session revoked/i)).toBeInTheDocument();
        expect(screen.queryByTestId('session-2')).not.toBeInTheDocument();
      });
    });

    it('should detect suspicious sessions', async () => {
      server.use(
        http.get('/api/auth/sessions', ({ request }) => {
          return HttpResponse.json(
            ({
              sessions: [
                {
                  id: 'session-1',
                  device: 'Chrome on Windows',
                  ip: '192.168.1.100',
                  location: 'São Paulo, BR',
                  last_active: new Date().toISOString(),
                  current: true,
                },
                {
                  id: 'session-3',
                  device: 'Unknown Browser',
                  ip: '185.220.101.54',
                  location: 'Unknown Location',
                  last_active: new Date().toISOString(),
                  current: false,
                  suspicious: true,
                },
              ],
            })
          );
        })
      );

      renderWithProviders(<SessionManager />);

      await waitFor(() => {
        const suspiciousSession = screen.getByTestId('session-3');
        expect(within(suspiciousSession).getByText(/suspicious activity/i)).toBeInTheDocument();
        expect(within(suspiciousSession).getByRole('button', { name: /revoke immediately/i })).toBeInTheDocument();
      });

      // Should show security alert
      expect(screen.getByRole('alert')).toHaveTextContent(/suspicious session detected/i);
    });

    it('should handle session limit enforcement', async () => {
      server.use(
        http.post('/api/auth/login', async ({ request }) => {
          return HttpResponse.json({
              error: 'SESSION_LIMIT_EXCEEDED',
              message: 'Maximum 3 concurrent sessions allowed',
              sessions: [
                { id: 's1', device: 'Device 1', last_active: '2024-01-01' },
                { id: 's2', device: 'Device 2', last_active: '2024-01-02' },
                { id: 's3', device: 'Device 3', last_active: '2024-01-03' },
              ],
            }, { status: 403 });
        })
      );

      renderWithProviders(<LoginForm />);

      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/maximum.*sessions/i)).toBeInTheDocument();
        expect(screen.getByText(/revoke old sessions/i)).toBeInTheDocument();
      });

      // Should list existing sessions
      expect(screen.getByText(/device 1/i)).toBeInTheDocument();
      expect(screen.getByText(/device 2/i)).toBeInTheDocument();
      expect(screen.getByText(/device 3/i)).toBeInTheDocument();

      // Revoke oldest session
      await user.click(screen.getByRole('button', { name: /revoke device 1/i }));

      // Retry login
      await waitFor(() => {
        expect(screen.getByText(/session revoked.*try again/i)).toBeInTheDocument();
      });
    });
  });

  describe('Token Refresh Mechanism', () => {
    it('should automatically refresh expired tokens', async () => {
      // Setup authenticated state with soon-to-expire token
      localStorage.setItem('access_token', 'almost-expired-token');
      localStorage.setItem('token_expires_at', new Date(Date.now() + 60000).toISOString());

      renderWithProviders(<SessionManager />);

      // Fast-forward time to trigger refresh
      jest.advanceTimersByTime(65000);

      await waitFor(() => {
        expect(localStorage.getItem('access_token')).toBe('new-access-token');
      });

      // Should not interrupt user experience
      expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
    });

    it('should handle refresh token failure gracefully', async () => {
      localStorage.setItem('access_token', 'expired-token');

      server.use(
        http.post('/api/auth/refresh', ({ request }) => {
          return HttpResponse.json({ error: 'Refresh token invalid' }, { status: 401 });
        })
      );

      renderWithProviders(<SessionManager />);

      await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in again/i })).toBeInTheDocument();
      });

      // Should clear invalid tokens
      expect(localStorage.getItem('access_token')).toBeNull();
    });
  });
});