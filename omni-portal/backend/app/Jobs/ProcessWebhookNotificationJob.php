<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Models\ClinicalAlert;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Process Webhook Notification Job
 * 
 * Sends critical alert notifications to external health plan systems via webhooks
 */
class ProcessWebhookNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [60, 180, 300]; // Exponential backoff: 1 min, 3 min, 5 min
    
    protected ClinicalAlert $alert;
    protected string $webhookId;
    protected string $notificationType;

    /**
     * Create a new job instance.
     */
    public function __construct(ClinicalAlert $alert, string $webhookId, string $notificationType)
    {
        $this->alert = $alert;
        $this->webhookId = $webhookId;
        $this->notificationType = $notificationType;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Get webhook configuration
            $webhook = DB::table('webhook_configurations')
                ->where('webhook_id', $this->webhookId)
                ->where('status', 'active')
                ->first();

            if (!$webhook) {
                Log::error('Webhook not found or inactive', ['webhook_id' => $this->webhookId]);
                return;
            }

            // Prepare payload
            $payload = $this->preparePayload($webhook);
            
            // Generate signature
            $secret = decrypt($webhook->secret);
            $signature = hash_hmac('sha256', json_encode($payload), $secret);
            
            // Send webhook notification
            $response = Http::timeout(30)
                ->retry(3, 100)
                ->withHeaders([
                    'X-Webhook-Signature' => $signature,
                    'X-Webhook-Event' => $this->getEventType(),
                    'X-Webhook-ID' => $this->webhookId,
                    'Content-Type' => 'application/json'
                ])
                ->post($webhook->endpoint, $payload);

            // Log success
            $this->logWebhookDelivery($webhook, $response->successful(), $response->status());

            if (!$response->successful()) {
                throw new \Exception('Webhook delivery failed with status: ' . $response->status());
            }

            // Update alert status
            $this->alert->update([
                'webhook_notified_at' => now(),
                'webhook_notification_status' => 'delivered'
            ]);

        } catch (\Exception $e) {
            Log::error('Webhook notification failed', [
                'alert_id' => $this->alert->id,
                'webhook_id' => $this->webhookId,
                'error' => $e->getMessage()
            ]);

            // Update alert with failure status
            $this->alert->update([
                'webhook_notification_status' => 'failed',
                'webhook_error' => $e->getMessage()
            ]);

            // Rethrow to trigger retry
            throw $e;
        }
    }

    /**
     * Prepare webhook payload
     */
    private function preparePayload($webhook): array
    {
        $beneficiary = $this->alert->beneficiary;
        
        return [
            'event_type' => $this->getEventType(),
            'notification_id' => uniqid('notif_'),
            'timestamp' => now()->toIso8601String(),
            'alert' => [
                'id' => $this->alert->id,
                'category' => $this->alert->category,
                'priority' => $this->alert->priority,
                'risk_score' => $this->alert->risk_score,
                'title' => $this->alert->title,
                'description' => $this->alert->description,
                'created_at' => $this->alert->created_at->toIso8601String()
            ],
            'beneficiary' => [
                'id' => md5($beneficiary->id . $webhook->health_plan_id), // Pseudonymized
                'age_group' => $this->getAgeGroup($beneficiary->getAge()),
                'risk_profile' => $this->alert->questionnaire->risk_scores ?? null
            ],
            'clinical_recommendations' => $this->alert->clinical_recommendations,
            'intervention_options' => $this->alert->intervention_options,
            'urgency' => $this->calculateUrgency(),
            'metadata' => [
                'notification_type' => $this->notificationType,
                'health_plan_id' => $webhook->health_plan_id,
                'api_version' => 'v1'
            ]
        ];
    }

    /**
     * Get event type based on alert category and priority
     */
    private function getEventType(): string
    {
        if ($this->alert->priority === 'emergency') {
            return 'emergency_alert';
        }
        
        if ($this->alert->category === 'mental_health' && $this->alert->risk_score > 80) {
            return 'suicide_risk';
        }
        
        if ($this->alert->category === 'safety_risk') {
            return 'violence_exposure';
        }
        
        if ($this->alert->category === 'allergy_risk' && $this->alert->priority === 'critical') {
            return 'critical_allergy';
        }
        
        if ($this->alert->category === 'cardiovascular' && $this->alert->priority === 'critical') {
            return 'cardiac_emergency';
        }
        
        return 'critical_health_alert';
    }

    /**
     * Calculate urgency level
     */
    private function calculateUrgency(): string
    {
        if ($this->alert->priority === 'emergency') {
            return 'immediate';
        }
        
        if ($this->alert->priority === 'critical' || $this->alert->risk_score > 90) {
            return 'urgent';
        }
        
        if ($this->alert->priority === 'high' || $this->alert->risk_score > 70) {
            return 'high';
        }
        
        return 'moderate';
    }

    /**
     * Get age group for anonymization
     */
    private function getAgeGroup(?int $age): string
    {
        if (!$age) return 'unknown';
        
        if ($age < 30) return '18-29';
        if ($age < 40) return '30-39';
        if ($age < 50) return '40-49';
        if ($age < 60) return '50-59';
        if ($age < 70) return '60-69';
        return '70+';
    }

    /**
     * Log webhook delivery attempt
     */
    private function logWebhookDelivery($webhook, bool $success, int $statusCode): void
    {
        DB::table('webhook_deliveries')->insert([
            'webhook_id' => $this->webhookId,
            'alert_id' => $this->alert->id,
            'endpoint' => $webhook->endpoint,
            'status_code' => $statusCode,
            'success' => $success,
            'attempt_number' => $this->attempts(),
            'delivered_at' => $success ? now() : null,
            'created_at' => now()
        ]);
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Webhook notification job failed permanently', [
            'alert_id' => $this->alert->id,
            'webhook_id' => $this->webhookId,
            'error' => $exception->getMessage()
        ]);

        // Update alert status
        $this->alert->update([
            'webhook_notification_status' => 'failed_permanently',
            'webhook_error' => 'Max retries exceeded: ' . $exception->getMessage()
        ]);

        // Notify admin of permanent failure
        // Could trigger an admin notification here
    }
}