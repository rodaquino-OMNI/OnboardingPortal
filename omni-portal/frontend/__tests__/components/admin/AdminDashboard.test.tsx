import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

// Mock hooks
jest.mock('@/hooks/useAuth');
jest.mock('@/hooks/useAdminPermissions');
jest.mock('@/components/admin/UserManagementTable', () => ({
  UserManagementTable: () => <div data-testid="user-management-table">User Management Table</div>
}));
jest.mock('@/components/admin/SystemMetrics', () => ({
  SystemMetrics: () => <div data-testid="system-metrics">System Metrics</div>
}));
jest.mock('@/components/admin/AuditLogViewer', () => ({
  AuditLogViewer: () => <div data-testid="audit-log-viewer">Audit Log Viewer</div>
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseAdminPermissions = useAdminPermissions as jest.MockedFunction<typeof useAdminPermissions>;

describe('AdminDashboard Component', () => {
  const mockUser = {
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    roles: ['admin']
  };

  const mockAdminPermissions = {
    canManageUsers: true,
    canViewUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canManageRoles: true,
    canViewReports: true,
    canExportData: true,
    canViewAuditLogs: true,
    canManageSystem: true,
    canPerformBulkOperations: true
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn()
    });

    mockUseAdminPermissions.mockReturnValue(mockAdminPermissions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render admin dashboard with all components for admin user', () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('system-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('user-management-table')).toBeInTheDocument();
    expect(screen.getByTestId('audit-log-viewer')).toBeInTheDocument();
  });

  it('should show navigation tabs based on user permissions', () => {
    render(<AdminDashboard />);

    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /roles/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audit logs/i })).toBeInTheDocument();
  });

  it('should hide restricted tabs for users without permissions', () => {
    mockUseAdminPermissions.mockReturnValue({
      ...mockAdminPermissions,
      canManageSystem: false,
      canViewAuditLogs: false,
      canManageRoles: false
    });

    render(<AdminDashboard />);

    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /roles/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /system/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /audit logs/i })).not.toBeInTheDocument();
  });

  it('should switch between different dashboard sections', async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);

    // Initially on overview tab
    expect(screen.getByTestId('system-metrics')).toBeVisible();

    // Click users tab
    await user.click(screen.getByRole('tab', { name: /users/i }));
    expect(screen.getByTestId('user-management-table')).toBeVisible();

    // Click audit logs tab
    await user.click(screen.getByRole('tab', { name: /audit logs/i }));
    expect(screen.getByTestId('audit-log-viewer')).toBeVisible();
  });

  it('should display user info and logout option', () => {
    render(<AdminDashboard />);

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
    render(<AdminDashboard />);

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

    render(<AdminDashboard />);
    expect(screen.getByTestId('admin-loading')).toBeInTheDocument();
  });

  it('should redirect to login when user is not authenticated', () => {
    const mockPush = jest.fn();
    jest.mock('next/router', () => ({
      useRouter: () => ({
        push: mockPush
      })
    }));

    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn()
    });

    render(<AdminDashboard />);
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('should show appropriate error message for insufficient permissions', () => {
    mockUseAdminPermissions.mockReturnValue({
      canManageUsers: false,
      canViewUsers: false,
      canEditUsers: false,
      canDeleteUsers: false,
      canManageRoles: false,
      canViewReports: false,
      canExportData: false,
      canViewAuditLogs: false,
      canManageSystem: false,
      canPerformBulkOperations: false
    });

    render(<AdminDashboard />);
    expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
  });

  it('should display real-time notifications for admin actions', async () => {
    render(<AdminDashboard />);

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
    render(<AdminDashboard />);

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
    render(<AdminDashboard />);

    expect(screen.getByText(/system status/i)).toBeInTheDocument();
    expect(screen.getByTestId('health-indicator')).toBeInTheDocument();
  });

  it('should show quick action buttons based on permissions', () => {
    render(<AdminDashboard />);

    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system settings/i })).toBeInTheDocument();
  });

  it('should hide quick actions for users without permissions', () => {
    mockUseAdminPermissions.mockReturnValue({
      ...mockAdminPermissions,
      canManageUsers: false,
      canExportData: false,
      canManageSystem: false
    });

    render(<AdminDashboard />);

    expect(screen.queryByRole('button', { name: /create user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export data/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /system settings/i })).not.toBeInTheDocument();
  });

  it('should display recent activity feed', () => {
    render(<AdminDashboard />);

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

    render(<AdminDashboard />);

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
    render(<AdminDashboard />);

    await user.click(screen.getByTestId('mobile-nav-toggle'));
    expect(screen.getByTestId('mobile-sidebar')).not.toHaveClass('hidden');
  });

  it('should display performance metrics for admin overview', () => {
    render(<AdminDashboard />);

    expect(screen.getByText(/active users/i)).toBeInTheDocument();
    expect(screen.getByText(/system uptime/i)).toBeInTheDocument();
    expect(screen.getByText(/response time/i)).toBeInTheDocument();
    expect(screen.getByText(/error rate/i)).toBeInTheDocument();
  });

  it('should handle dark mode toggle', async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);

    const darkModeToggle = screen.getByRole('button', { name: /toggle dark mode/i });
    await user.click(darkModeToggle);

    expect(document.documentElement).toHaveClass('dark');
  });

  it('should persist user preferences in localStorage', async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);

    // Change dashboard layout
    await user.click(screen.getByRole('button', { name: /compact view/i }));

    expect(localStorage.getItem('admin-dashboard-preferences')).toContain('compact');
  });

  it('should show confirmation dialog for destructive actions', async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);

    // Navigate to system tab
    await user.click(screen.getByRole('tab', { name: /system/i }));

    // Try to trigger maintenance mode
    await user.click(screen.getByRole('button', { name: /maintenance mode/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('should handle error states gracefully', async () => {
    // Mock API error
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
      try {
        return <>{children}</>;
      } catch (error) {
        return <div data-testid="error-boundary">Something went wrong</div>;
      }
    };

    render(
      <ErrorBoundary>
        <AdminDashboard />
      </ErrorBoundary>
    );

    // Simulate component error
    const mockError = new Error('Test error');
    jest.spyOn(React, 'createElement').mockImplementation(() => {
      throw mockError;
    });

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
  });
});