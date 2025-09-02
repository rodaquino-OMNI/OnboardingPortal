<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Spatie\Permission\Models\Role;

try {
    echo "=== FIXING ADMIN USER ===\n\n";
    
    // 1. Update user to have admin privileges
    $user = User::where('email', 'admin.health@test.com')->first();
    
    if (!$user) {
        echo "❌ Admin user not found!\n";
        exit(1);
    }
    
    echo "1. UPDATING USER ADMIN STATUS:\n";
    
    // Set is_admin = true
    $user->update([
        'is_admin' => true,
        'role' => 'super_admin'  // Also set database role
    ]);
    
    echo "✅ Updated is_admin = true\n";
    echo "✅ Updated database role = 'super_admin'\n";
    
    // 2. Try to assign Spatie role if available
    echo "\n2. ASSIGNING SPATIE ROLE:\n";
    
    try {
        // Create admin role if it doesn't exist
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        
        // Assign role to user
        if (!$user->hasRole('admin')) {
            $user->assignRole('admin');
            echo "✅ Assigned 'admin' role via Spatie\n";
        } else {
            echo "✅ User already has 'admin' role\n";
        }
    } catch (Exception $e) {
        echo "⚠️  Spatie role assignment failed: " . $e->getMessage() . "\n";
        echo "   (This is OK - is_admin column should be sufficient)\n";
    }
    
    // 3. Verify the changes
    echo "\n3. VERIFICATION:\n";
    $user->refresh();
    
    echo "   is_admin: " . ($user->is_admin ? 'true' : 'false') . "\n";
    echo "   role: " . ($user->role ?? 'none') . "\n";
    
    try {
        if ($user->roles) {
            $spatieRoles = $user->roles->pluck('name')->toArray();
            echo "   Spatie roles: " . (empty($spatieRoles) ? 'none' : implode(', ', $spatieRoles)) . "\n";
        }
    } catch (Exception $e) {
        echo "   Spatie roles: not available\n";
    }
    
    // 4. Generate new token
    echo "\n4. NEW ADMIN TOKEN:\n";
    $token = $user->createToken('admin-test-token', ['*'])->plainTextToken;
    echo "   Token: {$token}\n";
    
    echo "\n✅ ADMIN USER FIXED - READY FOR TESTING!\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}