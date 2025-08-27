<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthenticationApiTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Ensure consistent test environment
        config(['sanctum.expiration' => null]);
        config(['auth.password_timeout' => 10800]);
    }

    /** @test */
    public function user_can_register_with_valid_data()
    {
        $userData = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '12345678901',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!'
        ];

        $response = $this->postJson('/api/auth/register', $userData);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'user' => ['id', 'name', 'email', 'created_at'],
                    'token'
                ],
                'message'
            ]);

        $this->assertDatabaseHas('users', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '12345678901'
        ]);
    }

    /** @test */
    public function registration_requires_all_mandatory_fields()
    {
        $response = $this->postJson('/api/auth/register', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'cpf', 'password']);
    }

    /** @test */
    public function registration_validates_email_format()
    {
        $userData = [
            'name' => 'Test User',
            'email' => 'invalid-email',
            'cpf' => '12345678901',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!'
        ];

        $response = $this->postJson('/api/auth/register', $userData);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function registration_validates_cpf_format()
    {
        $userData = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '123', // Invalid CPF
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!'
        ];

        $response = $this->postJson('/api/auth/register', $userData);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cpf']);
    }

    /** @test */
    public function registration_prevents_duplicate_email()
    {
        User::factory()->create(['email' => 'test@example.com']);

        $userData = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '12345678901',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!'
        ];

        $response = $this->postJson('/api/auth/register', $userData);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function registration_prevents_duplicate_cpf()
    {
        User::factory()->create(['cpf' => '12345678901']);

        $userData = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '12345678901',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!'
        ];

        $response = $this->postJson('/api/auth/register', $userData);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cpf']);
    }

    /** @test */
    public function registration_validates_password_confirmation()
    {
        $userData = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '12345678901',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'DifferentPassword123!'
        ];

        $response = $this->postJson('/api/auth/register', $userData);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    /** @test */
    public function user_can_login_with_valid_credentials()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('SecurePassword123!')
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'SecurePassword123!'
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'user' => ['id', 'name', 'email'],
                    'token'
                ],
                'message'
            ]);

        $this->assertEquals($user->id, $response->json('data.user.id'));
    }

    /** @test */
    public function login_fails_with_invalid_email()
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'nonexistent@example.com',
            'password' => 'password123'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function login_fails_with_invalid_password()
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('SecurePassword123!')
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'WrongPassword'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function login_requires_email_and_password()
    {
        $response = $this->postJson('/api/auth/login', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    /** @test */
    public function authenticated_user_can_access_profile()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/user');

        $response->assertStatus(200)
            ->assertJson([
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email
            ]);
    }

    /** @test */
    public function unauthenticated_user_cannot_access_profile()
    {
        $response = $this->getJson('/api/user');

        $response->assertStatus(401);
    }

    /** @test */
    public function user_can_logout()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/auth/logout');

        $response->assertStatus(200)
            ->assertJson(['message' => 'Logged out successfully']);

        // Verify token is invalidated
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'tokenable_type' => User::class
        ]);
    }

    /** @test */
    public function logout_requires_authentication()
    {
        $response = $this->postJson('/api/auth/logout');

        $response->assertStatus(401);
    }

    /** @test */
    public function user_can_refresh_token()
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth-token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/auth/refresh');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'token'
                ]
            ]);

        // Verify old token is revoked
        $this->assertDatabaseMissing('personal_access_tokens', [
            'token' => hash('sha256', explode('|', $token)[1])
        ]);
    }

    /** @test */
    public function password_reset_request_with_valid_email()
    {
        $user = User::factory()->create(['email' => 'test@example.com']);

        $response = $this->postJson('/api/auth/forgot-password', [
            'email' => 'test@example.com'
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('password_reset_tokens', [
            'email' => 'test@example.com'
        ]);
    }

    /** @test */
    public function password_reset_request_with_invalid_email()
    {
        $response = $this->postJson('/api/auth/forgot-password', [
            'email' => 'nonexistent@example.com'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function password_can_be_reset_with_valid_token()
    {
        $user = User::factory()->create();
        
        // Create password reset token
        $token = \Illuminate\Support\Str::random(64);
        \Illuminate\Support\Facades\DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make($token),
            'created_at' => now()
        ]);

        $newPassword = 'NewSecurePassword123!';

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => $newPassword,
            'password_confirmation' => $newPassword
        ]);

        $response->assertStatus(200);

        // Verify password was changed
        $user->refresh();
        $this->assertTrue(Hash::check($newPassword, $user->password));
    }

    /** @test */
    public function password_reset_fails_with_invalid_token()
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'token' => 'invalid-token',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!'
        ]);

        $response->assertStatus(422);
    }

    /** @test */
    public function multiple_login_attempts_are_throttled()
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('correct-password')
        ]);

        // Make multiple failed attempts
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'wrong-password'
            ]);
        }

        // Next attempt should be throttled
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'correct-password'
        ]);

        $response->assertStatus(429); // Too Many Requests
    }

    /** @test */
    public function api_endpoints_have_proper_cors_headers()
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123'
        ]);

        $this->assertTrue($response->headers->has('Access-Control-Allow-Origin'));
        $this->assertTrue($response->headers->has('Access-Control-Allow-Methods'));
        $this->assertTrue($response->headers->has('Access-Control-Allow-Headers'));
    }

    /** @test */
    public function api_endpoints_have_security_headers()
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123'
        ]);

        $this->assertTrue($response->headers->has('X-Content-Type-Options'));
        $this->assertTrue($response->headers->has('X-Frame-Options'));
        $this->assertTrue($response->headers->has('X-XSS-Protection'));
    }

    /** @test */
    public function registration_creates_user_with_default_role()
    {
        $userData = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '12345678901',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!'
        ];

        $this->postJson('/api/auth/register', $userData);

        $user = User::where('email', 'test@example.com')->first();
        $this->assertEquals('user', $user->role);
    }

    /** @test */
    public function sensitive_user_data_is_not_exposed_in_responses()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/user');

        $response->assertJsonMissing(['password']);
        $response->assertJsonMissing(['remember_token']);
        $response->assertJsonMissing(['email_verified_at']);
    }

    /** @test */
    public function api_responses_follow_consistent_format()
    {
        $userData = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '12345678901',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!'
        ];

        $response = $this->postJson('/api/auth/register', $userData);

        $response->assertJsonStructure([
            'data',
            'message',
            'success'
        ]);

        $this->assertTrue($response->json('success'));
        $this->assertNotEmpty($response->json('message'));
    }

    /** @test */
    public function error_responses_follow_consistent_format()
    {
        $response = $this->postJson('/api/auth/login', []);

        $response->assertJsonStructure([
            'message',
            'error',
            'errors',
            'code'
        ]);

        $this->assertEquals('VALIDATION_ERROR', $response->json('code'));
    }
}