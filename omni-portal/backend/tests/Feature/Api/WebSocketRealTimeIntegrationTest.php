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
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Queue;
use Carbon\Carbon;
use Pusher\Pusher;

class WebSocketRealTimeIntegrationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $beneficiary;
    protected $healthcareProfessional;
    protected $interview;
    protected $videoSession;
    protected $pusher;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Skip WebSocket tests if Pusher is not configured
        if (!config('broadcasting.connections.pusher.key')) {
            $this->markTestSkipped('WebSocket tests require Pusher configuration');
        }
        
        // Create test users
        $beneficiaryUser = User::factory()->create(['email' => 'patient@test.com']);
        $this->healthcareProfessional = User::factory()->create(['email' => 'doctor@test.com']);
        $this->healthcareProfessional->assignRole('healthcare_professional');
        
        // Create beneficiary profile
        $this->beneficiary = Beneficiary::factory()->create(['user_id' => $beneficiaryUser->id]);
        
        // Create interview and video session
        $slot = InterviewSlot::factory()->create([
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'date' => now()->addHours(1),
            'start_time' => now()->addHours(1)->format('H:i:s'),
            'end_time' => now()->addHours(2)->format('H:i:s'),
        ]);
        
        $this->interview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'interview_slot_id' => $slot->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'confirmed',
        ]);

        $this->videoSession = VideoSession::factory()->create([
            'interview_id' => $this->interview->id,
            'session_id' => 'websocket-test-session',
            'status' => 'active'
        ]);

        // Mock Pusher for testing
        $this->pusher = \Mockery::mock(Pusher::class);
        $this->app->instance(Pusher::class, $this->pusher);
        
        // Fake events and queues
        Event::fake();
        Queue::fake();
    }

    /** @test */
    public function real_time_participant_status_updates()
    {
        // Mock Pusher channel triggers for participant events
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'participant.joined',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'participant.left',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Test participant joining via WebSocket
        $joinResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/join", [
                'participant_id' => $this->beneficiary->user->id,
                'participant_name' => $this->beneficiary->user->name,
                'role' => 'patient'
            ]);

        $joinResponse->assertStatus(200);

        // Verify participant was added and event was triggered
        $this->videoSession->refresh();
        $participants = $this->videoSession->participants;
        $joinedParticipant = collect($participants)->firstWhere('id', $this->beneficiary->user->id);
        
        $this->assertNotNull($joinedParticipant);
        $this->assertEquals('joined', $joinedParticipant['status']);

        // Test participant leaving
        $leaveResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/leave", [
                'participant_id' => $this->beneficiary->user->id
            ]);

        $leaveResponse->assertStatus(200);

        // Verify participant status was updated
        $this->videoSession->refresh();
        $participants = $this->videoSession->participants;
        $leftParticipant = collect($participants)->firstWhere('id', $this->beneficiary->user->id);
        
        $this->assertEquals('left', $leftParticipant['status']);
    }

    /** @test */
    public function real_time_chat_message_broadcasting()
    {
        // Enable chat for the session
        $this->videoSession->update([
            'settings' => array_merge($this->videoSession->settings ?? [], ['enable_chat' => true])
        ]);

        // Mock Pusher for chat message broadcasting
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'chat.message',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Test sending chat message
        $chatResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/chat", [
                'message' => 'Hello, can you hear me?',
                'message_type' => 'text'
            ]);

        $chatResponse->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message_id',
                'timestamp'
            ]);

        // Verify message was stored
        $this->videoSession->refresh();
        $chatMessages = $this->videoSession->chat_messages;
        
        $this->assertCount(1, $chatMessages);
        $this->assertEquals('Hello, can you hear me?', $chatMessages[0]['message']);
        $this->assertEquals($this->beneficiary->user->id, $chatMessages[0]['sender_id']);
    }

    /** @test */
    public function real_time_screen_sharing_notifications()
    {
        // Mock Pusher for screen sharing events
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'screen-share.started',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'screen-share.stopped',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Test starting screen share
        $startScreenShareResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/screen-share", [
                'participant_id' => $this->healthcareProfessional->id,
                'screen_type' => 'application'
            ]);

        $startScreenShareResponse->assertStatus(200);

        // Test stopping screen share
        $stopScreenShareResponse = $this->actingAs($this->healthcareProfessional)
            ->deleteJson("/api/video/sessions/{$this->videoSession->session_id}/screen-share", [
                'participant_id' => $this->healthcareProfessional->id
            ]);

        $stopScreenShareResponse->assertStatus(200);

        // Verify screen sharing sessions were logged
        $this->videoSession->refresh();
        $screenSessions = $this->videoSession->screen_share_sessions ?? [];
        
        $this->assertGreaterThan(0, count($screenSessions));
    }

    /** @test */
    public function real_time_connection_quality_monitoring()
    {
        // Mock Pusher for quality alerts
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'quality.alert',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Simulate poor connection quality report
        $qualityResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/quality-report", [
                'participant_id' => $this->beneficiary->user->id,
                'connection_quality' => 'poor',
                'metrics' => [
                    'bitrate' => 200000, // Very low bitrate
                    'packet_loss' => 0.15, // High packet loss
                    'jitter' => 200, // High jitter
                    'latency' => 500 // High latency
                ]
            ]);

        $qualityResponse->assertStatus(200);

        // Verify quality issue was logged
        $this->videoSession->refresh();
        $technicalIssues = $this->videoSession->technical_issues ?? [];
        
        $qualityIssue = collect($technicalIssues)->firstWhere('type', 'connection_quality');
        $this->assertNotNull($qualityIssue);
        $this->assertEquals('poor', $qualityIssue['quality_level']);
    }

    /** @test */
    public function real_time_recording_status_updates()
    {
        // Mock Pusher for recording events
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'recording.started',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'recording.stopped',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Test recording start notification
        $this->videoSession->update([
            'recording_status' => 'recording',
            'recording_started_at' => now(),
            'recording_archive_id' => 'test-archive-123'
        ]);

        // Trigger recording started event
        $recordingStartResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/recording/notify-start");

        $recordingStartResponse->assertStatus(200);

        // Test recording stop notification
        $this->videoSession->update([
            'recording_status' => 'stopped',
            'recording_stopped_at' => now(),
            'recording_duration' => 1800
        ]);

        // Trigger recording stopped event
        $recordingStopResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/recording/notify-stop");

        $recordingStopResponse->assertStatus(200);
    }

    /** @test */
    public function real_time_session_analytics_dashboard()
    {
        // Mock Pusher for analytics updates
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}.analytics",
                'analytics.updated',
                \Mockery::type('array')
            )
            ->atLeast()
            ->once()
            ->andReturn(true);

        // Simulate multiple participants joining
        $participants = [
            ['user' => $this->beneficiary->user, 'role' => 'patient'],
            ['user' => $this->healthcareProfessional, 'role' => 'doctor']
        ];

        foreach ($participants as $participant) {
            $this->videoSession->addParticipant([
                'id' => $participant['user']->id,
                'name' => $participant['user']->name,
                'role' => $participant['role'],
                'status' => 'joined'
            ]);
        }

        // Update analytics with real-time data
        $analyticsData = [
            'active_participants' => 2,
            'total_duration' => 900, // 15 minutes
            'quality_metrics' => [
                'avg_bitrate' => 1500000,
                'packet_loss' => 0.02,
                'avg_latency' => 45
            ],
            'chat_messages_count' => 5,
            'screen_shares_count' => 1
        ];

        $this->videoSession->updateAnalytics($analyticsData);

        // Test analytics broadcast
        $analyticsResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/broadcast-analytics");

        $analyticsResponse->assertStatus(200);

        // Verify analytics were updated
        $this->videoSession->refresh();
        $storedAnalytics = $this->videoSession->session_analytics;
        
        $this->assertEquals(2, $storedAnalytics['data']['active_participants']);
        $this->assertEquals(1500000, $storedAnalytics['data']['quality_metrics']['avg_bitrate']);
    }

    /** @test */
    public function real_time_interview_status_notifications()
    {
        // Mock Pusher for interview status updates
        $this->pusher->shouldReceive('trigger')
            ->with(
                "interview.{$this->interview->id}",
                'status.changed',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Test interview status change (start)
        $startResponse = $this->actingAs($this->healthcareProfessional)
            ->putJson("/api/interviews/{$this->interview->id}/start");

        $startResponse->assertStatus(200);

        // Verify status was updated
        $this->interview->refresh();
        $this->assertEquals('in_progress', $this->interview->status);
        $this->assertNotNull($this->interview->started_at);
    }

    /** @test */
    public function real_time_emergency_alerts_and_notifications()
    {
        // Mock Pusher for emergency alerts
        $this->pusher->shouldReceive('trigger')
            ->with(
                'emergency-alerts',
                'technical.emergency',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'session.emergency_end',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Simulate technical emergency
        $emergencyResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/emergency", [
                'emergency_type' => 'technical_failure',
                'description' => 'Complete video/audio failure',
                'severity' => 'high',
                'requires_immediate_attention' => true
            ]);

        $emergencyResponse->assertStatus(200);

        // Verify emergency was logged
        $this->videoSession->refresh();
        $technicalIssues = $this->videoSession->technical_issues ?? [];
        
        $emergency = collect($technicalIssues)->firstWhere('type', 'emergency');
        $this->assertNotNull($emergency);
        $this->assertEquals('high', $emergency['severity']);
    }

    /** @test */
    public function real_time_bandwidth_adaptation_notifications()
    {
        // Mock Pusher for bandwidth events
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'bandwidth.adapted',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Simulate bandwidth degradation and adaptation
        $bandwidthResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/bandwidth-report", [
                'participant_id' => $this->beneficiary->user->id,
                'available_bandwidth' => 500000, // 0.5 Mbps - low bandwidth
                'recommended_quality' => 'low',
                'adaptation_applied' => true,
                'new_settings' => [
                    'video_resolution' => '320x240',
                    'video_bitrate' => 400000,
                    'audio_bitrate' => 64000
                ]
            ]);

        $bandwidthResponse->assertStatus(200);

        // Verify bandwidth adaptation was logged
        $this->videoSession->refresh();
        $technicalIssues = $this->videoSession->technical_issues ?? [];
        
        $bandwidthIssue = collect($technicalIssues)->firstWhere('type', 'bandwidth_adaptation');
        $this->assertNotNull($bandwidthIssue);
        $this->assertEquals(500000, $bandwidthIssue['available_bandwidth']);
    }

    /** @test */
    public function real_time_multi_session_coordination()
    {
        // Create another video session
        $anotherInterview = Interview::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'healthcare_professional_id' => $this->healthcareProfessional->id,
            'status' => 'confirmed'
        ]);

        $anotherSession = VideoSession::factory()->create([
            'interview_id' => $anotherInterview->id,
            'session_id' => 'websocket-test-session-2',
            'status' => 'created'
        ]);

        // Mock Pusher for multi-session coordination
        $this->pusher->shouldReceive('trigger')
            ->with(
                "user.{$this->healthcareProfessional->id}.sessions",
                'session.conflict_detected',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Test concurrent session detection
        $conflictResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/check-conflicts", [
                'user_id' => $this->healthcareProfessional->id,
                'new_session_id' => $anotherSession->session_id
            ]);

        $conflictResponse->assertStatus(200)
            ->assertJsonStructure([
                'has_conflicts',
                'active_sessions',
                'recommendations'
            ]);
    }

    /** @test */
    public function real_time_presence_and_heartbeat_monitoring()
    {
        // Mock Redis for presence tracking
        $this->app->instance('redis', \Mockery::mock('Redis'));
        
        // Mock Pusher for presence events
        $this->pusher->shouldReceive('trigger')
            ->with(
                "presence-video-session.{$this->videoSession->session_id}",
                'user.online',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        $this->pusher->shouldReceive('trigger')
            ->with(
                "presence-video-session.{$this->videoSession->session_id}",
                'user.offline',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Test presence update (online)
        $onlineResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/presence", [
                'status' => 'online',
                'participant_id' => $this->beneficiary->user->id
            ]);

        $onlineResponse->assertStatus(200);

        // Test heartbeat
        $heartbeatResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/heartbeat", [
                'participant_id' => $this->beneficiary->user->id,
                'timestamp' => now()->timestamp,
                'connection_status' => 'stable'
            ]);

        $heartbeatResponse->assertStatus(200);

        // Test presence update (offline)
        $offlineResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/presence", [
                'status' => 'offline',
                'participant_id' => $this->beneficiary->user->id
            ]);

        $offlineResponse->assertStatus(200);
    }

    /** @test */
    public function real_time_collaborative_features()
    {
        // Mock Pusher for collaborative events
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'whiteboard.updated',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'document.shared',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Test whiteboard collaboration
        $whiteboardResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/whiteboard", [
                'action' => 'draw',
                'data' => [
                    'type' => 'line',
                    'coordinates' => [[100, 100], [200, 200]],
                    'color' => '#000000',
                    'thickness' => 2
                ],
                'timestamp' => now()->timestamp
            ]);

        $whiteboardResponse->assertStatus(200);

        // Test document sharing
        $documentResponse = $this->actingAs($this->healthcareProfessional)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/share-document", [
                'document_type' => 'medical_form',
                'document_url' => 'https://example.com/form.pdf',
                'permissions' => ['view', 'annotate'],
                'shared_with' => [$this->beneficiary->user->id]
            ]);

        $documentResponse->assertStatus(200);
    }

    /** @test */
    public function real_time_session_recovery_and_reconnection()
    {
        // Mock Pusher for reconnection events
        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'participant.reconnecting',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        $this->pusher->shouldReceive('trigger')
            ->with(
                "video-session.{$this->videoSession->session_id}",
                'participant.reconnected',
                \Mockery::type('array')
            )
            ->once()
            ->andReturn(true);

        // Simulate connection loss
        $disconnectResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/connection-lost", [
                'participant_id' => $this->beneficiary->user->id,
                'reason' => 'network_interruption',
                'last_heartbeat' => now()->subMinutes(2)->timestamp
            ]);

        $disconnectResponse->assertStatus(200);

        // Simulate reconnection attempt
        $reconnectResponse = $this->actingAs($this->beneficiary->user)
            ->postJson("/api/video/sessions/{$this->videoSession->session_id}/reconnect", [
                'participant_id' => $this->beneficiary->user->id,
                'session_state' => [
                    'last_chat_message_id' => 'msg_123',
                    'last_event_timestamp' => now()->subMinutes(2)->timestamp
                ]
            ]);

        $reconnectResponse->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'reconnection_data' => [
                    'missed_events',
                    'current_participants',
                    'session_state'
                ]
            ]);

        // Verify reconnection was logged
        $this->videoSession->refresh();
        $technicalIssues = $this->videoSession->technical_issues ?? [];
        
        $reconnectionEvent = collect($technicalIssues)->firstWhere('type', 'reconnection');
        $this->assertNotNull($reconnectionEvent);
    }

    protected function tearDown(): void
    {
        // Clear Redis cache if used
        if (config('cache.default') === 'redis') {
            Cache::flush();
        }
        
        parent::tearDown();
    }
}