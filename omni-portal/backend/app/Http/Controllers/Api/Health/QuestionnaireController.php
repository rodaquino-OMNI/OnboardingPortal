<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Modules\Health\Events\HealthQuestionnaireStarted;
use App\Modules\Health\Events\HealthQuestionnaireSubmitted;
use App\Services\FeatureFlagService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;

/**
 * QuestionnaireController - Slice C Health Questionnaire API
 *
 * Phase 2: RESTful API Endpoints & Domain Events
 *
 * Features:
 * - Feature-flagged endpoints (sliceC_health)
 * - Comprehensive audit logging for all PHI access
 * - Rate limiting (10 submissions per hour per user)
 * - Draft and final submission support
 * - Domain events for analytics pipeline
 * - Zero PHI in responses (encrypted storage only)
 *
 * Security:
 * - All endpoints require auth:sanctum
 * - Submission endpoint requires verified email
 * - User isolation (can only access own responses)
 * - Admin role bypass for review workflows
 *
 * @see app/Modules/Health/Events/HealthQuestionnaireStarted.php
 * @see app/Modules/Health/Events/HealthQuestionnaireSubmitted.php
 * @see app/Http/Middleware/FeatureFlagMiddleware.php
 */
class QuestionnaireController extends Controller
{
    /**
     * Rate limit: Max submissions per hour
     */
    private const RATE_LIMIT_SUBMISSIONS = 10;

    /**
     * Feature flag service
     */
    private FeatureFlagService $featureFlags;

    /**
     * Constructor - inject dependencies
     */
    public function __construct(FeatureFlagService $featureFlags)
    {
        $this->featureFlags = $featureFlags;
    }

