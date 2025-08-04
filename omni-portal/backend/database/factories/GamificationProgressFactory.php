<?php

namespace Database\Factories;

use App\Models\GamificationProgress;
use App\Models\Beneficiary;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GamificationProgress>
 */
class GamificationProgressFactory extends Factory
{
    protected $model = GamificationProgress::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $level = fake()->numberBetween(1, 10);
        $points = fake()->numberBetween($level * 100, $level * 200);
        
        $achievements = [];
        $achievementCount = fake()->numberBetween(1, 5);
        for ($i = 0; $i < $achievementCount; $i++) {
            $achievements[] = [
                'action' => fake()->randomElement(['profile_completed', 'document_uploaded', 'health_assessment', 'interview_completed']),
                'points' => fake()->numberBetween(10, 50),
                'date' => fake()->dateTimeBetween('-30 days', 'now')->format('Y-m-d'),
            ];
        }

        $dailyChallenges = [
            'complete_profile' => fake()->boolean(70),
            'upload_document' => fake()->boolean(60),
            'health_check' => fake()->boolean(40),
            'streak_maintained' => fake()->boolean(50),
        ];

        $weeklyGoals = [
            'documents_uploaded' => fake()->numberBetween(0, 5),
            'assessments_completed' => fake()->numberBetween(0, 3),
            'profile_updates' => fake()->numberBetween(0, 2),
            'engagement_score' => fake()->numberBetween(70, 100),
        ];

        return [
            'beneficiary_id' => Beneficiary::factory(),
            'total_points' => $points,
            'current_level' => $level,
            'points_to_next_level' => fake()->numberBetween(50, 200),
            'streak_days' => fake()->numberBetween(0, 30),
            'last_activity_date' => fake()->optional(0.8)->dateTimeBetween('-7 days', 'now'),
            'tasks_completed' => fake()->numberBetween(0, 20),
            'perfect_forms' => fake()->numberBetween(0, 10),
            'documents_uploaded' => fake()->numberBetween(0, 5),
            'health_assessments_completed' => fake()->numberBetween(0, 3),
            'profile_completed' => fake()->boolean(70),
            'onboarding_completed' => fake()->boolean(60),
            'badges_earned' => json_encode(fake()->randomElements([1, 2, 3, 4, 5, 6, 7, 8], fake()->numberBetween(0, 4))),
            'achievements' => json_encode($achievements),
            'daily_challenges' => json_encode($dailyChallenges),
            'weekly_goals' => json_encode($weeklyGoals),
            'engagement_score' => fake()->randomFloat(2, 0, 100),
            'last_badge_earned_at' => fake()->optional(0.6)->dateTimeBetween('-30 days', 'now'),
            'last_level_up_at' => fake()->optional(0.8)->dateTimeBetween('-30 days', 'now'),
        ];
    }

    /**
     * Create a beginner progress (level 1-2).
     */
    public function beginner(): static
    {
        return $this->state(fn (array $attributes) => [
            'total_points' => fake()->numberBetween(0, 200),
            'current_level' => fake()->numberBetween(1, 2),
            'badges_earned' => json_encode(fake()->randomElements([1, 2], fake()->numberBetween(0, 2))),
            'engagement_score' => fake()->randomFloat(2, 20, 60),
        ]);
    }

    /**
     * Create an intermediate progress (level 3-6).
     */
    public function intermediate(): static
    {
        return $this->state(fn (array $attributes) => [
            'total_points' => fake()->numberBetween(300, 1200),
            'current_level' => fake()->numberBetween(3, 6),
            'badges_earned' => json_encode(fake()->randomElements([1, 2, 3, 4, 5], fake()->numberBetween(2, 5))),
            'engagement_score' => fake()->randomFloat(2, 50, 80),
        ]);
    }

    /**
     * Create an advanced progress (level 7-10).
     */
    public function advanced(): static
    {
        return $this->state(fn (array $attributes) => [
            'total_points' => fake()->numberBetween(1400, 2000),
            'current_level' => fake()->numberBetween(7, 10),
            'badges_earned' => json_encode(fake()->randomElements([1, 2, 3, 4, 5, 6, 7, 8], fake()->numberBetween(5, 8))),
            'engagement_score' => fake()->randomFloat(2, 70, 100),
        ]);
    }

    /**
     * Create a highly active user progress.
     */
    public function highlyActive(): static
    {
        return $this->state(fn (array $attributes) => [
            'last_activity_date' => fake()->dateTimeBetween('-1 day', 'now'),
            'engagement_score' => fake()->randomFloat(2, 80, 100),
            'daily_challenges' => json_encode([
                'complete_profile' => true,
                'upload_document' => true,
                'health_check' => true,
                'streak_maintained' => true,
            ]),
        ]);
    }

    /**
     * Create an inactive user progress.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'last_activity_date' => fake()->dateTimeBetween('-30 days', '-7 days'),
            'engagement_score' => fake()->randomFloat(2, 0, 30),
            'daily_challenges' => json_encode([
                'complete_profile' => false,
                'upload_document' => false,
                'health_check' => false,
                'streak_maintained' => false,
            ]),
        ]);
    }
}