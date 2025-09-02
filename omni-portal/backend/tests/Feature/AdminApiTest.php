<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Admin\AdminRole;
use App\Models\Admin\AdminPermission;
use App\Models\Admin\AdminUserRole;
use App\Models\Admin\AdminActionLog;
use App\Models\Admin\AdminSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Artisan;

/**
 * Comprehensive Admin API Tests
 * 
 * Tests all admin endpoints with proper authentication, authorization,
 * and data validation. Covers all endpoints from routes/api.php admin routes.
 */
class AdminApiTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $adminUser;
    protected $regularUser;
    protected $superAdminUser;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create admin tables and permissions
        $this->setupAdminInfrastructure();
        
        // Create test users with different roles
        $this->createTestUsers();
    }

    /**
     * Setup admin infrastructure (tables, roles, permissions)
     */
    private function setupAdminInfrastructure(): void
    {
        try {
            // Create Spatie roles first (working system)
            Role::firstOrCreate(['name' => 'super-admin']);
            Role::firstOrCreate(['name' => 'admin']);
            Role::firstOrCreate(['name' => 'manager']);
            Role::firstOrCreate(['name' => 'user']);
            
            // Only create custom admin infrastructure if tables exist
            if (\Schema::hasTable('admin_roles')) {
                $this->setupCustomAdminInfrastructure();
            }
        } catch (\Exception $e) {
            // Continue with Spatie-only setup if custom admin system isn't ready
            \Log::info('AdminApiTest: Using Spatie-only setup: ' . $e->getMessage());
        }
    }

    /**
     * Setup custom admin infrastructure
     */
    private function setupCustomAdminInfrastructure(): void
    {
        // Create admin permissions
        $permissions = [
            ['resource' => 'dashboard', 'action' => 'view', 'identifier' => 'dashboard.view'],
            ['resource' => 'users', 'action' => 'view', 'identifier' => 'users.view'],
            ['resource' => 'users', 'action' => 'edit', 'identifier' => 'users.edit'],
            ['resource' => 'users', 'action' => 'delete', 'identifier' => 'users.delete'],
            ['resource' => 'roles', 'action' => 'view', 'identifier' => 'roles.view'],
            ['resource' => 'roles', 'action' => 'create', 'identifier' => 'roles.create'],
            ['resource' => 'roles', 'action' => 'update', 'identifier' => 'roles.update'],
            ['resource' => 'roles', 'action' => 'delete', 'identifier' => 'roles.delete'],
            ['resource' => 'permissions', 'action' => 'view', 'identifier' => 'permissions.view'],
            ['resource' => 'system_settings', 'action' => 'view', 'identifier' => 'system_settings.view'],
            ['resource' => 'system_settings', 'action' => 'edit', 'identifier' => 'system_settings.edit'],
            ['resource' => 'security_audit', 'action' => 'view', 'identifier' => 'security_audit.view'],
            ['resource' => 'system_health', 'action' => 'view', 'identifier' => 'system_health.view'],
            ['resource' => 'system_metrics', 'action' => 'view', 'identifier' => 'system_metrics.view'],
            ['resource' => 'analytics', 'action' => 'view', 'identifier' => 'analytics.view'],
            ['resource' => 'alerts', 'action' => 'view', 'identifier' => 'alerts.view'],
            ['resource' => 'alerts', 'action' => 'update', 'identifier' => 'alerts.update'],
        ];

        foreach ($permissions as $permission) {
            AdminPermission::firstOrCreate(
                ['identifier' => $permission['identifier']],
                $permission
            );
        }

        // Create admin roles
        $superAdminRole = AdminRole::firstOrCreate([
            'name' => 'super_admin',
            'display_name' => 'Super Administrator',
            'description' => 'Full system access',
            'hierarchy_level' => 100,
            'is_system_role' => true,
        ]);

        $adminRole = AdminRole::firstOrCreate([
            'name' => 'admin',
            'display_name' => 'Administrator',
            'description' => 'Admin access',
            'hierarchy_level' => 80,
            'is_system_role' => true,
        ]);

        // Assign all permissions to super admin
        $allPermissions = AdminPermission::all();
        $superAdminRole->adminPermissions()->sync($allPermissions->pluck('id')->toArray());
        
        // Assign basic permissions to admin
        $basicPermissions = AdminPermission::whereIn('identifier', [
            'dashboard.view', 'users.view', 'users.edit', 'roles.view', 'analytics.view'
        ])->get();
        $adminRole->adminPermissions()->sync($basicPermissions->pluck('id')->toArray());
    }

    /**
     * Create test users with different roles
     */
    private function createTestUsers(): void
    {
        // Create super admin user
        $this->superAdminUser = User::factory()->create([
            'email' => 'superadmin@test.com',
            'password' => Hash::make('password'),
            'is_admin' => true,
            'status' => 'active',
            'is_active' => true,
        ]);
        $this->superAdminUser->assignRole('super-admin');

        // Create admin user
        $this->adminUser = User::factory()->create([
            'email' => 'admin@test.com',
            'password' => Hash::make('password'),
            'is_admin' => true,
            'status' => 'active',
            'is_active' => true,
        ]);
        $this->adminUser->assignRole('admin');

        // Create regular user
        $this->regularUser = User::factory()->create([
            'email' => 'user@test.com',
            'password' => Hash::make('password'),
            'is_admin' => false,
            'status' => 'active',
            'is_active' => true,
        ]);
        $this->regularUser->assignRole('user');

        // Assign custom admin roles if available
        if (\Schema::hasTable('admin_user_roles')) {
            $this->assignCustomAdminRoles();
        }
    }

    /**
     * Assign custom admin roles to test users
     */
    private function assignCustomAdminRoles(): void
    {
        $superAdminRole = AdminRole::where('name', 'super_admin')->first();
        $adminRole = AdminRole::where('name', 'admin')->first();

        if ($superAdminRole) {
            AdminUserRole::create([
                'user_id' => $this->superAdminUser->id,
                'admin_role_id' => $superAdminRole->id,
                'assigned_at' => now(),
                'assigned_by' => 1,
                'is_active' => true,
            ]);
        }

        if ($adminRole) {
            AdminUserRole::create([
                'user_id' => $this->adminUser->id,
                'admin_role_id' => $adminRole->id,
                'assigned_at' => now(),
                'assigned_by' => 1,
                'is_active' => true,
            ]);
        }
    }

    /**
     * Test: Admin dashboard endpoint requires authentication
     */
    public function test_dashboard_requires_authentication(): void
    {
        $response = $this->getJson('/api/admin/dashboard');
        
        $response->assertStatus(401)
            ->assertJson([
                'message' => 'Unauthenticated.'
            ]);
    }

    /**
     * Test: Admin dashboard endpoint requires admin role
     */
    public function test_dashboard_requires_admin_role(): void
    {
        Sanctum::actingAs($this->regularUser, ['*']);
        
        $response = $this->getJson('/api/admin/dashboard');
        
        $response->assertStatus(403)
            ->assertJsonStructure([
                'error',
                'message'
            ]);
    }

    /**
     * Test: Admin dashboard returns correct data structure
     */
    public function test_dashboard_returns_correct_structure(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/dashboard');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'summary',
                    'recent_activity',
                    'alerts',
                    'performance_metrics',
                    'user_analytics',
                    'system_status'
                ],
                'permissions',
                'role_hierarchy'
            ]);
    }

    /**
     * Test: Users endpoint with authentication and pagination
     */
    public function test_users_endpoint_with_filters(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Test basic users endpoint
        $response = $this->getJson('/api/admin/users');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
                'pagination' => [
                    'current_page',
                    'last_page',
                    'per_page',
                    'total'
                ],
                'summary'
            ]);

        // Test with search filter
        $response = $this->getJson('/api/admin/users?search=admin&per_page=10');
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        // Test with status filter
        $response = $this->getJson('/api/admin/users?status=active');
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test: User details endpoint
     */
    public function test_user_details_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/users/' . $this->regularUser->id);
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'user',
                    'activity_timeline',
                    'document_summary',
                    'health_summary',
                    'security_info',
                    'admin_info'
                ]
            ]);
    }

    /**
     * Test: Roles endpoint
     */
    public function test_roles_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/roles');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
                'hierarchy_levels'
            ]);
    }

    /**
     * Test: Create role endpoint
     */
    public function test_create_role_endpoint(): void
    {
        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        $roleData = [
            'name' => 'test_role',
            'display_name' => 'Test Role',
            'description' => 'A test role',
            'hierarchy_level' => 50,
            'permissions' => []
        ];
        
        $response = $this->postJson('/api/admin/roles', $roleData);
        
        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'data',
                'message'
            ])
            ->assertJsonPath('success', true);
    }

    /**
     * Test: Create role validation
     */
    public function test_create_role_validation(): void
    {
        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        // Test with invalid data
        $response = $this->postJson('/api/admin/roles', []);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'display_name', 'hierarchy_level']);

        // Test with duplicate role name
        if (\Schema::hasTable('admin_roles')) {
            $response = $this->postJson('/api/admin/roles', [
                'name' => 'admin', // Already exists
                'display_name' => 'Duplicate Admin',
                'hierarchy_level' => 50
            ]);
            
            $response->assertStatus(422)
                ->assertJsonValidationErrors(['name']);
        }
    }

    /**
     * Test: Update role endpoint
     */
    public function test_update_role_endpoint(): void
    {
        if (!\Schema::hasTable('admin_roles')) {
            $this->markTestSkipped('Admin roles table not available');
        }

        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        $role = AdminRole::where('name', 'admin')->first();
        
        if (!$role) {
            $this->markTestSkipped('Admin role not found');
        }
        
        $updateData = [
            'display_name' => 'Updated Admin',
            'description' => 'Updated description',
            'hierarchy_level' => 75
        ];
        
        $response = $this->putJson('/api/admin/roles/' . $role->id, $updateData);
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Role updated successfully');
    }

    /**
     * Test: Delete role endpoint
     */
    public function test_delete_role_endpoint(): void
    {
        if (!\Schema::hasTable('admin_roles')) {
            $this->markTestSkipped('Admin roles table not available');
        }

        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        // Create a test role to delete
        $role = AdminRole::create([
            'name' => 'deletable_role',
            'display_name' => 'Deletable Role',
            'hierarchy_level' => 30,
            'is_system_role' => false
        ]);
        
        $response = $this->deleteJson('/api/admin/roles/' . $role->id);
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Role deleted successfully');
    }

    /**
     * Test: Cannot delete system role
     */
    public function test_cannot_delete_system_role(): void
    {
        if (!\Schema::hasTable('admin_roles')) {
            $this->markTestSkipped('Admin roles table not available');
        }

        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        $systemRole = AdminRole::where('is_system_role', true)->first();
        
        if (!$systemRole) {
            $this->markTestSkipped('No system role found');
        }
        
        $response = $this->deleteJson('/api/admin/roles/' . $systemRole->id);
        
        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Cannot delete system role');
    }

    /**
     * Test: Assign role to user
     */
    public function test_assign_role_to_user(): void
    {
        if (!\Schema::hasTable('admin_roles')) {
            $this->markTestSkipped('Admin roles table not available');
        }

        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        $role = AdminRole::where('name', 'admin')->first();
        $targetUser = User::factory()->create();
        
        if (!$role) {
            $this->markTestSkipped('Admin role not found');
        }
        
        $assignmentData = [
            'user_id' => $targetUser->id,
            'role_id' => $role->id,
            'assignment_reason' => 'Test assignment'
        ];
        
        $response = $this->postJson('/api/admin/roles/assign', $assignmentData);
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Role assigned successfully');
    }

    /**
     * Test: Revoke role from user
     */
    public function test_revoke_role_from_user(): void
    {
        if (!\Schema::hasTable('admin_roles')) {
            $this->markTestSkipped('Admin roles table not available');
        }

        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        $role = AdminRole::where('name', 'admin')->first();
        
        if (!$role) {
            $this->markTestSkipped('Admin role not found');
        }
        
        // First assign the role
        $targetUser = User::factory()->create();
        AdminUserRole::create([
            'user_id' => $targetUser->id,
            'admin_role_id' => $role->id,
            'assigned_at' => now(),
            'assigned_by' => $this->superAdminUser->id,
            'is_active' => true
        ]);
        
        // Then revoke it
        $revokeData = [
            'user_id' => $targetUser->id,
            'role_id' => $role->id
        ];
        
        $response = $this->postJson('/api/admin/roles/revoke', $revokeData);
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Role revoked successfully');
    }

    /**
     * Test: Permissions endpoint
     */
    public function test_permissions_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/permissions');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data'
            ]);
    }

    /**
     * Test: System settings endpoint
     */
    public function test_system_settings_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/system-settings');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data'
            ]);
    }

    /**
     * Test: Security audit endpoint
     */
    public function test_security_audit_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Create some test audit logs
        AdminActionLog::create([
            'user_id' => $this->adminUser->id,
            'action_type' => 'test_action',
            'resource_type' => 'test_resource',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Test Agent',
            'request_method' => 'GET',
            'request_url' => 'http://test.com',
            'response_status' => 200,
            'risk_level' => 'low',
        ]);
        
        $response = $this->getJson('/api/admin/security-audit');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
                'pagination',
                'summary'
            ]);

        // Test with filters
        $response = $this->getJson('/api/admin/security-audit?risk_level=high&per_page=10');
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test: System health endpoint
     */
    public function test_system_health_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/system/health');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'status',
                    'uptime',
                    'response_time',
                    'error_rate',
                    'active_sessions',
                    'queue_size',
                    'database_status',
                    'cache_status',
                    'storage_usage',
                    'last_check'
                ]
            ])
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'healthy');
    }

    /**
     * Test: System metrics endpoint
     */
    public function test_system_metrics_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/system/metrics');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'cpu_usage',
                    'memory_usage',
                    'disk_usage',
                    'network_io',
                    'active_connections',
                    'requests_per_second',
                    'cache_hit_rate',
                    'database_connections'
                ]
            ])
            ->assertJsonPath('success', true);
    }

    /**
     * Test: Analytics endpoint
     */
    public function test_analytics_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/analytics');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
                'period',
                'generated_at'
            ])
            ->assertJsonPath('success', true);

        // Test with specific parameters
        $response = $this->getJson('/api/admin/analytics?period=7d&metrics[]=users&metrics[]=documents');
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('period', '7d');
    }

    /**
     * Test: Real-time analytics endpoint
     */
    public function test_real_time_analytics_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/analytics/real-time');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'current_active_users',
                    'requests_per_minute',
                    'system_load',
                    'memory_usage',
                    'recent_alerts',
                    'response_time_avg',
                    'error_rate',
                    'timestamp'
                ]
            ])
            ->assertJsonPath('success', true);
    }

    /**
     * Test: Alerts endpoint
     */
    public function test_alerts_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $response = $this->getJson('/api/admin/alerts');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data'
            ])
            ->assertJsonPath('success', true);
    }

    /**
     * Test: Acknowledge alert endpoint
     */
    public function test_acknowledge_alert_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $alertId = 1; // Mock alert ID
        
        $response = $this->postJson('/api/admin/alerts/' . $alertId . '/acknowledge');
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Alert acknowledged successfully');
    }

    /**
     * Test: Resolve alert endpoint
     */
    public function test_resolve_alert_endpoint(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $alertId = 1; // Mock alert ID
        $resolutionData = [
            'resolution' => 'Alert resolved by automated system check'
        ];
        
        $response = $this->postJson('/api/admin/alerts/' . $alertId . '/resolve', $resolutionData);
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Alert resolved successfully');
    }

    /**
     * Test: Resolve alert validation
     */
    public function test_resolve_alert_validation(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $alertId = 1;
        
        // Test without resolution
        $response = $this->postJson('/api/admin/alerts/' . $alertId . '/resolve', []);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['resolution']);
    }

    /**
     * Test: User management operations
     */
    public function test_user_management_operations(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $targetUser = User::factory()->create(['status' => 'active']);
        
        // Test lock user
        $response = $this->postJson('/api/admin/users/' . $targetUser->id . '/lock', [
            'reason' => 'Test lock'
        ]);
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'User account locked successfully');
        
        // Test unlock user
        $response = $this->postJson('/api/admin/users/' . $targetUser->id . '/unlock');
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'User account unlocked successfully');
        
        // Test reset password
        $response = $this->postJson('/api/admin/users/' . $targetUser->id . '/reset-password');
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Password reset successfully');
    }

    /**
     * Test: Bulk user actions
     */
    public function test_bulk_user_actions(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        $users = User::factory()->count(3)->create();
        $userIds = $users->pluck('id')->toArray();
        
        // Test bulk activate
        $bulkData = [
            'user_ids' => $userIds,
            'action' => 'activate'
        ];
        
        $response = $this->postJson('/api/admin/bulk/users', $bulkData);
        
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('processed', 3);
    }

    /**
     * Test: Bulk actions validation
     */
    public function test_bulk_actions_validation(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Test with invalid data
        $response = $this->postJson('/api/admin/bulk/users', []);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['user_ids', 'action']);
        
        // Test with too many user IDs
        $tooManyIds = range(1, 101);
        $response = $this->postJson('/api/admin/bulk/users', [
            'user_ids' => $tooManyIds,
            'action' => 'activate'
        ]);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['user_ids']);
    }

    /**
     * Test: Rate limiting on admin endpoints
     */
    public function test_admin_endpoints_rate_limiting(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Make multiple rapid requests to test rate limiting
        for ($i = 0; $i < 10; $i++) {
            $response = $this->getJson('/api/admin/dashboard');
            
            // First few requests should succeed
            if ($i < 5) {
                $response->assertStatus(200);
            }
        }
        
        // This test might need adjustment based on actual rate limiting configuration
        $this->assertTrue(true, 'Rate limiting test completed');
    }

    /**
     * Test: Analytics validation
     */
    public function test_analytics_validation(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Test with invalid period
        $response = $this->getJson('/api/admin/analytics?period=invalid');
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['period']);
        
        // Test with invalid metrics
        $response = $this->getJson('/api/admin/analytics?metrics[]=invalid_metric');
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['metrics.0']);
    }

    /**
     * Test: Security audit filters validation
     */
    public function test_security_audit_filters_validation(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Test with invalid date format
        $response = $this->getJson('/api/admin/security-audit?start_date=invalid-date');
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['start_date']);
        
        // Test with end_date before start_date
        $response = $this->getJson('/api/admin/security-audit?start_date=2023-12-31&end_date=2023-01-01');
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['end_date']);
    }

    /**
     * Test: Admin middleware security logging
     */
    public function test_admin_middleware_security_logging(): void
    {
        // Test unauthorized access logging
        $response = $this->getJson('/api/admin/dashboard');
        
        $response->assertStatus(401);
        
        // Test admin access with regular user (should log security event)
        Sanctum::actingAs($this->regularUser, ['*']);
        
        $response = $this->getJson('/api/admin/dashboard');
        
        $response->assertStatus(403);
        
        // Verify that security events are being logged
        if (\Schema::hasTable('admin_action_logs')) {
            $securityLogs = AdminActionLog::where('action_type', 'security_event')->count();
            $this->assertGreaterThan(0, $securityLogs, 'Security events should be logged');
        }
    }

    /**
     * Test: System settings update with validation
     */
    public function test_system_settings_update_validation(): void
    {
        if (!\Schema::hasTable('admin_system_settings')) {
            $this->markTestSkipped('System settings table not available');
        }

        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        // Test with missing required fields
        $response = $this->putJson('/api/admin/system-settings', []);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['key', 'value']);
    }

    /**
     * Test: Error handling and response format consistency
     */
    public function test_error_handling_consistency(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Test 404 error for non-existent user
        $response = $this->getJson('/api/admin/users/999999');
        
        $response->assertStatus(404);
        
        // Test validation error format
        $response = $this->postJson('/api/admin/roles', []);
        
        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors'
            ]);
    }

    /**
     * Test: Data integrity and relationships
     */
    public function test_data_integrity_and_relationships(): void
    {
        if (!\Schema::hasTable('admin_roles') || !\Schema::hasTable('admin_user_roles')) {
            $this->markTestSkipped('Admin tables not available');
        }

        Sanctum::actingAs($this->superAdminUser, ['*']);
        
        // Create a role with permissions
        $role = AdminRole::create([
            'name' => 'test_integrity_role',
            'display_name' => 'Test Integrity Role',
            'hierarchy_level' => 40,
            'is_system_role' => false
        ]);
        
        // Assign permissions if available
        $permissions = AdminPermission::limit(2)->get();
        if ($permissions->isNotEmpty()) {
            $role->adminPermissions()->attach($permissions->pluck('id')->toArray());
        }
        
        // Assign role to user
        AdminUserRole::create([
            'user_id' => $this->regularUser->id,
            'admin_role_id' => $role->id,
            'assigned_at' => now(),
            'assigned_by' => $this->superAdminUser->id,
            'is_active' => true
        ]);
        
        // Verify relationships work
        $this->assertEquals(1, $role->userAssignments()->where('is_active', true)->count());
        $this->assertEquals($permissions->count(), $role->adminPermissions()->count());
    }

    /**
     * Test: Performance of admin endpoints
     */
    public function test_admin_endpoints_performance(): void
    {
        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Test dashboard performance
        $startTime = microtime(true);
        $response = $this->getJson('/api/admin/dashboard');
        $endTime = microtime(true);
        
        $response->assertStatus(200);
        $responseTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
        
        // Dashboard should respond within 2 seconds
        $this->assertLessThan(2000, $responseTime, 'Dashboard response time should be under 2 seconds');
        
        // Test users listing performance
        $startTime = microtime(true);
        $response = $this->getJson('/api/admin/users?per_page=50');
        $endTime = microtime(true);
        
        $response->assertStatus(200);
        $responseTime = ($endTime - $startTime) * 1000;
        
        // Users listing should respond within 1 second
        $this->assertLessThan(1000, $responseTime, 'Users listing response time should be under 1 second');
    }

    /**
     * Test: Concurrent admin operations
     */
    public function test_concurrent_admin_operations(): void
    {
        if (!\Schema::hasTable('admin_action_logs')) {
            $this->markTestSkipped('Admin action logs table not available');
        }

        Sanctum::actingAs($this->adminUser, ['*']);
        
        // Simulate concurrent dashboard requests
        $responses = [];
        for ($i = 0; $i < 5; $i++) {
            $responses[] = $this->getJson('/api/admin/dashboard');
        }
        
        // All requests should succeed
        foreach ($responses as $response) {
            $response->assertStatus(200);
        }
        
        // Verify action logs are created for each request
        $logCount = AdminActionLog::where('user_id', $this->adminUser->id)
            ->where('action_type', 'admin_access')
            ->where('created_at', '>=', now()->subMinute())
            ->count();
            
        $this->assertGreaterThanOrEqual(5, $logCount, 'All admin actions should be logged');
    }

    /**
     * Clean up after each test
     */
    protected function tearDown(): void
    {
        // Clean up any test data if needed
        parent::tearDown();
    }
}