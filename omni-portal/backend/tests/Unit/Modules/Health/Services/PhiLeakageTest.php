<?php

namespace Tests\Unit\Modules\Health\Services;

use App\Modules\Health\Services\QuestionnaireService;
use App\Modules\Health\Services\ScoringService;
use App\Modules\Health\Services\ExportService;
use App\Modules\Health\Repositories\QuestionnaireRepository;
use App\Models\HealthQuestionnaire;
use App\Models\User;
use App\Models\QuestionnaireTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PHI Leakage Prevention Tests
 *
 * Verifies that NO PHI (Protected Health Information) is exposed in:
 * - Service method responses
 * - Event payloads
 * - Export data
 * - Log entries
 * - Analytics data
 *
 * CRITICAL SECURITY REQUIREMENT:
 * All tests must PASS to ensure HIPAA/LGPD compliance
 */
class PhiLeakageTest extends TestCase
{
    use RefreshDatabase;

    private QuestionnaireService $questionnaireService;
    private ScoringService $scoringService;
    private ExportService $exportService;

    protected function setUp(): void
    {
        parent::setUp();

        $repository = $this->createMock(QuestionnaireRepository::class);
        $this->scoringService = new ScoringService();
        $this->questionnaireService = new QuestionnaireService($repository, $this->scoringService);
        $this->exportService = new ExportService($this->scoringService);
    }

    /**
     * Test: getActiveSchema returns NO PHI
     */
    public function test_get_active_schema_contains_no_phi(): void
    {
        // Create template
        $template = QuestionnaireTemplate::factory()->create([
            'is_active' => true,
            'published_at' => now(),
        ]);

        $schema = $this->questionnaireService->getActiveSchema();

        // Verify no user data present
        $this->assertArrayNotHasKey('user_id', $schema);
        $this->assertArrayNotHasKey('beneficiary_id', $schema);
        $this->assertArrayNotHasKey('answers', $schema);
        $this->assertArrayNotHasKey('responses', $schema);

        // Verify only template data
        $this->assertArrayHasKey('id', $schema);
        $this->assertArrayHasKey('version', $schema);
        $this->assertArrayHasKey('sections', $schema);
    }

    /**
     * Test: saveDraft hides encrypted responses
     */
    public function test_save_draft_hides_encrypted_responses(): void
    {
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create([
            'is_active' => true,
        ]);

        $answers = [
            'phq9_q1' => 2,
            'phq9_q2' => 2,
            'sensitive_data' => 'This should be encrypted and hidden',
        ];

        $repository = $this->createMock(QuestionnaireRepository::class);
        $repository->method('findOrCreateDraft')
            ->willReturn(HealthQuestionnaire::factory()->make([
                'beneficiary_id' => $user->id,
                'template_id' => $template->id,
            ]));

        $service = new QuestionnaireService($repository, $this->scoringService);
        $response = $service->saveDraft($user, $template->id, $answers);

        // Verify responses are hidden
        $responseArray = $response->toArray();
        $this->assertArrayNotHasKey('responses', $responseArray);

        // Verify only metadata is present
        $this->assertArrayHasKey('status', $responseArray);
        $this->assertArrayHasKey('last_saved_at', $responseArray);

        // Verify no raw answers in array
        $this->assertArrayNotHasKey('phq9_q1', $responseArray);
        $this->assertArrayNotHasKey('sensitive_data', $responseArray);
    }

