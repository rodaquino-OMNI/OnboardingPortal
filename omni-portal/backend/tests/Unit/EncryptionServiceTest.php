<?php

namespace Tests\Unit;

use App\Services\EncryptionService;
use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Encryption Service Test Suite
 *
 * Validates ADR-004 encryption implementation with comprehensive tests:
 * - AES-256-GCM encryption/decryption cycles
 * - SHA-256 hash generation for searchable lookups
 * - Null handling and edge cases
 * - Data integrity verification
 * - Performance benchmarks
 *
 * Test Coverage:
 * - encryptPHI() - Encryption functionality
 * - decryptPHI() - Decryption functionality
 * - hashForLookup() - Hash generation
 * - encryptAndHash() - Combined operations
 * - verify() - Encryption validation
 * - verifyHash() - Hash validation
 * - batchEncrypt() - Batch operations
 * - batchDecrypt() - Batch decryption
 *
 * @package Tests\Unit
 */
class EncryptionServiceTest extends TestCase
{
    private EncryptionService $encryptionService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->encryptionService = new EncryptionService();
    }

    /**
     * Test: Encrypt and decrypt string value
     *
     * @test
     */
    public function it_encrypts_and_decrypts_string_value(): void
    {
        $plaintext = '123.456.789-01';

        $encrypted = $this->encryptionService->encryptPHI($plaintext);
        $this->assertNotNull($encrypted);
        $this->assertNotEquals($plaintext, $encrypted);
        $this->assertTrue(strlen($encrypted) > 50); // Encrypted should be longer

        $decrypted = $this->encryptionService->decryptPHI($encrypted);
        $this->assertEquals($plaintext, $decrypted);
    }

    /**
     * Test: Encrypt and decrypt array value
     *
     * @test
     */
    public function it_encrypts_and_decrypts_array_value(): void
    {
        $plaintext = [
            'street' => 'Rua das Flores',
            'number' => 123,
            'city' => 'São Paulo',
        ];

        $encrypted = $this->encryptionService->encryptPHI($plaintext);
        $this->assertNotNull($encrypted);
        $this->assertIsString($encrypted);

        $decrypted = $this->encryptionService->decryptPHI($encrypted);
        $this->assertEquals($plaintext, $decrypted);
    }

    /**
     * Test: Handle null values gracefully
     *
     * @test
     */
    public function it_handles_null_values_gracefully(): void
    {
        $encrypted = $this->encryptionService->encryptPHI(null);
        $this->assertNull($encrypted);

        $decrypted = $this->encryptionService->decryptPHI(null);
        $this->assertNull($decrypted);
    }

    /**
     * Test: Handle empty string values
     *
     * @test
     */
    public function it_handles_empty_string_values(): void
    {
        $encrypted = $this->encryptionService->encryptPHI('');
        $this->assertNull($encrypted);

        $decrypted = $this->encryptionService->decryptPHI('');
        $this->assertNull($decrypted);
    }

    /**
     * Test: Generate SHA-256 hash for lookup
     *
     * @test
     */
    public function it_generates_sha256_hash_for_lookup(): void
    {
        $value = '123.456.789-01';

        $hash = $this->encryptionService->hashForLookup($value);
        $this->assertNotNull($hash);
        $this->assertEquals(64, strlen($hash)); // SHA-256 = 64 hex characters
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $hash);

        // Same input should produce same hash (deterministic)
        $hash2 = $this->encryptionService->hashForLookup($value);
        $this->assertEquals($hash, $hash2);

        // Different input should produce different hash
        $hash3 = $this->encryptionService->hashForLookup('987.654.321-09');
        $this->assertNotEquals($hash, $hash3);
    }

    /**
     * Test: Hash null values return null
     *
     * @test
     */
    public function it_returns_null_hash_for_null_value(): void
    {
        $hash = $this->encryptionService->hashForLookup(null);
        $this->assertNull($hash);

        $hash = $this->encryptionService->hashForLookup('');
        $this->assertNull($hash);
    }

    /**
     * Test: Encrypt and hash combined operation
     *
     * @test
     */
    public function it_encrypts_and_hashes_in_one_operation(): void
    {
        $value = '(11) 98765-4321';

        $result = $this->encryptionService->encryptAndHash($value);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('encrypted', $result);
        $this->assertArrayHasKey('hash', $result);
        $this->assertNotNull($result['encrypted']);
        $this->assertNotNull($result['hash']);
        $this->assertEquals(64, strlen($result['hash']));

        // Verify encrypted value can be decrypted
        $decrypted = $this->encryptionService->decryptPHI($result['encrypted']);
        $this->assertEquals($value, $decrypted);

        // Verify hash matches
        $expectedHash = $this->encryptionService->hashForLookup($value);
        $this->assertEquals($expectedHash, $result['hash']);
    }

    /**
     * Test: Verify plaintext matches encrypted value
     *
     * @test
     */
    public function it_verifies_plaintext_matches_encrypted(): void
    {
        $plaintext = 'sensitive-data-123';
        $encrypted = $this->encryptionService->encryptPHI($plaintext);

        $this->assertTrue($this->encryptionService->verify($plaintext, $encrypted));
        $this->assertFalse($this->encryptionService->verify('wrong-data', $encrypted));
    }

    /**
     * Test: Verify hash matches plaintext value
     *
     * @test
     */
    public function it_verifies_hash_matches_plaintext(): void
    {
        $plaintext = '123.456.789-01';
        $hash = $this->encryptionService->hashForLookup($plaintext);

        $this->assertTrue($this->encryptionService->verifyHash($plaintext, $hash));
        $this->assertFalse($this->encryptionService->verifyHash('987.654.321-09', $hash));
    }

    /**
     * Test: Batch encrypt multiple fields
     *
     * @test
     */
    public function it_batch_encrypts_multiple_fields(): void
    {
        $data = [
            'cpf' => '123.456.789-01',
            'phone' => '(11) 98765-4321',
            'address' => 'Rua das Flores, 123',
            'email' => 'test@example.com', // Not encrypted
        ];

        $encrypted = $this->encryptionService->batchEncrypt($data, ['cpf', 'phone', 'address']);

        // Check encrypted fields
        $this->assertNotEquals($data['cpf'], $encrypted['cpf']);
        $this->assertNotEquals($data['phone'], $encrypted['phone']);
        $this->assertNotEquals($data['address'], $encrypted['address']);

        // Check hash columns added
        $this->assertArrayHasKey('cpf_hash', $encrypted);
        $this->assertArrayHasKey('phone_hash', $encrypted);
        $this->assertArrayHasKey('address_hash', $encrypted);

        // Check non-encrypted field unchanged
        $this->assertEquals($data['email'], $encrypted['email']);

        // Verify hashes
        $this->assertEquals(
            $this->encryptionService->hashForLookup($data['cpf']),
            $encrypted['cpf_hash']
        );
    }

    /**
     * Test: Batch decrypt multiple fields
     *
     * @test
     */
    public function it_batch_decrypts_multiple_fields(): void
    {
        $data = [
            'cpf' => '123.456.789-01',
            'phone' => '(11) 98765-4321',
            'address' => 'Rua das Flores, 123',
        ];

        $encrypted = $this->encryptionService->batchEncrypt($data, ['cpf', 'phone', 'address']);
        $decrypted = $this->encryptionService->batchDecrypt($encrypted, ['cpf', 'phone', 'address']);

        $this->assertEquals($data['cpf'], $decrypted['cpf']);
        $this->assertEquals($data['phone'], $decrypted['phone']);
        $this->assertEquals($data['address'], $decrypted['address']);
    }

    /**
     * Test: Each encryption produces unique ciphertext (random IV)
     *
     * @test
     */
    public function it_produces_unique_ciphertext_for_same_plaintext(): void
    {
        $plaintext = 'same-value';

        $encrypted1 = $this->encryptionService->encryptPHI($plaintext);
        $encrypted2 = $this->encryptionService->encryptPHI($plaintext);

        // Ciphertext should be different (random IV)
        $this->assertNotEquals($encrypted1, $encrypted2);

        // But both should decrypt to same plaintext
        $this->assertEquals($plaintext, $this->encryptionService->decryptPHI($encrypted1));
        $this->assertEquals($plaintext, $this->encryptionService->decryptPHI($encrypted2));
    }

    /**
     * Test: Hash is deterministic (same input = same hash)
     *
     * @test
     */
    public function it_produces_deterministic_hash(): void
    {
        $plaintext = 'deterministic-value';

        $hash1 = $this->encryptionService->hashForLookup($plaintext);
        $hash2 = $this->encryptionService->hashForLookup($plaintext);

        $this->assertEquals($hash1, $hash2);
    }

    /**
     * Test: Encryption of special characters
     *
     * @test
     */
    public function it_handles_special_characters(): void
    {
        $plaintext = 'Ação José & María: "test" <tag>';

        $encrypted = $this->encryptionService->encryptPHI($plaintext);
        $decrypted = $this->encryptionService->decryptPHI($encrypted);

        $this->assertEquals($plaintext, $decrypted);
    }

    /**
     * Test: Encryption of large strings
     *
     * @test
     */
    public function it_handles_large_strings(): void
    {
        $plaintext = str_repeat('Large Data ', 1000); // ~11KB

        $encrypted = $this->encryptionService->encryptPHI($plaintext);
        $decrypted = $this->encryptionService->decryptPHI($encrypted);

        $this->assertEquals($plaintext, $decrypted);
    }

    /**
     * Test: Invalid encrypted data returns null gracefully
     *
     * @test
     */
    public function it_returns_null_for_invalid_encrypted_data(): void
    {
        $result = $this->encryptionService->decryptPHI('invalid-encrypted-data');
        $this->assertNull($result);
    }

    /**
     * Test: Performance - encrypt 100 values
     *
     * @test
     */
    public function it_performs_encryption_efficiently(): void
    {
        $startTime = microtime(true);

        for ($i = 0; $i < 100; $i++) {
            $this->encryptionService->encryptPHI("test-value-{$i}");
        }

        $duration = microtime(true) - $startTime;

        // Should complete 100 encryptions in under 1 second
        $this->assertLessThan(1.0, $duration);
    }
}
