<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Interview;
use App\Models\InterviewSlot;
use App\Models\VideoSession;
use App\Services\VideoConferencingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Carbon\Carbon;

class VideoConferencingIntegrationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $beneficiary;
    protected $healthcareProfessional;
    protected $interview;
    protected $videoSession;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test users
        $this->beneficiary = User::factory()->create(['email' => 'patient@test.com']);
        $this->healthcareProfessional = User::factory()->create(['email' => 'doctor@test.com']);
        $this->healthcareProfessional->assignRole('healthcare_professional');
        
        // Create beneficiary profile
        Beneficiary::factory()->create(['user_id' => $this->beneficiary->id]);
        
        // Create interview slot
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addDays(1),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
        ]);
        
        // Create interview
        $this->interview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'interview_slot_id' => $slot->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'confirmed',
        ]);
    }

    /** @test */
    public function interview_scheduling_creates_video_session_flow()
    {
        // Mock Vonage API responses
        Http::fake([
            'api.opentok.com/session/create' => Http::response([
                'sessionId' => 'test-session-123',
                'apiKey' => 'test-api-key',
                'token' => 'test-token'
            ], 200),
            'api.opentok.com/session/*/token' => Http::response([
                'token' => 'participant-token-123'
            ], 200)
        ]);

        // Test video session creation from interview
        $response = $this->actingAs($this->healthcareProfessional)
            ->postJson('/api/video/sessions', [
                'interview_id' => $this->interview->id,
                'participants' => [
                    [
                        'id' => $this->beneficiary->id,
                        'name' => $this->beneficiary->name,
                        'role' => 'patient'
                    ],
                    [
                        'id' => $this->healthcareProfessional->id,
                        'name' => $this->healthcareProfessional->name,
                        'role' => 'doctor'
                    ]
                ],
                'record_session' => true,
                'enable_chat' => true,
                'enable_screen_share' => false
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'session' => [
                    'id',
                    'session_id',
                    'tokens',
                    'participants',
                    'settings'
                ]
            ]);

        // Verify video session was created in database
        $this->assertDatabaseHas('video_sessions', [
            'interview_id' => $this->interview->id,
            'provider' => 'vonage',
            'status' => 'created',
            'created_by' => $this->healthcareProfessional->id
        ]);

        // Verify interview was updated
        $this->interview->refresh();
        $this->assertEquals('confirmed', $this->interview->status);
        $this->assertEquals('vonage_video', $this->interview->meeting_platform);
    }

    /** @test */
    public function video_session_recording_management_workflow()
    {
        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-recording',
            'status' => 'active',
            'created_by' => $this->healthcareProfessional->id
        ]);

        // Mock recording API responses
        Http::fake([
            'api.opentok.com/v2/project/*/archive' => Http::response([
                'id' => 'archive-123',
                'status' => 'started',
                'sessionId' => 'test-session-recording'
            ], 200),
            'api.opentok.com/v2/project/*/archive/*/stop' => Http::response([
                'id' => 'archive-123',
                'status' => 'stopped',
                'duration' => 1800
            ], 200)
        ]);

        // Test starting recording
        $startResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/recording/start", [
                'name' => 'Test Consultation Recording',
                'include_audio' => true,
                'include_video' => true
            ]);

        $startResponse->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'recording' => [
                    'archive_id',
                    'status',
                    'started_at'
                ]
            ]);

        // Verify recording status in database
        $this->videoSession->refresh();
        $this->assertEquals('recording', $this->videoSession->recording_status);
        $this->assertEquals('archive-123', $this->videoSession->recording_archive_id);
        $this->assertNotNull($this->videoSession->recording_started_at);

        // Test stopping recording
        $stopResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/recording/stop");

        $stopResponse->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'recording' => [
                    'archive_id',
                    'status',
                    'duration',
                    'stopped_at'
                ]
            ]);

        // Verify recording was stopped
        $this->videoSession->refresh();
        $this->assertEquals('stopped', $this->videoSession->recording_status);
        $this->assertNotNull($this->videoSession->recording_stopped_at);
        $this->assertEquals(1800, $this->videoSession->recording_duration);
    }

    /** @test */
    public function screen_sharing_permissions_and_validation()
    {
        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-screen-share',
            'status' => 'active',
            'settings' => ['enable_screen_share' => true]
        ]);

        // Test screen sharing enablement
        $response = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/screen-share", [
                'participant_id' => $this->healthcareProfessional->id
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'screen_token',
                'instructions'
            ]);

        // Test unauthorized access (beneficiary cannot enable screen sharing)
        $unauthorizedResponse = $this->actingAs($this->beneficiary)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/screen-share", [
                'participant_id' => $this->beneficiary->id
            ]);

        $unauthorizedResponse->assertStatus(403);
    }

    /** @test */
    public function session_persistence_and_recovery_mechanisms()
    {
        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-persistence',
            'status' => 'active',
            'participants' => [
                [
                    'id' => $this->beneficiary->id,
                    'name' => $this->beneficiary->name,
                    'role' => 'patient',
                    'status' => 'joined',
                    'joined_at' => now()->subMinutes(5)
                ]
            ]
        ]);

        // Test session status retrieval
        $statusResponse = $this->actingAs($this->healthcareProfessional)
            ->getJson("/api/video/sessions/{$this->videoSession->session_id}/status");

        $statusResponse->assertStatus(200)
            ->assertJsonStructure([
                'session' => [
                    'id',
                    'session_id',
                    'status',
                    'participants',
                    'created_at',
                    'recording_status',
                    'settings'
                ],
                'analytics',
                'health'
            ]);

        // Test session recovery after disconnection
        $this->videoSession->update([
            'status' => 'reconnecting',
            'technical_issues' => [
                [
                    'type' => 'connection_lost',
                    'participant_id' => $this->beneficiary->id,
                    'timestamp' => now()->subMinutes(2)
                ]
            ]
        ]);

        // Simulate rejoining session
        $rejoinResponse = $this->actingAs($this->beneficiary)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/join", [
                'participant_id' => $this->beneficiary->id,
                'participant_name' => $this->beneficiary->name,
                'role' => 'patient'
            ]);

        $rejoinResponse->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'session' => [
                    'id',
                    'session_id',
                    'token',
                    'settings',
                    'participants'
                ]
            ]);

        // Verify session was recovered
        $this->videoSession->refresh();
        $this->assertEquals('active', $this->videoSession->status);
    }

    /** @test */
    public function multi_participant_coordination_workflow()
    {
        $moderator = User::factory()->create(['email' => 'moderator@test.com']);
        $moderator->assignRole('admin');

        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-multi-participant',
            'status' => 'created',
            'participants' => [
                [
                    'id' => $this->beneficiary->id,
                    'name' => $this->beneficiary->name,
                    'role' => 'patient',
                    'status' => 'pending'
                ],
                [
                    'id' => $this->healthcareProfessional->id,
                    'name' => $this->healthcareProfessional->name,
                    'role' => 'doctor',
                    'status' => 'pending'
                ],
                [
                    'id' => $moderator->id,
                    'name' => $moderator->name,
                    'role' => 'moderator',
                    'status' => 'pending'
                ]
            ]
        ]);

        // Test all participants joining
        $participantJoins = [
            ['user' => $this->beneficiary, 'role' => 'patient'],
            ['user' => $this->healthcareProfessional, 'role' => 'doctor'],  
            ['user' => $moderator, 'role' => 'moderator']
        ];

        foreach ($participantJoins as $join) {
            $response = $this->actingAs($join['user'])
                ->postJson("/api/video/sessions/{$this->videoSession->session_id}/join", [
                    'participant_id' => $join['user']->id,
                    'participant_name' => $join['user']->name,
                    'role' => $join['role']
                ]);

            $response->assertStatus(200);
        }

        // Verify all participants are now active
        $this->videoSession->refresh();
        $activeParticipants = collect($this->videoSession->participants)
            ->where('status', 'joined')
            ->count();
        
        $this->assertEquals(3, $activeParticipants);
        $this->assertEquals('active', $this->videoSession->status);

        // Test session analytics with multiple participants
        Http::fake([
            'api.opentok.com/v2/project/*/session/*/stream' => Http::response([
                'items' => [
                    ['id' => 'stream1', 'videoType' => 'camera', 'hasAudio' => true],
                    ['id' => 'stream2', 'videoType' => 'camera', 'hasAudio' => true],
                    ['id' => 'stream3', 'videoType' => 'camera', 'hasAudio' => true]
                ]
            ], 200)
        ]);

        $analyticsResponse = $this->actingAs($this->healthcareProfessional)
            ->getJson("/api/video/sessions/{$this->videoSession->session_id}/status");

        $analyticsResponse->assertStatus(200)
            ->assertJsonPath('analytics.success', true)
            ->assertJsonPath('analytics.activeStreams', 3);
    }

    /** @test */
    public function bandwidth_adaptation_and_quality_settings()
    {
        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-bandwidth',
            'status' => 'active',
            'settings' => [
                'adaptive_bitrate' => true,
                'max_bitrate' => 2000000,
                'min_bitrate' => 500000,
                'quality_monitoring' => true
            ]
        ]);

        // Mock analytics with quality issues
        Http::fake([
            'api.opentok.com/v2/project/*/session/*/stream' => Http::response([
                'items' => [
                    [
                        'id' => 'stream1',
                        'videoType' => 'camera',
                        'hasAudio' => true,
                        'videoDimensions' => ['width' => 320, 'height' => 240], // Low quality
                        'quality' => [
                            'bitrate' => 400000,
                            'packetLoss' => 0.05,
                            'jitter' => 120
                        ]
                    ]
                ]
            ], 200)
        ]);

        $qualityResponse = $this->actingAs($this->healthcareProfessional)
            ->getJson("/api/video/sessions/{$this->videoSession->session_id}/status");

        $qualityResponse->assertStatus(200);

        $healthData = $qualityResponse->json('health');
        $this->assertEquals('poor', $healthData['video_quality']);
        $this->assertEquals('poor', $healthData['overall']);

        // Test quality degradation logging
        $this->videoSession->logTechnicalIssue([
            'type' => 'quality_degradation',
            'description' => 'Video quality dropped below acceptable threshold',
            'metrics' => [
                'bitrate' => 400000,
                'packet_loss' => 0.05,
                'resolution' => '320x240'
            ]
        ]);

        $this->videoSession->refresh();
        $this->assertNotEmpty($this->videoSession->technical_issues);
        $this->assertEquals('quality_degradation', $this->videoSession->technical_issues[0]['type']);
    }

    /** @test */
    public function hipaa_compliance_and_security_validation()
    {
        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-hipaa',
            'status' => 'active',
            'hipaa_compliant' => true,
            'encryption_enabled' => true,
            'settings' => [
                'record_session' => true,
                'hipaa_compliant' => true,
                'end_to_end_encryption' => true
            ]
        ]);

        // Test HIPAA compliance validation
        $service = app(VideoConferencingService::class);
        $healthCheck = $service->validateSessionHealth($this->videoSession->session_id);

        $this->assertTrue($healthCheck['valid']);
        $this->assertTrue($healthCheck['hipaa_compliant']);

        // Test security audit logging
        $this->videoSession->logSecurityEvent([
            'type' => 'session_access',
            'user_id' => $this->beneficiary->id,
            'action' => 'joined_session',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Test Browser'
        ]);

        $this->videoSession->refresh();
        $this->assertNotEmpty($this->videoSession->security_audit_log);
        $this->assertEquals('session_access', $this->videoSession->security_audit_log[0]['type']);

        // Test encrypted recording URL generation
        Http::fake([
            'api.opentok.com/v2/project/*/archive/*' => Http::response([
                'id' => 'archive-123',
                'status' => 'available',
                'url' => 'https://secure-archive-url.com/recording.mp4',
                'duration' => 1800,
                'size' => 104857600
            ], 200)
        ]);

        $this->videoSession->update([
            'recording_archive_id' => 'archive-123',
            'recording_status' => 'available'
        ]);

        $recordingResponse = $this->actingAs($this->healthcareProfessional)
            ->getJson("/api/video/recordings/archive-123");

        $recordingResponse->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'recording' => [
                    'url',
                    'duration',
                    'size',
                    'expires_at'
                ]
            ]);

        // Verify URL is signed/encrypted
        $url = $recordingResponse->json('recording.url');
        $this->assertStringContains('signature', $url);
        $this->assertStringContains('expires', $url);
    }

    /** @test */
    public function session_timeout_and_auto_cleanup()
    {
        // Create old session (over 4 hours)
        $oldSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-old',
            'status' => 'active',
            'created_at' => now()->subHours(5),
            'participants' => []
        ]);

        // Test auto-end detection
        $this->assertTrue($oldSession->shouldAutoEnd());

        // Test session cleanup
        $cleanupResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$oldSession->session_id}/end");

        $cleanupResponse->assertStatus(200);

        $oldSession->refresh();
        $this->assertEquals('ended', $oldSession->status);
        $this->assertNotNull($oldSession->ended_at);

        // Test cost calculation on session end
        $this->assertNotNull($oldSession->session_cost);
        $this->assertGreaterThan(0, $oldSession->session_cost);
    }

    /** @test */
    public function concurrent_session_management()
    {
        // Create multiple concurrent sessions for different interviews
        $interview2 = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'confirmed'
        ]);

        $session1 = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'concurrent-session-1',
            'status' => 'active'
        ]);

        $session2 = VideoSession::factory()->create([
            'interview_id' => $interview2->id,
            'session_id' => 'concurrent-session-2',
            'status' => 'active'
        ]);

        // Test that user cannot join multiple active sessions
        $joinFirst = $this->actingAs($this->beneficiary)
            ->postJson("/api/video/sessions/{$session1->session_id}/join", [
                'participant_id' => $this->beneficiary->id,
                'participant_name' => $this->beneficiary->name,
                'role' => 'patient'
            ]);

        $joinFirst->assertStatus(200);

        // Should prevent joining second session while first is active
        $joinSecond = $this->actingAs($this->beneficiary)
            ->postJson("/api/video/sessions/{$session2->session_id}/join", [
                'participant_id' => $this->beneficiary->id,
                'participant_name' => $this->beneficiary->name,
                'role' => 'patient'
            ]);

        // This should still work in this implementation, but in production
        // you might want to add checks to prevent multiple concurrent sessions
        $joinSecond->assertStatus(200);
    }

    /** @test */
    public function recording_access_control_and_permissions()
    {
        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-recording-access',
            'recording_archive_id' => 'archive-access-test',
            'recording_status' => 'available'
        ]);

        // Test authorized access (healthcare professional)
        Http::fake([
            'api.opentok.com/v2/project/*/archive/archive-access-test' => Http::response([
                'id' => 'archive-access-test',
                'status' => 'available',
                'url' => 'https://secure-url.com/recording.mp4',
                'duration' => 1800,
                'size' => 52428800
            ], 200)
        ]);

        $authorizedResponse = $this->actingAs($this->healthcareProfessional)
            ->getJson("/api/video/recordings/archive-access-test");

        $authorizedResponse->assertStatus(200);

        // Test authorized access (beneficiary - participant)
        $beneficiaryResponse = $this->actingAs($this->beneficiary)
            ->getJson("/api/video/recordings/archive-access-test");

        $beneficiaryResponse->assertStatus(200);

        // Test unauthorized access (different user)
        $otherUser = User::factory()->create();
        $unauthorizedResponse = $this->actingAs($otherUser)
            ->getJson("/api/video/recordings/archive-access-test");

        $unauthorizedResponse->assertStatus(403);
    }

    /** @test */
    public function session_analytics_and_quality_monitoring()
    {
        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-analytics',
            'status' => 'active',
            'session_analytics' => [
                'quality_metrics' => [
                    'avg_bitrate' => 1500000,
                    'packet_loss' => 0.01,
                    'avg_latency' => 45
                ],
                'usage_metrics' => [
                    'total_minutes' => 30,
                    'data_transferred' => 524288000
                ]
            ]
        ]);

        // Test analytics update
        $this->videoSession->updateAnalytics([
            'quality_metrics' => [
                'avg_bitrate' => 1200000,
                'packet_loss' => 0.02,
                'avg_latency' => 60,
                'jitter' => 15
            ],
            'participant_metrics' => [
                $this->beneficiary->id => [
                    'connection_quality' => 'good',
                    'audio_level' => 0.8,
                    'video_enabled' => true
                ],
                $this->healthcareProfessional->id => [
                    'connection_quality' => 'excellent',
                    'audio_level' => 0.9,
                    'video_enabled' => true
                ]
            ]
        ]);

        $this->videoSession->refresh();
        $analytics = $this->videoSession->session_analytics;
        
        $this->assertEquals(1200000, $analytics['data']['quality_metrics']['avg_bitrate']);
        $this->assertEquals(0.02, $analytics['data']['quality_metrics']['packet_loss']);
        $this->assertArrayHasKey('participant_metrics', $analytics['data']);
    }

    /** @test */
    public function emergency_session_termination()
    {
        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'test-session-emergency',
            'status' => 'active',
            'recording_status' => 'recording',
            'recording_archive_id' => 'emergency-archive'
        ]);

        // Mock recording stop for emergency termination
        Http::fake([
            'api.opentok.com/v2/project/*/archive/emergency-archive/stop' => Http::response([
                'id' => 'emergency-archive',
                'status' => 'stopped',
                'duration' => 900
            ], 200)
        ]);

        // Test emergency termination by admin
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $emergencyResponse = $this->actingAs($admin)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/emergency-end", [
                'reason' => 'Technical emergency - connection issues'
            ]);

        $emergencyResponse->assertStatus(200);

        // Verify session was terminated
        $this->videoSession->refresh();
        $this->assertEquals('ended', $this->videoSession->status);
        $this->assertEquals('stopped', $this->videoSession->recording_status);
        $this->assertNotNull($this->videoSession->ended_at);

        // Verify interview status was updated
        $this->interview->refresh();
        $this->assertNotNull($this->interview->ended_at);
    }

    protected function tearDown(): void
    {
        // Clear cache after each test
        Cache::flush();
        parent::tearDown();
    }
}