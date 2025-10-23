<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * AuditLog Factory
 *
 * Generates test data for audit logs.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AuditLog>
 */
class AuditLogFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = AuditLog::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $actions = [
            'user.login',
            'user.logout',
            'health.questionnaire.submitted',
            'health.questionnaire.draft_saved',
            'points.earned',
            'badge.awarded',
        ];

        $resourceTypes = [
            'user',
            'questionnaire_response',
            'points_transaction',
            'badge',
        ];

        return [
            'user_id' => User::factory(),
            'action' => fake()->randomElement($actions),
            'resource_type' => fake()->randomElement($resourceTypes),
            'resource_id' => fake()->numberBetween(1, 1000),
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'phi_accessed' => fake()->boolean(20), // 20% chance PHI was accessed
            'occurred_at' => fake()->dateTimeBetween('-1 month', 'now'),
            'request_id' => (string) Str::uuid(),
            'session_id' => fake()->optional(0.7)->sha256(),
            'details' => [
                'extra_context' => fake()->sentence(),
                'method' => fake()->randomElement(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
            ],
        ];
    }

    /**
     * Indicate that PHI was accessed.
     */
    public function phiAccessed(): static
    {
        return $this->state(fn (array $attributes) => [
            'phi_accessed' => true,
            'action' => 'health.questionnaire.submitted',
            'resource_type' => 'questionnaire_response',
        ]);
    }

    /**
     * Indicate system action (no user).
     */
    public function systemAction(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => null,
            'action' => 'system.maintenance',
        ]);
    }
}
