import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname } from 'next/navigation';
import '@testing-library/jest-dom';

// Mock Next.js navigation
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

// Mock auth context
const mockAuthContext = {
  user: null,
  isAuthenticated: false,
  token: null,
  hasRole: jest.fn(() => false),
  hasPermission: jest.fn(() => false),
};

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => mockAuthContext),
}));

// Components to test
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminRoute from '@/components/auth/AdminRoute';
import { GuestRoute } from '@/components/auth/GuestRoute';

describe('Navigation Security Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    
    // Reset auth context
    mockAuthContext.user = null;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.token = null;
    mockAuthContext.hasRole = jest.fn(() => false);
    mockAuthContext.hasPermission = jest.fn(() => false);
  });

  describe('Route Protection', () => {
    it('should redirect unauthenticated users from protected routes', async () => {
      const TestProtectedComponent = () => (
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      render(<TestProtectedComponent />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fprotected');
      });

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should allow authenticated users to access protected routes', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'user@example.com', role: 'user' };
      mockAuthContext.token = 'valid-jwt-token';

      const TestProtectedComponent = () => (
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      render(<TestProtectedComponent />);

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should enforce role-based access control', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'user@example.com', role: 'user' };
      mockAuthContext.hasRole = jest.fn((role) => role === 'user');

      const TestAdminComponent = () => (
        <AdminRoute requiredRole="admin">
          <div>Admin Content</div>
        </AdminRoute>
      );

      render(<TestAdminComponent />);

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should allow admin users to access admin routes', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'admin@example.com', role: 'admin' };
      mockAuthContext.hasRole = jest.fn((role) => role === 'admin');

      const TestAdminComponent = () => (
        <AdminRoute requiredRole="admin">
          <div>Admin Content</div>
        </AdminRoute>
      );

      render(<TestAdminComponent />);

      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });
    });

    it('should redirect authenticated users from guest-only routes', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'user@example.com' };

      const TestGuestComponent = () => (
        <GuestRoute>
          <div>Guest Only Content</div>
        </GuestRoute>
      );

      render(<TestGuestComponent />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });

      expect(screen.queryByText('Guest Only Content')).not.toBeInTheDocument();
    });
  });

  describe('URL Manipulation Protection', () => {
    it('should prevent access to admin routes via direct URL manipulation', async () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users');
      
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'user@example.com', role: 'user' };
      mockAuthContext.hasRole = jest.fn((role) => role === 'user');

      const TestAdminPage = () => (
        <AdminRoute requiredRole="admin">
          <div>User Management</div>
        </AdminRoute>
      );

      render(<TestAdminPage />);

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
        expect(screen.getByText(/insufficient privileges/i)).toBeInTheDocument();
      });
    });

    it('should validate route parameters for security', async () => {
      const TestComponent = ({ userId }: { userId: string }) => {
        // Simulate route parameter validation
        const isValidUserId = /^[a-zA-Z0-9-_]+$/.test(userId);
        
        if (!isValidUserId) {
          return <div>Invalid user ID format</div>;
        }
        
        return <div>User Profile: {userId}</div>;
      };

      // Test with malicious user ID
      const maliciousUserId = '../admin/delete-all';
      render(<TestComponent userId={maliciousUserId} />);

      expect(screen.getByText('Invalid user ID format')).toBeInTheDocument();
      expect(screen.queryByText(`User Profile: ${maliciousUserId}`)).not.toBeInTheDocument();
    });

    it('should sanitize query parameters', async () => {
      const TestComponent = () => {
        const searchParams = new URLSearchParams(window.location.search);
        const query = searchParams.get('q') || '';
        
        // Simulate XSS protection
        const sanitizedQuery = query.replace(/<script.*?>.*?<\/script>/gi, '');
        
        return <div>Search: {sanitizedQuery}</div>;
      };

      // Mock malicious query parameter
      delete (window as any).location;
      (window as any).location = {
        search: '?q=<script>alert("XSS")</script>test'
      };

      render(<TestComponent />);

      expect(screen.getByText('Search: test')).toBeInTheDocument();
      expect(screen.queryByText(/script/)).not.toBeInTheDocument();
    });
  });

  describe('Session Management', () => {
    it('should handle session expiration during navigation', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'user@example.com' };

      const TestComponent = () => (
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      const { rerender } = render(<TestComponent />);

      // Verify initial access
      expect(screen.getByText('Protected Content')).toBeInTheDocument();

      // Simulate session expiration
      mockAuthContext.isAuthenticated = false;
      mockAuthContext.user = null;
      mockAuthContext.token = null;

      rerender(<TestComponent />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fprotected&reason=session_expired');
      });
    });

    it('should validate token freshness on route changes', async () => {
      const now = Date.now();
      const expiredToken = {
        exp: Math.floor((now - 3600000) / 1000), // Expired 1 hour ago
        iat: Math.floor((now - 7200000) / 1000), // Issued 2 hours ago
      };

      mockAuthContext.isAuthenticated = true;
      mockAuthContext.token = `header.${btoa(JSON.stringify(expiredToken))}.signature`;

      const TestComponent = () => (
        <ProtectedRoute validateToken={true}>
          <div>Token Protected Content</div>
        </ProtectedRoute>
      );

      render(<TestComponent />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?reason=token_expired');
      });

      expect(screen.queryByText('Token Protected Content')).not.toBeInTheDocument();
    });

    it('should prevent concurrent sessions when configured', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'user@example.com' };

      // Mock session storage with different session ID
      const currentSessionId = 'session-abc-123';
      const storedSessionId = 'session-xyz-456';
      
      sessionStorage.setItem('session_id', storedSessionId);
      mockAuthContext.sessionId = currentSessionId;

      const TestComponent = () => (
        <ProtectedRoute enforceUniqueSession={true}>
          <div>Single Session Content</div>
        </ProtectedRoute>
      );

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByText(/multiple sessions detected/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign out other sessions/i })).toBeInTheDocument();
      });
    });
  });

  describe('Permission-Based Access', () => {
    it('should enforce granular permissions', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'user@example.com', role: 'editor' };
      mockAuthContext.hasPermission = jest.fn((permission) => {
        const permissions = ['read_posts', 'write_posts'];
        return permissions.includes(permission);
      });

      const TestComponent = () => (
        <ProtectedRoute requiredPermissions={['delete_posts']}>
          <div>Delete Posts Interface</div>
        </ProtectedRoute>
      );

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Delete Posts Interface')).not.toBeInTheDocument();
    });

    it('should allow access with multiple required permissions', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'admin@example.com', role: 'admin' };
      mockAuthContext.hasPermission = jest.fn(() => true); // Admin has all permissions

      const TestComponent = () => (
        <ProtectedRoute requiredPermissions={['read_users', 'write_users', 'delete_users']}>
          <div>User Management Interface</div>
        </ProtectedRoute>
      );

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByText('User Management Interface')).toBeInTheDocument();
      });
    });

    it('should handle dynamic permission checks', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: '123', email: 'user@example.com', role: 'user' };
      
      const resourceId = '456';
      const ownerId = '123'; // Same as current user

      mockAuthContext.hasPermission = jest.fn((permission, context) => {
        if (permission === 'edit_profile' && context?.resourceId === ownerId) {
          return true; // Users can edit their own profile
        }
        return false;
      });

      const TestComponent = () => (
        <ProtectedRoute 
          requiredPermissions={['edit_profile']} 
          permissionContext={{ resourceId }}
        >
          <div>Edit Profile</div>
        </ProtectedRoute>
      );

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });
    });
  });

  describe('Route State Protection', () => {
    it('should prevent state manipulation through browser back/forward', async () => {
      const TestComponent = () => {
        const [step, setStep] = React.useState(1);
        
        // Simulate multi-step form with state validation
        React.useEffect(() => {
          const validateStep = () => {
            const allowedSteps = [1, 2, 3];
            if (!allowedSteps.includes(step)) {
              setStep(1); // Reset to first step if invalid
            }
          };
          
          validateStep();
        }, [step]);
        
        return (
          <div>
            <div>Current Step: {step}</div>
            <button onClick={() => setStep(step + 1)}>Next Step</button>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByText('Current Step: 1')).toBeInTheDocument();

      // Simulate navigation manipulation
      const nextButton = screen.getByRole('button', { name: /next step/i });
      
      await user.click(nextButton);
      expect(screen.getByText('Current Step: 2')).toBeInTheDocument();
      
      await user.click(nextButton);
      expect(screen.getByText('Current Step: 3')).toBeInTheDocument();
      
      // Try to go beyond valid steps
      await user.click(nextButton);
      
      // Should stay at step 3 or reset, not go to step 4
      expect(screen.queryByText('Current Step: 4')).not.toBeInTheDocument();
    });

    it('should validate route transitions', async () => {
      const TestComponent = () => {
        const router = useRouter();
        
        const handleNavigation = (destination: string) => {
          // Simulate route transition validation
          const validTransitions: Record<string, string[]> = {
            '/onboarding/step1': ['/onboarding/step2'],
            '/onboarding/step2': ['/onboarding/step1', '/onboarding/step3'],
            '/onboarding/step3': ['/onboarding/step2', '/onboarding/complete'],
          };
          
          const currentPath = '/onboarding/step1';
          const allowedDestinations = validTransitions[currentPath] || [];
          
          if (allowedDestinations.includes(destination)) {
            router.push(destination);
          } else {
            console.warn('Invalid route transition attempted');
          }
        };
        
        return (
          <div>
            <button onClick={() => handleNavigation('/onboarding/step2')}>
              Valid Transition
            </button>
            <button onClick={() => handleNavigation('/onboarding/complete')}>
              Invalid Transition
            </button>
          </div>
        );
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      render(<TestComponent />);

      // Test valid transition
      await user.click(screen.getByRole('button', { name: /valid transition/i }));
      expect(mockPush).toHaveBeenCalledWith('/onboarding/step2');

      // Test invalid transition
      await user.click(screen.getByRole('button', { name: /invalid transition/i }));
      expect(consoleSpy).toHaveBeenCalledWith('Invalid route transition attempted');

      consoleSpy.mockRestore();
    });
  });
});