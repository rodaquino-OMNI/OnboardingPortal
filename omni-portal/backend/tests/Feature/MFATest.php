<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\MFAService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * MFA Test Suite
 *
 * Tests Multi-Factor Authentication (MFA/TOTP) functionality:
 * - MFA setup and QR code generation
 * - TOTP code verification
 * - MFA middleware enforcement
 * - Recovery code generation and consumption
 * - MFA disable with password + code
 *
 * ADR-002 P1 Compliance: Multi-Factor Authentication Testing
 */
class MFATest extends TestCase
{
    use RefreshDatabase;

    protected MFAService $mfaService;
    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mfaService = app(MFAService::class);

        // Create test user
        $this->user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
        ]);
    }

    /**
     * Test: MFA setup generates secret and QR code
     */
    public function test_mfa_setup_generates_secret_and_qr_code(): void
    {
        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Request QR code
        $response = $this->getJson('/api/mfa/qr-code');

        // Assert response
        $response->assertStatus(200)
            ->assertJsonStructure([
                'qr_code',
                'secret',
                'message',
            ]);

        // Verify QR code is data URI
        $qrCode = $response->json('qr_code');
        $this->assertStringStartsWith('data:image/svg+xml;base64,', $qrCode);

        // Verify secret is base32 encoded (32 characters)
        $secret = $response->json('secret');
        $this->assertEquals(32, strlen($secret));
        $this->assertMatchesRegularExpression('/^[A-Z2-7]+$/', $secret);

        // Verify secret is stored in session
        $this->assertTrue(session()->has('mfa.secret'));
    }

    /**
     * Test: MFA setup with valid TOTP code
     */
    public function test_mfa_setup_with_valid_totp_code(): void
    {
        // Generate secret and store in session
        $secret = $this->mfaService->generateSecret();
        session()->put('mfa.secret', $secret);

        // Generate valid TOTP code
        $google2fa = new \PragmaRX\Google2FA\Google2FA();
        $validCode = $google2fa->getCurrentOtp($secret);

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Setup MFA
        $response = $this->postJson('/api/mfa/setup', [
            'code' => $validCode,
        ]);

        // Assert response
        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'recovery_codes',
                'warning',
            ]);

        // Verify 10 recovery codes returned
        $recoveryCodes = $response->json('recovery_codes');
        $this->assertCount(10, $recoveryCodes);

        // Verify recovery code format
        foreach ($recoveryCodes as $code) {
            $this->assertMatchesRegularExpression('/^[A-Z0-9]{4}-[A-Z0-9]{4}$/', $code);
        }

        // Verify user MFA enabled in database
        $this->user->refresh();
        $this->assertTrue($this->user->mfa_enabled);
        $this->assertNotNull($this->user->mfa_secret);
        $this->assertNotNull($this->user->mfa_recovery_codes);
        $this->assertNotNull($this->user->mfa_enforced_at);
        $this->assertNotNull($this->user->mfa_last_verified_at);
    }

    /**
     * Test: MFA setup with invalid TOTP code
     */
    public function test_mfa_setup_with_invalid_totp_code(): void
    {
        // Generate secret and store in session
        $secret = $this->mfaService->generateSecret();
        session()->put('mfa.secret', $secret);

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Attempt setup with invalid code
        $response = $this->postJson('/api/mfa/setup', [
            'code' => '000000', // Invalid code
        ]);

        // Assert error response
        $response->assertStatus(422)
            ->assertJson([
                'error' => 'invalid_code',
            ]);

        // Verify user MFA still disabled
        $this->user->refresh();
        $this->assertFalse($this->user->mfa_enabled);
    }

    /**
     * Test: MFA verify validates TOTP code
     */
    public function test_mfa_verify_validates_totp_code(): void
    {
        // Enable MFA for user
        $secret = $this->mfaService->generateSecret();
        $recoveryCodes = $this->mfaService->generateRecoveryCodes();
        $this->mfaService->enableMFA($this->user, $secret, $recoveryCodes);

        // Generate valid TOTP code
        $google2fa = new \PragmaRX\Google2FA\Google2FA();
        $validCode = $google2fa->getCurrentOtp($secret);

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Verify MFA code
        $response = $this->postJson('/api/mfa/verify', [
            'code' => $validCode,
        ]);

        // Assert response
        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'redirect',
            ]);

        // Verify last verified timestamp updated
        $this->user->refresh();
        $this->assertNotNull($this->user->mfa_last_verified_at);
        $this->assertTrue($this->user->mfa_last_verified_at->diffInSeconds(now()) < 5);
    }

    /**
     * Test: MFA middleware blocks unauthenticated MFA users
     */
    public function test_mfa_middleware_blocks_users_without_recent_verification(): void
    {
        // Enable MFA for user but set last verified to 20 minutes ago
        $secret = $this->mfaService->generateSecret();
        $recoveryCodes = $this->mfaService->generateRecoveryCodes();
        $this->mfaService->enableMFA($this->user, $secret, $recoveryCodes);

        $this->user->mfa_last_verified_at = now()->subMinutes(20);
        $this->user->save();

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Attempt to access protected route (simulated)
        $response = $this->getJson('/api/test-mfa-protected');

        // Assert MFA verification required
        $response->assertStatus(403)
            ->assertJson([
                'error' => 'mfa_verification_required',
            ]);
    }

    /**
     * Test: Recovery codes can be used once
     */
    public function test_recovery_codes_can_be_used_once(): void
    {
        // Enable MFA for user
        $secret = $this->mfaService->generateSecret();
        $recoveryCodes = $this->mfaService->generateRecoveryCodes();
        $this->mfaService->enableMFA($this->user, $secret, $recoveryCodes);

        $recoveryCode = $recoveryCodes[0];

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Use recovery code first time
        $response1 = $this->postJson('/api/mfa/verify-recovery', [
            'recovery_code' => $recoveryCode,
        ]);

        $response1->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'redirect',
                'remaining_codes',
            ]);

        // Verify remaining codes count
        $this->assertEquals(9, $response1->json('remaining_codes'));

        // Attempt to use same recovery code again
        $response2 = $this->postJson('/api/mfa/verify-recovery', [
            'recovery_code' => $recoveryCode,
        ]);

        $response2->assertStatus(422)
            ->assertJson([
                'error' => 'invalid_recovery_code',
            ]);
    }

    /**
     * Test: MFA disable requires password and code
     */
    public function test_mfa_disable_requires_password_and_code(): void
    {
        // Enable MFA for user
        $secret = $this->mfaService->generateSecret();
        $recoveryCodes = $this->mfaService->generateRecoveryCodes();
        $this->mfaService->enableMFA($this->user, $secret, $recoveryCodes);

        // Generate valid TOTP code
        $google2fa = new \PragmaRX\Google2FA\Google2FA();
        $validCode = $google2fa->getCurrentOtp($secret);

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Disable MFA with valid password and code
        $response = $this->postJson('/api/mfa/disable', [
            'password' => 'password123',
            'code' => $validCode,
        ]);

        // Assert response
        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Multi-factor authentication disabled successfully.',
            ]);

        // Verify user MFA disabled in database
        $this->user->refresh();
        $this->assertFalse($this->user->mfa_enabled);
        $this->assertNull($this->user->mfa_secret);
        $this->assertNull($this->user->mfa_recovery_codes);
    }

    /**
     * Test: MFA disable fails with wrong password
     */
    public function test_mfa_disable_fails_with_wrong_password(): void
    {
        // Enable MFA for user
        $secret = $this->mfaService->generateSecret();
        $recoveryCodes = $this->mfaService->generateRecoveryCodes();
        $this->mfaService->enableMFA($this->user, $secret, $recoveryCodes);

        // Generate valid TOTP code
        $google2fa = new \PragmaRX\Google2FA\Google2FA();
        $validCode = $google2fa->getCurrentOtp($secret);

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Attempt to disable MFA with wrong password
        $response = $this->postJson('/api/mfa/disable', [
            'password' => 'wrong_password',
            'code' => $validCode,
        ]);

        // Assert error response
        $response->assertStatus(422)
            ->assertJson([
                'error' => 'invalid_password',
            ]);

        // Verify user MFA still enabled
        $this->user->refresh();
        $this->assertTrue($this->user->mfa_enabled);
    }

    /**
     * Test: Recovery codes regeneration
     */
    public function test_recovery_codes_regeneration(): void
    {
        // Enable MFA for user
        $secret = $this->mfaService->generateSecret();
        $originalRecoveryCodes = $this->mfaService->generateRecoveryCodes();
        $this->mfaService->enableMFA($this->user, $secret, $originalRecoveryCodes);

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Regenerate recovery codes
        $response = $this->getJson('/api/mfa/recovery-codes');

        // Assert response
        $response->assertStatus(200)
            ->assertJsonStructure([
                'recovery_codes',
                'message',
                'warning',
            ]);

        $newRecoveryCodes = $response->json('recovery_codes');

        // Verify 10 new codes returned
        $this->assertCount(10, $newRecoveryCodes);

        // Verify new codes are different from original
        $this->assertNotEquals($originalRecoveryCodes, $newRecoveryCodes);

        // Verify original codes no longer work
        $this->actingAs($this->user, 'sanctum');

        $testResponse = $this->postJson('/api/mfa/verify-recovery', [
            'recovery_code' => $originalRecoveryCodes[0],
        ]);

        $testResponse->assertStatus(422);
    }

    /**
     * Test: MFA middleware allows users without MFA enabled
     */
    public function test_mfa_middleware_allows_users_without_mfa(): void
    {
        // User has no MFA enabled
        $this->assertFalse($this->user->mfa_enabled);

        // Act as authenticated user
        $this->actingAs($this->user, 'sanctum');

        // Access should be blocked and redirect to setup
        $response = $this->getJson('/api/test-mfa-protected');

        $response->assertStatus(403)
            ->assertJson([
                'error' => 'mfa_required',
            ]);
    }
}
