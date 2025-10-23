<?php

namespace Database\Factories;

use App\Modules\Health\Models\Questionnaire;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Questionnaire Factory
 *
 * Generates test data for questionnaire templates.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Modules\Health\Models\Questionnaire>
 */
class QuestionnaireFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = Questionnaire::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'version' => fake()->numberBetween(1, 10),
            'schema_json' => [
                'title' => fake()->sentence(3),
                'description' => fake()->sentence(10),
                'code' => fake()->unique()->regexify('[A-Z]{3}-[0-9]{3}'),
                'type' => fake()->randomElement(['health', 'survey', 'assessment']),
                'estimated_minutes' => fake()->numberBetween(5, 30),
                'sections' => [
                    [
                        'id' => 'section_1',
                        'title' => 'General Questions',
                        'questions' => [
                            [
                                'id' => 'q1',
                                'text' => fake()->sentence(8) . '?',
                                'type' => 'boolean',
                                'required' => true,
                            ],
                            [
                                'id' => 'q2',
                                'text' => fake()->sentence(8) . '?',
                                'type' => 'text',
                                'required' => false,
                            ],
                        ],
                    ],
                ],
                'scoring_rules' => [
                    'type' => 'sum',
                    'max_score' => 100,
                ],
                'risk_assessment_rules' => [],
                'languages' => ['en'],
            ],
            'status' => fake()->randomElement(['draft', 'submitted', 'reviewed']),
            'published_at' => fake()->optional(0.7)->dateTimeBetween('-1 month', 'now'),
            'is_active' => fake()->boolean(30),
        ];
    }

    /**
     * Indicate that the questionnaire is active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => true,
            'status' => 'reviewed',
            'published_at' => now(),
        ]);
    }

    /**
     * Indicate that the questionnaire is published.
     */
    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'reviewed',
            'published_at' => now(),
        ]);
    }

    /**
     * Indicate that the questionnaire is a draft.
     */
    public function draft(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'draft',
            'published_at' => null,
            'is_active' => false,
        ]);
    }
}
