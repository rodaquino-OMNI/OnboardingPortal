<?php

namespace Database\Factories;

use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Document>
 */
class DocumentFactory extends Factory
{
    protected $model = Document::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'beneficiary_id' => \App\Models\Beneficiary::factory(),
            'uploaded_by' => User::factory(),
            'document_type' => fake()->randomElement(['rg', 'cpf', 'cnh', 'address_proof']),
            'document_category' => fake()->randomElement(['identity', 'address', 'medical', 'financial']),
            'original_name' => fake()->word() . '.pdf',
            'stored_name' => fake()->uuid() . '.pdf',
            'file_path' => 'documents/' . fake()->uuid() . '.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => fake()->numberBetween(100000, 5000000),
            'file_extension' => 'pdf',
            'status' => 'pending',
            'rejection_reason' => null,
            'verified_by' => null,
            'verified_at' => null,
            'expiration_date' => null,
            'is_encrypted' => true,
            'encryption_key' => null,
            'metadata' => null,
            'ocr_data' => null,
            'is_sensitive' => false,
            'checksum' => fake()->sha256(),
            'version' => 1,
            'parent_document_id' => null,
        ];
    }

    /**
     * Indicate that the document is approved.
     */
    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'approved',
            'verified_by' => User::factory(),
            'verified_at' => now(),
        ]);
    }

    /**
     * Indicate that the document has OCR data.
     */
    public function withOcrData(array $ocrData = null): static
    {
        $defaultOcrData = [
            'name' => fake()->name(),
            'document_number' => fake()->numerify('#########'),
            'birth_date' => fake()->date(),
            'confidence_score' => fake()->randomFloat(2, 0.8, 1.0),
        ];

        return $this->state(fn (array $attributes) => [
            'status' => 'approved',
            'ocr_data' => $ocrData ?? $defaultOcrData,
        ]);
    }

    /**
     * Indicate that the document is validated.
     */
    public function validated(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'approved',
            'verified_by' => User::factory(),
            'verified_at' => now(),
        ]);
    }

    /**
     * Create a specific document type.
     */
    public function ofType(string $type): static
    {
        return $this->state(fn (array $attributes) => [
            'document_type' => $type,
        ]);
    }

    /**
     * Create a rejected document.
     */
    public function rejected(string $reason = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'rejected',
            'rejection_reason' => $reason ?? 'Document quality insufficient',
            'verified_by' => User::factory(),
            'verified_at' => now(),
        ]);
    }
}