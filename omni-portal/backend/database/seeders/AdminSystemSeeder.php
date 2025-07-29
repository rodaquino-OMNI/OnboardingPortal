<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Models\Admin\AdminRole;
use App\Models\Admin\AdminPermission;
use App\Models\Admin\AdminUserRole;
use App\Models\User;
use Carbon\Carbon;

/**
 * Admin System Seeder
 * 
 * Seeds the admin system with:
 * - Default admin roles and hierarchy
 * - Comprehensive permission system
 * - System settings
 * - Default admin user
 */
class AdminSystemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->seedAdminRoles();
        $this->seedAdminPermissions();
        $this->seedRolePermissions();
        $this->seedSystemSettings();
        $this->seedDefaultAdminUser();
        
        $this->command->info('Admin system seeded successfully!');
    }

    /**
     * Seed admin roles with hierarchy
     */
    private function seedAdminRoles(): void
    {
        $roles = [
            [
                'name' => 'super_admin',
                'display_name' => 'Super Administrator',
                'description' => 'Full system access with all permissions',
                'hierarchy_level' => 100,
                'is_system_role' => true,
            ],
            [
                'name' => 'admin',
                'display_name' => 'Administrator',
                'description' => 'High-level admin access for system management',
                'hierarchy_level' => 80,
                'is_system_role' => true,
            ],
            [
                'name' => 'manager',
                'display_name' => 'Manager',
                'description' => 'Management-level access for user and content oversight',
                'hierarchy_level' => 60,
                'is_system_role' => true,
            ],
            [
                'name' => 'analyst',
                'display_name' => 'Analyst',
                'description' => 'Analytics and reporting access with limited management',
                'hierarchy_level' => 40,
                'is_system_role' => true,
            ],
            [
                'name' => 'support',
                'display_name' => 'Support Specialist',
                'description' => 'Basic support and user assistance access',
                'hierarchy_level' => 20,
                'is_system_role' => true,
            ],
        ];

        foreach ($roles as $roleData) {
            AdminRole::create($roleData);
        }

        $this->command->info('✓ Admin roles seeded');
    }

    /**
     * Seed comprehensive admin permissions
     */
    private function seedAdminPermissions(): void
    {
        $permissions = [
            // Dashboard & Analytics
            ['resource' => 'dashboard', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Dashboard', 'is_sensitive' => false],
            ['resource' => 'analytics', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Analytics', 'is_sensitive' => false],
            ['resource' => 'analytics', 'action' => 'export', 'scope' => 'all', 'display_name' => 'Export Analytics', 'is_sensitive' => true],
            ['resource' => 'reports', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Reports', 'is_sensitive' => false],
            ['resource' => 'reports', 'action' => 'create', 'scope' => 'all', 'display_name' => 'Create Reports', 'is_sensitive' => false],
            ['resource' => 'reports', 'action' => 'export', 'scope' => 'all', 'display_name' => 'Export Reports', 'is_sensitive' => true],

            // User Management
            ['resource' => 'users', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View All Users', 'is_sensitive' => false],
            ['resource' => 'users', 'action' => 'view', 'scope' => 'department', 'display_name' => 'View Department Users', 'is_sensitive' => false],
            ['resource' => 'users', 'action' => 'edit', 'scope' => 'all', 'display_name' => 'Edit All Users', 'is_sensitive' => true],
            ['resource' => 'users', 'action' => 'edit', 'scope' => 'department', 'display_name' => 'Edit Department Users', 'is_sensitive' => false],
            ['resource' => 'users', 'action' => 'delete', 'scope' => 'all', 'display_name' => 'Delete Users', 'is_sensitive' => true],
            ['resource' => 'users', 'action' => 'lock', 'scope' => 'all', 'display_name' => 'Lock/Unlock Users', 'is_sensitive' => true],
            ['resource' => 'users', 'action' => 'export', 'scope' => 'all', 'display_name' => 'Export User Data', 'is_sensitive' => true],
            ['resource' => 'user_details', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View User Details', 'is_sensitive' => true],

            // Role & Permission Management
            ['resource' => 'roles', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Roles', 'is_sensitive' => false],
            ['resource' => 'roles', 'action' => 'create', 'scope' => 'all', 'display_name' => 'Create Roles', 'is_sensitive' => true],
            ['resource' => 'roles', 'action' => 'edit', 'scope' => 'all', 'display_name' => 'Edit Roles', 'is_sensitive' => true],
            ['resource' => 'roles', 'action' => 'delete', 'scope' => 'all', 'display_name' => 'Delete Roles', 'is_sensitive' => true],
            ['resource' => 'user_roles', 'action' => 'manage', 'scope' => 'all', 'display_name' => 'Manage User Roles', 'is_sensitive' => true],
            ['resource' => 'permissions', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Permissions', 'is_sensitive' => false],
            ['resource' => 'permissions', 'action' => 'manage', 'scope' => 'all', 'display_name' => 'Manage Permissions', 'is_sensitive' => true],

            // Document Management
            ['resource' => 'documents', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View All Documents', 'is_sensitive' => false],
            ['resource' => 'documents', 'action' => 'view', 'scope' => 'department', 'display_name' => 'View Department Documents', 'is_sensitive' => false],
            ['resource' => 'documents', 'action' => 'approve', 'scope' => 'all', 'display_name' => 'Approve Documents', 'is_sensitive' => true],
            ['resource' => 'documents', 'action' => 'reject', 'scope' => 'all', 'display_name' => 'Reject Documents', 'is_sensitive' => true],
            ['resource' => 'documents', 'action' => 'delete', 'scope' => 'all', 'display_name' => 'Delete Documents', 'is_sensitive' => true],
            ['resource' => 'documents', 'action' => 'export', 'scope' => 'all', 'display_name' => 'Export Documents', 'is_sensitive' => true],

            // Health Questionnaire Management
            ['resource' => 'questionnaires', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Health Questionnaires', 'is_sensitive' => true],
            ['resource' => 'questionnaires', 'action' => 'manage', 'scope' => 'all', 'display_name' => 'Manage Questionnaires', 'is_sensitive' => true],
            ['resource' => 'questionnaire_templates', 'action' => 'manage', 'scope' => 'all', 'display_name' => 'Manage Templates', 'is_sensitive' => false],

            // Company Management
            ['resource' => 'companies', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Companies', 'is_sensitive' => false],
            ['resource' => 'companies', 'action' => 'create', 'scope' => 'all', 'display_name' => 'Create Companies', 'is_sensitive' => true],
            ['resource' => 'companies', 'action' => 'edit', 'scope' => 'all', 'display_name' => 'Edit Companies', 'is_sensitive' => true],
            ['resource' => 'companies', 'action' => 'delete', 'scope' => 'all', 'display_name' => 'Delete Companies', 'is_sensitive' => true],

            // Security & Audit
            ['resource' => 'security_audit', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Security Audit', 'is_sensitive' => true],
            ['resource' => 'audit_logs', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Audit Logs', 'is_sensitive' => true],
            ['resource' => 'audit_logs', 'action' => 'export', 'scope' => 'all', 'display_name' => 'Export Audit Logs', 'is_sensitive' => true],
            ['resource' => 'admin_sessions', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Admin Sessions', 'is_sensitive' => true],
            ['resource' => 'admin_sessions', 'action' => 'terminate', 'scope' => 'all', 'display_name' => 'Terminate Sessions', 'is_sensitive' => true],

            // System Management
            ['resource' => 'system_settings', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View System Settings', 'is_sensitive' => false],
            ['resource' => 'system_settings', 'action' => 'edit', 'scope' => 'all', 'display_name' => 'Edit System Settings', 'is_sensitive' => true],
            ['resource' => 'system_logs', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View System Logs', 'is_sensitive' => true],
            ['resource' => 'maintenance', 'action' => 'manage', 'scope' => 'all', 'display_name' => 'Manage Maintenance Mode', 'is_sensitive' => true],

            // Data Export & Compliance
            ['resource' => 'data', 'action' => 'export', 'scope' => 'all', 'display_name' => 'Export Data', 'is_sensitive' => true],
            ['resource' => 'compliance', 'action' => 'manage', 'scope' => 'all', 'display_name' => 'Manage Compliance', 'is_sensitive' => true],

            // Notifications
            ['resource' => 'notifications', 'action' => 'view', 'scope' => 'all', 'display_name' => 'View Notifications', 'is_sensitive' => false],
            ['resource' => 'notifications', 'action' => 'send', 'scope' => 'all', 'display_name' => 'Send Notifications', 'is_sensitive' => false],

            // Gamification Management
            ['resource' => 'gamification', 'action' => 'manage', 'scope' => 'all', 'display_name' => 'Manage Gamification', 'is_sensitive' => false],
        ];

        foreach ($permissions as $permissionData) {
            $permissionData['description'] = $permissionData['display_name'] . ' - ' . ucfirst($permissionData['scope']) . ' scope';
            AdminPermission::create($permissionData);
        }

        $this->command->info('✓ Admin permissions seeded');
    }

    /**
     * Assign permissions to roles
     */
    private function seedRolePermissions(): void
    {
        $rolePermissions = [
            'super_admin' => 'all', // Super admin gets all permissions
            'admin' => [
                'dashboard.view', 'analytics.view', 'analytics.export', 'reports.view', 'reports.create', 'reports.export',
                'users.view', 'users.edit', 'users.lock', 'user_details.view',
                'roles.view', 'roles.create', 'roles.edit', 'user_roles.manage', 'permissions.view',
                'documents.view', 'documents.approve', 'documents.reject', 'documents.export',
                'questionnaires.view', 'questionnaires.manage', 'questionnaire_templates.manage',
                'companies.view', 'companies.create', 'companies.edit',
                'security_audit.view', 'audit_logs.view', 'admin_sessions.view', 'admin_sessions.terminate',
                'system_settings.view', 'system_settings.edit', 'system_logs.view',
                'notifications.view', 'notifications.send', 'gamification.manage',
            ],
            'manager' => [
                'dashboard.view', 'analytics.view', 'reports.view', 'reports.create',
                'users.view', 'users.edit.department', 'user_details.view',
                'roles.view', 'permissions.view',
                'documents.view', 'documents.approve', 'documents.reject',
                'questionnaires.view', 'questionnaire_templates.manage',
                'companies.view', 'companies.edit',
                'notifications.view', 'notifications.send', 'gamification.manage',
            ],
            'analyst' => [
                'dashboard.view', 'analytics.view', 'reports.view', 'reports.create', 'reports.export',
                'users.view.department', 'documents.view.department',
                'questionnaires.view', 'companies.view',
                'notifications.view',
            ],
            'support' => [
                'dashboard.view', 'users.view.department', 'user_details.view',
                'documents.view.department', 'notifications.view',
            ],
        ];

        foreach ($rolePermissions as $roleName => $permissions) {
            $role = AdminRole::where('name', $roleName)->first();
            
            if ($permissions === 'all') {
                // Super admin gets all permissions
                $allPermissions = AdminPermission::all();
                $role->adminPermissions()->attach($allPermissions->pluck('id'), [
                    'granted_at' => now(),
                    'granted_by' => 1, // System user
                ]);
            } else {
                foreach ($permissions as $permissionIdentifier) {
                    $parts = explode('.', $permissionIdentifier);
                    $resource = $parts[0];
                    $action = $parts[1] ?? 'view';
                    $scope = $parts[2] ?? 'all';
                    
                    $permission = AdminPermission::where('resource', $resource)
                        ->where('action', $action)
                        ->where('scope', $scope)
                        ->first();
                    
                    if ($permission) {
                        $role->adminPermissions()->attach($permission->id, [
                            'granted_at' => now(),
                            'granted_by' => 1, // System user
                        ]);
                    }
                }
            }
        }

        $this->command->info('✓ Role permissions assigned');
    }

    /**
     * Seed system settings
     */
    private function seedSystemSettings(): void
    {
        $settings = [
            // Security Settings
            ['category' => 'security', 'key' => 'session_timeout', 'value' => '3600', 'type' => 'number', 'description' => 'Admin session timeout in seconds'],
            ['category' => 'security', 'key' => 'max_login_attempts', 'value' => '5', 'type' => 'number', 'description' => 'Maximum failed login attempts before lock'],
            ['category' => 'security', 'key' => 'lockout_duration', 'value' => '1800', 'type' => 'number', 'description' => 'Account lockout duration in seconds'],
            ['category' => 'security', 'key' => 'require_2fa', 'value' => 'false', 'type' => 'boolean', 'description' => 'Require two-factor authentication for admin users'],
            ['category' => 'security', 'key' => 'password_min_length', 'value' => '8', 'type' => 'number', 'description' => 'Minimum password length'],
            ['category' => 'security', 'key' => 'password_require_special', 'value' => 'true', 'type' => 'boolean', 'description' => 'Require special characters in passwords'],

            // Notification Settings
            ['category' => 'notifications', 'key' => 'email_notifications', 'value' => 'true', 'type' => 'boolean', 'description' => 'Enable email notifications'],
            ['category' => 'notifications', 'key' => 'slack_webhook_url', 'value' => '', 'type' => 'string', 'description' => 'Slack webhook URL for notifications', 'is_sensitive' => true],
            ['category' => 'notifications', 'key' => 'notification_email', 'value' => 'admin@company.com', 'type' => 'string', 'description' => 'Default notification email address'],

            // System Settings
            ['category' => 'system', 'key' => 'maintenance_mode', 'value' => 'false', 'type' => 'boolean', 'description' => 'Enable maintenance mode'],
            ['category' => 'system', 'key' => 'maintenance_message', 'value' => 'System is under maintenance. Please try again later.', 'type' => 'string', 'description' => 'Maintenance mode message'],
            ['category' => 'system', 'key' => 'max_file_size', 'value' => '10485760', 'type' => 'number', 'description' => 'Maximum file upload size in bytes (10MB)'],
            ['category' => 'system', 'key' => 'allowed_file_types', 'value' => '["jpg","jpeg","png","pdf","doc","docx"]', 'type' => 'json', 'description' => 'Allowed file types for upload'],

            // Analytics Settings
            ['category' => 'analytics', 'key' => 'data_retention_days', 'value' => '365', 'type' => 'number', 'description' => 'How long to keep analytics data (days)'],
            ['category' => 'analytics', 'key' => 'enable_real_time', 'value' => 'true', 'type' => 'boolean', 'description' => 'Enable real-time analytics'],
            ['category' => 'analytics', 'key' => 'cache_duration', 'value' => '300', 'type' => 'number', 'description' => 'Analytics cache duration in seconds'],

            // UI Settings
            ['category' => 'ui', 'key' => 'items_per_page', 'value' => '25', 'type' => 'number', 'description' => 'Default items per page in lists'],
            ['category' => 'ui', 'key' => 'dashboard_refresh_interval', 'value' => '30', 'type' => 'number', 'description' => 'Dashboard auto-refresh interval in seconds'],
            ['category' => 'ui', 'key' => 'theme_color', 'value' => '#3b82f6', 'type' => 'string', 'description' => 'Admin dashboard theme color'],
        ];

        foreach ($settings as $setting) {
            DB::table('admin_system_settings')->insert(array_merge($setting, [
                'is_sensitive' => $setting['is_sensitive'] ?? false,
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }

        $this->command->info('✓ System settings seeded');
    }

    /**
     * Create default admin user
     */
    private function seedDefaultAdminUser(): void
    {
        // Create or find admin user
        $adminUser = User::firstOrCreate(
            ['email' => 'admin@onboarding-portal.com'],
            [
                'name' => 'System Administrator',
                'email' => 'admin@onboarding-portal.com',
                'cpf' => '00000000000',
                'password' => Hash::make('AdminPass123!'),
                'phone' => '+55 11 99999-9999',
                'department' => 'IT',
                'job_title' => 'System Administrator',
                'employee_id' => 'ADM001',
                'start_date' => now(),
                'status' => 'active',
                'registration_step' => 'completed',
                'is_active' => true,
                'email_verified_at' => now(),
                'lgpd_consent' => true,
                'lgpd_consent_at' => now(),
                'lgpd_consent_ip' => '127.0.0.1',
            ]
        );

        // Assign super admin role
        $superAdminRole = AdminRole::where('name', 'super_admin')->first();
        
        AdminUserRole::firstOrCreate(
            [
                'user_id' => $adminUser->id,
                'admin_role_id' => $superAdminRole->id,
            ],
            [
                'assigned_at' => now(),
                'assigned_by' => $adminUser->id,
                'assignment_reason' => 'System initialization - default super admin',
                'is_active' => true,
            ]
        );

        $this->command->info('✓ Default admin user created: admin@onboarding-portal.com / AdminPass123!');
    }
}