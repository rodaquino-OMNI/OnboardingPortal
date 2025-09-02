<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use Spatie\Permission\Models\Role as SpatieRole;

class ConsolidateUserRolesUnifiedSystem extends Migration
{
    /**
     * Role mapping from database enum to Spatie roles
     */
    private const ROLE_MAPPING = [
        'super_admin' => 'super-admin',
        'company_admin' => 'admin',
        'beneficiary' => null, // Beneficiaries don't get Spatie roles by default
    ];

    /**
     * Run the migrations - Consolidate role systems
     */
    public function up()
    {
        // Ensure Spatie permission tables exist
        if (!Schema::hasTable('roles')) {
            $this->createSpatieRoles();
        }

        // Sync database enum roles to Spatie roles
        $this->syncDatabaseRolesToSpatie();
        
        // Create consolidated role checking procedures
        $this->createUnifiedRoleViews();
    }

    /**
     * Create missing Spatie roles based on our system
     */
    private function createSpatieRoles(): void
    {
        $requiredRoles = [
            'super-admin' => 'Super Administrator with full system access',
            'admin' => 'Administrator with company-wide access',
            'manager' => 'Manager with departmental access',
            'hr' => 'Human Resources personnel',
            'moderator' => 'Content and user moderator',
        ];

        foreach ($requiredRoles as $roleName => $description) {
            SpatieRole::firstOrCreate(
                ['name' => $roleName, 'guard_name' => 'web'],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    /**
     * Sync users with database enum roles to corresponding Spatie roles
     */
    private function syncDatabaseRolesToSpatie(): void
    {
        // Get all users with database enum roles
        $users = User::whereNotNull('role')->get();

        foreach ($users as $user) {
            $databaseRole = $user->role;
            $spatieRoleName = self::ROLE_MAPPING[$databaseRole] ?? null;

            if ($spatieRoleName) {
                try {
                    // Check if user already has any Spatie roles
                    $existingRoles = $user->roles->pluck('name')->toArray();
                    
                    if (empty($existingRoles)) {
                        // Assign the mapped Spatie role
                        $user->assignRole($spatieRoleName);
                        
                        Log::info('Assigned Spatie role based on database enum', [
                            'user_id' => $user->id,
                            'user_email' => $user->email,
                            'database_role' => $databaseRole,
                            'assigned_spatie_role' => $spatieRoleName,
                        ]);
                    } else {
                        Log::info('User already has Spatie roles, skipping assignment', [
                            'user_id' => $user->id,
                            'database_role' => $databaseRole,
                            'existing_spatie_roles' => $existingRoles,
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to assign Spatie role to user', [
                        'user_id' => $user->id,
                        'database_role' => $databaseRole,
                        'target_spatie_role' => $spatieRoleName,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
    }

    /**
     * Create database views for unified role checking
     */
    private function createUnifiedRoleViews(): void
    {
        // Drop view if it exists (SQLite compatible)
        DB::statement("DROP VIEW IF EXISTS unified_user_roles");
        
        // Create a view that combines all role sources for easy querying
        // Simplified version for SQLite compatibility
        DB::statement("
            CREATE VIEW unified_user_roles AS
            SELECT 
                u.id as user_id,
                u.email,
                u.role as database_role,
                CASE 
                    WHEN u.role = 'super_admin' THEN 100
                    WHEN u.role = 'company_admin' THEN 50
                    WHEN u.role = 'beneficiary' THEN 10
                    ELSE 0
                END as database_hierarchy_level,
                CASE
                    WHEN u.role IN ('super_admin', 'company_admin') THEN 1 ELSE 0
                END as has_database_admin
            FROM users u
        ");

        Log::info('Created unified_user_roles view for consolidated role checking');
    }

    /**
     * Reverse the migrations
     */
    public function down()
    {
        // Drop the unified view
        DB::statement("DROP VIEW IF EXISTS unified_user_roles");

        // Note: We don't remove assigned Spatie roles on rollback to prevent data loss
        // This is intentional to maintain role assignments that users may have been given

        Log::info('Rolled back unified role system migration (kept Spatie role assignments)');
    }

    /**
     * Check for role conflicts and report them
     */
    private function checkRoleConflicts(): array
    {
        $conflicts = [];
        
        $users = User::with('roles')->whereNotNull('role')->get();
        
        foreach ($users as $user) {
            $databaseRole = $user->role;
            $spatieRoles = $user->roles->pluck('name')->toArray();
            $expectedSpatieRole = self::ROLE_MAPPING[$databaseRole] ?? null;
            
            // Check for conflicts
            if ($expectedSpatieRole && !in_array($expectedSpatieRole, $spatieRoles)) {
                if (!empty($spatieRoles)) {
                    $conflicts[] = [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'database_role' => $databaseRole,
                        'expected_spatie_role' => $expectedSpatieRole,
                        'actual_spatie_roles' => $spatieRoles,
                        'conflict_type' => 'role_mismatch',
                    ];
                }
            }
            
            // Check for privilege escalation risks
            if ($databaseRole === 'beneficiary' && !empty($spatieRoles)) {
                $conflicts[] = [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'database_role' => $databaseRole,
                    'spatie_roles' => $spatieRoles,
                    'conflict_type' => 'privilege_escalation_risk',
                ];
            }
        }
        
        if (!empty($conflicts)) {
            Log::warning('Role conflicts detected', ['conflicts' => $conflicts]);
        }
        
        return $conflicts;
    }
}