<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Carbon\Carbon;

class VideoConferencingService
{
    protected $vonageApiKey;
    protected $vonageApiSecret;
    protected $vonageApiUrl;
    protected $hipaaCompliant;

    public function __construct()
    {
        $this->vonageApiKey = config('video.vonage.api_key');
        $this->vonageApiSecret = config('video.vonage.api_secret');
        $this->vonageApiUrl = config('video.vonage.api_url', 'https://api.opentok.com');
        $this->hipaaCompliant = config('video.hipaa.enabled', true);
    }

    /**
     * Create a new video session for telehealth consultation
     */
    public function createSession(array $participants, array $options = []): array
    {
        try {
            $sessionId = Str::uuid();
            $archiveMode = $options['record'] ?? true ? 'always' : 'manual';
            
            // Create session with HIPAA-compliant settings
            $sessionData = [
                'sessionId' => $sessionId,
                'archiveMode' => $archiveMode,
                'location' => config('app.url'),
                'mediaMode' => 'routed', // For HIPAA compliance
                'encryptionEnabled' => true,
                'initialLayoutClassList' => ['focus'],
                'maxBitrate' => 2000000, // 2Mbps for quality telehealth
                'resolution' => '1280x720'
            ];

            $response = Http::withHeaders([
                'X-OPENTOK-AUTH' => $this->generateJwt(),
                'Content-Type' => 'application/json'
            ])->post("{$this->vonageApiUrl}/session/create", $sessionData);

            if ($response->successful()) {
                $session = $response->json();
                
                // Generate tokens for participants
                $tokens = [];
                foreach ($participants as $participant) {
                    $tokens[$participant['id']] = $this->generateToken(
                        $session['sessionId'],
                        $participant['role'],
                        $participant['name']
                    );
                }

                // Store session metadata securely
                $this->storeSessionMetadata($sessionId, [
                    'session' => $session,
                    'participants' => $participants,
                    'options' => $options,
                    'created_at' => now(),
                    'hipaa_compliant' => $this->hipaaCompliant
                ]);

                return [
                    'success' => true,
                    'sessionId' => $session['sessionId'],
                    'tokens' => $tokens,
                    'archiveMode' => $archiveMode,
                    'encryptionEnabled' => true
                ];
            }

            Log::error('Vonage session creation failed', ['response' => $response->body()]);
            return $this->getFallbackSession($participants);

        } catch (\Exception $e) {
            Log::error('Video conferencing service error: ' . $e->getMessage());
            return $this->getFallbackSession($participants);
        }
    }

    /**
     * Generate secure token for session participant
     */
    public function generateToken(string $sessionId, string $role = 'publisher', string $data = ''): string
    {
        try {
            $tokenData = [
                'session_id' => $sessionId,
                'role' => $role, // publisher, subscriber, moderator
                'data' => json_encode([
                    'name' => $data,
                    'hipaa_compliant' => true,
                    'timestamp' => time()
                ]),
                'expire_time' => time() + (3600 * 2), // 2 hours
                'initial_layout_class_list' => 'focus'
            ];

            $response = Http::withHeaders([
                'X-OPENTOK-AUTH' => $this->generateJwt(),
                'Content-Type' => 'application/json'
            ])->post("{$this->vonageApiUrl}/session/{$sessionId}/token", $tokenData);

            if ($response->successful()) {
                return $response->json()['token'];
            }

            Log::error('Token generation failed', ['sessionId' => $sessionId]);
            return $this->generateFallbackToken($sessionId, $role);

        } catch (\Exception $e) {
            Log::error('Token generation error: ' . $e->getMessage());
            return $this->generateFallbackToken($sessionId, $role);
        }
    }

