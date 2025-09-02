<?php

require_once 'vendor/autoload.php';
require_once 'bootstrap/app.php';

use App\Models\User;
use Illuminate\Support\Facades\Hash;

// Check if admin test user already exists
$existingUser = User::where('email', 'admin.test@example.com')->first();

if ($existingUser) {
    echo "Admin test user already exists with ID: {$existingUser->id}\n";
    echo "Email: {$existingUser->email}\n";
    echo "Is Admin: " . ($existingUser->is_admin ? 'true' : 'false') . "\n";
} else {
    // Create admin test user
    $user = User::create([
        'email' => 'admin.test@example.com',
        'name' => 'Admin Test',
        'password' => Hash::make('admin123'),
        'email_verified_at' => now(),
        'is_admin' => true
    ]);
    
    echo "Admin user created successfully!\n";
    echo "ID: {$user->id}\n";
    echo "Email: {$user->email}\n";
    echo "Is Admin: " . ($user->is_admin ? 'true' : 'false') . "\n";
}