    /**
     * Test: submitQuestionnaire returns only score and risk band
     */
    public function test_submit_questionnaire_returns_only_metadata(): void
    {
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create([
            'is_active' => true,
        ]);

        $answers = [
            'phq9_q1' => 3,
            'phq9_q2' => 3,
            'phq9_q3' => 3,
            'free_text' => 'I am feeling very depressed', // PHI - must be hidden
        ];

        $repository = $this->createMock(QuestionnaireRepository::class);
        $repository->method('findOrCreateDraft')
            ->willReturn(HealthQuestionnaire::factory()->make([
                'beneficiary_id' => $user->id,
                'template_id' => $template->id,
            ]));

        $service = new QuestionnaireService($repository, $this->scoringService);
        $response = $service->submitQuestionnaire($user, $template->id, $answers);

        $responseArray = $response->toArray();

        // Verify NO raw answers
        $this->assertArrayNotHasKey('responses', $responseArray);
        $this->assertArrayNotHasKey('free_text', $responseArray);

        // Verify only aggregated data
        $this->assertArrayHasKey('score', $responseArray);
        $this->assertArrayHasKey('risk_level', $responseArray);
        $this->assertArrayHasKey('status', $responseArray);

        // Verify no PHI in response
        $jsonResponse = json_encode($responseArray);
        $this->assertStringNotContainsString('feeling very depressed', $jsonResponse);
    }