    /**
     * Start recording session
     */
    public function startRecording(string $sessionId, array $options = []): array
    {
        try {
            if (!$this->hipaaCompliant) {
                Log::warning('Recording attempted without HIPAA compliance');
                return ['success' => false, 'message' => 'HIPAA compliance required for recording'];
            }

            $recordingData = [
                'sessionId' => $sessionId,
                'hasAudio' => $options['hasAudio'] ?? true,
                'hasVideo' => $options['hasVideo'] ?? true,
                'name' => $options['name'] ?? 'Telehealth_Session_' . date('Y-m-d_H-i-s'),
                'outputMode' => 'composed',
                'resolution' => '1280x720',
                'streamMode' => 'auto'
            ];

            $response = Http::withHeaders([
                'X-OPENTOK-AUTH' => $this->generateJwt(),
                'Content-Type' => 'application/json'
            ])->post("{$this->vonageApiUrl}/v2/project/{$this->vonageApiKey}/archive", $recordingData);

            if ($response->successful()) {
                $archive = $response->json();
                
                // Store recording metadata
                $this->storeRecordingMetadata($sessionId, $archive);
                
                return [
                    'success' => true,
                    'archiveId' => $archive['id'],
                    'status' => $archive['status']
                ];
            }

            Log::error('Recording start failed', ['response' => $response->body()]);
            return ['success' => false, 'message' => 'Failed to start recording'];

        } catch (\Exception $e) {
            Log::error('Recording start error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Recording service error'];
        }
    }

    /**
     * Stop recording session
     */
    public function stopRecording(string $archiveId): array
    {
        try {
            $response = Http::withHeaders([
                'X-OPENTOK-AUTH' => $this->generateJwt(),
                'Content-Type' => 'application/json'
            ])->post("{$this->vonageApiUrl}/v2/project/{$this->vonageApiKey}/archive/{$archiveId}/stop");

            if ($response->successful()) {
                $archive = $response->json();
                
                return [
                    'success' => true,
                    'archiveId' => $archive['id'],
                    'status' => $archive['status'],
                    'duration' => $archive['duration'] ?? 0
                ];
            }

            return ['success' => false, 'message' => 'Failed to stop recording'];

        } catch (\Exception $e) {
            Log::error('Recording stop error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Recording service error'];
        }
    }

    /**
     * Get session analytics and health metrics
     */
    public function getSessionAnalytics(string $sessionId): array
    {
        try {
            $response = Http::withHeaders([
                'X-OPENTOK-AUTH' => $this->generateJwt(),
                'Accept' => 'application/json'
            ])->get("{$this->vonageApiUrl}/v2/project/{$this->vonageApiKey}/session/{$sessionId}/stream");

            if ($response->successful()) {
                $streams = $response->json();
                
                return [
                    'success' => true,
                    'activeStreams' => count($streams['items'] ?? []),
                    'streams' => $streams['items'] ?? [],
                    'sessionHealth' => $this->calculateSessionHealth($streams['items'] ?? [])
                ];
            }

            return ['success' => false, 'message' => 'Analytics unavailable'];

        } catch (\Exception $e) {
            Log::error('Session analytics error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Analytics service error'];
        }
    }

    /**
     * Enable screen sharing for telehealth
     */
    public function enableScreenSharing(string $sessionId, string $participantId): array
    {
        try {
            // Generate screen sharing token with special permissions
            $screenToken = $this->generateToken($sessionId, 'publisher', 'screen_share_' . $participantId);
            
            return [
                'success' => true,
                'screenToken' => $screenToken,
                'instructions' => [
                    'Use this token to publish screen sharing stream',
                    'Set videoSource to screen for screen capture',
                    'Ensure participant consent before sharing'
                ]
            ];

        } catch (\Exception $e) {
            Log::error('Screen sharing setup error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Screen sharing unavailable'];
        }
    }

    /**
     * Get archived recording URL (HIPAA-compliant)
     */
    public function getRecordingUrl(string $archiveId, bool $temporary = true): array
    {
        try {
            $response = Http::withHeaders([
                'X-OPENTOK-AUTH' => $this->generateJwt(),
                'Accept' => 'application/json'
            ])->get("{$this->vonageApiUrl}/v2/project/{$this->vonageApiKey}/archive/{$archiveId}");

            if ($response->successful()) {
                $archive = $response->json();
                
                if ($archive['status'] === 'available') {
                    // Generate secure, temporary URL for HIPAA compliance
                    $secureUrl = $temporary ? 
                        $this->generateSecureDownloadUrl($archive['url']) : 
                        $archive['url'];
                    
                    return [
                        'success' => true,
                        'url' => $secureUrl,
                        'duration' => $archive['duration'],
                        'size' => $archive['size'],
                        'temporary' => $temporary,
                        'expiresAt' => $temporary ? now()->addHours(2) : null
                    ];
                }
                
                return [
                    'success' => false, 
                    'message' => 'Recording not ready',
                    'status' => $archive['status']
                ];
            }

            return ['success' => false, 'message' => 'Recording not found'];

        } catch (\Exception $e) {
            Log::error('Recording URL error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Recording service error'];
        }
    }

