<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\GamificationProgress;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class TestLoginUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            // Check if user already exists
            if (User::where('email', 'demo@test.com')->exists()) {
                $this->command->info("Test login user already exists!");
                return;
            }

            // Create test user with the credentials you're trying to use
            $user = User::create([
                'name' => 'Test Demo User',
                'email' => 'demo@test.com',
                'cpf' => '12345678901', // Valid test CPF (allowed in non-production)
                'password' => Hash::make('password123'),
                'registration_step' => 'completed',
                'lgpd_consent' => true,
                'lgpd_consent_explicit' => true,
                'lgpd_consent_at' => now(),
                'lgpd_consent_ip' => '127.0.0.1',
                'role' => 'beneficiary',
                'is_active' => true,
                'status' => 'active',
                'email_verified_at' => now(),
                'last_login_at' => now(),
            ]);

            // Create beneficiary profile
            $beneficiary = Beneficiary::create([
                'user_id' => $user->id,
                'cpf' => $user->cpf,
                'full_name' => $user->name,
                'birth_date' => '1990-01-01',
                'gender' => 'male',
                'phone' => '11987654321',
                'mobile_phone' => '11987654321',
                'address' => 'Rua de Teste',
                'number' => '123',
                'neighborhood' => 'Centro',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zip_code' => '01234-567',
                'country' => 'BR',
                'emergency_contact_name' => 'Contato de Emergência',
                'emergency_contact_phone' => '11912345678',
                'emergency_contact_relationship' => 'Familiar',
                'marital_status' => 'single',
                'occupation' => 'Developer',
                'monthly_income' => 5000.00,
                'has_health_insurance' => false,
                'onboarding_status' => 'completed',
                'onboarding_step' => 4,
                'onboarding_completed_at' => now(),
                'timezone' => 'America/Sao_Paulo',
                'preferred_language' => 'pt',
            ]);

            // Create gamification progress
            GamificationProgress::create([
                'beneficiary_id' => $beneficiary->id,
                'total_points' => 100,
                'current_level' => 1,
                'points_to_next_level' => 400,
                'streak_days' => 1,
                'last_activity_date' => now()->toDateString(),
                'tasks_completed' => 1,
                'perfect_forms' => 0,
                'documents_uploaded' => 0,
                'health_assessments_completed' => 0,
                'profile_completed' => 100,
                'onboarding_completed' => 100,
                'engagement_score' => 50.0,
                'last_badge_earned_at' => now(),
                'last_level_up_at' => now(),
            ]);

            $this->command->info("✅ Test login user created successfully!");
            $this->command->info("📧 Email: demo@test.com");
            $this->command->info("🔑 Password: password123");
            $this->command->info("🆔 CPF: 123.456.789-01");
            $this->command->info("\n🚀 You can now login with these credentials!");
        });
    }
}