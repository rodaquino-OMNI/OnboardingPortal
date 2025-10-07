<?php

namespace App\Services;

use App\Models\AnalyticsEvent;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * AnalyticsEventRepository - Database persistence for analytics events
 *
 * Purpose: Track analytics events with PII detection and LGPD/HIPAA compliance
 *
 * Features:
 * - PII detection with 6+ regex patterns (CPF, CNPJ, RG, email, phone, CEP)
 * - Environment-aware error handling (throw dev, drop prod with breadcrumb)
 * - User ID hashing (SHA256, never plaintext)
 * - Automatic category extraction from event names
 * - Schema validation for all 9 event types
 *
 * Schema Version: 1.0.0
 *
 * Supported Events:
 * 1. auth.login_success
 * 2. auth.registration_complete
 * 3. gamification.points_earned
 * 4. gamification.level_up
 * 5. gamification.badge_earned
 * 6. health.questionnaire_completed
 * 7. document.upload_success
 * 8. document.verification_complete
 * 9. interview.scheduled
 *
 * @see database/migrations/2025_10_06_000002_create_analytics_events_table.php
 * @see app/Models/AnalyticsEvent.php
 * @see docs/phase8/ANALYTICS_RETENTION_POLICY.md
 */
class AnalyticsEventRepository
{
    /**
     * Schema version for event evolution
     */
    private const SCHEMA_VERSION = '1.0.0';

    /**
     * Track an analytics event with PII detection
     *
     * @param string $eventName Event name (e.g., 'gamification.points_earned')
     * @param array $metadata Event-specific data (NO PII allowed)
     * @param array $context Request context (endpoint, role, etc.)
     * @param int|null $userId User ID (will be hashed)
     * @param int|null $companyId Company ID for multi-tenant tracking
     * @param string|null $sessionId Session identifier
     * @return AnalyticsEvent|null Returns event if persisted, null if dropped (prod PII)
     * @throws \InvalidArgumentException If PII detected in development environment
     */
    public function track(
        string $eventName,
        array $metadata = [],
        array $context = [],
        ?int $userId = null,
        ?int $companyId = null,
        ?string $sessionId = null
    ): ?AnalyticsEvent {
        // PII detection - CRITICAL for LGPD/HIPAA compliance
        if ($this->containsPII($metadata)) {
            $piiError = "PII detected in analytics metadata for event: {$eventName}";

            // Environment-aware handling
            if (app()->environment('local', 'development')) {
                // DEV: Throw exception to fail fast during development
                Log::error($piiError, [
                    'event_name' => $eventName,
                    'metadata_keys' => array_keys($metadata),
                ]);
                throw new \InvalidArgumentException($piiError);
            } else {
                // PROD: Drop event with breadcrumb (don't persist PII, don't throw)
                Log::warning($piiError . ' - Event dropped', [
                    'event_name' => $eventName,
                    'metadata_keys' => array_keys($metadata),
                    'environment' => app()->environment(),
                ]);
                return null; // Event dropped
            }
        }

        // Validate event schema
        $this->validateEventSchema($eventName, $metadata);

        // Add company_id to context for multi-tenant tracking
        if ($companyId !== null) {
            $context['company_id'] = $companyId;
        }

        // Create event record
        try {
            $event = AnalyticsEvent::create([
                'event_name' => $eventName,
                'event_category' => $this->getCategory($eventName),
                'schema_version' => self::SCHEMA_VERSION,
                'user_id_hash' => $userId ? $this->getUserIdHash($userId) : null,
                'session_id' => $sessionId ?? request()->session()?->getId(),
                'metadata' => $metadata,
                'context' => $context,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'environment' => app()->environment(),
                'occurred_at' => now(),
            ]);

            return $event;
        } catch (\Exception $e) {
            // Log persistence errors but don't throw (analytics should never block business logic)
            Log::error('Failed to persist analytics event', [
                'event_name' => $eventName,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return null;
        }
    }

    /**
     * Detect PII in metadata using regex patterns
     *
     * Detects:
     * - CPF (Brazilian tax ID): 123.456.789-01 or 12345678901
     * - CNPJ (Brazilian company ID): 12.345.678/0001-90 or 12345678000190
     * - RG (Brazilian ID): 12.345.678-9 or 123456789
     * - Email addresses: user@example.com
     * - Phone numbers: (11) 98765-4321, +5511987654321, 11987654321
     * - CEP (Brazilian postal code): 12345-678 or 12345678
     *
     * @param array $data Data to check for PII
     * @return bool True if PII detected
     */
    private function containsPII(array $data): bool
    {
        $jsonData = json_encode($data, JSON_UNESCAPED_UNICODE);

        // 1. CPF pattern (with or without formatting)
        if (preg_match('/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/', $jsonData)) {
            return true;
        }

        // 2. CNPJ pattern (with or without formatting)
        if (preg_match('/\d{2}\.?\d{3}\.?\d{3}\/?0001-?\d{2}/', $jsonData)) {
            return true;
        }

        // 3. RG pattern (with or without formatting)
        if (preg_match('/\d{2}\.?\d{3}\.?\d{3}-?\d{1}/', $jsonData)) {
            return true;
        }

        // 4. Email pattern
        if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $jsonData)) {
            return true;
        }

        // 5. Brazilian phone pattern (various formats)
        if (preg_match('/(\+55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}/', $jsonData)) {
            return true;
        }

        // 6. CEP pattern (with or without dash)
        if (preg_match('/\d{5}-?\d{3}/', $jsonData)) {
            return true;
        }

        // 7. Full name pattern (capitalized first and last name with space)
        // This is conservative - only flag if it looks like a full name
        if (preg_match('/\b[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}\b/', $jsonData)) {
            return true;
        }

        return false;
    }

