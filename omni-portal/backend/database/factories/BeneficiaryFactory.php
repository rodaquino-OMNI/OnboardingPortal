<?php

namespace Database\Factories;

use App\Models\Beneficiary;
use App\Models\User;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Beneficiary>
 */
class BeneficiaryFactory extends Factory
{
    protected $model = Beneficiary::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'company_id' => null,
            'cpf' => fake()->numerify('###.###.###-##'),
            'full_name' => fake()->name(),
            'birth_date' => fake()->date(),
            'gender' => fake()->randomElement(['male', 'female', 'other', 'prefer_not_to_say']),
            'phone' => fake()->phoneNumber(),
            'mobile_phone' => fake()->phoneNumber(),
            'address' => fake()->streetName(),
            'number' => (string) fake()->numberBetween(1, 9999),
            'complement' => fake()->optional()->word(),
            'neighborhood' => fake()->word(),
            'city' => fake()->city(),
            'state' => 'SP',
            'zip_code' => fake()->numerify('#####-###'),
            'country' => 'BR',
            'emergency_contact_name' => fake()->name(),
            'emergency_contact_phone' => fake()->phoneNumber(),
            'emergency_contact_relationship' => fake()->randomElement(['spouse', 'parent', 'sibling', 'friend']),
            'marital_status' => fake()->randomElement(['single', 'married', 'divorced', 'widowed', 'other']),
            'occupation' => fake()->jobTitle(),
            'monthly_income' => fake()->randomFloat(2, 1000, 15000),
            'has_health_insurance' => fake()->boolean(),
            'health_insurance_provider' => fake()->optional()->word(),
            'health_insurance_number' => fake()->optional()->numerify('##########'),
            'onboarding_status' => 'pending',
            'onboarding_step' => 1,
            'onboarding_completed_at' => null,
            'custom_fields' => null,
        ];
    }

    /**
     * Indicate that the beneficiary belongs to a company.
     */
    public function withCompany(): static
    {
        return $this->state(fn (array $attributes) => [
            'company_id' => Company::factory(),
        ]);
    }

    /**
     * Indicate that the beneficiary has completed onboarding.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'onboarding_status' => 'completed',
            'onboarding_step' => 5, // Assuming 5 is the final step
            'onboarding_completed_at' => fake()->dateTimeBetween('-1 month', 'now'),
        ]);
    }

    /**
     * Indicate that the beneficiary is in progress.
     */
    public function inProgress(int $step = null): static
    {
        return $this->state(fn (array $attributes) => [
            'onboarding_status' => 'in_progress',
            'onboarding_step' => $step ?? fake()->numberBetween(2, 4),
        ]);
    }

    /**
     * Indicate that the beneficiary has health insurance.
     */
    public function withHealthInsurance(): static
    {
        return $this->state(fn (array $attributes) => [
            'has_health_insurance' => true,
            'health_insurance_provider' => fake()->word(),
            'health_insurance_number' => fake()->numerify('##########'),
        ]);
    }

    /**
     * Indicate that the beneficiary has no health insurance.
     */
    public function withoutHealthInsurance(): static
    {
        return $this->state(fn (array $attributes) => [
            'has_health_insurance' => false,
            'health_insurance_provider' => null,
            'health_insurance_number' => null,
        ]);
    }
}