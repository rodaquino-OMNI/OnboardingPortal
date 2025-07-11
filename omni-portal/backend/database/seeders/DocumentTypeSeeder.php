<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DocumentTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        $documentTypes = [
            // Personal Documents
            [
                'code' => 'rg',
                'name' => 'RG (Carteira de Identidade)',
                'category' => 'personal',
                'description' => 'Documento de identidade com foto',
                'is_required' => true,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf', 'jpg', 'jpeg', 'png']),
                'max_file_size' => 5242880, // 5MB
                'min_file_size' => 10240, // 10KB
                'requires_verification' => true,
                'expires' => true,
                'validity_days' => 3650, // 10 years
                'validation_rules' => json_encode([
                    'must_have_photo' => true,
                    'must_be_readable' => true,
                    'both_sides_required' => true
                ]),
                'ocr_fields' => json_encode(['name', 'rg_number', 'issue_date', 'issuing_agency']),
                'sort_order' => 1,
                'required_for_steps' => json_encode([1, 2]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'cpf',
                'name' => 'CPF (Cadastro de Pessoa Física)',
                'category' => 'personal',
                'description' => 'Comprovante de CPF',
                'is_required' => true,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf', 'jpg', 'jpeg', 'png']),
                'max_file_size' => 2097152, // 2MB
                'min_file_size' => 5120, // 5KB
                'requires_verification' => true,
                'expires' => false,
                'validity_days' => null,
                'validation_rules' => json_encode([
                    'must_show_cpf_number' => true,
                    'must_match_user_cpf' => true
                ]),
                'ocr_fields' => json_encode(['cpf_number', 'name']),
                'sort_order' => 2,
                'required_for_steps' => json_encode([1]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'proof_of_residence',
                'name' => 'Comprovante de Residência',
                'category' => 'personal',
                'description' => 'Conta de luz, água, telefone ou contrato de aluguel',
                'is_required' => true,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf', 'jpg', 'jpeg', 'png']),
                'max_file_size' => 5242880, // 5MB
                'min_file_size' => 10240, // 10KB
                'requires_verification' => true,
                'expires' => true,
                'validity_days' => 90, // 3 months
                'validation_rules' => json_encode([
                    'max_age_days' => 90,
                    'must_show_address' => true,
                    'must_show_name' => true
                ]),
                'ocr_fields' => json_encode(['address', 'issue_date', 'name']),
                'sort_order' => 3,
                'required_for_steps' => json_encode([2]),
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // Medical Documents
            [
                'code' => 'vaccination_card',
                'name' => 'Carteira de Vacinação',
                'category' => 'medical',
                'description' => 'Carteira de vacinação atualizada',
                'is_required' => false,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf', 'jpg', 'jpeg', 'png']),
                'max_file_size' => 10485760, // 10MB
                'min_file_size' => 10240, // 10KB
                'requires_verification' => true,
                'expires' => false,
                'validity_days' => null,
                'validation_rules' => json_encode([
                    'must_be_readable' => true,
                    'all_pages_required' => true
                ]),
                'ocr_fields' => json_encode(['vaccines', 'dates']),
                'sort_order' => 10,
                'required_for_steps' => json_encode([3]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'medical_prescription',
                'name' => 'Receita Médica',
                'category' => 'medical',
                'description' => 'Receitas médicas para medicamentos de uso contínuo',
                'is_required' => false,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf', 'jpg', 'jpeg', 'png']),
                'max_file_size' => 5242880, // 5MB
                'min_file_size' => 10240, // 10KB
                'requires_verification' => true,
                'expires' => true,
                'validity_days' => 180, // 6 months
                'validation_rules' => json_encode([
                    'must_have_doctor_signature' => true,
                    'must_have_crm' => true,
                    'must_have_date' => true
                ]),
                'ocr_fields' => json_encode(['medications', 'doctor_name', 'crm', 'date']),
                'sort_order' => 11,
                'required_for_steps' => json_encode([]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'medical_report',
                'name' => 'Laudo Médico',
                'category' => 'medical',
                'description' => 'Laudos e relatórios médicos',
                'is_required' => false,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf', 'jpg', 'jpeg', 'png']),
                'max_file_size' => 10485760, // 10MB
                'min_file_size' => 10240, // 10KB
                'requires_verification' => true,
                'expires' => false,
                'validity_days' => null,
                'validation_rules' => json_encode([
                    'must_have_doctor_signature' => true,
                    'must_have_crm' => true
                ]),
                'ocr_fields' => json_encode(['diagnosis', 'doctor_name', 'crm', 'date']),
                'sort_order' => 12,
                'required_for_steps' => json_encode([]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'exam_results',
                'name' => 'Resultados de Exames',
                'category' => 'medical',
                'description' => 'Resultados de exames laboratoriais e de imagem',
                'is_required' => false,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf', 'jpg', 'jpeg', 'png']),
                'max_file_size' => 20971520, // 20MB
                'min_file_size' => 10240, // 10KB
                'requires_verification' => false,
                'expires' => false,
                'validity_days' => null,
                'validation_rules' => json_encode([
                    'must_have_patient_name' => true,
                    'must_have_date' => true
                ]),
                'ocr_fields' => json_encode(['exam_type', 'results', 'date', 'lab_name']),
                'sort_order' => 13,
                'required_for_steps' => json_encode([]),
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // Financial Documents
            [
                'code' => 'income_proof',
                'name' => 'Comprovante de Renda',
                'category' => 'financial',
                'description' => 'Holerite, declaração de IR ou extrato bancário',
                'is_required' => false,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf', 'jpg', 'jpeg', 'png']),
                'max_file_size' => 5242880, // 5MB
                'min_file_size' => 10240, // 10KB
                'requires_verification' => true,
                'expires' => true,
                'validity_days' => 90, // 3 months
                'validation_rules' => json_encode([
                    'must_show_income' => true,
                    'must_show_name' => true,
                    'max_age_days' => 90
                ]),
                'ocr_fields' => json_encode(['income_value', 'period', 'employer']),
                'sort_order' => 20,
                'required_for_steps' => json_encode([]),
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // Legal Documents
            [
                'code' => 'power_of_attorney',
                'name' => 'Procuração',
                'category' => 'legal',
                'description' => 'Procuração para representação legal',
                'is_required' => false,
                'is_active' => true,
                'accepted_formats' => json_encode(['pdf']),
                'max_file_size' => 5242880, // 5MB
                'min_file_size' => 10240, // 10KB
                'requires_verification' => true,
                'expires' => true,
                'validity_days' => 365, // 1 year
                'validation_rules' => json_encode([
                    'must_be_notarized' => true,
                    'must_have_signatures' => true
                ]),
                'ocr_fields' => json_encode(['grantor', 'attorney', 'powers', 'validity']),
                'sort_order' => 30,
                'required_for_steps' => json_encode([]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('document_types')->insert($documentTypes);
    }
}