<?php

namespace Database\Factories;

use App\Models\QuestionnaireTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\QuestionnaireTemplate>
 */
class QuestionnaireTemplateFactory extends Factory
{
    protected $model = QuestionnaireTemplate::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->words(3, true),
            'code' => 'template_' . fake()->unique()->numerify('#####'),
            'description' => fake()->sentence(),
            'type' => fake()->randomElement(['initial', 'periodic', 'specific', 'custom']),
            'health_category_id' => null,
            'sections' => [
                'general_health' => [
                    'title' => 'Saúde Geral',
                    'questions' => [
                        'Como você avalia sua saúde geral?',
                        'Tem alguma condição médica pré-existente?',
                        'Faz uso de medicamentos regularmente?'
                    ]
                ],
                'lifestyle' => [
                    'title' => 'Estilo de Vida',
                    'questions' => [
                        'Pratica exercícios físicos regularmente?',
                        'Como está sua alimentação?',
                        'Fuma ou consome álcool?'
                    ]
                ]
            ],
            'scoring_rules' => [
                'low_risk' => ['score_range' => [0, 30], 'recommendations' => ['Manter hábitos saudáveis']],
                'medium_risk' => ['score_range' => [31, 60], 'recommendations' => ['Acompanhamento médico regular']],
                'high_risk' => ['score_range' => [61, 100], 'recommendations' => ['Consulta médica urgente']]
            ],
            'risk_assessment_rules' => null,
            'is_active' => true,
            'version' => 1,
            'estimated_minutes' => fake()->numberBetween(10, 30),
            'required_for' => null,
            'languages' => ['pt-BR'],
        ];
    }

    /**
     * Indicate that the template is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Create a template with specific sections.
     */
    public function withCustomSections(array $sections): static
    {
        return $this->state(fn (array $attributes) => [
            'sections' => $sections,
        ]);
    }

    /**
     * Create an initial assessment template.
     */
    public function initialAssessment(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'initial',
            'code' => 'initial_health_assessment',
        ]);
    }
}