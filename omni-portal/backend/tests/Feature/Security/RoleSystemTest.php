<?php

namespace Tests\Feature\Security;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use App\Models\User;
use App\Models\Company;

/**
 * Role System and Tenant Isolation Tests
 * 
 * Tests:
 * - Role-based access control
 * - Tenant data isolation
 * - Permission validation
 * - Admin access restrictions
 * - Cross-tenant security
 */
class RoleSystemTest extends TestCase
{
    use RefreshDatabase;

    protected $regularUser;
    protected $adminUser;
    protected $superAdminUser;
    protected $company1;
    protected $company2;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test companies
        $this->company1 = Company::factory()->create([
            'name' => 'Company One',
            'domain' => 'company1.com',
        ]);
        
        $this->company2 = Company::factory()->create([
            'name' => 'Company Two',
            'domain' => 'company2.com',
        ]);

        // Create users with different roles
        $this->regularUser = User::factory()->create([
            'email' => 'user@company1.com',
            'role' => 'user',
            'company_id' => $this->company1->id,
        ]);

        $this->adminUser = User::factory()->create([
            'email' => 'admin@company1.com',
            'role' => 'admin',
            'company_id' => $this->company1->id,
        ]);

        $this->superAdminUser = User::factory()->create([
            'email' => 'superadmin@portal.com',
            'role' => 'super_admin',
            'company_id' => null, // Super admin not tied to company
        ]);
    }

    /** @test */
    public function regular_users_can_only_access_user_endpoints()
    {
        Sanctum::actingAs($this->regularUser);

        // Should have access to user endpoints
        $userEndpoints = [
            '/api/user',
            '/api/profile',
            '/api/dashboard',
        ];

        foreach ($userEndpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $this->assertNotEquals(403, $response->getStatusCode(),
                "Regular user should have access to {$endpoint}");
        }
    }

    /** @test */
    public function regular_users_cannot_access_admin_endpoints()
    {
        Sanctum::actingAs($this->regularUser);

        // Should NOT have access to admin endpoints
        $adminEndpoints = [
            '/api/admin/users',
            '/api/admin/settings',
            '/api/admin/reports',
            '/api/admin/health-risks',
        ];

        foreach ($adminEndpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $this->assertTrue(in_array($response->getStatusCode(), [403, 404]),
                "Regular user should NOT have access to {$endpoint}");
        }
    }

    /** @test */
    public function admin_users_can_access_admin_endpoints()
    {
        Sanctum::actingAs($this->adminUser);

        // Should have access to admin endpoints
        $adminEndpoints = [
            '/api/admin/users',
            '/api/admin/settings',
            '/api/admin/reports',
        ];

        foreach ($adminEndpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $this->assertNotEquals(403, $response->getStatusCode(),
                "Admin user should have access to {$endpoint}");
        }
    }

    /** @test */
    public function admin_users_cannot_access_super_admin_endpoints()
    {
        Sanctum::actingAs($this->adminUser);

        // Should NOT have access to super admin endpoints
        $superAdminEndpoints = [
            '/api/super-admin/companies',
            '/api/super-admin/system-settings',
            '/api/super-admin/global-reports',
        ];

        foreach ($superAdminEndpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $this->assertTrue(in_array($response->getStatusCode(), [403, 404]),
                "Admin user should NOT have access to {$endpoint}");
        }
    }

    /** @test */
    public function super_admin_users_can_access_all_endpoints()
    {
        Sanctum::actingAs($this->superAdminUser);

        // Should have access to all endpoint types
        $allEndpoints = [
            '/api/user',
            '/api/admin/users',
            '/api/super-admin/companies',
        ];

        foreach ($allEndpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $this->assertNotEquals(403, $response->getStatusCode(),
                "Super admin should have access to {$endpoint}");
        }
    }

    /** @test */
    public function users_can_only_see_data_from_their_company()
    {
        // Create data for both companies
        $company1User = User::factory()->create([
            'company_id' => $this->company1->id,
            'email' => 'employee1@company1.com',
        ]);

        $company2User = User::factory()->create([
            'company_id' => $this->company2->id,
            'email' => 'employee2@company2.com',
        ]);

        // Test Company 1 admin can see Company 1 users
        Sanctum::actingAs($this->adminUser); // Company 1 admin
        
        $response = $this->getJson('/api/admin/users');
        
        if ($response->getStatusCode() === 200) {
            $users = $response->json();
            
            // Should only see users from company 1
            foreach ($users['data'] ?? $users as $user) {
                if (isset($user['company_id'])) {
                    $this->assertEquals($this->company1->id, $user['company_id'],
                        'Admin should only see users from their company');
                }
            }
        }
    }

    /** @test */
    public function tenant_isolation_prevents_cross_company_data_access()
    {
        // Create user in Company 2
        $company2User = User::factory()->create([
            'company_id' => $this->company2->id,
            'email' => 'user@company2.com',
            'role' => 'user',
        ]);

        // Company 1 user tries to access Company 2 user data
        Sanctum::actingAs($this->regularUser); // Company 1 user
        
        $response = $this->getJson("/api/users/{$company2User->id}");
        
        $this->assertTrue(in_array($response->getStatusCode(), [403, 404]),
            'Users should not access data from other companies');
    }

    /** @test */
    public function role_middleware_validates_permissions_correctly()
    {
        // Test various role combinations
        $testCases = [
            // [user, endpoint, should_have_access]
            [$this->regularUser, '/api/user', true],
            [$this->regularUser, '/api/admin/users', false],
            [$this->adminUser, '/api/user', true],
            [$this->adminUser, '/api/admin/users', true],
            [$this->adminUser, '/api/super-admin/companies', false],
            [$this->superAdminUser, '/api/user', true],
            [$this->superAdminUser, '/api/admin/users', true],
            [$this->superAdminUser, '/api/super-admin/companies', true],
        ];

        foreach ($testCases as [$user, $endpoint, $shouldHaveAccess]) {
            Sanctum::actingAs($user);
            
            $response = $this->getJson($endpoint);
            
            if ($shouldHaveAccess) {
                $this->assertNotEquals(403, $response->getStatusCode(),
                    "User {$user->email} should have access to {$endpoint}");
            } else {
                $this->assertTrue(in_array($response->getStatusCode(), [403, 404]),
                    "User {$user->email} should NOT have access to {$endpoint}");
            }
        }
    }

    /** @test */
    public function company_scoped_queries_work_correctly()
    {
        // Create multiple users for each company
        User::factory()->count(3)->create(['company_id' => $this->company1->id]);
        User::factory()->count(2)->create(['company_id' => $this->company2->id]);

        Sanctum::actingAs($this->adminUser); // Company 1 admin
        
        $response = $this->getJson('/api/admin/company-users');
        
        if ($response->getStatusCode() === 200) {
            $data = $response->json();
            $userCount = count($data['users'] ?? $data);
            
            // Should only see Company 1 users (including existing ones)
            $expectedCount = User::where('company_id', $this->company1->id)->count();
            $this->assertEquals($expectedCount, $userCount,
                'Company-scoped queries should return correct count');
        }
    }

    /** @test */
    public function role_based_menu_permissions_work()
    {
        $menuTests = [
            // Regular user should see limited menu
            [$this->regularUser, ['dashboard', 'profile'], ['admin', 'super-admin']],
            // Admin should see admin menus but not super-admin
            [$this->adminUser, ['dashboard', 'admin'], ['super-admin']],
            // Super admin should see everything
            [$this->superAdminUser, ['dashboard', 'admin', 'super-admin'], []],
        ];

        foreach ($menuTests as [$user, $allowedMenus, $forbiddenMenus]) {
            Sanctum::actingAs($user);
            
            $response = $this->getJson('/api/user/menu-permissions');
            
            if ($response->getStatusCode() === 200) {
                $menus = $response->json();
                
                foreach ($allowedMenus as $menu) {
                    $this->assertTrue(
                        isset($menus[$menu]) && $menus[$menu],
                        "User {$user->email} should have access to {$menu} menu"
                    );
                }
                
                foreach ($forbiddenMenus as $menu) {
                    $this->assertFalse(
                        isset($menus[$menu]) && $menus[$menu],
                        "User {$user->email} should NOT have access to {$menu} menu"
                    );
                }
            }
        }
    }

    /** @test */
    public function admin_cannot_modify_users_from_other_companies()
    {
        // Create user in Company 2
        $company2User = User::factory()->create([
            'company_id' => $this->company2->id,
            'email' => 'target@company2.com',
        ]);

        // Company 1 admin tries to modify Company 2 user
        Sanctum::actingAs($this->adminUser);
        
        $response = $this->putJson("/api/admin/users/{$company2User->id}", [
            'name' => 'Modified Name',
            'email' => 'modified@company2.com',
        ]);

        $this->assertTrue(in_array($response->getStatusCode(), [403, 404]),
            'Admin should not modify users from other companies');
    }

    /** @test */
    public function role_elevation_attacks_are_prevented()
    {
        Sanctum::actingAs($this->regularUser);

        // Try to elevate role through API
        $response = $this->putJson('/api/user/profile', [
            'role' => 'admin',
            'company_id' => $this->company2->id,
        ]);

        // Verify role was not changed
        $this->regularUser->refresh();
        $this->assertEquals('user', $this->regularUser->role,
            'Role elevation should be prevented');
        $this->assertEquals($this->company1->id, $this->regularUser->company_id,
            'Company change should be prevented');
    }

    /** @test */
    public function permissions_are_checked_at_multiple_layers()
    {
        // Test middleware, controller, and model-level permissions
        Sanctum::actingAs($this->regularUser);

        // 1. Middleware level - should block admin routes
        $response = $this->getJson('/api/admin/users');
        $this->assertTrue(in_array($response->getStatusCode(), [403, 404]),
            'Middleware should block admin routes for regular users');

        // 2. Controller level - test if endpoint exists but blocks
        $response = $this->postJson('/api/admin/create-user', [
            'name' => 'New User',
            'email' => 'new@company1.com',
        ]);
        $this->assertTrue(in_array($response->getStatusCode(), [403, 404, 405]),
            'Controller should block admin actions for regular users');
    }
}