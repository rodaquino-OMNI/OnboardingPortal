<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HealthQuestionnaire;
use App\Models\QuestionnaireTemplate;
use App\Services\HealthAIService;
use App\Services\ClinicalDecisionService;
use App\Services\HealthDataCoordinator;
use App\Services\CacheService;
use App\Http\Middleware\RateLimitHealthEndpoints;
use App\Events\HealthAlertEvent;
use App\Events\AdminNotificationEvent;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Helpers\RequestHelper;

class HealthQuestionnaireController extends Controller
{
    protected $healthAIService;
    protected $clinicalDecisionService;
    protected $healthDataCoordinator;
    protected $cacheService;

    public function __construct(
        HealthAIService $healthAIService, 
        ClinicalDecisionService $clinicalDecisionService,
        HealthDataCoordinator $healthDataCoordinator,
        CacheService $cacheService
    )
    {
        $this->middleware('auth:sanctum');
        $this->middleware(RateLimitHealthEndpoints::class);
        $this->middleware('verified'); // Ensure email verification
        $this->middleware(function ($request, $next) {
            // Additional authorization check for health questionnaires
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Authentication required for health questionnaires'
                ], 401);
            }
            
            // Check email verification if required
            if (config('auth_security.health_questionnaire.require_email_verification', true) && !$user->hasVerifiedEmail()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Email verification required for health questionnaires'
                ], 403);
            }
            return $next($request);
        });
        $this->healthAIService = $healthAIService;
        $this->clinicalDecisionService = $clinicalDecisionService;
        $this->healthDataCoordinator = $healthDataCoordinator;
        $this->cacheService = $cacheService;
    }

    /**
     * Get available questionnaire templates
     */
    public function getTemplates(): JsonResponse
    {
        $templates = QuestionnaireTemplate::where('is_active', true)
            ->select('id', 'name', 'code', 'description', 'type', 'estimated_minutes', 'sections')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $templates
        ]);
    }

    /**
     * Start a new questionnaire
     */
    public function startQuestionnaire(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'template_id' => 'required|exists:questionnaire_templates,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // FIX: Add null check for beneficiary
            $beneficiary = Auth::user()->beneficiary;
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found'
                ], 422);
            }

            // Check if there's an incomplete questionnaire for this template
            $existingQuestionnaire = HealthQuestionnaire::where('beneficiary_id', $beneficiary->id)
                ->where('template_id', $request->template_id)
                ->where('status', 'in_progress')
                ->first();

            if ($existingQuestionnaire) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'questionnaire_id' => $existingQuestionnaire->id,
                        'status' => 'resumed',
                        'message' => 'Continuing existing questionnaire'
                    ]
                ]);
            }

            // Create new questionnaire
            $questionnaire = HealthQuestionnaire::create([
                'beneficiary_id' => $beneficiary->id,
                'template_id' => $request->template_id,
                'responses' => [],
                'status' => 'in_progress',
                'started_at' => now()
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'status' => 'started'
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to start questionnaire',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get questionnaire with template
     */
    public function getQuestionnaire($questionnaireId): JsonResponse
    {
        try {
            // FIX: Add null check and eager loading
            $beneficiary = Auth::user()->beneficiary;
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found'
                ], 422);
            }
            
            // FIX: Add eager loading to prevent N+1 queries
            $questionnaire = HealthQuestionnaire::with(['template', 'beneficiary'])
                ->where('id', $questionnaireId)
                ->where('beneficiary_id', $beneficiary->id)
                ->firstOrFail();

            return response()->json([
                'success' => true,
                'data' => $questionnaire
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Questionnaire not found',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Save responses and update progress
     */
    public function saveResponses($questionnaireId, Request $request): JsonResponse
    {
        // Enhanced security validation
        $user = Auth::user();
        $beneficiary = $user->beneficiary;
        
        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Beneficiary profile not found'
            ], 422);
        }
        
        // Validate questionnaire ownership
        if (!$this->validateQuestionnaireOwnership($questionnaireId, $beneficiary->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to questionnaire'
            ], 403);
        }
        
        // FIX: Add eager loading to prevent N+1 queries
        $questionnaire = HealthQuestionnaire::with(['template', 'beneficiary'])
            ->where('id', $questionnaireId)
            ->where('beneficiary_id', $beneficiary->id)
            ->where('status', 'in_progress')
            ->firstOrFail();

        $maxResponses = config('auth_security.health_questionnaire.max_responses_per_submission', 500);
        $maxResponseLength = config('auth_security.health_questionnaire.max_response_length', 2000);
        
        $validator = Validator::make($request->all(), [
            'responses' => "required|array|max:{$maxResponses}", // Limit response size
            'responses.*' => "string|max:{$maxResponseLength}", // Limit individual response size
            'current_section' => 'required|string|max:100|regex:/^[a-zA-Z0-9_-]+$/' // Sanitize section name
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Sanitize and merge new responses with existing ones
            $existingResponses = $questionnaire->responses ?? [];
            $sanitizedResponses = $this->sanitizeResponses($request->responses);
            $newResponses = array_merge($existingResponses, $sanitizedResponses);

            $questionnaire->update([
                'responses' => $newResponses,
                'current_section' => $request->current_section,
                'last_saved_at' => now()
            ]);
            
            // FIX: Invalidate related cache after update
            $this->cacheService->invalidateQuestionnaireRelatedCache(
                $questionnaire->id,
                $questionnaire->beneficiary_id,
                $questionnaire->template_id
            );

            // Check if questionnaire is complete (template already eager loaded)
            $template = $questionnaire->template;
            $allSections = array_keys($template->sections);
            $lastSection = end($allSections);

            if ($request->current_section === $lastSection && $this->isSectionComplete($questionnaire, $lastSection)) {
                $questionnaire->update(['status' => 'ready_for_submission']);
            }

            return response()->json([
                'success' => true,
                'message' => 'Responses saved successfully',
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'status' => $questionnaire->status
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to save responses',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Submit questionnaire for processing
     */
    public function submitQuestionnaire(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'questionnaire_id' => 'required|exists:health_questionnaires,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $beneficiary = Auth::user()->beneficiary;
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found'
                ], 422);
            }
            
            $questionnaire = HealthQuestionnaire::with(['template', 'beneficiary'])
                ->where('id', $request->questionnaire_id)
                ->where('beneficiary_id', $beneficiary->id)
                ->firstOrFail();

            // Score analysis and clinical decision
            $healthScores = $this->healthAIService->calculateHealthScores($questionnaire->responses);
            $clinicalDecision = $this->clinicalDecisionService->makeClinicalDecision(
                $questionnaire->responses,
                $healthScores,
                $beneficiary
            );
            
            $questionnaire->update([
                'scores' => $healthScores,
                'clinical_decision' => $clinicalDecision,
                'status' => 'completed',
                'submitted_at' => now()
            ]);
            
            // Broadcast health alert if needed
            $this->broadcastHealthAlertIfNeeded($questionnaire, $healthScores, $clinicalDecision);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Questionnaire submitted successfully',
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'scores' => $healthScores,
                    'clinical_decision' => $clinicalDecision
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Health questionnaire submission failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'questionnaire_id' => $request->questionnaire_id
            ]);
            
            // Broadcast system notification about submission failure
            AdminNotificationEvent::system(
                'Health questionnaire submission failed for user ID: ' . Auth::id(),
                'System Error',
                'medium',
                ['error' => $e->getMessage(), 'questionnaire_id' => $request->questionnaire_id]
            )->dispatch();
            
            return response()->json([
                'success' => false,
                'message' => 'Submission failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Broadcast health alert if conditions are met
     */
    private function broadcastHealthAlertIfNeeded(
        HealthQuestionnaire $questionnaire, 
        array $healthScores, 
        array $clinicalDecision
    ): void {
        try {
            // Determine alert severity based on scores and clinical decision
            $severity = $this->determineSeverity($healthScores, $clinicalDecision);
            
            if ($severity !== 'low') {
                // Create and broadcast health alert
                HealthAlertEvent::fromQuestionnaire(
                    $questionnaire,
                    $healthScores,
                    $severity
                )->dispatch();
                
                // Also send admin notification for high-severity cases
                if ($severity === 'critical') {
                    AdminNotificationEvent::security(
                        "CRITICAL: High-risk health assessment detected for user ID: {$questionnaire->beneficiary->user_id}",
                        'critical',
                        [
                            'questionnaire_id' => $questionnaire->id,
                            'user_id' => $questionnaire->beneficiary->user_id,
                            'risk_scores' => $healthScores,
                            'clinical_decision' => $clinicalDecision
                        ]
                    )->dispatch();
                }
            }
            
            // Always notify admin about completed assessments
            AdminNotificationEvent::userActivity(
                "Health assessment completed for user ID: {$questionnaire->beneficiary->user_id}",
                $questionnaire->beneficiary->user_id,
                'health_assessment_completed',
                'low'
            )->dispatch();
            
        } catch (\Exception $e) {
            Log::error('Failed to broadcast health alert', [
                'error' => $e->getMessage(),
                'questionnaire_id' => $questionnaire->id
            ]);
        }
    }

    /**
     * Determine alert severity based on health scores
     */
    private function determineSeverity(array $healthScores, array $clinicalDecision): string
    {
        // Check for critical indicators
        if (isset($healthScores['suicide_risk']) && $healthScores['suicide_risk'] === 'high') {
            return 'critical';
        }

        if (isset($clinicalDecision['risk_level']) && $clinicalDecision['risk_level'] === 'critical') {
            return 'critical';
        }

        // Check for high severity
        if (isset($healthScores['phq9_score']) && $healthScores['phq9_score'] >= 15) {
            return 'high';
        }

        if (isset($healthScores['gad7_score']) && $healthScores['gad7_score'] >= 15) {
            return 'high';
        }

        if (isset($clinicalDecision['risk_level']) && $clinicalDecision['risk_level'] === 'high') {
            return 'high';
        }

        // Check for medium severity
        if (isset($healthScores['phq9_score']) && $healthScores['phq9_score'] >= 10) {
            return 'medium';
        }

        if (isset($healthScores['gad7_score']) && $healthScores['gad7_score'] >= 10) {
            return 'medium';
        }

        if (isset($clinicalDecision['risk_level']) && in_array($clinicalDecision['risk_level'], ['medium', 'moderate'])) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Validate questionnaire ownership for security
     */
    private function validateQuestionnaireOwnership(int $questionnaireId, int $beneficiaryId): bool
    {
        return HealthQuestionnaire::where('id', $questionnaireId)
            ->where('beneficiary_id', $beneficiaryId)
            ->exists();
    }

    /**
     * Sanitize user responses to prevent XSS and injection attacks
     */
    private function sanitizeResponses(array $responses): array
    {
        $sanitized = [];
        
        foreach ($responses as $key => $value) {
            // Sanitize key
            $cleanKey = preg_replace('/[^a-zA-Z0-9_-]/', '', $key);
            
            // Sanitize value based on type
            if (is_string($value)) {
                // Remove HTML tags and encode special characters
                $cleanValue = htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
                // Limit length to prevent large payloads
                $maxLength = config('auth_security.health_questionnaire.max_response_length', 2000);
                $cleanValue = mb_substr($cleanValue, 0, $maxLength);
            } elseif (is_numeric($value)) {
                $cleanValue = filter_var($value, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
            } elseif (is_array($value)) {
                // Recursively sanitize arrays (configurable depth to prevent deep nesting attacks)
                $maxDepth = config('auth_security.health_questionnaire.max_array_depth', 2);
                $cleanValue = $this->sanitizeArrayRecursive($value, 1, $maxDepth);
            } else {
                // Convert other types to string and sanitize
                $cleanValue = htmlspecialchars(strip_tags((string)$value), ENT_QUOTES, 'UTF-8');
            }
            
            if (!empty($cleanKey) && $cleanValue !== null) {
                $sanitized[$cleanKey] = $cleanValue;
            }
        }
        
        return $sanitized;
    }

    /**
     * Sanitize array responses recursively with depth limit
     */
    private function sanitizeArrayRecursive(array $array, int $depth, int $maxDepth = 2): array
    {
        if ($depth > $maxDepth) {
            return []; // Prevent deep nesting attacks
        }
        
        $sanitized = [];
        $count = 0;
        $maxArraySize = config('auth_security.health_questionnaire.max_array_size', 100);
        
        foreach ($array as $key => $value) {
            if ($count >= $maxArraySize) { // Limit array size
                break;
            }
            
            $cleanKey = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$key);
            
            if (is_string($value)) {
                $cleanValue = htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
                // Shorter limit for nested values
                $nestedMaxLength = min(1000, config('auth_security.health_questionnaire.max_response_length', 2000) / 2);
                $cleanValue = mb_substr($cleanValue, 0, $nestedMaxLength);
            } elseif (is_numeric($value)) {
                $cleanValue = filter_var($value, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
            } elseif (is_array($value)) {
                $cleanValue = $this->sanitizeArrayRecursive($value, $depth + 1, $maxDepth);
            } else {
                $cleanValue = htmlspecialchars(strip_tags((string)$value), ENT_QUOTES, 'UTF-8');
            }
            
            if (!empty($cleanKey) && $cleanValue !== null) {
                $sanitized[$cleanKey] = $cleanValue;
            }
            
            $count++;
        }
        
        return $sanitized;
    }

    // Additional helper methods remain the same...
    private function isSectionComplete($questionnaire, $section): bool
    {
        // Implementation depends on your questionnaire structure
        return true; // Simplified for this example
    }
}