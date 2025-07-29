<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Interview;
use App\Models\VideoSession;
use App\Services\VideoConferencingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

class VideoConferencingTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $healthcare_professional;
    protected $interview;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test users
        $this->user = User::factory()->create([
            'email' => 'patient@example.com',
            'registration_step' => 'completed'
        ]);
        
        $this->healthcare_professional = User::factory()->create([
            'email' => 'doctor@example.com',
            'registration_step' => 'completed'
        ]);
        
        // Create test interview
        $this->interview = Interview::factory()->create([
            'beneficiary_id' => $this->user->id,
            'healthcare_professional_id' => $this->healthcare_professional->id,
            'status' => 'scheduled'
        ]);
    }

    public function test_user_can_create_video_session()
    {
        // Mock Vonage API response
        Http::fake([
            'https://video.api.vonage.com/session/create' => Http::response([
                'sessionId' => 'test_session_123',
                'archiveMode' => 'always'
            ], 200)
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/video/sessions', [
                'interview_id' => $this->interview->id,
                'participants' => [
                    [
                        'id' => $this->user->id,
                        'name' => $this->user->name,
                        'role' => 'patient'
                    ]
                ],
                'record_session' => true,
                'enable_chat' => true,
                'enable_screen_share' => true
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'session' => [
                'id',
                'session_id',
                'tokens',
                'participants',
                'settings'
            ]
        ]);

        // Verify database record
        $this->assertDatabaseHas('video_sessions', [
            'interview_id' => $this->interview->id,
            'session_id' => 'test_session_123',
            'provider' => 'vonage',
            'status' => 'created'
        ]);
    }

    public function test_user_can_join_existing_session()
    {
        // Create video session
        $videoSession = VideoSession::create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test_session_123',
            'provider' => 'vonage',
            'status' => 'created',
            'participants' => [],
            'settings' => ['record_session' => true],
            'created_by' => $this->user->id
        ]);

        $response = $this->actingAs($this->healthcare_professional)
            ->postJson("/api/video/sessions/test_session_123/join", [
                'participant_id' => $this->healthcare_professional->id,
                'participant_name' => $this->healthcare_professional->name,
                'role' => 'doctor'
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'session' => [
                'id',
                'session_id',
                'token',
                'settings',
                'participants'
            ]
        ]);
    }

    public function test_user_cannot_access_unauthorized_session()
    {
        // Create session for different users
        $otherUser = User::factory()->create();
        $otherInterview = Interview::factory()->create([
            'beneficiary_id' => $otherUser->id,
            'healthcare_professional_id' => $this->healthcare_professional->id
        ]);

        $videoSession = VideoSession::create([
            'interview_id' => $otherInterview->id,
            'session_id' => 'test_session_456',
            'provider' => 'vonage',
            'status' => 'created',
            'participants' => [],
            'settings' => ['record_session' => true],
            'created_by' => $otherUser->id
        ]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/video/sessions/test_session_456/join", [
                'participant_id' => $this->user->id,
                'participant_name' => $this->user->name,
                'role' => 'patient'
            ]);

        $response->assertStatus(403);
    }

    public function test_healthcare_professional_can_start_recording()
    {
        $videoSession = VideoSession::create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test_session_123',
            'provider' => 'vonage',
            'status' => 'active',
            'participants' => [],
            'settings' => ['record_session' => true],
            'created_by' => $this->user->id
        ]);

        // Mock Vonage recording API
        Http::fake([
            'https://video.api.vonage.com/v2/project/*/archive' => Http::response([
                'id' => 'archive_123',
                'status' => 'started'
            ], 200)
        ]);

        $response = $this->actingAs($this->healthcare_professional)
            ->postJson("/api/video/sessions/test_session_123/recording/start", [
                'name' => 'Test Recording',
                'include_audio' => true,
                'include_video' => true
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'recording' => [
                'archive_id',
                'status',
                'started_at'
            ]
        ]);

        // Verify database update
        $this->assertDatabaseHas('video_sessions', [
            'session_id' => 'test_session_123',
            'recording_archive_id' => 'archive_123',
            'recording_status' => 'recording'
        ]);
    }

    public function test_patient_cannot_start_recording()
    {
        $videoSession = VideoSession::create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test_session_123',
            'provider' => 'vonage',
            'status' => 'active',
            'participants' => [],
            'settings' => ['record_session' => true],
            'created_by' => $this->user->id
        ]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/video/sessions/test_session_123/recording/start");

        $response->assertStatus(403);
    }

    public function test_user_can_enable_screen_sharing()
    {
        $videoSession = VideoSession::create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test_session_123',
            'provider' => 'vonage',
            'status' => 'active',
            'participants' => [],
            'settings' => ['enable_screen_share' => true],
            'created_by' => $this->user->id
        ]);

        $response = $this->actingAs($this->healthcare_professional)
            ->postJson("/api/video/sessions/test_session_123/screen-share", [
                'participant_id' => $this->healthcare_professional->id
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'screen_token',
            'instructions'
        ]);
    }

    public function test_session_status_provides_analytics()
    {
        $videoSession = VideoSession::create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test_session_123',
            'provider' => 'vonage',
            'status' => 'active',
            'participants' => [
                [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                    'role' => 'patient',
                    'status' => 'joined'
                ]
            ],
            'settings' => ['record_session' => true],
            'created_by' => $this->user->id
        ]);

        // Mock analytics API
        Http::fake([
            'https://video.api.vonage.com/v2/project/*/session/*/stream' => Http::response([
                'items' => [
                    [
                        'id' => 'stream_123',
                        'videoType' => 'camera',
                        'videoDimensions' => ['width' => 1280, 'height' => 720]
                    ]
                ]
            ], 200)
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/video/sessions/test_session_123/status");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'session' => [
                'id',
                'session_id',
                'status',
                'participants'
            ],
            'analytics',
            'health'
        ]);
    }

    public function test_user_can_end_session()
    {
        $videoSession = VideoSession::create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test_session_123',
            'provider' => 'vonage',
            'status' => 'active',
            'participants' => [],
            'settings' => ['record_session' => true],
            'created_by' => $this->user->id
        ]);

        $response = $this->actingAs($this->healthcare_professional)
            ->postJson("/api/video/sessions/test_session_123/end");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'session' => [
                'id',
                'duration_minutes',
                'ended_at'
            ]
        ]);

        // Verify database update
        $this->assertDatabaseHas('video_sessions', [
            'session_id' => 'test_session_123',
            'status' => 'ended'
        ]);

        // Verify interview update
        $this->assertDatabaseHas('interviews', [
            'id' => $this->interview->id,
            'status' => 'completed'
        ]);
    }

    public function test_video_security_middleware_blocks_unauthorized_access()
    {
        $response = $this->postJson('/api/video/sessions', [
            'interview_id' => $this->interview->id,
            'participants' => []
        ]);

        $response->assertStatus(401);
    }

    public function test_video_service_handles_vonage_api_failure()
    {
        // Mock failed Vonage API response
        Http::fake([
            'https://video.api.vonage.com/session/create' => Http::response([], 500)
        ]);

        $service = app(VideoConferencingService::class);
        $result = $service->createSession([
            [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'role' => 'publisher'
            ]
        ]);

        $this->assertTrue($result['success']);
        $this->assertTrue($result['fallback'] ?? false);
        $this->assertEquals('webrtc', $result['type']);
    }

    public function test_session_health_validation()
    {
        $service = app(VideoConferencingService::class);
        
        // Test invalid session
        $result = $service->validateSessionHealth('invalid_session');
        $this->assertFalse($result['valid']);

        // Test expired session would require cache setup
        // This is a simplified test for the method structure
        $this->assertArrayHasKey('valid', $result);
        $this->assertArrayHasKey('message', $result);
    }

    public function test_session_cost_calculation()
    {
        $videoSession = VideoSession::create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test_session_123',
            'provider' => 'vonage',
            'status' => 'ended',
            'participants' => [],
            'settings' => ['record_session' => true],
            'created_by' => $this->user->id,
            'started_at' => now()->subMinutes(30),
            'ended_at' => now(),
            'recording_duration' => 1800, // 30 minutes
            'recording_size' => 1024 * 1024 * 100 // 100MB
        ]);

        $cost = $videoSession->calculateCost();
        
        $this->assertGreaterThan(0, $cost);
        $this->assertIsFloat($cost);
        
        // Verify cost was stored
        $videoSession->refresh();
        $this->assertNotNull($videoSession->session_cost);
    }
}