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
            'beneficiary_id' => \App\Models\Beneficiary::factory(),
            'questionnaire_type' => fake()->randomElement(['initial', 'periodic', 'annual', 'specific']),
            'status' => fake()->randomElement(['draft', 'completed']),
            'height' => fake()->numberBetween(150, 200),
            'weight' => fake()->numberBetween(50, 120),
            'bmi' => fake()->randomFloat(1, 18.5, 35.0),
            'blood_type' => fake()->randomElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
            'blood_pressure_status' => fake()->randomElement(['normal', 'elevated', 'high_stage_1']),
            'blood_pressure_values' => fake()->numerify('###/##'),
            'chronic_conditions' => fake()->optional()->sentence(),
            'current_medications' => fake()->optional()->sentence(),
            'allergies' => fake()->optional()->sentence(),
            'smoking_status' => fake()->randomElement(['never', 'former', 'current']),
            'alcohol_consumption' => fake()->randomElement(['never', 'rarely', 'moderate']),
            'physical_activity_level' => fake()->randomElement(['sedentary', 'light', 'moderate', 'active']),
            'exercise_frequency_per_week' => fake()->numberBetween(0, 7),
            'diet_type' => fake()->randomElement(['omnivore', 'vegetarian', 'vegan']),
            'sleep_hours_average' => fake()->numberBetween(5, 10),
            'sleep_quality' => fake()->randomElement(['poor', 'fair', 'good', 'excellent']),
            'stress_level' => fake()->randomElement(['low', 'moderate', 'high']),
            'mental_health_concerns' => fake()->boolean(30),
            'currently_in_therapy' => fake()->boolean(20),
            'taking_mental_health_medication' => fake()->boolean(15),
            'last_medical_checkup' => fake()->dateTimeBetween('-2 years', 'now'),
            'completion_percentage' => 100,
            'accuracy_score' => fake()->numberBetween(80, 100),
            'completed_at' => now(),
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