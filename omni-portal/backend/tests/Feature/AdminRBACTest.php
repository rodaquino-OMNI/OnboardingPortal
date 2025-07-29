<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class AdminRBACTest extends TestCase
{
    use RefreshDatabase;

    protected $adminUser;
    protected $managerUser;
    protected $regularUser;
    protected $adminRole;
    protected $managerRole;
    protected $userRole;

    protected function setUp(): void
    {
        parent::setUp();

        // Create roles with permissions
        $this->adminRole = Role::create(['name' => 'admin']);
        $this->managerRole = Role::create(['name' => 'manager']);
        $this->userRole = Role::create(['name' => 'user']);

        // Create permissions
        $permissions = [
            'manage-users',
            'view-users',
            'edit-users',
            'delete-users',
            'manage-roles',
            'view-roles',
            'manage-system',
            'view-reports',
            'export-data',
            'audit-logs',
            'bulk-operations'
        ];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // Assign permissions to roles
        $this->adminRole->givePermissionTo([
            'manage-users', 'view-users', 'edit-users', 'delete-users',
            'manage-roles', 'view-roles', 'manage-system', 'view-reports',
            'export-data', 'audit-logs', 'bulk-operations'
        ]);

        $this->managerRole->givePermissionTo([
            'view-users', 'edit-users', 'view-roles', 'view-reports', 'export-data'
        ]);

        $this->userRole->givePermissionTo(['view-users']);

        // Create users with roles
        $this->adminUser = User::factory()->create(['registration_step' => 'completed']);
        $this->adminUser->assignRole('admin');

        $this->managerUser = User::factory()->create(['registration_step' => 'completed']);
        $this->managerUser->assignRole('manager');

        $this->regularUser = User::factory()->create(['registration_step' => 'completed']);
        $this->regularUser->assignRole('user');
    }

    /** @test */
    public function admin_can_access_all_user_management_endpoints()
    {
        Sanctum::actingAs($this->adminUser);

        // Test user listing with admin access
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(200);

        // Test user creation
        $response = $this->postJson('/api/admin/users', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'cpf' => '12345678901',
            'password' => 'SecurePassword123!'
        ]);
        $response->assertStatus(201);

        // Test user update
        $user = User::factory()->create();
        $response = $this->putJson("/api/admin/users/{$user->id}", [
            'name' => 'Updated Name'
        ]);
        $response->assertStatus(200);

        // Test user deletion
        $response = $this->deleteJson("/api/admin/users/{$user->id}");
        $response->assertStatus(200);
    }

    /** @test */
    public function manager_has_limited_user_management_access()
    {
        Sanctum::actingAs($this->managerUser);

        // Can view users
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(200);

        // Can edit users
        $user = User::factory()->create();
        $response = $this->putJson("/api/admin/users/{$user->id}", [
            'name' => 'Manager Updated Name'
        ]);
        $response->assertStatus(200);

        // Cannot create users
        $response = $this->postJson('/api/admin/users', [
            'name' => 'Unauthorized User',
            'email' => 'unauthorized@example.com',
            'cpf' => '98765432109'
        ]);
        $response->assertStatus(403);

        // Cannot delete users
        $response = $this->deleteJson("/api/admin/users/{$user->id}");
        $response->assertStatus(403);
    }

    /** @test */
    public function regular_user_cannot_access_admin_endpoints()
    {
        Sanctum::actingAs($this->regularUser);

        // Cannot access user management
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(403);

        // Cannot create users
        $response = $this->postJson('/api/admin/users', [
            'name' => 'Unauthorized User',
            'email' => 'unauthorized@example.com'
        ]);
        $response->assertStatus(403);

        // Cannot access system management
        $response = $this->getJson('/api/admin/system/config');
        $response->assertStatus(403);
    }

    /** @test */
    public function admin_can_manage_roles_and_permissions()
    {
        Sanctum::actingAs($this->adminUser);

        // Test role creation
        $response = $this->postJson('/api/admin/roles', [
            'name' => 'custom-role',
            'display_name' => 'Custom Role',
            'permissions' => ['view-users', 'edit-users']
        ]);
        $response->assertStatus(201);

        // Test role update
        $role = Role::create(['name' => 'test-role']);
        $response = $this->putJson("/api/admin/roles/{$role->id}", [
            'display_name' => 'Updated Test Role',
            'permissions' => ['view-users']
        ]);
        $response->assertStatus(200);

        // Test role assignment to user
        $user = User::factory()->create();
        $response = $this->postJson("/api/admin/users/{$user->id}/roles", [
            'roles' => ['manager']
        ]);
        $response->assertStatus(200);

        $this->assertTrue($user->fresh()->hasRole('manager'));
    }

    /** @test */
    public function manager_cannot_manage_roles()
    {
        Sanctum::actingAs($this->managerUser);

        // Cannot create roles
        $response = $this->postJson('/api/admin/roles', [
            'name' => 'unauthorized-role'
        ]);
        $response->assertStatus(403);

        // Cannot assign roles to users
        $user = User::factory()->create();
        $response = $this->postJson("/api/admin/users/{$user->id}/roles", [
            'roles' => ['admin']
        ]);
        $response->assertStatus(403);
    }

    /** @test */
    public function admin_can_perform_bulk_operations()
    {
        Sanctum::actingAs($this->adminUser);

        $users = User::factory()->count(5)->create();
        $userIds = $users->pluck('id')->toArray();

        // Test bulk role assignment
        $response = $this->postJson('/api/admin/users/bulk/assign-role', [
            'user_ids' => $userIds,
            'role' => 'manager'
        ]);
        $response->assertStatus(200);

        // Verify all users have the manager role
        foreach ($users as $user) {
            $this->assertTrue($user->fresh()->hasRole('manager'));
        }

        // Test bulk user deactivation
        $response = $this->postJson('/api/admin/users/bulk/deactivate', [
            'user_ids' => $userIds
        ]);
        $response->assertStatus(200);

        // Test bulk export
        $response = $this->postJson('/api/admin/users/bulk/export', [
            'user_ids' => $userIds,
            'format' => 'csv'
        ]);
        $response->assertStatus(200);
    }

    /** @test */
    public function manager_has_limited_bulk_operations()
    {
        Sanctum::actingAs($this->managerUser);

        $users = User::factory()->count(3)->create();
        $userIds = $users->pluck('id')->toArray();

        // Can export user data
        $response = $this->postJson('/api/admin/users/bulk/export', [
            'user_ids' => $userIds,
            'format' => 'csv'
        ]);
        $response->assertStatus(200);

        // Cannot perform bulk role assignment
        $response = $this->postJson('/api/admin/users/bulk/assign-role', [
            'user_ids' => $userIds,
            'role' => 'admin'
        ]);
        $response->assertStatus(403);

        // Cannot perform bulk deactivation
        $response = $this->postJson('/api/admin/users/bulk/deactivate', [
            'user_ids' => $userIds
        ]);
        $response->assertStatus(403);
    }

    /** @test */
    public function admin_actions_are_logged_in_audit_trail()
    {
        Sanctum::actingAs($this->adminUser);

        // Perform admin actions
        $user = User::factory()->create();
        
        // Update user
        $this->putJson("/api/admin/users/{$user->id}", [
            'name' => 'Audit Test User'
        ]);

        // Assign role
        $this->postJson("/api/admin/users/{$user->id}/roles", [
            'roles' => ['manager']
        ]);

        // Check audit logs
        $response = $this->getJson('/api/admin/audit-logs');
        $response->assertStatus(200);

        $auditLogs = $response->json('data');
        $this->assertCount(2, $auditLogs);

        // Verify log entries contain expected information
        $this->assertEquals('user_updated', $auditLogs[0]['action']);
        $this->assertEquals('role_assigned', $auditLogs[1]['action']);
        $this->assertEquals($this->adminUser->id, $auditLogs[0]['admin_user_id']);
    }

    /** @test */
    public function permission_escalation_attempts_are_blocked()
    {
        Sanctum::actingAs($this->managerUser);

        // Attempt to escalate permissions by modifying own role
        $response = $this->postJson("/api/admin/users/{$this->managerUser->id}/roles", [
            'roles' => ['admin']
        ]);
        $response->assertStatus(403);

        // Attempt to create admin user
        $response = $this->postJson('/api/admin/users', [
            'name' => 'Malicious Admin',
            'email' => 'malicious@example.com',
            'roles' => ['admin']
        ]);
        $response->assertStatus(403);

        // Verify manager user still has only manager role
        $this->assertTrue($this->managerUser->fresh()->hasRole('manager'));
        $this->assertFalse($this->managerUser->fresh()->hasRole('admin'));
    }

    /** @test */
    public function admin_can_view_system_configuration()
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/admin/system/config');
        $response->assertStatus(200)
                ->assertJsonStructure([
                    'data' => [
                        'app_settings',
                        'security_settings',
                        'notification_settings',
                        'integration_settings'
                    ]
                ]);
    }

    /** @test */
    public function admin_can_update_system_configuration()
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->putJson('/api/admin/system/config', [
            'app_settings' => [
                'maintenance_mode' => false,
                'registration_enabled' => true
            ],
            'security_settings' => [
                'session_timeout' => 30,
                'password_complexity' => 'high'
            ]
        ]);

        $response->assertStatus(200);
    }

    /** @test */
    public function non_admin_users_cannot_access_system_config()
    {
        Sanctum::actingAs($this->managerUser);

        $response = $this->getJson('/api/admin/system/config');
        $response->assertStatus(403);

        $response = $this->putJson('/api/admin/system/config', [
            'app_settings' => ['maintenance_mode' => true]
        ]);
        $response->assertStatus(403);
    }

    /** @test */
    public function admin_can_generate_comprehensive_reports()
    {
        Sanctum::actingAs($this->adminUser);

        // Test user activity report
        $response = $this->postJson('/api/admin/reports/user-activity', [
            'date_range' => ['2024-01-01', '2024-12-31'],
            'format' => 'json'
        ]);
        $response->assertStatus(200);

        // Test system performance report
        $response = $this->postJson('/api/admin/reports/system-performance', [
            'metrics' => ['response_time', 'error_rate', 'throughput'],
            'period' => 'last_30_days'
        ]);
        $response->assertStatus(200);

        // Test security audit report
        $response = $this->postJson('/api/admin/reports/security-audit', [
            'include_failed_logins' => true,
            'include_permission_changes' => true
        ]);
        $response->assertStatus(200);
    }

    /** @test */
    public function manager_has_limited_report_access()
    {
        Sanctum::actingAs($this->managerUser);

        // Can access basic user reports
        $response = $this->postJson('/api/admin/reports/user-activity', [
            'date_range' => ['2024-01-01', '2024-12-31']
        ]);
        $response->assertStatus(200);

        // Cannot access security audit reports
        $response = $this->postJson('/api/admin/reports/security-audit');
        $response->assertStatus(403);

        // Cannot access system performance reports
        $response = $this->postJson('/api/admin/reports/system-performance');
        $response->assertStatus(403);
    }

    /** @test */
    public function role_inheritance_works_correctly()
    {
        // Create hierarchical role structure
        $supervisorRole = Role::create(['name' => 'supervisor']);
        $supervisorRole->givePermissionTo(['view-users', 'edit-users', 'view-reports']);

        $supervisorUser = User::factory()->create();
        $supervisorUser->assignRole('supervisor');

        Sanctum::actingAs($supervisorUser);

        // Should have inherited permissions
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(200);

        // Should be able to edit users
        $user = User::factory()->create();
        $response = $this->putJson("/api/admin/users/{$user->id}", [
            'name' => 'Supervisor Updated'
        ]);
        $response->assertStatus(200);

        // Should not be able to delete users (not granted)
        $response = $this->deleteJson("/api/admin/users/{$user->id}");
        $response->assertStatus(403);
    }

    /** @test */
    public function session_based_permission_validation()
    {
        Sanctum::actingAs($this->adminUser);

        // Admin should have full access initially
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(200);

        // Simulate role change during session
        $this->adminUser->removeRole('admin');
        $this->adminUser->assignRole('user');

        // Should lose admin access (with proper session handling)
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(403);
    }

    /** @test */
    public function concurrent_admin_operations_are_handled_safely()
    {
        Sanctum::actingAs($this->adminUser);

        $user = User::factory()->create();

        // Simulate concurrent role assignments
        $responses = [];
        for ($i = 0; $i < 3; $i++) {
            $responses[] = $this->postJson("/api/admin/users/{$user->id}/roles", [
                'roles' => ['manager']
            ]);
        }

        // At least one should succeed
        $successfulResponses = array_filter($responses, function($response) {
            return $response->status() === 200;
        });

        $this->assertGreaterThan(0, count($successfulResponses));

        // User should have the manager role only once
        $this->assertTrue($user->fresh()->hasRole('manager'));
        $this->assertCount(1, $user->fresh()->roles);
    }
}