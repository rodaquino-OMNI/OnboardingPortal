<?php

namespace Database\Factories;

use App\Models\GamificationLevel;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GamificationLevel>
 */
class GamificationLevelFactory extends Factory
{
    protected $model = GamificationLevel::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $levelNumber = fake()->numberBetween(1, 20);
        
        $levelNames = [
            1 => 'Novice',
            2 => 'Beginner',
            3 => 'Apprentice',
            4 => 'Intermediate',
            5 => 'Skilled',
            6 => 'Advanced',
            7 => 'Expert',
            8 => 'Master',
            9 => 'Champion',
            10 => 'Legend'
        ];

        $levelTitles = [
            1 => 'First Steps',
            2 => 'Getting Started',
            3 => 'Making Progress',
            4 => 'Building Momentum',
            5 => 'Skilled Professional',
            6 => 'Advanced User',
            7 => 'Health Expert',
            8 => 'Wellness Master',
            9 => 'Health Champion',
            10 => 'Legendary Achiever'
        ];

        $colorThemes = [
            1 => '#6B7280', // Gray
            2 => '#059669', // Green
            3 => '#0EA5E9', // Blue  
            4 => '#8B5CF6', // Purple
            5 => '#F59E0B', // Amber
            6 => '#EF4444', // Red
            7 => '#EC4899', // Pink
            8 => '#10B981', // Emerald
            9 => '#F97316', // Orange
            10 => '#FFD700' // Gold
        ];

        $icons = ['star', 'trophy', 'crown', 'medal', 'diamond', 'gem', 'award', 'badge'];

        $pointsRequired = $levelNumber === 1 ? 0 : ($levelNumber - 1) * 100 + (($levelNumber - 1) * 50);
        $pointsToNext = $levelNumber === 10 ? null : 100 + ($levelNumber * 25);

        $rewards = [];
        $unlockedFeatures = [];

        // Add rewards based on level
        if ($levelNumber >= 3) {
            $rewards[] = 'access_to_premium_content';
        }
        if ($levelNumber >= 5) {
            $rewards[] = 'priority_support';
            $unlockedFeatures[] = 'advanced_analytics';
        }
        if ($levelNumber >= 7) {
            $rewards[] = 'exclusive_badges';
            $unlockedFeatures[] = 'custom_themes';
        }
        if ($levelNumber >= 10) {
            $rewards[] = 'legend_status';
            $unlockedFeatures[] = 'all_features';
        }

        return [
            'level_number' => $levelNumber,
            'name' => $levelNames[$levelNumber] ?? fake()->word(),
            'title' => $levelTitles[$levelNumber] ?? fake()->sentence(2),
            'points_required' => $pointsRequired,
            'points_to_next' => $pointsToNext,
            'color_theme' => $colorThemes[$levelNumber] ?? fake()->hexColor(),
            'icon' => fake()->randomElement($icons),
            'rewards' => $rewards,
            'unlocked_features' => $unlockedFeatures,
            'description' => fake()->sentence(fake()->numberBetween(8, 15)),
            'discount_percentage' => $levelNumber >= 5 ? fake()->randomFloat(2, 5, 20) : 0,
            'priority_support_level' => $levelNumber >= 5 ? fake()->numberBetween(1, 3) : 0,
        ];
    }

    /**
     * Create a starter level (1-3).
     */
    public function starter(): static
    {
        $level = fake()->numberBetween(1, 3);
        return $this->state(fn (array $attributes) => [
            'level_number' => $level,
            'name' => ['Novice', 'Beginner', 'Apprentice'][$level - 1],
            'points_required' => $level === 1 ? 0 : ($level - 1) * 100,
            'points_to_next' => 100 + ($level * 25),
            'discount_percentage' => 0,
            'priority_support_level' => 0,
            'rewards' => [],
            'unlocked_features' => [],
        ]);
    }

    /**
     * Create a mid-tier level (4-7).
     */
    public function midTier(): static
    {
        $level = fake()->numberBetween(4, 7);
        return $this->state(fn (array $attributes) => [
            'level_number' => $level,
            'points_required' => ($level - 1) * 100 + (($level - 1) * 50),
            'points_to_next' => 100 + ($level * 25),
            'discount_percentage' => fake()->randomFloat(2, 5, 15),
            'priority_support_level' => fake()->numberBetween(1, 2),
            'rewards' => ['access_to_premium_content', 'priority_support'],
            'unlocked_features' => ['advanced_analytics'],
        ]);
    }

    /**
     * Create a high-tier level (8-10).
     */
    public function highTier(): static
    {
        $level = fake()->numberBetween(8, 10);
        return $this->state(fn (array $attributes) => [
            'level_number' => $level,
            'points_required' => ($level - 1) * 100 + (($level - 1) * 50),
            'points_to_next' => $level === 10 ? null : 100 + ($level * 25),
            'discount_percentage' => fake()->randomFloat(2, 15, 25),
            'priority_support_level' => 3,
            'rewards' => ['access_to_premium_content', 'priority_support', 'exclusive_badges', 'legend_status'],
            'unlocked_features' => ['advanced_analytics', 'custom_themes', 'all_features'],
        ]);
    }

    /**
     * Create the maximum level.
     */
    public function maxLevel(): static
    {
        return $this->state(fn (array $attributes) => [
            'level_number' => 10,
            'name' => 'Legend',
            'title' => 'Legendary Achiever',
            'points_required' => 1500,
            'points_to_next' => null,
            'color_theme' => '#FFD700',
            'icon' => 'crown',
            'discount_percentage' => 25,
            'priority_support_level' => 3,
            'rewards' => ['access_to_premium_content', 'priority_support', 'exclusive_badges', 'legend_status'],
            'unlocked_features' => ['advanced_analytics', 'custom_themes', 'all_features'],
        ]);
    }
}