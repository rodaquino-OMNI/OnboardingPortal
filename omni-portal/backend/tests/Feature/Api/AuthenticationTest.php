<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\GamificationProgress;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Cache;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Clear rate limiter before each test
        RateLimiter::clear('test@example.com|127.0.0.1');
    }

    /**
     * Test successful login with valid credentials
     */
    public function test_user_can_login_with_valid_credentials()
    {
        // Create a user with related models
        $user = User::factory()->create([
            'name' => 'Test User',
            'email' => 'valid@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
            'registration_step' => 'completed',
            'is_active' => true,
            'status' => 'active'
        ]);

        $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);
        GamificationProgress::factory()->create(['beneficiary_id' => $beneficiary->id]);

        // Attempt login
        $response = $this->postJson('/api/auth/login', [
            'email' => 'valid@example.com',
            'password' => 'password123',
            'device_name' => 'web'
        ]);

        // Assert response
        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'beneficiary',
                    'gamification_progress'
                ],
                'success'
            ])
            ->assertJson([
                'message' => 'Login realizado com sucesso',
                'success' => true
            ]);

        // Check auth cookie is set
        $response->assertCookie('auth_token');
        
        // Verify user login was recorded
        $user->refresh();
        $this->assertNotNull($user->last_login_at);
        $this->assertEquals('127.0.0.1', $user->last_login_ip);
        $this->assertEquals(0, $user->failed_login_attempts);
    }

    /**
     * Test login failure with invalid credentials
     */
    public function test_user_cannot_login_with_invalid_credentials()
    {
        // Create a user
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'registration_step' => 'completed',
            'is_active' => true
        ]);

        // Attempt login with wrong password
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrongpassword'
        ]);

        // Assert response
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email'])
            ->assertJson([
                'errors' => [
                    'email' => ['As credenciais fornecidas estão incorretas.']
                ]
            ]);
    }

    /**
     * Test login validation errors
     */
    public function test_login_requires_email_and_password()
    {
        // Test missing email
        $response = $this->postJson('/api/auth/login', [
            'password' => 'password123'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        // Test missing password
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    /**
     * Test login with incomplete registration
     */
    public function test_login_returns_registration_step_for_incomplete_user()
    {
        // Create user with incomplete registration
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'registration_step' => 'contact',
            'is_active' => true
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Registro incompleto',
                'registration_step' => 'contact',
                'user_id' => $user->id
            ]);
    }

    /**
     * Test login with inactive account
     */
    public function test_login_fails_with_inactive_account()
    {
        // Create inactive user (ensure it's not locked) with unique email
        $user = User::factory()->create([
            'email' => 'inactive@example.com',
            'password' => Hash::make('password123'),
            'is_active' => false,
            'failed_login_attempts' => 0,
            'locked_until' => null
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'inactive@example.com',
            'password' => 'password123'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email'])
            ->assertJson([
                'errors' => [
                    'email' => ['Sua conta está inativa. Entre em contato com o administrador.']
                ]
            ]);
    }

    /**
     * Test account locks after multiple failed attempts
     */
    public function test_account_locks_after_multiple_failed_attempts()
    {
        // Create user
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123')
        ]);

        $throttleKey = 'login_throttle:test@example.com|127.0.0.1';
        
        // Clear cache-based rate limiter first
        Cache::forget($throttleKey);

        // Attempt login 5 times with wrong password, clearing rate limiter between attempts
        for ($i = 0; $i < 5; $i++) {
            Cache::forget($throttleKey);
            $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'wrongpassword'
            ]);
        }

        $user->refresh();
        $this->assertEquals(5, $user->failed_login_attempts);
        $this->assertNotNull($user->locked_until);
        $this->assertTrue($user->isLocked());

        // Clear rate limiter to test account lock specifically
        Cache::forget($throttleKey);

        // Try to login with correct password - should be blocked by account lock
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123'
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'errors' => [
                    'email' => ['Sua conta está bloqueada devido a múltiplas tentativas de login falhadas. Tente novamente mais tarde.']
                ]
            ]);
    }

    /**
     * Test login rate limiting
     */
    public function test_login_rate_limiting()
    {
        // Create user
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123')
        ]);

        // Attempt login 6 times quickly
        for ($i = 0; $i < 6; $i++) {
            $response = $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'wrongpassword'
            ]);
        }

        // 6th attempt should be rate limited
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
        
        $this->assertStringContainsString('Muitas tentativas de login', $response->json('errors.email.0'));
    }

    /**
     * Test check email availability
     */
    public function test_check_email_availability()
    {
        // Create existing user
        User::factory()->create([
            'email' => 'taken@example.com'
        ]);

        // Check taken email
        $response = $this->postJson('/api/auth/check-email', [
            'email' => 'taken@example.com'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'exists' => true
            ]);

        // Check available email
        $response = $this->postJson('/api/auth/check-email', [
            'email' => 'available@example.com'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'exists' => false
            ]);
    }

    /**
     * Test check CPF availability
     */
    public function test_check_cpf_availability()
    {
        // Create user with CPF
        User::factory()->create([
            'cpf' => '12345678901'
        ]);

        // Check taken CPF (with formatting)
        $response = $this->postJson('/api/auth/check-cpf', [
            'cpf' => '123.456.789-01'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'exists' => true
            ]);

        // Check available CPF
        $response = $this->postJson('/api/auth/check-cpf', [
            'cpf' => '98765432109'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'exists' => false
            ]);
    }

    /**
     * Test authenticated user can logout
     */
    public function test_authenticated_user_can_logout()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Logout realizado com sucesso'
            ])
            ->assertCookie('auth_token', '', 0); // Cookie should be expired

        // Verify current token was deleted
        $this->assertCount(0, $user->tokens);
    }

    /**
     * Test authenticated user can logout from all devices
     */
    public function test_authenticated_user_can_logout_from_all_devices()
    {
        $user = User::factory()->create();
        
        // Create multiple tokens
        $user->createToken('device1')->plainTextToken;
        $user->createToken('device2')->plainTextToken;
        $user->createToken('device3')->plainTextToken;

        $this->assertCount(3, $user->tokens);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/auth/logout-all');

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Logout realizado em todos os dispositivos'
            ]);

        // Verify all tokens were deleted
        $this->assertCount(0, $user->fresh()->tokens);
    }

    /**
     * Test get authenticated user details
     */
    public function test_authenticated_user_can_get_user_details()
    {
        $user = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'registration_step' => 'completed'
        ]);

        $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);
        GamificationProgress::factory()->create(['beneficiary_id' => $beneficiary->id]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/auth/user');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user' => [
                    'id',
                    'name',
                    'email',
                    'beneficiary',
                    'gamification_progress'
                ]
            ]);
    }

    /**
     * Test unauthenticated access is denied
     */
    public function test_unauthenticated_user_cannot_access_protected_routes()
    {
        $response = $this->getJson('/api/auth/user');
        $response->assertStatus(401);

        $response = $this->postJson('/api/auth/logout');
        $response->assertStatus(401);

        $response = $this->postJson('/api/auth/refresh');
        $response->assertStatus(401);
    }

    /**
     * Test token refresh
     */
    public function test_authenticated_user_can_refresh_token()
    {
        $user = User::factory()->create();
        $oldToken = $user->createToken('test-device')->plainTextToken;

        // Act as user with the token
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/auth/refresh', [
            'device_name' => 'web'
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'token',
                'token_type'
            ])
            ->assertJson([
                'message' => 'Token renovado com sucesso',
                'token_type' => 'Bearer'
            ]);

        // Verify new token is different
        $this->assertNotEquals($oldToken, $response->json('token'));
    }

    /**
     * Test login with CPF
     */
    public function test_user_can_login_with_cpf()
    {
        // Create user with CPF
        $user = User::factory()->create([
            'cpf' => '12345678901',
            'password' => Hash::make('password123'),
            'registration_step' => 'completed',
            'is_active' => true
        ]);

        $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);
        GamificationProgress::factory()->create(['beneficiary_id' => $beneficiary->id]);

        $response = $this->postJson('/api/auth/login', [
            'email' => '12345678901',
            'password' => 'password123',
            'device_name' => 'web'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Login realizado com sucesso',
                'success' => true
            ]);
    }
}