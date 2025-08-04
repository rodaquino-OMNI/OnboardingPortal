<?php

namespace Database\Factories;

use App\Models\VideoSession;
use App\Models\Interview;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Carbon\Carbon;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\VideoSession>
 */
class VideoSessionFactory extends Factory
{
    protected $model = VideoSession::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $statuses = ['created', 'active', 'ended', 'failed'];
        $providers = ['zoom', 'teams', 'meet', 'webex', 'custom'];
        $recordingStatuses = ['not_started', 'recording', 'stopped', 'available', 'failed'];
        
        $status = fake()->randomElement($statuses);
        $createdAt = fake()->dateTimeBetween('-30 days', 'now');
        
        $startedAt = null;
        $endedAt = null;
        $durationMinutes = null;
        
        if (in_array($status, ['active', 'ended'])) {
            $startedAt = fake()->dateTimeBetween($createdAt, 'now');
            if ($status === 'ended') {
                $endedAt = fake()->dateTimeBetween($startedAt, Carbon::parse($startedAt)->addHours(2));
                $durationMinutes = Carbon::parse($startedAt)->diffInMinutes($endedAt);
            }
        }

        $recordingStatus = fake()->randomElement($recordingStatuses);
        $recordingStartedAt = null;
        $recordingStoppedAt = null;
        $recordingDuration = null;
        $recordingSize = null;
        $recordingUrl = null;

        if (in_array($recordingStatus, ['recording', 'stopped', 'available'])) {
            $recordingStartedAt = $startedAt ? fake()->dateTimeBetween($startedAt, Carbon::parse($startedAt)->addMinutes(5)) : null;
            if (in_array($recordingStatus, ['stopped', 'available'])) {
                $recordingStoppedAt = $endedAt ? fake()->dateTimeBetween($recordingStartedAt, $endedAt) : fake()->dateTimeBetween($recordingStartedAt, 'now');
                $recordingDuration = $recordingStartedAt ? Carbon::parse($recordingStartedAt)->diffInSeconds($recordingStoppedAt) : null;
                $recordingSize = fake()->numberBetween(50000000, 500000000); // 50MB to 500MB
                $recordingUrl = $recordingStatus === 'available' ? fake()->url() : null;
            }
        }

        // Generate participants array
        $participantCount = fake()->numberBetween(2, 4);
        $participants = [];
        for ($i = 0; $i < $participantCount; $i++) {
            $participants[] = [
                'id' => fake()->uuid(),
                'name' => fake()->name(),
                'email' => fake()->email(),
                'role' => fake()->randomElement(['host', 'participant', 'observer']),
                'status' => fake()->randomElement(['joined', 'left', 'waiting']),
                'joined_at' => $startedAt ? fake()->dateTimeBetween($startedAt, Carbon::parse($startedAt)->addMinutes(10)) : null,
                'left_at' => $status === 'ended' ? fake()->optional(0.8)->dateTimeBetween($startedAt, $endedAt) : null,
            ];
        }

        // Generate session analytics
        $sessionAnalytics = [
            'total_participants' => $participantCount,
            'peak_participants' => fake()->numberBetween($participantCount, $participantCount + 2),
            'average_duration' => $durationMinutes,
            'audio_quality' => fake()->randomFloat(2, 3.0, 5.0),
            'video_quality' => fake()->randomFloat(2, 3.0, 5.0),
            'connection_stability' => fake()->randomFloat(2, 80, 100),
            'bandwidth_usage' => fake()->numberBetween(1000, 5000), // KB/s
        ];

        // Generate technical issues (if any)
        $technicalIssues = [];
        if (fake()->boolean(20)) {
            $issueCount = fake()->numberBetween(1, 3);
            for ($i = 0; $i < $issueCount; $i++) {
                $technicalIssues[] = [
                    'id' => 'issue_' . fake()->unique()->randomNumber(6),
                    'type' => fake()->randomElement(['audio_issue', 'video_issue', 'connection_drop', 'screen_share_failed']),
                    'severity' => fake()->randomElement(['low', 'medium', 'high']),
                    'description' => fake()->sentence(),
                    'timestamp' => fake()->dateTimeBetween($startedAt, $endedAt ?? 'now'),
                    'resolved' => fake()->boolean(80),
                ];
            }
        }