    /**
     * GET /api/v1/health/schema
     *
     * Returns active questionnaire schema (questions, branching rules)
     * NO PHI - just structure/configuration
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getSchema(Request $request): JsonResponse
    {
        // Feature flag check
        if (!$this->featureFlags->isEnabled('sliceC_health', auth()->id())) {
            return response()->json([
                'error' => 'Feature not enabled',
                'message' => 'Health questionnaire feature is currently disabled',
            ], 403);
        }

        try {
            // Get active questionnaire template
            // TODO: Replace with actual QuestionnaireTemplate model query
            $schema = [
                'version' => 'v1.0.0',
                'schema_json' => [
                    'questions' => [
                        [
                            'id' => 'q1',
                            'text' => 'Do you have any pre-existing health conditions?',
                            'type' => 'boolean',
                            'required' => true,
                        ],
                        [
                            'id' => 'q2',
                            'text' => 'Are you currently taking any medications?',
                            'type' => 'boolean',
                            'required' => true,
                            'conditional' => ['q1' => true],
                        ],
                    ],
                ],
                'branching_rules' => [
                    'q1' => [
                        'if_true' => ['show' => ['q2']],
                        'if_false' => ['skip' => ['q2']],
                    ],
                ],
            ];

            // Emit domain event - user started questionnaire
            event(new HealthQuestionnaireStarted(
                user: auth()->user(),
                questionnaireId: 1, // TODO: Get from active template
                version: 1
            ));

            // Audit log - NO PHI accessed
            $this->auditLog('health.questionnaire.schema_accessed', null, false);

            return response()->json([
                'version' => $schema['version'],
                'schema' => $schema['schema_json'],
                'branching_rules' => $schema['branching_rules'],
                'metadata' => [
                    'total_questions' => count($schema['schema_json']['questions']),
                    'estimated_minutes' => 5,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to load questionnaire schema', [
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Internal server error',
                'message' => 'Failed to load questionnaire schema',
            ], 500);
        }
    }

    /**
     * POST /api/v1/health/response
     *
     * Create or submit questionnaire response
     * - Draft: Save with submitted_at=null
     * - Final: Calculate score, emit event, lock submission
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function createResponse(Request $request): JsonResponse
    {
        // Feature flag check
        if (!$this->featureFlags->isEnabled('sliceC_health', auth()->id())) {
            return response()->json([
                'error' => 'Feature not enabled',
            ], 403);
        }

        // Rate limiting (10 submissions per hour)
        $rateLimitKey = 'health_submission:' . auth()->id();
        if (RateLimiter::tooManyAttempts($rateLimitKey, self::RATE_LIMIT_SUBMISSIONS)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'error' => 'Too many submissions',
                'message' => "Please wait {$seconds} seconds before submitting again",
                'retry_after' => $seconds,
            ], 429);
        }

        // Validation
        $validator = Validator::make($request->all(), [
            'questionnaire_id' => 'required|integer|exists:questionnaire_templates,id',
            'answers' => 'required|array',
            'answers.*.question_id' => 'required|string',
            'answers.*.value' => 'required',
            'is_draft' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $isDraft = $request->boolean('is_draft', false);

        try {
            DB::beginTransaction();

            // Check if user already submitted to this questionnaire
            // TODO: Query actual QuestionnaireResponse model
            $existingResponse = null; // DB::table('questionnaire_responses')->where(...)->first();

            if ($existingResponse && !$isDraft) {
                DB::rollBack();
                return response()->json([
                    'error' => 'Already submitted',
                    'message' => 'You have already submitted a response to this questionnaire',
                ], 409);
            }

            // Encrypt answers (PHI protection)
            $encryptedAnswers = encrypt(json_encode($request->input('answers')));

            // Calculate score (only for final submission)
            $score = null;
            $scoreRedacted = null;
            $riskBand = null;

            if (!$isDraft) {
                // TODO: Implement actual scoring logic
                $score = $this->calculateScore($request->input('answers'));
                $scoreRedacted = $this->redactScore($score);
                $riskBand = $this->getRiskBand($score);
            }

            // Create response record
            // TODO: Replace with actual model creation
            $responseId = DB::table('health_questionnaires')->insertGetId([
                'user_id' => auth()->id(),
                'questionnaire_id' => $request->input('questionnaire_id'),
                'answers_encrypted' => $encryptedAnswers,
                'score' => $score,
                'score_redacted' => $scoreRedacted,
                'risk_band' => $riskBand,
                'status' => $isDraft ? 'draft' : 'submitted',
                'submitted_at' => $isDraft ? null : now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();

            // Rate limit tracking (only for final submissions)
            if (!$isDraft) {
                RateLimiter::hit($rateLimitKey, 3600); // 1 hour decay
            }

            // Emit domain event (only for final submission)
            if (!$isDraft) {
                event(new HealthQuestionnaireSubmitted(
                    user: auth()->user(),
                    response: (object) [
                        'id' => $responseId,
                        'questionnaire' => (object) ['version' => 1],
                        'risk_band' => $riskBand,
                        'score_redacted' => $scoreRedacted,
                    ],
                    durationSeconds: 300 // TODO: Calculate actual duration
                ));
            }

            // Audit log - PHI accessed (encrypted answers stored)
            $this->auditLog(
                $isDraft ? 'health.questionnaire.draft_saved' : 'health.questionnaire.submitted',
                $responseId,
                true
            );

            return response()->json([
                'id' => $responseId,
                'status' => $isDraft ? 'draft' : 'submitted',
                'score_redacted' => $scoreRedacted,
                'risk_band' => $riskBand,
                'created_at' => now()->toIso8601String(),
                'message' => $isDraft ? 'Draft saved successfully' : 'Questionnaire submitted successfully',
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Failed to save questionnaire response', [
                'user_id' => auth()->id(),
                'questionnaire_id' => $request->input('questionnaire_id'),
                'is_draft' => $isDraft,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Internal server error',
                'message' => 'Failed to save questionnaire response',
            ], 500);
        }
    }

    /**
     * GET /api/v1/health/response/{id}
     *
     * Get questionnaire response metadata
     * NEVER returns decrypted answers
     *
     * @param int $id Response ID
     * @return JsonResponse
     */
    public function getResponse(int $id): JsonResponse
    {
        // Feature flag check
        if (!$this->featureFlags->isEnabled('sliceC_health', auth()->id())) {
            return response()->json(['error' => 'Feature not enabled'], 403);
        }

        try {
            // TODO: Replace with actual model query
            $response = DB::table('health_questionnaires')
                ->where('id', $id)
                ->first();

            if (!$response) {
                return response()->json(['error' => 'Not found'], 404);
            }

            // Authorization: User can only access their own responses
            if ($response->user_id !== auth()->id() && !auth()->user()->hasRole('admin')) {
                return response()->json([
                    'error' => 'Forbidden',
                    'message' => 'You can only access your own questionnaire responses',
                ], 403);
            }

            // Audit log - PHI accessed (metadata only, no decrypted answers)
            $this->auditLog('health.questionnaire.response_viewed', $id, false);

            return response()->json([
                'id' => $response->id,
                'status' => $response->status,
                'score_redacted' => $response->score_redacted,
                'risk_band' => $response->risk_band,
                'submitted_at' => $response->submitted_at,
                'created_at' => $response->created_at,
                'metadata' => [
                    'questionnaire_version' => 'v1.0.0',
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to fetch questionnaire response', [
                'response_id' => $id,
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Internal server error',
            ], 500);
        }
    }

    /**
     * PATCH /api/v1/health/response/{id}
     *
     * Update draft answers before submission
     * Only allowed if submitted_at is null
     *
     * @param Request $request
     * @param int $id Response ID
     * @return JsonResponse
     */
    public function updateResponse(Request $request, int $id): JsonResponse
    {
        // Feature flag check
        if (!$this->featureFlags->isEnabled('sliceC_health', auth()->id())) {
            return response()->json(['error' => 'Feature not enabled'], 403);
        }

        // Validation
        $validator = Validator::make($request->all(), [
            'answers' => 'required|array',
            'answers.*.question_id' => 'required|string',
            'answers.*.value' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            // TODO: Replace with actual model query
            $response = DB::table('health_questionnaires')->where('id', $id)->first();

            if (!$response) {
                return response()->json(['error' => 'Not found'], 404);
            }

            // Authorization
            if ($response->user_id !== auth()->id()) {
                return response()->json(['error' => 'Forbidden'], 403);
            }

            // Only drafts can be updated
            if ($response->submitted_at !== null) {
                return response()->json([
                    'error' => 'Cannot update submitted response',
                    'message' => 'This questionnaire has already been submitted',
                ], 409);
            }

            // Update draft
            $encryptedAnswers = encrypt(json_encode($request->input('answers')));

            DB::table('health_questionnaires')
                ->where('id', $id)
                ->update([
                    'answers_encrypted' => $encryptedAnswers,
                    'updated_at' => now(),
                ]);

            // Audit log
            $this->auditLog('health.questionnaire.draft_updated', $id, true);

            return response()->json([
                'id' => $id,
                'status' => 'draft',
                'updated_at' => now()->toIso8601String(),
                'message' => 'Draft updated successfully',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update questionnaire draft', [
                'response_id' => $id,
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Internal server error',
            ], 500);
        }
    }

    /**
     * Calculate score from answers
     *
     * @param array $answers Questionnaire answers
     * @return float Score (0-100)
     */
    private function calculateScore(array $answers): float
    {
        // TODO: Implement actual scoring algorithm
        // This is a placeholder
        return 75.5;
    }

    /**
     * Redact score for privacy (rounding/bucketing)
     *
     * @param float $score Raw score
     * @return string Redacted score (e.g., "70-80")
     */
    private function redactScore(float $score): string
    {
        // Round to nearest 10
        $bucket = floor($score / 10) * 10;
        return "{$bucket}-" . ($bucket + 10);
    }

    /**
     * Get risk band from score
     *
     * @param float $score Raw score
     * @return string Risk band (low, medium, high)
     */
    private function getRiskBand(float $score): string
    {
        if ($score < 40) {
            return 'high';
        } elseif ($score < 70) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Create audit log entry
     *
     * @param string $action Action performed
     * @param int|null $resourceId Resource ID
     * @param bool $phiAccessed Whether PHI was accessed
     */
    private function auditLog(string $action, ?int $resourceId, bool $phiAccessed): void
    {
        try {
            AuditLog::create([
                'user_id' => auth()->id(),
                'action' => $action,
                'resource_type' => 'questionnaire_response',
                'resource_id' => $resourceId,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'phi_accessed' => $phiAccessed,
                'occurred_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Log but don't throw - audit logging shouldn't block business logic
            Log::error('Failed to create audit log', [
                'action' => $action,
                'resource_id' => $resourceId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
