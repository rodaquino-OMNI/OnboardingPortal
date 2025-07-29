<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminRolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Create permissions
        $permissions = [
            // User Management
            'view_users',
            'create_users',
            'edit_users',
            'delete_users',
            'manage_user_roles',
            'manage_user_permissions',
            'reset_user_passwords',
            'lock_unlock_users',
            'view_user_activity',
            
            // Document Management
            'view_all_documents',
            'approve_documents',
            'reject_documents',
            'request_document_info',
            'delete_documents',
            'view_document_statistics',
            'bulk_document_operations',
            
            // Health Questionnaires
            'view_all_questionnaires',
            'manage_questionnaire_templates',
            'view_questionnaire_analytics',
            'export_health_data',
            
            // System Administration
            'view_admin_dashboard',
            'view_system_statistics',
            'view_system_health',
            'view_action_logs',
            'manage_system_settings',
            'view_security_logs',
            'manage_roles_permissions',
            
            // Analytics and Reporting
            'view_analytics',
            'create_reports',
            'export_data',
            'view_real_time_metrics',
            
            // Gamification Management
            'manage_gamification',
            'create_badges',
            'manage_levels',
            'view_leaderboards',
            
            // Company Management
            'view_companies',
            'create_companies',
            'edit_companies',
            'view_company_analytics',
            
            // Notifications
            'send_notifications',
            'manage_notification_templates',
            'view_notification_history',
        ];

        foreach ($permissions as $permission) {
            Permission::create([
                'name' => $permission,
                'guard_name' => 'web'
            ]);
        }

        // Create roles
        $superAdminRole = Role::create([
            'name' => 'super-admin',
            'guard_name' => 'web'
        ]);

        $adminRole = Role::create([
            'name' => 'admin',
            'guard_name' => 'web'
        ]);

        $moderatorRole = Role::create([
            'name' => 'moderator',
            'guard_name' => 'web'
        ]);

        $hrRole = Role::create([
            'name' => 'hr',
            'guard_name' => 'web'
        ]);

        $userRole = Role::create([
            'name' => 'user',
            'guard_name' => 'web'
        ]);

        // Assign permissions to roles
        
        // Super Admin gets all permissions
        $superAdminRole->givePermissionTo(Permission::all());

        // Admin gets most permissions except super admin specific ones
        $adminPermissions = [
            'view_users', 'create_users', 'edit_users', 'manage_user_roles',
            'reset_user_passwords', 'lock_unlock_users', 'view_user_activity',
            'view_all_documents', 'approve_documents', 'reject_documents',
            'request_document_info', 'view_document_statistics', 'bulk_document_operations',
            'view_all_questionnaires', 'manage_questionnaire_templates',
            'view_questionnaire_analytics', 'export_health_data',
            'view_admin_dashboard', 'view_system_statistics', 'view_system_health',
            'view_action_logs', 'view_security_logs',
            'view_analytics', 'create_reports', 'export_data', 'view_real_time_metrics',
            'manage_gamification', 'create_badges', 'manage_levels', 'view_leaderboards',
            'view_companies', 'create_companies', 'edit_companies', 'view_company_analytics',
            'send_notifications', 'view_notification_history',
        ];
        $adminRole->givePermissionTo($adminPermissions);

        // Moderator gets document and user management permissions
        $moderatorPermissions = [
            'view_users', 'edit_users', 'view_user_activity',
            'view_all_documents', 'approve_documents', 'reject_documents',
            'request_document_info', 'view_document_statistics',
            'view_all_questionnaires', 'view_questionnaire_analytics',
            'view_admin_dashboard', 'view_analytics',
            'view_companies', 'view_company_analytics',
        ];
        $moderatorRole->givePermissionTo($moderatorPermissions);

        // HR gets user and company related permissions
        $hrPermissions = [
            'view_users', 'create_users', 'edit_users', 'view_user_activity',
            'view_all_documents', 'view_document_statistics',
            'view_all_questionnaires', 'export_health_data',
            'view_admin_dashboard', 'view_analytics', 'create_reports',
            'view_companies', 'create_companies', 'edit_companies', 'view_company_analytics',
            'send_notifications', 'view_notification_history',
        ];
        $hrRole->givePermissionTo($hrPermissions);

        // User role gets basic permissions (already exists in the system)
        // No admin permissions for regular users

        // Create default super admin user if it doesn't exist
        $superAdminUser = User::firstOrCreate([
            'email' => 'admin@omniportal.com'
        ], [
            'name' => 'Super Administrator',
            'cpf' => '12345678901',
            'password' => Hash::make('Admin@123'),
            'is_active' => true,
            'registration_step' => 'completed',
            'email_verified_at' => now(),
        ]);

        $superAdminUser->assignRole('super-admin');

        // Create default admin user
        $adminUser = User::firstOrCreate([
            'email' => 'admin.user@omniportal.com'
        ], [
            'name' => 'Administrator',
            'cpf' => '98765432100',
            'password' => Hash::make('Admin@456'),
            'is_active' => true,
            'registration_step' => 'completed',
            'email_verified_at' => now(),
        ]);

        $adminUser->assignRole('admin');

        // Create HR user
        $hrUser = User::firstOrCreate([
            'email' => 'hr@omniportal.com'
        ], [
            'name' => 'HR Manager',
            'cpf' => '11122233344',
            'password' => Hash::make('HR@123'),
            'department' => 'Human Resources',
            'job_title' => 'HR Manager',
            'is_active' => true,
            'registration_step' => 'completed',
            'email_verified_at' => now(),
        ]);

        $hrUser->assignRole('hr');

        $this->command->info('Admin roles and permissions created successfully!');
        $this->command->info('Super Admin: admin@omniportal.com / Admin@123');
        $this->command->info('Admin: admin.user@omniportal.com / Admin@456');
        $this->command->info('HR: hr@omniportal.com / HR@123');
    }
}