<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        DB::table('users')->insert([
            [
                'name' => 'Super Admin',
                'email' => 'admin@omnihealth.com',
                'email_verified_at' => $now,
                'password' => Hash::make('Admin@123!'),
                'role' => 'super_admin',
                'phone' => '+5511999999999',
                'is_active' => true,
                'preferred_language' => 'pt-BR',
                'preferences' => json_encode([
                    'notifications' => ['email' => true, 'sms' => true, 'push' => true],
                    'theme' => 'light',
                    'dashboard_widgets' => ['stats', 'recent_users', 'appointments']
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Dr. Maria Silva',
                'email' => 'maria.silva@omnihealth.com',
                'email_verified_at' => $now,
                'password' => Hash::make('Doctor@123!'),
                'role' => 'super_admin', // Healthcare professional with admin rights
                'phone' => '+5511988888888',
                'is_active' => true,
                'preferred_language' => 'pt-BR',
                'preferences' => json_encode([
                    'notifications' => ['email' => true, 'sms' => false, 'push' => true],
                    'theme' => 'light',
                    'specialties' => ['general_medicine', 'preventive_care']
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'João Santos',
                'email' => 'joao.santos@example.com',
                'email_verified_at' => $now,
                'password' => Hash::make('User@123!'),
                'role' => 'beneficiary',
                'phone' => '+5511977777777',
                'is_active' => true,
                'preferred_language' => 'pt-BR',
                'preferences' => json_encode([
                    'notifications' => ['email' => true, 'sms' => true, 'push' => false],
                    'theme' => 'dark'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Ana Costa',
                'email' => 'ana.costa@techcorp.com',
                'email_verified_at' => $now,
                'password' => Hash::make('Company@123!'),
                'role' => 'company_admin',
                'phone' => '+5511966666666',
                'is_active' => true,
                'preferred_language' => 'pt-BR',
                'preferences' => json_encode([
                    'notifications' => ['email' => true, 'sms' => false, 'push' => false],
                    'theme' => 'light',
                    'reports' => ['weekly' => true, 'monthly' => true]
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        // Create some test beneficiary users
        for ($i = 1; $i <= 10; $i++) {
            DB::table('users')->insert([
                'name' => "Test User $i",
                'email' => "testuser$i@example.com",
                'email_verified_at' => $now,
                'password' => Hash::make('Test@123!'),
                'role' => 'beneficiary',
                'phone' => '+551195555' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'is_active' => true,
                'preferred_language' => 'pt-BR',
                'preferences' => json_encode([
                    'notifications' => ['email' => true, 'sms' => false, 'push' => true],
                    'theme' => $i % 2 == 0 ? 'dark' : 'light'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}