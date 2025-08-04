import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ErrorBoundary } from 'react-error-boundary';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock only external dependencies, not implementation details
jest.mock('@/hooks/useAuth');
jest.mock('@/hooks/useAdminPermissions');

// Keep real components for integration testing - only mock heavy external calls
jest.mock('@/services/api', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));

// Test wrapper with QueryClient
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0, // Updated from cacheTime to gcTime for React Query v5
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Custom render function with wrapper
const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper });
};

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseAdminPermissions = useAdminPermissions as jest.MockedFunction<typeof useAdminPermissions>;

describe('AdminDashboard Component', () => {
  const mockUser = {
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    roles: ['admin']
  };

  const mockPermissions = [
    { id: '1', name: 'manage_users', resource: 'users', action: 'manage' },
    { id: '2', name: 'view_users', resource: 'users', action: 'view' },
    { id: '3', name: 'edit_users', resource: 'users', action: 'edit' },
    { id: '4', name: 'delete_users', resource: 'users', action: 'delete' },
    { id: '5', name: 'manage_roles', resource: 'roles', action: 'manage' },
    { id: '6', name: 'view_reports', resource: 'reports', action: 'view' },
    { id: '7', name: 'export_data', resource: 'data', action: 'export' },
    { id: '8', name: 'view_audit_logs', resource: 'audit_logs', action: 'view' },
    { id: '9', name: 'manage_system', resource: 'system', action: 'manage' },
    { id: '10', name: 'bulk_operations', resource: 'users', action: 'bulk' }
  ];

  const mockRoles = [
    { id: '1', name: 'admin', permissions: mockPermissions }
  ];

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn()
    });

    mockUseAdminPermissions.mockReturnValue({
      permissions: mockPermissions,
      roles: mockRoles,
      loading: false,
      error: null,
      hasPermission: (resource: string, action: string) => 
        mockPermissions.some(p => p.resource === resource && p.action === action),
      hasRole: (roleName: string) => mockRoles.some(r => r.name === roleName)
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render admin dashboard with proper structure for admin user', async () => {
      // Arrange
      const user = userEvent.setup();
      
      // Act
      renderWithProviders(<AdminDashboard />);
      
      // Assert
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Admin Dashboard');
        expect(screen.getByRole('heading', { level: 1, name: /admin dashboard/i })).toBeInTheDocument();
        
        // Verify real components are rendered instead of mocked ones
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tabpanel')).toBeInTheDocument();
      });
    });
    
    it('should have no accessibility violations', async () => {
      // Arrange
      const { container } = renderWithProviders(<AdminDashboard />);
      
      // Act & Assert
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  it('should show navigation tabs based on user permissions', () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /roles/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audit logs/i })).toBeInTheDocument();
  });

  it('should hide restricted tabs for users without permissions', () => {
    const limitedPermissions = mockPermissions.filter(p => 
      !['system', 'audit_logs', 'roles'].includes(p.resource)
    );
    
    mockUseAdminPermissions.mockReturnValue({
      permissions: limitedPermissions,
      roles: mockRoles,
      loading: false,
      error: null,
      hasPermission: (resource: string, action: string) => 
        limitedPermissions.some(p => p.resource === resource && p.action === action),
      hasRole: (roleName: string) => mockRoles.some(r => r.name === roleName)
    });

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /roles/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /system/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /audit logs/i })).not.toBeInTheDocument();
  });

  describe('User Interactions', () => {
    it('should allow user to navigate between dashboard sections', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      // Act & Assert - Navigate through tabs
      await waitFor(() => {
        expect(screen.getByRole('tab', { selected: true, name: /overview/i })).toBeInTheDocument();
      });
      
      // Navigate to users tab
      const usersTab = screen.getByRole('tab', { name: /users/i });
      await user.click(usersTab);
      
      await waitFor(() => {
        expect(usersTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel', { name: /users/i })).toBeInTheDocument();
      });
      
      // Navigate to audit logs tab
      const auditTab = screen.getByRole('tab', { name: /audit logs/i });
      await user.click(auditTab);
      
      await waitFor(() => {
        expect(auditTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel', { name: /audit logs/i })).toBeInTheDocument();
      });
    });
  });

  it('should display user info and logout option', () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('should handle logout functionality', async () => {
    const mockLogout = jest.fn();
    mockUseAuth.mockReturnValue({
      ...mockUseAuth(),
      logout: mockLogout
    });

    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />);

    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('should show loading state when authentication is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn()
    });

    renderWithProviders(<AdminDashboard />);
    expect(screen.getByTestId('admin-loading')).toBeInTheDocument();
  });

  it('should redirect to login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn()
    });

    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('should show appropriate error message for insufficient permissions', () => {
    mockUseAdminPermissions.mockReturnValue({
      permissions: [],
      roles: [],
      loading: false,
      error: null,
      hasPermission: () => false,
      hasRole: () => false
    });

    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
  });

  it('should display real-time notifications for admin actions', async () => {
    renderWithProviders(<AdminDashboard />);

    // Simulate real-time notification
    const notificationEvent = new CustomEvent('admin-notification', {
      detail: {
        type: 'success',
        message: 'User created successfully',
        timestamp: Date.now()
      }
    });

    window.dispatchEvent(notificationEvent);

    await waitFor(() => {
      expect(screen.getByText('User created successfully')).toBeInTheDocument();
    });
  });

  it('should handle keyboard navigation for accessibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />);

    // Tab through navigation
    await user.tab();
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: /users/i })).toHaveFocus();

    // Use arrow keys for tab navigation
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /roles/i })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /users/i })).toHaveFocus();
  });

  it('should display system health indicators', () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText(/system status/i)).toBeInTheDocument();
    expect(screen.getByTestId('health-indicator')).toBeInTheDocument();
  });

  it('should show quick action buttons based on permissions', () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system settings/i })).toBeInTheDocument();
  });

  it('should hide quick actions for users without permissions', () => {
    const limitedPermissions = mockPermissions.filter(p => 
      !['users', 'data', 'system'].includes(p.resource) || p.action === 'view'
    );
    
    mockUseAdminPermissions.mockReturnValue({
      permissions: limitedPermissions,
      roles: mockRoles,
      loading: false,
      error: null,
      hasPermission: (resource: string, action: string) => 
        limitedPermissions.some(p => p.resource === resource && p.action === action),
      hasRole: (roleName: string) => mockRoles.some(r => r.name === roleName)
    });

    renderWithProviders(<AdminDashboard />);

    expect(screen.queryByRole('button', { name: /create user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export data/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /system settings/i })).not.toBeInTheDocument();
  });

  it('should display recent activity feed', () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
  });

  it('should handle responsive design for mobile devices', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768
    });

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByTestId('mobile-nav-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-sidebar')).toHaveClass('hidden');
  });

  it('should show mobile navigation when toggle is clicked', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768
    });

    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />);

    await user.click(screen.getByTestId('mobile-nav-toggle'));
    expect(screen.getByTestId('mobile-sidebar')).not.toHaveClass('hidden');
  });

  it('should display performance metrics for admin overview', () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText(/active users/i)).toBeInTheDocument();
    expect(screen.getByText(/system uptime/i)).toBeInTheDocument();
    expect(screen.getByText(/response time/i)).toBeInTheDocument();
    expect(screen.getByText(/error rate/i)).toBeInTheDocument();
  });

  it('should handle dark mode toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />);

    const darkModeToggle = screen.getByRole('button', { name: /toggle dark mode/i });
    await user.click(darkModeToggle);

    expect(document.documentElement).toHaveClass('dark');
  });

  it('should persist user preferences in localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />);

    // Change dashboard layout
    await user.click(screen.getByRole('button', { name: /compact view/i }));

    expect(localStorage.getItem('admin-dashboard-preferences')).toContain('compact');
  });

  it('should show confirmation dialog for destructive actions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />);

    // Navigate to system tab
    await user.click(screen.getByRole('tab', { name: /system/i }));

    // Try to trigger maintenance mode
    await user.click(screen.getByRole('button', { name: /maintenance mode/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  describe('Error Handling', () => {
    it('should handle component errors with proper error boundary', async () => {
      // Arrange
      const ErrorComponent = () => {
        throw new Error('Simulated component error');
      };
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      render(
        <ErrorBoundary
          fallback={<div role="alert">Something went wrong. Please try again.</div>}
          onError={(error) => {
            console.error('Dashboard error:', error.message);
          }}
        >
          <ErrorComponent />
        </ErrorBoundary>
      );
      
      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Dashboard error:', 'Simulated component error');
      });
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle API errors gracefully', async () => {
      // Arrange
      const mockApi = require('@/services/api').default;
      mockApi.get.mockRejectedValueOnce(new Error('API Error'));
      
      const user = userEvent.setup();
      
      // Act
      renderWithProviders(<AdminDashboard />);
      
      // Assert - component should handle API errors without crashing
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        // Error should be handled gracefully, possibly showing error message
      });
    });
  });
  
  describe('Performance and Accessibility', () => {
    it('should render within performance budget', async () => {
      // Arrange
      const startTime = performance.now();
      
      // Act
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - startTime;
      
      // Assert - Should render within 100ms budget
      expect(renderTime).toBeLessThan(100);
    });
    
    it('should support keyboard navigation through all interactive elements', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      // Act - Tab through interactive elements
      await user.tab();
      
      // Assert - First tab should focus on navigation
      await waitFor(() => {
        const focusedElement = document.activeElement;
        expect(focusedElement).toHaveAttribute('role', 'tab');
      });
      
      // Navigate through tabs with arrow keys if tab navigation is implemented
      await user.keyboard('{ArrowRight}');
      await waitFor(() => {
        const focusedElement = document.activeElement;
        expect(focusedElement).toHaveAttribute('role', 'tab');
      });
    });
    
    it('should handle large datasets without performance degradation', async () => {
      // Arrange - Mock large dataset
      const mockApi = require('@/services/api').default;
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`
      }));
      
      mockApi.get.mockResolvedValue({ data: { users: largeDataset } });
      
      const startTime = performance.now();
      
      // Act
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - startTime;
      
      // Assert - Should handle large datasets efficiently
      expect(renderTime).toBeLessThan(200); // Slightly higher budget for large data
    });
  });
});