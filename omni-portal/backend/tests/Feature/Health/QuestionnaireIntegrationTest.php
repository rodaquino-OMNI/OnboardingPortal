<?php

namespace Tests\Feature\Health;

use App\Models\User;
use App\Models\AuditLog;
use App\Modules\Health\Models\Questionnaire;
use App\Modules\Health\Models\QuestionnaireResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * QuestionnaireIntegrationTest - Comprehensive integration testing
 *
 * Tests the complete health questionnaire flow:
 * 1. Schema retrieval
 * 2. Draft saving
 * 3. Draft updating
 * 4. Final submission
 * 5. Response retrieval
 * 6. PHI encryption
 * 7. Audit logging
 * 8. Feature flag enforcement
 *
 * @group integration
 * @group health
 */
class QuestionnaireIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Questionnaire $questionnaire;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test user
        $this->user = User::factory()->create([
            'email' => 'test@example.com',
            'email_verified_at' => now(),
        ]);

        // Create active questionnaire
        $this->questionnaire = Questionnaire::create([
            'user_id' => $this->user->id,
            'version' => 1,
            'schema_json' => [
                'questions' => [
                    [
                        'id' => 'q1',
                        'text' => 'Do you have any pre-existing health conditions?',
                        'type' => 'boolean',
                        'required' => true,
                    ],
                    [
                        'id' => 'q2',
                        'text' => 'Are you currently taking any medications?',
                        'type' => 'boolean',
                        'required' => true,
                    ],
                ],
            ],
            'status' => 'reviewed',
            'published_at' => now(),
            'is_active' => true,
        ]);
    }

    /** @test */
    public function it_returns_active_questionnaire_schema(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/health/schema');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'version',
                'schema',
                'branching_rules',
                'metadata',
            ]);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->user->id,
            'phi_accessed' => false,
        ]);
    }

    /** @test */
    public function it_creates_draft_response_with_encryption(): void
    {
        $answers = [
            ['question_id' => 'q1', 'value' => true],
            ['question_id' => 'q2', 'value' => false],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/health/response', [
                'questionnaire_id' => $this->questionnaire->id,
                'answers' => $answers,
                'is_draft' => true,
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id',
                'status',
                'created_at',
                'message',
            ])
            ->assertJson([
                'status' => 'draft',
            ]);

        // Verify response was created
        $this->assertDatabaseHas('questionnaire_responses', [
            'user_id' => $this->user->id,
            'questionnaire_id' => $this->questionnaire->id,
            'submitted_at' => null, // Draft should not have submitted_at
        ]);

        // Verify PHI is encrypted (not plaintext)
        $savedResponse = QuestionnaireResponse::where('user_id', $this->user->id)->first();
        $this->assertNotNull($savedResponse->answers_encrypted_json);
        $this->assertIsString($savedResponse->answers_encrypted_json);

        // Verify audit log
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->user->id,
            'phi_accessed' => true,
        ]);
    }

    /** @test */
    public function it_updates_draft_response(): void
    {
        // Create initial draft
        $initialResponse = QuestionnaireResponse::create([
            'user_id' => $this->user->id,
            'questionnaire_id' => $this->questionnaire->id,
            'answers_encrypted_json' => [
                ['question_id' => 'q1', 'value' => true],
            ],
            'submitted_at' => null,
        ]);

        // Update draft
        $updatedAnswers = [
            ['question_id' => 'q1', 'value' => false],
            ['question_id' => 'q2', 'value' => true],
        ];

        $response = $this->actingAs($this->user)
            ->patchJson("/api/v1/health/response/{$initialResponse->id}", [
                'answers' => $updatedAnswers,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'draft',
                'message' => 'Draft updated successfully',
            ]);

        // Verify update was saved
        $savedResponse = $initialResponse->fresh();
        $this->assertNotNull($savedResponse);
        $this->assertNull($savedResponse->submitted_at);
    }

    /** @test */
    public function it_submits_final_response_with_scoring(): void
    {
        $answers = [
            ['question_id' => 'q1', 'value' => true],
            ['question_id' => 'q2', 'value' => false],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/health/response', [
                'questionnaire_id' => $this->questionnaire->id,
                'answers' => $answers,
                'is_draft' => false, // Final submission
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id',
                'status',
                'score_redacted',
                'risk_band',
                'created_at',
                'message',
            ])
            ->assertJson([
                'status' => 'submitted',
            ]);

        // Verify final submission
        $this->assertDatabaseHas('questionnaire_responses', [
            'user_id' => $this->user->id,
            'questionnaire_id' => $this->questionnaire->id,
        ]);

        $savedResponse = QuestionnaireResponse::where('user_id', $this->user->id)->first();
        $this->assertNotNull($savedResponse->submitted_at);
        $this->assertNotNull($savedResponse->score_redacted);
        $this->assertNotNull($savedResponse->risk_band);
        $this->assertContains($savedResponse->risk_band, ['low', 'moderate', 'high', 'critical']);
    }

    /** @test */
    public function it_prevents_resubmission(): void
    {
        // Create existing submitted response
        QuestionnaireResponse::create([
            'user_id' => $this->user->id,
            'questionnaire_id' => $this->questionnaire->id,
            'answers_encrypted_json' => [
                ['question_id' => 'q1', 'value' => true],
            ],
            'submitted_at' => now(),
        ]);

        // Attempt to submit again
        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/health/response', [
                'questionnaire_id' => $this->questionnaire->id,
                'answers' => [
                    ['question_id' => 'q1', 'value' => false],
                ],
                'is_draft' => false,
            ]);

        $response->assertStatus(409)
            ->assertJson([
                'error' => 'Already submitted',
            ]);
    }

    /** @test */
    public function it_retrieves_response_metadata_without_phi(): void
    {
        // Create submitted response
        $savedResponse = QuestionnaireResponse::create([
            'user_id' => $this->user->id,
            'questionnaire_id' => $this->questionnaire->id,
            'answers_encrypted_json' => [
                ['question_id' => 'q1', 'value' => true],
            ],
            'score_redacted' => 75,
            'risk_band' => 'moderate',
            'submitted_at' => now(),
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/v1/health/response/{$savedResponse->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'status',
                'score_redacted',
                'risk_band',
                'submitted_at',
                'created_at',
                'metadata',
            ])
            ->assertJson([
                'score_redacted' => 75,
                'risk_band' => 'moderate',
            ])
            ->assertJsonMissing([
                'answers_encrypted_json', // PHI should never be exposed
                'answers_hash',
            ]);
    }

    /** @test */
    public function it_enforces_user_isolation(): void
    {
        // Create response for different user
        $otherUser = User::factory()->create();
        $otherResponse = QuestionnaireResponse::create([
            'user_id' => $otherUser->id,
            'questionnaire_id' => $this->questionnaire->id,
            'answers_encrypted_json' => [
                ['question_id' => 'q1', 'value' => true],
            ],
            'submitted_at' => now(),
        ]);

        // Attempt to access other user's response
        $response = $this->actingAs($this->user)
            ->getJson("/api/v1/health/response/{$otherResponse->id}");

        $response->assertStatus(403)
            ->assertJson([
                'error' => 'Forbidden',
            ]);
    }

    /** @test */
    public function it_enforces_feature_flag(): void
    {
        // Disable feature flag
        \App\Models\FeatureFlag::updateOrCreate(
            ['key' => 'sliceC_health'],
            ['enabled' => false]
        );

        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/health/schema');

        $response->assertStatus(403)
            ->assertJson([
                'error' => 'Feature not enabled',
            ]);
    }

    /** @test */
    public function it_prevents_updating_submitted_response(): void
    {
        // Create submitted response
        $submittedResponse = QuestionnaireResponse::create([
            'user_id' => $this->user->id,
            'questionnaire_id' => $this->questionnaire->id,
            'answers_encrypted_json' => [
                ['question_id' => 'q1', 'value' => true],
            ],
            'submitted_at' => now(),
        ]);

        // Attempt to update
        $response = $this->actingAs($this->user)
            ->patchJson("/api/v1/health/response/{$submittedResponse->id}", [
                'answers' => [
                    ['question_id' => 'q1', 'value' => false],
                ],
            ]);

        $response->assertStatus(409)
            ->assertJson([
                'error' => 'Cannot update submitted response',
            ]);
    }

    /** @test */
    public function it_validates_questionnaire_exists(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/health/response', [
                'questionnaire_id' => 99999, // Non-existent
                'answers' => [
                    ['question_id' => 'q1', 'value' => true],
                ],
                'is_draft' => true,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['questionnaire_id']);
    }

    /** @test */
    public function it_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/health/schema');

        $response->assertStatus(401);
    }

    /** @test */
    public function complete_workflow_integration_test(): void
    {
        // Step 1: Get schema
        $schemaResponse = $this->actingAs($this->user)
            ->getJson('/api/v1/health/schema');
        $schemaResponse->assertStatus(200);

        // Step 2: Save draft
        $draftResponse = $this->actingAs($this->user)
            ->postJson('/api/v1/health/response', [
                'questionnaire_id' => $this->questionnaire->id,
                'answers' => [
                    ['question_id' => 'q1', 'value' => true],
                ],
                'is_draft' => true,
            ]);
        $draftResponse->assertStatus(201);
        $draftId = $draftResponse->json('id');

        // Step 3: Update draft
        $updateResponse = $this->actingAs($this->user)
            ->patchJson("/api/v1/health/response/{$draftId}", [
                'answers' => [
                    ['question_id' => 'q1', 'value' => true],
                    ['question_id' => 'q2', 'value' => false],
                ],
            ]);
        $updateResponse->assertStatus(200);

        // Step 4: Submit final
        $submitResponse = $this->actingAs($this->user)
            ->postJson('/api/v1/health/response', [
                'questionnaire_id' => $this->questionnaire->id,
                'answers' => [
                    ['question_id' => 'q1', 'value' => true],
                    ['question_id' => 'q2', 'value' => false],
                ],
                'is_draft' => false,
            ]);
        $submitResponse->assertStatus(201);
        $submittedId = $submitResponse->json('id');

        // Step 5: Retrieve response
        $retrieveResponse = $this->actingAs($this->user)
            ->getJson("/api/v1/health/response/{$submittedId}");
        $retrieveResponse->assertStatus(200)
            ->assertJson([
                'status' => 'submitted',
            ]);

        // Verify audit trail
        $auditLogs = AuditLog::where('user_id', $this->user->id)->count();
        $this->assertGreaterThan(0, $auditLogs);
    }
}
