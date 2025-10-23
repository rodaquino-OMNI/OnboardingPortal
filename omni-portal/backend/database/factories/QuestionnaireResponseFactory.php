<?php

namespace Database\Factories;

use App\Modules\Health\Models\Questionnaire;
use App\Modules\Health\Models\QuestionnaireResponse;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * QuestionnaireResponse Factory
 *
 * Generates test data for questionnaire responses.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Modules\Health\Models\QuestionnaireResponse>
 */
class QuestionnaireResponseFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = QuestionnaireResponse::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $answers = [
            ['question_id' => 'q1', 'value' => fake()->boolean()],
            ['question_id' => 'q2', 'value' => fake()->sentence()],
            ['question_id' => 'q3', 'value' => fake()->numberBetween(1, 5)],
        ];

        $scoreRedacted = fake()->optional(0.8)->numberBetween(0, 100);

        return [
            'questionnaire_id' => Questionnaire::factory(),
            'user_id' => User::factory(),
            'answers_encrypted_json' => $answers, // Model will encrypt automatically
            'score_redacted' => $scoreRedacted,
            'risk_band' => $this->getRiskBandFromScore($scoreRedacted),
            'submitted_at' => fake()->optional(0.6)->dateTimeBetween('-1 week', 'now'),
            'audit_ref' => fake()->optional(0.5)->uuid(),
            'metadata' => [
                'ip_address' => fake()->ipv4(),
                'user_agent' => fake()->userAgent(),
                'completion_time_seconds' => fake()->numberBetween(60, 1800),
            ],
        ];
    }

    /**
     * Indicate that the response is a draft.
     */
    public function draft(): static
    {
        return $this->state(fn (array $attributes) => [
            'submitted_at' => null,
            'score_redacted' => null,
            'risk_band' => null,
        ]);
    }

    /**
     * Indicate that the response is submitted.
     */
    public function submitted(): static
    {
        return $this->state(fn (array $attributes) => [
            'submitted_at' => now(),
            'score_redacted' => fake()->numberBetween(0, 100),
            'risk_band' => fake()->randomElement(['low', 'moderate', 'high', 'critical']),
        ]);
    }

    /**
     * Indicate a low risk response.
     */
    public function lowRisk(): static
    {
        return $this->state(fn (array $attributes) => [
            'score_redacted' => fake()->numberBetween(0, 24),
            'risk_band' => 'low',
            'submitted_at' => now(),
        ]);
    }

    /**
     * Indicate a high risk response.
     */
    public function highRisk(): static
    {
        return $this->state(fn (array $attributes) => [
            'score_redacted' => fake()->numberBetween(75, 100),
            'risk_band' => 'critical',
            'submitted_at' => now(),
        ]);
    }

    /**
     * Get risk band from score.
     *
     * @param int|null $score
     * @return string|null
     */
    private function getRiskBandFromScore(?int $score): ?string
    {
        if ($score === null) {
            return null;
        }

        if ($score <= 24) {
            return 'low';
        } elseif ($score <= 49) {
            return 'moderate';
        } elseif ($score <= 74) {
            return 'high';
        } else {
            return 'critical';
        }
    }
}
