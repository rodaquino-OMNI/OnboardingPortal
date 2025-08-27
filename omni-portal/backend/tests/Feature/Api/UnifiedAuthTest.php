<?php

namespace Tests\Feature\Api;

use App\Models\User;
use App\Services\AuthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use Illuminate\Support\Facades\Hash;

class UnifiedAuthTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Enable Sanctum middleware for testing
        $this->withoutExceptionHandling();
    }

    /** @test */
    public function it_can_login_with_email_using_unified_auth_service()
    {
        // Create a test user
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'is_active' => true,
            'registration_step' => 'completed',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'message',
                    'user' => [
                        'id',
                        'email',
                    ],
                    'token',
                    'success',
                    'performance'
                ]);

        $this->assertTrue($response->json('success'));
        $this->assertEquals('Login realizado com sucesso', $response->json('message'));
    }

    /** @test */
    public function it_can_login_with_cpf_using_unified_auth_service()
    {
        // Create a test user with CPF
        $user = User::factory()->create([
            'cpf' => '12345678901',
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'is_active' => true,
            'registration_step' => 'completed',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => '12345678901', // Using CPF in email field
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'message',
                    'user',
                    'token',
                    'success'
                ]);

        $this->assertTrue($response->json('success'));
    }

    /** @test */
    public function it_handles_registration_incomplete_correctly()
    {
        // Create user with incomplete registration
        $user = User::factory()->create([
            'email' => 'incomplete@example.com',
            'password' => Hash::make('password123'),
            'is_active' => true,
            'registration_step' => 'step2', // Not completed
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'incomplete@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'message',
                    'registration_step',
                    'user_id'
                ]);

        $this->assertEquals('Registro incompleto', $response->json('message'));
        $this->assertEquals('step2', $response->json('registration_step'));
    }

    /** @test */
    public function it_rejects_invalid_credentials()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function it_handles_inactive_users()
    {
        $user = User::factory()->create([
            'email' => 'inactive@example.com',
            'password' => Hash::make('password123'),
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'inactive@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function it_can_logout_using_unified_auth_service()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'is_active' => true,
            'registration_step' => 'completed',
        ]);

        // Login first
        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('token');

        // Logout
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson('/api/auth/logout');

        $response->assertStatus(200)
                ->assertJson([
                    'message' => 'Logout realizado com sucesso'
                ]);
    }

    /** @test */
    public function it_can_get_authenticated_user_using_unified_auth_service()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'is_active' => true,
            'registration_step' => 'completed',
        ]);

        // Login first
        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('token');

        // Get user
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->getJson('/api/auth/user');

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'user' => [
                        'id',
                        'email',
                    ],
                    'performance'
                ]);
    }

    /** @test */
    public function it_can_refresh_token_using_unified_auth_service()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'is_active' => true,
            'registration_step' => 'completed',
        ]);

        // Login first
        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('token');

        // Refresh token
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson('/api/auth/refresh');

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'message',
                    'token',
                    'token_type'
                ]);

        $this->assertEquals('Bearer', $response->json('token_type'));
    }

    /** @test */
    public function it_can_check_email_exists()
    {
        User::factory()->create(['email' => 'existing@example.com']);

        // Check existing email
        $response = $this->postJson('/api/auth/check-email', [
            'email' => 'existing@example.com'
        ]);

        $response->assertStatus(200)
                ->assertJson(['exists' => true]);

        // Check non-existing email
        $response = $this->postJson('/api/auth/check-email', [
            'email' => 'notfound@example.com'
        ]);

        $response->assertStatus(200)
                ->assertJson(['exists' => false]);
    }

    /** @test */
    public function it_can_check_cpf_exists()
    {
        User::factory()->create(['cpf' => '12345678901']);

        // Check existing CPF
        $response = $this->postJson('/api/auth/check-cpf', [
            'cpf' => '123.456.789-01'
        ]);

        $response->assertStatus(200)
                ->assertJson(['exists' => true]);

        // Check non-existing CPF
        $response = $this->postJson('/api/auth/check-cpf', [
            'cpf' => '999.999.999-99'
        ]);

        $response->assertStatus(200)
                ->assertJson(['exists' => false]);
    }

    /** @test */
    public function it_implements_rate_limiting()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
        ]);

        // Make 6 failed attempts (limit is 5)
        for ($i = 0; $i < 6; $i++) {
            $response = $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'wrongpassword',
            ]);

            if ($i < 5) {
                $response->assertStatus(422);
            } else {
                // 6th attempt should be rate limited
                $response->assertStatus(422);
                $this->assertStringContains('Muitas tentativas de login', $response->json('errors.email.0'));
            }
        }
    }
}