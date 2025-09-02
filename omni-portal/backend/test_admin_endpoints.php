<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

try {
    echo "=== ADMIN API TESTING VERIFICATION ===\n\n";
    
    // 1. Check if admin user exists and has correct role
    echo "1. CHECKING ADMIN USER:\n";
    $user = User::where('email', 'admin.health@test.com')->first();
    
    if (!$user) {
        echo "❌ Admin user not found!\n";
        exit(1);
    }
    
    echo "✅ User found: {$user->email}\n";
    echo "   ID: {$user->id}\n";
    echo "   Is Admin (column): " . ($user->is_admin ? 'true' : 'false') . "\n";
    echo "   Database role: " . ($user->role ?? 'none') . "\n";
    
    // Check Spatie roles
    try {
        if (method_exists($user, 'roles') && $user->roles) {
            $spatieRoles = $user->roles->pluck('name')->toArray();
            echo "   Spatie roles: " . (empty($spatieRoles) ? 'none' : implode(', ', $spatieRoles)) . "\n";
        } else {
            echo "   Spatie roles: not available\n";
        }
    } catch (Exception $e) {
        echo "   Spatie roles: error - " . $e->getMessage() . "\n";
    }
    
    // 2. Check database tables that admin controller depends on
    echo "\n2. CHECKING DATABASE TABLES:\n";
    $tables = [
        'admin_roles',
        'admin_permissions',
        'admin_user_roles',
        'admin_sessions',
        'admin_action_logs',
        'admin_system_settings'
    ];
    
    foreach ($tables as $table) {
        $exists = \Schema::hasTable($table);
        echo "   {$table}: " . ($exists ? '✅' : '❌') . "\n";
    }
    
    // 3. Test basic middleware logic
    echo "\n3. TESTING MIDDLEWARE LOGIC:\n";
    
    // Check if user has unified admin role
    try {
        if (method_exists($user, 'hasUnifiedRole')) {
            $hasUnifiedRole = $user->hasUnifiedRole([
                'admin', 'super-admin', 'manager', 'hr', 'moderator',
                'super_admin', 'company_admin'
            ]);
            echo "   hasUnifiedRole: " . ($hasUnifiedRole ? '✅' : '❌') . "\n";
        } else {
            echo "   hasUnifiedRole method: ❌ not available\n";
        }
    } catch (Exception $e) {
        echo "   hasUnifiedRole error: " . $e->getMessage() . "\n";
    }
    
    // 4. Simple admin check alternatives
    echo "\n4. ALTERNATIVE ADMIN CHECKS:\n";
    
    // Check is_admin column
    $isAdminColumn = $user->is_admin;
    echo "   is_admin column: " . ($isAdminColumn ? '✅' : '❌') . "\n";
    
    // Check if user has any admin-like role
    $hasAdminLikeRole = false;
    if ($user->role && in_array($user->role, ['super_admin', 'company_admin', 'admin'])) {
        $hasAdminLikeRole = true;
    }
    
    try {
        if ($user->roles) {
            foreach ($user->roles as $role) {
                if (in_array($role->name, ['admin', 'super-admin', 'manager'])) {
                    $hasAdminLikeRole = true;
                    break;
                }
            }
        }
    } catch (Exception $e) {
        // Continue
    }
    
    echo "   Has admin-like role: " . ($hasAdminLikeRole ? '✅' : '❌') . "\n";
    
    // 5. Recommendations
    echo "\n5. RECOMMENDATIONS:\n";
    
    if (!$isAdminColumn && !$hasAdminLikeRole) {
        echo "❌ User needs admin privileges! Fix with:\n";
        echo "   - Set is_admin = true, OR\n";
        echo "   - Assign admin role via Spatie roles, OR\n";
        echo "   - Set database role to 'super_admin' or 'company_admin'\n";
    }
    
    $missingTables = array_filter($tables, function($table) {
        return !\Schema::hasTable($table);
    });
    
    if (!empty($missingTables)) {
        echo "❌ Missing database tables: " . implode(', ', $missingTables) . "\n";
        echo "   Admin endpoints will fail until these are created!\n";
    }
    
    if ($isAdminColumn || $hasAdminLikeRole) {
        echo "✅ User has basic admin access\n";
    }
    
    if (empty($missingTables)) {
        echo "✅ All required tables exist\n";
    }
    
    // 6. Generate working token
    echo "\n6. GENERATE WORKING TOKEN:\n";
    $token = $user->createToken('admin-test-token', ['*'])->plainTextToken;
    echo "   Token: {$token}\n";
    
    echo "\n=== TEST COMPLETE ===\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "   Stack trace: " . $e->getTraceAsString() . "\n";
}