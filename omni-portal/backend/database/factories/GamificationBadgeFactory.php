<?php

namespace Database\Factories;

use App\Models\GamificationBadge;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GamificationBadge>
 */
class GamificationBadgeFactory extends Factory
{
    protected $model = GamificationBadge::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->randomElement([
            'First Steps',
            'Document Master',
            'Health Champion',
            'Profile Complete',
            'Speed Demon',
            'Perfectionist',
            'Consistent Achiever',
            'Onboarding Hero',
            'Digital Native',
            'Health Advocate'
        ]);

        $categories = ['completion', 'engagement', 'health', 'efficiency', 'achievement'];
        $rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        $icons = ['star', 'trophy', 'medal', 'award', 'badge', 'certificate', 'crown', 'diamond'];
        $colors = ['blue', 'green', 'gold', 'purple', 'red', 'orange', 'silver', 'bronze'];

        $criteria = [
            [
                'type' => fake()->randomElement(['total_points', 'documents_uploaded', 'health_assessments_completed', 'tasks_completed']),
                'operator' => '>=',
                'value' => fake()->numberBetween(1, 10),
            ]
        ];

        // Add additional criteria for rare badges
        if (fake()->boolean(30)) {
            $criteria[] = [
                'type' => fake()->randomElement(['streak_days', 'engagement_score', 'current_level']),
                'operator' => '>=',
                'value' => fake()->numberBetween(3, 15),
            ];
        }

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'description' => fake()->sentence(fake()->numberBetween(6, 12)),
            'icon_name' => fake()->randomElement($icons),
            'icon_color' => fake()->randomElement($colors),
            'category' => fake()->randomElement($categories),
            'rarity' => fake()->randomElement($rarities),
            'points_value' => fake()->numberBetween(10, 100),
            'criteria' => $criteria,
            'is_active' => fake()->boolean(85),
            'is_secret' => fake()->boolean(20),
            'sort_order' => fake()->numberBetween(1, 100),
            'max_per_user' => fake()->numberBetween(1, 5),
            'available_from' => fake()->optional(0.3)->dateTimeBetween('-30 days', 'now'),
            'available_until' => fake()->optional(0.2)->dateTimeBetween('now', '+60 days'),
        ];
    }

    /**
     * Create a common badge.
     */
    public function common(): static
    {
        return $this->state(fn (array $attributes) => [
            'rarity' => 'common',
            'points_value' => fake()->numberBetween(10, 25),
            'criteria' => [
                [
                    'type' => 'total_points',
                    'operator' => '>=',
                    'value' => fake()->numberBetween(50, 100),
                ]
            ],
            'is_secret' => false,
        ]);
    }

    /**
     * Create a rare badge.
     */
    public function rare(): static
    {
        return $this->state(fn (array $attributes) => [
            'rarity' => 'rare',
            'points_value' => fake()->numberBetween(50, 75),
            'criteria' => [
                [
                    'type' => 'total_points',
                    'operator' => '>=',
                    'value' => fake()->numberBetween(500, 1000),
                ],
                [
                    'type' => 'streak_days',
                    'operator' => '>=',
                    'value' => fake()->numberBetween(7, 14),
                ]
            ],
            'is_secret' => fake()->boolean(40),
        ]);
    }

    /**
     * Create a legendary badge.
     */
    public function legendary(): static
    {
        return $this->state(fn (array $attributes) => [
            'rarity' => 'legendary',
            'points_value' => fake()->numberBetween(100, 200),
            'criteria' => [
                [
                    'type' => 'total_points',
                    'operator' => '>=',
                    'value' => fake()->numberBetween(1500, 2000),
                ],
                [
                    'type' => 'current_level',
                    'operator' => '>=',
                    'value' => fake()->numberBetween(8, 10),
                ],
                [
                    'type' => 'engagement_score',
                    'operator' => '>=',
                    'value' => fake()->numberBetween(85, 95),
                ]
            ],
            'is_secret' => fake()->boolean(70),
            'max_per_user' => 1,
        ]);
    }

    /**
     * Create a secret badge.
     */
    public function secret(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_secret' => true,
            'name' => fake()->randomElement(['Hidden Gem', 'Secret Achiever', 'Easter Egg', 'Mystery Master']),
            'description' => 'A mysterious achievement for those who discover hidden features.',
        ]);
    }

    /**
     * Create an inactive badge.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
            'available_until' => fake()->dateTimeBetween('-30 days', '-1 day'),
        ]);
    }

    /**
     * Create a time-limited badge.
     */
    public function timeLimited(): static
    {
        return $this->state(fn (array $attributes) => [
            'available_from' => fake()->dateTimeBetween('-7 days', 'now'),
            'available_until' => fake()->dateTimeBetween('now', '+30 days'),
            'name' => fake()->randomElement(['Limited Edition', 'Seasonal Special', 'Event Badge', 'Holiday Achievement']),
        ]);
    }
}