        // Generate chat messages (if enabled)
        $chatMessages = [];
        if (fake()->boolean(60)) {
            $messageCount = fake()->numberBetween(0, 10);
            for ($i = 0; $i < $messageCount; $i++) {
                $chatMessages[] = [
                    'id' => 'msg_' . fake()->unique()->randomNumber(6),
                    'sender_id' => fake()->randomElement(array_column($participants, 'id')),
                    'sender_name' => fake()->name(),
                    'message' => fake()->sentence(),
                    'timestamp' => fake()->dateTimeBetween($startedAt, $endedAt ?? 'now'),
                    'type' => fake()->randomElement(['text', 'file', 'emoji']),
                ];
            }
        }

        return [
            'interview_id' => Interview::factory(),
            'session_id' => 'vs_' . fake()->unique()->randomNumber(8),
            'provider' => fake()->randomElement($providers),
            'status' => $status,
            'participants' => $participants,
            'settings' => [
                'audio_enabled' => true,
                'video_enabled' => true,
                'chat_enabled' => fake()->boolean(80),
                'screen_share_enabled' => fake()->boolean(60),
                'recording_enabled' => fake()->boolean(40),
                'waiting_room_enabled' => fake()->boolean(70),
                'participant_limit' => fake()->numberBetween(5, 20),
                'auto_record' => fake()->boolean(30),
            ],
            'created_by' => User::factory(),
            'recording_archive_id' => fake()->optional(0.3)->uuid(),
            'recording_status' => $recordingStatus,
            'recording_started_at' => $recordingStartedAt,
            'recording_stopped_at' => $recordingStoppedAt,
            'recording_duration' => $recordingDuration,
            'recording_size' => $recordingSize,
            'recording_url' => $recordingUrl,
            'recording_started_by' => $recordingStartedAt ? User::factory() : null,
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'ended_by' => $endedAt ? User::factory() : null,
            'duration_minutes' => $durationMinutes,
            'session_analytics' => $sessionAnalytics,
            'technical_issues' => $technicalIssues,
            'quality_rating' => $status === 'ended' ? fake()->optional(0.7)->numberBetween(1, 5) : null,
            'chat_enabled' => fake()->boolean(80),
            'screen_share_enabled' => fake()->boolean(60),
            'recording_enabled' => fake()->boolean(40),
            'chat_messages' => $chatMessages,
            'screen_share_sessions' => fake()->optional(0.3)->randomElements([
                ['started_at' => fake()->dateTime(), 'ended_at' => fake()->dateTime(), 'shared_by' => fake()->name()]
            ], fake()->numberBetween(0, 2)),
            'hipaa_compliant' => fake()->boolean(90),
            'encryption_enabled' => fake()->boolean(95),
            'encryption_key_id' => fake()->optional(0.95)->uuid(),
            'security_audit_log' => [
                [
                    'event' => 'session_created',
                    'timestamp' => $createdAt,
                    'user_id' => fake()->randomNumber(),
                    'ip_address' => fake()->ipv4(),
                ]
            ],
            'bandwidth_used' => fake()->numberBetween(100, 2000), // MB
            'storage_used' => $recordingSize ? round($recordingSize / (1024 * 1024), 2) : 0, // MB
            'session_cost' => fake()->randomFloat(4, 0.50, 15.00),
        ];
    }

    /**
     * Create an active session.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
            'started_at' => fake()->dateTimeBetween('-2 hours', 'now'),
            'ended_at' => null,
            'duration_minutes' => null,
        ]);
    }

    /**
     * Create an ended session.
     */
    public function ended(): static
    {
        $startedAt = fake()->dateTimeBetween('-7 days', '-1 hour');
        $endedAt = fake()->dateTimeBetween($startedAt, Carbon::parse($startedAt)->addHours(2));
        
        return $this->state(fn (array $attributes) => [
            'status' => 'ended',
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'duration_minutes' => Carbon::parse($startedAt)->diffInMinutes($endedAt),
            'ended_by' => User::factory(),
            'quality_rating' => fake()->numberBetween(3, 5),
        ]);
    }

    /**
     * Create a session with recording.
     */
    public function withRecording(): static
    {
        $startedAt = fake()->dateTimeBetween('-7 days', '-1 hour');
        $endedAt = fake()->dateTimeBetween($startedAt, Carbon::parse($startedAt)->addHours(2));
        $recordingStartedAt = fake()->dateTimeBetween($startedAt, Carbon::parse($startedAt)->addMinutes(5));
        $recordingStoppedAt = fake()->dateTimeBetween($recordingStartedAt, $endedAt);
        
        return $this->state(fn (array $attributes) => [
            'recording_enabled' => true,
            'recording_status' => 'available',
            'recording_started_at' => $recordingStartedAt,
            'recording_stopped_at' => $recordingStoppedAt,
            'recording_duration' => Carbon::parse($recordingStartedAt)->diffInSeconds($recordingStoppedAt),
            'recording_size' => fake()->numberBetween(100000000, 1000000000), // 100MB to 1GB
            'recording_url' => fake()->url(),
            'recording_started_by' => User::factory(),
        ]);
    }

    /**
     * Create a HIPAA compliant session.
     */
    public function hipaaCompliant(): static
    {
        return $this->state(fn (array $attributes) => [
            'hipaa_compliant' => true,
            'encryption_enabled' => true,
            'encryption_key_id' => fake()->uuid(),
            'security_audit_log' => [
                [
                    'event' => 'session_created',
                    'timestamp' => fake()->dateTime(),
                    'user_id' => fake()->randomNumber(),
                    'ip_address' => fake()->ipv4(),
                ],
                [
                    'event' => 'encryption_enabled',
                    'timestamp' => fake()->dateTime(),
                    'encryption_type' => 'AES-256',
                ],
            ],
        ]);
    }

    /**
     * Create a session with technical issues.
     */
    public function withTechnicalIssues(): static
    {
        return $this->state(fn (array $attributes) => [
            'technical_issues' => [
                [
                    'id' => 'issue_' . fake()->randomNumber(6),
                    'type' => 'connection_drop',
                    'severity' => 'high',
                    'description' => 'Multiple connection drops detected',
                    'timestamp' => fake()->dateTime(),
                    'resolved' => false,
                ],
                [
                    'id' => 'issue_' . fake()->randomNumber(6),
                    'type' => 'audio_issue',
                    'severity' => 'medium',
                    'description' => 'Audio quality degradation',
                    'timestamp' => fake()->dateTime(),
                    'resolved' => true,
                ],
            ],
            'quality_rating' => fake()->numberBetween(1, 3),
        ]);
    }

    /**
     * Create a high-quality session.
     */
    public function highQuality(): static
    {
        return $this->state(fn (array $attributes) => [
            'session_analytics' => [
                'total_participants' => fake()->numberBetween(2, 4),
                'peak_participants' => fake()->numberBetween(2, 4),
                'audio_quality' => fake()->randomFloat(2, 4.5, 5.0),
                'video_quality' => fake()->randomFloat(2, 4.5, 5.0),
                'connection_stability' => fake()->randomFloat(2, 95, 100),
                'bandwidth_usage' => fake()->numberBetween(2000, 5000),
            ],
            'technical_issues' => [],
            'quality_rating' => 5,
        ]);
    }

    /**
     * Create a session from specific provider.
     */
    public function zoom(): static
    {
        return $this->state(fn (array $attributes) => [
            'provider' => 'zoom',
            'session_id' => 'zoom_' . fake()->randomNumber(10),
        ]);
    }

    /**
     * Create a session from specific provider.
     */
    public function teams(): static
    {
        return $this->state(fn (array $attributes) => [
            'provider' => 'teams',
            'session_id' => 'teams_' . fake()->uuid(),
        ]);
    }
}