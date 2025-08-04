<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Company;
use App\Models\TelemedicineAppointmentType;
use App\Models\InterviewSlot;
use App\Models\GamificationProgress;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Laravel\Sanctum\Sanctum;

class TelemedicineSchedulingTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected User $user;
    protected Beneficiary $beneficiary;
    protected Company $company;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->company = Company::factory()->create();
        
        $this->user = User::factory()->create([
            'role' => 'beneficiary',
            'email_verified_at' => now(),
        ]);

        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $this->user->id,
            'company_id' => $this->company->id,
            'registration_completed' => true,
            'full_name' => $this->faker->name,
            'birth_date' => $this->faker->date,
            'phone' => $this->faker->phoneNumber,
            'address' => $this->faker->address,
            'city' => $this->faker->city,
            'state' => 'SP',
        ]);

        Sanctum::actingAs($this->user);
    }

    public function test_eligibility_check_with_incomplete_requirements()
    {
        // Arrange: User with incomplete requirements
        $response = $this->getJson('/api/telemedicine/eligibility');

        // Assert: Not eligible
        $response->assertOk()
            ->assertJson([
                'success' => true,
                'eligible' => false,
            ]);

        $data = $response->json('data');
        $this->assertFalse($data['points_sufficient']);
        $this->assertLessThan(100, $data['completion_percentage']);
    }

    public function test_eligibility_check_with_complete_requirements()
    {
        // Arrange: Complete all requirements
        $this->completeAllRequirements();

        // Act
        $response = $this->getJson('/api/telemedicine/eligibility');

        // Assert: Eligible
        $response->assertOk()
            ->assertJson([
                'success' => true,
                'eligible' => true,
            ]);

        $data = $response->json('data');
        $this->assertTrue($data['points_sufficient']);
        $this->assertEquals(100, $data['completion_percentage']);
    }

    public function test_appointment_types_requires_eligibility()
    {
        // Arrange: Incomplete requirements
        $response = $this->getJson('/api/telemedicine/appointment-types');

        // Assert: Access denied
        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'You must complete all onboarding steps to access telemedicine scheduling.',
            ]);
    }

    public function test_get_appointment_types_when_eligible()
    {
        // Arrange
        $this->completeAllRequirements();
        $appointmentType = TelemedicineAppointmentType::factory()->create([
            'name' => 'Initial Consultation',
            'slug' => 'initial-consultation',
            'is_active' => true,
            'required_documents' => [],
        ]);

        // Act
        $response = $this->getJson('/api/telemedicine/appointment-types');

        // Assert
        $response->assertOk()
            ->assertJson([
                'success' => true,
            ]);

        $types = $response->json('data.appointment_types');
        $this->assertNotEmpty($types);
        $this->assertEquals('Initial Consultation', $types[0]['name']);
        $this->assertArrayHasKey('gamification', $types[0]);
        $this->assertEquals(300, $types[0]['gamification']['points_for_booking']);
    }

    public function test_get_available_slots_for_appointment_type()
    {
        // Arrange
        $this->completeAllRequirements();
        $appointmentType = TelemedicineAppointmentType::factory()->create([
            'is_active' => true,
            'required_documents' => [],
        ]);

        $professional = User::factory()->create([
            'role' => 'healthcare_professional',
            'name' => 'Dr. Health Concierge',
        ]);

        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $professional->id,
            'is_telemedicine_enabled' => true,
            'supported_appointment_types' => [$appointmentType->id],
            'date' => now()->addDay(),
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'is_available' => true,
            'max_bookings' => 1,
            'current_bookings' => 0,
        ]);

        // Act
        $response = $this->getJson("/api/telemedicine/available-slots?appointment_type_id={$appointmentType->id}");

        // Assert
        $response->assertOk()
            ->assertJson([
                'success' => true,
            ]);

        $slots = $response->json('data.slots');
        $this->assertNotEmpty($slots);
        $this->assertEquals($slot->id, $slots[0]['id']);
        $this->assertEquals('Dr. Health Concierge', $slots[0]['professional']['name']);
    }

    public function test_book_telemedicine_appointment_successfully()
    {
        // Arrange
        $this->completeAllRequirements();
        $appointmentType = TelemedicineAppointmentType::factory()->create([
            'is_active' => true,
            'required_documents' => [],
            'base_price' => 150.00,
        ]);

        $professional = User::factory()->create([
            'role' => 'healthcare_professional',
        ]);

        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $professional->id,
            'is_telemedicine_enabled' => true,
            'supported_appointment_types' => [$appointmentType->id],
            'date' => now()->addDay(),
            'is_available' => true,
            'max_bookings' => 1,
            'current_bookings' => 0,
        ]);

        // Act
        $response = $this->postJson('/api/telemedicine/book', [
            'appointment_type_id' => $appointmentType->id,
            'interview_slot_id' => $slot->id,
            'preferred_language' => 'pt',
            'chief_complaint' => 'General health consultation',
        ]);

        // Assert
        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Parabéns! Sua consulta de telemedicina foi agendada com sucesso!',
            ]);

        $data = $response->json('data');
        $this->assertArrayHasKey('appointment', $data);
        $this->assertArrayHasKey('gamification', $data);
        $this->assertEquals(300, $data['gamification']['points_earned']);
        $this->assertEquals('Pioneiro da Telemedicina', $data['gamification']['badge_unlocked']);

        // Verify database changes
        $this->assertDatabaseHas('interviews', [
            'beneficiary_id' => $this->beneficiary->id,
            'interview_slot_id' => $slot->id,
            'is_telemedicine' => true,
            'interview_type' => 'telemedicine_consultation',
        ]);

        $this->assertDatabaseHas('video_sessions', [
            'provider' => $slot->video_platform ?? 'jitsi',
            'status' => 'created',
            'hipaa_compliant' => true,
        ]);
    }

    public function test_cannot_book_appointment_when_not_eligible()
    {
        // Arrange: Incomplete requirements
        $appointmentType = TelemedicineAppointmentType::factory()->create();
        $slot = InterviewSlot::factory()->create();

        // Act
        $response = $this->postJson('/api/telemedicine/book', [
            'appointment_type_id' => $appointmentType->id,
            'interview_slot_id' => $slot->id,
        ]);

        // Assert
        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'You must complete all onboarding steps to access telemedicine scheduling.',
            ]);
    }

    public function test_cannot_book_unavailable_slot()
    {
        // Arrange
        $this->completeAllRequirements();
        $appointmentType = TelemedicineAppointmentType::factory()->create([
            'is_active' => true,
            'required_documents' => [],
        ]);

        $slot = InterviewSlot::factory()->create([
            'is_telemedicine_enabled' => true,
            'is_available' => false, // Not available
        ]);

        // Act
        $response = $this->postJson('/api/telemedicine/book', [
            'appointment_type_id' => $appointmentType->id,
            'interview_slot_id' => $slot->id,
        ]);

        // Assert
        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'This time slot is no longer available.',
            ]);
    }

    public function test_cannot_book_non_telemedicine_slot()
    {
        // Arrange
        $this->completeAllRequirements();
        $appointmentType = TelemedicineAppointmentType::factory()->create([
            'is_active' => true,
            'required_documents' => [],
        ]);

        $slot = InterviewSlot::factory()->create([
            'is_telemedicine_enabled' => false, // Not telemedicine enabled
            'is_available' => true,
        ]);

        // Act
        $response = $this->postJson('/api/telemedicine/book', [
            'appointment_type_id' => $appointmentType->id,
            'interview_slot_id' => $slot->id,
        ]);

        // Assert
        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'This slot does not support telemedicine appointments.',
            ]);
    }

    /**
     * Complete all requirements for telemedicine eligibility
     */
    private function completeAllRequirements(): void
    {
        // Create required documents
        $documentTypes = ['cpf', 'rg', 'address_proof'];
        foreach ($documentTypes as $type) {
            Document::factory()->create([
                'beneficiary_id' => $this->beneficiary->id,
                'document_type' => $type,
                'status' => 'approved',
            ]);
        }

        // Create completed health questionnaire
        HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'responses' => [
                'conditions' => ['hypertension'],
                'medications' => ['medication1'],
            ],
        ]);

        // Create gamification progress with sufficient points
        GamificationProgress::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'total_points' => 750, // Above required 500
            'current_level' => 2,
            'profile_completed' => 1,
            'onboarding_completed' => 1,
            'documents_uploaded' => 3,
            'health_assessments_completed' => 1,
        ]);
    }
}