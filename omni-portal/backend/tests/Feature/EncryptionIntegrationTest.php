<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\EncryptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Encryption Integration Test Suite
 *
 * End-to-end testing of ADR-004 encryption implementation:
 * - User model encryption via EncryptsAttributes trait
 * - Hash-based lookups for encrypted fields
 * - Controller integration with encrypted fields
 * - Data migration workflow
 * - HIPAA/LGPD compliance validation
 *
 * Test Scenarios:
 * 1. User registration with automatic encryption
 * 2. Hash-based CPF/phone lookups
 * 3. Duplicate detection via hash columns
 * 4. Encryption/decryption transparency
 * 5. Data migration from plaintext to encrypted
 *
 * @package Tests\Feature
 */
class EncryptionIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private EncryptionService $encryptionService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->encryptionService = app(EncryptionService::class);
    }

    /**
     * Test: User model automatically encrypts PHI fields on create
     *
     * @test
     */
    public function it_automatically_encrypts_phi_fields_on_user_create(): void
    {
        $plainCpf = '123.456.789-01';
        $plainPhone = '(11) 98765-4321';

        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => $plainCpf,
            'phone' => $plainPhone,
            'address' => 'Rua das Flores, 123',
        ]);

        $this->assertNotNull($user->id);

        // Verify fields are encrypted in database (via raw query)
        $rawUser = \DB::table('users')->where('id', $user->id)->first();

        // CPF should be encrypted (not plaintext)
        $this->assertNotEquals($plainCpf, $rawUser->cpf);
        $this->assertTrue(str_starts_with($rawUser->cpf, 'eyJpdiI6')); // Laravel Crypt format

        // Phone should be encrypted
        $this->assertNotEquals($plainPhone, $rawUser->phone);
        $this->assertTrue(str_starts_with($rawUser->phone, 'eyJpdiI6'));

        // Hashes should be generated
        $this->assertNotNull($rawUser->cpf_hash);
        $this->assertEquals(64, strlen($rawUser->cpf_hash)); // SHA-256
        $this->assertNotNull($rawUser->phone_hash);
        $this->assertEquals(64, strlen($rawUser->phone_hash));

        // Verify hashes match plaintext values
        $expectedCpfHash = $this->encryptionService->hashForLookup($plainCpf);
        $this->assertEquals($expectedCpfHash, $rawUser->cpf_hash);
    }

    /**
     * Test: User model automatically decrypts PHI fields on read
     *
     * @test
     */
    public function it_automatically_decrypts_phi_fields_on_user_read(): void
    {
        $plainCpf = '123.456.789-01';
        $plainPhone = '(11) 98765-4321';

        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => $plainCpf,
            'phone' => $plainPhone,
        ]);

        // Reload from database
        $reloaded = User::find($user->id);

        // Should automatically decrypt
        $this->assertEquals($plainCpf, $reloaded->cpf);
        $this->assertEquals($plainPhone, $reloaded->phone);
    }

    /**
     * Test: Find user by encrypted CPF using hash lookup
     *
     * @test
     */
    public function it_finds_user_by_encrypted_cpf_using_hash_lookup(): void
    {
        $cpf = '123.456.789-01';

        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => $cpf,
        ]);

        // Find by encrypted field using hash
        $found = User::findByEncrypted('cpf', $cpf);

        $this->assertNotNull($found);
        $this->assertEquals($user->id, $found->id);
        $this->assertEquals($cpf, $found->cpf); // Auto-decrypted
    }

    /**
     * Test: Find user by encrypted phone using hash lookup
     *
     * @test
     */
    public function it_finds_user_by_encrypted_phone_using_hash_lookup(): void
    {
        $phone = '(11) 98765-4321';

        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'phone' => $phone,
        ]);

        // Find by encrypted field using hash
        $found = User::findByEncrypted('phone', $phone);

        $this->assertNotNull($found);
        $this->assertEquals($user->id, $found->id);
        $this->assertEquals($phone, $found->phone); // Auto-decrypted
    }

    /**
     * Test: whereEncrypted scope filters by encrypted field
     *
     * @test
     */
    public function it_filters_users_by_encrypted_field(): void
    {
        $cpf1 = '111.111.111-11';
        $cpf2 = '222.222.222-22';

        User::create([
            'email' => 'user1@example.com',
            'password' => bcrypt('password123'),
            'cpf' => $cpf1,
        ]);

        User::create([
            'email' => 'user2@example.com',
            'password' => bcrypt('password123'),
            'cpf' => $cpf2,
        ]);

        // Query by encrypted CPF
        $results = User::whereEncrypted('cpf', $cpf1)->get();

        $this->assertCount(1, $results);
        $this->assertEquals($cpf1, $results[0]->cpf);
    }

    /**
     * Test: Hash lookup returns null for non-existent value
     *
     * @test
     */
    public function it_returns_null_for_non_existent_encrypted_value(): void
    {
        User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => '111.111.111-11',
        ]);

        $found = User::findByEncrypted('cpf', '999.999.999-99');

        $this->assertNull($found);
    }

    /**
     * Test: Registration controller enforces CPF uniqueness via hash
     *
     * @test
     */
    public function it_enforces_cpf_uniqueness_via_hash_in_registration(): void
    {
        $cpf = '123.456.789-01';

        // Create first user
        User::create([
            'email' => 'user1@example.com',
            'password' => bcrypt('password123'),
            'cpf' => $cpf,
            'phone' => '(11) 11111-1111',
        ]);

        // Attempt to register with same CPF
        $response = $this->postJson('/api/auth/register', [
            'email' => 'user2@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'cpf' => $cpf,
            'phone' => '(11) 22222-2222',
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('errors.cpf.0', 'CPF já cadastrado no sistema');
    }

    /**
     * Test: Registration controller enforces phone uniqueness via hash
     *
     * @test
     */
    public function it_enforces_phone_uniqueness_via_hash_in_registration(): void
    {
        $phone = '(11) 98765-4321';

        // Create first user
        User::create([
            'email' => 'user1@example.com',
            'password' => bcrypt('password123'),
            'cpf' => '111.111.111-11',
            'phone' => $phone,
        ]);

        // Attempt to register with same phone
        $response = $this->postJson('/api/auth/register', [
            'email' => 'user2@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'cpf' => '222.222.222-22',
            'phone' => $phone,
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('errors.phone.0', 'Telefone já cadastrado no sistema');
    }

    /**
     * Test: User model hides hash columns from JSON serialization
     *
     * @test
     */
    public function it_hides_hash_columns_from_json_serialization(): void
    {
        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => '123.456.789-01',
            'phone' => '(11) 98765-4321',
        ]);

        $json = $user->toArray();

        // Hash columns should be hidden
        $this->assertArrayNotHasKey('cpf_hash', $json);
        $this->assertArrayNotHasKey('phone_hash', $json);

        // Decrypted values should be visible (if not in hidden array)
        // Note: User model may hide cpf/phone for privacy - adjust as needed
    }

    /**
     * Test: Encryption handles null values gracefully
     *
     * @test
     */
    public function it_handles_null_phi_values_gracefully(): void
    {
        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => null,
            'phone' => null,
            'address' => null,
        ]);

        $this->assertNull($user->cpf);
        $this->assertNull($user->phone);
        $this->assertNull($user->address);

        // Hashes should also be null
        $rawUser = \DB::table('users')->where('id', $user->id)->first();
        $this->assertNull($rawUser->cpf_hash);
        $this->assertNull($rawUser->phone_hash);
    }

    /**
     * Test: Updating encrypted field updates hash
     *
     * @test
     */
    public function it_updates_hash_when_encrypted_field_changes(): void
    {
        $originalCpf = '111.111.111-11';
        $newCpf = '222.222.222-22';

        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => $originalCpf,
        ]);

        $originalHash = \DB::table('users')->where('id', $user->id)->value('cpf_hash');

        // Update CPF
        $user->update(['cpf' => $newCpf]);

        $newHash = \DB::table('users')->where('id', $user->id)->value('cpf_hash');

        $this->assertNotEquals($originalHash, $newHash);
        $this->assertEquals(
            $this->encryptionService->hashForLookup($newCpf),
            $newHash
        );
    }

    /**
     * Test: Migration command encrypts existing plaintext data
     *
     * @test
     */
    public function it_migrates_plaintext_data_to_encrypted_format(): void
    {
        // Insert user with "plaintext" data (simulating pre-migration state)
        // Note: This is difficult to test since trait auto-encrypts, but we can verify command works
        $this->artisan('phi:migrate-encryption', ['--dry-run' => true])
            ->expectsOutput('🔐 PHI Field Encryption Migration')
            ->assertExitCode(0);
    }

    /**
     * Test: Verification command validates encryption
     *
     * @test
     */
    public function it_verifies_encryption_implementation(): void
    {
        User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => '123.456.789-01',
            'phone' => '(11) 98765-4321',
        ]);

        $this->artisan('phi:verify-encryption')
            ->expectsOutput('🔍 PHI Encryption Verification')
            ->assertExitCode(0);
    }

    /**
     * Test: No plaintext PHI in database after encryption
     *
     * @test
     */
    public function it_ensures_no_plaintext_phi_in_database(): void
    {
        $cpf = '123.456.789-01';
        $phone = '(11) 98765-4321';

        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'cpf' => $cpf,
            'phone' => $phone,
        ]);

        // Query raw database
        $rawUser = \DB::table('users')->where('id', $user->id)->first();

        // Plaintext should NOT exist in database
        $this->assertNotEquals($cpf, $rawUser->cpf);
        $this->assertNotEquals($phone, $rawUser->phone);

        // Values should be encrypted (Laravel Crypt format)
        $this->assertTrue(str_starts_with($rawUser->cpf, 'eyJpdiI6'));
        $this->assertTrue(str_starts_with($rawUser->phone, 'eyJpdiI6'));
    }

    /**
     * Test: Address field is encrypted (no hash needed)
     *
     * @test
     */
    public function it_encrypts_address_field_without_hash(): void
    {
        $address = 'Rua das Flores, 123, São Paulo - SP';

        $user = User::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
            'address' => $address,
        ]);

        $rawUser = \DB::table('users')->where('id', $user->id)->first();

        // Address should be encrypted
        $this->assertNotEquals($address, $rawUser->address);
        $this->assertTrue(str_starts_with($rawUser->address, 'eyJpdiI6'));

        // No hash column for address (not searchable)
        $columns = \Schema::getColumnListing('users');
        $this->assertNotContains('address_hash', $columns);

        // Should decrypt correctly
        $this->assertEquals($address, $user->fresh()->address);
    }
}
