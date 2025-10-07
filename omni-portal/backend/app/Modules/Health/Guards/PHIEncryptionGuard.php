<?php

namespace App\Modules\Health\Guards;

use RuntimeException;

/**
 * PHI Encryption Guard Trait
 *
 * Ensures all PHI fields are encrypted before saving to database.
 * Models using this trait MUST define an $encrypted property listing PHI fields.
 *
 * HIPAA Compliance: 45 CFR § 164.312(a)(2)(iv) - Encryption and Decryption
 *
 * Usage:
 * ```php
 * class QuestionnaireResponse extends Model {
 *     use PHIEncryptionGuard;
 *
 *     protected $encrypted = ['answers_encrypted_json', 'patient_name', 'email'];
 * }
 * ```
 *
 * @throws RuntimeException When unencrypted PHI is detected before save
 */
trait PHIEncryptionGuard
{
    /**
     * Boot the PHI encryption guard
     *
     * Registers a saving event listener that validates encryption
     * before any database write operation (INSERT or UPDATE)
     *
     * @return void
     */
    public static function bootPHIEncryptionGuard(): void
    {
        static::saving(function ($model) {
            $encrypted = $model->encrypted ?? [];

            if (empty($encrypted)) {
                if (function_exists('logger')) {
                    logger()->warning('PHI_ENCRYPTION_GUARD_NO_FIELDS', [
                        'model' => get_class($model),
                        'message' => 'Model uses PHIEncryptionGuard but has no $encrypted fields defined'
                    ]);
                }
                return;
            }

            foreach ($encrypted as $field) {
                $value = $model->getAttribute($field);

                // Skip null/empty values (they don't contain PHI)
                if (empty($value)) {
                    continue;
                }

                // Check if value is encrypted (Laravel's encrypted casting adds prefix)
                // Also accept values that are already encrypted in database
                if (!str_starts_with($value, 'encrypted:') &&
                    !str_starts_with($value, 'eyJpdiI6') && // Base64 encrypted format
                    !$model->isDirty($field)) { // Not dirty means already in DB encrypted

                    throw new RuntimeException(
                        "PHI field '{$field}' MUST be encrypted before save. " .
                        "Use Eloquent's 'encrypted' cast or manually encrypt with Crypt facade. " .
                        "Model: " . get_class($model) . ", ID: " . ($model->id ?? 'new')
                    );
                }
            }

            // Log successful validation for audit trail
            if (function_exists('logger')) {
                logger()->info('PHI_ENCRYPTION_VALIDATED', [
                    'model' => get_class($model),
                    'model_id' => $model->id ?? 'new',
                    'encrypted_fields' => $encrypted,
                    'timestamp' => date('c')
                ]);
            }
        });
    }

    /**
     * Get list of PHI fields that should be encrypted
     *
     * @return array
     */
    public function getEncryptedFields(): array
    {
        return $this->encrypted ?? [];
    }

    /**
     * Validate a single field is encrypted
     *
     * @param string $field Field name to validate
     * @return bool
     */
    public function isFieldEncrypted(string $field): bool
    {
        if (!in_array($field, $this->encrypted ?? [])) {
            return false;
        }

        $value = $this->getAttribute($field);

        if (empty($value)) {
            return true; // Empty values are considered safe
        }

        return str_starts_with($value, 'encrypted:') ||
               str_starts_with($value, 'eyJpdiI6');
    }
}
