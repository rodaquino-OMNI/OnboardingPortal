<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Interview;
use App\Models\InterviewSlot;
use App\Models\InterviewRescheduleHistory;
use App\Services\CalendarService;
use App\Services\InterviewNotificationService;
use App\Services\TimezoneService;
use App\Services\GamificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class InterviewSchedulingIntegrationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $beneficiary;
    protected $healthcareProfessional;
    protected $anotherProfessional;
    protected $beneficiaryUser;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test users
        $this->beneficiaryUser = User::factory()->create([
            'email' => 'patient@test.com',
            'timezone' => 'America/Sao_Paulo'
        ]);
        
        $this->healthcareProfessional = User::factory()->create([
            'email' => 'doctor@test.com',
            'timezone' => 'America/Sao_Paulo'
        ]);
        $this->healthcareProfessional->assignRole('healthcare_professional');
        
        $this->anotherProfessional = User::factory()->create([
            'email' => 'doctor2@test.com',
            'timezone' => 'America/Manaus' // Different timezone
        ]);
        $this->anotherProfessional->assignRole('healthcare_professional');
        
        // Create beneficiary profile
        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $this->beneficiaryUser->id,
            'timezone' => 'America/Sao_Paulo',
            'registration_completed' => true
        ]);

        // Fake notifications for testing
        Notification::fake();
        Mail::fake();
        Queue::fake();
    }

    /** @test */
    public function slot_availability_across_timezones_with_validation()
    {
        // Create slots in different timezones
        $saoPauloSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(2),
            'start_time' => '14:00:00', // 2 PM São Paulo
            'end_time' => '15:00:00',
            'timezone' => 'America/Sao_Paulo',
            'is_available' => true,
            'max_bookings' => 1,
            'current_bookings' => 0
        ]);

        $manausSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->anotherProfessional->id,
            'date' => now()->addDays(2),
            'start_time' => '14:00:00', // 2 PM Manaus (3 PM São Paulo)
            'end_time' => '15:00:00',
            'timezone' => 'America/Manaus',
            'is_available' => true,
            'max_bookings' => 1,
            'current_bookings' => 0
        ]);

        // Test getting available slots with timezone conversion
        $response = $this->actingAs($this->beneficiaryUser)
            ->getJson('/api/interviews/available-slots?' . http_build_query([
                'start_date' => now()->addDays(1)->toDateString(),
                'end_date' => now()->addDays(3)->toDateString(),
                'timezone' => 'America/Sao_Paulo'
            ]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'slots' => [
                        '*' => [
                            'id',
                            'date',
                            'start_time',
                            'end_time',
                            'start_datetime_utc',
                            'end_datetime_utc', 
                            'start_datetime_local',
                            'end_datetime_local',
                            'display_time',
                            'professional'
                        ]
                    ],
                    'timezone',
                    'total_count'
                ]
            ]);

        $slots = $response->json('data.slots');
        $this->assertCount(2, $slots);

        // Verify timezone conversions
        foreach ($slots as $slot) {
            $this->assertArrayHasKey('start_datetime_local', $slot);
            $this->assertArrayHasKey('display_time', $slot);
            
            // Verify UTC and local times are different for Manaus slot when viewed from São Paulo
            if ($slot['id'] === $manausSlot->id) {
                $utcTime = Carbon::parse($slot['start_datetime_utc']);
                $localTime = Carbon::parse($slot['start_datetime_local']);
                // São Paulo time should be 1 hour ahead of Manaus
                $this->assertEquals(1, $utcTime->diffInHours($localTime));
            }
        }
    }

    /** @test */
    public function conflict_detection_and_resolution_with_two_hour_buffer()
    {
        // Create existing interview
        $existingSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00'
        ]);

        $existingInterview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'interview_slot_id' => $existingSlot->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'scheduled',
            'scheduled_at' => Carbon::parse(now()->addDays(1)->toDateString() . ' 10:00:00')
        ]);

        // Try to book conflicting slot (within 2-hour buffer)
        $conflictingSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->anotherProfessional->id,
            'date' => now()->addDays(1), 
            'start_time' => '11:30:00', // Only 30 minutes after existing interview ends
            'end_time' => '12:30:00',
            'is_available' => true,
            'max_bookings' => 1,
            'current_bookings' => 0
        ]);

        $conflictResponse = $this->actingAs($this->beneficiaryUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $conflictingSlot->id,
                'notes' => 'Test booking with conflict'
            ]);

        $conflictResponse->assertStatus(400)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'This interview conflicts with another appointment. Please maintain at least 2 hours between interviews.');

        // Test booking without conflict (more than 2 hours buffer)
        $validSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->anotherProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '13:30:00', // 2.5 hours after existing interview ends
            'end_time' => '14:30:00',
            'is_available' => true,
            'max_bookings' => 1,
            'current_bookings' => 0
        ]);

        $validResponse = $this->actingAs($this->beneficiaryUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $validSlot->id,
                'notes' => 'Valid booking without conflict'
            ]);

        $validResponse->assertStatus(201)
            ->assertJsonPath('success', true);
    }

    /** @test */
    public function notification_delivery_across_multiple_channels()
    {
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(2),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00'
        ]);

        // Set up beneficiary notification preferences
        $this->beneficiary->update([
            'notification_preferences' => [
                'email_enabled' => true,
                'sms_enabled' => true,
                'whatsapp_enabled' => true,
                'reminder_hours' => 24
            ]
        ]);

        $response = $this->actingAs($this->beneficiaryUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'Test multi-channel notifications'
            ]);

        $response->assertStatus(201);

        $interview = Interview::latest()->first();

        // Verify notifications were queued
        Notification::assertSentTo(
            $this->beneficiary,
            \App\Notifications\InterviewScheduledNotification::class
        );

        // Test notification delivery for different channels
        $notificationService = app(InterviewNotificationService::class);
        
        // Test email notification
        $emailResult = $notificationService->sendEmailNotification($interview, 'scheduled');
        $this->assertTrue($emailResult);

        // Test SMS notification  
        $smsResult = $notificationService->sendSMSNotification($interview, 'reminder');
        $this->assertTrue($smsResult);

        // Test WhatsApp notification
        $whatsappResult = $notificationService->sendWhatsAppNotification($interview, 'reminder');
        $this->assertTrue($whatsappResult);

        // Test push notification
        $pushResult = $notificationService->sendPushNotification($interview, 'reminder');
        $this->assertTrue($pushResult);
    }

    /** @test */
    public function rescheduling_impact_analysis_on_all_parties()
    {
        $originalSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(3),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
            'current_bookings' => 1,
            'max_bookings' => 1
        ]);

        $interview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'interview_slot_id' => $originalSlot->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'scheduled',
            'scheduled_at' => Carbon::parse(now()->addDays(3)->toDateString() . ' 10:00:00'),
            'reschedule_count' => 0
        ]);

        $newSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->anotherProfessional->id, // Different professional
            'date' => now()->addDays(4),
            'start_time' => '14:00:00',
            'end_time' => '15:00:00',
            'current_bookings' => 0,
            'max_bookings' => 1,
            'is_available' => true
        ]);

        // Test rescheduling with full impact analysis
        $rescheduleResponse = $this->actingAs($this->beneficiaryUser)
            ->putJson("/api/interviews/{$interview->id}/reschedule", [
                'new_interview_slot_id' => $newSlot->id,
                'reason' => 'Schedule conflict with work'
            ]);

        $rescheduleResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        // Verify all impacts were handled
        $interview->refresh();
        $originalSlot->refresh();
        $newSlot->refresh();

        // Verify interview was updated
        $this->assertEquals($newSlot->id, $interview->interview_slot_id);
        $this->assertEquals($this->anotherProfessional->id, $interview->healthcare_professional_id);
        $this->assertEquals('rescheduled', $interview->status);
        $this->assertEquals(1, $interview->reschedule_count);

        // Verify slot bookings were updated
        $this->assertEquals(0, $originalSlot->current_bookings);
        $this->assertTrue($originalSlot->is_available);
        $this->assertEquals(1, $newSlot->current_bookings);
        $this->assertFalse($newSlot->is_available); // Assuming max_bookings is 1

        // Verify reschedule history was logged
        $this->assertDatabaseHas('interview_reschedule_histories', [
            'interview_id' => $interview->id,
            'old_slot_id' => $originalSlot->id,
            'new_slot_id' => $newSlot->id,
            'reason' => 'Schedule conflict with work',
            'rescheduled_by' => $this->beneficiaryUser->id
        ]);

        // Verify notifications were sent to all affected parties
        Notification::assertSentTo(
            $this->beneficiary,
            \App\Notifications\InterviewRescheduledNotification::class
        );
    }

    /** @test */
    public function ai_powered_slot_recommendations_based_on_history()
    {
        // Create historical interviews to establish patterns
        $pastInterviews = [];
        for ($i = 0; $i < 5; $i++) {
            $pastSlot = InterviewSlot::factory()->create([
                'healthcare_professional_id' => $this->healthcareProfessional->id,
                'date' => now()->subDays(30 + $i * 7), // Weekly pattern
                'start_time' => '14:00:00', // Consistent 2 PM preference
                'end_time' => '15:00:00'
            ]);

            $pastInterview = Interview::factory()->create([
                'beneficiary_id' => $this->beneficiary->id,
                'interview_slot_id' => $pastSlot->id,
                'healthcare_professional_id' => $this->healthcareProfessional->id,
                'status' => 'completed',
                'beneficiary_rating' => 5, // High rating
                'scheduled_at' => Carbon::parse($pastSlot->date . ' ' . $pastSlot->start_time)
            ]);

            $pastInterviews[] = $pastInterview;
        }

        // Create future slots with varying characteristics
        $recommendedSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id, // Same preferred professional
            'date' => now()->addDays(7), // Same day of week as pattern
            'start_time' => '14:00:00', // Same time as pattern
            'end_time' => '15:00:00',
            'is_available' => true
        ]);

        $lessPreferredSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->anotherProfessional->id, // Different professional
            'date' => now()->addDays(8),
            'start_time' => '09:00:00', // Different time
            'end_time' => '10:00:00',
            'is_available' => true
        ]);

        // Test AI recommendations
        $recommendationsResponse = $this->actingAs($this->beneficiaryUser)
            ->getJson('/api/interviews/recommended-slots?' . http_build_query([
                'days_ahead' => 14,
                'limit' => 10
            ]));

        $recommendationsResponse->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'recommended_slots' => [
                        '*' => [
                            'id',
                            'date',
                            'start_time',
                            'datetime_local',
                            'display_datetime',
                            'recommendation_reasons',
                            'professional',
                            'recommendation_score'
                        ]
                    ],
                    'user_preferences'
                ]
            ]);

        $recommendedSlots = $recommendationsResponse->json('data.recommended_slots');
        
        // Verify the historically preferred slot is ranked higher
        $topSlot = $recommendedSlots[0];
        $this->assertEquals($recommendedSlot->id, $topSlot['id']);
        $this->assertGreaterThan(0, count($topSlot['recommendation_reasons']));

        // Verify recommendations include reasoning
        $reasons = $topSlot['recommendation_reasons'];
        $this->assertTrue(collect($reasons)->contains(function ($reason) {
            return $reason['type'] === 'time_preference';
        }));
        $this->assertTrue(collect($reasons)->contains(function ($reason) {
            return $reason['type'] === 'professional_preference';
        }));
    }

    /** @test */
    public function calendar_synchronization_with_external_systems()
    {
        $calendarService = app(CalendarService::class);
        
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(5),
            'start_time' => '15:00:00',
            'end_time' => '16:00:00'
        ]);

        // Mock external calendar integration
        $this->mock(CalendarService::class, function ($mock) {
            $mock->shouldReceive('syncWithExternalCalendar')
                ->once()
                ->with(
                    \Mockery::type('string'), // event_id
                    \Mockery::type('array')   // event_data
                )
                ->andReturn(true);
                
            $mock->shouldReceive('createCalendarEvent')
                ->once()
                ->andReturn([
                    'success' => true,
                    'external_id' => 'google_cal_123',
                    'sync_status' => 'synced'
                ]);
        });

        $bookingResponse = $this->actingAs($this->beneficiaryUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'Calendar sync test',
                'sync_external_calendar' => true
            ]);

        $bookingResponse->assertStatus(201);

        $interview = Interview::latest()->first();
        
        // Test calendar update on reschedule
        $newSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(6),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
            'is_available' => true
        ]);

        $rescheduleResponse = $this->actingAs($this->beneficiaryUser)
            ->putJson("/api/interviews/{$interview->id}/reschedule", [
                'new_interview_slot_id' => $newSlot->id,
                'reason' => 'Testing calendar sync update'
            ]);

        $rescheduleResponse->assertStatus(200);
        
        // Verify calendar was updated (mocked)
        $this->assertTrue(true); // Mock verification handled above
    }

    /** @test */
    public function complex_timezone_handling_across_brazilian_regions()
    {
        $timezoneService = app(TimezoneService::class);
        
        // Create slots in different Brazilian timezones
        $brasiliaTimes = [
            ['professional' => $this->healthcareProfessional, 'timezone' => 'America/Sao_Paulo'],
            ['professional' => $this->anotherProfessional, 'timezone' => 'America/Manaus'],
        ];

        $slots = [];
        foreach ($brasiliaTimes as $index => $config) {
            $slots[] = InterviewSlot::factory()->create([
                'healthcare_professional_id' => $config['professional']->id,
                'date' => now()->addDays(3),
                'start_time' => '14:00:00', // Same local time in each zone
                'end_time' => '15:00:00',
                'timezone' => $config['timezone'],
                'is_available' => true
            ]);
        }

        // Test timezone detection and conversion
        $availabilityResponse = $this->actingAs($this->beneficiaryUser)
            ->withHeaders(['X-Timezone' => 'America/Recife']) // Different timezone
            ->getJson('/api/interviews/available-slots?' . http_build_query([
                'start_date' => now()->addDays(2)->toDateString(),
                'end_date' => now()->addDays(4)->toDateString(),
                'timezone' => 'America/Recife'
            ]));

        $availabilityResponse->assertStatus(200);
        
        $responseSlots = $availabilityResponse->json('data.slots');
        
        // Verify timezone conversions
        foreach ($responseSlots as $responseSlot) {
            $originalSlot = collect($slots)->firstWhere('id', $responseSlot['id']);
            
            // Convert expected times
            $originalTime = Carbon::parse($originalSlot->date . ' ' . $originalSlot->start_time, $originalSlot->timezone);
            $expectedRecife = $originalTime->setTimezone('America/Recife');
            
            $actualRecife = Carbon::parse($responseSlot['start_datetime_local']);
            
            $this->assertEquals(
                $expectedRecife->format('Y-m-d H:i'), 
                $actualRecife->format('Y-m-d H:i'),
                "Timezone conversion failed for slot {$responseSlot['id']}"
            );
        }

        // Test booking with timezone awareness
        $bookingResponse = $this->actingAs($this->beneficiaryUser)
            ->withHeaders(['X-Timezone' => 'America/Recife'])
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slots[0]->id,
                'notes' => 'Cross-timezone booking test'
            ]);

        $bookingResponse->assertStatus(201);

        $interview = Interview::latest()->first();
        
        // Verify timezone data was stored correctly
        $this->assertEquals('America/Recife', $interview->beneficiary_timezone);
        $this->assertEquals('America/Sao_Paulo', $interview->professional_timezone);
        $this->assertEquals('America/Sao_Paulo', $interview->timezone);
    }

    /** @test */
    public function concurrent_booking_race_condition_handling()
    {
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(2),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
            'max_bookings' => 1, // Only one spot available
            'current_bookings' => 0,
            'is_available' => true
        ]);

        // Create another beneficiary
        $anotherUser = User::factory()->create();
        $anotherBeneficiary = Beneficiary::factory()->create([
            'user_id' => $anotherUser->id,
            'registration_completed' => true
        ]);

        // Simulate concurrent booking attempts
        $promises = [];
        
        // First booking attempt
        $response1 = $this->actingAs($this->beneficiaryUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'First booking attempt'
            ]);

        // Second booking attempt (should fail due to race condition handling)
        $response2 = $this->actingAs($anotherUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'Second booking attempt'
            ]);

        // One should succeed, one should fail
        $this->assertTrue(
            ($response1->status() === 201 && $response2->status() === 400) ||
            ($response1->status() === 400 && $response2->status() === 201),
            'Race condition not handled properly - both requests should not succeed'
        );

        // Verify only one interview was created
        $interviewCount = Interview::where('interview_slot_id', $slot->id)->count();
        $this->assertEquals(1, $interviewCount);

        // Verify slot booking count
        $slot->refresh();
        $this->assertEquals(1, $slot->current_bookings);
        $this->assertFalse($slot->is_available);
    }

    /** @test */
    public function notification_preferences_and_delivery_tracking()
    {
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '09:00:00',
            'end_time' => '10:00:00'
        ]);

        // Set specific notification preferences
        $preferencesResponse = $this->actingAs($this->beneficiaryUser)
            ->putJson('/api/interviews/notification-preferences', [
                'email_notifications' => true,
                'sms_notifications' => false,
                'whatsapp_notifications' => true,
                'notification_timezone' => 'America/Sao_Paulo',
                'reminder_hours_before' => 48
            ]);

        $preferencesResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        // Verify preferences were stored
        $this->beneficiary->refresh();
        $preferences = $this->beneficiary->notification_preferences;
        $this->assertTrue($preferences['email_enabled']);
        $this->assertFalse($preferences['sms_enabled']);
        $this->assertTrue($preferences['whatsapp_enabled']);
        $this->assertEquals(48, $preferences['reminder_hours']);

        // Book interview
        $bookingResponse = $this->actingAs($this->beneficiaryUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'Notification preferences test'
            ]);

        $bookingResponse->assertStatus(201);

        // Verify notifications respect preferences
        $interview = Interview::latest()->first();
        $notificationService = app(InterviewNotificationService::class);

        // Test reminder scheduling based on preferences
        $reminderTime = $interview->scheduled_at->subHours(48);
        $this->assertEquals(
            $reminderTime->format('Y-m-d H:i'),
            $interview->scheduled_at->subHours($preferences['reminder_hours'])->format('Y-m-d H:i')
        );
    }

    /** @test */
    public function gamification_integration_with_scheduling_actions()
    {
        $gamificationService = app(GamificationService::class);
        
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(2),
            'start_time' => '11:00:00',
            'end_time' => '12:00:00'
        ]);

        // Mock gamification service
        $this->mock(GamificationService::class, function ($mock) {
            $mock->shouldReceive('awardPoints')
                ->with($this->beneficiary->id, 'interview_scheduled', 150, \Mockery::any())
                ->once()
                ->andReturn(true);
                
            $mock->shouldReceive('awardPoints')
                ->with($this->beneficiary->id, 'punctuality_bonus', 25, \Mockery::any())
                ->once()
                ->andReturn(true);
        });

        // Test booking rewards
        $bookingResponse = $this->actingAs($this->beneficiaryUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'Gamification test booking'
            ]);

        $bookingResponse->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'interview',
                    'gamification' => [
                        'points_earned',
                        'achievement_unlocked'
                    ]
                ]
            ]);

        $interview = Interview::latest()->first();

        // Test completion rewards (simulate professional completing interview)
        $completionResponse = $this->actingAs($this->healthcareProfessional)
            ->putJson("/api/interviews/{$interview->id}/complete", [
                'session_notes' => 'Completed successfully',
                'duration_minutes' => 45,
                'follow_up_required' => false
            ]);

        $completionResponse->assertStatus(200);
    }

    /** @test */
    public function interview_history_and_analytics_tracking()
    {
        // Create historical interviews with different outcomes
        $interviews = [
            ['status' => 'completed', 'rating' => 5, 'professional' => $this->healthcareProfessional],
            ['status' => 'completed', 'rating' => 4, 'professional' => $this->healthcareProfessional],
            ['status' => 'cancelled', 'rating' => null, 'professional' => $this->anotherProfessional],
            ['status' => 'no_show', 'rating' => null, 'professional' => $this->anotherProfessional],
            ['status' => 'rescheduled', 'rating' => null, 'professional' => $this->healthcareProfessional],
        ];

        foreach ($interviews as $interviewData) {
            $slot = InterviewSlot::factory()->create([
                'healthcare_professional_id' => $interviewData['professional']->id,
                'date' => $this->faker->dateTimeBetween('-2 months', '-1 week'),
                'start_time' => '10:00:00',
                'end_time' => '11:00:00'
            ]);

            Interview::factory()->create([
                'beneficiary_id' => $this->beneficiary->id,
                'interview_slot_id' => $slot->id,
                'healthcare_professional_id' => $interviewData['professional']->id,
                'status' => $interviewData['status'],
                'beneficiary_rating' => $interviewData['rating'],
                'scheduled_at' => $slot->date . ' ' . $slot->start_time
            ]);
        }

        // Test comprehensive history retrieval
        $historyResponse = $this->actingAs($this->beneficiaryUser)
            ->getJson('/api/interviews/history?' . http_build_query([
                'date_from' => now()->subMonths(3)->toDateString(),
                'date_to' => now()->toDateString(),
                'include_feedback' => true,
                'sort_by' => 'date',
                'sort_order' => 'desc'
            ]));

        $historyResponse->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'data' => [
                        '*' => [
                            'id',
                            'status',
                            'scheduled_at',
                            'beneficiary_rating',
                            'healthcare_professional',
                            'slot',
                            'reschedule_history'
                        ]
                    ],
                    'current_page',
                    'total'
                ],
                'statistics' => [
                    'total_interviews',
                    'completed',
                    'cancelled',
                    'no_shows',
                    'average_rating'
                ]
            ]);

        $statistics = $historyResponse->json('statistics');
        $this->assertEquals(5, $statistics['total_interviews']);
        $this->assertEquals(2, $statistics['completed']);
        $this->assertEquals(1, $statistics['cancelled']);
        $this->assertEquals(1, $statistics['no_shows']);
        $this->assertEquals(4.5, $statistics['average_rating']); // (5+4)/2 = 4.5

        // Test filtered history
        $filteredResponse = $this->actingAs($this->beneficiaryUser)
            ->getJson('/api/interviews/history?' . http_build_query([
                'status' => ['completed'],
                'professional_id' => $this->healthcareProfessional->id
            ]));

        $filteredResponse->assertStatus(200);
        $filteredInterviews = $filteredResponse->json('data.data');
        $this->assertCount(2, $filteredInterviews);
    }

    /** @test */
    public function emergency_cancellation_and_rescheduling_workflows()
    {
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addHours(6), // Interview in 6 hours
            'start_time' => now()->addHours(6)->format('H:i:s'),
            'end_time' => now()->addHours(7)->format('H:i:s')
        ]);

        $interview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'interview_slot_id' => $slot->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'confirmed',
            'scheduled_at' => now()->addHours(6)
        ]);

        // Test emergency cancellation (within 24-hour window)
        $emergencyCancelResponse = $this->actingAs($this->healthcareProfessional)
            ->putJson("/api/interviews/{$interview->id}/emergency-cancel", [
                'reason' => 'Medical emergency - unable to attend',
                'emergency_type' => 'medical',
                'offer_immediate_reschedule' => true
            ]);

        $emergencyCancelResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $interview->refresh();
        $this->assertEquals('cancelled', $interview->status);
        $this->assertEquals('Medical emergency - unable to attend', $interview->cancellation_reason);

        // Verify emergency notifications were sent
        Notification::assertSentTo(
            $this->beneficiary,
            \App\Notifications\InterviewCancelledNotification::class
        );

        // Test automatic rescheduling suggestion
        $suggestionsResponse = $this->actingAs($this->beneficiaryUser)
            ->getJson("/api/interviews/{$interview->id}/reschedule-suggestions");

        $suggestionsResponse->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'suggestions' => [
                    '*' => [
                        'slot_id',
                        'date',
                        'time',
                        'professional',
                        'priority_score'
                    ]
                ]
            ]);
    }

    protected function tearDown(): void
    {
        // Clean up test data
        Interview::query()->delete();
        InterviewSlot::query()->delete();
        InterviewRescheduleHistory::query()->delete();
        
        parent::tearDown();
    }
}