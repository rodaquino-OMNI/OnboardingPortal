import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserManagementTable } from '@/components/admin/UserManagementTable';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

// Mock hooks
jest.mock('@/hooks/useAdminUsers');
jest.mock('@/hooks/useAdminPermissions');

const mockUseAdminUsers = useAdminUsers as jest.MockedFunction<typeof useAdminUsers>;
const mockUseAdminPermissions = useAdminPermissions as jest.MockedFunction<typeof useAdminPermissions>;

describe('UserManagementTable Component', () => {
  const mockUsers = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      cpf: '12345678901',
      roles: ['user'],
      status: 'active',
      registration_step: 'completed',
      created_at: '2024-01-15T10:00:00Z',
      last_login: '2024-01-20T14:30:00Z'
    },
    {
      id: 2,
      name: 'Jane Manager',
      email: 'jane@example.com',
      cpf: '98765432109',
      roles: ['manager'],
      status: 'active',
      registration_step: 'completed',
      created_at: '2024-01-10T09:00:00Z',
      last_login: '2024-01-19T16:45:00Z'
    },
    {
      id: 3,
      name: 'Bob Admin',
      email: 'bob@example.com',
      cpf: '11122233344',
      roles: ['admin'],
      status: 'inactive',
      registration_step: 'completed',
      created_at: '2024-01-05T08:00:00Z',
      last_login: '2024-01-18T11:20:00Z'
    }
  ];

  const mockAdminPermissions = {
    canManageUsers: true,
    canViewUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canManageRoles: true,
    canPerformBulkOperations: true
  };

  const mockUserActions = {
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    assignRole: jest.fn(),
    bulkAssignRole: jest.fn(),
    bulkDeactivate: jest.fn(),
    exportUsers: jest.fn(),
    refreshUsers: jest.fn()
  };

  beforeEach(() => {
    mockUseAdminUsers.mockReturnValue({
      users: mockUsers,
      isLoading: false,
      error: null,
      totalUsers: mockUsers.length,
      currentPage: 1,
      totalPages: 1,
      ...mockUserActions
    });

    mockUseAdminPermissions.mockReturnValue(mockAdminPermissions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render user management table with all users', () => {
    render(<UserManagementTable />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Manager')).toBeInTheDocument();
    expect(screen.getByText('Bob Admin')).toBeInTheDocument();
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
      ...mockUseAdminUsers(),
      isLoading: true,
      users: []
    });

    render(<UserManagementTable />);
    expect(screen.getByTestId('users-loading')).toBeInTheDocument();
  });

  it('should display error message when users fail to load', () => {
    mockUseAdminUsers.mockReturnValue({
      ...mockUseAdminUsers(),
      isLoading: false,
      error: 'Failed to load users',
      users: []
    });

    render(<UserManagementTable />);
    expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
  });

  it('should show search functionality', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const searchInput = screen.getByPlaceholderText(/search users/i);
    expect(searchInput).toBeInTheDocument();

    await user.type(searchInput, 'John');
    expect(searchInput).toHaveValue('John');
  });

  it('should filter users based on search query', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const searchInput = screen.getByPlaceholderText(/search users/i);
    await user.type(searchInput, 'Jane');

    // Should show only Jane Manager
    expect(screen.getByText('Jane Manager')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
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
      ...mockAdminPermissions,
      canEditUsers: false,
      canDeleteUsers: false
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
    await user.click(editButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit User')).toBeInTheDocument();
  });

  it('should show confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('should handle user deletion', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    expect(mockUserActions.deleteUser).toHaveBeenCalledWith(1);
  });

  it('should show bulk actions when users are selected', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Select first user
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(1);
    await user.click(checkboxes[1]); // First is select all

    expect(screen.getByText(/1 user selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bulk assign role/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bulk deactivate/i })).toBeInTheDocument();
  });

  it('should handle select all functionality', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    await user.click(checkboxes[0]);

    expect(screen.getByText(/3 users selected/i)).toBeInTheDocument();
  });

  it('should show bulk role assignment modal', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Select users
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    await user.click(checkboxes[0]);

    // Click bulk assign role
    const bulkAssignButton = screen.getByRole('button', { name: /bulk assign role/i });
    await user.click(bulkAssignButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Assign Role to Selected Users')).toBeInTheDocument();
  });

  it('should handle bulk role assignment', async () => {
    const user = userEvent.setup();
    render(<UserManagementTable />);

    // Select users and open bulk assign modal
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    await user.click(checkboxes[0]);

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
      totalPages: 3,
      currentPage: 1
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
    await user.click(expandButtons[0]);

    expect(screen.getByText('Registration Step:')).toBeInTheDocument();
    expect(screen.getByText('Last Login:')).toBeInTheDocument();
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
      ...mockAdminPermissions,
      canManageUsers: false
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
});