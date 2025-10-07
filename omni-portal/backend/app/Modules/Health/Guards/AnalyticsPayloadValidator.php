<?php

namespace App\Modules\Health\Guards;

use App\Modules\Health\Exceptions\PHILeakException;

/**
 * Analytics Payload Validator
 *
 * Validates that analytics events contain NO Protected Health Information (PHI).
 * Prevents accidental PHI transmission to analytics platforms (Google Analytics, Mixpanel, etc.)
 *
 * HIPAA Compliance: 45 CFR § 164.502(d)(2) - Minimum Necessary Standard
 *
 * Usage:
 * ```php
 * $validator = new AnalyticsPayloadValidator();
 * $validator->validateNoPHI($analyticsPayload);
 * ```
 *
 * @throws PHILeakException When PHI is detected in payload
 */
class AnalyticsPayloadValidator
{
    /**
     * List of forbidden keys that may contain PHI
     *
     * These keys should NEVER appear in analytics payloads
     */
    private const FORBIDDEN_KEYS = [
        // Direct PHI identifiers
        'answers',
        'response_data',
        'email',
        'phone',
        'name',
        'first_name',
        'last_name',
        'patient_name',
        'dob',
        'date_of_birth',
        'ssn',
        'social_security',
        'mrn',
        'medical_record_number',

        // Encrypted PHI (still forbidden in analytics)
        'answers_encrypted_json',
        'answers_hash',
        'encrypted_data',

        // Address components (PHI under HIPAA)
        'address',
        'street',
        'city',
        'zip',
        'postal_code',
        'coordinates',
        'latitude',
        'longitude',

        // Additional identifiers
        'ip_address',
        'device_id',
        'fingerprint',
        'session_id', // Can be used to re-identify

        // Medical data
        'diagnosis',
        'condition',
        'medication',
        'treatment',
        'symptoms',
        'test_results',
        'lab_results',
        'prescription'
    ];

    /**
     * List of allowed aggregate/de-identified keys
     */
    private const ALLOWED_KEYS = [
        'event_name',
        'event_type',
        'category',
        'action',
        'label',
        'value',
        'timestamp',
        'page_url',
        'page_title',
        'user_agent',
        'screen_resolution',
        'language',
        'timezone',
        'completion_status',
        'step_count',
        'duration_seconds',
        'anonymized_user_id', // Hash of user ID
        'cohort',
        'segment'
    ];

    /**
     * Validate that payload contains no PHI
     *
     * @param array $payload Analytics event payload
     * @return void
     * @throws PHILeakException When PHI is detected
     */
    public function validateNoPHI(array $payload): void
    {
        // Check top-level keys
        foreach (self::FORBIDDEN_KEYS as $forbiddenKey) {
            if (array_key_exists($forbiddenKey, $payload)) {
                throw new PHILeakException(
                    "Analytics payload contains forbidden PHI key: '{$forbiddenKey}'. " .
                    "Remove this field or use anonymized/aggregated data instead."
                );
            }
        }

        // Recursive check for nested arrays/objects
        $this->validateNestedStructure($payload, []);

        // Validate string values don't contain PII patterns
        $this->validateValuePatterns($payload);

        // Log successful validation
        if (function_exists('logger')) {
            logger()->info('ANALYTICS_PHI_VALIDATION_PASSED', [
                'payload_keys' => array_keys($payload),
                'timestamp' => date('c')
            ]);
        }
    }

    /**
     * Recursively validate nested structures
     *
     * @param array $data Data structure to validate
     * @param array $path Current path for error reporting
     * @return void
     * @throws PHILeakException
     */
    private function validateNestedStructure(array $data, array $path): void
    {
        foreach ($data as $key => $value) {
            $currentPath = array_merge($path, [$key]);

            // Check if key is forbidden
            if (in_array($key, self::FORBIDDEN_KEYS)) {
                throw new PHILeakException(
                    "Analytics payload contains nested PHI key: '" . implode('.', $currentPath) . "'. " .
                    "This field must be removed from analytics data."
                );
            }

            // Recursively check nested arrays
            if (is_array($value)) {
                $this->validateNestedStructure($value, $currentPath);
            }
        }
    }

    /**
     * Validate string values don't contain PII patterns
     *
     * @param array $payload Payload to validate
     * @return void
     * @throws PHILeakException
     */
    private function validateValuePatterns(array $payload): void
    {
        array_walk_recursive($payload, function ($value, $key) {
            if (!is_string($value)) {
                return;
            }

            // Check for email patterns
            if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
                throw new PHILeakException(
                    "Analytics payload contains email address in field '{$key}': " .
                    substr($value, 0, 3) . "***. Emails are PHI and must not be tracked."
                );
            }

            // Check for phone number patterns (basic US format)
            if (preg_match('/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/', $value)) {
                throw new PHILeakException(
                    "Analytics payload contains phone number pattern in field '{$key}'. " .
                    "Phone numbers are PHI and must not be tracked."
                );
            }

            // Check for SSN patterns
            if (preg_match('/\b\d{3}-\d{2}-\d{4}\b/', $value)) {
                throw new PHILeakException(
                    "Analytics payload contains SSN pattern in field '{$key}'. " .
                    "SSNs are PHI and must never be tracked."
                );
            }
        });
    }

    /**
     * Sanitize payload by removing forbidden keys
     *
     * Use this method to automatically clean payloads instead of throwing exceptions
     *
     * @param array $payload Original payload
     * @return array Sanitized payload
     */
    public function sanitizePayload(array $payload): array
    {
        $sanitized = [];

        foreach ($payload as $key => $value) {
            // Skip forbidden keys
            if (in_array($key, self::FORBIDDEN_KEYS)) {
                if (function_exists('logger')) {
                    logger()->warning('ANALYTICS_PHI_KEY_REMOVED', [
                        'key' => $key,
                        'timestamp' => date('c')
                    ]);
                }
                continue;
            }

            // Recursively sanitize nested arrays
            if (is_array($value)) {
                $sanitized[$key] = $this->sanitizePayload($value);
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }

    /**
     * Get list of forbidden keys
     *
     * @return array
     */
    public static function getForbiddenKeys(): array
    {
        return self::FORBIDDEN_KEYS;
    }

    /**
     * Get list of allowed keys
     *
     * @return array
     */
    public static function getAllowedKeys(): array
    {
        return self::ALLOWED_KEYS;
    }
}
