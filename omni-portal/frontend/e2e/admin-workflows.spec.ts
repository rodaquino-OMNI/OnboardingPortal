import { test, expect, Page } from '@playwright/test';

// Test utilities
class AdminTestHelper {
  constructor(private page: Page) {}

  async loginAsAdmin() {
    await this.page.goto('/auth/login');
    await this.page.fill('[data-testid="email-input"]', 'admin@example.com');
    await this.page.fill('[data-testid="password-input"]', 'AdminPassword123!');
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('/admin/dashboard');
  }

  async loginAsManager() {
    await this.page.goto('/auth/login');
    await this.page.fill('[data-testid="email-input"]', 'manager@example.com');
    await this.page.fill('[data-testid="password-input"]', 'ManagerPassword123!');
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('/admin/dashboard');
  }

  async loginAsUser() {
    await this.page.goto('/auth/login');
    await this.page.fill('[data-testid="email-input"]', 'user@example.com');
    await this.page.fill('[data-testid="password-input"]', 'UserPassword123!');
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('/home');
  }

  async navigateToUserManagement() {
    await this.page.click('[data-testid="admin-nav-users"]');
    await this.page.waitForSelector('[data-testid="user-management-table"]');
  }

  async createTestUser(userData: {
    name: string;
    email: string;
    cpf: string;
    role?: string;
  }) {
    await this.page.click('[data-testid="create-user-button"]');
    await this.page.waitForSelector('[data-testid="create-user-modal"]');

    await this.page.fill('[data-testid="user-name-input"]', userData.name);
    await this.page.fill('[data-testid="user-email-input"]', userData.email);
    await this.page.fill('[data-testid="user-cpf-input"]', userData.cpf);

    if (userData.role) {
      await this.page.selectOption('[data-testid="user-role-select"]', userData.role);
    }

    await this.page.click('[data-testid="create-user-submit"]');
    await this.page.waitForSelector('[data-testid="success-notification"]');
    await this.page.waitForSelector('[data-testid="create-user-modal"]', { state: 'hidden' });
  }

  async deleteUser(userEmail: string) {
    const userRow = this.page.locator(`[data-testid="user-row"]:has-text("${userEmail}")`);
    await userRow.locator('[data-testid="delete-user-button"]').click();
    
    await this.page.waitForSelector('[data-testid="confirm-delete-modal"]');
    await this.page.click('[data-testid="confirm-delete-button"]');
    await this.page.waitForSelector('[data-testid="success-notification"]');
  }

  async bulkSelectUsers(emails: string[]) {
    for (const email of emails) {
      const userRow = this.page.locator(`[data-testid="user-row"]:has-text("${email}")`);
      await userRow.locator('[data-testid="user-checkbox"]').check();
    }
  }

  async expectUserInTable(email: string, shouldExist: boolean = true) {
    const userRow = this.page.locator(`[data-testid="user-row"]:has-text("${email}")`);
    if (shouldExist) {
      await expect(userRow).toBeVisible();
    } else {
      await expect(userRow).toHaveCount(0);
    }
  }

  async expectPermissionDenied() {
    await expect(this.page.locator('[data-testid="permission-denied"]')).toBeVisible();
  }

  async expectSuccessNotification(message?: string) {
    const notification = this.page.locator('[data-testid="success-notification"]');
    await expect(notification).toBeVisible();
    if (message) {
      await expect(notification).toContainText(message);
    }
  }
}

