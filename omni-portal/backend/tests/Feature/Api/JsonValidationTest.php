<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithoutMiddleware;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class JsonValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Disable rate limiting for tests
        $this->withoutMiddleware(\App\Http\Middleware\ApiRateLimiter::class);

        // Create test user
        User::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'cpf' => '11111111111',
            'password' => Hash::make('TestPassword123'),
            'registration_step' => 'completed',
            'lgpd_consent' => true,
            'lgpd_consent_at' => now(),
            'lgpd_consent_ip' => '127.0.0.1',
            'role' => 'beneficiary',
            'is_active' => true,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    /** @test */
    public function it_accepts_valid_json_with_simple_password()
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'TestPassword123'
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user',
                'token',
                'success',
                'performance'
            ]);
    }

    /** @test */
    public function it_accepts_valid_json_with_special_characters_in_password()
    {
        // Update user with special character password
        $user = User::where('email', 'test@example.com')->first();
        $user->update(['password' => Hash::make('Test@Password123!')]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'Test@Password123!'
        ]);

        $response->assertStatus(422) // Will fail because user needs beneficiary record
            ->assertJsonMissing(['message' => 'Invalid JSON format']);
    }

    /** @test */
    public function it_rejects_malformed_json()
    {
        $response = $this->call(
            'POST',
            '/api/auth/login',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json'
            ],
            '{"email":"test@example.com","password":"test"' // Missing closing brace
        );

        $response->assertStatus(400)
            ->assertJson([
                'message' => 'Invalid JSON format',
                'error' => 'Bad Request',
                'code' => 'INVALID_JSON'
            ]);
    }

    /** @test */
    public function it_rejects_json_with_invalid_syntax()
    {
        $response = $this->call(
            'POST',
            '/api/auth/login',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json'
            ],
            '{"email":"test@example.com","password":}' // Invalid syntax
        );

        $response->assertStatus(400)
            ->assertJson([
                'message' => 'Invalid JSON format',
                'error' => 'Bad Request',
                'code' => 'INVALID_JSON'
            ]);
    }

    /** @test */
    public function it_provides_debug_info_when_app_debug_is_true()
    {
        config(['app.debug' => true]);

        $response = $this->call(
            'POST',
            '/api/auth/login',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json'
            ],
            '{"email":"test@example.com","invalid":}' // Invalid JSON
        );

        $response->assertStatus(400)
            ->assertJson([
                'message' => 'Invalid JSON format',
                'error' => 'Bad Request',
                'code' => 'INVALID_JSON'
            ])
            ->assertJsonStructure([
                'details' => [
                    'json_error',
                    'content_preview'
                ]
            ]);
    }

    /** @test */
    public function it_hides_debug_info_when_app_debug_is_false()
    {
        config(['app.debug' => false]);

        $response = $this->call(
            'POST',
            '/api/auth/login',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json'
            ],
            '{"email":"test@example.com","invalid":}' // Invalid JSON
        );

        $response->assertStatus(400)
            ->assertJson([
                'message' => 'Invalid JSON format',
                'error' => 'Bad Request',
                'code' => 'INVALID_JSON',
                'details' => null
            ]);
    }

    /** @test */
    public function it_accepts_json_with_unicode_characters()
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'TestPassword123',
            'device_name' => 'iPhone de José'
        ]);

        $response->assertStatus(200); // Unicode characters should work fine
        $this->assertStringNotContainsString('Invalid JSON format', $response->content());
    }

    /** @test */
    public function it_handles_empty_json_body()
    {
        $response = $this->call(
            'POST',
            '/api/auth/login',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json'
            ],
            '' // Empty body
        );

        // Should not trigger JSON validation error for empty body
        $response->assertStatus(422); // Laravel validation error for missing fields
        $this->assertStringNotContainsString('Invalid JSON format', $response->content());
    }

    /** @test */
    public function it_accepts_json_with_escaped_quotes()
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'TestPassword123',
            'device_name' => 'User\'s "Device"'
        ]);

        $response->assertStatus(200); // Escaped quotes should work fine
        $this->assertStringNotContainsString('Invalid JSON format', $response->content());
    }

    /** @test */
    public function it_properly_handles_content_type_variations()
    {
        $contentTypes = [
            'application/json',
            'application/json; charset=utf-8',
            'APPLICATION/JSON',
            'application/JSON'
        ];

        foreach ($contentTypes as $contentType) {
            $response = $this->call(
                'POST',
                '/api/auth/login',
                [],
                [],
                [],
                [
                    'CONTENT_TYPE' => $contentType,
                    'HTTP_ACCEPT' => 'application/json'
                ],
                '{"email":"test@example.com","password":"TestPassword123"}'
            );

            // Should not return JSON validation error
            $this->assertStringNotContainsString('Invalid JSON format', $response->content());
        }
    }
}