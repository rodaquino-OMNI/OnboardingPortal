<?php

namespace Tests\Feature\Health;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\QuestionnaireTemplate;
use App\Models\HealthQuestionnaire;
use Laravel\Sanctum\Sanctum;

class QuestionnaireControllerTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @test
     * Test that unauthenticated users cannot access questionnaires
     */
    public function test_unauthenticated_users_cannot_access_questionnaires()
    {
        // Act
        $response = $this->getJson('/api/v1/questionnaires');

        // Assert
        $response->assertStatus(401);
    }

    /**
     * @test
     * Test that authenticated users can retrieve questionnaire schemas
     */
    public function test_authenticated_users_can_retrieve_schemas()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        QuestionnaireTemplate::factory()->create([
            'is_active' => true,
            'name' => 'PHQ-9',
        ]);

        // Act
        $response = $this->getJson('/api/v1/questionnaires/schemas');

        // Assert
        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'description',
                        'schema',
                    ],
                ],
            ]);
    }

    /**
     * @test
     * Test that users can submit valid questionnaires
     */
    public function test_users_can_submit_valid_questionnaires()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $payload = [
            'template_id' => $template->id,
            'answers' => [
                'phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1],
            ],
        ];

        // Act
        $response = $this->postJson('/api/v1/questionnaires', $payload);

        // Assert
        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'risk_band',
                    'submitted_at',
                ],
            ]);

        $this->assertDatabaseHas('health_questionnaires', [
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'completed',
        ]);
    }

    /**
     * @test
     * Test that invalid questionnaire submissions are rejected
     */
    public function test_invalid_submissions_are_rejected()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $invalidPayload = [
            'template_id' => $template->id,
            'answers' => [
                'phq9' => [1, 2], // Incomplete - PHQ-9 requires 9 answers
            ],
        ];

        // Act
        $response = $this->postJson('/api/v1/questionnaires', $invalidPayload);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors('answers');
    }

    /**
     * @test
     * Test that users can save draft questionnaires
     */
    public function test_users_can_save_drafts()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $draftPayload = [
            'template_id' => $template->id,
            'answers' => [
                'phq9' => [1, 2, null, null, null, null, null, null, null],
            ],
            'is_draft' => true,
        ];

        // Act
        $response = $this->postJson('/api/v1/questionnaires/draft', $draftPayload);

        // Assert
        $response->assertStatus(201);

        $this->assertDatabaseHas('health_questionnaires', [
            'user_id' => $user->id,
            'status' => 'draft',
        ]);
    }

    /**
     * @test
     * Test that users can retrieve their questionnaire history
     */
    public function test_users_can_retrieve_their_history()
    {
        // Arrange
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create();

        // Create questionnaires for both users
        HealthQuestionnaire::factory()->count(3)->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
        ]);

        HealthQuestionnaire::factory()->create([
            'user_id' => $otherUser->id,
            'template_id' => $template->id,
        ]);

        // Act
        $response = $this->getJson('/api/v1/questionnaires/history');

        // Assert
        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');

        // Verify only user's own questionnaires are returned
        $data = $response->json('data');
        foreach ($data as $item) {
            $this->assertEquals($user->id, $item['user_id']);
        }
    }

    /**
     * @test
     * Test that users cannot access other users' questionnaires
     */
    public function test_users_cannot_access_others_questionnaires()
    {
        // Arrange
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create();

        $otherUserQuestionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $otherUser->id,
            'template_id' => $template->id,
        ]);

        // Act
        $response = $this->getJson("/api/v1/questionnaires/{$otherUserQuestionnaire->id}");

        // Assert
        $response->assertStatus(403);
    }

    /**
     * @test
     * Test that questionnaire responses never expose PHI
     */
    public function test_responses_never_expose_phi()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'answers_encrypted_json' => ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]],
        ]);

        // Act
        $response = $this->getJson("/api/v1/questionnaires/{$questionnaire->id}");

        // Assert
        $response->assertStatus(200);

        $json = $response->getContent();

        // PHI should not be in response
        $this->assertStringNotContainsString('answers_encrypted_json', $json);
        $this->assertStringNotContainsString('"phq9"', $json);
    }

    /**
     * @test
     * Test rate limiting on questionnaire submissions
     */
    public function test_questionnaire_submission_rate_limited()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $payload = [
            'template_id' => $template->id,
            'answers' => [
                'phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1],
            ],
        ];

        // Act - Submit multiple times rapidly
        for ($i = 0; $i < 10; $i++) {
            $response = $this->postJson('/api/v1/questionnaires', $payload);
        }

        // Assert - Should eventually be rate limited
        $response->assertStatus(429);
    }

    /**
     * @test
     * Test that questionnaire results include risk assessment
     */
    public function test_questionnaire_results_include_risk_assessment()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $payload = [
            'template_id' => $template->id,
            'answers' => [
                'phq9' => [3, 3, 3, 3, 3, 3, 3, 3, 3], // Severe depression
            ],
        ];

        // Act
        $response = $this->postJson('/api/v1/questionnaires', $payload);

        // Assert
        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'risk_band',
                    'recommendations',
                ],
            ]);

        $this->assertEquals('critical', $response->json('data.risk_band'));
    }

    /**
     * @test
     * Test CORS headers for questionnaire endpoints
     */
    public function test_questionnaire_endpoints_have_cors_headers()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        // Act
        $response = $this->getJson('/api/v1/questionnaires/schemas', [
            'Origin' => 'https://app.example.com',
        ]);

        // Assert
        $response->assertHeader('Access-Control-Allow-Origin');
    }

    /**
     * @test
     * Test that questionnaire deletion is not allowed (audit trail)
     */
    public function test_questionnaires_cannot_be_deleted()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
        ]);

        // Act
        $response = $this->deleteJson("/api/v1/questionnaires/{$questionnaire->id}");

        // Assert - Should not allow deletion (405 Method Not Allowed or 403 Forbidden)
        $this->assertContains($response->status(), [403, 405]);

        // Verify questionnaire still exists
        $this->assertDatabaseHas('health_questionnaires', [
            'id' => $questionnaire->id,
        ]);
    }

    /**
     * @test
     * Test that questionnaire submission logs audit trail
     */
    public function test_questionnaire_submission_creates_audit_log()
    {
        // Arrange
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $payload = [
            'template_id' => $template->id,
            'answers' => [
                'phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1],
            ],
        ];

        // Act
        $response = $this->postJson('/api/v1/questionnaires', $payload);

        // Assert
        $response->assertStatus(201);

        // Verify audit log created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'questionnaire.submitted',
        ]);
    }
}
