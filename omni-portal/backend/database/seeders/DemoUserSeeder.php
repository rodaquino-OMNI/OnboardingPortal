<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\GamificationProgress;
use App\Models\GamificationBadge;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class DemoUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            // Create demo user
            $user = User::create([
                'name' => 'João Demo Silva',
                'email' => 'demo@example.com',
                'cpf' => '12345678901', // Simple CPF for demo
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

            // Create beneficiary profile with complete data
            $beneficiary = Beneficiary::create([
                'user_id' => $user->id,
                'cpf' => $user->cpf,
                'full_name' => $user->name,
                'birth_date' => '1985-06-15',
                'gender' => 'male',
                'phone' => '(11) 98765-4321',
                'mobile_phone' => '(11) 98765-4321',
                'address' => 'Rua das Flores',
                'number' => '123',
                'complement' => 'Apto 45',
                'neighborhood' => 'Jardim Paulista',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zip_code' => '01234-567',
                'country' => 'BR',
                'emergency_contact_name' => 'Maria Silva',
                'emergency_contact_phone' => '(11) 91234-5678',
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
                'custom_fields' => json_encode([
                    'preferred_hospital' => 'Hospital Albert Einstein',
                    'blood_type' => 'O+',
                    'allergies' => ['Penicilina', 'Pólen'],
                ]),
                'notification_preferences' => json_encode([
                    'email' => true,
                    'sms' => true,
                    'push' => true,
                    'appointments' => true,
                    'reminders' => true,
                ]),
                'timezone' => 'America/Sao_Paulo',
                'preferred_language' => 'pt',
            ]);

            // Create gamification progress with good stats
            $gamification = GamificationProgress::create([
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
                'badges_earned' => json_encode(['early_bird', 'streak_master', 'form_perfectionist']),
                'achievements' => json_encode([
                    'first_login' => true,
                    'profile_complete' => true,
                    'first_document' => true,
                    'health_assessment' => true,
                    'streak_7_days' => true,
                    'streak_15_days' => true,
                ]),
                'daily_challenges' => json_encode([
                    ['task' => 'Complete health check', 'completed' => true, 'points' => 50],
                    ['task' => 'Upload a document', 'completed' => false, 'points' => 30],
                ]),
                'weekly_goals' => json_encode([
                    ['goal' => 'Complete 5 tasks', 'current' => 3, 'target' => 5, 'points' => 100],
                ]),
                'engagement_score' => 85.5,
                'last_badge_earned_at' => now()->subDays(2),
                'last_level_up_at' => now()->subDays(5),
            ]);

            // Create some documents
            Document::create([
                'beneficiary_id' => $beneficiary->id,
                'document_type_id' => 1, // Assuming 1 is RG
                'file_path' => 'documents/demo/rg.pdf',
                'file_size' => 1024000,
                'mime_type' => 'application/pdf',
                'original_name' => 'rg_joao_silva.pdf',
                'status' => 'approved',
                'uploaded_at' => now()->subDays(10),
                'verified_at' => now()->subDays(9),
                'verified_by' => 1,
                'expiry_date' => now()->addYears(10),
                'metadata' => json_encode([
                    'document_number' => '12.345.678-9',
                    'issue_date' => '2020-01-15',
                    'issuing_authority' => 'SSP/SP',
                ]),
            ]);

            Document::create([
                'beneficiary_id' => $beneficiary->id,
                'document_type_id' => 2, // Assuming 2 is CPF
                'file_path' => 'documents/demo/cpf.pdf',
                'file_size' => 512000,
                'mime_type' => 'application/pdf',
                'original_name' => 'cpf_joao_silva.pdf',
                'status' => 'approved',
                'uploaded_at' => now()->subDays(10),
                'verified_at' => now()->subDays(9),
                'verified_by' => 1,
            ]);

            // Create health questionnaire responses
            HealthQuestionnaire::create([
                'beneficiary_id' => $beneficiary->id,
                'questionnaire_type' => 'initial_assessment',
                'responses' => json_encode([
                    'general_health' => 'good',
                    'chronic_conditions' => ['hypertension'],
                    'medications' => ['Losartan 50mg'],
                    'exercise_frequency' => '3_times_week',
                    'smoking' => 'never',
                    'alcohol' => 'occasionally',
                    'sleep_hours' => '7-8',
                    'stress_level' => 'moderate',
                    'diet_quality' => 'balanced',
                ]),
                'risk_score' => 25,
                'recommendations' => json_encode([
                    'Continue regular exercise',
                    'Monitor blood pressure weekly',
                    'Maintain healthy diet',
                ]),
                'completed_at' => now()->subDays(7),
                'next_assessment_date' => now()->addMonths(3),
            ]);

            $this->command->info("Demo user created successfully!");
            $this->command->info("Email: demo@example.com");
            $this->command->info("Password: DemoPass123!");
            $this->command->info("CPF: 123.456.789-01");
        });
    }
}