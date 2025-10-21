<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * TestUserSeeder - Create test users for integration testing
 *
 * Creates users with different roles and states for comprehensive testing:
 * - test@example.com - Standard verified user
 * - admin@example.com - Admin user
 * - unverified@example.com - Unverified user
 *
 * Credentials:
 * - Password: password123 (for all test users)
 * - Email verification: Auto-verified except for unverified user
 *
 * @see tests/Feature/Health/QuestionnaireTest.php
 */
class TestUserSeeder extends Seeder
{
    /**
     * Run the database seeds
     */
    public function run(): void
    {
        // 1. Standard verified test user
        User::updateOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'email_verified_at' => now(),
                'password' => Hash::make('password123'),
            ]
        );

        // 2. Admin user
        User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin User',
                'email_verified_at' => now(),
                'password' => Hash::make('password123'),
            ]
        );

        // 3. Unverified user (for testing email verification flows)
        User::updateOrCreate(
            ['email' => 'unverified@example.com'],
            [
                'name' => 'Unverified User',
                'email_verified_at' => null, // Not verified
                'password' => Hash::make('password123'),
            ]
        );

        $this->command->info('✅ Created 3 test users (password: password123)');
    }
}
