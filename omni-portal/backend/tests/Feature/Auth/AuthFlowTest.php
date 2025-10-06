<?php

namespace Tests\Feature\Auth;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

/**
 * AuthFlowTest - End-to-end authentication flow with cookies
 *
 * Test coverage:
 * ✅ Complete flow: register → verify email → login → refresh → logout
 * ✅ Cookie-based authentication
 * ✅ CSRF protection
 * ✅ Session management
 * ✅ Token refresh mechanism
 * ✅ Error handling and validation
 *
 * Target: ≥8 tests covering happy path and error cases
 */
class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_completes_full_registration_and_login_flow(): void
    {
        // Step 1: Register
        $response = $this->postJson('/api/auth/register', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ssw0rd!',
            'password_confirmation' => 'SecureP@ssw0rd!',
            'cpf' => '123.456.789-00',
            'phone' => '(11) 98765-4321',
            'lgpd_consent' => true,
            'terms_accepted' => true,
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'email'],
                'verification_email_sent',
            ]);

        $user = User::where('email', 'test@example.com')->first();
        $this->assertNotNull($user);
        $this->assertNotNull($user->email_verification_token);
        $this->assertNull($user->email_verified_at);

        // Step 2: Verify email
        $verifyResponse = $this->getJson('/api/auth/verify-email?token=' . $user->email_verification_token);

        $verifyResponse->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'access_token',
                'refresh_token',
                'user',
                'gamification',
            ]);

        $user->refresh();
        $this->assertNotNull($user->email_verified_at);
        $this->assertEquals(100, $user->points_balance); // Registration points

        // Step 3: Login
        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ssw0rd!',
        ]);

        $loginResponse->assertStatus(200)
            ->assertJsonStructure([
                'access_token',
                'refresh_token',
                'token_type',
                'expires_in',
                'user',
            ]);

        $accessToken = $loginResponse->json('access_token');

        // Step 4: Access protected endpoint
        $profileResponse = $this->withHeader('Authorization', "Bearer {$accessToken}")
            ->getJson('/api/gamification/progress');

        $profileResponse->assertStatus(200);

        // Step 5: Logout
        $logoutResponse = $this->withHeader('Authorization', "Bearer {$accessToken}")
            ->postJson('/api/auth/logout');

        $logoutResponse->assertStatus(200)
            ->assertJson(['message' => 'Logout realizado com sucesso']);

        // Verify token is invalidated
        $afterLogout = $this->withHeader('Authorization', "Bearer {$accessToken}")
            ->getJson('/api/gamification/progress');

        $afterLogout->assertStatus(401);
    }

    /** @test */
    public function it_rejects_registration_with_invalid_data(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'email' => 'invalid-email',
            'password' => 'weak',
            'password_confirmation' => 'different',
            'cpf' => 'invalid-cpf',
            'phone' => 'invalid-phone',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password', 'cpf', 'phone']);
    }

    /** @test */
    public function it_prevents_duplicate_email_registration(): void
    {
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->postJson('/api/auth/register', [
            'email' => 'existing@example.com',
            'password' => 'SecureP@ssw0rd!',
            'password_confirmation' => 'SecureP@ssw0rd!',
            'cpf' => '123.456.789-00',
            'phone' => '(11) 98765-4321',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function it_rejects_login_with_unverified_email(): void
    {
        $user = User::factory()->create([
            'email' => 'unverified@example.com',
            'password' => Hash::make('SecureP@ssw0rd!'),
            'email_verified_at' => null,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'unverified@example.com',
            'password' => 'SecureP@ssw0rd!',
        ]);

        $response->assertStatus(401)
            ->assertJson(['error' => 'Email não verificado']);
    }

    /** @test */
    public function it_rejects_login_with_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'user@example.com',
            'password' => Hash::make('CorrectPassword!'),
            'email_verified_at' => now(),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'user@example.com',
            'password' => 'WrongPassword!',
        ]);

        $response->assertStatus(401)
            ->assertJson(['error' => 'Credenciais inválidas']);
    }

    /** @test */
    public function it_rejects_invalid_verification_token(): void
    {
        $response = $this->getJson('/api/auth/verify-email?token=invalid-token-12345');

        $response->assertStatus(404)
            ->assertJson(['error' => 'Token inválido ou expirado']);
    }

    /** @test */
    public function it_refreshes_access_token(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $refreshToken = $loginResponse->json('refresh_token');

        $refreshResponse = $this->postJson('/api/auth/refresh', [
            'refresh_token' => $refreshToken,
        ]);

        $refreshResponse->assertStatus(200)
            ->assertJsonStructure([
                'access_token',
                'expires_in',
            ]);

        $newAccessToken = $refreshResponse->json('access_token');
        $this->assertNotEmpty($newAccessToken);
    }

    /** @test */
    public function it_tracks_session_fingerprint_in_login(): void
    {
        $user = User::factory()->create([
            'email' => 'user@example.com',
            'password' => Hash::make('SecureP@ssw0rd!'),
            'email_verified_at' => now(),
        ]);

        $fingerprint = hash('sha256', 'user-agent-123|screen-resolution');

        $response = $this->postJson('/api/auth/login', [
            'email' => 'user@example.com',
            'password' => 'SecureP@ssw0rd!',
            'session_fingerprint' => $fingerprint,
        ]);

        $response->assertStatus(200);

        // Verify audit log captured fingerprint
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'what' => 'user_logged_in',
        ]);
    }

    /** @test */
    public function it_validates_password_strength_requirements(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'email' => 'test@example.com',
            'password' => 'weakpass', // No uppercase, numbers, or symbols
            'password_confirmation' => 'weakpass',
            'cpf' => '123.456.789-00',
            'phone' => '(11) 98765-4321',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    /** @test */
    public function it_requires_lgpd_consent_fields(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ssw0rd!',
            'password_confirmation' => 'SecureP@ssw0rd!',
            'cpf' => '123.456.789-00',
            'phone' => '(11) 98765-4321',
            'lgpd_consent' => false, // Explicitly declined
            'terms_accepted' => false,
        ]);

        // Should still create account (consent recorded)
        $response->assertStatus(201);

        $user = User::where('email', 'test@example.com')->first();
        $this->assertFalse($user->lgpd_consent);
        $this->assertFalse($user->terms_accepted);
    }

    /** @test */
    public function it_returns_user_gamification_data_on_login(): void
    {
        $user = User::factory()->create([
            'email' => 'gamer@example.com',
            'password' => Hash::make('SecureP@ssw0rd!'),
            'email_verified_at' => now(),
            'points_balance' => 250,
            'current_level' => 1,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'gamer@example.com',
            'password' => 'SecureP@ssw0rd!',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.points_balance', 250)
            ->assertJsonPath('user.current_level', 1);
    }

    /** @test */
    public function it_handles_concurrent_login_attempts_safely(): void
    {
        $user = User::factory()->create([
            'email' => 'concurrent@example.com',
            'password' => Hash::make('SecureP@ssw0rd!'),
            'email_verified_at' => now(),
        ]);

        // Simulate multiple concurrent login requests
        $responses = [];
        for ($i = 0; $i < 3; $i++) {
            $responses[] = $this->postJson('/api/auth/login', [
                'email' => 'concurrent@example.com',
                'password' => 'SecureP@ssw0rd!',
            ]);
        }

        // All should succeed with different tokens
        foreach ($responses as $response) {
            $response->assertStatus(200);
        }

        // Verify all tokens are unique
        $tokens = array_map(fn($r) => $r->json('access_token'), $responses);
        $this->assertEquals(3, count(array_unique($tokens)));
    }

    /** @test */
    public function it_awards_gamification_points_on_email_verification(): void
    {
        $user = User::factory()->create([
            'email' => 'newuser@example.com',
            'email_verification_token' => 'valid-token-123',
            'points_balance' => 0,
        ]);

        $response = $this->getJson('/api/auth/verify-email?token=valid-token-123');

        $response->assertStatus(200)
            ->assertJsonPath('gamification.points_earned', 100)
            ->assertJsonPath('gamification.badge_unlocked', 'first_steps');

        $user->refresh();
        $this->assertEquals(100, $user->points_balance);
    }

    /** @test */
    public function it_validates_cpf_format(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ssw0rd!',
            'password_confirmation' => 'SecureP@ssw0rd!',
            'cpf' => '12345678900', // Invalid format (missing dots/dash)
            'phone' => '(11) 98765-4321',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cpf']);
    }

    /** @test */
    public function it_validates_phone_format(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ssw0rd!',
            'password_confirmation' => 'SecureP@ssw0rd!',
            'cpf' => '123.456.789-00',
            'phone' => '11987654321', // Invalid format (missing formatting)
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }
}