    /**
     * Generate JWT for Vonage API authentication
     */
    protected function generateJwt(): string
    {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'iss' => $this->vonageApiKey,
            'ist' => 'project',
            'iat' => time(),
            'exp' => time() + 300 // 5 minutes
        ]);

        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, $this->vonageApiSecret, true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }

    /**
     * Store session metadata securely in cache
     */
    protected function storeSessionMetadata(string $sessionId, array $metadata): void
    {
        Cache::put("video_session:{$sessionId}", $metadata, now()->addHours(24));
    }

    /**
     * Store recording metadata
     */
    protected function storeRecordingMetadata(string $sessionId, array $archive): void
    {
        Cache::put("video_recording:{$archive['id']}", [
            'sessionId' => $sessionId,
            'archive' => $archive,
            'created_at' => now()
        ], now()->addDays(30));
    }

    /**
     * Calculate session health metrics
     */
    protected function calculateSessionHealth(array $streams): array
    {
        $health = [
            'overall' => 'good',
            'video_quality' => 'good',
            'audio_quality' => 'good',
            'connection_stability' => 'stable'
        ];

        // Analyze stream quality metrics
        foreach ($streams as $stream) {
            if (isset($stream['videoType']) && $stream['videoType'] === 'camera') {
                // Check video quality indicators
                if (isset($stream['videoDimensions'])) {
                    $width = $stream['videoDimensions']['width'] ?? 0;
                    if ($width < 640) {
                        $health['video_quality'] = 'poor';
                        $health['overall'] = 'poor';
                    } elseif ($width < 1280) {
                        $health['video_quality'] = 'fair';
                        if ($health['overall'] === 'good') {
                            $health['overall'] = 'fair';
                        }
                    }
                }
            }
        }

        return $health;
    }

    /**
     * Generate secure download URL for recordings
     */
    protected function generateSecureDownloadUrl(string $originalUrl): string
    {
        // Create a signed URL that expires in 2 hours
        $expires = time() + 7200;
        $hash = hash_hmac('sha256', $originalUrl . $expires, config('app.key'));
        
        return route('video.recording.download', [
            'url' => base64_encode($originalUrl),
            'expires' => $expires,
            'signature' => $hash
        ]);
    }

    /**
     * Fallback session creation for WebRTC
     */
    protected function getFallbackSession(array $participants): array
    {
        Log::info('Using WebRTC fallback for video session');
        
        $sessionId = 'webrtc_' . Str::uuid();
        
        return [
            'success' => true,
            'sessionId' => $sessionId,
            'fallback' => true,
            'type' => 'webrtc',
            'stunServers' => [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ],
            'participants' => $participants
        ];
    }

    /**
     * Fallback token generation
     */
    protected function generateFallbackToken(string $sessionId, string $role): string
    {
        return base64_encode(json_encode([
            'sessionId' => $sessionId,
            'role' => $role,
            'timestamp' => time(),
            'fallback' => true
        ]));
    }

    /**
     * Validate session health and connectivity
     */
    public function validateSessionHealth(string $sessionId): array
    {
        try {
            $metadata = Cache::get("video_session:{$sessionId}");
            
            if (!$metadata) {
                return ['valid' => false, 'message' => 'Session not found'];
            }

            $createdAt = Carbon::parse($metadata['created_at']);
            $isExpired = $createdAt->addHours(4)->isPast();

            return [
                'valid' => !$isExpired,
                'sessionId' => $sessionId,
                'created_at' => $createdAt,
                'expires_at' => $createdAt->addHours(4),
                'participants' => count($metadata['participants']),
                'hipaa_compliant' => $metadata['hipaa_compliant'] ?? false
            ];

        } catch (\Exception $e) {
            Log::error('Session validation error: ' . $e->getMessage());
            return ['valid' => false, 'message' => 'Validation error'];
        }
    }
}