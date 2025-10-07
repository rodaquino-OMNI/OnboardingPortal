<?php

namespace Database\Factories;

use App\Models\FeatureFlag;
use Illuminate\Database\Eloquent\Factories\Factory;

class FeatureFlagFactory extends Factory
{
    protected $model = FeatureFlag::class;

    public function definition(): array
    {
        return [
            'key' => $this->faker->unique()->word() . '_feature',
            'enabled' => $this->faker->boolean(70), // 70% enabled
            'rollout_percentage' => $this->faker->numberBetween(0, 100),
            'environments' => $this->faker->randomElements(
                ['production', 'staging', 'testing', 'local'],
                $this->faker->numberBetween(1, 4)
            ),
            'description' => $this->faker->sentence(),
        ];
    }

    /**
     * Create an enabled flag
     */
    public function enabled(): static
    {
        return $this->state(fn (array $attributes) => [
            'enabled' => true,
            'rollout_percentage' => 100,
        ]);
    }

    /**
     * Create a disabled flag
     */
    public function disabled(): static
    {
        return $this->state(fn (array $attributes) => [
            'enabled' => false,
        ]);
    }

    /**
     * Create a flag with partial rollout
     */
    public function partialRollout(int $percentage): static
    {
        return $this->state(fn (array $attributes) => [
            'enabled' => true,
            'rollout_percentage' => $percentage,
        ]);
    }
}
