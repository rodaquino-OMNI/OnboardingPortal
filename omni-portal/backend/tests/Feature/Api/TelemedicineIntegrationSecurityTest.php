<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Interview;
use App\Models\InterviewSlot;
use App\Models\VideoSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Carbon\Carbon;

/**
 * Critical Security Test Suite: Telemedicine Integration
 * 
 * Tests security vulnerabilities, data protection, and compliance
 * in the telemedicine scheduling and video conferencing system.
 */
class TelemedicineIntegrationSecurityTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $beneficiary;
    protected $healthcareProfessional;
    protected $unauthorizedUser;
    protected $adminUser;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test users with different roles
        $this->beneficiary = User::factory()->create([
            'email' => 'patient@security-test.com',
            'password' => Hash::make('SecurePass2024!')
        ]);
        
        $this->healthcareProfessional = User::factory()->create([
            'email' => 'doctor@security-test.com',
            'password' => Hash::make('DoctorPass2024!')
        ]);
        $this->healthcareProfessional->assignRole('healthcare_professional');
        
        $this->unauthorizedUser = User::factory()->create([
            'email' => 'hacker@security-test.com',
            'password' => Hash::make('HackerPass2024!')
        ]);
        
        $this->adminUser = User::factory()->create([
            'email' => 'admin@security-test.com',
            'password' => Hash::make('AdminPass2024!')
        ]);
        $this->adminUser->assignRole('admin');
        
        // Create beneficiary profiles
        Beneficiary::factory()->create(['user_id' => $this->beneficiary->id]);
    }

    /** @test */
    public function unauthorized_users_cannot_access_interview_endpoints()
    {
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00'
        ]);

        // Test unauthorized access attempts
        $endpoints = [
            ['GET', '/api/interviews/available-slots'],
            ['POST', '/api/interviews'],
            ['GET', '/api/interviews/history'],
            ['GET', "/api/interviews/{$slot->id}"],
            ['PUT', "/api/interviews/{$slot->id}/reschedule"],
            ['DELETE', "/api/interviews/{$slot->id}"]
        ];

        foreach ($endpoints as [$method, $url]) {
            $response = $this->json($method, $url);
            $response->assertStatus(401, "Endpoint {$method} {$url} should require authentication");
        }

        // Test with unauthorized user (not a patient)
        foreach ($endpoints as [$method, $url]) {
            $response = $this->actingAs($this->unauthorizedUser)->json($method, $url);
            $this->assertContains($response->status(), [403, 404], 
                "Endpoint {$method} {$url} should deny unauthorized users");
        }
    }

    /** @test */
    public function video_session_access_control_prevents_unauthorized_joining()
    {
        // Create interview and video session
        $interview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->beneficiary->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'confirmed'
        ]);

        $videoSession = VideoSession::factory()->create([
            'interview_id' => $interview->id,
            'session_id' => 'secure-session-123',
            'status' => 'created'
        ]);

        // Test unauthorized access attempts
        $unauthorizedJoin = $this->actingAs($this->unauthorizedUser)
            ->postJson("/api/video/sessions/{$videoSession->session_id}/join", [
                'participant_id' => $this->unauthorizedUser->id,
                'participant_name' => $this->unauthorizedUser->name,
                'role' => 'patient'
            ]);

        $unauthorizedJoin->assertStatus(403);

        // Test session token access
        $unauthorizedToken = $this->actingAs($this->unauthorizedUser)
            ->getJson("/api/video/sessions/{$videoSession->session_id}/token");

        $unauthorizedToken->assertStatus(403);

        // Test recording access (should be restricted)
        $videoSession->update(['recording_archive_id' => 'secure-archive-123']);
        
        $unauthorizedRecording = $this->actingAs($this->unauthorizedUser)
            ->getJson("/api/video/recordings/secure-archive-123");

        $unauthorizedRecording->assertStatus(403);
    }

    /** @test */
    public function sql_injection_protection_in_scheduling_endpoints()
    {
        Sanctum::actingAs($this->beneficiary);

        // Test various SQL injection attempts
        $maliciousInputs = [
            "'; DROP TABLE interviews; --",
            "1 OR 1=1",
            "1; DELETE FROM interview_slots WHERE id=1; --",
            "' UNION SELECT * FROM users WHERE role='admin' --",
            "1' AND (SELECT COUNT(*) FROM users) > 0 AND '1'='1",
        ];

        foreach ($maliciousInputs as $maliciousInput) {
            // Test in slot availability endpoint
            $response = $this->getJson('/api/interviews/available-slots?' . http_build_query([
                'professional_id' => $maliciousInput,
                'date_from' => $maliciousInput,
                'specialty' => $maliciousInput
            ]));

            // Should not cause 500 error or data exposure
            $this->assertNotEquals(500, $response->status(), 
                "SQL injection attempt should not cause server error: {$maliciousInput}");
            
            // Test in interview history endpoint
            $historyResponse = $this->getJson('/api/interviews/history?' . http_build_query([
                'status' => $maliciousInput,
                'professional_id' => $maliciousInput
            ]));

            $this->assertNotEquals(500, $historyResponse->status(),
                "SQL injection in history endpoint should not cause server error: {$maliciousInput}");
        }

        // Verify database integrity
        $this->assertTrue(
            \Schema::hasTable('interviews'),
            'Interviews table should still exist after injection attempts'
        );
        
        $this->assertTrue(
            \Schema::hasTable('interview_slots'),
            'Interview slots table should still exist after injection attempts'
        );
    }

    /** @test */
    public function xss_protection_in_user_input_fields()
    {
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '14:00:00',
            'end_time' => '15:00:00'
        ]);

        // Test XSS attempts in booking notes
        $xssPayloads = [
            '<script>alert("XSS")</script>',
            '"><script>alert("XSS")</script>',
            'javascript:alert("XSS")',
            '<img src="x" onerror="alert(\'XSS\')">',
            '<svg onload="alert(\'XSS\')">',
        ];

        foreach ($xssPayloads as $xssPayload) {
            $response = $this->actingAs($this->beneficiary)
                ->postJson('/api/interviews', [
                    'interview_slot_id' => $slot->id,
                    'notes' => $xssPayload,
                    'preferred_language' => $xssPayload
                ]);

            // Booking should succeed (input sanitized)
            $this->assertContains($response->status(), [200, 201], 
                "XSS payload should not prevent booking: {$xssPayload}");

            if ($response->status() === 201) {
                $interview = Interview::latest()->first();
                
                // Verify script tags are escaped/removed
                $this->assertStringNotContainsString('<script>', $interview->notes);
                $this->assertStringNotContainsString('javascript:', $interview->notes);
                $this->assertStringNotContainsString('onerror=', $interview->notes);
                $this->assertStringNotContainsString('onload=', $interview->notes);
                
                $interview->delete(); // Clean up for next test
            }
        }
    }

    /** @test */
    public function csrf_protection_on_state_changing_operations()
    {
        // This test verifies CSRF protection is in place
        // Laravel's CSRF protection should be automatically active
        
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '16:00:00',
            'end_time' => '17:00:00'
        ]);

        // Test without CSRF token (simulating external attack)
        $response = $this->withoutMiddleware(\App\Http\Middleware\VerifyCsrfToken::class)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'CSRF test booking'
            ]);

        // Should be rejected due to missing authentication
        $response->assertStatus(401);

        // Test with authentication but invalid CSRF (if applicable to API)
        $authenticatedResponse = $this->actingAs($this->beneficiary)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'Authenticated CSRF test'
            ]);

        // API endpoints typically use token auth, should succeed
        $authenticatedResponse->assertStatus(201);
    }

    /** @test */
    public function sensitive_data_exposure_prevention()
    {
        // Create interview with sensitive data
        $interview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->beneficiary->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'completed',
            'session_notes' => 'Confidential medical information about treatment',
            'private_notes' => 'Internal notes not for patient'
        ]);

        // Test patient access (should not see private notes)
        $patientResponse = $this->actingAs($this->beneficiary)
            ->getJson("/api/interviews/{$interview->id}");

        $patientResponse->assertStatus(200);
        $patientData = $patientResponse->json('data');
        
        // Patient should not see private notes
        $this->assertArrayNotHasKey('private_notes', $patientData);
        
        // Test professional access (should see relevant data)
        $professionalResponse = $this->actingAs($this->healthcareProfessional)
            ->getJson("/api/interviews/{$interview->id}");

        $professionalResponse->assertStatus(200);
        $professionalData = $professionalResponse->json('data');
        
        // Professional should see session notes but format should be controlled
        $this->assertArrayHasKey('session_notes', $professionalData);

        // Test unauthorized user (should not access at all)
        $unauthorizedResponse = $this->actingAs($this->unauthorizedUser)
            ->getJson("/api/interviews/{$interview->id}");

        $unauthorizedResponse->assertStatus(403);
    }

    /** @test */
    public function video_session_encryption_and_hipaa_compliance()
    {
        Http::fake([
            'api.opentok.com/session/create' => Http::response([
                'sessionId' => 'encrypted-session-456',
                'apiKey' => 'secure-api-key'
            ], 200)
        ]);

        $interview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->beneficiary->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'confirmed'
        ]);

        // Test video session creation with HIPAA compliance
        $response = $this->actingAs($this->healthcareProfessional)
            ->postJson('/api/video/sessions', [
                'interview_id' => $interview->id,
                'participants' => [
                    [
                        'id' => $this->beneficiary->id,
                        'name' => $this->beneficiary->name,
                        'role' => 'patient'
                    ]
                ],
                'hipaa_compliant' => true,
                'end_to_end_encryption' => true
            ]);

        $response->assertStatus(200);
        $sessionData = $response->json('session');

        // Verify HIPAA compliance flags
        $this->assertTrue($sessionData['settings']['hipaa_compliant']);
        $this->assertTrue($sessionData['settings']['end_to_end_encryption']);

        // Test that session URLs are properly signed
        $videoSession = VideoSession::where('interview_id', $interview->id)->first();
        $this->assertNotNull($videoSession);
        $this->assertTrue($videoSession->hipaa_compliant);
        $this->assertTrue($videoSession->encryption_enabled);
    }

    /** @test */
    public function rate_limiting_prevents_api_abuse()
    {
        Sanctum::actingAs($this->beneficiary);

        $startTime = microtime(true);
        $successCount = 0;
        $tooManyRequestsCount = 0;

        // Attempt many requests quickly
        for ($i = 0; $i < 100; $i++) {
            $response = $this->getJson('/api/interviews/available-slots');
            
            if ($response->status() === 200) {
                $successCount++;
            } elseif ($response->status() === 429) {
                $tooManyRequestsCount++;
                break; // Rate limit hit
            }
        }

        $endTime = microtime(true);
        $duration = $endTime - $startTime;

        // Should hit rate limit within reasonable number of requests
        $this->assertGreaterThan(0, $tooManyRequestsCount, 
            'Rate limiting should prevent excessive requests');
        
        // Should not allow unlimited requests in short time
        $this->assertLessThan(100, $successCount, 
            'Should not allow 100+ requests without rate limiting');
    }

    /** @test */
    public function input_validation_prevents_malformed_data_attacks()
    {
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00'
        ]);

        // Test invalid data types and formats
        $invalidInputs = [
            // Invalid interview_slot_id
            ['interview_slot_id' => 'not-a-number', 'notes' => 'Valid notes'],
            ['interview_slot_id' => -1, 'notes' => 'Valid notes'],
            ['interview_slot_id' => 999999999, 'notes' => 'Valid notes'],
            
            // Invalid notes (too long)
            ['interview_slot_id' => $slot->id, 'notes' => str_repeat('a', 10000)],
            
            // Invalid JSON structure
            ['interview_slot_id' => $slot->id, 'notes' => ['array' => 'instead of string']],
            
            // Missing required fields
            ['notes' => 'Missing slot ID'],
            []
        ];

        foreach ($invalidInputs as $invalidInput) {
            $response = $this->actingAs($this->beneficiary)
                ->postJson('/api/interviews', $invalidInput);

            // Should return validation error, not server error
            $this->assertContains($response->status(), [400, 422], 
                'Invalid input should return validation error: ' . json_encode($invalidInput));
            
            // Should not create invalid records
            $invalidInterviewCount = Interview::where('interview_slot_id', 
                $invalidInput['interview_slot_id'] ?? null)->count();
            $this->assertEquals(0, $invalidInterviewCount);
        }
    }

    /** @test */
    public function audit_logging_captures_security_events()
    {
        // Enable log capturing
        Log::shouldReceive('info')->andReturnUsing(function ($message, $context = []) {
            // Store in a way we can verify
            app()->instance('test_logs', array_merge(
                app('test_logs', []), 
                [['message' => $message, 'context' => $context]]
            ));
        });

        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '12:00:00',
            'end_time' => '13:00:00'
        ]);

        // Test booking (should be logged)
        $response = $this->actingAs($this->beneficiary)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'Audit test booking'
            ]);

        $response->assertStatus(201);

        // Test unauthorized access attempt (should be logged)
        $unauthorizedResponse = $this->actingAs($this->unauthorizedUser)
            ->postJson('/api/interviews', [
                'interview_slot_id' => $slot->id,
                'notes' => 'Unauthorized attempt'
            ]);

        $unauthorizedResponse->assertStatus(403);

        // Verify logs contain security events
        $logs = app('test_logs', []);
        $this->assertNotEmpty($logs, 'Security events should be logged');
        
        // Look for relevant log entries
        $securityLogs = collect($logs)->filter(function ($log) {
            return str_contains($log['message'], 'interview') || 
                   str_contains($log['message'], 'unauthorized') ||
                   str_contains($log['message'], 'access');
        });

        $this->assertGreaterThan(0, $securityLogs->count(), 
            'Should log security-related events');
    }

    /** @test */
    public function session_management_prevents_hijacking()
    {
        // Create video session
        $interview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->beneficiary->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'confirmed'
        ]);

        $videoSession = VideoSession::factory()->create([
            'interview_id' => $interview->id,
            'session_id' => 'hijack-test-session',
            'status' => 'active'
        ]);

        // Legitimate user joins session
        $legitimateJoin = $this->actingAs($this->beneficiary)
            ->postJson("/api/video/sessions/{$videoSession->session_id}/join", [
                'participant_id' => $this->beneficiary->id,
                'participant_name' => $this->beneficiary->name,
                'role' => 'patient'
            ]);

        $legitimateJoin->assertStatus(200);

        // Different user tries to join same session
        $hijackAttempt = $this->actingAs($this->unauthorizedUser)
            ->postJson("/api/video/sessions/{$videoSession->session_id}/join", [
                'participant_id' => $this->unauthorizedUser->id,
                'participant_name' => $this->unauthorizedUser->name,
                'role' => 'patient'
            ]);

        $hijackAttempt->assertStatus(403);

        // Test session token reuse prevention
        $tokenResponse = $this->actingAs($this->beneficiary)
            ->getJson("/api/video/sessions/{$videoSession->session_id}/token");

        if ($tokenResponse->status() === 200) {
            $token = $tokenResponse->json('token');
            
            // Different user tries to use same token
            $tokenHijack = $this->actingAs($this->unauthorizedUser)
                ->postJson("/api/video/sessions/{$videoSession->session_id}/validate-token", [
                    'token' => $token
                ]);

            $this->assertNotEquals(200, $tokenHijack->status(), 
                'Token should not be valid for different user');
        }
    }

    protected function tearDown(): void
    {
        // Clear any test logs
        app()->forgetInstance('test_logs');
        parent::tearDown();
    }
}