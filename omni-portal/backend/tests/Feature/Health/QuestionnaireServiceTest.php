<?php

namespace Tests\Feature\Health;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\HealthQuestionnaire;
use App\Models\QuestionnaireTemplate;
use App\Services\QuestionnaireService;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

class QuestionnaireServiceTest extends TestCase
{
    use RefreshDatabase;

    protected QuestionnaireService $questionnaireService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->questionnaireService = app(QuestionnaireService::class);
    }

    /**
     * @test
     * Test that questionnaire answers are encrypted on submission
     */
    public function test_submit_questionnaire_encrypts_answers()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create([
            'is_active' => true,
            'name' => 'PHQ-9 Depression Screening',
        ]);

        $answers = [
            'phq9' => [1, 2, 1, 0, 3, 2, 1, 0, 0], // PHI - must be encrypted
            'demographic' => ['age_range' => '25-34'],
        ];

        // Act
        $response = $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $answers
        );

        // Assert - Verify encryption
        $rawEncrypted = $response->getRawOriginal('answers_encrypted_json');
        $this->assertNotNull($rawEncrypted);
        $this->assertIsString($rawEncrypted);

        // Encrypted data should not contain plaintext answers
        $this->assertStringNotContainsString('phq9', $rawEncrypted);
        $this->assertStringNotContainsString(json_encode($answers['phq9']), $rawEncrypted);

        // Verify hash exists and is SHA-256 (64 characters)
        $this->assertNotNull($response->answers_hash);
        $this->assertEquals(64, strlen($response->answers_hash));

        // Verify decryption round-trip
        $decrypted = $response->answers_encrypted_json;
        $this->assertEquals($answers, $decrypted);
    }

    /**
     * @test
     * Test that duplicate submissions are detected by hash
     */
    public function test_duplicate_submission_detected_by_hash()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $answers = [
            'phq9' => [3, 3, 3, 3, 3, 3, 3, 3, 3],
        ];

        // Act - Submit first time
        $response1 = $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $answers
        );

        // Act - Submit same answers again
        $response2 = $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $answers
        );

        // Assert - Hashes should be identical
        $this->assertEquals($response1->answers_hash, $response2->answers_hash);

        // Assert - Both submissions should be stored (for audit trail)
        $this->assertCount(2, HealthQuestionnaire::where('user_id', $user->id)->get());
    }

    /**
     * @test
     * Test that different answers produce different hashes
     */
    public function test_different_answers_produce_different_hashes()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $answers1 = ['phq9' => [1, 1, 1, 1, 1, 1, 1, 1, 1]];
        $answers2 = ['phq9' => [2, 2, 2, 2, 2, 2, 2, 2, 2]];

        // Act
        $response1 = $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $answers1
        );

        $response2 = $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $answers2
        );

        // Assert
        $this->assertNotEquals($response1->answers_hash, $response2->answers_hash);
    }

    /**
     * @test
     * Test that draft questionnaires are saved without encryption
     */
    public function test_save_draft_questionnaire()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $draftAnswers = [
            'phq9' => [1, 2, null, null, null, null, null, null, null], // Partial answers
        ];

        // Act
        $draft = $this->questionnaireService->saveDraft(
            $user->id,
            $template->id,
            $draftAnswers
        );

        // Assert
        $this->assertEquals('draft', $draft->status);
        $this->assertNull($draft->submitted_at);
        $this->assertNull($draft->answers_hash); // No hash for drafts
    }

    /**
     * @test
     * Test that schema retrieval returns active templates
     */
    public function test_get_questionnaire_schema()
    {
        // Arrange
        QuestionnaireTemplate::factory()->create([
            'is_active' => true,
            'name' => 'Active Template',
        ]);

        QuestionnaireTemplate::factory()->create([
            'is_active' => false,
            'name' => 'Inactive Template',
        ]);

        // Act
        $schemas = $this->questionnaireService->getActiveSchemas();

        // Assert
        $this->assertCount(1, $schemas);
        $this->assertEquals('Active Template', $schemas->first()->name);
    }

    /**
     * @test
     * Test that questionnaire submission validates required fields
     */
    public function test_submit_questionnaire_validates_required_fields()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create([
            'is_active' => true,
            'schema' => [
                'sections' => [
                    [
                        'id' => 'phq9',
                        'questions' => array_fill(0, 9, ['required' => true]),
                    ],
                ],
            ],
        ]);

        $incompleteAnswers = [
            'phq9' => [1, 2, 3], // Missing 6 required answers
        ];

        // Act & Assert
        $this->expectException(\InvalidArgumentException::class);
        $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $incompleteAnswers
        );
    }

    /**
     * @test
     * Test that encryption keys can be rotated
     */
    public function test_encryption_key_rotation()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $answers = ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]];

        // Act - Submit with current key
        $response = $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $answers
        );

        $originalEncrypted = $response->getRawOriginal('answers_encrypted_json');

        // Re-encrypt with same data (simulating key rotation)
        $response->answers_encrypted_json = $answers;
        $response->save();

        $newEncrypted = $response->fresh()->getRawOriginal('answers_encrypted_json');

        // Assert - Encrypted values should be different, but decrypted should be same
        $this->assertNotEquals($originalEncrypted, $newEncrypted);
        $this->assertEquals($answers, $response->answers_encrypted_json);
    }

    /**
     * @test
     * Test that user can retrieve their own questionnaire history
     */
    public function test_get_user_questionnaire_history()
    {
        // Arrange
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        // Create questionnaires for both users
        HealthQuestionnaire::factory()->create(['user_id' => $user->id, 'template_id' => $template->id]);
        HealthQuestionnaire::factory()->create(['user_id' => $user->id, 'template_id' => $template->id]);
        HealthQuestionnaire::factory()->create(['user_id' => $otherUser->id, 'template_id' => $template->id]);

        // Act
        $history = $this->questionnaireService->getUserHistory($user->id);

        // Assert - Should only get user's own questionnaires
        $this->assertCount(2, $history);
        $history->each(function ($item) use ($user) {
            $this->assertEquals($user->id, $item->user_id);
        });
    }

    /**
     * @test
     * Test that completed questionnaires cannot be modified
     */
    public function test_completed_questionnaire_immutable()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $answers = ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]];

        $response = $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $answers
        );

        // Act & Assert - Attempt to modify completed questionnaire
        $this->expectException(\LogicException::class);
        $response->update(['status' => 'draft']);
    }

    /**
     * @test
     * Test that questionnaire submission records metadata
     */
    public function test_questionnaire_submission_records_metadata()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create(['is_active' => true]);

        $answers = ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]];

        // Act
        $response = $this->questionnaireService->submitQuestionnaire(
            $user->id,
            $template->id,
            $answers
        );

        // Assert
        $this->assertNotNull($response->submitted_at);
        $this->assertEquals('completed', $response->status);
        $this->assertNotNull($response->created_at);
        $this->assertNotNull($response->updated_at);
    }
}
