<?php

namespace Database\Factories;

use App\Models\Interview;
use App\Models\Beneficiary;
use App\Models\InterviewSlot;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Carbon\Carbon;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Interview>
 */
class InterviewFactory extends Factory
{
    protected $model = Interview::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $scheduledAt = fake()->dateTimeBetween('-7 days', '+30 days');
        $status = fake()->randomElement(['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled']);
        
        $startedAt = null;
        $endedAt = null;
        $actualDuration = null;
        
        if ($status === 'completed') {
            $startedAt = fake()->dateTimeBetween($scheduledAt, Carbon::parse($scheduledAt)->addMinutes(15));
            $endedAt = fake()->dateTimeBetween($startedAt, Carbon::parse($startedAt)->addMinutes(120));
            $actualDuration = Carbon::parse($startedAt)->diffInMinutes($endedAt);
        }

        $interviewTypes = ['initial_consultation', 'health_assessment', 'follow_up', 'specialty_consultation'];
        $meetingTypes = ['video', 'phone', 'in_person'];
        $platforms = ['zoom', 'teams', 'meet', 'webex'];

        $emergencyContact = fake()->optional(0.6)->passthrough([
            'name' => fake()->name(),
            'phone' => fake()->phoneNumber(),
            'relationship' => fake()->randomElement(['spouse', 'parent', 'sibling', 'friend']),
        ]);

