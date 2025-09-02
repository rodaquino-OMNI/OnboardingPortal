<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\Models\Permission as SpatiePermission;
use App\Models\User;

class SyncSpatieRolesToAdminSystem extends Migration
{
    /**
     * Run the migrations with technical excellence.
     * Syncs existing Spatie roles/permissions to custom admin system.
     */
    public function up()
    {
        // Create custom admin tables if they don't exist
        if (!Schema::hasTable('admin_roles')) {
            Schema::create('admin_roles', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->string('display_name');
                $table->text('description')->nullable();
                $table->integer('hierarchy_level')->default(0);
                $table->boolean('is_system_role')->default(false);
                $table->timestamps();
                $table->index('hierarchy_level');
                $table->index('is_system_role');
            });
        }

        if (!Schema::hasTable('admin_permissions')) {
            Schema::create('admin_permissions', function (Blueprint $table) {
                $table->id();
                $table->string('identifier')->unique();
                $table->string('display_name');
                $table->text('description')->nullable();
                $table->string('resource');
                $table->string('action');
                $table->string('scope')->nullable();
                $table->boolean('is_sensitive')->default(false);
                $table->timestamps();
                $table->index(['resource', 'action']);
                $table->index('is_sensitive');
            });
        }

        if (!Schema::hasTable('admin_role_permissions')) {
            Schema::create('admin_role_permissions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('role_id')->constrained('admin_roles')->onDelete('cascade');
                $table->foreignId('permission_id')->constrained('admin_permissions')->onDelete('cascade');
                $table->timestamps();
                $table->unique(['role_id', 'permission_id']);
            });
        }

        if (!Schema::hasTable('admin_user_roles')) {
            Schema::create('admin_user_roles', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('role_id')->constrained('admin_roles')->onDelete('cascade');
                $table->timestamp('assigned_at')->useCurrent();
                $table->foreignId('assigned_by')->nullable()->constrained('users')->onDelete('set null');
                $table->text('assignment_reason')->nullable();
                $table->timestamps();
                $table->unique(['user_id', 'role_id']);
                $table->index('assigned_at');
            });
        }

        // Sync Spatie roles to admin system
        $this->syncSpatieRoles();
        
        // Sync Spatie permissions to admin system
        $this->syncSpatiePermissions();
        
        // Sync user role assignments
        $this->syncUserRoleAssignments();
    }

    /**
     * Sync Spatie roles to custom admin roles table
     */
    private function syncSpatieRoles()
    {
        try {
            // Check if Spatie roles table exists
            if (!Schema::hasTable('roles')) {
                return;
            }

            $spatieRoles = SpatieRole::all();
            
            foreach ($spatieRoles as $spatieRole) {
                DB::table('admin_roles')->updateOrInsert(
                    ['name' => $spatieRole->name],
                    [
                        'display_name' => ucfirst(str_replace(['-', '_'], ' ', $spatieRole->name)),
                        'description' => 'Migrated from Spatie role system',
                        'hierarchy_level' => $this->getHierarchyLevel($spatieRole->name),
                        'is_system_role' => in_array($spatieRole->name, ['super-admin', 'admin']),
                        'created_at' => $spatieRole->created_at ?? now(),
                        'updated_at' => now(),
                    ]
                );
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to sync Spatie roles: ' . $e->getMessage());
        }
    }

    /**
     * Sync Spatie permissions to custom admin permissions table
     */
    private function syncSpatiePermissions()
    {
        try {
            // Check if Spatie permissions table exists
            if (!Schema::hasTable('permissions')) {
                return;
            }

            $spatiePermissions = SpatiePermission::all();
            
            foreach ($spatiePermissions as $spatiePermission) {
                $parts = explode('_', $spatiePermission->name);
                $action = $parts[0] ?? 'view';
                $resource = implode('_', array_slice($parts, 1)) ?: 'general';
                
                DB::table('admin_permissions')->updateOrInsert(
                    ['identifier' => $spatiePermission->name],
                    [
                        'display_name' => ucfirst(str_replace(['-', '_'], ' ', $spatiePermission->name)),
                        'description' => 'Migrated from Spatie permission system',
                        'resource' => $resource,
                        'action' => $action,
                        'scope' => null,
                        'is_sensitive' => $this->isSensitivePermission($spatiePermission->name),
                        'created_at' => $spatiePermission->created_at ?? now(),
                        'updated_at' => now(),
                    ]
                );
            }

            // Link permissions to roles
            $this->syncRolePermissions();
        } catch (\Exception $e) {
            \Log::warning('Failed to sync Spatie permissions: ' . $e->getMessage());
        }
    }

    /**
     * Sync role-permission relationships
     */
    private function syncRolePermissions()
    {
        try {
            if (!Schema::hasTable('role_has_permissions')) {
                return;
            }

            $rolePermissions = DB::table('role_has_permissions')->get();
            
            foreach ($rolePermissions as $rp) {
                // Get Spatie role
                $spatieRole = SpatieRole::find($rp->role_id);
                if (!$spatieRole) continue;
                
                // Get admin role
                $adminRole = DB::table('admin_roles')
                    ->where('name', $spatieRole->name)
                    ->first();
                if (!$adminRole) continue;
                
                // Get Spatie permission
                $spatiePermission = SpatiePermission::find($rp->permission_id);
                if (!$spatiePermission) continue;
                
                // Get admin permission
                $adminPermission = DB::table('admin_permissions')
                    ->where('identifier', $spatiePermission->name)
                    ->first();
                if (!$adminPermission) continue;
                
                // Create relationship
                DB::table('admin_role_permissions')->updateOrInsert(
                    [
                        'role_id' => $adminRole->id,
                        'permission_id' => $adminPermission->id,
                    ],
                    [
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to sync role permissions: ' . $e->getMessage());
        }
    }

    /**
     * Sync user role assignments from Spatie to admin system
     */
    private function syncUserRoleAssignments()
    {
        try {
            if (!Schema::hasTable('model_has_roles')) {
                return;
            }

            $userRoles = DB::table('model_has_roles')
                ->where('model_type', 'App\\Models\\User')
                ->get();
            
            foreach ($userRoles as $ur) {
                // Get Spatie role
                $spatieRole = SpatieRole::find($ur->role_id);
                if (!$spatieRole) continue;
                
                // Get admin role
                $adminRole = DB::table('admin_roles')
                    ->where('name', $spatieRole->name)
                    ->first();
                if (!$adminRole) continue;
                
                // Create user-role assignment
                DB::table('admin_user_roles')->updateOrInsert(
                    [
                        'user_id' => $ur->model_id,
                        'role_id' => $adminRole->id,
                    ],
                    [
                        'assigned_at' => now(),
                        'assigned_by' => null,
                        'assignment_reason' => 'Migrated from Spatie role system',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to sync user role assignments: ' . $e->getMessage());
        }
    }

    /**
     * Determine hierarchy level based on role name
     */
    private function getHierarchyLevel($roleName)
    {
        $hierarchy = [
            'super-admin' => 100,
            'admin' => 90,
            'moderator' => 80,
            'hr' => 70,
            'manager' => 60,
            'supervisor' => 50,
            'user' => 10,
        ];
        
        return $hierarchy[$roleName] ?? 10;
    }

    /**
     * Check if permission is sensitive
     */
    private function isSensitivePermission($permissionName)
    {
        $sensitive = [
            'delete_users',
            'manage_system_settings',
            'view_security_logs',
            'manage_roles',
            'assign_roles',
            'revoke_roles',
            'delete_all_data',
            'access_api_keys',
            'view_audit_logs',
        ];
        
        return in_array($permissionName, $sensitive);
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        // We don't drop tables on rollback to prevent data loss
        // Only clear migrated data
        
        DB::table('admin_user_roles')
            ->where('assignment_reason', 'Migrated from Spatie role system')
            ->delete();
            
        DB::table('admin_role_permissions')->delete();
        
        DB::table('admin_permissions')
            ->where('description', 'Migrated from Spatie permission system')
            ->delete();
            
        DB::table('admin_roles')
            ->where('description', 'Migrated from Spatie role system')
            ->delete();
    }
}