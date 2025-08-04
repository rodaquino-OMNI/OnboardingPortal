<?php

namespace Database\Factories;

use App\Models\DocumentType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\DocumentType>
 */
class DocumentTypeFactory extends Factory
{
    protected $model = DocumentType::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $documentTypes = [
            ['name' => 'RG (Carteira de Identidade)', 'category' => 'identification'],
            ['name' => 'CPF', 'category' => 'identification'],
            ['name' => 'CNH (Carteira Nacional de Habilitação)', 'category' => 'identification'],
            ['name' => 'Comprovante de Residência', 'category' => 'address'],
            ['name' => 'Cartão SUS', 'category' => 'health'],
            ['name' => 'Carteirinha do Plano de Saúde', 'category' => 'health'],
            ['name' => 'Exames Médicos', 'category' => 'medical'],
            ['name' => 'Receitas Médicas', 'category' => 'medical'],
            ['name' => 'Atestado Médico', 'category' => 'medical'],
            ['name' => 'Comprovante de Renda', 'category' => 'financial'],
            ['name' => 'Declaração de Imposto de Renda', 'category' => 'financial'],
            ['name' => 'Certidão de Nascimento', 'category' => 'civil'],
            ['name' => 'Certidão de Casamento', 'category' => 'civil'],
            ['name' => 'Titulo de Eleitor', 'category' => 'identification'],
            ['name' => 'Certificado de Reservista', 'category' => 'identification'],
        ];

        $selectedType = fake()->randomElement($documentTypes);
        $name = $selectedType['name'];
        $category = $selectedType['category'];

        $allowedExtensions = fake()->randomElements([
            'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'tiff'
        ], fake()->numberBetween(2, 4));

        $validationRules = [];
        
        // Add common validation rules based on category
        switch ($category) {
            case 'identification':
                $validationRules = [
                    'require_clear_photo' => true,
                    'require_full_document' => true,
                    'max_age_days' => 365,
                ];
                break;
            case 'medical':
                $validationRules = [
                    'require_doctor_signature' => true,
                    'max_age_days' => 180,
                    'require_date' => true,
                ];
                break;
            case 'financial':
                $validationRules = [
                    'require_official_letterhead' => true,
                    'max_age_days' => 90,
                    'require_stamp_or_signature' => true,
                ];
                break;
            case 'address':
                $validationRules = [
                    'max_age_days' => 90,
                    'require_full_address' => true,
                    'accepted_providers' => ['utilities', 'bank', 'government'],
                ];
                break;
        }

        $instructions = [
            'identification' => 'Envie uma foto clara do documento completo, sem cortes ou reflexos.',
            'medical' => 'O documento deve estar legível e conter a assinatura do médico responsável.',
            'financial' => 'Certifique-se de que o documento contenha todos os dados necessários e seja recente.',
            'address' => 'Envie um comprovante de residência em seu nome dos últimos 3 meses.',
            'civil' => 'O documento deve ser uma via original ou cópia autenticada.',
            'health' => 'Verifique se todos os dados pessoais estão visíveis e corretos.',
        ];

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'description' => fake()->sentence(fake()->numberBetween(8, 15)),
            'is_required' => fake()->boolean(70),
            'max_file_size' => fake()->numberBetween(2, 10) * 1024 * 1024, // 2MB to 10MB
            'allowed_extensions' => $allowedExtensions,
            'category' => $category,
            'sort_order' => fake()->numberBetween(1, 100),
            'validation_rules' => $validationRules,
            'example_file' => fake()->optional(0.3)->url(),
            'instructions' => $instructions[$category] ?? fake()->sentence(),
        ];
    }

    /**
     * Create a required document type.
     */
    public function required(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_required' => true,
        ]);
    }

    /**
     * Create an optional document type.
     */
    public function optional(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_required' => false,
        ]);
    }

    /**
     * Create an identification document type.
     */
    public function identification(): static
    {
        return $this->state(fn (array $attributes) => [
            'category' => 'identification',
            'is_required' => true,
            'validation_rules' => [
                'require_clear_photo' => true,
                'require_full_document' => true,
                'max_age_days' => 365,
            ],
            'instructions' => 'Envie uma foto clara do documento completo, sem cortes ou reflexos.',
        ]);
    }

    /**
     * Create a medical document type.
     */
    public function medical(): static
    {
        return $this->state(fn (array $attributes) => [
            'category' => 'medical',
            'validation_rules' => [
                'require_doctor_signature' => true,
                'max_age_days' => 180,
                'require_date' => true,
            ],
            'instructions' => 'O documento deve estar legível e conter a assinatura do médico responsável.',
        ]);
    }

    /**
     * Create a financial document type.
     */
    public function financial(): static
    {
        return $this->state(fn (array $attributes) => [
            'category' => 'financial',
            'validation_rules' => [
                'require_official_letterhead' => true,
                'max_age_days' => 90,
                'require_stamp_or_signature' => true,
            ],
            'instructions' => 'Certifique-se de que o documento contenha todos os dados necessários e seja recente.',
        ]);
    }

    /**
     * Create a large file size document type.
     */
    public function largeFile(): static
    {
        return $this->state(fn (array $attributes) => [
            'max_file_size' => fake()->numberBetween(10, 50) * 1024 * 1024, // 10MB to 50MB
            'allowed_extensions' => ['pdf', 'tiff', 'jpg', 'jpeg', 'png'],
        ]);
    }

    /**
     * Create a strict validation document type.
     */
    public function strictValidation(): static
    {
        return $this->state(fn (array $attributes) => [
            'validation_rules' => [
                'require_clear_photo' => true,
                'require_full_document' => true,
                'require_official_letterhead' => true,
                'require_stamp_or_signature' => true,
                'max_age_days' => 30,
                'require_date' => true,
                'require_full_address' => true,
            ],
        ]);
    }
}