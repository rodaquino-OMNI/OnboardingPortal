<?php

namespace App\Traits;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Log;

/**
 * EncryptsAttributes Trait
 *
 * Provides automatic encryption/decryption of sensitive model attributes
 * and hash generation for searchable encrypted fields.
 *
 * Implements ADR-004: Field-Level Encryption for PHI/PII
 *
 * Usage in Model:
 * ```php
 * use App\Traits\EncryptsAttributes;
 *
 * class User extends Model {
 *     use EncryptsAttributes;
 *
 *     protected $encrypted = ['cpf', 'phone', 'address'];
 *     protected $hashed = ['cpf' => 'cpf_hash', 'phone' => 'phone_hash'];
 * }
 * ```
 *
 * Features:
 * - Automatic encryption on setAttribute
 * - Automatic decryption on getAttribute
 * - SHA-256 hash generation for searchable fields
 * - Graceful error handling with audit logging
 * - AES-256-GCM encryption via Laravel Crypt facade
 *
 * @package App\Traits
 * @see docs/phase8/ENCRYPTION_POLICY.md
 */
trait EncryptsAttributes
{
    /**
     * Boot the trait
     *
     * Registers model event listeners for encryption
     *
     * @return void
     */
    protected static function bootEncryptsAttributes(): void
    {
        // Before saving, ensure all encrypted fields are properly encrypted
        static::saving(function ($model) {
            $model->encryptAttributesBeforeSave();
        });
    }

    /**
     * Get the list of encrypted attributes
     *
     * @return array
     */
    public function getEncryptedAttributes(): array
    {
        return property_exists($this, 'encrypted') ? $this->encrypted : [];
    }

    /**
     * Get the hash column mappings
     *
     * @return array
     */
    public function getHashedAttributes(): array
    {
        return property_exists($this, 'hashed') ? $this->hashed : [];
    }

    /**
     * Determine if an attribute should be encrypted
     *
     * @param string $key
     * @return bool
     */
    public function shouldEncrypt(string $key): bool
    {
        return in_array($key, $this->getEncryptedAttributes(), true);
    }

    /**
     * Determine if an attribute has a hash column
     *
     * @param string $key
     * @return bool
     */
    public function shouldHash(string $key): bool
    {
        return isset($this->getHashedAttributes()[$key]);
    }

    /**
     * Get hash column name for an attribute
     *
     * @param string $key
     * @return string|null
     */
    public function getHashColumn(string $key): ?string
    {
        return $this->getHashedAttributes()[$key] ?? null;
    }

    /**
     * Override setAttribute to encrypt values
     *
     * Automatically encrypts values for fields in $encrypted array
     * and generates SHA-256 hashes for fields in $hashed array
     *
     * @param string $key
     * @param mixed $value
     * @return mixed
     */
    public function setAttribute($key, $value)
    {
        // Handle encrypted attributes
        if ($this->shouldEncrypt($key) && !is_null($value)) {
            // Store original value for hash generation
            $originalValue = $value;

            // Encrypt the value
            $value = $this->encryptAttribute($key, $value);

            // Generate hash if needed
            if ($this->shouldHash($key)) {
                $hashColumn = $this->getHashColumn($key);
                parent::setAttribute($hashColumn, $this->generateHash($originalValue));
            }

            // Log sensitive field mutation (audit)
            $this->logSensitiveFieldMutation($key);
        }

        return parent::setAttribute($key, $value);
    }

    /**
     * Override getAttribute to decrypt values
     *
     * Automatically decrypts values for fields in $encrypted array
     *
     * @param string $key
     * @return mixed
     */
    public function getAttribute($key)
    {
        $value = parent::getAttribute($key);

        // Handle encrypted attributes
        if ($this->shouldEncrypt($key) && !is_null($value)) {
            $value = $this->decryptAttribute($key, $value);

            // Log sensitive field access (audit)
            $this->logSensitiveFieldAccess($key);
        }

        return $value;
    }

    /**
     * Encrypt an attribute value
     *
     * Uses Laravel Crypt facade with AES-256-GCM
     *
     * @param string $key
     * @param mixed $value
     * @return string
     */
    protected function encryptAttribute(string $key, $value): string
    {
        try {
            // Convert to string if needed (e.g., JSON for arrays)
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value);
            }

