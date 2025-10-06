<?php

namespace Tests\Contract;

use App\Models\User;
use Spectator\Spectator;
use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * API Contract Tests - Validates OpenAPI Specification Compliance
 *
 * Uses Spectator package to validate requests/responses against
 * the OpenAPI spec defined in docs/API_SPEC.yaml
 */
class ApiSpecValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Spectator::using('docs/API_SPEC.yaml');
    }

    /** @test */
    public function register_endpoint_matches_openapi_spec()
    {
        $this->postJson('/api/auth/register', [
            'email' => 'test@example.com',
            'password' => 'SecurePass123!',
        ])
        ->assertValidRequest()
        ->assertValidResponse(201);
    }

    /** @test */
    public function register_validation_errors_match_openapi_spec()
    {
        $this->postJson('/api/auth/register', [
            'email' => 'invalid-email',
        ])
        ->assertValidRequest()
        ->assertValidResponse(422);
    }

    /** @test */
    public function verify_endpoint_matches_openapi_spec()
    {
        $user = User::factory()->create([
            'email_verification_token' => 'test-token-12345',
            'email_verified_at' => null,
        ]);

        $this->postJson('/api/auth/verify', [
            'token' => 'test-token-12345',
        ])
        ->assertValidRequest()
        ->assertValidResponse(200);
    }

    /** @test */
    public function verify_invalid_token_matches_openapi_spec()
    {
        $this->postJson('/api/auth/verify', [
            'token' => 'invalid-token',
        ])
        ->assertValidRequest()
        ->assertValidResponse(400);
    }

    /** @test */
    public function points_history_endpoint_matches_openapi_spec()
    {
        $user = $this->actingAsUser();

        // Create some points history
        $user->gamificationProgress()->create([
            'points' => 100,
            'current_level' => 1,
        ]);

        $this->getJson('/api/gamification/points/history')
            ->assertValidRequest()
            ->assertValidResponse(200);
    }

    /** @test */
    public function document_upload_endpoint_matches_openapi_spec()
    {
        $user = $this->actingAsUser();

        $this->postJson('/api/documents/upload', [
            'type' => 'rg',
            'file' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ])
        ->assertValidRequest()
        ->assertValidResponse(201);
    }

    /** @test */
    public function document_status_endpoint_matches_openapi_spec()
    {
        $user = $this->actingAsUser();

        $this->getJson('/api/documents/status')
            ->assertValidRequest()
            ->assertValidResponse(200);
    }

    /** @test */
    public function badges_list_endpoint_matches_openapi_spec()
    {
        $user = $this->actingAsUser();

        $this->getJson('/api/gamification/badges')
            ->assertValidRequest()
            ->assertValidResponse(200);
    }

    /** @test */
    public function unauthorized_request_matches_openapi_spec()
    {
        $this->getJson('/api/gamification/points/history')
            ->assertValidRequest()
            ->assertValidResponse(401);
    }

    /** @test */
    public function rate_limit_exceeded_matches_openapi_spec()
    {
        // Simulate rate limit exceeded
        for ($i = 0; $i < 61; $i++) {
            $response = $this->postJson('/api/auth/register', [
                'email' => "test{$i}@example.com",
                'password' => 'SecurePass123!',
            ]);
        }

        $response->assertValidRequest()
                 ->assertValidResponse(429);
    }

    /** @test */
    public function csrf_token_endpoint_matches_openapi_spec()
    {
        $this->getJson('/sanctum/csrf-cookie')
            ->assertValidRequest()
            ->assertValidResponse(204);
    }

    /** @test */
    public function health_check_endpoint_matches_openapi_spec()
    {
        $this->getJson('/api/health')
            ->assertValidRequest()
            ->assertValidResponse(200);
    }

    /**
     * Helper method to create an authenticated user
     */
    protected function actingAsUser(): User
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user, 'sanctum');

        return $user;
    }
}
