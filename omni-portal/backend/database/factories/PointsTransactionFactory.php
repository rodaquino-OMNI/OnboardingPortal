<?php

namespace Database\Factories;

use App\Modules\Gamification\Models\PointsTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * PointsTransaction Factory
 *
 * Generates test data for gamification points transactions.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Modules\Gamification\Models\PointsTransaction>
 */
class PointsTransactionFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = PointsTransaction::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $actions = [
            'registration_completed',
            'profile_completed',
            'document_uploaded',
            'questionnaire_submitted',
            'daily_login',
            'referral_bonus',
        ];

        $points = fake()->randomElement([10, 25, 50, 100, 200]);

        return [
            'user_id' => User::factory(),
            'action' => fake()->randomElement($actions),
            'points' => $points,
            'description' => fake()->sentence(6),
            'metadata' => [
                'source' => fake()->randomElement(['manual', 'automatic', 'achievement']),
                'multiplier' => fake()->randomElement([1, 1.5, 2]),
            ],
        ];
    }

    /**
     * Indicate a large points transaction.
     */
    public function large(): static
    {
        return $this->state(fn (array $attributes) => [
            'points' => fake()->numberBetween(500, 1000),
            'action' => 'special_achievement',
        ]);
    }

    /**
     * Indicate a small points transaction.
     */
    public function small(): static
    {
        return $this->state(fn (array $attributes) => [
            'points' => fake()->numberBetween(5, 25),
            'action' => 'daily_login',
        ]);
    }
}