        return [
            'beneficiary_id' => Beneficiary::factory(),
            'interview_slot_id' => InterviewSlot::factory(),
            'healthcare_professional_id' => User::factory()->state(['role' => 'healthcare_professional']),
            'booking_reference' => 'INT-' . fake()->unique()->randomNumber(8),
            'status' => $status,
            'scheduled_at' => $scheduledAt,
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'actual_duration_minutes' => $actualDuration,
            'interview_type' => fake()->randomElement($interviewTypes),
            'meeting_type' => fake()->randomElement($meetingTypes),
            'meeting_link' => fake()->optional(0.7)->url(),
            'meeting_platform' => fake()->randomElement($platforms),
            'notes' => fake()->optional(0.5)->paragraph(),
            'session_notes' => $status === 'completed' ? fake()->optional(0.8)->text(500) : null,
            'rating' => $status === 'completed' ? fake()->optional(0.6)->numberBetween(1, 5) : null,
            'feedback' => $status === 'completed' ? fake()->optional(0.4)->sentence() : null,
            'cancellation_reason' => $status === 'cancelled' ? fake()->sentence() : null,
            'cancelled_at' => $status === 'cancelled' ? fake()->dateTimeBetween($scheduledAt, 'now') : null,
            'cancelled_by' => $status === 'cancelled' ? User::factory() : null,
            'reschedule_reason' => $status === 'rescheduled' ? fake()->sentence() : null,
            'reschedule_count' => fake()->numberBetween(0, 2),
            'rescheduled_at' => $status === 'rescheduled' ? fake()->dateTimeBetween('-7 days', 'now') : null,
            'rescheduled_by' => $status === 'rescheduled' ? User::factory() : null,
            'reminder_sent_at' => fake()->optional(0.7)->dateTimeBetween('-7 days', 'now'),
            'confirmation_sent_at' => in_array($status, ['confirmed', 'completed']) ? fake()->dateTimeBetween('-7 days', 'now') : null,
            'follow_up_required' => $status === 'completed' ? fake()->boolean(30) : false,
            'follow_up_notes' => fake()->optional(0.2)->sentence(),
            'emergency_contact' => $emergencyContact,
            'preparation_confirmed' => fake()->boolean(70),
            'punctuality_score' => $status === 'completed' ? fake()->optional(0.8)->numberBetween(1, 10) : null,
            'booked_at' => fake()->dateTimeBetween('-30 days', 'now'),
            'confirmed_at' => in_array($status, ['confirmed', 'completed']) ? fake()->dateTimeBetween('-7 days', 'now') : null,
            'timezone' => fake()->randomElement(['America/Sao_Paulo', 'America/New_York', 'Europe/London']),
            'beneficiary_timezone' => 'America/Sao_Paulo',
            'professional_timezone' => fake()->randomElement(['America/Sao_Paulo', 'America/New_York']),
        ];
    }

    /**
     * Create a scheduled interview.
     */
    public function scheduled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'scheduled',
            'scheduled_at' => fake()->dateTimeBetween('now', '+30 days'),
            'started_at' => null,
            'ended_at' => null,
            'actual_duration_minutes' => null,
            'session_notes' => null,
            'rating' => null,
            'feedback' => null,
            'cancellation_reason' => null,
            'cancelled_at' => null,
            'cancelled_by' => null,
        ]);
    }

    /**
     * Create a completed interview.
     */
    public function completed(): static
    {
        $scheduledAt = fake()->dateTimeBetween('-30 days', '-1 day');
        $startedAt = fake()->dateTimeBetween($scheduledAt, Carbon::parse($scheduledAt)->addMinutes(15));
        $endedAt = fake()->dateTimeBetween($startedAt, Carbon::parse($startedAt)->addMinutes(120));
        
        return $this->state(fn (array $attributes) => [
            'status' => 'completed',
            'scheduled_at' => $scheduledAt,
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'actual_duration_minutes' => Carbon::parse($startedAt)->diffInMinutes($endedAt),
            'session_notes' => fake()->text(500),
            'rating' => fake()->numberBetween(3, 5),
            'feedback' => fake()->optional(0.7)->sentence(),
            'follow_up_required' => fake()->boolean(30),
            'punctuality_score' => fake()->numberBetween(7, 10),
            'confirmed_at' => fake()->dateTimeBetween('-30 days', $scheduledAt),
        ]);
    }

    /**
     * Create a cancelled interview.
     */
    public function cancelled(): static
    {
        $scheduledAt = fake()->dateTimeBetween('-7 days', '+30 days');
        
        return $this->state(fn (array $attributes) => [
            'status' => 'cancelled',
            'scheduled_at' => $scheduledAt,
            'cancellation_reason' => fake()->randomElement([
                'Patient unavailable',
                'Doctor emergency',
                'Technical issues',
                'Patient rescheduled',
                'Facility closed'
            ]),
            'cancelled_at' => fake()->dateTimeBetween('-7 days', 'now'),
            'cancelled_by' => User::factory(),
            'started_at' => null,
            'ended_at' => null,
            'actual_duration_minutes' => null,
        ]);
    }

    /**
     * Create a today's interview.
     */
    public function today(): static
    {
        $hour = fake()->numberBetween(8, 17);
        $minute = fake()->randomElement([0, 30]);
        $scheduledAt = today()->setHour($hour)->setMinute($minute);
        
        return $this->state(fn (array $attributes) => [
            'scheduled_at' => $scheduledAt,
            'status' => fake()->randomElement(['scheduled', 'confirmed']),
        ]);
    }

    /**
     * Create an upcoming interview.
     */
    public function upcoming(): static
    {
        return $this->state(fn (array $attributes) => [
            'scheduled_at' => fake()->dateTimeBetween('now', '+7 days'),
            'status' => fake()->randomElement(['scheduled', 'confirmed']),
        ]);
    }

    /**
     * Create a video consultation interview.
     */
    public function videoConsultation(): static
    {
        return $this->state(fn (array $attributes) => [
            'meeting_type' => 'video',
            'meeting_link' => fake()->url(),
            'meeting_platform' => fake()->randomElement(['zoom', 'teams', 'meet']),
        ]);
    }

    /**
     * Create a rescheduled interview.
     */
    public function rescheduled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'rescheduled',
            'reschedule_reason' => fake()->randomElement([
                'Patient request',
                'Doctor availability',
                'Technical issues',
                'Emergency situation'
            ]),
            'reschedule_count' => fake()->numberBetween(1, 3),
            'rescheduled_at' => fake()->dateTimeBetween('-7 days', 'now'),
            'rescheduled_by' => User::factory(),
        ]);
    }

    /**
     * Create a follow-up required interview.
     */
    public function followUpRequired(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'completed',
            'follow_up_required' => true,
            'follow_up_notes' => fake()->sentence(),
            'session_notes' => fake()->text(500),
        ]);
    }

    /**
     * Create a highly rated interview.
     */
    public function highlyRated(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'completed',
            'rating' => fake()->numberBetween(4, 5),
            'feedback' => fake()->positiveWords(3) . ' ' . fake()->sentence(),
            'punctuality_score' => fake()->numberBetween(8, 10),
        ]);
    }
}