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
            ->where('status', 'in_progress')
            ->firstOrFail();

        $validator = Validator::make($request->all(), [
            'responses' => 'required|array',
            'current_section' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Merge new responses with existing ones
            $existingResponses = $questionnaire->responses ?? [];
            $newResponses = array_merge($existingResponses, $request->responses);

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

    // Additional helper methods remain the same...
    private function isSectionComplete($questionnaire, $section): bool
    {
        // Implementation depends on your questionnaire structure
        return true; // Simplified for this example
    }
}