    /**
     * Test: exportForHealthPlan suppresses ALL PHI
     */
    public function test_export_for_health_plan_suppresses_phi(): void
    {
        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => 123,
            'responses' => [
                'phq9_q1' => 2,
                'name' => 'John Doe', // PHI
                'email' => 'john@example.com', // PHI
            ],
            'score' => 45,
            'risk_level' => 'moderate',
        ]);

        $export = $this->exportService->exportForHealthPlan($questionnaire);

        // Verify NO user identifiers
        $this->assertArrayNotHasKey('beneficiary_id', $export);
        $this->assertArrayNotHasKey('user_id', $export);
        $this->assertArrayNotHasKey('name', $export);
        $this->assertArrayNotHasKey('email', $export);

        // Verify only hashed ID
        $this->assertArrayHasKey('patient_hash', $export);
        $this->assertEquals(hash('sha256', 123), $export['patient_hash']);

        // Verify NO raw answers
        $this->assertArrayNotHasKey('responses', $export);
        $this->assertArrayNotHasKey('answers', $export);

        // Verify only aggregated data
        $this->assertArrayHasKey('risk_band', $export);
        $this->assertArrayHasKey('risk_assessment', $export);

        // Verify PHI removal flag
        $this->assertTrue($export['phi_removed']);
        $this->assertEquals('de-identified', $export['data_classification']);
    }

    /**
     * Test: generateClinicalReport contains NO PHI
     */
    public function test_clinical_report_contains_no_phi(): void
    {
        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => 456,
            'responses' => [
                'phq9_q1' => 3,
                'personal_story' => 'My mother died last year', // PHI - must not appear
            ],
            'risk_level' => 'high',
            'recommendations' => ['Seek mental health support'],
        ]);

        $html = $this->exportService->generateClinicalReport($questionnaire);

        // Verify NO PHI in HTML
        $this->assertStringNotContainsString('personal_story', $html);
        $this->assertStringNotContainsString('My mother died', $html);
        $this->assertStringNotContainsString('beneficiary_id', $html);

        // Verify only risk band and recommendations
        $this->assertStringContainsString('High Risk', $html);
        $this->assertStringContainsString('Seek mental health support', $html);

        // Verify disclaimer is present
        $this->assertStringContainsString('Important Disclaimer', $html);
    }

    /**
     * Test: redactForAnalytics removes all identifiable data
     */
    public function test_redact_for_analytics_removes_identifiers(): void
    {
        $scoreData = [
            'score_redacted' => 85,
            'risk_band' => 'high',
            'categories' => [
                'depression' => [
                    'raw_score' => 18,
                    'risk_points' => 40,
                    'free_text' => 'Patient reported severe symptoms', // Must be removed
                ],
                'safety_triggers' => [
                    'suicide_ideation' => 50,
                ],
            ],
        ];

        $redacted = $this->scoringService->redactForAnalytics($scoreData);

        // Verify only boolean flags
        $this->assertArrayHasKey('has_depression_risk', $redacted);
        $this->assertArrayHasKey('has_safety_triggers', $redacted);

        // Verify NO raw scores or text
        $this->assertArrayNotHasKey('raw_score', $redacted);
        $this->assertArrayNotHasKey('free_text', $redacted);

        // Verify all flag values are boolean
        $this->assertIsBool($redacted['has_depression_risk']);
        $this->assertIsBool($redacted['has_safety_triggers']);

        // Verify only risk band string
        $this->assertEquals('high', $redacted['risk_band']);
    }

    /**
     * Test: Scoring service NEVER includes answer content in output
     */
    public function test_scoring_never_includes_answer_content(): void
    {
        $answers = [
            'phq9_q1' => 2,
            'phq9_q2' => 2,
            'phq9_q3' => 2,
            'free_text_question' => 'I struggle with anxiety daily', // PHI
            'name' => 'Jane Smith', // PHI
        ];

        $result = $this->scoringService->calculateRiskScore($answers);

        // Convert to JSON to check for any PHI leakage
        $jsonResult = json_encode($result);

        // Verify NO answer content in result
        $this->assertStringNotContainsString('I struggle with anxiety', $jsonResult);
        $this->assertStringNotContainsString('Jane Smith', $jsonResult);
        $this->assertStringNotContainsString('free_text_question', $jsonResult);

        // Verify only aggregated data
        $this->assertArrayHasKey('score_redacted', $result);
        $this->assertArrayHasKey('risk_band', $result);
        $this->assertArrayHasKey('categories', $result);

        // Verify categories contain only scores, not answers
        foreach ($result['categories'] as $category => $data) {
            if (is_array($data)) {
                $this->assertArrayNotHasKey('answers', $data);
                $this->assertArrayNotHasKey('responses', $data);
            }
        }
    }

    /**
     * Test: Event payload contains NO PHI
     */
    public function test_event_payload_contains_no_phi(): void
    {
        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => 789,
            'responses' => [
                'phq9_q1' => 3,
                'sensitive_answer' => 'Very sensitive information', // PHI
            ],
        ]);

        $scoreData = [
            'score_redacted' => 60,
            'risk_band' => 'moderate',
            'categories' => [],
        ];

        $event = new \App\Events\HealthQuestionnaireSubmitted($questionnaire, $scoreData);

        // Verify questionnaire in event has responses hidden
        $eventQuestionnaire = $event->questionnaire;
        $this->assertArrayNotHasKey('responses', $eventQuestionnaire->toArray());

        // Verify audit data is de-identified
        $auditData = $event->getAuditData();
        $this->assertArrayNotHasKey('beneficiary_id', $auditData);
        $this->assertArrayHasKey('user_hashed_id', $auditData);
        $this->assertEquals(hash('sha256', 789), $auditData['user_hashed_id']);
    }

    /**
     * Test: Validate branching logic contains NO PHI
     */
    public function test_validate_branching_logic_no_phi(): void
    {
        $answers = [
            'phq9_q9' => 2, // Suicide ideation - triggers branching
            'name' => 'John Doe', // PHI - should not be in result
        ];

        $schema = [
            'sections' => [
                'safety_planning' => [
                    'name' => 'Safety Planning',
                    'condition' => [
                        'question_id' => 'phq9_q9',
                        'operator' => '>',
                        'value' => 0,
                    ],
                    'questions' => [
                        ['id' => 'safety_q1', 'text' => 'Do you have a safety plan?'],
                    ],
                ],
            ],
        ];

        $result = $this->questionnaireService->validateBranchingLogic($answers, $schema);

        // Verify result contains only question structure
        $this->assertArrayHasKey('safety_planning', $result);

        // Verify NO PHI in result
        $jsonResult = json_encode($result);
        $this->assertStringNotContainsString('John Doe', $jsonResult);
        $this->assertStringNotContainsString('name', $jsonResult);
    }
}
