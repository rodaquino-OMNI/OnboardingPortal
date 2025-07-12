<?php

namespace Database\Factories;

use App\Models\HealthQuestionnaire;
use App\Models\User;
use App\Models\QuestionnaireTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\HealthQuestionnaire>
 */
class HealthQuestionnaireFactory extends Factory
{
    protected $model = HealthQuestionnaire::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'template_id' => QuestionnaireTemplate::factory(),
            'responses' => [
                'general_health' => [
                    'health_rating' => fake()->randomElement(['excellent', 'good', 'fair', 'poor']),
                    'pre_existing_conditions' => fake()->randomElement(['none', 'diabetes', 'hypertension']),
                    'medications' => fake()->randomElement(['none', 'daily', 'occasional']),
                ],
                'lifestyle' => [
                    'exercise_frequency' => fake()->randomElement(['daily', 'weekly', 'monthly', 'never']),
                    'diet_quality' => fake()->randomElement(['excellent', 'good', 'fair', 'poor']),
                    'smoking_drinking' => fake()->randomElement(['none', 'occasional', 'regular']),
                ],
            ],
            'risk_score' => fake()->numberBetween(0, 100),
            'risk_level' => fake()->randomElement(['low', 'medium', 'high']),
            'ai_insights' => [
                'recommendations' => [
                    'Manter alimentação balanceada',
                    'Praticar exercícios regularmente',
                    'Fazer check-ups médicos anuais'
                ],
                'risk_factors' => [],
                'health_priorities' => ['Prevenção cardiovascular', 'Controle de peso'],
            ],
            'completion_percentage' => fake()->numberBetween(0, 100),
            'status' => fake()->randomElement(['in_progress', 'completed']),
            'started_at' => fake()->dateTimeBetween('-1 month', 'now'),
            'completed_at' => null,
        ];
    }

    /**
     * Indicate that the questionnaire is completed.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'completed',
            'completion_percentage' => 100,
            'completed_at' => fake()->dateTimeBetween($attributes['started_at'], 'now'),
        ]);
    }

    /**
     * Indicate that the questionnaire is in progress.
     */
    public function inProgress(int $percentage = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'in_progress',
            'completion_percentage' => $percentage ?? fake()->numberBetween(10, 90),
            'completed_at' => null,
        ]);
    }

    /**
     * Create a questionnaire with specific risk level.
     */
    public function withRiskLevel(string $level): static
    {
        $scoreRanges = [
            'low' => [0, 30],
            'medium' => [31, 60],
            'high' => [61, 100],
        ];

        [$min, $max] = $scoreRanges[$level];

        return $this->state(fn (array $attributes) => [
            'risk_level' => $level,
            'risk_score' => fake()->numberBetween($min, $max),
        ]);
    }
}