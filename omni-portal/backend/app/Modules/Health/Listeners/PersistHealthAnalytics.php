<?php

namespace App\Modules\Health\Listeners;

use App\Models\AnalyticsEvent;
use App\Modules\Health\Events\HealthQuestionnaireSubmitted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

/**
 * PersistHealthAnalytics - Event listener for health questionnaire analytics
 *
 * Handles HealthQuestionnaireSubmitted event and persists to analytics_events table
 *
 * Features:
 * - Asynchronous processing (queued)
 * - PII-free analytics (user_hash only, NO plaintext IDs)
 * - Structured event payload
 * - Error handling with logging
 *
 * Event Schema:
 * {
 *   "event_name": "health.questionnaire_submitted",
 *   "user_hash": "sha256(...)",
 *   "payload": {
 *     "version": 1,
 *     "duration_ms": 300000,
 *     "risk_band": "low|medium|high",
 *     "score_redacted": "70-80"
 *   }
 * }
 *
 * @see app/Modules/Health/Events/HealthQuestionnaireSubmitted.php
 * @see app/Models/AnalyticsEvent.php
 */
class PersistHealthAnalytics implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Queue name
     */
    public $queue = 'analytics';

    /**
     * Number of times to retry
     */
    public $tries = 3;

    /**
     * Backoff delays (seconds)
     */
    public $backoff = [10, 30, 60];

    /**
     * Handle the event
     *
     * @param HealthQuestionnaireSubmitted $event
     * @return void
     */
    public function handle(HealthQuestionnaireSubmitted $event): void
    {
        try {
            // Store to analytics_events table
            AnalyticsEvent::create([
                'event_name' => 'health.questionnaire_submitted',
                'event_category' => 'health',
                'schema_version' => '1.0.0',
                'user_id_hash' => $event->getUserHash(),
                'session_id' => null, // No session tracking for health events
                'metadata' => [
                    'version' => $event->response->questionnaire->version,
                    'duration_ms' => $event->getDurationMs(),
                    'risk_band' => $event->response->risk_band,
                    'score_redacted' => $event->response->score_redacted,
                ],
                'context' => [
                    'questionnaire_id' => $event->response->id,
                ],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'environment' => app()->environment(),
                'occurred_at' => $event->timestamp,
            ]);

            Log::info('Health analytics event persisted', [
                'event_name' => 'health.questionnaire_submitted',
                'user_hash' => $event->getUserHash(),
                'risk_band' => $event->response->risk_band,
            ]);
        } catch (\Exception $e) {
            // Log error but don't throw (analytics shouldn't block business logic)
            Log::error('Failed to persist health analytics event', [
                'event_name' => 'health.questionnaire_submitted',
                'user_hash' => $event->getUserHash(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Re-throw if we haven't exhausted retries
            if ($this->attempts() < $this->tries) {
                throw $e;
            }
        }
    }

    /**
     * Handle a job failure
     *
     * @param HealthQuestionnaireSubmitted $event
     * @param \Throwable $exception
     * @return void
     */
    public function failed(HealthQuestionnaireSubmitted $event, \Throwable $exception): void
    {
        Log::critical('Health analytics persistence failed after all retries', [
            'event_name' => 'health.questionnaire_submitted',
            'user_hash' => $event->getUserHash(),
            'error' => $exception->getMessage(),
            'attempts' => $this->tries,
        ]);
    }
}
