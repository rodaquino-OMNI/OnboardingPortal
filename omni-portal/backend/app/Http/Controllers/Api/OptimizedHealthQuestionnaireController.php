<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HealthQuestionnaire;
use App\Models\QuestionnaireTemplate;
use App\Services\HealthAIService;
use App\Services\ClinicalDecisionService;
use App\Jobs\ProcessHealthQuestionnaireAI;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Helpers\RequestHelper;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class OptimizedHealthQuestionnaireController extends Controller
{
    protected $healthAIService;
    protected $clinicalDecisionService;

    public function __construct(HealthAIService $healthAIService, ClinicalDecisionService $clinicalDecisionService)
    {
        $this->middleware('auth:sanctum');
        $this->middleware(\App\Http\Middleware\RateLimitHealthEndpoints::class);
        $this->healthAIService = $healthAIService;
        $this->clinicalDecisionService = $clinicalDecisionService;
    }

    /**
     * Get available questionnaire templates with caching
     */
    public function getTemplates(): JsonResponse
    {
        $startTime = microtime(true);
        
        try {
            // Cache templates for 1 hour with tag for easy invalidation
            $templates = Cache::tags(['questionnaire_templates'])->remember(
                'active_templates',
                3600,
                function () {
                    return QuestionnaireTemplate::where('is_active', true)
                        ->select('id', 'name', 'code', 'description', 'type', 'estimated_minutes', 'sections')
                        ->orderBy('name')
                        ->get();
                }
            );

            $responseTime = (microtime(true) - $startTime) * 1000;
            Log::info('Templates fetched', ['response_time_ms' => $responseTime, 'count' => $templates->count()]);

            return response()->json([
                'success' => true,
                'data' => $templates,
                'meta' => [
                    'count' => $templates->count(),
                    'response_time_ms' => round($responseTime, 2)
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch templates', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch templates',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Start a new health questionnaire with optimized queries
     */
    public function start(Request $request): JsonResponse
    {
        $startTime = microtime(true);
        
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
            DB::beginTransaction();

            // Optimized template fetch with caching
            $template = Cache::remember(
                "template_{$request->template_id}",
                1800, // 30 minutes
                function () use ($request) {
                    return QuestionnaireTemplate::select('id', 'name', 'code', 'sections', 'estimated_minutes')
                        ->findOrFail($request->template_id);
                }
            );

            $beneficiary = Auth::user()->beneficiary;

            // Create questionnaire with minimal initial data
            $questionnaire = HealthQuestionnaire::create([
                'beneficiary_id' => $beneficiary->id,
                'template_id' => $template->id,
                'status' => 'in_progress',
                'responses' => [],
                'current_section' => array_key_first($template->sections ?? []),
                'started_at' => now(),
                'metadata' => [
                    'user_agent' => $request->userAgent(),
                    'ip_address' => $request->ip(),
                    'request_id' => RequestHelper::generateRequestId($request),
                    'tracking_id' => RequestHelper::generateTrackingId(),
                    'start_timestamp' => now()->timestamp
                ]
            ]);

            // Cache user's current questionnaire
            Cache::put(
                "user_current_questionnaire_{$beneficiary->id}",
                $questionnaire->id,
                1800
            );

            DB::commit();

            $responseTime = (microtime(true) - $startTime) * 1000;
            Log::info('Questionnaire started', [
                'questionnaire_id' => $questionnaire->id,
                'template_id' => $template->id,
                'response_time_ms' => $responseTime
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'template' => $template->only(['id', 'name', 'code', 'estimated_minutes']),
                    'current_section' => $questionnaire->current_section,
                    'sections_count' => count($template->sections ?? [])
                ],
                'meta' => [
                    'response_time_ms' => round($responseTime, 2)
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Failed to start questionnaire', [
                'template_id' => $request->template_id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to start questionnaire',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get questionnaire progress with optimized queries and caching
     */
    public function getProgress($questionnaireId): JsonResponse
    {
        $startTime = microtime(true);
        $userId = Auth::user()->beneficiary->id;
        
        try {
            // Cache progress calculation for 5 minutes
            $progressData = Cache::remember(
                "progress_{$userId}_{$questionnaireId}",
                300,
                function () use ($questionnaireId, $userId) {
                    // Optimized query with eager loading
                    $questionnaire = HealthQuestionnaire::with(['template:id,sections'])
                        ->select('id', 'status', 'current_section', 'started_at', 'template_id', 'beneficiary_id')
                        ->where('id', $questionnaireId)
                        ->where('beneficiary_id', $userId)
                        ->firstOrFail();

                    // Load responses separately to avoid loading large JSON in main query
                    $responses = DB::table('health_questionnaires')
                        ->where('id', $questionnaireId)
                        ->value('responses');
                    
                    $responses = json_decode($responses, true) ?? [];
                    $template = $questionnaire->template;
                    
                    // Optimized progress calculation
                    $totalQuestions = 0;
                    $answeredQuestions = count($responses);
                    
                    if ($template && $template->sections) {
                        foreach ($template->sections as $section) {
                            $totalQuestions += count($section['questions'] ?? []);
                        }
                    }
                    
                    $progressPercentage = $totalQuestions > 0 ? round(($answeredQuestions / $totalQuestions) * 100) : 0;
                    $timeElapsed = $questionnaire->started_at->diffInMinutes(now());
                    
                    return [
                        'status' => $questionnaire->status,
                        'current_section' => $questionnaire->current_section,
                        'progress_percentage' => $progressPercentage,
                        'answered_questions' => $answeredQuestions,
                        'total_questions' => $totalQuestions,
                        'time_elapsed_minutes' => $timeElapsed,
                        'estimated_completion' => $this->estimateCompletionTime($progressPercentage, $timeElapsed, $template->estimated_minutes ?? 15)
                    ];
                }
            );

            $responseTime = (microtime(true) - $startTime) * 1000;
            
            return response()->json([
                'success' => true,
                'data' => $progressData,
                'meta' => [
                    'response_time_ms' => round($responseTime, 2),
                    'cached' => true
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get progress', [
                'questionnaire_id' => $questionnaireId,
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to get questionnaire progress',
                'error' => config('app.debug') ? $e->getMessage() : 'Questionnaire not found'
            ], 404);
        }
    }

    /**
     * Save questionnaire responses with optimized JSON operations
     */
    public function saveResponses($questionnaireId, Request $request): JsonResponse
    {
        $startTime = microtime(true);
        $userId = Auth::user()->beneficiary->id;
        
        $validator = Validator::make($request->all(), [
            'responses' => 'required|array',
            'current_section' => 'required|string',
            'partial_save' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Optimized questionnaire fetch
            $questionnaire = HealthQuestionnaire::select('id', 'beneficiary_id', 'status', 'responses', 'template_id')
                ->where('id', $questionnaireId)
                ->where('beneficiary_id', $userId)
                ->where('status', 'in_progress')
                ->firstOrFail();

            // Optimized JSON merge operation
            $existingResponses = $questionnaire->responses ?? [];
            $newResponses = array_merge($existingResponses, $request->responses);

            // Update with minimal fields
            $updateData = [
                'responses' => $newResponses,
                'current_section' => $request->current_section,
                'last_saved_at' => now()
            ];

            // Check completion status if not partial save
            if (!$request->boolean('partial_save')) {
                $template = Cache::remember(
                    "template_{$questionnaire->template_id}",
                    1800,
                    function () use ($questionnaire) {
                        return QuestionnaireTemplate::select('id', 'sections')->find($questionnaire->template_id);
                    }
                );

                if ($template && $this->isQuestionnaireComplete($template, $newResponses, $request->current_section)) {
                    $updateData['status'] = 'ready_for_submission';
                }
            }

            $questionnaire->update($updateData);

            // Invalidate progress cache
            Cache::forget("progress_{$userId}_{$questionnaireId}");

            $responseTime = (microtime(true) - $startTime) * 1000;
            Log::info('Responses saved', [
                'questionnaire_id' => $questionnaireId,
                'responses_count' => count($request->responses),
                'response_time_ms' => $responseTime
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Responses saved successfully',
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'status' => $questionnaire->status,
                    'responses_count' => count($newResponses)
                ],
                'meta' => [
                    'response_time_ms' => round($responseTime, 2)
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to save responses', [
                'questionnaire_id' => $questionnaireId,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to save responses',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get AI insights with background processing
     */
    public function getAIInsights($questionnaireId, Request $request): JsonResponse
    {
        $startTime = microtime(true);
        $userId = Auth::user()->beneficiary->id;
        
        try {
            $questionnaire = HealthQuestionnaire::select('id', 'beneficiary_id', 'responses', 'template_id', 'ai_insights')
                ->where('id', $questionnaireId)
                ->where('beneficiary_id', $userId)
                ->firstOrFail();

            // Check if AI insights are already cached
            $cacheKey = "ai_insights_{$questionnaireId}";
            $insights = Cache::get($cacheKey);

            if (!$insights) {
                // If not in cache, check if they're already processed
                if ($questionnaire->ai_insights) {
                    $insights = $questionnaire->ai_insights;
                    // Cache for future requests
                    Cache::put($cacheKey, $insights, 86400); // 24 hours
                } else {
                    // Dispatch background job for AI processing
                    ProcessHealthQuestionnaireAI::dispatch($questionnaire->id);
                    
                    // Return immediate response with job ID for polling
                    return response()->json([
                        'success' => true,
                        'data' => [
                            'status' => 'processing',
                            'message' => 'AI analysis is being processed in the background',
                            'polling_url' => route('health-questionnaire.ai-status', $questionnaireId)
                        ],
                        'meta' => [
                            'response_time_ms' => round((microtime(true) - $startTime) * 1000, 2)
                        ]
                    ]);
                }
            }

            $responseTime = (microtime(true) - $startTime) * 1000;
            
            return response()->json([
                'success' => true,
                'data' => $insights,
                'meta' => [
                    'response_time_ms' => round($responseTime, 2),
                    'source' => 'cache'
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get AI insights', [
                'questionnaire_id' => $questionnaireId,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate AI insights',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Check AI processing status
     */
    public function getAIStatus($questionnaireId): JsonResponse
    {
        $userId = Auth::user()->beneficiary->id;
        
        try {
            $questionnaire = HealthQuestionnaire::select('id', 'beneficiary_id', 'ai_insights', 'updated_at')
                ->where('id', $questionnaireId)
                ->where('beneficiary_id', $userId)
                ->firstOrFail();

            $cacheKey = "ai_insights_{$questionnaireId}";
            $insights = Cache::get($cacheKey) ?? $questionnaire->ai_insights;

            if ($insights) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'status' => 'completed',
                        'insights' => $insights,
                        'processed_at' => $questionnaire->updated_at->toISOString()
                    ]
                ]);
            } else {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'status' => 'processing',
                        'message' => 'AI analysis is still being processed'
                    ]
                ]);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to check AI status',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Helper method to estimate completion time
     */
    private function estimateCompletionTime(int $progressPercentage, int $timeElapsed, int $estimatedMinutes): array
    {
        if ($progressPercentage <= 0) {
            return [
                'estimated_remaining_minutes' => $estimatedMinutes,
                'estimated_total_minutes' => $estimatedMinutes
            ];
        }

        $projectedTotal = ($timeElapsed * 100) / $progressPercentage;
        $remainingTime = max(0, $projectedTotal - $timeElapsed);

        return [
            'estimated_remaining_minutes' => round($remainingTime),
            'estimated_total_minutes' => round($projectedTotal)
        ];
    }

    /**
     * Helper method to check if questionnaire is complete
     */
    private function isQuestionnaireComplete($template, array $responses, string $currentSection): bool
    {
        if (!$template || !$template->sections) {
            return false;
        }

        $allSections = array_keys($template->sections);
        $lastSection = end($allSections);

        if ($currentSection !== $lastSection) {
            return false;
        }

        // Check if last section is complete
        $lastSectionQuestions = $template->sections[$lastSection]['questions'] ?? [];
        
        foreach ($lastSectionQuestions as $question) {
            $questionId = $question['id'] ?? $question['key'] ?? null;
            if ($questionId && !isset($responses[$questionId])) {
                return false;
            }
        }

        return true;
    }
}