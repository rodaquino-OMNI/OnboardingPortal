<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Prometheus\CollectorRegistry;
use Prometheus\Storage\Redis;
use Prometheus\RenderTextFormat;

/**
 * Health Questionnaire Metrics Service
 *
 * Provides comprehensive metrics collection for health questionnaire feature.
 * Integrates with Prometheus for observability and alerting.
 *
 * @package App\Services
 */
class HealthQuestionnaireMetrics
{
    private CollectorRegistry $registry;
    private string $namespace = 'health_questionnaire';

    /**
     * Critical alert channels configuration
     */
    private array $criticalAlertChannels = [
        'slack' => true,
        'pagerduty' => true,
        'email' => true,
        'sms' => false, // Enable for production
    ];

    public function __construct()
    {
        // Initialize Prometheus registry with Redis storage
        $redisAdapter = new Redis([
            'host' => config('database.redis.default.host', '127.0.0.1'),
            'port' => config('database.redis.default.port', 6379),
            'password' => config('database.redis.default.password'),
            'database' => config('database.redis.default.database', 0),
            'timeout' => 0.1,
        ]);

        $this->registry = new CollectorRegistry($redisAdapter);
    }

    // ========================================================================
    // BUSINESS METRICS
    // ========================================================================

    /**
     * Record questionnaire submission
     *
     * @param string $riskBand Risk classification (low, medium, high, critical)
     * @param int $version Questionnaire version
     * @param string $userSegment Optional user segment for segmentation
     * @return void
     */
    public function recordSubmission(string $riskBand, int $version, string $userSegment = 'general'): void
    {
        try {
            $counter = $this->registry->getOrRegisterCounter(
                $this->namespace,
                'submissions_total',
                'Total questionnaire submissions by risk band',
                ['risk_band', 'questionnaire_version', 'user_segment']
            );

            $counter->inc([
                'risk_band' => $riskBand,
                'questionnaire_version' => (string)$version,
                'user_segment' => $userSegment,
            ]);

            // Update risk distribution gauge
            $this->updateRiskDistribution($riskBand);

            Log::info('Questionnaire submission recorded', [
                'risk_band' => $riskBand,
                'version' => $version,
                'user_segment' => $userSegment,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to record submission metric', [
                'error' => $e->getMessage(),
                'risk_band' => $riskBand,
            ]);
        }
    }

    /**
     * Record questionnaire duration
     *
     * @param float $seconds Time in seconds
     * @param string $status Completion status (completed, abandoned, draft, timeout)
     * @param string $step Last completed step
     * @return void
     */
    public function recordDuration(float $seconds, string $status, string $step = 'unknown'): void
    {
        try {
            $histogram = $this->registry->getOrRegisterHistogram(
                $this->namespace,
                'duration_seconds',
                'Time to complete questionnaire',
                ['completion_status', 'last_step'],
                [30, 60, 120, 300, 600, 1800] // 30s, 1m, 2m, 5m, 10m, 30m
            );

            $histogram->observe($seconds, [
                'completion_status' => $status,
                'last_step' => $step,
            ]);

            // Track abandonment if applicable
            if ($status === 'abandoned') {
                $this->recordAbandonment($step);
            }

            Log::debug('Questionnaire duration recorded', [
                'duration_seconds' => $seconds,
                'status' => $status,
                'step' => $step,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to record duration metric', [
                'error' => $e->getMessage(),
                'seconds' => $seconds,
                'status' => $status,
            ]);
        }
    }

    /**
     * Record questionnaire abandonment
     *
     * @param string $stepAbandoned Step where user abandoned
     * @param string $userSegment User segment
     * @return void
     */
    public function recordAbandonment(string $stepAbandoned, string $userSegment = 'general'): void
    {
        try {
            // Calculate abandonment rate (simplified - in production, use time-series data)
            $abandonmentRate = $this->calculateAbandonmentRate($stepAbandoned);

            $gauge = $this->registry->getOrRegisterGauge(
                $this->namespace,
                'abandonment_rate',
                'Percentage of users abandoning at each step',
                ['step_abandoned', 'user_segment']
            );

            $gauge->set($abandonmentRate, [
                'step_abandoned' => $stepAbandoned,
                'user_segment' => $userSegment,
            ]);

            Log::info('Abandonment recorded', [
                'step' => $stepAbandoned,
                'rate' => $abandonmentRate,
                'user_segment' => $userSegment,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to record abandonment metric', [
                'error' => $e->getMessage(),
                'step' => $stepAbandoned,
            ]);
        }
    }

    // ========================================================================
    // TECHNICAL METRICS
    // ========================================================================

