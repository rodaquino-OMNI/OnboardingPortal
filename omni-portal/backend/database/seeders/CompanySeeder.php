<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CompanySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        DB::table('companies')->insert([
            [
                'name' => 'Tech Corporation Ltda',
                'cnpj' => '12.345.678/0001-90',
                'trading_name' => 'TechCorp',
                'email' => 'contact@techcorp.com',
                'phone' => '+551133334444',
                'address' => 'Av. Paulista, 1000',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zip_code' => '01310-100',
                'country' => 'BR',
                'contact_person' => 'Ana Costa',
                'contact_email' => 'ana.costa@techcorp.com',
                'contact_phone' => '+5511966666666',
                'plan_type' => 'enterprise',
                'max_beneficiaries' => 500,
                'is_active' => true,
                'contract_start_date' => $now->copy()->subMonths(6),
                'contract_end_date' => $now->copy()->addYears(2),
                'settings' => json_encode([
                    'allow_self_registration' => true,
                    'require_manager_approval' => false,
                    'custom_branding' => true,
                    'sso_enabled' => true
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Startup Inovadora S.A.',
                'cnpj' => '98.765.432/0001-10',
                'trading_name' => 'InnoStart',
                'email' => 'hr@innostart.com',
                'phone' => '+551122223333',
                'address' => 'Rua Oscar Freire, 500',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zip_code' => '01426-001',
                'country' => 'BR',
                'contact_person' => 'Carlos Mendes',
                'contact_email' => 'carlos@innostart.com',
                'contact_phone' => '+5511955555555',
                'plan_type' => 'standard',
                'max_beneficiaries' => 100,
                'is_active' => true,
                'contract_start_date' => $now->copy()->subMonths(3),
                'contract_end_date' => $now->copy()->addYear(),
                'settings' => json_encode([
                    'allow_self_registration' => true,
                    'require_manager_approval' => true,
                    'custom_branding' => false,
                    'sso_enabled' => false
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Pequena Empresa ME',
                'cnpj' => '11.222.333/0001-44',
                'trading_name' => 'Pequena ME',
                'email' => 'contato@pequename.com',
                'phone' => '+551144445555',
                'address' => 'Rua das Flores, 123',
                'city' => 'Campinas',
                'state' => 'SP',
                'zip_code' => '13010-001',
                'country' => 'BR',
                'contact_person' => 'Roberto Lima',
                'contact_email' => 'roberto@pequename.com',
                'contact_phone' => '+5519988887777',
                'plan_type' => 'basic',
                'max_beneficiaries' => 20,
                'is_active' => true,
                'contract_start_date' => $now->copy()->subMonth(),
                'contract_end_date' => $now->copy()->addYear(),
                'settings' => json_encode([
                    'allow_self_registration' => false,
                    'require_manager_approval' => true,
                    'custom_branding' => false,
                    'sso_enabled' => false
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }
}