    /**
     * Hash user ID for privacy (SHA256)
     *
     * @param int $userId User ID to hash
     * @return string SHA256 hash
     */
    private function getUserIdHash(int $userId): string
    {
        return hash('sha256', (string) $userId);
    }

    /**
     * Extract category from event name
     *
     * Examples:
     * - 'gamification.points_earned' → 'gamification'
     * - 'auth.login_success' → 'auth'
     * - 'health.questionnaire_completed' → 'health'
     *
     * @param string $eventName Event name
     * @return string Category
     */
    private function getCategory(string $eventName): string
    {
        $parts = explode('.', $eventName);
        return $parts[0] ?? 'unknown';
    }

    /**
     * Validate event schema for known event types
     *
     * @param string $eventName Event name
     * @param array $metadata Event metadata
     * @throws \InvalidArgumentException If schema validation fails
     */
    private function validateEventSchema(string $eventName, array $metadata): void
    {
        $schemas = $this->getEventSchemas();

        if (!isset($schemas[$eventName])) {
            // Unknown event type - log warning but allow (flexible schema)
            Log::warning('Unknown analytics event type', [
                'event_name' => $eventName,
                'metadata_keys' => array_keys($metadata),
            ]);
            return;
        }

        $requiredFields = $schemas[$eventName];
        $missingFields = array_diff($requiredFields, array_keys($metadata));

        if (!empty($missingFields)) {
            throw new \InvalidArgumentException(
                "Missing required fields for event '{$eventName}': " . implode(', ', $missingFields)
            );
        }
    }

    /**
     * Get event schemas with required fields
     *
     * @return array<string, array<string>> Event name => required fields
     */
    private function getEventSchemas(): array
    {
        return [
            // Auth events
            'auth.login_success' => ['user_role'],
            'auth.registration_complete' => ['registration_step', 'total_time_seconds'],

            // Gamification events
            'gamification.points_earned' => ['points', 'action_type', 'multiplier'],
            'gamification.level_up' => ['old_level', 'new_level', 'total_points'],
            'gamification.badge_earned' => ['badge_id', 'badge_name'],

            // Health events (legacy)
            'health.questionnaire_completed' => ['questionnaire_type', 'question_count', 'completion_time_seconds'],

            // Slice C: Health questionnaire events (new)
            'health.questionnaire_started' => ['questionnaire_id', 'version'],
            'health.questionnaire_submitted' => ['version', 'duration_ms', 'risk_band', 'score_redacted'],
            'health.questionnaire_reviewed' => ['reviewer_id', 'response_id', 'review_status'],

            // Document events (legacy)
            'document.upload_success' => ['document_type', 'file_size_bytes'],
            'document.verification_complete' => ['document_type', 'verification_status', 'processing_time_seconds'],

            // Slice B: Documents events (new)
            'documents.presigned_generated' => ['document_type', 'filename_hash', 'file_extension'],
            'documents.submitted' => ['document_type', 'file_size_bytes', 'status'],
            'documents.approved' => ['document_type', 'review_duration_hours', 'reviewer_role'],
            'documents.rejected' => ['document_type', 'rejection_reason_category', 'review_duration_hours'],

            // Interview events
            'interview.scheduled' => ['interview_type', 'scheduled_date', 'interviewer_id'],
        ];
    }

    /**
     * Get events by category in date range
     *
     * @param string $category Event category
     * @param \Carbon\Carbon $start Start date
     * @param \Carbon\Carbon $end End date
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getEventsByCategory(string $category, $start, $end)
    {
        return AnalyticsEvent::byCategory($category)
            ->inDateRange($start, $end)
            ->orderBy('occurred_at', 'desc')
            ->get();
    }

    /**
     * Get events by user hash in date range
     *
     * @param string $userIdHash Hashed user ID
     * @param \Carbon\Carbon $start Start date
     * @param \Carbon\Carbon $end End date
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getEventsByUserHash(string $userIdHash, $start, $end)
    {
        return AnalyticsEvent::byUserHash($userIdHash)
            ->inDateRange($start, $end)
            ->orderBy('occurred_at', 'desc')
            ->get();
    }

    /**
     * Prune events older than given date
     *
     * @param \Carbon\Carbon $date Cutoff date
     * @return int Number of events deleted
     */
    public function pruneOlderThan($date): int
    {
        return AnalyticsEvent::olderThan($date)->delete();
    }
}
