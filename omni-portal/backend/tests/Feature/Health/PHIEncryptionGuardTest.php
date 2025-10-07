<?php

namespace Tests\Feature\Health;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\HealthQuestionnaire;
use App\Models\User;
use App\Models\QuestionnaireTemplate;
use Illuminate\Support\Facades\Crypt;

class PHIEncryptionGuardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @test
     * CRITICAL: Test that runtime guard throws exception on unencrypted PHI
     */
    public function test_guard_throws_exception_on_unencrypted_phi()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        // Act & Assert
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('PHI field answers_encrypted_json MUST be encrypted');

        $response = new HealthQuestionnaire([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'completed',
        ]);

        // Attempt to save plaintext PHI (should fail)
        $response->answers_encrypted_json = ['phq9' => [1, 2, 3]]; // This should trigger encryption
        $response->saveOrFail();

        // Manually bypass encryption to test guard
        $response->setRawAttributes([
            'answers_encrypted_json' => json_encode(['phq9' => [1, 2, 3]]), // Plaintext
        ]);
        $response->save(); // Should throw exception
    }

    /**
     * @test
     * Test that encrypted data passes the guard
     */
    public function test_guard_accepts_encrypted_phi()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $answers = ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]];

        // Act
        $response = new HealthQuestionnaire([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'completed',
        ]);

        $response->answers_encrypted_json = $answers; // Should auto-encrypt
        $response->save();

        // Assert - Should save successfully
        $this->assertDatabaseHas('health_questionnaires', [
            'id' => $response->id,
            'user_id' => $user->id,
        ]);

        // Verify data is encrypted in database
        $raw = $response->getRawOriginal('answers_encrypted_json');
        $this->assertNotEquals(json_encode($answers), $raw);
    }

    /**
     * @test
     * Test that NULL values are allowed (for optional fields)
     */
    public function test_guard_allows_null_phi_fields()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        // Act
        $response = new HealthQuestionnaire([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'draft',
            'answers_encrypted_json' => null, // NULL should be allowed for drafts
        ]);

        // Assert - Should not throw exception
        $response->save();
        $this->assertDatabaseHas('health_questionnaires', [
            'id' => $response->id,
            'user_id' => $user->id,
        ]);
    }

    /**
     * @test
     * Test that updating encrypted PHI maintains encryption
     */
    public function test_guard_maintains_encryption_on_update()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $response = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'answers_encrypted_json' => ['phq9' => [1, 1, 1, 1, 1, 1, 1, 1, 1]],
        ]);

        $originalEncrypted = $response->getRawOriginal('answers_encrypted_json');

        // Act - Update with new answers
        $newAnswers = ['phq9' => [2, 2, 2, 2, 2, 2, 2, 2, 2]];
        $response->answers_encrypted_json = $newAnswers;
        $response->save();

        // Assert
        $response->refresh();
        $newEncrypted = $response->getRawOriginal('answers_encrypted_json');

        // Encrypted values should be different
        $this->assertNotEquals($originalEncrypted, $newEncrypted);

        // But decrypted values should match
        $this->assertEquals($newAnswers, $response->answers_encrypted_json);
    }

    /**
     * @test
     * Test that mass assignment respects encryption
     */
    public function test_guard_protects_mass_assignment()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $answers = ['phq9' => [3, 3, 3, 3, 3, 3, 3, 3, 3]];

        // Act - Use mass assignment
        $response = HealthQuestionnaire::create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'completed',
            'answers_encrypted_json' => $answers,
        ]);

        // Assert - Should be encrypted
        $raw = $response->getRawOriginal('answers_encrypted_json');
        $this->assertNotEquals(json_encode($answers), $raw);
        $this->assertEquals($answers, $response->answers_encrypted_json);
    }

    /**
     * @test
     * Test that direct database queries bypass guard (security concern)
     */
    public function test_guard_cannot_protect_direct_db_queries()
    {
        // This test documents a known limitation:
        // Direct DB queries bypass model guards

        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $plaintext = json_encode(['phq9' => [1, 2, 3]]);

        // Act - Direct DB insert (bypasses model)
        $id = \DB::table('health_questionnaires')->insertGetId([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'completed',
            'answers_encrypted_json' => $plaintext, // Plaintext!
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Assert - Data is stored in plaintext (bad!)
        $raw = \DB::table('health_questionnaires')->find($id);
        $this->assertEquals($plaintext, $raw->answers_encrypted_json);

        // Document mitigation: Always use Eloquent models
        // Add database triggers for additional protection
    }

    /**
     * @test
     * Test that serialization/unserialization maintains encryption
     */
    public function test_guard_maintains_encryption_through_serialization()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $answers = ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]];

        $response = HealthQuestionnaire::create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'completed',
            'answers_encrypted_json' => $answers,
        ]);

        // Act - Serialize and unserialize (e.g., for caching)
        $serialized = serialize($response);
        $unserialized = unserialize($serialized);

        // Assert
        $this->assertEquals($answers, $unserialized->answers_encrypted_json);
        $raw = $unserialized->getRawOriginal('answers_encrypted_json');
        $this->assertNotEquals(json_encode($answers), $raw);
    }

    /**
     * @test
     * Test that toArray() does not expose encrypted data
     */
    public function test_guard_redacts_sensitive_fields_in_array()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $answers = ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]];

        $response = HealthQuestionnaire::create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'completed',
            'answers_encrypted_json' => $answers,
        ]);

        // Act
        $array = $response->toArray();

        // Assert - Should not expose raw encrypted data
        $this->assertArrayNotHasKey('answers_encrypted_json', $array);

        // Or if exposed, should be redacted
        if (isset($array['answers'])) {
            $this->assertIsArray($array['answers']);
            $this->assertNotContains('phq9', json_encode($array['answers']));
        }
    }

    /**
     * @test
     * Test that JSON serialization protects PHI
     */
    public function test_guard_protects_json_serialization()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $answers = ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]];

        $response = HealthQuestionnaire::create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'status' => 'completed',
            'answers_encrypted_json' => $answers,
        ]);

        // Act
        $json = $response->toJson();

        // Assert - PHI should not be in JSON output
        $this->assertStringNotContainsString('"phq9"', $json);
        $this->assertStringNotContainsString(json_encode($answers['phq9']), $json);
    }
}
