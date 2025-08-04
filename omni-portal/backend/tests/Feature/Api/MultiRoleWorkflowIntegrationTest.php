<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Interview;
use App\Models\InterviewSlot;
use App\Models\VideoSession;
use App\Models\Admin\AdminRole;
use App\Models\Admin\AdminPermission;
use App\Models\AdminAction;
use App\Models\AuditLog;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Carbon\Carbon;

class MultiRoleWorkflowIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private $beneficiary;
    private $healthcareProfessional;
    private $admin;
    private $reviewer;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        Storage::fake('local');
        Queue::fake();
        Event::fake();
        
        // Setup roles and permissions
        $this->setupRolesAndPermissions();
        
        // Create users for each role
        $this->createTestUsers();
        
        // Seed necessary data
        $this->seedTestData();
    }

    /**
     * Test complete multi-role workflow from beneficiary registration to admin approval
     */
    public function test_complete_multi_role_workflow(): void
    {
        // Step 1: Beneficiary registers and submits documents
        $beneficiaryToken = $this->step1_beneficiary_registration_and_documents();
        
        // Step 2: Healthcare professional reviews health assessment
        $this->step2_healthcare_professional_reviews_health();
        
        // Step 3: Document reviewer validates documents
        $this->step3_document_reviewer_validates();
        
        // Step 4: Healthcare professional conducts interview
        $interviewId = $this->step4_healthcare_professional_conducts_interview();
        
        // Step 5: Admin reviews and approves the case
        $this->step5_admin_reviews_and_approves();
        
        // Step 6: Verify complete workflow state and permissions
        $this->step6_verify_workflow_completion();
        
        // Step 7: Test audit trail across all roles
        $this->step7_verify_audit_trail();
    }

    /**
     * Step 1: Beneficiary Registration and Document Submission
     */
    private function step1_beneficiary_registration_and_documents(): string
    {
        // Register beneficiary
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Test Beneficiary',
            'email' => 'beneficiary@test.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'cpf' => '12345678901'
        ]);

        $response->assertStatus(201);
        $token = $response->json('token');
        
        // Upload documents
        Sanctum::actingAs($this->beneficiary);
        
        $rgFile = UploadedFile::fake()->image('rg.jpg');
        $response = $this->postJson('/api/v3/documents/upload', [
            'document_type_id' => DocumentType::where('code', 'RG')->first()->id,
            'file' => $rgFile,
            'enable_ocr' => true
        ]);
        
        $response->assertStatus(201);
        $this->assertDatabaseHas('documents', [
            'beneficiary_id' => $this->beneficiary->beneficiary->id,
            'status' => 'pending_review'
        ]);
        
        // Submit health questionnaire
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'template_id' => 1,
            'responses' => [
                ['question_id' => 1, 'answer' => 'No chronic conditions'],
                ['question_id' => 2, 'answer' => 'Regular exercise']
            ]
        ]);
        
        $response->assertStatus(200);
        
        $this->notifyProgress('Beneficiary completed registration and submissions');
        
        return $token;
    }

    /**
     * Step 2: Healthcare Professional Reviews Health Assessment
     */
    private function step2_healthcare_professional_reviews_health(): void
    {
        Sanctum::actingAs($this->healthcareProfessional);
        
        // Get pending health assessments
        $response = $this->getJson('/api/admin/health-assessments/pending');
        $response->assertStatus(200);
        
        $assessmentId = $response->json('assessments.0.id');
        
        // Review and add professional notes
        $response = $this->putJson("/api/admin/health-assessments/{$assessmentId}/review", [
            'status' => 'reviewed',
            'professional_notes' => 'Patient shows good health indicators. Recommend standard follow-up.',
            'risk_assessment' => 'low',
            'recommendations' => [
                'Continue regular exercise',
                'Annual check-up recommended'
            ]
        ]);
        
        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Health assessment reviewed successfully'
            ]);
        
        // Verify professional's action is logged
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->healthcareProfessional->id,
            'action' => 'health_assessment.reviewed',
            'model_type' => 'App\Models\HealthQuestionnaire'
        ]);
        
        $this->notifyProgress('Healthcare professional reviewed health assessment');
    }

    /**
     * Step 3: Document Reviewer Validates Documents
     */
    private function step3_document_reviewer_validates(): void
    {
        Sanctum::actingAs($this->reviewer);
        
        // Get pending documents for review
        $response = $this->getJson('/api/admin/documents/pending-review');
        $response->assertStatus(200);
        
        $documents = $response->json('documents');
        
        foreach ($documents as $doc) {
            // Review document with OCR validation
            $response = $this->putJson("/api/admin/documents/{$doc['id']}/review", [
                'action' => 'approve',
                'ocr_validated' => true,
                'extracted_data' => [
                    'document_number' => '123456789',
                    'issue_date' => '2020-01-15',
                    'expiry_date' => '2030-01-15'
                ],
                'reviewer_notes' => 'Document verified against OCR data'
            ]);
            
            $response->assertStatus(200);
        }
        
        // Verify all documents are validated
        $beneficiaryId = $this->beneficiary->beneficiary->id;
        $pendingDocs = Document::where('beneficiary_id', $beneficiaryId)
            ->where('status', 'pending_review')
            ->count();
            
        $this->assertEquals(0, $pendingDocs);
        
        $this->notifyProgress('Document reviewer validated all documents');
    }

    /**
     * Step 4: Healthcare Professional Conducts Interview
     */
    private function step4_healthcare_professional_conducts_interview(): int
    {
        // First, beneficiary schedules interview
        Sanctum::actingAs($this->beneficiary);
        
        // Get available slots
        $response = $this->getJson('/api/interviews/available-slots');
        $response->assertStatus(200);
        
        $slotId = $response->json('slots.0.id');
        
        // Book interview
        $response = $this->postJson('/api/interviews', [
            'interview_slot_id' => $slotId,
            'type' => 'initial_assessment'
        ]);
        
        $response->assertStatus(201);
        $interviewId = $response->json('interview.id');
        
        // Healthcare professional starts interview
        Sanctum::actingAs($this->healthcareProfessional);
        
        // Start video session
        $response = $this->postJson('/api/video/sessions', [
            'interview_id' => $interviewId,
            'enable_recording' => true
        ]);
        
        $response->assertStatus(201);
        $sessionId = $response->json('session.session_id');
        
        // Start interview
        $response = $this->postJson("/api/interviews/{$interviewId}/start", [
            'video_session_id' => $sessionId
        ]);
        
        $response->assertStatus(200);
        
        // Complete interview with assessment
        $response = $this->postJson("/api/interviews/{$interviewId}/complete", [
            'assessment' => [
                'general_health' => 'good',
                'mental_health' => 'stable',
                'eligibility_score' => 85
            ],
            'notes' => 'Beneficiary is eligible for the program',
            'recommendations' => [
                'Approve for basic health plan',
                'Schedule follow-up in 6 months'
            ]
        ]);
        
        $response->assertStatus(200);
        
        $this->notifyProgress('Healthcare professional completed interview');
        
        return $interviewId;
    }

    /**
     * Step 5: Admin Reviews and Approves Case
     */
    private function step5_admin_reviews_and_approves(): void
    {
        Sanctum::actingAs($this->admin);
        
        // Get beneficiary's complete profile for review
        $response = $this->getJson("/api/admin/beneficiaries/{$this->beneficiary->beneficiary->id}/complete-profile");
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'beneficiary' => [
                    'personal_info',
                    'documents',
                    'health_assessment',
                    'interview_results',
                    'eligibility_score'
                ]
            ]);
        
        // Approve beneficiary enrollment
        $response = $this->postJson("/api/admin/beneficiaries/{$this->beneficiary->beneficiary->id}/approve", [
            'decision' => 'approved',
            'plan_type' => 'basic',
            'effective_date' => Carbon::now()->addDays(7)->format('Y-m-d'),
            'notes' => 'All requirements met. Approved for basic health plan.',
            'notifications' => [
                'send_email' => true,
                'send_sms' => true
            ]
        ]);
        
        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Beneficiary approved successfully'
            ]);
        
        // Verify approval status
        $this->assertDatabaseHas('beneficiaries', [
            'id' => $this->beneficiary->beneficiary->id,
            'status' => 'approved',
            'approved_by' => $this->admin->id
        ]);
        
        // Create admin action log
        $this->assertDatabaseHas('admin_actions', [
            'admin_id' => $this->admin->id,
            'action' => 'beneficiary.approved',
            'target_type' => 'App\Models\Beneficiary',
            'target_id' => $this->beneficiary->beneficiary->id
        ]);
        
        $this->notifyProgress('Admin approved beneficiary enrollment');
    }

    /**
     * Step 6: Verify Complete Workflow State
     */
    private function step6_verify_workflow_completion(): void
    {
        // Check from beneficiary perspective
        Sanctum::actingAs($this->beneficiary);
        
        $response = $this->getJson('/api/profile');
        $response->assertStatus(200)
            ->assertJson([
                'user' => [
                    'beneficiary' => [
                        'status' => 'approved',
                        'enrollment_complete' => true
                    ]
                ]
            ]);
        
        // Check from admin perspective
        Sanctum::actingAs($this->admin);
        
        $response = $this->getJson('/api/admin/metrics/workflow-completion');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'metrics' => [
                    'total_beneficiaries',
                    'approved_today',
                    'pending_review',
                    'average_completion_time'
                ]
            ]);
        
        // Verify all workflow steps completed
        $beneficiaryId = $this->beneficiary->beneficiary->id;
        
        $this->assertDatabaseHas('beneficiaries', [
            'id' => $beneficiaryId,
            'registration_completed' => true,
            'documents_verified' => true,
            'health_assessment_completed' => true,
            'interview_completed' => true,
            'status' => 'approved'
        ]);
        
        $this->notifyProgress('Workflow completion verified');
    }

    /**
     * Step 7: Verify Audit Trail
     */
    private function step7_verify_audit_trail(): void
    {
        Sanctum::actingAs($this->admin);
        
        // Get complete audit trail for beneficiary
        $response = $this->getJson("/api/admin/audit-logs/beneficiary/{$this->beneficiary->beneficiary->id}");
        
        $response->assertStatus(200);
        $auditLogs = $response->json('logs');
        
        // Verify critical actions are logged
        $expectedActions = [
            'user.registered',
            'document.uploaded',
            'health_questionnaire.submitted',
            'health_assessment.reviewed',
            'document.reviewed',
            'interview.scheduled',
            'interview.completed',
            'beneficiary.approved'
        ];
        
        foreach ($expectedActions as $action) {
            $this->assertTrue(
                collect($auditLogs)->contains('action', $action),
                "Missing audit log for action: {$action}"
            );
        }
        
        // Verify role-based actions
        $roleActions = [
            'beneficiary' => ['user.registered', 'document.uploaded'],
            'healthcare_professional' => ['health_assessment.reviewed', 'interview.completed'],
            'document_reviewer' => ['document.reviewed'],
            'admin' => ['beneficiary.approved']
        ];
        
        foreach ($roleActions as $role => $actions) {
            foreach ($actions as $action) {
                $log = collect($auditLogs)->firstWhere('action', $action);
                $this->assertNotNull($log, "Missing log for action: {$action}");
                
                if ($log) {
                    $user = User::find($log['user_id']);
                    $this->assertEquals($role, $user->role ?? $user->admin_role);
                }
            }
        }
        
        $this->notifyProgress('Audit trail verification complete');
    }

    /**
     * Test concurrent multi-role operations
     */
    public function test_concurrent_multi_role_operations(): void
    {
        // Simulate multiple beneficiaries being processed simultaneously
        $beneficiaries = User::factory()->count(3)->create(['role' => 'beneficiary']);
        
        // Each beneficiary uploads documents
        foreach ($beneficiaries as $beneficiary) {
            Sanctum::actingAs($beneficiary);
            
            $file = UploadedFile::fake()->image('doc.jpg');
            $response = $this->postJson('/api/documents/upload', [
                'document_type_id' => 1,
                'file' => $file
            ]);
            
            $response->assertStatus(201);
        }
        
        // Document reviewer processes all documents
        Sanctum::actingAs($this->reviewer);
        
        $response = $this->getJson('/api/admin/documents/pending-review');
        $documents = $response->json('documents');
        
        $this->assertCount(3, $documents);
        
        // Batch approve documents
        $documentIds = collect($documents)->pluck('id')->toArray();
        
        $response = $this->postJson('/api/admin/documents/batch-review', [
            'document_ids' => $documentIds,
            'action' => 'approve',
            'notes' => 'Batch approval'
        ]);
        
        $response->assertStatus(200)
            ->assertJson([
                'processed' => 3,
                'approved' => 3
            ]);
        
        // Verify no race conditions or data inconsistencies
        foreach ($documentIds as $docId) {
            $this->assertDatabaseHas('documents', [
                'id' => $docId,
                'status' => 'validated',
                'reviewed_by' => $this->reviewer->id
            ]);
        }
    }

    /**
     * Test role permission boundaries
     */
    public function test_role_permission_boundaries(): void
    {
        // Beneficiary cannot access admin endpoints
        Sanctum::actingAs($this->beneficiary);
        
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(403);
        
        $response = $this->postJson('/api/admin/documents/1/review', ['action' => 'approve']);
        $response->assertStatus(403);
        
        // Healthcare professional cannot approve beneficiaries
        Sanctum::actingAs($this->healthcareProfessional);
        
        $response = $this->postJson('/api/admin/beneficiaries/1/approve', ['decision' => 'approved']);
        $response->assertStatus(403);
        
        // Document reviewer cannot access health data
        Sanctum::actingAs($this->reviewer);
        
        $response = $this->getJson('/api/admin/health-assessments/1');
        $response->assertStatus(403);
        
        // Admin has full access
        Sanctum::actingAs($this->admin);
        
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(200);
        
        $response = $this->getJson('/api/admin/system/logs');
        $response->assertStatus(200);
    }

    /**
     * Test workflow rollback scenarios
     */
    public function test_workflow_rollback_scenarios(): void
    {
        // Complete workflow up to approval
        $this->step1_beneficiary_registration_and_documents();
        $this->step2_healthcare_professional_reviews_health();
        $this->step3_document_reviewer_validates();
        
        // Admin rejects case
        Sanctum::actingAs($this->admin);
        
        $response = $this->postJson("/api/admin/beneficiaries/{$this->beneficiary->beneficiary->id}/reject", [
            'reason' => 'incomplete_documentation',
            'details' => 'Missing proof of address',
            'allow_resubmission' => true
        ]);
        
        $response->assertStatus(200);
        
        // Verify rollback
        $this->assertDatabaseHas('beneficiaries', [
            'id' => $this->beneficiary->beneficiary->id,
            'status' => 'rejected',
            'documents_verified' => false
        ]);
        
        // Beneficiary can see rejection reason
        Sanctum::actingAs($this->beneficiary);
        
        $response = $this->getJson('/api/profile');
        $response->assertStatus(200)
            ->assertJson([
                'user' => [
                    'beneficiary' => [
                        'status' => 'rejected',
                        'rejection_reason' => 'incomplete_documentation',
                        'can_resubmit' => true
                    ]
                ]
            ]);
        
        // Beneficiary resubmits missing document
        $file = UploadedFile::fake()->image('proof_of_address.jpg');
        $response = $this->postJson('/api/documents/upload', [
            'document_type_id' => DocumentType::where('code', 'COMP_RES')->first()->id,
            'file' => $file
        ]);
        
        $response->assertStatus(201);
        
        // Verify status changes to pending review
        $this->assertDatabaseHas('beneficiaries', [
            'id' => $this->beneficiary->beneficiary->id,
            'status' => 'pending_review'
        ]);
    }

    /**
     * Helper: Setup roles and permissions
     */
    private function setupRolesAndPermissions(): void
    {
        // Create admin roles
        $superAdmin = AdminRole::create([
            'name' => 'super_admin',
            'display_name' => 'Super Administrator'
        ]);
        
        $documentReviewer = AdminRole::create([
            'name' => 'document_reviewer',
            'display_name' => 'Document Reviewer'
        ]);
        
        // Create permissions
        $permissions = [
            'users.view', 'users.create', 'users.update', 'users.delete',
            'documents.view', 'documents.review', 'documents.approve',
            'health.view', 'health.review',
            'beneficiaries.view', 'beneficiaries.approve', 'beneficiaries.reject',
            'system.logs', 'system.settings'
        ];
        
        foreach ($permissions as $permission) {
            AdminPermission::create(['name' => $permission]);
        }
        
        // Assign all permissions to super admin
        $superAdmin->permissions()->attach(AdminPermission::all());
        
        // Assign specific permissions to document reviewer
        $documentReviewer->permissions()->attach(
            AdminPermission::whereIn('name', ['documents.view', 'documents.review', 'documents.approve'])->get()
        );
    }

    /**
     * Helper: Create test users
     */
    private function createTestUsers(): void
    {
        // Create beneficiary
        $this->beneficiary = User::factory()->create([
            'email' => 'beneficiary@test.com',
            'role' => 'beneficiary'
        ]);
        
        // Create healthcare professional
        $this->healthcareProfessional = User::factory()->create([
            'email' => 'healthcare@test.com',
            'role' => 'healthcare_professional'
        ]);
        
        // Create admin
        $this->admin = User::factory()->create([
            'email' => 'admin@test.com',
            'role' => 'admin',
            'is_admin' => true
        ]);
        $this->admin->adminRoles()->attach(AdminRole::where('name', 'super_admin')->first());
        
        // Create document reviewer
        $this->reviewer = User::factory()->create([
            'email' => 'reviewer@test.com',
            'role' => 'admin',
            'is_admin' => true
        ]);
        $this->reviewer->adminRoles()->attach(AdminRole::where('name', 'document_reviewer')->first());
    }

    /**
     * Helper: Seed test data
     */
    private function seedTestData(): void
    {
        // Create document types
        DocumentType::insert([
            ['name' => 'RG', 'code' => 'RG', 'is_required' => true],
            ['name' => 'CPF', 'code' => 'CPF', 'is_required' => true],
            ['name' => 'Comprovante de Residência', 'code' => 'COMP_RES', 'is_required' => true]
        ]);
        
        // Create interview slots
        InterviewSlot::factory()->count(5)->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'start_time' => Carbon::now()->addDay(),
            'is_available' => true
        ]);
    }

    /**
     * Helper: Store progress notification
     */
    private function notifyProgress($message): void
    {
        exec("npx claude-flow@alpha hooks notify --message \"Multi-Role Test: {$message}\"");
    }

    protected function tearDown(): void
    {
        exec('npx claude-flow@alpha hooks post-edit --file "/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend/tests/Feature/Api/MultiRoleWorkflowIntegrationTest.php" --memory-key "analyzer/journey-tests/multi-role"');
        
        parent::tearDown();
    }
}