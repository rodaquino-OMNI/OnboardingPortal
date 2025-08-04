import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { UserManagementTable } from '@/components/admin/UserManagementTable';
import { useAdminUsers, AdminUser } from '@/hooks/useAdminUsers';
import type { TestPermissions, Permission, Role } from '@/types/test-types';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ErrorBoundary } from 'react-error-boundary';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock only external dependencies, not implementation details
jest.mock('@/hooks/useAdminUsers');
jest.mock('@/hooks/useAdminPermissions');

// Mock API services but keep component integration
jest.mock('@/services/api', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));

const mockUseAdminUsers = useAdminUsers as jest.MockedFunction<typeof useAdminUsers>;
const mockUseAdminPermissions = useAdminPermissions as jest.MockedFunction<typeof useAdminPermissions>;

describe('UserManagementTable Component', () => {
  const mockUsers: AdminUser[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      cpf: '12345678901',
      role: 'user',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      lastLogin: '2024-01-20T14:30:00Z',
      isActive: true
    },
    {
      id: '2',
      name: 'Jane Manager',
      email: 'jane@example.com',
      cpf: '98765432109',
      role: 'manager',
      createdAt: '2024-01-10T09:00:00Z',
      updatedAt: '2024-01-10T09:00:00Z',
      lastLogin: '2024-01-19T16:45:00Z',
      isActive: true
    },
    {
      id: '3',
      name: 'Bob Admin',
      email: 'bob@example.com',
      cpf: '11122233344',
      role: 'admin',
      createdAt: '2024-01-05T08:00:00Z',
      updatedAt: '2024-01-05T08:00:00Z',
      lastLogin: '2024-01-18T11:20:00Z',
      isActive: false
    }
  ];

  const mockPermissions = [
    { id: '1', name: 'manage_users', resource: 'users', action: 'manage' },
    { id: '2', name: 'view_users', resource: 'users', action: 'view' },
    { id: '3', name: 'edit_users', resource: 'users', action: 'edit' },
    { id: '4', name: 'delete_users', resource: 'users', action: 'delete' },
    { id: '5', name: 'manage_roles', resource: 'roles', action: 'manage' },
    { id: '6', name: 'bulk_operations', resource: 'users', action: 'bulk' }
  ];

  const mockRoles = [
    { id: '1', name: 'admin', permissions: mockPermissions }
  ];

  const mockUserActions = {
    fetchUsers: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    toggleUserStatus: jest.fn(),
    bulkAssignRole: jest.fn(),
    exportUsers: jest.fn(),
    refreshUsers: jest.fn()
  };

  beforeEach(() => {
    mockUseAdminUsers.mockReturnValue({
      users: mockUsers,
      loading: false,
      error: null,
      totalUsers: mockUsers.length,
      totalPages: 1,
      ...mockUserActions
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
    it('should render user management table with all users and proper accessibility', async () => {
      // Arrange
      const expectedUsers = ['John Doe', 'Jane Manager', 'Bob Admin'];
      
      // Act
      render(<UserManagementTable />);
      
      // Assert
      await waitFor(() => {
        // Check table structure and accessibility
        const table = screen.getByRole('table', { name: /user management/i });
        expect(table).toBeInTheDocument();
        
        // Verify heading exists
        expect(screen.getByRole('heading', { level: 1, name: /user management/i })).toBeInTheDocument();
        
        // Check all expected users are rendered
        expectedUsers.forEach(userName => {
          expect(screen.getByText(userName)).toBeInTheDocument();
        });
        
        // Verify table has proper column headers
        expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /role/i })).toBeInTheDocument();
      });
    });
    
    it('should have no accessibility violations', async () => {
      // Arrange
      const { container } = render(<UserManagementTable />);
      
      // Act & Assert
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  it('should display correct user information in table rows', () => {
    render(<UserManagementTable />);

    // Check first user row
    const johnRow = screen.getByText('John Doe').closest('tr');
    expect(johnRow).toHaveTextContent('john@example.com');
    expect(johnRow).toHaveTextContent('user');
    expect(johnRow).toHaveTextContent('active');
  });

  it('should show loading state when users are being fetched', () => {
    mockUseAdminUsers.mockReturnValue({
      users: [],
      loading: true,
      error: null,
      totalUsers: 0,
      totalPages: 0,
      ...mockUserActions
    });

    render(<UserManagementTable />);
    expect(screen.getByTestId('users-loading')).toBeInTheDocument();
  });

  it('should display error message when users fail to load', () => {
    mockUseAdminUsers.mockReturnValue({
      users: [],
      loading: false,
      error: 'Failed to load users',
      totalUsers: 0,
      totalPages: 0,
      ...mockUserActions
    });

    render(<UserManagementTable />);
    expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
  });

  describe('Search and Filtering', () => {
    it('should allow user to search for users with proper debouncing', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<UserManagementTable />);
      
      // Act
      const searchInput = await screen.findByLabelText(/search users/i);
      await user.type(searchInput, 'John');
      
      // Assert
      await waitFor(() => {
        expect(searchInput).toHaveValue('John');
        expect(searchInput).toHaveAttribute('aria-describedby'); // Should have help text
      });
    });
  });

    it('should filter users when user searches for specific name', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<UserManagementTable />);
      
      // Act
      const searchInput = await screen.findByLabelText(/search users/i);
      await user.type(searchInput, 'Jane');
      
      // Assert - Wait for filtering to complete
      await waitFor(() => {
        expect(screen.getByText('Jane Manager')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Admin')).not.toBeInTheDocument();
      });
      
      // Verify search results are announced to screen readers
      const resultsAnnouncement = screen.getByRole('status');
      expect(resultsAnnouncement).toHaveTextContent(/1 user found/i);
    });

  it('should show role filter dropdown', () => {
    render(<UserManagementTable />);

    const roleFilter = screen.getByRole('combobox', { name: /filter by role/i });
    expect(roleFilter).toBeInTheDocument();

    fireEvent.click(roleFilter);
    expect(screen.getByText('All Roles')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should filter users by selected role', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const roleFilter = screen.getByRole('combobox', { name: /filter by role/i });
    await user.click(roleFilter);
    await user.click(screen.getByText('Manager'));

    // Should show only users with manager role
    expect(screen.getByText('Jane Manager')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Admin')).not.toBeInTheDocument();
  });

  it('should show status filter dropdown', () => {
    render(<UserManagementTable />);

    const statusFilter = screen.getByRole('combobox', { name: /filter by status/i });
    expect(statusFilter).toBeInTheDocument();
  });

  it('should show action buttons for users with permissions', () => {
    render(<UserManagementTable />);

    // Should show edit buttons
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons).toHaveLength(mockUsers.length);

    // Should show delete buttons
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons).toHaveLength(mockUsers.length);
  });

  it('should hide action buttons for users without permissions', () => {
    mockUseAdminPermissions.mockReturnValue({
      permissions: [],
      roles: [],
      loading: false,
      error: null,
      hasPermission: () => false,
      hasRole: () => false
    });

    render(<UserManagementTable />);

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('should open edit modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons.length).toBeGreaterThan(0);
    const firstEditButton = editButtons[0];
    expect(firstEditButton).toBeDefined();
    await user.click(firstEditButton as Element);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });
  });

  it('should show confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    const firstDeleteButton = deleteButtons[0];
    expect(firstDeleteButton).toBeDefined();
    await user.click(firstDeleteButton as Element);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  describe('User Actions', () => {
    it('should allow user to delete a user after confirmation', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockDeleteUser = jest.fn().mockResolvedValue({ success: true });
      mockUserActions.deleteUser = mockDeleteUser;
      
      render(<UserManagementTable />);
      
      // Act - Click delete button for first user
      const deleteButtons = await screen.findAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
      const firstDeleteButton = deleteButtons[0];
      expect(firstDeleteButton).toBeDefined();
      await user.click(firstDeleteButton as Element);
      
      // Verify confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
      
      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm|delete/i });
      await user.click(confirmButton);
      
      // Assert
      await waitFor(() => {
        expect(mockDeleteUser).toHaveBeenCalledWith('1'); // Expect string ID based on mock data
        // Success message should be shown
        expect(screen.getByText(/user deleted successfully/i)).toBeInTheDocument();
      });
    });
  });

  it('should show bulk actions when users are selected', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Select first user
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(1);
    const firstUserCheckbox = checkboxes[1]; // First is select all
    expect(firstUserCheckbox).toBeDefined();
    await user.click(firstUserCheckbox as Element);

    await waitFor(() => {
      expect(screen.getByText(/1 user selected/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /bulk assign role/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bulk deactivate/i })).toBeInTheDocument();
  });

  it('should handle select all functionality', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    const selectAllCheckbox = checkboxes[0];
    expect(selectAllCheckbox).toBeDefined();
    await user.click(selectAllCheckbox as Element);

    await waitFor(() => {
      expect(screen.getByText(/3 users selected/i)).toBeInTheDocument();
    });
  });

  it('should show bulk role assignment modal', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Select users
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    const selectAllCheckbox = checkboxes[0];
    expect(selectAllCheckbox).toBeDefined();
    await user.click(selectAllCheckbox as Element);

    // Click bulk assign role
    const bulkAssignButton = screen.getByRole('button', { name: /bulk assign role/i });
    await user.click(bulkAssignButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Assign Role to Selected Users')).toBeInTheDocument();
    });
  });

  it('should handle bulk role assignment', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Select users and open bulk assign modal
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    const selectAllCheckbox = checkboxes[0];
    expect(selectAllCheckbox).toBeDefined();
    await user.click(selectAllCheckbox as Element);

    const bulkAssignButton = screen.getByRole('button', { name: /bulk assign role/i });
    await user.click(bulkAssignButton);

    // Select role and confirm
    const roleSelect = screen.getByRole('combobox', { name: /select role/i });
    await user.click(roleSelect);
    await user.click(screen.getByText('Manager'));

    const confirmButton = screen.getByRole('button', { name: /assign role/i });
    await user.click(confirmButton);

    expect(mockUserActions.bulkAssignRole).toHaveBeenCalledWith([1, 2, 3], 'manager');
  });

  it('should show export functionality', () => {
    render(<UserManagementTable />);

    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).toBeInTheDocument();
  });

  it('should handle user export', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const exportButton = screen.getByRole('button', { name: /export/i });
    await user.click(exportButton);

    expect(mockUserActions.exportUsers).toHaveBeenCalled();
  });

  it('should show pagination when there are multiple pages', () => {
    mockUseAdminUsers.mockReturnValue({
      ...mockUseAdminUsers(),
      totalPages: 3
    });

    render(<UserManagementTable />);

    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should handle sorting by different columns', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Click on name column header to sort
    const nameHeader = screen.getByRole('button', { name: /name/i });
    await user.click(nameHeader);

    // Should show sort indicator
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  it('should show user details in expanded row', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Click expand button for first user
    const expandButtons = screen.getAllByRole('button', { name: /expand/i });
    expect(expandButtons.length).toBeGreaterThan(0);
    const firstExpandButton = expandButtons[0];
    expect(firstExpandButton).toBeDefined();
    await user.click(firstExpandButton as Element);

    await waitFor(() => {
      expect(screen.getByText('Registration Step:')).toBeInTheDocument();
      expect(screen.getByText('Last Login:')).toBeInTheDocument();
    });
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Focus on first row
    const firstRow = screen.getByText('John Doe').closest('tr');
    firstRow?.focus();

    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}');
    const secondRow = screen.getByText('Jane Manager').closest('tr');
    expect(secondRow).toHaveFocus();
  });

  it('should be accessible with screen readers', () => {
    render(<UserManagementTable />);

    // Table should have proper ARIA labels
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-label', 'User management table');

    // Column headers should be properly labeled
    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /role/i })).toBeInTheDocument();
  });

  it('should refresh data when refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockUserActions.refreshUsers).toHaveBeenCalled();
  });

  it('should show user creation button with proper permissions', () => {
    render(<UserManagementTable />);

    const createButton = screen.getByRole('button', { name: /create user/i });
    expect(createButton).toBeInTheDocument();
  });

  it('should hide user creation button without permissions', () => {
    mockUseAdminPermissions.mockReturnValue({
      permissions: [],
      roles: [],
      loading: false,
      error: null,
      hasPermission: () => false,
      hasRole: () => false
    });

    render(<UserManagementTable />);

    expect(screen.queryByRole('button', { name: /create user/i })).not.toBeInTheDocument();
  });

  it('should handle empty state when no users exist', () => {
    mockUseAdminUsers.mockReturnValue({
      ...mockUseAdminUsers(),
      users: [],
      totalUsers: 0
    });

    render(<UserManagementTable />);

    expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first user/i)).toBeInTheDocument();
  });

  it('should show role badge with appropriate styling', () => {
    render(<UserManagementTable />);

    const adminBadge = screen.getByText('admin');
    expect(adminBadge).toHaveClass('badge-admin');

    const managerBadge = screen.getByText('manager');
    expect(managerBadge).toHaveClass('badge-manager');

    const userBadge = screen.getByText('user');
    expect(userBadge).toHaveClass('badge-user');
  });

  it('should show status indicator with appropriate styling', () => {
    render(<UserManagementTable />);

    const activeStatuses = screen.getAllByText('active');
    activeStatuses.forEach(status => {
      expect(status).toHaveClass('status-active');
    });

    const inactiveStatus = screen.getByText('inactive');
    expect(inactiveStatus).toHaveClass('status-inactive');
  });
  
  describe('Performance and Error Handling', () => {
    it('should render within performance budget', async () => {
      // Arrange
      const startTime = performance.now();
      
      // Act
      render(<UserManagementTable />);
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - startTime;
      
      // Assert - Should render within 100ms budget
      expect(renderTime).toBeLessThan(100);
    });
    
    it('should handle component errors gracefully', async () => {
      // Arrange
      const ErrorComponent = () => {
        throw new Error('Table rendering error');
      };
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      render(
        <ErrorBoundary
          fallback={<div role="alert">Failed to load user table. Please refresh.</div>}
          onError={(error) => {
            console.error('UserTable error:', error.message);
          }}
        >
          <ErrorComponent />
        </ErrorBoundary>
      );
      
      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to load user table. Please refresh.');
        expect(consoleErrorSpy).toHaveBeenCalledWith('UserTable error:', 'Table rendering error');
      });
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle large user datasets efficiently', async () => {
      // Arrange - Mock large dataset
      const largeUserList = Array.from({ length: 500 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        cpf: `${String(i).padStart(11, '0')}`,
        role: i % 3 === 0 ? 'admin' : i % 2 === 0 ? 'manager' : 'user',
        registration_step: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        isActive: true
      }));
      
      mockUseAdminUsers.mockReturnValue({
        users: largeUserList,
        loading: false,
        error: null,
        totalUsers: largeUserList.length,
        totalPages: Math.ceil(largeUserList.length / 50),
        ...mockUserActions
      });
      
      const startTime = performance.now();
      
      // Act
      render(<UserManagementTable />);
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - startTime;
      
      // Assert - Should handle large datasets efficiently
      expect(renderTime).toBeLessThan(200); // Slightly higher budget for large data
    });
  });
});