test.describe('Admin Dashboard Workflows', () => {
  let adminHelper: AdminTestHelper;

  test.beforeEach(async ({ page }) => {
    adminHelper = new AdminTestHelper(page);
  });

  test.describe('Admin User Management', () => {
    test('should allow admin to create, edit, and delete users', async ({ page }) => {
      await adminHelper.loginAsAdmin();
      await adminHelper.navigateToUserManagement();

      // Create new user
      const testUser = {
        name: 'Test User',
        email: 'testuser@example.com',
        cpf: '12345678901',
        role: 'user'
      };

      await adminHelper.createTestUser(testUser);
      await adminHelper.expectUserInTable(testUser.email);

      // Edit user
      const userRow = page.locator(`[data-testid="user-row"]:has-text("${testUser.email}")`);
      await userRow.locator('[data-testid="edit-user-button"]').click();
      
      await page.waitForSelector('[data-testid="edit-user-modal"]');
      await page.fill('[data-testid="user-name-input"]', 'Updated Test User');
      await page.click('[data-testid="update-user-submit"]');
      
      await adminHelper.expectSuccessNotification('User updated successfully');
      await expect(page.locator('text=Updated Test User')).toBeVisible();

      // Delete user
      await adminHelper.deleteUser(testUser.email);
      await adminHelper.expectUserInTable(testUser.email, false);
    });

    test('should allow admin to perform bulk operations', async ({ page }) => {
      await adminHelper.loginAsAdmin();
      await adminHelper.navigateToUserManagement();

      // Create multiple test users
      const testUsers = [
        { name: 'Bulk User 1', email: 'bulk1@example.com', cpf: '11111111111' },
        { name: 'Bulk User 2', email: 'bulk2@example.com', cpf: '22222222222' },
        { name: 'Bulk User 3', email: 'bulk3@example.com', cpf: '33333333333' }
      ];

      for (const user of testUsers) {
        await adminHelper.createTestUser(user);
      }

      // Select all created users
      await adminHelper.bulkSelectUsers(testUsers.map(u => u.email));

      // Bulk assign manager role
      await page.click('[data-testid="bulk-assign-role-button"]');
      await page.waitForSelector('[data-testid="bulk-role-modal"]');
      await page.selectOption('[data-testid="bulk-role-select"]', 'manager');
      await page.click('[data-testid="bulk-assign-confirm"]');

      await adminHelper.expectSuccessNotification('Roles assigned successfully');

      // Verify role changes
      for (const user of testUsers) {
        const userRow = page.locator(`[data-testid="user-row"]:has-text("${user.email}")`);
        await expect(userRow.locator('[data-testid="user-role-badge"]')).toContainText('manager');
      }

      // Bulk export
      await adminHelper.bulkSelectUsers(testUsers.map(u => u.email));
      await page.click('[data-testid="bulk-export-button"]');

      // Wait for download to start
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-csv-button"]');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/users_export_.*\.csv/);
    });

    test('should allow admin to manage user roles and permissions', async ({ page }) => {
      await adminHelper.loginAsAdmin();
      
      // Navigate to roles management
      await page.click('[data-testid="admin-nav-roles"]');
      await page.waitForSelector('[data-testid="role-management-table"]');

      // Create custom role
      await page.click('[data-testid="create-role-button"]');
      await page.waitForSelector('[data-testid="create-role-modal"]');

      await page.fill('[data-testid="role-name-input"]', 'custom-role');
      await page.fill('[data-testid="role-display-name-input"]', 'Custom Role');

      // Select permissions
      await page.check('[data-testid="permission-view-users"]');
      await page.check('[data-testid="permission-edit-users"]');

      await page.click('[data-testid="create-role-submit"]');
      await adminHelper.expectSuccessNotification('Role created successfully');

      // Verify role appears in table
      await expect(page.locator('text=Custom Role')).toBeVisible();

      // Edit role permissions
      const roleRow = page.locator(`[data-testid="role-row"]:has-text("Custom Role")`);
      await roleRow.locator('[data-testid="edit-role-button"]').click();

      await page.waitForSelector('[data-testid="edit-role-modal"]');
      await page.check('[data-testid="permission-view-reports"]');
      await page.click('[data-testid="update-role-submit"]');

      await adminHelper.expectSuccessNotification('Role updated successfully');
    });
  });

  test.describe('Manager User Permissions', () => {
    test('should allow manager limited user management access', async ({ page }) => {
      await adminHelper.loginAsManager();
      await adminHelper.navigateToUserManagement();

      // Should see user table
      await expect(page.locator('[data-testid="user-management-table"]')).toBeVisible();

      // Should not see create user button
      await expect(page.locator('[data-testid="create-user-button"]')).toHaveCount(0);

      // Should not see delete buttons
      await expect(page.locator('[data-testid="delete-user-button"]')).toHaveCount(0);

      // Should see edit buttons
      await expect(page.locator('[data-testid="edit-user-button"]').first()).toBeVisible();

      // Should not have access to roles management
      await page.click('[data-testid="admin-nav-roles"]');
      await adminHelper.expectPermissionDenied();
    });

    test('should allow manager to export user data', async ({ page }) => {
      await adminHelper.loginAsManager();
      await adminHelper.navigateToUserManagement();

      // Should be able to export data
      await page.click('[data-testid="export-users-button"]');
      
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-csv-confirm"]');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/users_export_.*\.csv/);
    });

    test('should prevent manager from accessing system configuration', async ({ page }) => {
      await adminHelper.loginAsManager();

      // Try to navigate to system config
      await page.goto('/admin/system');
      await adminHelper.expectPermissionDenied();
    });
  });

  test.describe('Regular User Access Control', () => {
    test('should prevent regular user from accessing admin dashboard', async ({ page }) => {
      await adminHelper.loginAsUser();

      // Try to access admin dashboard directly
      await page.goto('/admin/dashboard');
      await adminHelper.expectPermissionDenied();

      // Try to access admin API endpoints
      const response = await page.request.get('/api/admin/users');
      expect(response.status()).toBe(403);
    });

    test('should redirect regular user to home dashboard', async ({ page }) => {
      await adminHelper.loginAsUser();
      
      // Should be on home dashboard
      await expect(page).toHaveURL('/home');
      await expect(page.locator('[data-testid="user-dashboard"]')).toBeVisible();
    });
  });

  test.describe('System Configuration Management', () => {
    test('should allow admin to view and update system settings', async ({ page }) => {
      await adminHelper.loginAsAdmin();

      // Navigate to system configuration
      await page.click('[data-testid="admin-nav-system"]');
      await page.waitForSelector('[data-testid="system-config-panel"]');

      // View current settings
      await expect(page.locator('[data-testid="app-settings-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="security-settings-section"]')).toBeVisible();

      // Update maintenance mode setting
      await page.check('[data-testid="maintenance-mode-toggle"]');
      await page.click('[data-testid="save-settings-button"]');

      // Should show confirmation dialog for critical changes
      await page.waitForSelector('[data-testid="confirm-maintenance-modal"]');
      await page.click('[data-testid="confirm-maintenance-button"]');

      await adminHelper.expectSuccessNotification('Settings updated successfully');

      // Verify maintenance mode is active
      await expect(page.locator('[data-testid="maintenance-mode-indicator"]')).toBeVisible();
    });

    test('should show system health metrics', async ({ page }) => {
      await adminHelper.loginAsAdmin();

      await page.click('[data-testid="admin-nav-system"]');
      await page.waitForSelector('[data-testid="system-health-metrics"]');

      // Should display key metrics
      await expect(page.locator('[data-testid="active-users-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="system-uptime-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="response-time-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-rate-metric"]')).toBeVisible();

      // Should refresh metrics when button clicked
      await page.click('[data-testid="refresh-metrics-button"]');
      await expect(page.locator('[data-testid="metrics-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="metrics-loading"]')).toHaveCount(0);
    });
  });

  test.describe('Audit Log Monitoring', () => {
    test('should display comprehensive audit logs', async ({ page }) => {
      await adminHelper.loginAsAdmin();

      // Navigate to audit logs
      await page.click('[data-testid="admin-nav-audit"]');
      await page.waitForSelector('[data-testid="audit-log-table"]');

      // Should show log entries
      await expect(page.locator('[data-testid="audit-log-entry"]').first()).toBeVisible();

      // Should be able to filter by action type
      await page.selectOption('[data-testid="audit-action-filter"]', 'user_created');
      await page.click('[data-testid="apply-filter-button"]');

      // Should show only user creation logs
      const logEntries = page.locator('[data-testid="audit-log-entry"]');
      const count = await logEntries.count();
      
      for (let i = 0; i < count; i++) {
        await expect(logEntries.nth(i)).toContainText('user_created');
      }

      // Should be able to search logs
      await page.fill('[data-testid="audit-search-input"]', 'admin@example.com');
      await page.click('[data-testid="search-logs-button"]');

      // Results should contain admin user actions
      const adminLogCount = await page.locator('[data-testid="audit-log-entry"]:has-text("admin@example.com")').count();
      expect(adminLogCount).toBeGreaterThanOrEqual(1);
    });

    test('should allow detailed log entry inspection', async ({ page }) => {
      await adminHelper.loginAsAdmin();
      await page.click('[data-testid="admin-nav-audit"]');
      await page.waitForSelector('[data-testid="audit-log-table"]');

      // Click on first log entry
      await page.locator('[data-testid="audit-log-entry"]').first().click();
      await page.waitForSelector('[data-testid="audit-detail-modal"]');

      // Should show detailed information
      await expect(page.locator('[data-testid="audit-timestamp"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-user"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-action"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-ip-address"]')).toBeVisible();
    });
  });

  test.describe('Reports and Analytics', () => {
    test('should generate user activity reports', async ({ page }) => {
      await adminHelper.loginAsAdmin();

      // Navigate to reports
      await page.click('[data-testid="admin-nav-reports"]');
      await page.waitForSelector('[data-testid="reports-dashboard"]');

      // Generate user activity report
      await page.click('[data-testid="generate-user-activity-report"]');
      await page.waitForSelector('[data-testid="report-config-modal"]');

      // Configure report parameters
      await page.fill('[data-testid="report-start-date"]', '2024-01-01');
      await page.fill('[data-testid="report-end-date"]', '2024-12-31');
      await page.selectOption('[data-testid="report-format"]', 'pdf');

      await page.click('[data-testid="generate-report-button"]');

      // Should show report generation progress
      await expect(page.locator('[data-testid="report-progress"]')).toBeVisible();

      // Wait for report completion
      await expect(page.locator('[data-testid="report-ready"]')).toBeVisible({ timeout: 30000 });

      // Should be able to download report
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-report-button"]');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/user_activity_report_.*\.pdf/);
    });

    test('should display real-time dashboard metrics', async ({ page }) => {
      await adminHelper.loginAsAdmin();

      // Should see real-time metrics on main dashboard
      await expect(page.locator('[data-testid="realtime-user-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="realtime-activity-feed"]')).toBeVisible();

      // Metrics should update automatically
      const initialCount = await page.locator('[data-testid="realtime-user-count"]').textContent();
      
      // Wait for potential updates
      await page.waitForTimeout(5000);
      
      // Should have real-time update capability
      await expect(page.locator('[data-testid="last-updated-timestamp"]')).toBeVisible();
    });
  });

  test.describe('Security and Authentication', () => {
    test('should enforce session timeouts for admin users', async ({ page }) => {
      await adminHelper.loginAsAdmin();

      // Mock session expiration
      await page.evaluate(() => {
        localStorage.setItem('admin_session_expired', 'true');
      });

      // Navigate to any admin page
      await page.reload();

      // Should be redirected to login
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    });

    test('should log all admin actions for audit trail', async ({ page }) => {
      await adminHelper.loginAsAdmin();
      await adminHelper.navigateToUserManagement();

      // Perform admin action
      const testUser = {
        name: 'Audit Test User',
        email: 'audittest@example.com',
        cpf: '99999999999'
      };

      await adminHelper.createTestUser(testUser);

      // Check audit logs
      await page.click('[data-testid="admin-nav-audit"]');
      await page.waitForSelector('[data-testid="audit-log-table"]');

      // Should see the user creation action
      const count = await page.locator('[data-testid="audit-log-entry"]:has-text("user_created")').count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should prevent CSRF attacks on admin endpoints', async ({ page }) => {
      await adminHelper.loginAsAdmin();

      // Attempt to make admin API call without proper CSRF token
      const response = await page.evaluate(async () => {
        return fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'CSRF Test User',
            email: 'csrf@example.com'
          })
        });
      });

      // Should be rejected due to missing CSRF token
      expect(response.status).toBe(403);
    });
  });

  test.describe('Mobile and Responsive Design', () => {
    test('should work properly on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await adminHelper.loginAsAdmin();

      // Should show mobile navigation
      await expect(page.locator('[data-testid="mobile-nav-toggle"]')).toBeVisible();

      // Open mobile menu
      await page.click('[data-testid="mobile-nav-toggle"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();

      // Navigate to users
      await page.click('[data-testid="mobile-nav-users"]');
      await page.waitForSelector('[data-testid="user-management-table"]');

      // Table should be responsive
      await expect(page.locator('[data-testid="responsive-table-wrapper"]')).toBeVisible();
    });

    test('should maintain functionality on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      await adminHelper.loginAsAdmin();

      // Should show adapted layout for tablet
      await expect(page.locator('[data-testid="tablet-sidebar"]')).toBeVisible();

      // All admin functions should work
      await adminHelper.navigateToUserManagement();
      await expect(page.locator('[data-testid="user-management-table"]')).toBeVisible();
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle large user datasets efficiently', async ({ page }) => {
      await adminHelper.loginAsAdmin();
      await adminHelper.navigateToUserManagement();

      // Test pagination with large dataset
      await page.goto('/admin/users?page=1&limit=100');
      
      // Should load within acceptable time
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="user-management-table"]');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000); // 3 second max load time

      // Should show pagination controls
      await expect(page.locator('[data-testid="pagination-controls"]')).toBeVisible();
    });

    test('should handle concurrent admin operations', async ({ page, context }) => {
      // Create multiple admin sessions
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const helper1 = new AdminTestHelper(page1);
      const helper2 = new AdminTestHelper(page2);

      await helper1.loginAsAdmin();
      await helper2.loginAsAdmin();

      // Perform concurrent operations
      const operations = [
        helper1.navigateToUserManagement(),
        helper2.navigateToUserManagement()
      ];

      await Promise.all(operations);

      // Both should work without interference
      await expect(page1.locator('[data-testid="user-management-table"]')).toBeVisible();
      await expect(page2.locator('[data-testid="user-management-table"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      await adminHelper.loginAsAdmin();

      // Mock API error
      await page.route('/api/admin/users', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      await adminHelper.navigateToUserManagement();

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

      // Should be able to retry
      await page.unroute('/api/admin/users');
      await page.click('[data-testid="retry-button"]');
      
      await expect(page.locator('[data-testid="user-management-table"]')).toBeVisible();
    });

    test('should recover from network failures', async ({ page }) => {
      await adminHelper.loginAsAdmin();
      await adminHelper.navigateToUserManagement();

      // Simulate network failure
      await page.context().setOffline(true);

      // Try to perform action
      await page.click('[data-testid="refresh-users-button"]');

      // Should show offline message
      await expect(page.locator('[data-testid="offline-notice"]')).toBeVisible();

      // Restore network
      await page.context().setOffline(false);

      // Should automatically recover
      await expect(page.locator('[data-testid="offline-notice"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="user-management-table"]')).toBeVisible();
    });
  });
});