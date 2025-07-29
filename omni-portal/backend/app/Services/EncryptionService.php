<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class EncryptionService
{
    protected $encryptionKey;
    protected $cipher;

    public function __construct()
    {
        $this->encryptionKey = config('video.hipaa.encryption_key', config('app.key'));
        $this->cipher = config('app.cipher', 'AES-256-CBC');
    }

    /**
     * Encrypt data with additional metadata
     */
    public function encrypt($data): string
    {
        try {
            $payload = [
                'data' => $data,
                'timestamp' => now()->toIso8601String(),
                'nonce' => Str::random(32),
            ];

            return Crypt::encryptString(json_encode($payload));
        } catch (\Exception $e) {
            Log::error('Encryption failed: ' . $e->getMessage());
            throw new \Exception('Failed to encrypt data');
        }
    }

    /**
     * Decrypt data and verify integrity
     */
    public function decrypt(string $encryptedData): mixed
    {
        try {
            $decrypted = Crypt::decryptString($encryptedData);
            $payload = json_decode($decrypted, true);

            if (!isset($payload['data']) || !isset($payload['timestamp'])) {
                throw new \Exception('Invalid encrypted payload');
            }

            return $payload['data'];
        } catch (\Exception $e) {
            Log::error('Decryption failed: ' . $e->getMessage());
            throw new \Exception('Failed to decrypt data');
        }
    }

    /**
     * Generate encryption key for specific use
     */
    public function generateKey(string $purpose = 'general'): string
    {
        return base64_encode(hash_hmac('sha256', $purpose . time(), $this->encryptionKey, true));
    }

    /**
     * Encrypt file contents
     */
    public function encryptFile(string $filePath): string
    {
        $contents = file_get_contents($filePath);
        if ($contents === false) {
            throw new \Exception('Failed to read file');
        }

        return $this->encrypt($contents);
    }

    /**
     * Decrypt to file
     */
    public function decryptToFile(string $encryptedData, string $outputPath): bool
    {
        $decrypted = $this->decrypt($encryptedData);
        return file_put_contents($outputPath, $decrypted) !== false;
    }

    /**
     * Hash data for integrity verification
     */
    public function hash(string $data): string
    {
        return hash_hmac('sha256', $data, $this->encryptionKey);
    }

    /**
     * Verify data integrity
     */
    public function verifyHash(string $data, string $hash): bool
    {
        return hash_equals($this->hash($data), $hash);
    }
}
