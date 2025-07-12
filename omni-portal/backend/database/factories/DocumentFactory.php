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
            'user_id' => User::factory(),
            'file_name' => fake()->word() . '.pdf',
            'file_path' => 'documents/' . fake()->uuid() . '.pdf',
            'file_size' => fake()->numberBetween(100000, 5000000),
            'mime_type' => 'application/pdf',
            'document_type' => fake()->randomElement(['rg', 'cpf', 'cnh', 'address_proof']),
            'upload_status' => 'completed',
            'ocr_status' => 'pending',
            'validation_status' => 'pending',
            'ocr_data' => null,
            'validation_results' => null,
            'validation_score' => null,
        ];
    }

    /**
     * Indicate that the document is being processed.
     */
    public function processing(): static
    {
        return $this->state(fn (array $attributes) => [
            'upload_status' => 'processing',
            'ocr_status' => 'processing',
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
            'ocr_status' => 'completed',
            'ocr_data' => $ocrData ?? $defaultOcrData,
        ]);
    }

    /**
     * Indicate that the document is validated.
     */
    public function validated(array $validationResults = null): static
    {
        $defaultValidation = [
            'is_valid' => true,
            'validation_errors' => [],
            'warnings' => [],
            'confidence_score' => fake()->randomFloat(2, 0.8, 1.0),
        ];

        return $this->state(fn (array $attributes) => [
            'validation_status' => 'completed',
            'validation_results' => $validationResults ?? $defaultValidation,
            'validation_score' => fake()->numberBetween(80, 100),
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
     * Create a failed document.
     */
    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'upload_status' => 'failed',
            'ocr_status' => 'failed',
            'validation_status' => 'failed',
        ]);
    }
}