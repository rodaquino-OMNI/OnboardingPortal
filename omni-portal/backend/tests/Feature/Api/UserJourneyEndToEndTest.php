<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\HealthQuestionnaire;
use App\Models\QuestionnaireTemplate;
use App\Models\Interview;
use App\Models\InterviewSlot;
use App\Models\GamificationProgress;
use App\Models\GamificationLevel;
use App\Models\GamificationBadge;
use App\Models\AuditLog;
use App\Models\Company;
use App\Services\OCRService;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class UserJourneyEndToEndTest extends TestCase
{
    use RefreshDatabase;

    private $userData;
    private $token;
    private $user;
    private $beneficiary;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        Storage::fake('local');
        Queue::fake();
        
        // Create necessary seed data
        $this->seedTestData();
        
        // Prepare user data for journey
        $this->userData = [
            'email' => 'journey.test@example.com',
            'cpf' => '12345678901',
            'name' => 'Journey Test User',
            'password' => 'SecurePass123!',
            'phone' => '+5511999887766',
            'birth_date' => '1990-01-15'
        ];
    }

    /**
     * Test complete user journey from registration to interview scheduling
     */
    public function test_complete_user_journey_with_progressive_disclosure(): void
    {
        // Phase 1: Registration with Step 1
        $this->phase1_registration();
        
        // Phase 2: Complete Profile Setup (Steps 2 & 3)
        $this->phase2_profile_setup();
        
        // Phase 3: Health Assessment with Progressive Disclosure
        $this->phase3_health_assessment();
        
        // Phase 4: Document Upload with OCR Processing
        $this->phase4_document_upload_with_ocr();
        
        // Phase 5: Interview Scheduling
        $this->phase5_interview_scheduling();
        
        // Phase 6: Verify Complete Journey State
        $this->phase6_verify_complete_journey();
        
        // Phase 7: Test LGPD Compliance Throughout
        $this->phase7_lgpd_compliance_check();
    }

    /**
     * Phase 1: Initial Registration
     */
    private function phase1_registration(): void
    {
        // Step 1: Initial registration
        $response = $this->postJson('/api/register/step1', [
            'email' => $this->userData['email'],
            'cpf' => $this->userData['cpf'],
            'agreed_to_terms' => true,
            'agreed_to_privacy' => true
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'email', 'registration_step'],
                'token',
                'next_step'
            ])
            ->assertJson([
                'next_step' => 'step2',
                'user' => [
                    'registration_step' => 1,
                    'registration_completed' => false
                ]
            ]);

        $this->token = $response->json('token');
        $this->user = User::find($response->json('user.id'));
        
        // Verify partial registration state
        $this->assertDatabaseHas('users', [
            'email' => $this->userData['email'],
            'registration_step' => 1,
            'registration_completed' => false
        ]);
        
        // Verify audit log
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->user->id,
            'action' => 'user.registered.step1',
            'model_type' => 'App\Models\User'
        ]);
        
        // Store in memory
        $this->notifyProgress('Registration Step 1 completed');
    }

    /**
     * Phase 2: Complete Profile Setup
     */
    private function phase2_profile_setup(): void
    {
        // Step 2: Personal information
        $response = $this->withToken($this->token)
            ->postJson('/api/register/step2', [
                'name' => $this->userData['name'],
                'phone' => $this->userData['phone'],
                'birth_date' => $this->userData['birth_date'],
                'gender' => 'male',
                'marital_status' => 'single'
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Step 2 completed successfully',
                'next_step' => 'step3',
                'user' => [
                    'registration_step' => 2
                ]
            ]);

        // Step 3: Set password and complete registration
        $response = $this->withToken($this->token)
            ->postJson('/api/register/step3', [
                'password' => $this->userData['password'],
                'password_confirmation' => $this->userData['password']
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Registration completed successfully',
                'user' => [
                    'registration_completed' => true,
                    'registration_step' => 3
                ]
            ]);

        // Verify complete registration
        $this->user->refresh();
        $this->assertTrue($this->user->registration_completed);
        $this->assertNotNull($this->user->beneficiary);
        
        $this->beneficiary = $this->user->beneficiary;
        
        // Verify gamification initialization
        $this->assertDatabaseHas('gamification_progress', [
            'beneficiary_id' => $this->beneficiary->id,
            'points' => 100, // Registration bonus
            'level' => 1
        ]);
        
        $this->notifyProgress('Profile setup completed');
    }

    /**
     * Phase 3: Health Assessment with Progressive Disclosure
     */
    private function phase3_health_assessment(): void
    {
        // Get health questionnaire templates
        $response = $this->withToken($this->token)
            ->getJson('/api/health-questionnaires/templates');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'templates' => [
                    '*' => ['id', 'title', 'description', 'category', 'questions']
                ]
            ]);

        $template = $response->json('templates.0');

        // Start questionnaire
        $response = $this->withToken($this->token)
            ->postJson('/api/health-questionnaires/start', [
                'template_id' => $template['id']
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'questionnaire' => [
                    'id',
                    'status',
                    'progress_percentage',
                    'current_section'
                ]
            ]);

        $questionnaireId = $response->json('questionnaire.id');

        // Submit responses progressively (simulating dual pathway)
        $response = $this->withToken($this->token)
            ->postJson('/api/health-questionnaires/submit-dual-pathway', [
                'questionnaire_id' => $questionnaireId,
                'pathway' => 'guided',
                'responses' => [
                    ['question_id' => 1, 'answer' => 'No chronic conditions'],
                    ['question_id' => 2, 'answer' => 'Regular exercise 3x/week'],
                    ['question_id' => 3, 'answer' => 'Balanced diet']
                ],
                'ai_insights_requested' => true
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'questionnaire' => [
                    'id',
                    'status',
                    'completion_percentage',
                    'ai_insights',
                    'health_score'
                ],
                'gamification' => [
                    'points_earned',
                    'badges_earned'
                ]
            ]);

        // Verify progressive disclosure triggered new questions
        $this->assertGreaterThan(0, count($response->json('questionnaire.next_questions', [])));
        
        // Complete remaining questions
        $response = $this->withToken($this->token)
            ->putJson("/api/health-questionnaires/{$questionnaireId}/responses", [
                'responses' => [
                    ['question_id' => 4, 'answer' => 'No allergies'],
                    ['question_id' => 5, 'answer' => 'No medications']
                ],
                'mark_complete' => true
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'questionnaire' => [
                    'status' => 'completed',
                    'completion_percentage' => 100
                ]
            ]);

        $this->notifyProgress('Health assessment completed with AI insights');
    }

    /**
     * Phase 4: Document Upload with OCR Processing
     */
    private function phase4_document_upload_with_ocr(): void
    {
        // Get required document types
        $response = $this->withToken($this->token)
            ->getJson('/api/documents');

        $response->assertStatus(200);

        // Upload RG document with OCR processing
        $rgFile = UploadedFile::fake()->image('rg.jpg', 1200, 800);
        
        $response = $this->withToken($this->token)
            ->postJson('/api/v3/documents/upload', [
                'document_type_id' => DocumentType::where('code', 'RG')->first()->id,
                'file' => $rgFile,
                'enable_ocr' => true,
                'auto_validate' => true
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'document' => [
                    'id',
                    'status',
                    'ocr_status',
                    'validation_status'
                ],
                'message'
            ]);

        $documentId = $response->json('document.id');

        // Simulate OCR processing with fallback
        $this->simulateOCRProcessing($documentId);

        // Check OCR status
        $response = $this->withToken($this->token)
            ->getJson("/api/v3/documents/{$documentId}/status");

        $response->assertStatus(200)
            ->assertJson([
                'document' => [
                    'ocr_status' => 'completed',
                    'validation_status' => 'validated'
                ]
            ]);

        // Upload CPF document
        $cpfFile = UploadedFile::fake()->image('cpf.pdf', 1200, 800);
        
        $response = $this->withToken($this->token)
            ->postJson('/api/v3/documents/upload', [
                'document_type_id' => DocumentType::where('code', 'CPF')->first()->id,
                'file' => $cpfFile,
                'enable_ocr' => true
            ]);

        $response->assertStatus(201);

        // Verify document processing pipeline
        $this->assertDatabaseHas('documents', [
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'validated'
        ]);

        // Check validation progress
        $response = $this->withToken($this->token)
            ->getJson('/api/documents/validation-progress');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'progress' => [
                    'total_required',
                    'uploaded',
                    'validated',
                    'percentage'
                ]
            ]);

        $this->notifyProgress('Documents uploaded and validated with OCR');
    }

    /**
     * Phase 5: Interview Scheduling
     */
    private function phase5_interview_scheduling(): void
    {
        // Create interview slots for healthcare professionals
        $this->createInterviewSlots();

        // Get available slots with timezone support
        $response = $this->withToken($this->token)
            ->getJson('/api/interviews/available-slots', [
                'timezone' => 'America/Sao_Paulo',
                'date_from' => Carbon::now()->addDay()->format('Y-m-d'),
                'date_to' => Carbon::now()->addDays(7)->format('Y-m-d')
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'slots' => [
                    '*' => [
                        'id',
                        'start_time',
                        'end_time',
                        'healthcare_professional',
                        'available'
                    ]
                ]
            ]);

        $slotId = $response->json('slots.0.id');

        // Get AI-recommended slots
        $response = $this->withToken($this->token)
            ->getJson('/api/interviews/recommended-slots');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'recommended_slots' => [
                    '*' => [
                        'slot',
                        'recommendation_score',
                        'reasons'
                    ]
                ]
            ]);

        // Book interview
        $response = $this->withToken($this->token)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slotId,
                'type' => 'initial_assessment',
                'notes' => 'First interview after document validation',
                'reminder_preferences' => [
                    'email' => true,
                    'sms' => true,
                    'app' => true,
                    'advance_notice' => [24, 2] // 24 hours and 2 hours before
                ]
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'interview' => [
                    'id',
                    'status',
                    'scheduled_at',
                    'type',
                    'meeting_link'
                ],
                'message'
            ]);

        $interviewId = $response->json('interview.id');

        // Update notification preferences
        $response = $this->withToken($this->token)
            ->putJson('/api/interviews/notification-preferences', [
                'email_notifications' => true,
                'sms_notifications' => true,
                'reminder_hours' => [24, 2]
            ]);

        $response->assertStatus(200);

        // Verify interview is scheduled
        $this->assertDatabaseHas('interviews', [
            'id' => $interviewId,
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'scheduled'
        ]);

        $this->notifyProgress('Interview scheduled successfully');
    }

    /**
     * Phase 6: Verify Complete Journey State
     */
    private function phase6_verify_complete_journey(): void
    {
        // Get user profile with all relationships
        $response = $this->withToken($this->token)
            ->getJson('/api/profile');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user' => [
                    'id',
                    'email',
                    'name',
                    'registration_completed',
                    'beneficiary' => [
                        'id',
                        'documents',
                        'health_questionnaires',
                        'interviews',
                        'gamification_progress'
                    ]
                ]
            ]);

        // Check gamification progress
        $response = $this->withToken($this->token)
            ->getJson('/api/gamification/progress');

        $response->assertStatus(200)
            ->assertJson([
                'progress' => [
                    'registration_completed' => true,
                    'profile_completed' => true,
                    'health_assessment_completed' => true,
                    'documents_uploaded' => true,
                    'interview_scheduled' => true
                ]
            ]);

        // Verify user achieved milestones
        $gamificationProgress = GamificationProgress::where('beneficiary_id', $this->beneficiary->id)->first();
        $this->assertGreaterThan(100, $gamificationProgress->points); // More than registration bonus
        $this->assertGreaterThan(0, $gamificationProgress->badges()->count());

        // Check activity feed
        $response = $this->withToken($this->token)
            ->getJson('/api/gamification/activity-feed');

        $response->assertStatus(200)
            ->assertJsonCount(5, 'activities'); // Should have activities for each phase

        $this->notifyProgress('Complete journey verified successfully');
    }

    /**
     * Phase 7: LGPD Compliance Check
     */
    private function phase7_lgpd_compliance_check(): void
    {
        // Export user data
        $response = $this->withToken($this->token)
            ->getJson('/api/lgpd/export-data');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user_data' => [
                    'personal_information',
                    'beneficiary_data',
                    'documents',
                    'health_data',
                    'interviews',
                    'audit_logs',
                    'consent_history'
                ]
            ]);

        // Check consent history
        $response = $this->withToken($this->token)
            ->getJson('/api/lgpd/consent-history');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'consents' => [
                    '*' => [
                        'type',
                        'granted_at',
                        'ip_address',
                        'user_agent'
                    ]
                ]
            ]);

        // Verify data processing activities
        $response = $this->withToken($this->token)
            ->getJson('/api/lgpd/data-processing-activities');

        $response->assertStatus(200);

        // Test data deletion request (don't execute, just verify it works)
        $response = $this->withToken($this->token)
            ->deleteJson('/api/lgpd/delete-account', [
                'password' => $this->userData['password'],
                'reason' => 'test_verification_only',
                'dry_run' => true // Don't actually delete
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'dry_run' => true,
                'would_delete' => [
                    'user_account' => true,
                    'personal_data' => true,
                    'documents' => true,
                    'health_records' => true
                ]
            ]);

        $this->notifyProgress('LGPD compliance verified');
    }

    /**
     * Test role-based access control transitions
     */
    public function test_role_based_access_control_transitions(): void
    {
        // Create users with different roles
        $beneficiary = User::factory()->create(['role' => 'beneficiary']);
        $professional = User::factory()->create(['role' => 'healthcare_professional']);
        $admin = User::factory()->create(['role' => 'admin']);

        // Test beneficiary cannot access admin routes
        Sanctum::actingAs($beneficiary);
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(403);

        // Test healthcare professional can access interview management
        Sanctum::actingAs($professional);
        $response = $this->getJson('/api/interview-slots');
        $response->assertStatus(200);

        // Test admin has full access
        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(200);

        // Test role transition (beneficiary promoted to healthcare professional)
        $response = $this->putJson("/api/admin/users/{$beneficiary->id}/role", [
            'role' => 'healthcare_professional'
        ]);
        $response->assertStatus(200);

        // Verify new permissions
        Sanctum::actingAs($beneficiary->fresh());
        $response = $this->getJson('/api/interview-slots');
        $response->assertStatus(200);
    }

    /**
     * Test cross-feature data consistency
     */
    public function test_cross_feature_data_consistency(): void
    {
        // Setup user with partial data
        $this->phase1_registration();
        $this->phase2_profile_setup();

        // Upload document without health assessment
        $file = UploadedFile::fake()->image('document.jpg');
        $response = $this->withToken($this->token)
            ->postJson('/api/documents/upload', [
                'document_type_id' => 1,
                'file' => $file
            ]);

        $response->assertStatus(201);
        $documentId = $response->json('document.id');

        // Try to schedule interview without completing health assessment
        $response = $this->withToken($this->token)
            ->postJson('/api/interviews', [
                'interview_slot_id' => 1,
                'type' => 'initial_assessment'
            ]);

        // Should be allowed but with warnings
        $response->assertStatus(201)
            ->assertJson([
                'warnings' => [
                    'health_assessment_pending' => true
                ]
            ]);

        // Complete health assessment
        $this->phase3_health_assessment();

        // Verify data consistency across features
        $response = $this->withToken($this->token)
            ->getJson('/api/profile');

        $beneficiaryData = $response->json('user.beneficiary');
        
        // All features should be reflected
        $this->assertNotEmpty($beneficiaryData['documents']);
        $this->assertNotEmpty($beneficiaryData['health_questionnaires']);
        $this->assertNotEmpty($beneficiaryData['interviews']);
        $this->assertNotNull($beneficiaryData['gamification_progress']);

        // Verify audit trail consistency
        $auditLogs = AuditLog::where('user_id', $this->user->id)
            ->orderBy('created_at')
            ->get();

        $expectedActions = [
            'user.registered.step1',
            'user.registered.step2',
            'user.registered.complete',
            'document.uploaded',
            'interview.scheduled',
            'health_questionnaire.started',
            'health_questionnaire.completed'
        ];

        foreach ($expectedActions as $action) {
            $this->assertTrue(
                $auditLogs->contains('action', $action),
                "Missing audit log for action: {$action}"
            );
        }
    }

    /**
     * Test document processing pipeline with OCR fallback
     */
    public function test_document_processing_pipeline_with_ocr_fallback(): void
    {
        $this->setupAuthenticatedUser();

        // Upload document with primary OCR service
        $file = UploadedFile::fake()->image('clear_document.jpg', 1200, 800);
        
        $response = $this->withToken($this->token)
            ->postJson('/api/v3/documents/upload', [
                'document_type_id' => 1,
                'file' => $file,
                'enable_ocr' => true
            ]);

        $response->assertStatus(201);
        $documentId = $response->json('document.id');

        // Simulate primary OCR failure
        $document = Document::find($documentId);
        $document->update([
            'ocr_status' => 'failed',
            'ocr_error' => 'Primary service timeout'
        ]);

        // Trigger fallback OCR processing
        $response = $this->withToken($this->token)
            ->postJson("/api/v3/documents/{$documentId}/reprocess", [
                'use_fallback' => true
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Document reprocessing initiated',
                'fallback_service' => true
            ]);

        // Verify fallback processing
        $document->refresh();
        $this->assertEquals('processing', $document->ocr_status);
        $this->assertStringContainsString('fallback', $document->ocr_metadata['service'] ?? '');

        // Check OCR results
        $response = $this->withToken($this->token)
            ->getJson("/api/v3/documents/{$documentId}/ocr-results");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'ocr_results' => [
                    'text',
                    'confidence',
                    'service_used',
                    'processing_time'
                ]
            ]);
    }

    /**
     * Test progressive disclosure based on user progress
     */
    public function test_progressive_disclosure_based_on_user_progress(): void
    {
        $this->setupAuthenticatedUser();

        // Initial state - limited features
        $response = $this->withToken($this->token)
            ->getJson('/api/profile');

        $features = $response->json('user.available_features');
        $this->assertContains('basic_profile', $features);
        $this->assertNotContains('advanced_health', $features);

        // Complete health assessment
        $this->completeHealthAssessment();

        // Check unlocked features
        $response = $this->withToken($this->token)
            ->getJson('/api/profile');

        $features = $response->json('user.available_features');
        $this->assertContains('advanced_health', $features);
        $this->assertContains('document_upload', $features);

        // Upload required documents
        $this->uploadRequiredDocuments();

        // Check final unlocked features
        $response = $this->withToken($this->token)
            ->getJson('/api/profile');

        $features = $response->json('user.available_features');
        $this->assertContains('interview_scheduling', $features);
        $this->assertContains('video_consultation', $features);

        // Verify gamification reflects progress
        $response = $this->withToken($this->token)
            ->getJson('/api/gamification/achievements');

        $response->assertStatus(200);
        $achievements = $response->json('achievements');
        
        $this->assertContains('health_champion', array_column($achievements, 'code'));
        $this->assertContains('document_master', array_column($achievements, 'code'));
    }

    /**
     * Helper: Setup authenticated user
     */
    private function setupAuthenticatedUser(): void
    {
        $this->phase1_registration();
        $this->phase2_profile_setup();
    }

    /**
     * Helper: Seed test data
     */
    private function seedTestData(): void
    {
        // Create companies
        Company::factory()->count(3)->create();

        // Create document types
        DocumentType::insert([
            ['name' => 'RG', 'code' => 'RG', 'is_required' => true],
            ['name' => 'CPF', 'code' => 'CPF', 'is_required' => true],
            ['name' => 'Comprovante de Residência', 'code' => 'COMP_RES', 'is_required' => true],
            ['name' => 'Cartão SUS', 'code' => 'SUS', 'is_required' => false]
        ]);

        // Create questionnaire templates
        QuestionnaireTemplate::factory()->count(3)->create();

        // Create gamification levels
        GamificationLevel::insert([
            ['level' => 1, 'name' => 'Iniciante', 'points_required' => 0],
            ['level' => 2, 'name' => 'Bronze', 'points_required' => 500],
            ['level' => 3, 'name' => 'Prata', 'points_required' => 1000],
            ['level' => 4, 'name' => 'Ouro', 'points_required' => 2000],
            ['level' => 5, 'name' => 'Platina', 'points_required' => 5000]
        ]);

        // Create badges
        GamificationBadge::insert([
            [
                'code' => 'first_login',
                'name' => 'Primeiro Acesso',
                'description' => 'Realizou o primeiro login',
                'icon' => 'login',
                'points' => 10
            ],
            [
                'code' => 'profile_complete',
                'name' => 'Perfil Completo',
                'description' => 'Completou todas as informações do perfil',
                'icon' => 'profile',
                'points' => 50
            ],
            [
                'code' => 'health_champion',
                'name' => 'Campeão da Saúde',
                'description' => 'Completou avaliação de saúde',
                'icon' => 'health',
                'points' => 100
            ],
            [
                'code' => 'document_master',
                'name' => 'Mestre dos Documentos',
                'description' => 'Enviou todos os documentos obrigatórios',
                'icon' => 'documents',
                'points' => 75
            ]
        ]);

        // Create healthcare professionals
        User::factory()->count(3)->create([
            'role' => 'healthcare_professional'
        ]);
    }

    /**
     * Helper: Create interview slots
     */
    private function createInterviewSlots(): void
    {
        $professionals = User::where('role', 'healthcare_professional')->get();
        
        foreach ($professionals as $professional) {
            InterviewSlot::factory()->count(5)->create([
                'healthcare_professional_id' => $professional->id,
                'start_time' => Carbon::now()->addDay()->setHour(9)->addHours(rand(0, 8)),
                'duration_minutes' => 30,
                'is_available' => true
            ]);
        }
    }

    /**
     * Helper: Simulate OCR processing
     */
    private function simulateOCRProcessing($documentId): void
    {
        $document = Document::find($documentId);
        $document->update([
            'ocr_status' => 'completed',
            'ocr_data' => [
                'text' => 'Sample OCR extracted text',
                'confidence' => 0.95,
                'service' => 'primary'
            ],
            'validation_status' => 'validated',
            'validated_at' => now()
        ]);
    }

    /**
     * Helper: Complete health assessment quickly
     */
    private function completeHealthAssessment(): void
    {
        $template = QuestionnaireTemplate::first();
        
        $questionnaire = HealthQuestionnaire::create([
            'beneficiary_id' => $this->beneficiary->id,
            'template_id' => $template->id,
            'status' => 'completed',
            'responses' => [
                ['question_id' => 1, 'answer' => 'Test answer 1'],
                ['question_id' => 2, 'answer' => 'Test answer 2']
            ],
            'completed_at' => now()
        ]);
    }

    /**
     * Helper: Upload required documents
     */
    private function uploadRequiredDocuments(): void
    {
        $requiredTypes = DocumentType::where('is_required', true)->get();
        
        foreach ($requiredTypes as $type) {
            $file = UploadedFile::fake()->image("{$type->code}.jpg");
            
            $this->withToken($this->token)
                ->postJson('/api/documents/upload', [
                    'document_type_id' => $type->id,
                    'file' => $file
                ]);
        }
    }

    /**
     * Helper: Store progress notification
     */
    private function notifyProgress($message): void
    {
        exec("npx claude-flow@alpha hooks notify --message \"Journey Test: {$message}\"");
    }

    protected function tearDown(): void
    {
        // Clean up and save final state
        exec('npx claude-flow@alpha hooks post-task --task-id "journey-tests" --analyze-performance true');
        
        parent::tearDown();
    }
}