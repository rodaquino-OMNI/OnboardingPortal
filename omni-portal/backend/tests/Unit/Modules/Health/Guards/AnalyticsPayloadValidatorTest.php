<?php

namespace Tests\Unit\Modules\Health\Guards;

use App\Modules\Health\Guards\AnalyticsPayloadValidator;
use App\Modules\Health\Exceptions\PHILeakException;
use PHPUnit\Framework\TestCase;

/**
 * Test suite for Analytics Payload Validator
 *
 * Validates that analytics payloads contain no PHI
 */
class AnalyticsPayloadValidatorTest extends TestCase
{
    private AnalyticsPayloadValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = new AnalyticsPayloadValidator();
    }

    /**
     * Test that validator passes for clean payload
     */
    public function test_passes_for_clean_payload(): void
    {
        $payload = [
            'event_name' => 'questionnaire_completed',
            'category' => 'health',
            'action' => 'submit',
            'value' => 1,
            'timestamp' => date('c')
        ];

        // Should not throw exception
        $this->validator->validateNoPHI($payload);
        $this->assertTrue(true);
    }

    /**
     * Test that validator throws exception for email in payload
     */
    public function test_throws_exception_for_email_in_payload(): void
    {
        $this->expectException(PHILeakException::class);
        $this->expectExceptionMessage("Analytics payload contains forbidden PHI key: 'email'");

        $payload = [
            'event_name' => 'questionnaire_completed',
            'email' => 'user@example.com'
        ];

        $this->validator->validateNoPHI($payload);
    }

    /**
     * Test that validator throws exception for answers in payload
     */
    public function test_throws_exception_for_answers_in_payload(): void
    {
        $this->expectException(PHILeakException::class);
        $this->expectExceptionMessage("Analytics payload contains forbidden PHI key: 'answers'");

        $payload = [
            'event_name' => 'questionnaire_completed',
            'answers' => ['question1' => 'answer1']
        ];

        $this->validator->validateNoPHI($payload);
    }

    /**
     * Test that validator detects nested PHI keys
     */
    public function test_detects_nested_phi_keys(): void
    {
        $this->expectException(PHILeakException::class);
        $this->expectExceptionMessage("Analytics payload contains nested PHI key: 'user.email'");

        $payload = [
            'event_name' => 'questionnaire_completed',
            'user' => [
                'id' => 123,
                'email' => 'user@example.com'
            ]
        ];

        $this->validator->validateNoPHI($payload);
    }

    /**
     * Test that validator detects deeply nested PHI
     */
    public function test_detects_deeply_nested_phi(): void
    {
        $this->expectException(PHILeakException::class);

        $payload = [
            'event_name' => 'questionnaire_completed',
            'metadata' => [
                'tracking' => [
                    'user_data' => [
                        'phone' => '+1234567890'
                    ]
                ]
            ]
        ];

        $this->validator->validateNoPHI($payload);
    }

    /**
     * Test that validator detects email pattern in string value
     */
    public function test_detects_email_pattern_in_value(): void
    {
        $this->expectException(PHILeakException::class);
        $this->expectExceptionMessage("email");

        $payload = [
            'event_name' => 'questionnaire_completed',
            'user_email' => 'user@example.com'
        ];

        $this->validator->validateNoPHI($payload);
    }

    /**
     * Test that validator detects phone number pattern
     */
    public function test_detects_phone_number_pattern(): void
    {
        $this->expectException(PHILeakException::class);
        $this->expectExceptionMessage("Analytics payload contains phone number pattern");

        $payload = [
            'event_name' => 'questionnaire_completed',
            'contact' => '555-123-4567'
        ];

        $this->validator->validateNoPHI($payload);
    }

    /**
     * Test that validator detects SSN pattern
     */
    public function test_detects_ssn_pattern(): void
    {
        $this->expectException(PHILeakException::class);
        $this->expectExceptionMessage("Analytics payload contains SSN pattern");

        $payload = [
            'event_name' => 'questionnaire_completed',
            'identifier' => '123-45-6789'
        ];

        $this->validator->validateNoPHI($payload);
    }

    /**
     * Test sanitizePayload removes forbidden keys
     */
    public function test_sanitize_payload_removes_forbidden_keys(): void
    {
        $payload = [
            'event_name' => 'questionnaire_completed',
            'email' => 'user@example.com',
            'phone' => '+1234567890',
            'value' => 1
        ];

        $sanitized = $this->validator->sanitizePayload($payload);

        $this->assertArrayHasKey('event_name', $sanitized);
        $this->assertArrayHasKey('value', $sanitized);
        $this->assertArrayNotHasKey('email', $sanitized);
        $this->assertArrayNotHasKey('phone', $sanitized);
    }

    /**
     * Test sanitizePayload handles nested structures
     */
    public function test_sanitize_payload_handles_nested_structures(): void
    {
        $payload = [
            'event_name' => 'questionnaire_completed',
            'user' => [
                'id' => 123,
                'email' => 'user@example.com',
                'role' => 'patient'
            ]
        ];

        $sanitized = $this->validator->sanitizePayload($payload);

        $this->assertArrayHasKey('user', $sanitized);
        $this->assertArrayHasKey('id', $sanitized['user']);
        $this->assertArrayHasKey('role', $sanitized['user']);
        $this->assertArrayNotHasKey('email', $sanitized['user']);
    }

    /**
     * Test getForbiddenKeys returns array of forbidden keys
     */
    public function test_get_forbidden_keys_returns_array(): void
    {
        $keys = AnalyticsPayloadValidator::getForbiddenKeys();

        $this->assertIsArray($keys);
        $this->assertContains('email', $keys);
        $this->assertContains('phone', $keys);
        $this->assertContains('answers', $keys);
        $this->assertContains('ssn', $keys);
    }

    /**
     * Test getAllowedKeys returns array of allowed keys
     */
    public function test_get_allowed_keys_returns_array(): void
    {
        $keys = AnalyticsPayloadValidator::getAllowedKeys();

        $this->assertIsArray($keys);
        $this->assertContains('event_name', $keys);
        $this->assertContains('category', $keys);
        $this->assertContains('timestamp', $keys);
    }

    /**
     * Test that validator allows all approved analytics keys
     */
    public function test_allows_all_approved_analytics_keys(): void
    {
        $payload = [
            'event_name' => 'form_submit',
            'event_type' => 'interaction',
            'category' => 'questionnaire',
            'action' => 'complete',
            'label' => 'health_screening',
            'value' => 1,
            'timestamp' => date('c'),
            'page_url' => '/questionnaire',
            'page_title' => 'Health Questionnaire',
            'completion_status' => 'completed',
            'step_count' => 5,
            'duration_seconds' => 120,
            'anonymized_user_id' => hash('sha256', '123')
        ];

        // Should not throw exception
        $this->validator->validateNoPHI($payload);
        $this->assertTrue(true);
    }

    /**
     * Test that validator throws for address fields
     */
    public function test_throws_for_address_fields(): void
    {
        $this->expectException(PHILeakException::class);

        $payload = [
            'event_name' => 'form_submit',
            'address' => '123 Main St'
        ];

        $this->validator->validateNoPHI($payload);
    }

    /**
     * Test that validator throws for medical data
     */
    public function test_throws_for_medical_data(): void
    {
        $this->expectException(PHILeakException::class);

        $payload = [
            'event_name' => 'form_submit',
            'diagnosis' => 'hypertension'
        ];

        $this->validator->validateNoPHI($payload);
    }
}
