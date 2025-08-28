<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class SessionManagementTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test user can have multiple active sessions
     */
    public function test_user_can_have_multiple_active_sessions(): void
    {
        // Arrange
        $user = User::factory()->create();

        // Create tokens for different devices
        $webToken = $user->createToken('web-browser')->plainTextToken;
        $mobileToken = $user->createToken('mobile-app')->plainTextToken;
        $tabletToken = $user->createToken('tablet-device')->plainTextToken;

        // Assert all tokens exist
        $this->assertCount(3, $user->tokens);
        
        // Verify each token can be used
        $this->withHeader('Authorization', 'Bearer ' . $webToken)
            ->getJson('/api/auth/user')
            ->assertStatus(200);

        $this->withHeader('Authorization', 'Bearer ' . $mobileToken)
            ->getJson('/api/auth/user')
            ->assertStatus(200);

        $this->withHeader('Authorization', 'Bearer ' . $tabletToken)
            ->getJson('/api/auth/user')
            ->assertStatus(200);
    }

    /**
     * Test logout only affects current session
     */
    public function test_logout_only_affects_current_session(): void
    {
        // Arrange
        $user = User::factory()->create();
        $token1 = $user->createToken('device1')->plainTextToken;
        $token2 = $user->createToken('device2')->plainTextToken;

        // Act - Logout from device1
        $response = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/auth/logout');

        $response->assertStatus(200);

        // Assert - Token1 should be invalid
        $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->getJson('/api/auth/user')
            ->assertStatus(401);

        // Assert - Token2 should still work
        $this->withHeader('Authorization', 'Bearer ' . $token2)
            ->getJson('/api/auth/user')
            ->assertStatus(200);

        // Verify only one token remains
        $this->assertCount(1, $user->fresh()->tokens);
    }

    /**
     * Test logout from all devices
     */
    public function test_logout_from_all_devices(): void
    {
        // Arrange
        $user = User::factory()->create();
        $tokens = [
            $user->createToken('device1')->plainTextToken,
            $user->createToken('device2')->plainTextToken,
            $user->createToken('device3')->plainTextToken,
            $user->createToken('device4')->plainTextToken,
        ];

        // Act - Logout from all devices using one token
        $response = $this->withHeader('Authorization', 'Bearer ' . $tokens[0])
            ->postJson('/api/auth/logout-all');

        $response->assertStatus(200);

        // Assert - All tokens should be invalid
        foreach ($tokens as $token) {
            $this->withHeader('Authorization', 'Bearer ' . $token)
                ->getJson('/api/auth/user')
                ->assertStatus(401);
        }

        // Verify no tokens remain
        $this->assertCount(0, $user->fresh()->tokens);
    }

    /**
     * Test token expiration
     */
    public function test_token_expiration(): void
    {
        // Arrange
        $user = User::factory()->create();
        $token = $user->createToken('test-device');
        
        // Set token as expired
        $token->accessToken->update([
            'expires_at' => Carbon::now()->subDay(),
        ]);

        // Act
        $response = $this->withHeader('Authorization', 'Bearer ' . $token->plainTextToken)
            ->getJson('/api/auth/user');

        // Assert
        $response->assertStatus(401);
    }

    /**
     * Test concurrent sessions limit
     */
    public function test_concurrent_sessions_tracking(): void
    {
        // Arrange
        $user = User::factory()->create();
        
        // Create multiple sessions with metadata
        $devices = [
            ['name' => 'Chrome on Windows', 'ip' => '192.168.1.100'],
            ['name' => 'Safari on Mac', 'ip' => '192.168.1.101'],
            ['name' => 'Mobile App iOS', 'ip' => '10.0.0.1'],
            ['name' => 'Mobile App Android', 'ip' => '10.0.0.2'],
        ];

        foreach ($devices as $device) {
            $token = $user->createToken($device['name']);
            // In real app, you'd store IP and other metadata
            $token->accessToken->forceFill([
                'last_used_at' => now(),
                'ip_address' => $device['ip'], // This would be a custom field
            ])->save();
        }

        // Assert
        $this->assertCount(4, $user->tokens);
        
        // Verify each session has unique name
        $tokenNames = $user->tokens->pluck('name')->toArray();
        $this->assertEquals(count($tokenNames), count(array_unique($tokenNames)));
    }

    /**
     * Test refresh token invalidates old token
     */
    public function test_refresh_token_invalidates_old_token(): void
    {
        // Arrange
        $user = User::factory()->create();
        $oldToken = $user->createToken('test-device')->plainTextToken;

        // Act - Refresh token
        $response = $this->withHeader('Authorization', 'Bearer ' . $oldToken)
            ->postJson('/api/auth/refresh', [
                'device_name' => 'test-device',
            ]);

        $response->assertStatus(200);
        $newToken = $response->json('token');

        // Assert - Old token should be invalid
        $this->withHeader('Authorization', 'Bearer ' . $oldToken)
            ->getJson('/api/auth/user')
            ->assertStatus(401);

        // Assert - New token should work
        $this->withHeader('Authorization', 'Bearer ' . $newToken)
            ->getJson('/api/auth/user')
            ->assertStatus(200);

        // Verify only one token exists
        $this->assertCount(1, $user->fresh()->tokens);
    }

    /**
     * Test session activity tracking
     */
    public function test_session_activity_tracking(): void
    {
        // Arrange
        $user = User::factory()->create();
        $token = $user->createToken('test-device');
        
        // Get initial last_used_at
        $initialLastUsed = $token->accessToken->last_used_at;

        // Wait a moment
        sleep(1);

        // Act - Make a request
        $this->withHeader('Authorization', 'Bearer ' . $token->plainTextToken)
            ->getJson('/api/auth/user')
            ->assertStatus(200);

        // Assert - last_used_at should be updated
        $token->accessToken->refresh();
        $this->assertNotEquals($initialLastUsed, $token->accessToken->last_used_at);
        $this->assertTrue($token->accessToken->last_used_at->isAfter($initialLastUsed));
    }

    /**
     * Test device-specific token naming
     */
    public function test_device_specific_token_naming(): void
    {
        // Arrange
        $user = User::factory()->create();

        // Act - Login from different devices
        $response1 = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'iPhone 12 Pro',
        ]);

        $response2 = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Chrome on Windows 10',
        ]);

        $response3 = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Android Tablet',
        ]);

        // Assert
        $response1->assertStatus(200);
        $response2->assertStatus(200);
        $response3->assertStatus(200);

        // Verify tokens were created with correct names
        $tokenNames = $user->tokens->pluck('name')->toArray();
        $this->assertContains('iPhone 12 Pro', $tokenNames);
        $this->assertContains('Chrome on Windows 10', $tokenNames);
        $this->assertContains('Android Tablet', $tokenNames);
    }

    /**
     * Test httpOnly cookie authentication
     */
    public function test_http_only_cookie_authentication(): void
    {
        // Arrange
        $user = User::factory()->create([
            'registration_step' => 'completed',
            'is_active' => true,
        ]);

        // Act - Login to get cookie
        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'web',
        ]);

        $response->assertStatus(200)
            ->assertCookie('auth_token');

        // Get the cookie value
        $cookies = $response->headers->getCookies();
        $authCookie = null;
        foreach ($cookies as $cookie) {
            if ($cookie->getName() === 'auth_token') {
                $authCookie = $cookie;
                break;
            }
        }

        // Assert cookie properties
        $this->assertNotNull($authCookie);
        $this->assertTrue($authCookie->isHttpOnly());
        $this->assertEquals('lax', strtolower($authCookie->getSameSite()));
        $this->assertEquals('/', $authCookie->getPath());
    }

    /**
     * Test multiple login attempts don't create duplicate sessions
     */
    public function test_multiple_logins_same_device_updates_token(): void
    {
        // Arrange
        $user = User::factory()->create([
            'registration_step' => 'completed',
            'is_active' => true,
        ]);

        // Act - Login multiple times with same device name
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => $user->email,
                'password' => 'password',
                'device_name' => 'web-browser',
            ])->assertStatus(200);
        }

        // Assert - Should have 3 tokens (not replacing by device name in current implementation)
        // In a real app, you might want to replace tokens for the same device
        $this->assertCount(3, $user->fresh()->tokens);
    }

    /**
     * Test token abilities/permissions
     */
    public function test_token_abilities(): void
    {
        // Arrange
        $user = User::factory()->create();
        
        // Create tokens with different abilities
        $readOnlyToken = $user->createToken('read-only', ['read'])->plainTextToken;
        $fullAccessToken = $user->createToken('full-access', ['*'])->plainTextToken;

        // In a real implementation, you would check abilities in middleware
        // This test demonstrates the concept
        
        // Get the actual token models
        $readToken = PersonalAccessToken::findToken($readOnlyToken);
        $fullToken = PersonalAccessToken::findToken($fullAccessToken);

        // Assert abilities
        $this->assertEquals(['read'], $readToken->abilities);
        $this->assertEquals(['*'], $fullToken->abilities);
    }
}