            return Crypt::encryptString((string) $value);
        } catch (\Exception $e) {
            Log::error('Field encryption failed', [
                'model' => static::class,
                'attribute' => $key,
                'error' => $e->getMessage(),
            ]);

            throw new \RuntimeException("Failed to encrypt attribute: {$key}");
        }
    }

    /**
     * Decrypt an attribute value
     *
     * Uses Laravel Crypt facade with AES-256-GCM
     *
     * @param string $key
     * @param string $value
     * @return mixed
     */
    protected function decryptAttribute(string $key, string $value)
    {
        try {
            $decrypted = Crypt::decryptString($value);

            // Try to decode JSON if applicable
            $decoded = json_decode($decrypted, true);
            return json_last_error() === JSON_ERROR_NONE ? $decoded : $decrypted;
        } catch (DecryptException $e) {
            Log::error('Field decryption failed', [
                'model' => static::class,
                'attribute' => $key,
                'error' => $e->getMessage(),
            ]);

            // Return null on decryption failure (graceful degradation)
            return null;
        }
    }

    /**
     * Generate SHA-256 hash for searchable field
     *
     * Used for unique lookups on encrypted fields without decryption
     *
     * @param mixed $value
     * @return string
     */
    protected function generateHash($value): string
    {
        // Normalize value to string
        if (is_array($value) || is_object($value)) {
            $value = json_encode($value);
        }

        return hash('sha256', (string) $value);
    }

    /**
     * Encrypt all encrypted attributes before save
     *
     * Ensures consistency across all encrypted fields
     *
     * @return void
     */
    protected function encryptAttributesBeforeSave(): void
    {
        foreach ($this->getEncryptedAttributes() as $attribute) {
            if (isset($this->attributes[$attribute]) && !is_null($this->attributes[$attribute])) {
                // Re-encrypt to ensure consistency
                $originalValue = $this->getOriginal($attribute);
                $currentValue = $this->attributes[$attribute];

                // Only re-encrypt if value changed
                if ($originalValue !== $currentValue) {
                    $this->setAttribute($attribute, $currentValue);
                }
            }
        }
    }

    /**
     * Find model by encrypted field using hash lookup
     *
     * Example: User::findByEncrypted('cpf', '12345678900')
     *
     * @param string $field
     * @param mixed $value
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    public static function findByEncrypted(string $field, $value)
    {
        $instance = new static;

        if (!$instance->shouldHash($field)) {
            throw new \InvalidArgumentException("Field {$field} does not have a hash column");
        }

        $hashColumn = $instance->getHashColumn($field);
        $hash = $instance->generateHash($value);

        return static::where($hashColumn, $hash)->first();
    }

    /**
     * Scope query by encrypted field using hash lookup
     *
     * Example: User::whereEncrypted('phone', '11999999999')->get()
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $field
     * @param mixed $value
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeWhereEncrypted($query, string $field, $value)
    {
        if (!$this->shouldHash($field)) {
            throw new \InvalidArgumentException("Field {$field} does not have a hash column");
        }

        $hashColumn = $this->getHashColumn($field);
        $hash = $this->generateHash($value);

        return $query->where($hashColumn, $hash);
    }

    /**
     * Log sensitive field access for audit
     *
     * Records WHO accessed WHAT field WHEN
     *
     * @param string $key
     * @return void
     */
    protected function logSensitiveFieldAccess(string $key): void
    {
        // Only log in production or when audit logging is enabled
        if (!config('app.audit_sensitive_access', false)) {
            return;
        }

        // Use audit channel to avoid cluttering main logs
        Log::channel('audit')->info('Sensitive field accessed', [
            'model' => static::class,
            'model_id' => $this->getKey(),
            'field' => $key,
            'user_id' => auth()->id(),
            'ip_address' => request()->ip(),
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Log sensitive field mutation for audit
     *
     * Records WHO modified WHAT field WHEN
     *
     * @param string $key
     * @return void
     */
    protected function logSensitiveFieldMutation(string $key): void
    {
        // Only log in production or when audit logging is enabled
        if (!config('app.audit_sensitive_access', false)) {
            return;
        }

        Log::channel('audit')->info('Sensitive field modified', [
            'model' => static::class,
            'model_id' => $this->getKey(),
            'field' => $key,
            'user_id' => auth()->id(),
            'ip_address' => request()->ip(),
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
