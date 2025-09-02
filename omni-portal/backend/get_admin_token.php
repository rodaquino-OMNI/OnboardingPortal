<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

try {
    // Find admin user
    $user = User::where('email', 'admin.health@test.com')->first();
    
    if (!$user) {
        echo "❌ Admin user not found\n";
        exit(1);
    }
    
    // Create a new token
    $token = $user->createToken('admin-test-token', ['*'])->plainTextToken;
    
    echo "✅ Authentication token generated\n";
    echo "Token: {$token}\n";
    echo "User: {$user->email}\n";
    echo "ID: {$user->id}\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}