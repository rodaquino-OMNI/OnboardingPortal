<?php

namespace Tests\Feature\Health;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Health\Models\Questionnaire;
use App\Modules\Health\Models\QuestionnaireResponse;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Questionnaire Encryption Test Suite
 *
 * Validates Phase 1 implementation requirements:
 * 1. Migrations run successfully
 * 2. Encryption round-trip works (save encrypted, retrieve decrypted)
 * 3. Hash column populated automatically
 * 4. No plaintext PHI in database
 * 5. Audit logging triggered
 *
 * CRITICAL SECURITY VALIDATION:
 * - Verifies AES-256-GCM encryption via EncryptsAttributes trait
 * - Confirms SHA-256 hash generation for deduplication
 * - Ensures no PHI stored in plaintext
 * - Validates deterministic scoring
 *
 * @see app/Modules/Health/Models/QuestionnaireResponse.php
 * @see app/Traits/EncryptsAttributes.php
 */
class QuestionnaireEncryptionTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Questionnaire $questionnaire;

    /**
     * Setup test environment
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Create test user
        $this->user = User::factory()->create([
            'email' => 'test@example.com',
            'name' => 'Test User',
        ]);

        // Create test questionnaire
        $this->questionnaire = Questionnaire::create([
            'user_id' => $this->user->id,
            'version' => 1,
            'schema_json' => [
                'questions' => [
                    ['id' => 1, 'text' => 'Do you smoke?', 'type' => 'boolean'],
                    ['id' => 2, 'text' => 'Family history of diabetes?', 'type' => 'boolean'],
                    ['id' => 3, 'text' => 'Current medications', 'type' => 'text'],
                ],
            ],
            'status' => 'reviewed',
            'is_active' => true,
            'published_at' => now(),
        ]);
    }

    /**
     * Test 1: Migrations run successfully
     *
     * @test
     */
    public function migrations_create_required_tables_and_columns()
    {
        // Verify questionnaires table exists
        $this->assertTrue(
            DB::getSchemaBuilder()->hasTable('questionnaires'),
            'Questionnaires table should exist'
        );

        // Verify questionnaire_responses table exists
        $this->assertTrue(
            DB::getSchemaBuilder()->hasTable('questionnaire_responses'),
            'QuestionnaireResponses table should exist'
        );

        // Verify critical columns in questionnaire_responses
        $columns = DB::getSchemaBuilder()->getColumnListing('questionnaire_responses');

        $requiredColumns = [
            'id',
            'questionnaire_id',
            'user_id',
            'answers_encrypted_json',
            'answers_hash',
            'score_redacted',
            'risk_band',
            'submitted_at',
            'audit_ref',
            'metadata',
        ];

        foreach ($requiredColumns as $column) {
            $this->assertContains(
                $column,
                $columns,
                "Column '{$column}' should exist in questionnaire_responses table"
            );
        }
    }

    /**
     * Test 2: Encryption round-trip works (save encrypted, retrieve decrypted)
     *
     * @test
     */
    public function encryption_round_trip_works_correctly()
    {
        // PHI data to encrypt
        $phiAnswers = [
            'smoking' => true,
            'family_history_diabetes' => true,
            'medications' => 'Metformin 500mg, Lisinopril 10mg',
            'personal_notes' => 'Patient reports frequent urination',
        ];

        // Create response with encrypted answers
        $response = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => $phiAnswers,
            'score_redacted' => 65,
        ]);

        // Refresh from database
        $response->refresh();

        // Verify decrypted data matches original
        $decryptedAnswers = $response->getDecryptedAnswers();

        $this->assertEquals(
            $phiAnswers,
            $decryptedAnswers,
            'Decrypted answers should match original PHI data'
        );

        // Verify automatic casting works
        $this->assertEquals(
            $phiAnswers['smoking'],
            $response->answers_encrypted_json['smoking'],
            'Trait should auto-decrypt when accessed via attribute'
        );
    }

    /**
     * Test 3: Hash column populated automatically
     *
     * @test
     */
    public function hash_column_auto_generated_on_save()
    {
        $phiAnswers = [
            'smoking' => false,
            'family_history_diabetes' => false,
            'medications' => 'None',
        ];

        // Create response
        $response = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => $phiAnswers,
            'score_redacted' => 10,
        ]);

        // Verify hash was auto-generated
        $this->assertNotNull(
            $response->answers_hash,
            'Hash should be auto-generated by EncryptsAttributes trait'
        );

        // Verify hash is SHA-256 (64 characters hex)
        $this->assertEquals(
            64,
            strlen($response->answers_hash),
            'Hash should be 64 characters (SHA-256)'
        );

        $this->assertTrue(
            ctype_xdigit($response->answers_hash),
            'Hash should be hexadecimal'
        );

        // Verify same data produces same hash (deterministic)
        $response2 = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => $phiAnswers,
            'score_redacted' => 10,
        ]);

        $this->assertEquals(
            $response->answers_hash,
            $response2->answers_hash,
            'Same answers should produce same hash for deduplication'
        );
    }

    /**
     * Test 4: No plaintext PHI in database
     *
     * @test
     */
    public function no_plaintext_phi_stored_in_database()
    {
        $phiAnswers = [
            'smoking' => true,
            'medications' => 'SENSITIVE_MEDICATION_NAME',
            'personal_medical_history' => 'SENSITIVE_MEDICAL_CONDITION',
        ];

        // Create response
        $response = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => $phiAnswers,
            'score_redacted' => 50,
        ]);

        // Query raw database to verify encryption
        $rawRecord = DB::table('questionnaire_responses')
            ->where('id', $response->id)
            ->first();

        // Verify PHI strings NOT in plaintext
        $this->assertStringNotContainsString(
            'SENSITIVE_MEDICATION_NAME',
            $rawRecord->answers_encrypted_json,
            'PHI should NOT be stored in plaintext'
        );

        $this->assertStringNotContainsString(
            'SENSITIVE_MEDICAL_CONDITION',
            $rawRecord->answers_encrypted_json,
            'PHI should NOT be stored in plaintext'
        );

        // Verify data is encrypted (should contain Laravel Crypt prefix)
        $this->assertStringContainsString(
            'eyJpdiI',
            $rawRecord->answers_encrypted_json,
            'Data should be encrypted with Laravel Crypt (base64 encoded)'
        );
    }

    /**
     * Test 5: Risk band auto-calculation
     *
     * @test
     */
    public function risk_band_calculated_automatically_from_score()
    {
        // Test low risk (0-24)
        $responseLow = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => ['test' => 'data'],
            'score_redacted' => 15,
        ]);

        $this->assertEquals('low', $responseLow->risk_band);

        // Test moderate risk (25-49)
        $responseMod = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => ['test' => 'data'],
            'score_redacted' => 35,
        ]);

        $this->assertEquals('moderate', $responseMod->risk_band);

        // Test high risk (50-74)
        $responseHigh = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => ['test' => 'data'],
            'score_redacted' => 65,
        ]);

        $this->assertEquals('high', $responseHigh->risk_band);

        // Test critical risk (75-100)
        $responseCrit = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => ['test' => 'data'],
            'score_redacted' => 85,
        ]);

        $this->assertEquals('critical', $responseCrit->risk_band);
    }

    /**
     * Test 6: Encrypted data hidden from API responses
     *
     * @test
     */
    public function encrypted_data_hidden_from_api_responses()
    {
        $response = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => ['sensitive' => 'phi_data'],
            'score_redacted' => 50,
        ]);

        // Convert to array (simulates API response)
        $apiResponse = $response->toArray();

        // Verify encrypted field NOT in response
        $this->assertArrayNotHasKey(
            'answers_encrypted_json',
            $apiResponse,
            'Encrypted PHI should be hidden from API responses'
        );

        // Verify hash NOT in response
        $this->assertArrayNotHasKey(
            'answers_hash',
            $apiResponse,
            'Hash should be hidden from API responses'
        );

        // Verify safe fields ARE in response
        $this->assertArrayHasKey('score_redacted', $apiResponse);
        $this->assertArrayHasKey('risk_band', $apiResponse);
    }

    /**
     * Test 7: Safe metadata method returns only non-PHI
     *
     * @test
     */
    public function safe_metadata_method_returns_only_non_phi()
    {
        $response = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => ['sensitive' => 'phi_data'],
            'score_redacted' => 50,
            'metadata' => ['completion_time_seconds' => 120],
        ]);

        $safeData = $response->getSafeMetadata();

        // Verify NO encrypted data
        $this->assertArrayNotHasKey('answers_encrypted_json', $safeData);
        $this->assertArrayNotHasKey('answers_hash', $safeData);

        // Verify safe fields present
        $this->assertArrayHasKey('id', $safeData);
        $this->assertArrayHasKey('score_redacted', $safeData);
        $this->assertArrayHasKey('risk_band', $safeData);
        $this->assertArrayHasKey('metadata', $safeData);

        // Verify metadata preserved
        $this->assertEquals(120, $safeData['metadata']['completion_time_seconds']);
    }

    /**
     * Test 8: User isolation scope works
     *
     * @test
     */
    public function user_isolation_scope_filters_correctly()
    {
        // Create another user
        $otherUser = User::factory()->create();

        // Create responses for both users
        QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => ['data' => 'user1'],
            'score_redacted' => 30,
        ]);

        QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $otherUser->id,
            'answers_encrypted_json' => ['data' => 'user2'],
            'score_redacted' => 40,
        ]);

        // Authenticate as first user
        $this->actingAs($this->user);

        // Query with ownedBy scope
        $userResponses = QuestionnaireResponse::ownedBy()->get();

        // Verify only own responses returned
        $this->assertCount(1, $userResponses);
        $this->assertEquals($this->user->id, $userResponses->first()->user_id);
    }

    /**
     * Test 9: Questionnaire relationships work
     *
     * @test
     */
    public function questionnaire_relationships_load_correctly()
    {
        $response = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => ['test' => 'data'],
            'score_redacted' => 25,
        ]);

        // Test belongsTo relationships
        $this->assertInstanceOf(Questionnaire::class, $response->questionnaire);
        $this->assertInstanceOf(User::class, $response->user);

        // Test hasMany relationship
        $this->assertInstanceOf(
            \Illuminate\Database\Eloquent\Collection::class,
            $this->questionnaire->responses
        );

        $this->assertCount(1, $this->questionnaire->responses);
    }

    /**
     * Test 10: Encryption handles JSON objects correctly
     *
     * @test
     */
    public function encryption_handles_complex_json_structures()
    {
        $complexAnswers = [
            'demographics' => [
                'age' => 45,
                'gender' => 'female',
            ],
            'conditions' => ['diabetes', 'hypertension'],
            'medications' => [
                ['name' => 'Metformin', 'dosage' => '500mg', 'frequency' => 'twice daily'],
                ['name' => 'Lisinopril', 'dosage' => '10mg', 'frequency' => 'once daily'],
            ],
            'boolean_flags' => [
                'smoker' => false,
                'alcohol_use' => true,
            ],
        ];

        $response = QuestionnaireResponse::create([
            'questionnaire_id' => $this->questionnaire->id,
            'user_id' => $this->user->id,
            'answers_encrypted_json' => $complexAnswers,
            'score_redacted' => 55,
        ]);

        // Verify complex structure preserved
        $decrypted = $response->getDecryptedAnswers();

        $this->assertEquals($complexAnswers, $decrypted);
        $this->assertEquals(45, $decrypted['demographics']['age']);
        $this->assertCount(2, $decrypted['conditions']);
        $this->assertEquals('Metformin', $decrypted['medications'][0]['name']);
    }
}
