<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AuthenticationEdgeCasesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Clear rate limiters
        RateLimiter::clear('test@example.com|127.0.0.1');
    }

    /**
     * Test login with SQL injection attempt
     */
    public function test_login_prevents_sql_injection(): void
    {
        // Arrange
        User::factory()->create([
            'email' => 'admin@example.com',
            'password' => Hash::make('password123'),
        ]);

        // Act - Attempt SQL injection
        $response = $this->postJson('/api/auth/login', [
            'email' => "admin@example.com' OR '1'='1",
            'password' => "' OR '1'='1",
        ]);

        // Assert - Should fail validation or authentication
        $response->assertStatus(422);
        
        // Verify no unauthorized access
        $this->assertGuest();
    }

    /**
     * Test login with XSS attempt in device name
     */
    public function test_login_sanitizes_device_name(): void
    {
        // Arrange
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'registration_step' => 'completed',
            'is_active' => true,
        ]);

        // Act - Attempt XSS in device name
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
            'device_name' => '<script>alert("XSS")</script>',
        ]);

        // Assert
        $response->assertStatus(200);
        
        // Verify token name is sanitized
        $token = $user->tokens()->latest()->first();
        $this->assertNotNull($token);
        $this->assertStringNotContainsString('<script>', $token->name);
    }

    /**
     * Test login with very long email
     */
    public function test_login_with_very_long_email(): void
    {
        // Arrange
        $longEmail = str_repeat('a', 255) . '@example.com';

        // Act
        $response = $this->postJson('/api/auth/login', [
            'email' => $longEmail,
            'password' => 'password123',
        ]);

        // Assert - Should fail validation
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /**
     * Test login with Unicode characters in email
     */
    public function test_login_with_unicode_email(): void
    {
        // Arrange
        $unicodeEmail = 'tëst@éxämplë.com';
        $user = User::factory()->create([
            'email' => $unicodeEmail,
            'password' => Hash::make('password123'),
            'registration_step' => 'completed',
            'is_active' => true,
        ]);

        // Create beneficiary for the user
        Beneficiary::factory()->create(['user_id' => $user->id]);

        // Act
        $response = $this->postJson('/api/auth/login', [
            'email' => $unicodeEmail,
            'password' => 'password123',
        ]);

        // Assert - Should handle Unicode properly
        $response->assertStatus(200);
    }

    /**
     * Test login with CPF containing special characters
     */
    public function test_login_with_formatted_cpf(): void
    {
        // Arrange
        $user = User::factory()->create([
            'cpf' => '12345678901', // Stored without formatting
            'password' => Hash::make('password123'),
            'registration_step' => 'completed',
            'is_active' => true,
        ]);

        $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);

        // Act - Login with formatted CPF (sent as email field)
        $response = $this->postJson('/api/auth/login', [
            'email' => '123.456.789-01', // CPF with formatting sent as email field
            'password' => 'password123',
        ]);

        // Assert - Should clean CPF and authenticate
        $response->assertStatus(200);
    }

    /**
     * Test concurrent login requests
     */
    public function test_concurrent_login_requests(): void
    {
        // Arrange
        $user = User::factory()->create([
            'email' => 'concurrent@example.com',
            'password' => Hash::make('password123'),
            'registration_step' => 'completed',
            'is_active' => true,
        ]);

        // Act - Simulate concurrent requests
        $promises = [];
        for ($i = 0; $i < 5; $i++) {
            $promises[] = $this->postJson('/api/auth/login', [
                'email' => 'concurrent@example.com',
                'password' => 'password123',
                'device_name' => "device-$i",
            ]);
        }

        // Assert - All should succeed
        foreach ($promises as $response) {
            $response->assertStatus(200);
        }

        // Verify 5 tokens were created
        $this->assertCount(5, $user->fresh()->tokens);
    }

    /**
     * Test registration with race condition
     */
    public function test_registration_prevents_duplicate_users(): void
    {
        // This test simulates a race condition where two requests
        // try to register the same email simultaneously

        // Act - First request
        $response1 = $this->postJson('/api/auth/register', [
            'name' => 'Test User',
            'email' => 'race@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'cpf' => '11111111111',
        ]);

        // Act - Second request with same email
        $response2 = $this->postJson('/api/auth/register', [
            'name' => 'Another User',
            'email' => 'race@example.com',
            'password' => 'password456',
            'password_confirmation' => 'password456',
            'cpf' => '22222222222',
        ]);

        // Assert - First should succeed
        $response1->assertStatus(201);
        
        // Assert - Second should fail
        $response2->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        // Verify only one user was created
        $this->assertEquals(1, User::where('email', 'race@example.com')->count());
    }

    /**
     * Test account recovery after lockout
     */
    public function test_account_recovery_after_lockout(): void
    {
        // Arrange
        $user = User::factory()->create([
            'email' => 'locked@example.com',
            'password' => Hash::make('password123'),
            'failed_login_attempts' => 5,
            'locked_until' => Carbon::now()->addMinutes(30),
        ]);

        // Act - Try to login while locked
        $response = $this->postJson('/api/auth/login', [
            'email' => 'locked@example.com',
            'password' => 'password123',
        ]);

        // Assert - Should be locked
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        // Act - Travel to future when lock expires
        $this->travel(31)->minutes();

        // Try to login again
        $response = $this->postJson('/api/auth/login', [
            'email' => 'locked@example.com',
            'password' => 'password123',
        ]);

        // Assert - Should succeed after lock expires
        $response->assertStatus(200);
        
        // Verify counters were reset
        $user->refresh();
        $this->assertEquals(0, $user->failed_login_attempts);
        $this->assertNull($user->locked_until);
    }

    /**
     * Test registration rollback on database error
     */
    public function test_registration_rollback_on_error(): void
    {
        // Mock a database error during beneficiary creation
        DB::shouldReceive('beginTransaction')->once()->andReturnNull();
        DB::shouldReceive('commit')->never();
        DB::shouldReceive('rollBack')->once()->andReturnNull();

        // Arrange - Force an error by mocking
        $this->mock(Beneficiary::class, function ($mock) {
            $mock->shouldReceive('create')
                ->andThrow(new \Exception('Database error'));
        });

        // Act
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Rollback Test',
            'email' => 'rollback@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'cpf' => '99999999999',
        ]);

        // Assert
        $response->assertStatus(500)
            ->assertJson([
                'message' => 'Registration failed',
            ]);

        // Verify user was not created
        $this->assertDatabaseMissing('users', [
            'email' => 'rollback@example.com',
        ]);
    }

    /**
     * Test malformed JSON in request
     */
    public function test_malformed_json_request(): void
    {
        // Act - Send malformed JSON
        $response = $this->call('POST', '/api/auth/login', [], [], [], [
            'HTTP_CONTENT_TYPE' => 'application/json',
        ], '{"email": "test@example.com", "password": "invalid json');

        // Assert
        $response->assertStatus(400); // Bad Request
    }

    /**
     * Test empty request body
     */
    public function test_empty_request_body(): void
    {
        // Act
        $response = $this->postJson('/api/auth/login', []);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    /**
     * Test registration with null values
     */
    public function test_registration_with_null_values(): void
    {
        // Act
        $response = $this->postJson('/api/auth/register', [
            'name' => null,
            'email' => null,
            'password' => null,
            'cpf' => null,
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'password', 'cpf']);
    }

    /**
     * Test token with invalid format
     */
    public function test_invalid_token_format(): void
    {
        // Act - Various invalid token formats
        $invalidTokens = [
            'invalid-token',
            'Bearer invalid',
            '123456',
            '',
            'null',
            'undefined',
        ];

        foreach ($invalidTokens as $token) {
            $response = $this->withHeader('Authorization', 'Bearer ' . $token)
                ->getJson('/api/auth/user');

            // Assert
            $response->assertStatus(401);
        }
    }

    /**
     * Test database connection failure
     */
    public function test_handles_database_connection_failure(): void
    {
        // Mock database connection failure
        DB::shouldReceive('table')->andThrow(new \PDOException('Connection refused'));

        // Act
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
        ]);

        // Assert - Should return 500 error
        $response->assertStatus(500);
    }

    /**
     * Test CORS headers are present
     */
    public function test_cors_headers_present(): void
    {
        // Act - Test preflight OPTIONS request
        $response = $this->withHeaders([
            'Origin' => 'https://localhost:3000',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'Content-Type, Authorization',
        ])->options('/api/auth/login');

        // Assert - Check for CORS headers
        $response->assertHeader('Access-Control-Allow-Methods')
                 ->assertHeader('Access-Control-Allow-Origin')
                 ->assertHeader('Access-Control-Allow-Headers');
    }
}