<?php

namespace App\Jobs;

use App\Models\HealthQuestionnaire;
use App\Services\HealthAIService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class ProcessHealthQuestionnaireAI implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $questionnaireId;
    public $timeout = 300; // 5 minutes
    public $tries = 3;
    public $maxExceptions = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(int $questionnaireId)
    {
        $this->questionnaireId = $questionnaireId;
        $this->onQueue('ai-processing'); // Use dedicated queue for AI processing
    }

    /**
     * Execute the job.
     */
    public function handle(HealthAIService $healthAIService): void
    {
        $startTime = microtime(true);
        
        try {
            // Load questionnaire with minimal data
            $questionnaire = HealthQuestionnaire::with(['template:id,code'])
                ->select('id', 'beneficiary_id', 'template_id', 'responses', 'ai_insights')
                ->findOrFail($this->questionnaireId);

            // Skip if already processed
            if ($questionnaire->ai_insights) {
                Log::info('AI insights already exist', ['questionnaire_id' => $this->questionnaireId]);
                return;
            }

            // Set processing status in cache
            Cache::put("ai_processing_{$this->questionnaireId}", true, 600); // 10 minutes

            Log::info('Starting AI analysis', [
                'questionnaire_id' => $this->questionnaireId,
                'beneficiary_id' => $questionnaire->beneficiary_id
            ]);

            // Process AI analysis
            $insights = $healthAIService->analyzeResponses(
                $questionnaire->responses ?? [],
                $questionnaire->template->code ?? 'default'
            );

            // Add processing metadata
            $insights['processing_metadata'] = [
                'processed_at' => now()->toISOString(),
                'processing_time_seconds' => round(microtime(true) - $startTime, 2),
                'job_id' => $this->job->getJobId(),
                'attempt' => $this->attempts()
            ];

            // Update questionnaire with insights using transaction
            DB::transaction(function () use ($questionnaire, $insights) {
                $questionnaire->update([
                    'ai_insights' => $insights,
                    'updated_at' => now()
                ]);
            });

            // Cache the results for fast retrieval
            $cacheKey = "ai_insights_{$this->questionnaireId}";
            Cache::put($cacheKey, $insights, 86400); // 24 hours

            // Remove processing status
            Cache::forget("ai_processing_{$this->questionnaireId}");

            $processingTime = microtime(true) - $startTime;
            
            Log::info('AI analysis completed successfully', [
                'questionnaire_id' => $this->questionnaireId,
                'processing_time_seconds' => round($processingTime, 2),
                'insights_keys' => array_keys($insights)
            ]);

            // Trigger notifications if high risk detected
            $this->handleHighRiskNotifications($questionnaire, $insights);

        } catch (\Exception $e) {
            // Remove processing status on error
            Cache::forget("ai_processing_{$this->questionnaireId}");
            
            Log::error('AI processing failed', [
                'questionnaire_id' => $this->questionnaireId,
                'error' => $e->getMessage(),
                'attempt' => $this->attempts(),
                'processing_time_seconds' => round(microtime(true) - $startTime, 2)
            ]);

            // If this is the last attempt, mark as failed
            if ($this->attempts() >= $this->tries) {
                $this->markAIProcessingAsFailed($e->getMessage());
            }

            throw $e;
        }
    }

    /**
     * Handle high risk notifications
     */
    protected function handleHighRiskNotifications(HealthQuestionnaire $questionnaire, array $insights): void
    {
        try {
            $riskLevel = $insights['risk_assessment']['overall_risk'] ?? 'unknown';
            $emergencyFlags = $insights['emergency_flags'] ?? [];

            // Handle emergency situations
            if (!empty($emergencyFlags) || $riskLevel === 'critical') {
                Log::warning('High risk or emergency detected', [
                    'questionnaire_id' => $this->questionnaireId,
                    'risk_level' => $riskLevel,
                    'emergency_flags' => $emergencyFlags
                ]);

                // Update emergency fields
                $questionnaire->update([
                    'emergency_detected' => true,
                    'emergency_timestamp' => now(),
                    'emergency_protocol' => [
                        'detected_by' => 'ai_analysis',
                        'flags' => $emergencyFlags,
                        'risk_level' => $riskLevel,
                        'timestamp' => now()->toISOString()
                    ]
                ]);

                // Trigger emergency notification events
                event(new \App\Events\HealthEmergencyDetected(
                    $questionnaire,
                    $riskLevel,
                    $emergencyFlags
                ));
            }

            // Handle moderate to high risk
            if (in_array($riskLevel, ['moderate', 'high'])) {
                event(new \App\Events\HealthRiskDetected(
                    $questionnaire,
                    $riskLevel,
                    $insights['recommendations'] ?? []
                ));
            }

        } catch (\Exception $e) {
            Log::error('Failed to handle risk notifications', [
                'questionnaire_id' => $this->questionnaireId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Mark AI processing as failed
     */
    protected function markAIProcessingAsFailed(string $errorMessage): void
    {
        try {
            $questionnaire = HealthQuestionnaire::find($this->questionnaireId);
            if ($questionnaire) {
                $questionnaire->update([
                    'ai_insights' => [
                        'status' => 'failed',
                        'error' => 'AI processing failed after multiple attempts',
                        'failed_at' => now()->toISOString(),
                        'error_message' => $errorMessage
                    ]
                ]);

                // Cache the failure for UI handling
                Cache::put(
                    "ai_insights_{$this->questionnaireId}",
                    $questionnaire->ai_insights,
                    3600 // 1 hour
                );
            }
        } catch (\Exception $e) {
            Log::error('Failed to mark AI processing as failed', [
                'questionnaire_id' => $this->questionnaireId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ProcessHealthQuestionnaireAI job failed permanently', [
            'questionnaire_id' => $this->questionnaireId,
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts()
        ]);

        $this->markAIProcessingAsFailed($exception->getMessage());
    }

    /**
     * Get unique job identifier
     */
    public function uniqueId(): string
    {
        return "health_ai_{$this->questionnaireId}";
    }
}