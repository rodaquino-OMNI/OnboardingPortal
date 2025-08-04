<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\GamificationProgress;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class SimpleDemoUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            // Check if user already exists
            if (User::where('email', 'demo@example.com')->exists()) {
                $this->command->info("Demo user already exists!");
                return;
            }

            // Create demo user with a simple valid CPF
            $user = User::create([
                'name' => 'João Demo Silva',
                'email' => 'demo@example.com',
                'cpf' => '35197258073', // Valid CPF: 351.972.580-73
                'password' => Hash::make('DemoPass123!'),
                'registration_step' => 'completed',
                'lgpd_consent' => true,
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
                'birth_date' => '1985-06-15',
                'gender' => 'male',
                'phone' => '11987654321',
                'mobile_phone' => '11987654321',
                'address' => 'Rua das Flores',
                'number' => '123',
                'complement' => 'Apto 45',
                'neighborhood' => 'Jardim Paulista',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zip_code' => '01234-567',
                'country' => 'BR',
                'emergency_contact_name' => 'Maria Silva',
                'emergency_contact_phone' => '11912345678',
                'emergency_contact_relationship' => 'Esposa',
                'marital_status' => 'married',
                'occupation' => 'Software Developer',
                'monthly_income' => 8500.00,
                'has_health_insurance' => true,
                'health_insurance_provider' => 'Unimed',
                'health_insurance_number' => '123456789',
                'onboarding_status' => 'completed',
                'onboarding_step' => 4,
                'onboarding_completed_at' => now(),
                'timezone' => 'America/Sao_Paulo',
                'preferred_language' => 'pt',
            ]);

            // Create gamification progress
            GamificationProgress::create([
                'beneficiary_id' => $beneficiary->id,
                'total_points' => 2850,
                'current_level' => 5,
                'points_to_next_level' => 150,
                'streak_days' => 15,
                'last_activity_date' => now()->toDateString(),
                'tasks_completed' => 45,
                'perfect_forms' => 12,
                'documents_uploaded' => 8,
                'health_assessments_completed' => 3,
                'profile_completed' => 100,
                'onboarding_completed' => 100,
                'engagement_score' => 85.5,
                'last_badge_earned_at' => now()->subDays(2),
                'last_level_up_at' => now()->subDays(5),
            ]);

            $this->command->info("✅ Demo user created successfully!");
            $this->command->info("📧 Email: demo@example.com");
            $this->command->info("🔑 Password: DemoPass123!");
            $this->command->info("🆔 CPF: 351.972.580-73");
            $this->command->info("🎯 Profile: Fully completed with gamification progress");
            $this->command->info("🏆 Level: 5 with 2850 points");
            $this->command->info("\n🚀 You can now login at http://localhost:3000/login");
        });
    }
}