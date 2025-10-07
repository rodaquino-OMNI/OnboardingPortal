<?php

namespace Tests\Feature\Health;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Services\AnalyticsPayloadValidator;
use App\Models\HealthQuestionnaire;
use App\Models\User;
use App\Models\QuestionnaireTemplate;

class AnalyticsPayloadValidatorTest extends TestCase
{
    use RefreshDatabase;

    protected AnalyticsPayloadValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = app(AnalyticsPayloadValidator::class);
    }

    /**
     * @test
     * CRITICAL: Test that PHI is never included in analytics payloads
     */
    public function test_no_phi_in_analytics_payload()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'answers_encrypted_json' => ['phq9' => [1, 2, 3, 0, 1, 2, 3, 0, 1]],
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);

        // Assert - No PHI should be present
        $this->assertArrayNotHasKey('answers', $payload);
        $this->assertArrayNotHasKey('answers_encrypted_json', $payload);
        $this->assertArrayNotHasKey('user_id', $payload);
        $this->assertArrayNotHasKey('email', $payload);
        $this->assertArrayNotHasKey('name', $payload);

        // Verify payload is valid JSON
        $json = json_encode($payload);
        $this->assertJson($json);

        // Verify no PHI in JSON string
        $this->assertStringNotContainsString('phq9', $json);
        $this->assertStringNotContainsString($user->email, $json);
    }

    /**
     * @test
     * Test that only aggregated metadata is included
     */
    public function test_only_aggregated_metadata_included()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'answers_encrypted_json' => ['phq9' => [2, 2, 2, 2, 2, 2, 2, 2, 2]],
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);

        // Assert - Should only contain aggregated/anonymized data
        $this->assertArrayHasKey('risk_band', $payload);
        $this->assertArrayHasKey('questionnaire_type', $payload);
        $this->assertArrayHasKey('completion_time_minutes', $payload);
        $this->assertArrayHasKey('timestamp', $payload);

        // Should have anonymized user identifier
        $this->assertArrayHasKey('anonymous_user_id', $payload);
        $this->assertNotEquals($user->id, $payload['anonymous_user_id']);
    }

    /**
     * @test
     * Test that risk bands are included (de-identified)
     */
    public function test_risk_bands_included_in_analytics()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'risk_band' => 'moderate',
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);

        // Assert
        $this->assertArrayHasKey('risk_band', $payload);
        $this->assertEquals('moderate', $payload['risk_band']);
    }

    /**
     * @test
     * Test that demographic data is generalized
     */
    public function test_demographic_data_generalized()
    {
        // Arrange
        $user = User::factory()->create(['date_of_birth' => '1990-05-15']);
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);

        // Assert - Should not include exact birth date
        $this->assertArrayNotHasKey('date_of_birth', $payload);

        // May include generalized age range
        if (isset($payload['age_range'])) {
            $this->assertMatchesRegularExpression('/^\d+-\d+$/', $payload['age_range']);
        }
    }

    /**
     * @test
     * Test that validator detects PHI leakage attempts
     */
    public function test_validator_detects_phi_leakage()
    {
        // Arrange - Malicious payload with PHI
        $maliciousPayload = [
            'risk_band' => 'moderate',
            'email' => 'user@example.com', // PHI!
            'answers' => ['phq9' => [1, 2, 3]], // PHI!
        ];

        // Act & Assert
        $this->expectException(\SecurityException::class);
        $this->expectExceptionMessage('PHI detected in analytics payload');

        $this->validator->validatePayload($maliciousPayload);
    }

    /**
     * @test
     * Test that IP addresses are excluded
     */
    public function test_ip_addresses_excluded()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);

        // Assert
        $this->assertArrayNotHasKey('ip_address', $payload);
        $this->assertArrayNotHasKey('user_agent', $payload);
    }

    /**
     * @test
     * Test that session IDs are excluded
     */
    public function test_session_ids_excluded()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);

        // Assert
        $this->assertArrayNotHasKey('session_id', $payload);
        $this->assertArrayNotHasKey('csrf_token', $payload);
    }

    /**
     * @test
     * Test that timestamps are rounded to hour (privacy protection)
     */
    public function test_timestamps_rounded_for_privacy()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
            'submitted_at' => '2024-01-15 14:23:45',
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);

        // Assert - Timestamp should be rounded to hour
        if (isset($payload['timestamp'])) {
            $timestamp = strtotime($payload['timestamp']);
            $this->assertEquals(0, $timestamp % 3600); // Should be divisible by 3600 (1 hour)
        }
    }

    /**
     * @test
     * Test that validator prevents re-identification attacks
     */
    public function test_validator_prevents_reidentification()
    {
        // Arrange - Create multiple users with unique characteristics
        $users = User::factory()->count(5)->create();
        $template = QuestionnaireTemplate::factory()->create();

        $payloads = [];

        foreach ($users as $user) {
            $questionnaire = HealthQuestionnaire::factory()->create([
                'user_id' => $user->id,
                'template_id' => $template->id,
            ]);

            $payloads[] = $this->validator->buildAnalyticsPayload($questionnaire);
        }

        // Assert - Should not be able to identify users from payloads
        foreach ($payloads as $payload) {
            $this->assertArrayNotHasKey('user_id', $payload);

            // Anonymous IDs should be consistent for same user but not reversible
            $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $payload['anonymous_user_id']);
        }
    }

    /**
     * @test
     * Test that k-anonymity is maintained (minimum 5 users per group)
     */
    public function test_k_anonymity_maintained()
    {
        // Arrange - Create small group
        $users = User::factory()->count(3)->create();
        $template = QuestionnaireTemplate::factory()->create();

        foreach ($users as $user) {
            HealthQuestionnaire::factory()->create([
                'user_id' => $user->id,
                'template_id' => $template->id,
                'risk_band' => 'moderate',
            ]);
        }

        // Act & Assert - Should not allow analytics for groups < 5
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Group size too small for k-anonymity');

        $this->validator->validateKAnonymity('moderate', 3);
    }

    /**
     * @test
     * Test that geographic data is generalized
     */
    public function test_geographic_data_generalized()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);

        // Assert - Should not include precise location
        $this->assertArrayNotHasKey('latitude', $payload);
        $this->assertArrayNotHasKey('longitude', $payload);
        $this->assertArrayNotHasKey('address', $payload);

        // May include generalized region
        if (isset($payload['region'])) {
            $this->assertIsString($payload['region']);
        }
    }

    /**
     * @test
     * Test that payload size is limited (prevent data exfiltration)
     */
    public function test_payload_size_limited()
    {
        // Arrange
        $user = User::factory()->create();
        $template = QuestionnaireTemplate::factory()->create();

        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $user->id,
            'template_id' => $template->id,
        ]);

        // Act
        $payload = $this->validator->buildAnalyticsPayload($questionnaire);
        $json = json_encode($payload);

        // Assert - Payload should be under 1KB
        $this->assertLessThan(1024, strlen($json));
    }
}
