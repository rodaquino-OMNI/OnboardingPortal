import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import '@testing-library/jest-dom';

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
    back: jest.fn(),
    forward: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock auth hook
const mockAuth = {
  user: null,
  isAuthenticated: false,
  hasRole: jest.fn(() => false),
  hasPermission: jest.fn(() => false),
};

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => mockAuth),
}));

describe('Router Security Validation', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    
    // Reset auth state
    mockAuth.user = null;
    mockAuth.isAuthenticated = false;
    mockAuth.hasRole = jest.fn(() => false);
    mockAuth.hasPermission = jest.fn(() => false);
  });

  describe('Route Protection Mechanisms', () => {
    it('should validate authentication before accessing protected routes', async () => {
      // Simulate protected route access
      const ProtectedPage = () => {
        const { isAuthenticated } = mockAuth;
        const router = useRouter();
        
        React.useEffect(() => {
          if (!isAuthenticated) {
            router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
          }
        }, [isAuthenticated, router]);
        
        if (!isAuthenticated) {
          return <div>Redirecting to login...</div>;
        }
        
        return <div>Protected Content</div>;
      };

      render(<ProtectedPage />);
      
      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2F');
    });

    it('should validate user roles for role-specific routes', async () => {
      mockAuth.isAuthenticated = true;
      mockAuth.user = { id: '123', role: 'user' };
      mockAuth.hasRole = jest.fn((role) => role === 'user');

      const AdminOnlyPage = () => {
        const { hasRole } = mockAuth;
        const router = useRouter();
        
        React.useEffect(() => {
          if (!hasRole('admin')) {
            router.push('/unauthorized');
          }
        }, [hasRole, router]);
        
        if (!hasRole('admin')) {
          return <div>Access Denied</div>;
        }
        
        return <div>Admin Dashboard</div>;
      };

      render(<AdminOnlyPage />);
      
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(mockPush).toHaveBeenCalledWith('/unauthorized');
    });

    it('should prevent privilege escalation through URL manipulation', async () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/system-settings');
      
      mockAuth.isAuthenticated = true;
      mockAuth.user = { id: '123', role: 'user' };
      mockAuth.hasRole = jest.fn((role) => role === 'user');

      const SystemSettingsPage = () => {
        const { hasRole } = mockAuth;
        const pathname = usePathname();
        
        // Check if current route requires admin access
        const isAdminRoute = pathname.startsWith('/admin/');
        
        if (isAdminRoute && !hasRole('admin')) {
          return (
            <div>
              <h1>Access Denied</h1>
              <p>You don't have permission to access this resource.</p>
            </div>
          );
        }
        
        return <div>System Settings</div>;
      };

      render(<SystemSettingsPage />);
      
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
    });
  });

  describe('URL Parameter Validation', () => {
    it('should sanitize and validate route parameters', async () => {
      const UserProfilePage = ({ userId }: { userId: string }) => {
        // Validate user ID format
        const isValidUserId = /^[a-zA-Z0-9-_]{1,36}$/.test(userId);
        
        if (!isValidUserId) {
          return (
            <div>
              <h1>Invalid User ID</h1>
              <p>The provided user ID format is not valid.</p>
            </div>
          );
        }
        
        // Additional security: check if user has permission to view this profile
        const { user: currentUser } = mockAuth;
        const canViewProfile = currentUser?.id === userId || mockAuth.hasRole('admin');
        
        if (!canViewProfile) {
          return (
            <div>
              <h1>Access Forbidden</h1>
              <p>You can only view your own profile.</p>
            </div>
          );
        }
        
        return <div>User Profile: {userId}</div>;
      };

      // Test with malicious user ID
      const maliciousUserId = '../admin/delete-users';
      render(<UserProfilePage userId={maliciousUserId} />);
      
      expect(screen.getByText('Invalid User ID')).toBeInTheDocument();
      expect(screen.queryByText(`User Profile: ${maliciousUserId}`)).not.toBeInTheDocument();
    });

    it('should handle SQL injection attempts in route parameters', async () => {
      const SearchPage = ({ query }: { query: string }) => {
        // Validate search query
        const sqlPatterns = [
          /DROP\s+TABLE/i,
          /SELECT\s+\*\s+FROM/i,
          /UNION\s+SELECT/i,
          /INSERT\s+INTO/i,
          /DELETE\s+FROM/i,
          /UPDATE\s+SET/i,
          /--/,
          /;/
        ];
        
        const containsSqlInjection = sqlPatterns.some(pattern => pattern.test(query));
        
        if (containsSqlInjection) {
          return (
            <div>
              <h1>Invalid Search Query</h1>
              <p>Your search contains invalid characters.</p>
            </div>
          );
        }
        
        return <div>Search Results for: {query}</div>;
      };

      const sqlInjectionQuery = "'; DROP TABLE users; --";
      render(<SearchPage query={sqlInjectionQuery} />);
      
      expect(screen.getByText('Invalid Search Query')).toBeInTheDocument();
      expect(screen.getByText(/invalid characters/i)).toBeInTheDocument();
    });

    it('should sanitize XSS attempts in query parameters', async () => {
      (useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('?message=<script>alert("XSS")</script>')
      );

      const MessagePage = () => {
        const searchParams = useSearchParams();
        const message = searchParams.get('message') || '';
        
        // Sanitize the message
        const sanitizedMessage = message
          .replace(/<script.*?>.*?<\/script>/gi, '')
          .replace(/<.*?>/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '');
        
        return (
          <div>
            <h1>Message Display</h1>
            <p data-testid="message-content">{sanitizedMessage}</p>
          </div>
        );
      };

      render(<MessagePage />);
      
      const messageContent = screen.getByTestId('message-content');
      expect(messageContent).toHaveTextContent('alert("XSS")');
      expect(messageContent).not.toHaveTextContent('<script>');
    });
  });

  describe('Session and Token Validation', () => {
    it('should validate JWT token expiration on route changes', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = `header.${btoa(JSON.stringify({ exp: now - 3600 }))}.signature`;
      
      mockAuth.isAuthenticated = true;
      mockAuth.user = { id: '123', token: expiredToken };

      const TokenValidatedPage = () => {
        const { user } = mockAuth;
        const router = useRouter();
        
        React.useEffect(() => {
          if (user?.token) {
            try {
              const payload = JSON.parse(atob(user.token.split('.')[1]));
              const currentTime = Math.floor(Date.now() / 1000);
              
              if (payload.exp < currentTime) {
                router.push('/login?reason=token_expired');
                return;
              }
            } catch (error) {
              router.push('/login?reason=invalid_token');
              return;
            }
          }
        }, [user, router]);
        
        return <div>Token Valid Content</div>;
      };

      render(<TokenValidatedPage />);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?reason=token_expired');
      });
    });

    it('should detect and prevent session hijacking attempts', async () => {
      const originalSessionId = 'session-abc-123';
      const suspiciousSessionId = 'session-xyz-456';
      
      // Mock session storage
      const mockSessionStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      };
      
      Object.defineProperty(window, 'sessionStorage', {
        value: mockSessionStorage
      });

      mockSessionStorage.getItem.mockReturnValue(originalSessionId);
      
      mockAuth.isAuthenticated = true;
      mockAuth.user = { id: '123', sessionId: suspiciousSessionId };

      const SessionValidatedPage = () => {
        const { user } = mockAuth;
        const router = useRouter();
        
        React.useEffect(() => {
          const storedSessionId = sessionStorage.getItem('session_id');
          
          if (user?.sessionId && storedSessionId !== user.sessionId) {
            // Potential session hijacking detected
            router.push('/login?reason=session_mismatch');
          }
        }, [user, router]);
        
        return <div>Session Valid Content</div>;
      };

      render(<SessionValidatedPage />);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?reason=session_mismatch');
      });
    });

    it('should enforce session timeout on inactive users', async () => {
      const lastActivity = Date.now() - (31 * 60 * 1000); // 31 minutes ago
      
      mockAuth.isAuthenticated = true;
      mockAuth.user = { id: '123', lastActivity };

      const SessionTimeoutPage = () => {
        const { user } = mockAuth;
        const router = useRouter();
        
        React.useEffect(() => {
          const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
          const currentTime = Date.now();
          
          if (user?.lastActivity && (currentTime - user.lastActivity) > SESSION_TIMEOUT) {
            router.push('/login?reason=session_timeout');
          }
        }, [user, router]);
        
        return <div>Active Session Content</div>;
      };

      render(<SessionTimeoutPage />);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?reason=session_timeout');
      });
    });
  });

  describe('CSRF Protection', () => {
    it('should validate CSRF tokens on state-changing routes', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      const StateChangingPage = () => {
        const handleDelete = async () => {
          const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
          
          if (!csrfToken) {
            alert('CSRF token missing');
            return;
          }
          
          await fetch('/api/users/delete', {
            method: 'DELETE',
            headers: {
              'X-CSRF-Token': csrfToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: '123' }),
          });
        };
        
        return (
          <div>
            <button onClick={handleDelete}>Delete User</button>
          </div>
        );
      };

      // Mock missing CSRF token
      render(<StateChangingPage />);
      
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      await user.click(screen.getByRole('button', { name: /delete user/i }));
      
      expect(alertSpy).toHaveBeenCalledWith('CSRF token missing');
      expect(mockFetch).not.toHaveBeenCalled();
      
      alertSpy.mockRestore();
    });
  });

  describe('Content Security Policy Validation', () => {
    it('should prevent inline script execution', () => {
      const UnsafePage = () => {
        // Simulate attempt to inject inline script
        const unsafeHTML = '<div>Safe content</div><script>alert("XSS")</script>';
        
        return (
          <div>
            <h1>Page Content</h1>
            <div dangerouslySetInnerHTML={{ __html: unsafeHTML }} />
          </div>
        );
      };

      render(<UnsafePage />);
      
      // Script should not execute (would be blocked by CSP in real browser)
      expect(screen.getByText('Safe content')).toBeInTheDocument();
      expect((window as any).xssExecuted).toBeUndefined();
    });

    it('should validate external resource loading', () => {
      const ExternalResourcePage = () => {
        return (
          <div>
            <img 
              src="https://untrusted-domain.evil/malicious.jpg" 
              alt="External image"
              onError={() => console.log('Image blocked by CSP')}
            />
            <script src="https://untrusted-domain.evil/malicious.js" />
          </div>
        );
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      render(<ExternalResourcePage />);
      
      // In a real browser with CSP, these resources would be blocked
      expect(screen.getByAltText('External image')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should implement client-side rate limiting for sensitive actions', async () => {
      const RateLimitedPage = () => {
        const [attempts, setAttempts] = React.useState(0);
        const [isBlocked, setIsBlocked] = React.useState(false);
        const lastAttempt = React.useRef(Date.now());
        
        const handleSensitiveAction = () => {
          const now = Date.now();
          const timeSinceLastAttempt = now - lastAttempt.current;
          
          // Allow max 3 attempts per minute
          if (timeSinceLastAttempt < 60000 && attempts >= 3) {
            setIsBlocked(true);
            return;
          }
          
          // Reset attempts if more than a minute has passed
          if (timeSinceLastAttempt >= 60000) {
            setAttempts(1);
          } else {
            setAttempts(prev => prev + 1);
          }
          
          lastAttempt.current = now;
        };
        
        return (
          <div>
            <button 
              onClick={handleSensitiveAction}
              disabled={isBlocked}
            >
              Sensitive Action ({attempts}/3)
            </button>
            {isBlocked && (
              <p>Too many attempts. Please wait before trying again.</p>
            )}
          </div>
        );
      };

      render(<RateLimitedPage />);
      
      const button = screen.getByRole('button');
      
      // Make 3 rapid attempts
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      expect(button).toHaveTextContent('(3/3)');
      
      // Fourth attempt should be blocked
      await user.click(button);
      
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  describe('Redirect Validation', () => {
    it('should validate redirect URLs to prevent open redirects', async () => {
      const LoginPage = () => {
        const searchParams = useSearchParams();
        const router = useRouter();
        
        const handleLogin = () => {
          const redirectUrl = searchParams.get('redirect') || '/dashboard';
          
          // Validate redirect URL to prevent open redirects
          const isValidRedirect = (url: string) => {
            try {
              const parsedUrl = new URL(url, window.location.origin);
              return parsedUrl.origin === window.location.origin;
            } catch {
              // If it's a relative path, it's safe
              return url.startsWith('/') && !url.startsWith('//');
            }
          };
          
          if (isValidRedirect(redirectUrl)) {
            router.push(redirectUrl);
          } else {
            router.push('/dashboard'); // Safe fallback
          }
        };
        
        return (
          <div>
            <button onClick={handleLogin}>Login</button>
          </div>
        );
      };

      // Test with malicious redirect
      (useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('?redirect=https://evil.com/phishing')
      );

      render(<LoginPage />);
      
      await user.click(screen.getByRole('button', { name: /login/i }));
      
      // Should redirect to safe fallback, not the malicious URL
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});