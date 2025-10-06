<?php

namespace Database\Factories;

use App\Models\AnalyticsEvent;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * AnalyticsEventFactory - Generate test analytics events
 *
 * Generates events for all 9 supported event types:
 * 1. auth.login_success
 * 2. auth.registration_complete
 * 3. gamification.points_earned
 * 4. gamification.level_up
 * 5. gamification.badge_earned
 * 6. health.questionnaire_completed
 * 7. document.upload_success
 * 8. document.verification_complete
 * 9. interview.scheduled
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AnalyticsEvent>
 */
class AnalyticsEventFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = AnalyticsEvent::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $eventTypes = [
            'auth.login_success',
            'gamification.points_earned',
            'health.questionnaire_completed',
            'document.upload_success',
            'interview.scheduled',
        ];

        $eventName = fake()->randomElement($eventTypes);

        return [
            'event_name' => $eventName,
            'event_category' => explode('.', $eventName)[0],
            'schema_version' => '1.0.0',
            'user_id_hash' => hash('sha256', (string) fake()->numberBetween(1, 1000)),
            'session_id' => Str::uuid()->toString(),
            'metadata' => $this->generateMetadataForEvent($eventName),
            'context' => [
                'endpoint' => fake()->randomElement(['POST /auth/login', 'POST /gamification/points', 'POST /health/questionnaire']),
                'user_role' => fake()->randomElement(['beneficiary', 'admin', 'company_admin']),
                'company_id' => fake()->numberBetween(1, 10),
            ],
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'environment' => fake()->randomElement(['production', 'staging', 'development']),
            'occurred_at' => fake()->dateTimeBetween('-30 days', 'now'),
        ];
    }

    /**
     * Generate metadata for specific event type
     *
     * @param string $eventName Event name
     * @return array Event-specific metadata
     */
    private function generateMetadataForEvent(string $eventName): array
    {
        return match($eventName) {
            'auth.login_success' => [
                'user_role' => fake()->randomElement(['beneficiary', 'admin']),
                'login_method' => fake()->randomElement(['email', 'google', 'microsoft']),
            ],
            'auth.registration_complete' => [
                'registration_step' => 'step_3',
                'total_time_seconds' => fake()->numberBetween(120, 600),
                'completion_rate' => 100,
            ],
            'gamification.points_earned' => [
                'points' => fake()->numberBetween(10, 100),
                'action_type' => fake()->randomElement(['registration_complete', 'document_uploaded', 'health_question_answered']),
                'multiplier' => fake()->randomFloat(2, 1.0, 2.0),
                'bonus_type' => fake()->optional()->randomElement(['early_completion', 'thoroughness']),
            ],
            'gamification.level_up' => [
                'old_level' => fake()->numberBetween(1, 4),
                'new_level' => fake()->numberBetween(2, 5),
                'total_points' => fake()->numberBetween(500, 5000),
            ],
            'gamification.badge_earned' => [
                'badge_id' => fake()->numberBetween(1, 10),
                'badge_name' => fake()->randomElement(['first_steps', 'health_champion', 'document_master']),
            ],
            'health.questionnaire_completed' => [
                'questionnaire_type' => fake()->randomElement(['initial_screening', 'periodic_checkup']),
                'question_count' => fake()->numberBetween(10, 30),
                'completion_time_seconds' => fake()->numberBetween(300, 1800),
            ],
            'document.upload_success' => [
                'document_type' => fake()->randomElement(['rg', 'cpf', 'comprovante_residencia']),
                'file_size_bytes' => fake()->numberBetween(100000, 5000000),
                'file_format' => fake()->randomElement(['pdf', 'jpg', 'png']),
            ],
            'document.verification_complete' => [
                'document_type' => fake()->randomElement(['rg', 'cpf', 'comprovante_residencia']),
                'verification_status' => fake()->randomElement(['approved', 'rejected', 'pending_review']),
                'processing_time_seconds' => fake()->numberBetween(5, 60),
            ],
            'interview.scheduled' => [
                'interview_type' => fake()->randomElement(['initial_interview', 'follow_up']),
                'scheduled_date' => fake()->dateTimeBetween('now', '+30 days')->format('Y-m-d H:i:s'),
                'interviewer_id' => fake()->numberBetween(1, 5),
            ],
            default => [],
        };
    }

    /**
     * State: Auth login event
     */
    public function authLogin(): static
    {
        return $this->state(fn (array $attributes) => [
            'event_name' => 'auth.login_success',
            'event_category' => 'auth',
            'metadata' => [
                'user_role' => fake()->randomElement(['beneficiary', 'admin']),
                'login_method' => 'email',
            ],
        ]);
    }

    /**
     * State: Gamification points earned event
     */
    public function pointsEarned(): static
    {
        return $this->state(fn (array $attributes) => [
            'event_name' => 'gamification.points_earned',
            'event_category' => 'gamification',
            'metadata' => [
                'points' => fake()->numberBetween(10, 100),
                'action_type' => 'document_uploaded',
                'multiplier' => 1.0,
            ],
        ]);
    }

    /**
     * State: Level up event
     */
    public function levelUp(): static
    {
        return $this->state(fn (array $attributes) => [
            'event_name' => 'gamification.level_up',
            'event_category' => 'gamification',
            'metadata' => [
                'old_level' => 1,
                'new_level' => 2,
                'total_points' => 500,
            ],
        ]);
    }

    /**
     * State: Health questionnaire completed
     */
    public function questionnaireCompleted(): static
    {
        return $this->state(fn (array $attributes) => [
            'event_name' => 'health.questionnaire_completed',
            'event_category' => 'health',
            'metadata' => [
                'questionnaire_type' => 'initial_screening',
                'question_count' => 20,
                'completion_time_seconds' => 600,
            ],
        ]);
    }

    /**
     * State: Old event (for pruning tests)
     */
    public function old(int $daysAgo = 91): static
    {
        return $this->state(fn (array $attributes) => [
            'occurred_at' => now()->subDays($daysAgo),
        ]);
    }

    /**
     * State: Recent event
     */
    public function recent(): static
    {
        return $this->state(fn (array $attributes) => [
            'occurred_at' => now()->subHours(fake()->numberBetween(1, 24)),
        ]);
    }
}
