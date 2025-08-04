<?php

namespace Database\Factories;

use App\Models\InterviewSlot;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Carbon\Carbon;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\InterviewSlot>
 */
class InterviewSlotFactory extends Factory
{
    protected $model = InterviewSlot::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $date = fake()->dateTimeBetween('now', '+30 days');
        $startHour = fake()->numberBetween(8, 17); // 8 AM to 5 PM
        $startMinute = fake()->randomElement([0, 30]); // On the hour or half hour
        $startTime = sprintf('%02d:%02d:00', $startHour, $startMinute);
        
        $durationMinutes = fake()->randomElement([30, 45, 60, 90]); // Common interview durations
        $endTime = Carbon::createFromFormat('H:i:s', $startTime)
            ->addMinutes($durationMinutes)
            ->format('H:i:s');

        $interviewTypes = ['initial_consultation', 'health_assessment', 'follow_up', 'specialty_consultation'];
        $meetingTypes = ['video', 'phone', 'in_person'];
        $statuses = ['available', 'booked', 'completed', 'cancelled'];
        $platforms = ['zoom', 'teams', 'meet', 'webex'];

        $maxBookings = fake()->numberBetween(1, 5);
        $currentBookings = fake()->numberBetween(0, $maxBookings);

        return [
            'healthcare_professional_id' => User::factory()->state(['role' => 'healthcare_professional']),
            'date' => $date,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'duration_minutes' => $durationMinutes,
            'is_available' => fake()->boolean(80),
            'status' => fake()->randomElement($statuses),
            'interview_type' => fake()->randomElement($interviewTypes),
            'meeting_type' => fake()->randomElement($meetingTypes),
            'meeting_link' => fake()->optional(0.7)->url(),
            'meeting_platform' => fake()->randomElement($platforms),
            'max_bookings' => $maxBookings,
            'current_bookings' => $currentBookings,
            'location' => fake()->optional(0.3)->address(),
            'notes' => fake()->optional(0.4)->sentence(),
            'price' => fake()->optional(0.5)->randomFloat(2, 50, 300),
            'break_duration' => fake()->numberBetween(5, 15),
            'buffer_minutes' => fake()->numberBetween(5, 15),
            'recurring_pattern' => fake()->optional(0.2)->randomElement(['weekly', 'biweekly', 'monthly']),
            'recurring_end_date' => fake()->optional(0.2)->dateTimeBetween('+30 days', '+90 days'),
            'timezone' => fake()->randomElement(['America/Sao_Paulo', 'America/New_York', 'Europe/London']),
            'specialization_required' => fake()->optional(0.3)->randomElement(['cardiology', 'dermatology', 'psychology', 'nutrition']),
            'languages_available' => fake()->randomElement([
                ['pt-BR'],
                ['en-US'],
                ['pt-BR', 'en-US'],
                ['pt-BR', 'es-ES'],
            ]),
            'preparation_requirements' => fake()->optional(0.5)->randomElement([
                ['bring_id_document'],
                ['fasting_required'],
                ['previous_exams'],
                ['medication_list'],
                ['bring_id_document', 'medication_list'],
            ]),
            'cancellation_deadline_hours' => fake()->numberBetween(12, 48),
            'reschedule_deadline_hours' => fake()->numberBetween(24, 72),
        ];
    }

    /**
     * Create an available slot.
     */
    public function available(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_available' => true,
            'status' => 'available',
            'current_bookings' => 0,
            'date' => fake()->dateTimeBetween('now', '+30 days'),
        ]);
    }

    /**
     * Create a fully booked slot.
     */
    public function fullyBooked(): static
    {
        $maxBookings = fake()->numberBetween(1, 5);
        return $this->state(fn (array $attributes) => [
            'is_available' => false,
            'status' => 'booked',
            'max_bookings' => $maxBookings,
            'current_bookings' => $maxBookings,
        ]);
    }

    /**
     * Create a slot for today.
     */
    public function today(): static
    {
        $startHour = fake()->numberBetween(8, 17);
        $startMinute = fake()->randomElement([0, 30]);
        $startTime = sprintf('%02d:%02d:00', $startHour, $startMinute);
        
        return $this->state(fn (array $attributes) => [
            'date' => today(),
            'start_time' => $startTime,
            'end_time' => Carbon::createFromFormat('H:i:s', $startTime)
                ->addMinutes(60)
                ->format('H:i:s'),
        ]);
    }

    /**
     * Create a past slot.
     */
    public function past(): static
    {
        return $this->state(fn (array $attributes) => [
            'date' => fake()->dateTimeBetween('-30 days', '-1 day'),
            'status' => fake()->randomElement(['completed', 'cancelled']),
        ]);
    }

    /**
     * Create a video consultation slot.
     */
    public function videoConsultation(): static
    {
        return $this->state(fn (array $attributes) => [
            'meeting_type' => 'video',
            'meeting_link' => fake()->url(),
            'meeting_platform' => fake()->randomElement(['zoom', 'teams', 'meet']),
            'location' => null,
        ]);
    }

    /**
     * Create an in-person consultation slot.
     */
    public function inPerson(): static
    {
        return $this->state(fn (array $attributes) => [
            'meeting_type' => 'in_person',
            'meeting_link' => null,
            'meeting_platform' => null,
            'location' => fake()->address(),
        ]);
    }

    /**
     * Create a recurring slot.
     */
    public function recurring(): static
    {
        return $this->state(fn (array $attributes) => [
            'recurring_pattern' => fake()->randomElement(['weekly', 'biweekly']),
            'recurring_end_date' => fake()->dateTimeBetween('+60 days', '+120 days'),
        ]);
    }

    /**
     * Create a specialized consultation slot.
     */
    public function specialized(): static
    {
        return $this->state(fn (array $attributes) => [
            'specialization_required' => fake()->randomElement(['cardiology', 'dermatology', 'psychology', 'nutrition', 'orthopedics']),
            'price' => fake()->randomFloat(2, 150, 500),
            'preparation_requirements' => ['previous_exams', 'medication_list'],
        ]);
    }

    /**
     * Create a premium slot with higher price.
     */
    public function premium(): static
    {
        return $this->state(fn (array $attributes) => [
            'price' => fake()->randomFloat(2, 200, 600),
            'duration_minutes' => fake()->randomElement([90, 120]),
            'specialization_required' => fake()->randomElement(['cardiology', 'neurology', 'oncology']),
            'cancellation_deadline_hours' => 48,
            'reschedule_deadline_hours' => 72,
        ]);
    }
}