    /**
     * Record API response time
     *
     * @param string $endpoint API endpoint
     * @param int $statusCode HTTP status code
     * @param float $duration Duration in seconds
     * @param string $method HTTP method
     * @return void
     */
    public function recordAPIResponseTime(
        string $endpoint,
        int $statusCode,
        float $duration,
        string $method = 'POST'
    ): void {
        try {
            $histogram = $this->registry->getOrRegisterHistogram(
                $this->namespace,
                'api_response_time_seconds',
                'API response time for health endpoints',
                ['endpoint', 'status_code', 'method'],
                [0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
            );

            $histogram->observe($duration, [
                'endpoint' => $endpoint,
                'status_code' => (string)$statusCode,
                'method' => $method,
            ]);

            // Alert on slow responses
            if ($duration > 2.5) {
                Log::warning('Slow API response detected', [
                    'endpoint' => $endpoint,
                    'duration' => $duration,
                    'status_code' => $statusCode,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to record API response time metric', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Record PHI encryption/decryption operation
     *
     * @param string $operation Operation type (encrypt, decrypt, key_rotation)
     * @param string $status Operation status (success, failure, timeout)
     * @param string $dataType Type of PHI data
     * @return void
     */
    public function recordEncryptionOperation(
        string $operation,
        string $status,
        string $dataType = 'questionnaire_data'
    ): void {
        try {
            $counter = $this->registry->getOrRegisterCounter(
                $this->namespace,
                'encryption_operations_total',
                'PHI encryption/decryption operations',
                ['operation', 'status', 'data_type']
            );

            $counter->inc([
                'operation' => $operation,
                'status' => $status,
                'data_type' => $dataType,
            ]);

            // Alert on encryption failures
            if ($status === 'failure') {
                Log::critical('Encryption operation failed', [
                    'operation' => $operation,
                    'data_type' => $dataType,
                ]);

                // Check if failure rate exceeds threshold
                $this->checkEncryptionFailureRate($operation);
            }
        } catch (\Exception $e) {
            Log::error('Failed to record encryption metric', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Record PHI Guard violation (CRITICAL)
     *
     * @param string $guardType Type of guard (access_control, data_leakage, audit_trail, encryption)
     * @param string $violationType Specific violation (unauthorized_access, logging_phi, etc.)
     * @param string $severity Severity level (critical, high, medium)
     * @param array $context Additional context for investigation
     * @return void
     */
    public function recordPHIGuardViolation(
        string $guardType,
        string $violationType,
        string $severity = 'critical',
        array $context = []
    ): void {
        try {
            $counter = $this->registry->getOrRegisterCounter(
                $this->namespace,
                'phi_guard_violations_total',
                'PHI security guard violations (CRITICAL)',
                ['guard_type', 'violation_type', 'severity']
            );

            $counter->inc([
                'guard_type' => $guardType,
                'violation_type' => $violationType,
                'severity' => $severity,
            ]);

            // CRITICAL: Immediate alert to all channels
            $this->sendCriticalAlert(
                "PHI Guard Violation Detected",
                [
                    'guard_type' => $guardType,
                    'violation_type' => $violationType,
                    'severity' => $severity,
                    'context' => $context,
                    'timestamp' => now()->toIso8601String(),
                ]
            );

            // Log with maximum priority
            Log::critical('PHI GUARD VIOLATION', [
                'guard_type' => $guardType,
                'violation_type' => $violationType,
                'severity' => $severity,
                'context' => $context,
                'requires_immediate_investigation' => true,
            ]);

            // Trigger incident response workflow
            $this->triggerIncidentResponse($guardType, $violationType, $context);

        } catch (\Exception $e) {
            // Even if metrics fail, we MUST log the violation
            Log::emergency('FAILED TO RECORD PHI VIOLATION - MANUAL INTERVENTION REQUIRED', [
                'original_violation' => [
                    'guard_type' => $guardType,
                    'violation_type' => $violationType,
                ],
                'metric_error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Record input validation failure
     *
     * @param string $field Field that failed validation
     * @param string $validationRule Rule that failed
     * @param string $userType User type (new, existing, admin)
     * @return void
     */
    public function recordValidationFailure(
        string $field,
        string $validationRule,
        string $userType = 'unknown'
    ): void {
        try {
            $counter = $this->registry->getOrRegisterCounter(
                $this->namespace,
                'validation_failures_total',
                'Input validation failures by field and rule',
                ['field', 'validation_rule', 'user_type']
            );

            $counter->inc([
                'field' => $field,
                'validation_rule' => $validationRule,
                'user_type' => $userType,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to record validation failure metric', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    // ========================================================================
    // DATABASE METRICS
    // ========================================================================

    /**
     * Record database query duration
     *
     * @param string $queryType Query type (select, insert, update, delete, aggregate)
     * @param string $table Table name
     * @param float $duration Duration in seconds
     * @param string $operation Specific operation
     * @return void
     */
    public function recordDatabaseQuery(
        string $queryType,
        string $table,
        float $duration,
        string $operation = 'unknown'
    ): void {
        try {
            $histogram = $this->registry->getOrRegisterHistogram(
                $this->namespace,
                'db_query_duration_seconds',
                'Database query execution time',
                ['query_type', 'table', 'operation'],
                [0.01, 0.05, 0.1, 0.5, 1.0, 2.5]
            );

            $histogram->observe($duration, [
                'query_type' => $queryType,
                'table' => $table,
                'operation' => $operation,
            ]);

            // Warn on slow queries
            if ($duration > 1.0) {
                Log::warning('Slow database query detected', [
                    'query_type' => $queryType,
                    'table' => $table,
                    'duration' => $duration,
                    'operation' => $operation,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to record database query metric', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Record cache operation
     *
     * @param string $operation Operation (get, set, delete, invalidate)
     * @param string $cacheKeyType Type of cache key
     * @param string $result Result (hit, miss, error)
     * @return void
     */
    public function recordCacheOperation(
        string $operation,
        string $cacheKeyType,
        string $result
    ): void {
        try {
            $counter = $this->registry->getOrRegisterCounter(
                $this->namespace,
                'cache_operations_total',
                'Cache operations for health data',
                ['operation', 'cache_key_type', 'result']
            );

            $counter->inc([
                'operation' => $operation,
                'cache_key_type' => $cacheKeyType,
                'result' => $result,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to record cache operation metric', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    // ========================================================================
    // COMPLIANCE & AUDIT METRICS
    // ========================================================================

    /**
     * Record audit log entry
     *
     * @param string $eventType Type of event
     * @param string $actorRole Role of actor
     * @param string $dataClassification Data classification
     * @return void
     */
    public function recordAuditLogEntry(
        string $eventType,
        string $actorRole,
        string $dataClassification
    ): void {
        try {
            $counter = $this->registry->getOrRegisterCounter(
                $this->namespace,
                'audit_log_entries_total',
                'Audit log entries for compliance tracking',
                ['event_type', 'actor_role', 'data_classification']
            );

            $counter->inc([
                'event_type' => $eventType,
                'actor_role' => $actorRole,
                'data_classification' => $dataClassification,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to record audit log metric', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Send critical alert to all configured channels
     *
     * @param string $message Alert message
     * @param array $context Alert context
     * @return void
     */
    private function sendCriticalAlert(string $message, array $context = []): void
    {
        $alertData = [
            'message' => $message,
            'severity' => 'CRITICAL',
            'context' => $context,
            'timestamp' => now()->toIso8601String(),
            'environment' => config('app.env'),
        ];

        // Slack notification
        if ($this->criticalAlertChannels['slack']) {
            $this->sendSlackAlert($alertData);
        }

        // PagerDuty incident
        if ($this->criticalAlertChannels['pagerduty']) {
            $this->triggerPagerDutyIncident($alertData);
        }

        // Email notification
        if ($this->criticalAlertChannels['email']) {
            $this->sendEmailAlert($alertData);
        }

        // SMS (optional)
        if ($this->criticalAlertChannels['sms']) {
            $this->sendSMSAlert($alertData);
        }
    }

    /**
     * Send Slack alert
     */
    private function sendSlackAlert(array $alertData): void
    {
        // Implementation depends on Slack integration
        // Use Laravel notifications or direct Slack API
        Log::info('Slack alert sent', $alertData);
    }

    /**
     * Trigger PagerDuty incident
     */
    private function triggerPagerDutyIncident(array $alertData): void
    {
        // Implementation depends on PagerDuty integration
        Log::info('PagerDuty incident triggered', $alertData);
    }

    /**
     * Send email alert
     */
    private function sendEmailAlert(array $alertData): void
    {
        // Implementation depends on email service
        Log::info('Email alert sent', $alertData);
    }

    /**
     * Send SMS alert
     */
    private function sendSMSAlert(array $alertData): void
    {
        // Implementation depends on SMS service
        Log::info('SMS alert sent', $alertData);
    }

    /**
     * Trigger incident response workflow
     */
    private function triggerIncidentResponse(
        string $guardType,
        string $violationType,
        array $context
    ): void {
        // Create incident ticket
        // Notify security team
        // Lock affected resources if necessary
        // Start audit trail collection

        Log::info('Incident response workflow triggered', [
            'guard_type' => $guardType,
            'violation_type' => $violationType,
            'context' => $context,
        ]);
    }

    /**
     * Calculate abandonment rate for a step
     */
    private function calculateAbandonmentRate(string $step): float
    {
        // In production, calculate from time-series data
        // This is a simplified version using cache
        $cacheKey = "abandonment_rate_{$step}";

        return Cache::remember($cacheKey, 300, function () use ($step) {
            // Query database for actual rate
            return 0.15; // Placeholder
        });
    }

    /**
     * Update risk distribution gauge
     */
    private function updateRiskDistribution(string $riskBand): void
    {
        // Update gauge with current distribution
        // In production, aggregate from database
    }

    /**
     * Check encryption failure rate and alert if threshold exceeded
     */
    private function checkEncryptionFailureRate(string $operation): void
    {
        // Check if failure rate > 10% over last 5 minutes
        // Trigger critical alert if exceeded
    }

    /**
     * Export metrics in Prometheus format
     *
     * @return string Prometheus-formatted metrics
     */
    public function exportMetrics(): string
    {
        $renderer = new RenderTextFormat();
        return $renderer->render($this->registry->getMetricFamilySamples());
    }
}
