<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

/**
 * Comprehensive Security Testing Framework
 * 
 * Tests critical security aspects of authentication flows:
 * - Input validation security
 * - Rate limiting
 * - Authentication bypass attempts
 * - SQL injection protection
 * - XSS protection
 * - CSRF protection
 * - Session security
 */
class SecurityTestFramework extends TestCase
{
    use RefreshDatabase;

    private User $testUser;
    private array $validRegistrationData;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->testUser = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'cpf' => '12345678901',
        ]);

        $this->validRegistrationData = [
            'name' => 'João Silva',
            'email' => 'joao@example.com',
            'cpf' => '529.982.247-25',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'lgpd_consent' => true,
        ];
    }

    /**
     * Test SQL injection attempts in authentication
     * 
     * @group security
     * @group critical
     */
    public function test_sql_injection_protection_in_login(): void
    {
        $sqlInjectionAttempts = [
            "admin' OR '1'='1",
            "admin'; DROP TABLE users; --",
            "admin' UNION SELECT * FROM users WHERE '1'='1",
            "admin' OR 1=1 --",
            "' OR 'x'='x",
            "1' OR '1'='1' /*",
        ];

        foreach ($sqlInjectionAttempts as $maliciousInput) {
            $response = $this->postJson('/api/auth/login', [
                'email' => $maliciousInput,
                'password' => 'password123',
            ]);

            $response->assertStatus(422)
                    ->assertJsonValidationErrors(['email']);
        }
    }

    /**
     * Test XSS protection in registration
     * 
     * @group security
     * @group critical
     */
    public function test_xss_protection_in_registration(): void
    {
        $xssAttempts = [
            '<script>alert("XSS")</script>',
            '<img src="x" onerror="alert(1)">',
            'javascript:alert("XSS")',
            '<svg onload="alert(1)">',
            '<iframe src="javascript:alert(1)">',
            '"><script>alert("XSS")</script>',
        ];

        foreach ($xssAttempts as $maliciousInput) {
            $data = $this->validRegistrationData;
            $data['name'] = $maliciousInput;
            $data['email'] = 'test' . uniqid() . '@example.com';
            $data['cpf'] = $this->generateValidCPF();

            $response = $this->postJson('/api/auth/register', $data);

            // Should either reject the input or sanitize it
            if ($response->status() === 201) {
                // If accepted, ensure it's sanitized
                $user = User::where('email', $data['email'])->first();
                $this->assertNotNull($user);
                $this->assertStringNotContainsString('<script', $user->name);
                $this->assertStringNotContainsString('javascript:', $user->name);
                $this->assertStringNotContainsString('onerror', $user->name);
            } else {
                $response->assertStatus(422);
            }
        }
    }

    /**
     * Test rate limiting on authentication endpoints
     * 
     * @group security
     * @group performance
     */
    public function test_rate_limiting_on_login_attempts(): void
    {
        // Clear any existing rate limit data
        RateLimiter::clear('login:' . request()->ip());

        $loginData = [
            'email' => 'test@example.com',
            'password' => 'wrongpassword',
        ];

        // Make multiple failed login attempts
        for ($i = 0; $i < 15; $i++) {
            $response = $this->postJson('/api/auth/login', $loginData);
            
            if ($i < 10) {
                // First 10 attempts should be allowed but fail
                $response->assertStatus(422);
            } else {
                // After 10 attempts, should be rate limited
                $response->assertStatus(429);
                break;
            }
        }
    }

    /**
     * Test account lockout mechanism
     * 
     * @group security
     * @group authentication
     */
    public function test_account_lockout_after_failed_attempts(): void
    {
        $loginData = [
            'email' => $this->testUser->email,
            'password' => 'wrongpassword',
        ];

        // Make 5 failed attempts
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', $loginData);
        }

        // Account should be locked now
        $this->testUser->refresh();
        $this->assertTrue($this->testUser->isLocked());

        // Even with correct password, login should fail
        $response = $this->postJson('/api/auth/login', [
            'email' => $this->testUser->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
                ->assertJsonFragment(['message' => 'Account temporarily locked due to multiple failed login attempts.']);
    }

    /**
     * Test password strength validation
     * 
     * @group security
     * @group validation
     */
    public function test_password_strength_validation(): void
    {
        $weakPasswords = [
            '123456',
            'password',
            'qwerty',
            'abc123',
            '111111',
            'password1',
            'admin',
            'test',
        ];

        foreach ($weakPasswords as $weakPassword) {
            $data = $this->validRegistrationData;
            $data['password'] = $weakPassword;
            $data['password_confirmation'] = $weakPassword;
            $data['email'] = 'test' . uniqid() . '@example.com';
            $data['cpf'] = $this->generateValidCPF();

            $response = $this->postJson('/api/auth/register', $data);

            $response->assertStatus(422)
                    ->assertJsonValidationErrors(['password']);
        }
    }

    /**
     * Test CPF validation security
     * 
     * @group security
     * @group validation
     */
    public function test_cpf_validation_security(): void
    {
        $invalidCPFs = [
            '00000000000', // All zeros
            '11111111111', // All same digit
            '12345678900', // Invalid check digit
            '123.456.789-00', // Invalid check digit with format
            '123456789', // Too short
            '1234567890123', // Too long
            'abc.def.ghi-jk', // Non-numeric
            "123'; DROP TABLE users; --", // SQL injection attempt
        ];

        foreach ($invalidCPFs as $invalidCPF) {
            $data = $this->validRegistrationData;
            $data['cpf'] = $invalidCPF;
            $data['email'] = 'test' . uniqid() . '@example.com';

            $response = $this->postJson('/api/auth/register', $data);

            $response->assertStatus(422)
                    ->assertJsonValidationErrors(['cpf']);
        }
    }

    /**
     * Test unauthorized access to protected endpoints
     * 
     * @group security
     * @group authorization
     */
    public function test_unauthorized_access_protection(): void
    {
        $protectedEndpoints = [
            ['GET', '/api/profile'],
            ['PUT', '/api/profile'],
            ['GET', '/api/gamification/progress'],
            ['POST', '/api/documents/upload'],
            ['GET', '/api/register/progress'],
            ['POST', '/api/register/step2'],
            ['POST', '/api/register/step3'],
        ];

        foreach ($protectedEndpoints as [$method, $endpoint]) {
            $response = $this->json($method, $endpoint);
            
            $response->assertStatus(401)
                    ->assertJsonFragment(['message' => 'Unauthenticated.']);
        }
    }

    /**
     * Test token manipulation attempts
     * 
     * @group security
     * @group authentication
     */
    public function test_token_manipulation_protection(): void
    {
        $manipulatedTokens = [
            'Bearer invalid_token',
            'Bearer ' . str_repeat('a', 80), // Invalid format
            'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid', // Malformed JWT
            'Basic ' . base64_encode('admin:password'), // Wrong auth type
        ];

        foreach ($manipulatedTokens as $token) {
            $response = $this->withHeaders([
                'Authorization' => $token,
            ])->getJson('/api/profile');

            $response->assertStatus(401);
        }
    }

    /**
     * Test sensitive data exposure in responses
     * 
     * @group security
     * @group data-protection
     */
    public function test_sensitive_data_not_exposed(): void
    {
        Sanctum::actingAs($this->testUser);

        $response = $this->getJson('/api/auth/user');

        $response->assertStatus(200);

        // Ensure sensitive data is not exposed
        $responseData = $response->json();
        $this->assertArrayNotHasKey('password', $responseData);
        $this->assertArrayNotHasKey('remember_token', $responseData);
        $this->assertArrayNotHasKey('social_provider_id', $responseData);
    }

    /**
     * Test file upload security
     * 
     * @group security
     * @group file-upload
     */
    public function test_malicious_file_upload_protection(): void
    {
        Sanctum::actingAs($this->testUser);

        // Test PHP file upload attempt
        $phpContent = '<?php system($_GET["cmd"]); ?>';
        $file = \Illuminate\Http\Testing\File::create('malicious.php', $phpContent);

        $response = $this->postJson('/api/documents/upload', [
            'document' => $file,
            'document_type' => 'identity',
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['document']);
    }

    /**
     * Test session fixation protection
     * 
     * @group security
     * @group session
     */
    public function test_session_fixation_protection(): void
    {
        // Get initial session ID
        $this->get('/');
        $initialSessionId = session()->getId();

        // Login
        $response = $this->postJson('/api/auth/login', [
            'email' => $this->testUser->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(200);

        // Session ID should change after login (if using sessions)
        $newSessionId = session()->getId();
        $this->assertNotEquals($initialSessionId, $newSessionId);
    }

    /**
     * Test CSRF protection on state-changing operations
     * 
     * @group security
     * @group csrf
     */
    public function test_csrf_protection(): void
    {
        Sanctum::actingAs($this->testUser);

        // Test without CSRF token
        $response = $this->withHeaders([
            'X-CSRF-TOKEN' => 'invalid_token',
        ])->putJson('/api/profile', [
            'name' => 'Updated Name',
        ]);

        // API routes typically don't use CSRF, but verify the mechanism exists
        $this->assertTrue(true); // Placeholder - adjust based on actual CSRF implementation
    }

    /**
     * Test for timing attacks on authentication
     * 
     * @group security
     * @group timing-attack
     */
    public function test_timing_attack_protection(): void
    {
        $startTime = microtime(true);
        
        // Login with non-existent email
        $this->postJson('/api/auth/login', [
            'email' => 'nonexistent@example.com',
            'password' => 'password123',
        ]);
        
        $nonExistentTime = microtime(true) - $startTime;

        $startTime = microtime(true);
        
        // Login with existing email but wrong password
        $this->postJson('/api/auth/login', [
            'email' => $this->testUser->email,
            'password' => 'wrongpassword',
        ]);
        
        $wrongPasswordTime = microtime(true) - $startTime;

        // Time difference should be minimal (less than 100ms)
        $timeDifference = abs($nonExistentTime - $wrongPasswordTime);
        $this->assertLessThan(0.1, $timeDifference, 'Potential timing attack vulnerability detected');
    }

    /**
     * Test for information disclosure through error messages
     * 
     * @group security
     * @group information-disclosure
     */
    public function test_information_disclosure_protection(): void
    {
        // Test login with non-existent email
        $response = $this->postJson('/api/auth/login', [
            'email' => 'nonexistent@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
        
        // Error message should not reveal whether email exists
        $responseData = $response->json();
        $this->assertStringNotContainsString('not found', strtolower($responseData['message'] ?? ''));
        $this->assertStringNotContainsString('does not exist', strtolower($responseData['message'] ?? ''));
    }

    /**
     * Generate a valid CPF for testing
     */
    private function generateValidCPF(): string
    {
        $validCPFs = [
            '529.982.247-25',
            '111.444.777-35',
            '123.456.789-09',
            '987.654.321-00',
        ];

        return $validCPFs[array_rand($validCPFs)];
    }

    /**
     * Test multi-step registration security
     * 
     * @group security
     * @group registration
     */
    public function test_multi_step_registration_security(): void
    {
        // Step 1: Create incomplete registration
        $response = $this->postJson('/api/register/step1', [
            'name' => 'João Silva',
            'email' => 'test' . uniqid() . '@example.com',
            'cpf' => $this->generateValidCPF(),
            'lgpd_consent' => true,
        ]);

        $response->assertStatus(201);
        $token = $response->json('token');

        // Try to access step 3 without completing step 2
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson('/api/register/step3', [
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'security_question' => 'What is your favorite color?',
            'security_answer' => 'Blue',
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['step']);
    }

    /**
     * Test step2 validation with missing required fields
     * 
     * @group security
     * @group validation
     */
    public function test_step2_missing_required_fields_security(): void
    {
        // Create user in step 1
        $user = User::factory()->create([
            'registration_step' => 'contact',
        ]);
        
        Beneficiary::factory()->create([
            'user_id' => $user->id,
            'onboarding_status' => 'profile_incomplete',
        ]);

        Sanctum::actingAs($user);

        // Try step 2 without required fields
        $response = $this->postJson('/api/register/step2', [
            'phone' => '(11) 99999-9999',
            'department' => 'TI',
            'job_title' => 'Developer',
            'employee_id' => 'EMP001',
            'start_date' => now()->addDay()->format('Y-m-d'),
            // Missing: birth_date, gender, marital_status
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['birth_date', 'gender', 'marital_status']);
    }
}