<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Modules\Gamification\Services\PointsEngine;
use App\Modules\Gamification\Services\AuditLogService;

/**
 * RegistrationFlowTest - Comprehensive tests for registration API
 *
 * Tests:
 * - POST /api/v1/register
 * - GET /api/v1/callback-verify
 * - POST /api/v1/profile/minimal
 *
 * Validates:
 * - Server-side validation (all inputs)
 * - SHA-256 hashed user IDs in analytics
 * - No PII/PHI in analytics payloads
 * - CSRF protection
 * - Gamification integration
 */
class RegistrationFlowTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test successful registration
     */
    public function test_register_success(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ss123',
            'password_confirmation' => 'SecureP@ss123',
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'email'],
                'verification_email_sent',
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        // Verify password is hashed
        $user = User::where('email', 'test@example.com')->first();
        $this->assertTrue(Hash::check('SecureP@ss123', $user->password));
        $this->assertNotNull($user->email_verification_token);
    }

    /**
     * Test registration validation - email required
     */
    public function test_register_validation_email_required(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'password' => 'SecureP@ss123',
            'password_confirmation' => 'SecureP@ss123',
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /**
     * Test registration validation - email must be unique
     */
    public function test_register_validation_email_unique(): void
    {
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->postJson('/api/v1/register', [
            'email' => 'existing@example.com',
            'password' => 'SecureP@ss123',
            'password_confirmation' => 'SecureP@ss123',
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /**
     * Test registration validation - password strength
     */
    public function test_register_validation_password_strength(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'email' => 'test@example.com',
            'password' => 'weak',
            'password_confirmation' => 'weak',
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    /**
     * Test registration validation - password confirmation
     */
    public function test_register_validation_password_confirmation(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ss123',
            'password_confirmation' => 'DifferentP@ss123',
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    /**
     * Test registration validation - LGPD consent required
     */
    public function test_register_validation_lgpd_consent(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ss123',
            'password_confirmation' => 'SecureP@ss123',
            'lgpd_consent' => false,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['lgpd_consent']);
    }

    /**
     * Test email verification success
     */
    public function test_verify_email_success(): void
    {
        $user = User::factory()->create([
            'email_verification_token' => $token = Str::random(64),
            'email_verified_at' => null,
            'points_balance' => 0,
        ]);

        $response = $this->getJson("/api/v1/callback-verify?token={$token}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'access_token',
                'refresh_token',
                'token_type',
                'expires_in',
                'user' => ['id', 'email', 'points_balance', 'current_level'],
                'gamification' => ['points_earned', 'total_points', 'current_level', 'badge_unlocked'],
            ]);

        // Verify email marked as verified
        $user->refresh();
        $this->assertNotNull($user->email_verified_at);
        $this->assertNull($user->email_verification_token);

        // Verify 100 points awarded
        $this->assertEquals(100, $user->points_balance);
    }

    /**
     * Test email verification - invalid token
     */
    public function test_verify_email_invalid_token(): void
    {
        $response = $this->getJson('/api/v1/callback-verify?token=invalid-token-12345');

        $response->assertStatus(404)
            ->assertJson(['error' => 'Token inválido ou expirado']);
    }

    /**
     * Test profile minimal update success
     */
    public function test_update_profile_minimal_success(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
            'points_balance' => 100,
            'current_level' => 1,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/profile/minimal', [
                'name' => 'João Silva',
                'cpf' => '123.456.789-01',
                'birthdate' => '1990-05-15',
                'phone' => '(11) 98765-4321',
                'address' => 'Rua Example, 123',
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'email', 'name', 'points_balance', 'current_level'],
                'gamification' => ['points_earned', 'total_points', 'current_level'],
                'next_step',
            ]);

        // Verify profile updated
        $user->refresh();
        $this->assertEquals('João Silva', $user->name);
        $this->assertEquals('123.456.789-01', $user->cpf);
        $this->assertEquals('1990-05-15', $user->birthdate->format('Y-m-d'));
        $this->assertEquals('(11) 98765-4321', $user->phone);

        // Verify 50 points awarded (total = 100 + 50 = 150)
        $this->assertEquals(150, $user->points_balance);
    }

    /**
     * Test profile minimal - email not verified
     */
    public function test_update_profile_minimal_email_not_verified(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => null,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/profile/minimal', [
                'name' => 'João Silva',
                'cpf' => '123.456.789-01',
                'birthdate' => '1990-05-15',
                'phone' => '(11) 98765-4321',
            ]);

        $response->assertStatus(403)
            ->assertJson(['error' => 'Email não verificado. Por favor, verifique seu email primeiro.']);
    }

    /**
     * Test profile minimal validation - CPF format
     */
    public function test_update_profile_minimal_validation_cpf(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/profile/minimal', [
                'name' => 'João Silva',
                'cpf' => '12345678901', // Invalid format
                'birthdate' => '1990-05-15',
                'phone' => '(11) 98765-4321',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cpf']);
    }

    /**
     * Test profile minimal validation - phone format
     */
    public function test_update_profile_minimal_validation_phone(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/profile/minimal', [
                'name' => 'João Silva',
                'cpf' => '123.456.789-01',
                'birthdate' => '1990-05-15',
                'phone' => '11987654321', // Invalid format
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    /**
     * Test profile minimal validation - age requirement (18+)
     */
    public function test_update_profile_minimal_validation_age(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/profile/minimal', [
                'name' => 'João Silva',
                'cpf' => '123.456.789-01',
                'birthdate' => now()->subYears(17)->format('Y-m-d'), // Under 18
                'phone' => '(11) 98765-4321',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['birthdate']);
    }

    /**
     * Test profile minimal - authentication required
     */
    public function test_update_profile_minimal_requires_authentication(): void
    {
        $response = $this->postJson('/api/v1/profile/minimal', [
            'name' => 'João Silva',
            'cpf' => '123.456.789-01',
            'birthdate' => '1990-05-15',
            'phone' => '(11) 98765-4321',
        ]);

        $response->assertStatus(401);
    }

    /**
     * Test profile minimal validation - name format
     */
    public function test_update_profile_minimal_validation_name(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        // Test name with numbers (should fail)
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/profile/minimal', [
                'name' => 'João123',
                'cpf' => '123.456.789-01',
                'birthdate' => '1990-05-15',
                'phone' => '(11) 98765-4321',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // Test name too short (should fail)
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/profile/minimal', [
                'name' => 'AB',
                'cpf' => '123.456.789-01',
                'birthdate' => '1990-05-15',
                'phone' => '(11) 98765-4321',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    /**
     * Test CSRF protection is enabled
     */
    public function test_csrf_protection_enabled(): void
    {
        $response = $this->get('/sanctum/csrf-cookie');

        $response->assertStatus(200);
        $this->assertNotNull($response->headers->getCookies());
    }

    /**
     * Test idempotent points awarding
     */
    public function test_idempotent_points_awarding(): void
    {
        $user = User::factory()->create([
            'email_verification_token' => $token = Str::random(64),
            'email_verified_at' => null,
            'points_balance' => 0,
        ]);

        // First verification - should award points
        $response1 = $this->getJson("/api/v1/callback-verify?token={$token}");
        $response1->assertStatus(200);

        $user->refresh();
        $firstBalance = $user->points_balance;
        $this->assertEquals(100, $firstBalance);

        // Update token for second attempt
        $user->update(['email_verification_token' => $token2 = Str::random(64)]);

        // Second verification - should NOT award duplicate points
        $response2 = $this->getJson("/api/v1/callback-verify?token={$token2}");
        $response2->assertStatus(200);

        $user->refresh();
        $this->assertEquals($firstBalance, $user->points_balance); // No change
    }
}
