<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;

class SocialAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        parent::tearDown();
        Mockery::close();
    }

    /**
     * Test redirect to Google OAuth
     */
    public function test_redirect_to_google_oauth(): void
    {
        // Mock Socialite
        $provider = Mockery::mock('Laravel\Socialite\Two\GoogleProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('redirect')->andReturnSelf();
        $provider->shouldReceive('getTargetUrl')->andReturn('https://accounts.google.com/oauth/authorize?client_id=test');

        Socialite::shouldReceive('driver')
            ->with('google')
            ->andReturn($provider);

        // Act
        $response = $this->getJson('/api/auth/google/redirect');

        // Assert
        $response->assertStatus(200)
            ->assertJson([
                'url' => 'https://accounts.google.com/oauth/authorize?client_id=test',
            ]);
    }

    /**
     * Test redirect to Facebook OAuth
     */
    public function test_redirect_to_facebook_oauth(): void
    {
        // Mock Socialite
        $provider = Mockery::mock('Laravel\Socialite\Two\FacebookProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('redirect')->andReturnSelf();
        $provider->shouldReceive('getTargetUrl')->andReturn('https://www.facebook.com/dialog/oauth?client_id=test');

        Socialite::shouldReceive('driver')
            ->with('facebook')
            ->andReturn($provider);

        // Act
        $response = $this->getJson('/api/auth/facebook/redirect');

        // Assert
        $response->assertStatus(200)
            ->assertJson([
                'url' => 'https://www.facebook.com/dialog/oauth?client_id=test',
            ]);
    }

    /**
     * Test redirect to Instagram OAuth (via Facebook)
     */
    public function test_redirect_to_instagram_oauth(): void
    {
        // Mock Socialite
        $provider = Mockery::mock('Laravel\Socialite\Two\FacebookProvider');
        $provider->shouldReceive('scopes')
            ->with(['instagram_basic', 'pages_show_list'])
            ->andReturnSelf();
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('redirect')->andReturnSelf();
        $provider->shouldReceive('getTargetUrl')->andReturn('https://www.facebook.com/dialog/oauth?scope=instagram_basic,pages_show_list');

        Socialite::shouldReceive('driver')
            ->with('facebook')
            ->andReturn($provider);

        // Act
        $response = $this->getJson('/api/auth/instagram/redirect');

        // Assert
        $response->assertStatus(200)
            ->assertJson([
                'url' => 'https://www.facebook.com/dialog/oauth?scope=instagram_basic,pages_show_list',
            ]);
    }

    /**
     * Test unsupported provider returns error
     */
    public function test_unsupported_provider_returns_error(): void
    {
        // Act
        $response = $this->getJson('/api/auth/twitter/redirect');

        // Assert
        $response->assertStatus(400)
            ->assertJson([
                'error' => 'Provedor não suportado',
            ]);
    }

    /**
     * Test successful Google OAuth callback with new user
     */
    public function test_google_oauth_callback_creates_new_user(): void
    {
        // Mock Socialite user
        $socialiteUser = Mockery::mock(SocialiteUser::class);
        $socialiteUser->shouldReceive('getId')->andReturn('google123');
        $socialiteUser->shouldReceive('getName')->andReturn('John Doe');
        $socialiteUser->shouldReceive('getEmail')->andReturn('john@gmail.com');
        $socialiteUser->shouldReceive('getAvatar')->andReturn('https://avatar.url/john.jpg');

        // Mock Socialite provider
        $provider = Mockery::mock('Laravel\Socialite\Two\GoogleProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->with('google')
            ->andReturn($provider);

        // Act
        $response = $this->get('/api/auth/google/callback?code=test_code');

        // Assert - Should redirect to frontend with token
        $response->assertStatus(302);
        $response->assertRedirect();
        
        $redirectUrl = $response->headers->get('Location');
        $this->assertStringStartsWith(env('FRONTEND_URL', 'http://localhost:3000') . '/callback?token=', $redirectUrl);

        // Verify user was created
        $this->assertDatabaseHas('users', [
            'email' => 'john@gmail.com',
            'name' => 'John Doe',
            'google_id' => 'google123',
            'social_provider' => 'google',
            'social_login' => true,
            'avatar_url' => 'https://avatar.url/john.jpg',
            'is_active' => true,
            'registration_step' => 'personal',
        ]);

        // Verify gamification was created
        $user = User::where('email', 'john@gmail.com')->first();
        $this->assertDatabaseHas('gamification_progress', [
            'user_id' => $user->id,
            'points' => 50, // Bonus for social signup
        ]);
    }

    /**
     * Test Google OAuth callback links to existing user
     */
    public function test_google_oauth_callback_links_existing_user(): void
    {
        // Arrange - Create existing user
        $existingUser = User::factory()->create([
            'email' => 'existing@gmail.com',
            'google_id' => null,
        ]);

        // Mock Socialite user
        $socialiteUser = Mockery::mock(SocialiteUser::class);
        $socialiteUser->shouldReceive('getId')->andReturn('google456');
        $socialiteUser->shouldReceive('getName')->andReturn('Existing User');
        $socialiteUser->shouldReceive('getEmail')->andReturn('existing@gmail.com');
        $socialiteUser->shouldReceive('getAvatar')->andReturn('https://avatar.url/existing.jpg');

        // Mock Socialite provider
        $provider = Mockery::mock('Laravel\Socialite\Two\GoogleProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->with('google')
            ->andReturn($provider);

        // Act
        $response = $this->get('/api/auth/google/callback?code=test_code');

        // Assert
        $response->assertStatus(302);

        // Verify user was updated with Google ID
        $existingUser->refresh();
        $this->assertEquals('google456', $existingUser->google_id);
        $this->assertEquals('google', $existingUser->social_provider);
        $this->assertTrue($existingUser->social_login);
        $this->assertEquals('https://avatar.url/existing.jpg', $existingUser->avatar_url);
    }

    /**
     * Test OAuth callback returns existing user with social ID
     */
    public function test_oauth_callback_returns_existing_user_with_social_id(): void
    {
        // Arrange - Create user with Google ID
        $existingUser = User::factory()->create([
            'email' => 'social@gmail.com',
            'google_id' => 'google789',
            'social_provider' => 'google',
        ]);

        // Mock Socialite user
        $socialiteUser = Mockery::mock(SocialiteUser::class);
        $socialiteUser->shouldReceive('getId')->andReturn('google789');
        $socialiteUser->shouldReceive('getName')->andReturn('Social User');
        $socialiteUser->shouldReceive('getEmail')->andReturn('social@gmail.com');
        $socialiteUser->shouldReceive('getAvatar')->andReturn('https://avatar.url/social.jpg');

        // Mock Socialite provider
        $provider = Mockery::mock('Laravel\Socialite\Two\GoogleProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->with('google')
            ->andReturn($provider);

        // Act
        $response = $this->get('/api/auth/google/callback?code=test_code');

        // Assert
        $response->assertStatus(302);

        // Verify no duplicate user was created
        $this->assertEquals(1, User::where('google_id', 'google789')->count());
    }

    /**
     * Test OAuth callback creates user without email
     */
    public function test_oauth_callback_creates_user_without_email(): void
    {
        // Mock Socialite user without email
        $socialiteUser = Mockery::mock(SocialiteUser::class);
        $socialiteUser->shouldReceive('getId')->andReturn('fb123');
        $socialiteUser->shouldReceive('getName')->andReturn('No Email User');
        $socialiteUser->shouldReceive('getEmail')->andReturn(null);
        $socialiteUser->shouldReceive('getAvatar')->andReturn(null);

        // Mock Socialite provider
        $provider = Mockery::mock('Laravel\Socialite\Two\FacebookProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->with('facebook')
            ->andReturn($provider);

        // Act
        $response = $this->get('/api/auth/facebook/callback?code=test_code');

        // Assert
        $response->assertStatus(302);

        // Verify user was created with generated email
        $this->assertDatabaseHas('users', [
            'name' => 'No Email User',
            'email' => 'fb123@facebook.social',
            'facebook_id' => 'fb123',
            'social_provider' => 'facebook',
        ]);
    }

    /**
     * Test OAuth callback handles provider errors
     */
    public function test_oauth_callback_handles_provider_errors(): void
    {
        // Mock Socialite provider to throw exception
        $provider = Mockery::mock('Laravel\Socialite\Two\GoogleProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andThrow(new \Exception('Invalid OAuth state'));

        Socialite::shouldReceive('driver')
            ->with('google')
            ->andReturn($provider);

        // Act
        $response = $this->get('/api/auth/google/callback?code=test_code');

        // Assert
        $response->assertStatus(500)
            ->assertJson([
                'error' => 'Erro na autenticação social: Invalid OAuth state',
            ]);
    }

    /**
     * Test Facebook OAuth creates user with correct provider
     */
    public function test_facebook_oauth_creates_user(): void
    {
        // Mock Socialite user
        $socialiteUser = Mockery::mock(SocialiteUser::class);
        $socialiteUser->shouldReceive('getId')->andReturn('fb456');
        $socialiteUser->shouldReceive('getName')->andReturn('Facebook User');
        $socialiteUser->shouldReceive('getEmail')->andReturn('fbuser@facebook.com');
        $socialiteUser->shouldReceive('getAvatar')->andReturn('https://graph.facebook.com/avatar.jpg');

        // Mock Socialite provider
        $provider = Mockery::mock('Laravel\Socialite\Two\FacebookProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->with('facebook')
            ->andReturn($provider);

        // Act
        $response = $this->get('/api/auth/facebook/callback?code=test_code');

        // Assert
        $response->assertStatus(302);

        // Verify user was created with Facebook data
        $this->assertDatabaseHas('users', [
            'email' => 'fbuser@facebook.com',
            'name' => 'Facebook User',
            'facebook_id' => 'fb456',
            'social_provider' => 'facebook',
            'social_login' => true,
        ]);
    }

    /**
     * Test Instagram OAuth through Facebook
     */
    public function test_instagram_oauth_through_facebook(): void
    {
        // Mock Socialite user (Instagram via Facebook)
        $socialiteUser = Mockery::mock(SocialiteUser::class);
        $socialiteUser->shouldReceive('getId')->andReturn('insta789');
        $socialiteUser->shouldReceive('getName')->andReturn('Instagram User');
        $socialiteUser->shouldReceive('getEmail')->andReturn('insta@example.com');
        $socialiteUser->shouldReceive('getAvatar')->andReturn('https://instagram.com/avatar.jpg');

        // Mock Socialite provider
        $provider = Mockery::mock('Laravel\Socialite\Two\FacebookProvider');
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->with('facebook')
            ->andReturn($provider);

        // Act
        $response = $this->get('/api/auth/instagram/callback?code=test_code');

        // Assert
        $response->assertStatus(302);

        // Verify user was created
        $this->assertDatabaseHas('users', [
            'email' => 'insta@example.com',
            'name' => 'Instagram User',
            'instagram_id' => 'insta789',
            'social_provider' => 'instagram',
        ]);
    }
}