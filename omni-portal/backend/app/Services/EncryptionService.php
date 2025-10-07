<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Log;

/**
 * EncryptionService
 *
 * Standalone service for PHI/PII encryption operations
 * Implements ADR-004: Field-Level Encryption
 *
 * Features:
 * - AES-256-GCM encryption via Laravel Crypt
 * - SHA-256 hashing for searchable encrypted fields
 * - Error handling and audit logging
 * - Null-safe operations
 *
 * Usage:
 * ```php
 * $encrypted = app(EncryptionService::class)->encryptPHI($cpf);
 * $hash = app(EncryptionService::class)->hashForLookup($cpf);
 * $decrypted = app(EncryptionService::class)->decryptPHI($encrypted);
 * ```
 *
 * @package App\Services
 * @see docs/phase8/ENCRYPTION_POLICY.md
 */
class EncryptionService
{
    /**
     * Encrypt PHI/PII data using AES-256-GCM
     *
     * Uses Laravel's Crypt facade which provides:
     * - AES-256-GCM encryption
     * - Authenticated encryption (prevents tampering)
     * - Random IV for each encryption
     * - APP_KEY as encryption key
     *
     * @param mixed $value Value to encrypt (string, array, object)
     * @return string|null Encrypted string or null if value is null
     * @throws \RuntimeException If encryption fails
     */
    public function encryptPHI($value): ?string
    {
        if (is_null($value) || $value === '') {
            return null;
        }

        try {
            // Convert arrays/objects to JSON
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value);
            }

            return Crypt::encryptString((string) $value);
        } catch (\Exception $e) {
            Log::error('PHI encryption failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw new \RuntimeException('Failed to encrypt PHI data: ' . $e->getMessage());
        }
    }

    /**
     * Decrypt PHI/PII data using AES-256-GCM
     *
     * Performs authenticated decryption with integrity verification
     *
     * @param string|null $encrypted Encrypted value
     * @return mixed Decrypted value (string, array, or object)
     * @throws \RuntimeException If decryption fails (tampered data)
     */
    public function decryptPHI(?string $encrypted)
    {
        if (is_null($encrypted) || $encrypted === '') {
            return null;
        }

        try {
            $decrypted = Crypt::decryptString($encrypted);

            // Attempt JSON decode for arrays/objects
            $decoded = json_decode($decrypted, true);
            return json_last_error() === JSON_ERROR_NONE ? $decoded : $decrypted;
        } catch (DecryptException $e) {
            Log::error('PHI decryption failed - possible data tampering', [
                'error' => $e->getMessage(),
                'encrypted_length' => strlen($encrypted),
            ]);

            // Return null for graceful degradation
            // In production, you may want to trigger alerts for tampered data
            return null;
        }
    }

    /**
     * Generate SHA-256 hash for searchable encrypted field lookups
     *
     * Creates a deterministic hash that allows searching encrypted fields
     * without decryption. Same input always produces same hash.
     *
     * Example use cases:
     * - Find user by CPF: WHERE cpf_hash = hashForLookup($cpf)
     * - Check phone uniqueness: WHERE phone_hash = hashForLookup($phone)
     *
     * @param mixed $value Value to hash
     * @return string|null SHA-256 hash (64 hex characters) or null if value is null
     */
    public function hashForLookup($value): ?string
    {
        if (is_null($value) || $value === '') {
            return null;
        }

        // Normalize value to string
        if (is_array($value) || is_object($value)) {
            $value = json_encode($value);
        }

        return hash('sha256', (string) $value);
    }

    /**
     * Encrypt and hash a PHI field in one operation
     *
     * Returns both encrypted value and hash for database storage
     *
     * @param mixed $value Value to encrypt and hash
     * @return array ['encrypted' => string, 'hash' => string]
     */
    public function encryptAndHash($value): array
    {
        return [
            'encrypted' => $this->encryptPHI($value),
            'hash' => $this->hashForLookup($value),
        ];
    }

    /**
     * Verify that a plaintext value matches an encrypted value
     *
     * Useful for migration validation
     *
     * @param mixed $plaintext Original plaintext value
     * @param string $encrypted Encrypted value to verify
     * @return bool True if plaintext matches decrypted value
     */
    public function verify($plaintext, string $encrypted): bool
    {
        $decrypted = $this->decryptPHI($encrypted);
        return $plaintext === $decrypted;
    }

    /**
     * Verify that a hash matches a plaintext value
     *
     * Useful for lookup validation
     *
     * @param mixed $plaintext Original plaintext value
     * @param string $hash Hash to verify
     * @return bool True if hash matches
     */
    public function verifyHash($plaintext, string $hash): bool
    {
        return $this->hashForLookup($plaintext) === $hash;
    }

    /**
     * Batch encrypt multiple PHI fields
     *
     * @param array $data Associative array of field => value
     * @param array $fieldsToEncrypt List of field names to encrypt
     * @return array Encrypted data with hash columns added
     */
    public function batchEncrypt(array $data, array $fieldsToEncrypt): array
    {
        $encrypted = $data;

        foreach ($fieldsToEncrypt as $field) {
            if (isset($data[$field])) {
                $result = $this->encryptAndHash($data[$field]);
                $encrypted[$field] = $result['encrypted'];
                $encrypted[$field . '_hash'] = $result['hash'];
            }
        }

        return $encrypted;
    }

    /**
     * Batch decrypt multiple PHI fields
     *
     * @param array $data Encrypted data
     * @param array $fieldsToDecrypt List of field names to decrypt
     * @return array Decrypted data
     */
    public function batchDecrypt(array $data, array $fieldsToDecrypt): array
    {
        $decrypted = $data;

        foreach ($fieldsToDecrypt as $field) {
            if (isset($data[$field])) {
                $decrypted[$field] = $this->decryptPHI($data[$field]);
            }
        }

        return $decrypted;
    }
}
