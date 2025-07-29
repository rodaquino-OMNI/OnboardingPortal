<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TextractMonitoringService
{
    protected $cloudWatch;
    protected $alerting;
    protected $config;

    public function __construct(
        CloudWatchService $cloudWatch = null,
        AlertingService $alerting = null
    ) {
        $this->cloudWatch = $cloudWatch;
        $this->alerting = $alerting;
        $this->config = Config::get('ocr.monitoring');
    }

    /**
     * Record comprehensive processing metrics
     */
    public function recordProcessingMetrics(string $filePath, array $result): void
    {
        $metrics = [
            'processing_time' => $result['processing_time'] ?? 0,
            'confidence_score' => $result['average_confidence'] ?? 0,
            'quality_score' => $result['quality_metrics']['overall_quality'] ?? 0,
            'file_size' => filesize($filePath),
            'pages_processed' => $result['pages_processed'] ?? 1,
            'features_used' => count($result['features_used'] ?? []),
            'forms_detected' => count($result['forms'] ?? []),
            'tables_detected' => count($result['tables'] ?? []),
            'success' => $result['success'] ?? true,
            'document_type' => $result['document_type'] ?? 'unknown',
            'query_responses' => count($result['query_responses'] ?? []),
        ];

        // Store in database for detailed analysis
        $this->storeDetailedMetrics($filePath, $metrics, $result);

        // Send to CloudWatch if available
        if ($this->cloudWatch) {
            $this->sendToCloudWatch($metrics);
        }

        // Update real-time metrics cache
        $this->updateRealtimeMetrics($metrics);

        // Check for performance alerts
        $this->checkPerformanceAlerts($metrics);
    }

    /**
     * Store detailed metrics in database
     */
    protected function storeDetailedMetrics(string $filePath, array $metrics, array $result): void
    {
        try {
            DB::table('ocr_processing_metrics')->insert([
                'file_path' => $filePath,
                'service' => 'textract',
                'processing_time' => $metrics['processing_time'],
                'confidence_score' => $metrics['confidence_score'],
                'quality_score' => $metrics['quality_score'],
                'file_size' => $metrics['file_size'],
                'pages_processed' => $metrics['pages_processed'],
                'features_used' => json_encode($result['features_used'] ?? []),
                'document_type' => $metrics['document_type'],
                'success' => $metrics['success'],
                'metrics' => json_encode($metrics),
                'result_summary' => json_encode([
                    'forms_count' => $metrics['forms_detected'],
                    'tables_count' => $metrics['tables_detected'],
                    'query_responses_count' => $metrics['query_responses'],
                    'has_signatures' => !empty($result['signatures']),
                ]),
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to store OCR metrics', [
                'error' => $e->getMessage(),
                'metrics' => $metrics
            ]);
        }
    }

    /**
     * Send metrics to CloudWatch
     */
    protected function sendToCloudWatch(array $metrics): void
    {
        if (!$this->cloudWatch) {
            return;
        }

        try {
            $metricData = [];
            
            foreach ($metrics as $name => $value) {
                if (is_numeric($value)) {
                    $metricData[] = [
                        'MetricName' => $this->formatMetricName($name),
                        'Value' => $value,
                        'Unit' => $this->getMetricUnit($name),
                        'Timestamp' => time(),
                    ];
                }
            }

            $this->cloudWatch->putMetricData([
                'Namespace' => 'AUSTA/OCR/Textract',
                'MetricData' => $metricData,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send metrics to CloudWatch', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Update real-time metrics cache
     */
    protected function updateRealtimeMetrics(array $metrics): void
    {
        $realtimeKey = 'textract_realtime_metrics';
        $existing = Cache::get($realtimeKey, []);
        
        // Update rolling averages
        $existing['total_processed'] = ($existing['total_processed'] ?? 0) + 1;
        $existing['avg_processing_time'] = $this->updateRollingAverage(
            $existing['avg_processing_time'] ?? 0,
            $metrics['processing_time'],
            $existing['total_processed']
        );
        $existing['avg_confidence'] = $this->updateRollingAverage(
            $existing['avg_confidence'] ?? 0,
            $metrics['confidence_score'],
            $existing['total_processed']
        );
        $existing['success_rate'] = $this->updateSuccessRate(
            $existing['success_rate'] ?? 100,
            $metrics['success'],
            $existing['total_processed']
        );
        
        // Store document type distribution
        $typeKey = 'type_' . $metrics['document_type'];
        $existing['document_types'][$typeKey] = ($existing['document_types'][$typeKey] ?? 0) + 1;
        
        // Update last processed timestamp
        $existing['last_processed'] = now()->toIso8601String();
        
        Cache::put($realtimeKey, $existing, now()->addHours(24));
    }

    /**
     * Update rolling average
     */
    protected function updateRollingAverage(float $currentAvg, float $newValue, int $count): float
    {
        return (($currentAvg * ($count - 1)) + $newValue) / $count;
    }

    /**
     * Update success rate
     */
    protected function updateSuccessRate(float $currentRate, bool $success, int $count): float
    {
        $successCount = ($currentRate / 100) * ($count - 1);
        if ($success) {
            $successCount++;
        }
        return ($successCount / $count) * 100;
    }

    /**
     * Check for performance alerts
     */
    protected function checkPerformanceAlerts(array $metrics): void
    {
        $alerts = [];

        // Check processing time
        if ($metrics['processing_time'] > 30) {
            $alerts[] = [
                'type' => 'high_processing_time',
                'severity' => 'warning',
                'message' => 'Processing time exceeded 30 seconds',
                'value' => $metrics['processing_time'],
                'threshold' => 30,
            ];
        }

        // Check confidence score
        if ($metrics['confidence_score'] < 80) {
            $alerts[] = [
                'type' => 'low_confidence',
                'severity' => 'warning',
                'message' => 'Confidence score below 80%',
                'value' => $metrics['confidence_score'],
                'threshold' => 80,
            ];
        }

        // Check quality score
        if ($metrics['quality_score'] < 70) {
            $alerts[] = [
                'type' => 'low_quality',
                'severity' => 'warning',
                'message' => 'Quality score below 70%',
                'value' => $metrics['quality_score'],
                'threshold' => 70,
            ];
        }

        // Send alerts if any
        if (!empty($alerts)) {
            $this->sendPerformanceAlerts($alerts, $metrics);
        }
    }

    /**
     * Send performance alerts
     */
    protected function sendPerformanceAlerts(array $alerts, array $metrics): void
    {
        foreach ($alerts as $alert) {
            Log::warning('Textract performance alert', array_merge($alert, [
                'metrics' => $metrics
            ]));
        }

        if ($this->alerting) {
            $this->alerting->sendAlert('textract_performance', $alerts);
        }
    }

    /**
     * Generate performance analytics report
     */
    public function generatePerformanceReport(array $options = []): array
    {
        $period = $options['period'] ?? '24h';
        $startTime = $this->getStartTime($period);

        // Get metrics from database
        $metrics = DB::table('ocr_processing_metrics')
            ->where('service', 'textract')
            ->where('created_at', '>=', $startTime)
            ->get();

        // Calculate performance indicators
        $performance = $this->calculatePerformanceIndicators($metrics);

        // Analyze trends
        $trends = $this->analyzePerformanceTrends($metrics);

        // Generate recommendations
        $recommendations = $this->generateRecommendations($performance, $trends);

        // Get active alerts
        $activeAlerts = $this->getActiveAlerts();

        return [
            'period' => $period,
            'generated_at' => now()->toIso8601String(),
            'total_documents' => $metrics->count(),
            'performance' => $performance,
            'trends' => $trends,
            'recommendations' => $recommendations,
            'alerts' => $activeAlerts,
            'document_type_breakdown' => $this->getDocumentTypeBreakdown($metrics),
            'hourly_distribution' => $this->getHourlyDistribution($metrics),
        ];
    }

    /**
     * Calculate performance indicators
     */
    protected function calculatePerformanceIndicators($metrics): array
    {
        if ($metrics->isEmpty()) {
            return [
                'avg_processing_time' => 0,
                'avg_confidence_score' => 0,
                'avg_quality_score' => 0,
                'success_rate' => 0,
                'avg_pages_per_document' => 0,
            ];
        }

        $totalDocs = $metrics->count();
        $successfulDocs = $metrics->where('success', true)->count();

        return [
            'avg_processing_time' => round($metrics->avg('processing_time'), 2),
            'max_processing_time' => round($metrics->max('processing_time'), 2),
            'min_processing_time' => round($metrics->min('processing_time'), 2),
            'avg_confidence_score' => round($metrics->avg('confidence_score'), 2),
            'avg_quality_score' => round($metrics->avg('quality_score'), 2),
            'success_rate' => round(($successfulDocs / $totalDocs) * 100, 2),
            'avg_pages_per_document' => round($metrics->avg('pages_processed'), 2),
            'total_pages_processed' => $metrics->sum('pages_processed'),
            'avg_file_size' => $this->formatBytes($metrics->avg('file_size')),
        ];
    }

    /**
     * Analyze performance trends
     */
    protected function analyzePerformanceTrends($metrics): array
    {
        if ($metrics->count() < 10) {
            return [
                'processing_time_trend' => 'insufficient_data',
                'confidence_trend' => 'insufficient_data',
                'quality_trend' => 'insufficient_data',
            ];
        }

        // Split metrics into two halves for trend analysis
        $half = intval($metrics->count() / 2);
        $firstHalf = $metrics->take($half);
        $secondHalf = $metrics->skip($half);

        return [
            'processing_time_trend' => $this->calculateTrend(
                $firstHalf->avg('processing_time'),
                $secondHalf->avg('processing_time')
            ),
            'confidence_trend' => $this->calculateTrend(
                $firstHalf->avg('confidence_score'),
                $secondHalf->avg('confidence_score')
            ),
            'quality_trend' => $this->calculateTrend(
                $firstHalf->avg('quality_score'),
                $secondHalf->avg('quality_score')
            ),
            'volume_trend' => $this->calculateTrend(
                $firstHalf->count(),
                $secondHalf->count()
            ),
        ];
    }

    /**
     * Calculate trend direction
     */
    protected function calculateTrend(float $oldValue, float $newValue): array
    {
        if ($oldValue == 0) {
            return ['direction' => 'stable', 'change' => 0];
        }

        $change = (($newValue - $oldValue) / $oldValue) * 100;
        
        if ($change > 5) {
            $direction = 'increasing';
        } elseif ($change < -5) {
            $direction = 'decreasing';
        } else {
            $direction = 'stable';
        }

        return [
            'direction' => $direction,
            'change' => round($change, 2),
        ];
    }

    /**
     * Generate recommendations based on performance
     */
    protected function generateRecommendations(array $performance, array $trends): array
    {
        $recommendations = [];

        // Processing time recommendations
        if ($performance['avg_processing_time'] > 20) {
            $recommendations[] = [
                'category' => 'performance',
                'priority' => 'high',
                'message' => 'Average processing time is high. Consider optimizing document preprocessing.',
                'actions' => [
                    'Reduce image resolution for documents over 2MB',
                    'Enable document caching for frequently processed files',
                    'Consider batch processing during off-peak hours',
                ],
            ];
        }

        // Confidence score recommendations
        if ($performance['avg_confidence_score'] < 85) {
            $recommendations[] = [
                'category' => 'quality',
                'priority' => 'medium',
                'message' => 'Average confidence score is below optimal. Document quality may need improvement.',
                'actions' => [
                    'Ensure documents are scanned at 300 DPI or higher',
                    'Improve lighting conditions for photo captures',
                    'Consider preprocessing to enhance contrast',
                ],
            ];
        }

        // Success rate recommendations
        if ($performance['success_rate'] < 95) {
            $recommendations[] = [
                'category' => 'reliability',
                'priority' => 'high',
                'message' => 'Success rate is below target. Review failed documents for patterns.',
                'actions' => [
                    'Check for unsupported document formats',
                    'Review error logs for common failure reasons',
                    'Ensure proper error handling and fallback mechanisms',
                ],
            ];
        }

        // Trend-based recommendations
        if ($trends['processing_time_trend']['direction'] === 'increasing') {
            $recommendations[] = [
                'category' => 'trend',
                'priority' => 'medium',
                'message' => 'Processing time is trending upward. Monitor system resources.',
                'actions' => [
                    'Check system load and resource availability',
                    'Review recent changes to document processing pipeline',
                    'Consider scaling infrastructure if needed',
                ],
            ];
        }

        return $recommendations;
    }

    /**
     * Get document type breakdown
     */
    protected function getDocumentTypeBreakdown($metrics): array
    {
        $breakdown = [];
        
        foreach ($metrics->groupBy('document_type') as $type => $docs) {
            $breakdown[$type] = [
                'count' => $docs->count(),
                'percentage' => round(($docs->count() / $metrics->count()) * 100, 2),
                'avg_processing_time' => round($docs->avg('processing_time'), 2),
                'avg_confidence' => round($docs->avg('confidence_score'), 2),
                'success_rate' => round(($docs->where('success', true)->count() / $docs->count()) * 100, 2),
            ];
        }

        return $breakdown;
    }

    /**
     * Get hourly distribution
     */
    protected function getHourlyDistribution($metrics): array
    {
        $distribution = [];
        
        foreach ($metrics as $metric) {
            $hour = Carbon::parse($metric->created_at)->hour;
            if (!isset($distribution[$hour])) {
                $distribution[$hour] = 0;
            }
            $distribution[$hour]++;
        }

        // Fill missing hours with 0
        for ($i = 0; $i < 24; $i++) {
            if (!isset($distribution[$i])) {
                $distribution[$i] = 0;
            }
        }

        ksort($distribution);
        
        return $distribution;
    }

    /**
     * Get active alerts
     */
    protected function getActiveAlerts(): array
    {
        return Cache::get('textract_active_alerts', []);
    }

    /**
     * Get start time for period
     */
    protected function getStartTime(string $period): Carbon
    {
        switch ($period) {
            case '1h':
                return now()->subHour();
            case '24h':
                return now()->subDay();
            case '7d':
                return now()->subWeek();
            case '30d':
                return now()->subMonth();
            default:
                return now()->subDay();
        }
    }

    /**
     * Format metric name for CloudWatch
     */
    protected function formatMetricName(string $name): string
    {
        return str_replace('_', '', ucwords($name, '_'));
    }

    /**
     * Get metric unit
     */
    protected function getMetricUnit(string $name): string
    {
        $units = [
            'processing_time' => 'Seconds',
            'confidence_score' => 'Percent',
            'quality_score' => 'Percent',
            'file_size' => 'Bytes',
            'pages_processed' => 'Count',
            'features_used' => 'Count',
            'forms_detected' => 'Count',
            'tables_detected' => 'Count',
            'success' => 'Count',
        ];

        return $units[$name] ?? 'None';
    }

    /**
     * Format bytes to human readable
     */
    protected function formatBytes(float $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;
        
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        
        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Start real-time monitoring dashboard
     */
    public function startMonitoringDashboard(): array
    {
        // This would typically start a WebSocket connection or similar
        // For now, return current real-time metrics
        
        return [
            'realtime_metrics' => Cache::get('textract_realtime_metrics', []),
            'active_alerts' => $this->getActiveAlerts(),
            'system_status' => $this->getSystemStatus(),
            'recent_errors' => $this->getRecentErrors(),
        ];
    }

    /**
     * Get system status
     */
    protected function getSystemStatus(): array
    {
        return [
            'textract_available' => $this->checkTextractAvailability(),
            's3_available' => $this->checkS3Availability(),
            'database_available' => $this->checkDatabaseAvailability(),
            'cache_available' => $this->checkCacheAvailability(),
        ];
    }

    /**
     * Check Textract availability
     */
    protected function checkTextractAvailability(): bool
    {
        // Implement health check for Textract
        return true;
    }

    /**
     * Check S3 availability
     */
    protected function checkS3Availability(): bool
    {
        // Implement health check for S3
        return true;
    }

    /**
     * Check database availability
     */
    protected function checkDatabaseAvailability(): bool
    {
        try {
            DB::connection()->getPdo();
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Check cache availability
     */
    protected function checkCacheAvailability(): bool
    {
        try {
            Cache::put('health_check', true, 1);
            return Cache::get('health_check') === true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get recent errors
     */
    protected function getRecentErrors(): array
    {
        return DB::table('ocr_processing_metrics')
            ->where('service', 'textract')
            ->where('success', false)
            ->where('created_at', '>=', now()->subHour())
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($error) {
                return [
                    'timestamp' => $error->created_at,
                    'file' => basename($error->file_path),
                    'document_type' => $error->document_type,
                ];
            })
            ->toArray();
    }
}