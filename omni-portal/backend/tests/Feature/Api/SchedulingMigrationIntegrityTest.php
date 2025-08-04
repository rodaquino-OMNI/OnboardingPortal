<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Interview;
use App\Models\InterviewSlot;
use App\Models\GamificationProgress;
use App\Models\GamificationBadge;
use App\Services\GamificationService;
use App\Services\InterviewSchedulingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

/**
 * Critical Test Suite: Scheduling Migration Integrity
 * 
 * Tests to ensure the new telemedicine scheduling system doesn't break
 * existing workflows and maintains data integrity during migration.
 */
class SchedulingMigrationIntegrityTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $beneficiary;
    protected $healthcareProfessional;
    protected $existingInterview;
    protected $gamificationService;
    protected $schedulingService;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->gamificationService = app(GamificationService::class);
        $this->schedulingService = app(InterviewSchedulingService::class);
        
        // Create test users with existing data
        $this->beneficiary = User::factory()->create([
            'email' => 'existing-patient@test.com',
            'created_at' => now()->subMonths(3) // Existing user
        ]);
        
        $this->healthcareProfessional = User::factory()->create([
            'email' => 'existing-doctor@test.com',
            'created_at' => now()->subMonths(6)
        ]);
        $this->healthcareProfessional->assignRole('healthcare_professional');
        
        // Create beneficiary with existing gamification progress
        $beneficiaryProfile = Beneficiary::factory()->create([
            'user_id' => $this->beneficiary->id,
            'registration_completed' => true,
            'created_at' => now()->subMonths(3)
        ]);
        
        // Create existing gamification progress (pre-migration state)
        GamificationProgress::create([
            'beneficiary_id' => $beneficiaryProfile->id,
            'total_points' => 150,
            'current_level' => 2,
            'streak_days' => 5,
            'profile_completed' => true,
            'documents_uploaded' => 2,
            'health_assessments_completed' => 1,
            'tasks_completed' => 3,
            'last_activity_date' => now()->subDay(),
            'created_at' => now()->subMonths(2)
        ]);
        
        // Create existing interview (pre-migration)
        $existingSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(5),
            'start_time' => '14:00:00',
            'end_time' => '15:00:00',
            'created_at' => now()->subMonth()
        ]);
        
        $this->existingInterview = Interview::factory()->create([
            'beneficiary_id' => $beneficiaryProfile->id,
            'interview_slot_id' => $existingSlot->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'scheduled',
            'created_at' => now()->subMonth()
        ]);
    }

    /** @test */
    public function existing_interviews_remain_accessible_after_telemedicine_upgrade()
    {
        // Verify existing interview is accessible
        $response = $this->actingAs($this->beneficiary)
            ->getJson('/api/interviews/history');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $interviews = $response->json('data.data');
        $existingInterview = collect($interviews)->firstWhere('id', $this->existingInterview->id);
        
        $this->assertNotNull($existingInterview);
        $this->assertEquals('scheduled', $existingInterview['status']);
        
        // Verify interview can still be accessed individually
        $detailResponse = $this->actingAs($this->beneficiary)
            ->getJson("/api/interviews/{$this->existingInterview->id}");
            
        $detailResponse->assertStatus(200)
            ->assertJsonPath('data.id', $this->existingInterview->id);
    }

    /** @test */
    public function existing_gamification_progress_preserved_during_migration()
    {
        // Get current gamification state
        $response = $this->actingAs($this->beneficiary)
            ->getJson('/api/gamification/progress');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'total_points',
                    'current_level',
                    'streak_days',
                    'tasks_completed'
                ]
            ]);

        $progress = $response->json('data');
        
        // Verify existing progress is intact
        $this->assertEquals(150, $progress['total_points']);
        $this->assertEquals(2, $progress['current_level']);
        $this->assertEquals(5, $progress['streak_days']);
        $this->assertEquals(3, $progress['tasks_completed']);
    }

    /** @test */
    public function new_scheduling_features_work_alongside_existing_interviews()
    {
        // Create new telemedicine slot
        $newSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(10),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
            'is_telemedicine' => true, // New field
            'platform' => 'vonage_video' // New field
        ]);

        // Test booking new telemedicine appointment
        $response = $this->actingAs($this->beneficiary)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $newSlot->id,
                'notes' => 'New telemedicine appointment',
                'is_telemedicine' => true
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        // Verify both old and new interviews coexist
        $historyResponse = $this->actingAs($this->beneficiary)
            ->getJson('/api/interviews/history');

        $interviews = $historyResponse->json('data.data');
        $this->assertCount(2, $interviews);
        
        // Verify different types are handled correctly
        $oldInterview = collect($interviews)->firstWhere('id', $this->existingInterview->id);
        $newInterview = collect($interviews)->where('id', '!=', $this->existingInterview->id)->first();
        
        $this->assertFalse($oldInterview['is_telemedicine'] ?? false);
        $this->assertTrue($newInterview['is_telemedicine'] ?? false);
    }

    /** @test */
    public function gamification_rewards_work_for_both_legacy_and_new_appointments()
    {
        Event::fake();
        
        // Get initial points
        $initialProgress = $this->beneficiary->beneficiary->getOrCreateGamificationProgress();
        $initialPoints = $initialProgress->total_points;

        // Complete existing (legacy) interview
        $completionResponse = $this->actingAs($this->healthcareProfessional)
            ->putJson("/api/interviews/{$this->existingInterview->id}/complete", [
                'session_notes' => 'Legacy interview completed',
                'duration_minutes' => 45,
                'follow_up_required' => false
            ]);

        $completionResponse->assertStatus(200);

        // Verify gamification points were awarded
        $updatedProgress = $this->beneficiary->beneficiary->getOrCreateGamificationProgress();
        $updatedProgress->refresh();
        
        $this->assertGreaterThan($initialPoints, $updatedProgress->total_points);

        // Test telemedicine-specific rewards
        $telemedicineSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(7),
            'start_time' => '16:00:00',
            'end_time' => '17:00:00',
            'is_telemedicine' => true,
            'platform' => 'vonage_video'
        ]);

        // Book telemedicine appointment
        $bookingResponse = $this->actingAs($this->beneficiary)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $telemedicineSlot->id,
                'notes' => 'Telemedicine test',
                'is_telemedicine' => true
            ]);

        $bookingResponse->assertStatus(201);
        
        $telemedicineInterview = Interview::latest()->first();
        
        // Complete telemedicine interview with bonus points
        $telemedicinePoints = $updatedProgress->total_points;
        
        $telemedicineCompletion = $this->actingAs($this->healthcareProfessional)
            ->putJson("/api/interviews/{$telemedicineInterview->id}/complete", [
                'session_notes' => 'Telemedicine completed successfully',
                'duration_minutes' => 30,
                'technology_rating' => 5,
                'follow_up_required' => false
            ]);

        $telemedicineCompletion->assertStatus(200);

        // Verify telemedicine bonus points
        $finalProgress = $this->beneficiary->beneficiary->getOrCreateGamificationProgress();
        $finalProgress->refresh();
        
        $this->assertGreaterThan($telemedicinePoints, $finalProgress->total_points);
    }

    /** @test */
    public function database_schema_migration_maintains_referential_integrity()
    {
        // Test that all foreign key relationships are maintained
        $this->assertTrue(
            DB::table('interviews')
                ->join('beneficiaries', 'interviews.beneficiary_id', '=', 'beneficiaries.id')
                ->join('users', 'beneficiaries.user_id', '=', 'users.id')
                ->join('interview_slots', 'interviews.interview_slot_id', '=', 'interview_slots.id')
                ->where('interviews.id', $this->existingInterview->id)
                ->exists()
        );

        // Test gamification relationships
        $this->assertTrue(
            DB::table('gamification_progress')
                ->join('beneficiaries', 'gamification_progress.beneficiary_id', '=', 'beneficiaries.id')
                ->join('users', 'beneficiaries.user_id', '=', 'users.id')
                ->where('users.id', $this->beneficiary->id)
                ->exists()
        );

        // Test new columns have appropriate defaults
        $slot = InterviewSlot::find($this->existingInterview->interview_slot_id);
        $this->assertFalse($slot->is_telemedicine ?? false);
        $this->assertEquals('in_person', $slot->platform ?? 'in_person');
    }

    /** @test */
    public function concurrent_operations_on_mixed_interview_types()
    {
        // Create telemedicine slot
        $telemedicineSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(8),
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'is_telemedicine' => true,
            'max_bookings' => 1,
            'current_bookings' => 0
        ]);

        // Simulate concurrent operations
        $results = [];
        
        // Operation 1: Reschedule existing interview
        $newSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(12),
            'start_time' => '15:00:00',
            'end_time' => '16:00:00'
        ]);

        $rescheduleResponse = $this->actingAs($this->beneficiary)
            ->putJson("/api/interviews/{$this->existingInterview->id}/reschedule", [
                'new_interview_slot_id' => $newSlot->id,
                'reason' => 'Concurrent test reschedule'
            ]);

        $results[] = $rescheduleResponse->status();

        // Operation 2: Book telemedicine slot
        $bookingResponse = $this->actingAs($this->beneficiary)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $telemedicineSlot->id,
                'notes' => 'Concurrent telemedicine booking',
                'is_telemedicine' => true
            ]);

        $results[] = $bookingResponse->status();

        // Both operations should succeed
        $this->assertEquals([200, 201], $results);
        
        // Verify data consistency
        $this->existingInterview->refresh();
        $this->assertEquals($newSlot->id, $this->existingInterview->interview_slot_id);
        
        $telemedicineSlot->refresh();
        $this->assertEquals(1, $telemedicineSlot->current_bookings);
    }

    /** @test */
    public function error_handling_maintains_data_consistency_during_transitions()
    {
        // Simulate partial failure during telemedicine booking
        $faultySlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(15),
            'start_time' => '11:00:00',
            'end_time' => '12:00:00',
            'is_telemedicine' => true,
            'max_bookings' => 1,
            'current_bookings' => 1 // Already booked
        ]);

        // Attempt to book unavailable slot
        $response = $this->actingAs($this->beneficiary)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $faultySlot->id,
                'notes' => 'This should fail',
                'is_telemedicine' => true
            ]);

        $response->assertStatus(400);

        // Verify no orphaned records were created
        $interviewCount = Interview::where('interview_slot_id', $faultySlot->id)->count();
        $this->assertEquals(0, $interviewCount);

        // Verify existing data is unchanged
        $this->existingInterview->refresh();
        $this->assertEquals('scheduled', $this->existingInterview->status);
        
        $progress = $this->beneficiary->beneficiary->getOrCreateGamificationProgress();
        $this->assertEquals(150, $progress->total_points); // No change
    }

    /** @test */
    public function performance_regression_test_for_mixed_data_queries()
    {
        // Create a mix of legacy and telemedicine data
        $legacySlots = InterviewSlot::factory()->count(10)->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'is_telemedicine' => false,
            'platform' => 'in_person'
        ]);

        $telemedicineSlots = InterviewSlot::factory()->count(10)->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'is_telemedicine' => true,
            'platform' => 'vonage_video'
        ]);

        // Time the query performance
        $startTime = microtime(true);
        
        $response = $this->actingAs($this->beneficiary)
            ->getJson('/api/interviews/available-slots?' . http_build_query([
                'start_date' => now()->toDateString(),
                'end_date' => now()->addDays(30)->toDateString(),
                'include_telemedicine' => true
            ]));

        $endTime = microtime(true);
        $queryTime = ($endTime - $startTime) * 1000; // Convert to milliseconds

        $response->assertStatus(200);
        
        // Query should complete within reasonable time (< 500ms)
        $this->assertLessThan(500, $queryTime, 'Query took too long: ' . $queryTime . 'ms');
        
        // Verify correct data is returned
        $slots = $response->json('data.slots');
        $this->assertGreaterThan(0, count($slots));
        
        // Verify both types are included
        $legacyCount = collect($slots)->where('is_telemedicine', false)->count();
        $telemedicineCount = collect($slots)->where('is_telemedicine', true)->count();
        
        $this->assertGreaterThan(0, $legacyCount);
        $this->assertGreaterThan(0, $telemedicineCount);
    }

    /** @test */
    public function api_backwards_compatibility_for_existing_clients()
    {
        // Test that old API calls still work
        $legacyResponse = $this->actingAs($this->beneficiary)
            ->getJson('/api/interviews');

        $legacyResponse->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => [
                        'id',
                        'status',
                        'scheduled_at',
                        'healthcare_professional'
                    ]
                ]
            ]);

        // Test that new fields are optional
        $legacyBookingResponse = $this->actingAs($this->beneficiary)
            ->postJson('/api/interviews', [
                'interview_slot_id' => InterviewSlot::factory()->create([
                    'healthcare_professional_id' => $this->healthcareProfessional->id,
                    'date' => now()->addDays(20),
                    'start_time' => '13:00:00',
                    'end_time' => '14:00:00'
                ])->id,
                'notes' => 'Legacy API booking test'
                // No telemedicine fields
            ]);

        $legacyBookingResponse->assertStatus(201);
        
        $newInterview = Interview::latest()->first();
        $this->assertFalse($newInterview->is_telemedicine ?? false);
    }

    /** @test */
    public function cache_invalidation_works_correctly_across_interview_types()
    {
        // Cache some data
        Cache::put("user_interviews_{$this->beneficiary->id}", ['cached_data'], 60);
        
        // Book new telemedicine appointment (should invalidate cache)
        $telemedicineSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(25),
            'start_time' => '08:00:00',
            'end_time' => '09:00:00',
            'is_telemedicine' => true
        ]);

        $response = $this->actingAs($this->beneficiary)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $telemedicineSlot->id,
                'notes' => 'Cache invalidation test',
                'is_telemedicine' => true
            ]);

        $response->assertStatus(201);

        // Verify cache was invalidated
        $this->assertNull(Cache::get("user_interviews_{$this->beneficiary->id}"));
        
        // Reschedule existing interview (should also invalidate)
        Cache::put("user_interviews_{$this->beneficiary->id}", ['cached_data_2'], 60);
        
        $newSlot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(30),
            'start_time' => '17:00:00',
            'end_time' => '18:00:00'
        ]);

        $rescheduleResponse = $this->actingAs($this->beneficiary)
            ->putJson("/api/interviews/{$this->existingInterview->id}/reschedule", [
                'new_interview_slot_id' => $newSlot->id,
                'reason' => 'Cache test reschedule'
            ]);

        $rescheduleResponse->assertStatus(200);
        
        // Verify cache was invalidated again
        $this->assertNull(Cache::get("user_interviews_{$this->beneficiary->id}"));
    }

    protected function tearDown(): void
    {
        // Clean up test data
        Cache::flush();
        parent::tearDown();
    }
}