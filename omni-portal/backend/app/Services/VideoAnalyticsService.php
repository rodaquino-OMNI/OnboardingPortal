<?php

namespace App\Services;

use App\Models\VideoSession;
use App\Services\EncryptionService;
use App\Services\StorageService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class VideoAnalyticsService
{
    protected EncryptionService $encryptionService;
    protected StorageService $storageService;

    public function __construct()
    {
        $this->encryptionService = app(EncryptionService::class);
        $this->storageService = app(StorageService::class);
    }

    /**
     * Process and analyze video session
     */
    public function analyzeSession(VideoSession $session): SessionAnalytics
    {
        $analytics = [
            'session_id' => $session->session_id,
            'duration' => $this->calculateDuration($session),
            'participants' => $this->analyzeParticipants($session),
            'quality_metrics' => $this->getQualityMetrics($session),
            'engagement_score' => $this->calculateEngagementScore($session),
            'compliance_status' => $this->checkComplianceStatus($session),
            'technical_performance' => $this->analyzeTechnicalPerformance($session),
            'cost_analysis' => $this->performCostAnalysis($session),
        ];

        // Store analytics securely
        $this->storeAnalytics($session->id, $analytics);

        return new SessionAnalytics($analytics);
    }

    /**
     * Generate session quality report
     */
    public function generateQualityReport(VideoSession $session): array
    {
        $metrics = [
            'video_quality' => $this->analyzeVideoQuality($session),
            'audio_quality' => $this->analyzeAudioQuality($session),
            'network_stability' => $this->analyzeNetworkStability($session),
            'participant_experience' => $this->analyzeParticipantExperience($session),
            'security_compliance' => $this->analyzeSecurityCompliance($session),
        ];

        return [
            'session_id' => $session->session_id,
            'overall_score' => $this->calculateOverallScore($metrics),
            'metrics' => $metrics,
            'recommendations' => $this->generateRecommendations($metrics),
            'compliance_score' => $this->calculateComplianceScore($session),
            'generated_at' => now(),
        ];
    }

    /**
     * Secure recording processing with analytics
     */
    public function processRecording(string $archiveId): array
    {
        try {
            // Get session data
            $session = VideoSession::where('recording_archive_id', $archiveId)->first();
            if (!$session) {
                throw new \Exception('Recording session not found');
            }

            $processedData = [
                'transcription' => $this->generateTranscriptionMetadata($session),
                'sentiment_analysis' => $this->analyzeSentiment($session),
                'medical_keywords' => $this->extractMedicalKeywords($session),
                'compliance_markers' => $this->identifyComplianceMarkers($session),
                'quality_assessment' => $this->assessRecordingQuality($session),
                'duration_analysis' => $this->analyzeRecordingDuration($session),
            ];

            // Store processed data securely
            $encryptedData = $this->encryptionService->encrypt(json_encode($processedData));
            $this->storageService->store("recordings/analytics/{$archiveId}", $encryptedData);

            return [
                'success' => true,
                'archive_id' => $archiveId,
                'processed_at' => now(),
                'analytics' => $processedData,
            ];

        } catch (\Exception $e) {
            Log::error('Recording processing error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Recording processing failed',
            ];
        }
    }

    /**
     * Real-time session monitoring
     */
    public function monitorActiveSession(string $sessionId): array
    {
        $session = VideoSession::where('session_id', $sessionId)->first();
        if (!$session) {
            return ['error' => 'Session not found'];
        }

        // Get real-time metrics from cache
        $realtimeMetrics = Cache::get("video_session_metrics:{$sessionId}", []);

        return [
            'session_id' => $sessionId,
            'status' => $session->status,
            'duration' => $session->session_duration,
            'active_participants' => count($session->active_participants),
            'realtime_metrics' => [
                'video_bitrate' => $realtimeMetrics['video_bitrate'] ?? 0,
                'audio_bitrate' => $realtimeMetrics['audio_bitrate'] ?? 0,
                'packet_loss' => $realtimeMetrics['packet_loss'] ?? 0,
                'latency' => $realtimeMetrics['latency'] ?? 0,
                'jitter' => $realtimeMetrics['jitter'] ?? 0,
            ],
            'quality_indicators' => $this->calculateQualityIndicators($realtimeMetrics),
            'alerts' => $this->checkForAlerts($session, $realtimeMetrics),
        ];
    }

    /**
     * Generate comprehensive analytics dashboard data
     */
    public function getDashboardAnalytics(array $filters = []): array
    {
        $dateFrom = Carbon::parse($filters['date_from'] ?? now()->subDays(30));
        $dateTo = Carbon::parse($filters['date_to'] ?? now());

        return [
            'summary' => $this->getSummaryMetrics($dateFrom, $dateTo),
            'usage_trends' => $this->getUsageTrends($dateFrom, $dateTo),
            'quality_metrics' => $this->getAggregatedQualityMetrics($dateFrom, $dateTo),
            'cost_breakdown' => $this->getCostBreakdown($dateFrom, $dateTo),
            'compliance_overview' => $this->getComplianceOverview($dateFrom, $dateTo),
            'top_issues' => $this->getTopTechnicalIssues($dateFrom, $dateTo),
        ];
    }

    /**
     * Calculate session duration
     */
    protected function calculateDuration(VideoSession $session): array
    {
        $startTime = $session->started_at ?? $session->created_at;
        $endTime = $session->ended_at ?? now();
        
        $durationMinutes = $startTime->diffInMinutes($endTime);
        
        return [
            'total_minutes' => $durationMinutes,
            'formatted' => $this->formatDuration($durationMinutes),
            'billing_minutes' => ceil($durationMinutes / 15) * 15, // Round up to 15-minute blocks
        ];
    }

    /**
     * Analyze participants behavior
     */
    protected function analyzeParticipants(VideoSession $session): array
    {
        $participants = collect($session->participants);
        
        return [
            'total_count' => $participants->count(),
            'completed_count' => $participants->where('status', 'left')->count(),
            'average_duration' => $this->calculateAverageParticipantDuration($participants),
            'roles_breakdown' => $participants->groupBy('role')->map->count(),
            'connection_issues' => $participants->where('connection_issues', true)->count(),
        ];
    }

    /**
     * Get quality metrics from session data
     */
    protected function getQualityMetrics(VideoSession $session): array
    {
        $analytics = $session->session_analytics ?? [];
        
        return [
            'average_video_bitrate' => $analytics['avg_video_bitrate'] ?? 0,
            'average_audio_bitrate' => $analytics['avg_audio_bitrate'] ?? 0,
            'packet_loss_rate' => $analytics['packet_loss_rate'] ?? 0,
            'average_latency' => $analytics['avg_latency'] ?? 0,
            'resolution_changes' => $analytics['resolution_changes'] ?? 0,
            'reconnection_attempts' => $analytics['reconnection_attempts'] ?? 0,
        ];
    }

    /**
     * Calculate engagement score based on various factors
     */
    protected function calculateEngagementScore(VideoSession $session): float
    {
        $factors = [
            'duration_score' => $this->scoreDuration($session),
            'interaction_score' => $this->scoreInteractions($session),
            'video_on_time' => $this->scoreVideoUsage($session),
            'audio_quality_score' => $this->scoreAudioQuality($session),
            'completion_rate' => $this->scoreCompletionRate($session),
        ];

        // Weighted average
        $weights = [0.2, 0.3, 0.2, 0.15, 0.15];
        $score = 0;
        
        foreach (array_values($factors) as $i => $factor) {
            $score += $factor * $weights[$i];
        }
        
        return round($score, 2);
    }

    /**
     * Check compliance status
     */
    protected function checkComplianceStatus(VideoSession $session): array
    {
        return [
            'hipaa_compliant' => $session->hipaa_compliant,
            'encryption_enabled' => $session->encryption_enabled,
            'consent_verified' => $this->verifyConsent($session),
            'audit_log_complete' => !empty($session->security_audit_log),
            'recording_encrypted' => $session->recording_status === 'available' && 
                                   !empty($session->encryption_key_id),
        ];
    }

    /**
     * Analyze video quality metrics
     */
    protected function analyzeVideoQuality(VideoSession $session): array
    {
        $analytics = $session->session_analytics ?? [];
        
        $score = 100;
        
        // Deduct points for quality issues
        if (($analytics['avg_video_bitrate'] ?? 0) < 1000000) $score -= 20;
        if (($analytics['packet_loss_rate'] ?? 0) > 0.02) $score -= 15;
        if (($analytics['resolution_changes'] ?? 0) > 5) $score -= 10;
        
        return [
            'score' => max(0, $score),
            'average_bitrate' => $analytics['avg_video_bitrate'] ?? 0,
            'resolution' => $analytics['max_resolution'] ?? 'unknown',
            'stability' => $analytics['resolution_changes'] ?? 0 < 3 ? 'stable' : 'unstable',
        ];
    }

    /**
     * Analyze audio quality metrics
     */
    protected function analyzeAudioQuality(VideoSession $session): array
    {
        $analytics = $session->session_analytics ?? [];
        
        $score = 100;
        
        // Deduct points for audio issues
        if (($analytics['avg_audio_bitrate'] ?? 0) < 64000) $score -= 25;
        if (($analytics['audio_packet_loss'] ?? 0) > 0.01) $score -= 20;
        if (($analytics['echo_detected'] ?? false)) $score -= 15;
        
        return [
            'score' => max(0, $score),
            'average_bitrate' => $analytics['avg_audio_bitrate'] ?? 0,
            'echo_cancellation' => !($analytics['echo_detected'] ?? false),
            'noise_suppression' => $analytics['noise_suppression_active'] ?? false,
        ];
    }

    /**
     * Generate recommendations based on metrics
     */
    protected function generateRecommendations(array $metrics): array
    {
        $recommendations = [];
        
        // Video quality recommendations
        if ($metrics['video_quality']['score'] < 70) {
            $recommendations[] = [
                'type' => 'video',
                'priority' => 'high',
                'message' => 'Consider reducing video resolution or frame rate to improve stability',
            ];
        }
        
        // Audio quality recommendations
        if ($metrics['audio_quality']['score'] < 70) {
            $recommendations[] = [
                'type' => 'audio',
                'priority' => 'high',
                'message' => 'Enable echo cancellation and noise suppression for better audio quality',
            ];
        }
        
        // Network recommendations
        if ($metrics['network_stability']['packet_loss'] > 0.02) {
            $recommendations[] = [
                'type' => 'network',
                'priority' => 'critical',
                'message' => 'Network instability detected. Consider using a wired connection',
            ];
        }
        
        return $recommendations;
    }

    /**
     * Calculate overall quality score
     */
    protected function calculateOverallScore(array $metrics): float
    {
        $scores = [
            $metrics['video_quality']['score'] ?? 0,
            $metrics['audio_quality']['score'] ?? 0,
            $metrics['network_stability']['score'] ?? 0,
            $metrics['participant_experience']['score'] ?? 0,
        ];
        
        return round(array_sum($scores) / count($scores), 1);
    }

    /**
     * Store analytics data
     */
    protected function storeAnalytics(int $sessionId, array $analytics): void
    {
        // Store in database
        DB::table('video_session_analytics')->insert([
            'video_session_id' => $sessionId,
            'analytics_data' => json_encode($analytics),
            'created_at' => now(),
        ]);
        
        // Cache for quick access
        Cache::put("video_analytics:{$sessionId}", $analytics, now()->addDays(30));
    }

    /**
     * Get summary metrics for dashboard
     */
    protected function getSummaryMetrics(Carbon $dateFrom, Carbon $dateTo): array
    {
        $sessions = VideoSession::whereBetween('created_at', [$dateFrom, $dateTo])->get();
        
        return [
            'total_sessions' => $sessions->count(),
            'total_duration_minutes' => $sessions->sum('duration_minutes'),
            'average_duration_minutes' => $sessions->avg('duration_minutes'),
            'total_participants' => $sessions->sum(function ($session) {
                return count($session->participants);
            }),
            'sessions_with_recording' => $sessions->where('recording_status', 'available')->count(),
            'average_quality_rating' => $sessions->avg('quality_rating'),
            'total_cost' => $sessions->sum('session_cost'),
        ];
    }

    /**
     * Get usage trends
     */
    protected function getUsageTrends(Carbon $dateFrom, Carbon $dateTo): array
    {
        return VideoSession::whereBetween('created_at', [$dateFrom, $dateTo])
            ->selectRaw('DATE(created_at) as date, COUNT(*) as sessions, SUM(duration_minutes) as total_minutes')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->toArray();
    }

    /**
     * Format duration for display
     */
    protected function formatDuration(int $minutes): string
    {
        $hours = floor($minutes / 60);
        $mins = $minutes % 60;
        
        if ($hours > 0) {
            return sprintf('%dh %dm', $hours, $mins);
        }
        
        return sprintf('%dm', $mins);
    }

    /**
     * Score various session aspects
     */
    protected function scoreDuration(VideoSession $session): float
    {
        $duration = $session->duration_minutes ?? 0;
        
        if ($duration < 5) return 0.2;
        if ($duration < 15) return 0.5;
        if ($duration < 30) return 0.8;
        if ($duration < 60) return 1.0;
        
        return 0.9; // Slightly lower for very long sessions
    }

    protected function scoreInteractions(VideoSession $session): float
    {
        $chatMessages = count($session->chat_messages ?? []);
        $screenShares = count($session->screen_share_sessions ?? []);
        
        $score = min(1.0, ($chatMessages * 0.1) + ($screenShares * 0.3));
        
        return $score;
    }

    protected function scoreVideoUsage(VideoSession $session): float
    {
        $participants = collect($session->participants);
        $videoOnCount = $participants->where('video_enabled', true)->count();
        
        if ($participants->isEmpty()) return 0;
        
        return $videoOnCount / $participants->count();
    }

    protected function scoreAudioQuality(VideoSession $session): float
    {
        $issues = $session->technical_issues ?? [];
        $audioIssues = collect($issues)->where('type', 'audio')->count();
        
        if ($audioIssues === 0) return 1.0;
        if ($audioIssues < 3) return 0.7;
        if ($audioIssues < 5) return 0.5;
        
        return 0.3;
    }

    protected function scoreCompletionRate(VideoSession $session): float
    {
        if ($session->status !== 'ended') return 0.5;
        
        $participants = collect($session->participants);
        $completedCount = $participants->where('left_at', '!=', null)->count();
        
        if ($participants->isEmpty()) return 0;
        
        return $completedCount / $participants->count();
    }
}

// Analytics Data Transfer Object
class SessionAnalytics
{
    public function __construct(public array $data) {}
    
    public function toArray(): array
    {
        return $this->data;
    }
    
    public function getEngagementScore(): float
    {
        return $this->data['engagement_score'] ?? 0;
    }
    
    public function getComplianceStatus(): array
    {
        return $this->data['compliance_status'] ?? [];
    }
}