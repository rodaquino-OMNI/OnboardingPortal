<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\GamificationProgress;
use Illuminate\Support\Facades\DB;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        DB::transaction(function () use ($now) {
            // Create admin user with complete profile
            if (!User::where('email', 'admin@omnihealth.com')->exists()) {
                $adminUser = User::create([
                    'name' => 'Super Admin',
                    'email' => 'admin@omnihealth.com',
                    'cpf' => '86042785168', // Valid CPF for testing
                    'email_verified_at' => $now,
                    'password' => Hash::make('Admin@123'),
                    'registration_step' => 'completed',
                    'lgpd_consent' => true,
                    'lgpd_consent_explicit' => true,
                    'lgpd_consent_at' => $now,
                    'lgpd_consent_ip' => '127.0.0.1',
                    'role' => 'super_admin',
                    'phone' => '+5511999999999',
                    'is_active' => true,
                    'status' => 'active',
                    'preferred_language' => 'pt-BR',
                    'preferences' => json_encode([
                        'notifications' => ['email' => true, 'sms' => true, 'push' => true],
                        'theme' => 'light',
                        'dashboard_widgets' => ['stats', 'recent_users', 'appointments']
                    ]),
                    'last_login_at' => $now,
                ]);

                // Create beneficiary profile for admin
                $this->createBeneficiaryProfile($adminUser, 'Admin User', '1980-01-01');
            }

            // Create doctor user
            if (!User::where('email', 'maria.silva@omnihealth.com')->exists()) {
                $doctorUser = User::create([
                    'name' => 'Dr. Maria Silva',
                    'email' => 'maria.silva@omnihealth.com',
                    'cpf' => '35197258073', // Valid CPF: 351.972.580-73
                    'email_verified_at' => $now,
                    'password' => Hash::make('Doctor@123!'),
                    'registration_step' => 'completed',
                    'lgpd_consent' => true,
                    'lgpd_consent_explicit' => true,
                    'lgpd_consent_at' => $now,
                    'lgpd_consent_ip' => '127.0.0.1',
                    'role' => 'super_admin',
                    'phone' => '+5511988888888',
                    'is_active' => true,
                    'status' => 'active',
                    'preferred_language' => 'pt-BR',
                    'preferences' => json_encode([
                        'notifications' => ['email' => true, 'sms' => false, 'push' => true],
                        'theme' => 'light',
                        'specialties' => ['general_medicine', 'preventive_care']
                    ]),
                    'last_login_at' => $now,
                ]);

                $this->createBeneficiaryProfile($doctorUser, 'Dr. Maria Silva', '1985-03-15');
            }

            // Create healthcare coordinator
            if (!User::where('email', 'carlos.santos@omnihealth.com')->exists()) {
                $coordUser = User::create([
                    'name' => 'Carlos Santos',
                    'email' => 'carlos.santos@omnihealth.com',
                    'cpf' => '61795244000', // Valid CPF
                    'email_verified_at' => $now,
                    'password' => Hash::make('Coord@123!'),
                    'registration_step' => 'completed',
                    'lgpd_consent' => true,
                    'lgpd_consent_explicit' => true,
                    'lgpd_consent_at' => $now,
                    'lgpd_consent_ip' => '127.0.0.1',
                    'role' => 'company_admin',
                    'phone' => '+5511977777777',
                    'is_active' => true,
                    'status' => 'active',
                    'preferred_language' => 'pt-BR',
                    'preferences' => json_encode([
                        'notifications' => ['email' => true, 'sms' => true, 'push' => false],
                        'theme' => 'light'
                    ]),
                    'last_login_at' => $now,
                ]);

                $this->createBeneficiaryProfile($coordUser, 'Carlos Santos', '1988-07-22');
            }

            // Create regular employee
            if (!User::where('email', 'ana.costa@empresa.com')->exists()) {
                $employeeUser = User::create([
                    'name' => 'Ana Costa',
                    'email' => 'ana.costa@empresa.com',
                    'cpf' => '94582736011', // Valid CPF
                    'email_verified_at' => $now,
                    'password' => Hash::make('Employee@123!'),
                    'registration_step' => 'completed',
                    'lgpd_consent' => true,
                    'lgpd_consent_explicit' => true,
                    'lgpd_consent_at' => $now,
                    'lgpd_consent_ip' => '127.0.0.1',
                    'role' => 'beneficiary',
                    'phone' => '+5511966666666',
                    'is_active' => true,
                    'status' => 'active',
                    'preferred_language' => 'pt-BR',
                    'preferences' => json_encode([
                        'notifications' => ['email' => true, 'sms' => false, 'push' => false],
                        'theme' => 'light',
                        'reports' => ['weekly' => true, 'monthly' => true]
                    ]),
                    'last_login_at' => $now,
                ]);

                $this->createBeneficiaryProfile($employeeUser, 'Ana Costa', '1990-11-30');
            }

            // Create João Santos user (backward compatibility)
            if (!User::where('email', 'joao.santos@example.com')->exists()) {
                $joaoUser = User::create([
                    'name' => 'João Santos',
                    'email' => 'joao.santos@example.com',
                    'cpf' => '12851943097', // Valid CPF
                    'email_verified_at' => $now,
                    'password' => Hash::make('User@123!'),
                    'registration_step' => 'completed',
                    'lgpd_consent' => true,
                    'lgpd_consent_explicit' => true,
                    'lgpd_consent_at' => $now,
                    'lgpd_consent_ip' => '127.0.0.1',
                    'role' => 'beneficiary',
                    'phone' => '+5511977777777',
                    'is_active' => true,
                    'status' => 'active',
                    'preferred_language' => 'pt-BR',
                    'preferences' => json_encode([
                        'notifications' => ['email' => true, 'sms' => true, 'push' => false],
                        'theme' => 'dark'
                    ]),
                    'last_login_at' => $now,
                ]);

                $this->createBeneficiaryProfile($joaoUser, 'João Santos', '1987-04-10');
            }

            // Create Ana Costa user at techcorp (backward compatibility)
            if (!User::where('email', 'ana.costa@techcorp.com')->exists()) {
                $anaUser = User::create([
                    'name' => 'Ana Costa',
                    'email' => 'ana.costa@techcorp.com',
                    'cpf' => '73640285091', // Valid CPF
                    'email_verified_at' => $now,
                    'password' => Hash::make('Company@123!'),
                    'registration_step' => 'completed',
                    'lgpd_consent' => true,
                    'lgpd_consent_explicit' => true,
                    'lgpd_consent_at' => $now,
                    'lgpd_consent_ip' => '127.0.0.1',
                    'role' => 'company_admin',
                    'phone' => '+5511966666666',
                    'is_active' => true,
                    'status' => 'active',
                    'preferred_language' => 'pt-BR',
                    'preferences' => json_encode([
                        'notifications' => ['email' => true, 'sms' => false, 'push' => false],
                        'theme' => 'light',
                        'reports' => ['weekly' => true, 'monthly' => true]
                    ]),
                    'last_login_at' => $now,
                ]);

                $this->createBeneficiaryProfile($anaUser, 'Ana Costa', '1992-09-25');
            }

            // Create some test beneficiary users with complete profiles
            for ($i = 1; $i <= 10; $i++) {
                if (!User::where('email', "testuser$i@example.com")->exists()) {
                    $testUser = User::create([
                        'name' => "Test User $i",
                        'email' => "testuser$i@example.com",
                        'cpf' => $this->generateValidCPF($i),
                        'email_verified_at' => $now,
                        'password' => Hash::make('Test@123!'),
                        'registration_step' => 'completed',
                        'lgpd_consent' => true,
                            'lgpd_consent_at' => $now,
                        'lgpd_consent_ip' => '127.0.0.1',
                        'role' => 'beneficiary',
                        'phone' => '+551195555' . str_pad($i, 4, '0', STR_PAD_LEFT),
                        'is_active' => true,
                        'status' => 'active',
                        'preferred_language' => 'pt-BR',
                        'preferences' => json_encode([
                            'notifications' => ['email' => true, 'sms' => false, 'push' => true],
                            'theme' => $i % 2 == 0 ? 'dark' : 'light'
                        ]),
                        'last_login_at' => $now,
                    ]);

                    $this->createBeneficiaryProfile($testUser, "Test User $i", '1995-' . str_pad($i, 2, '0', STR_PAD_LEFT) . '-15');
                }
            }

            $this->command->info("✅ Users seeded successfully!");
            $this->command->info("\n📊 LOGIN CREDENTIALS:");
            $this->command->info("Admin: admin@omnihealth.com / Admin@123");
            $this->command->info("Doctor: maria.silva@omnihealth.com / Doctor@123!");
            $this->command->info("Coordinator: carlos.santos@omnihealth.com / Coord@123!");
            $this->command->info("Employee: ana.costa@empresa.com / Employee@123!");
        });
    }

    /**
     * Create a beneficiary profile for a user
     */
    private function createBeneficiaryProfile($user, $fullName, $birthDate)
    {
        $beneficiary = Beneficiary::create([
            'user_id' => $user->id,
            'cpf' => $user->cpf,
            'full_name' => $fullName,
            'birth_date' => $birthDate,
            'gender' => 'other',
            'phone' => $user->phone,
            'mobile_phone' => $user->phone,
            'address' => 'Rua Exemplo',
            'number' => '100',
            'complement' => 'Sala 101',
            'neighborhood' => 'Centro',
            'city' => 'São Paulo',
            'state' => 'SP',
            'zip_code' => '01000-000',
            'country' => 'BR',
            'emergency_contact_name' => 'Contato Emergência',
            'emergency_contact_phone' => '11999999999',
            'emergency_contact_relationship' => 'Familiar',
            'marital_status' => 'single',
            'occupation' => 'Professional',
            'monthly_income' => 5000.00,
            'has_health_insurance' => true,
            'health_insurance_provider' => 'Unimed',
            'health_insurance_number' => '123456',
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

        return $beneficiary;
    }

    /**
     * Generate a valid CPF for testing
     */
    private function generateValidCPF($seed)
    {
        // Array of valid test CPFs
        $validCPFs = [
            '11144477735',
            '12345678909',
            '98765432100',
            '11111111111',
            '22222222222',
            '33333333333',
            '44444444444',
            '55555555555',
            '66666666666',
            '77777777777',
            '88888888888',
            '99999999999',
            '10101010101',
            '20202020202',
            '30303030303',
        ];

        return $validCPFs[$seed % count($validCPFs)];
    }
}