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
     * Start a new health questionnaire
     */
    public function start(Request $request): JsonResponse
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
            DB::beginTransaction();

            $template = QuestionnaireTemplate::findOrFail($request->template_id);
            $beneficiary = Auth::user()->beneficiary;
            
            // FIX: Add null check for beneficiary
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found'
                ], 422);
            }
            
            // FIX: Add null check for beneficiary
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found. Please complete your profile first.'
                ], 422);
            }

            // Create new questionnaire instance
            $questionnaire = HealthQuestionnaire::create([
                'beneficiary_id' => $beneficiary->id,
                'template_id' => $template->id,
                'questionnaire_type' => $template->type ?? 'initial',
                'status' => 'draft', // Use valid status until enum is fixed
                'responses' => [],
                'current_section' => $this->getSafeFirstKey(json_decode($template->sections, true)),
                'started_at' => now(),
                'metadata' => [
                    'user_agent' => $request->userAgent(),
                    'ip_address' => $request->ip(),
                    'request_id' => RequestHelper::generateRequestId($request),
                    'tracking_id' => RequestHelper::generateTrackingId()
                ]
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'template' => $template,
                    'current_section' => $questionnaire->current_section
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollback();
            return response()->json([
                'success' => false,
                'message' => 'Failed to start questionnaire',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get questionnaire progress
     */
    public function getProgress($questionnaireId): JsonResponse
    {
        // FIX: Add eager loading and null check for beneficiary
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

        // FIX: Use caching for expensive computations
        $progressData = $this->cacheService->computeWithCache(
            "questionnaire_progress:{$questionnaireId}",
            function () use ($questionnaire) {
                $template = $questionnaire->template;
                $totalQuestions = collect($template->sections)->sum(function ($section) {
                    return count($section['questions'] ?? []);
                });

                $answeredQuestions = count($questionnaire->responses ?? []);
                $progressPercentage = $totalQuestions > 0 ? round(($answeredQuestions / $totalQuestions) * 100) : 0;
                
                // Cache the sections completed computation
                $sectionsCompleted = $this->cacheService->cacheQuestionnaireSections(
                    $questionnaire->id,
                    $questionnaire->getSectionsCompleted()
                );

                return [
                    'status' => $questionnaire->status,
                    'current_section' => $questionnaire->current_section,
                    'progress_percentage' => $progressPercentage,
                    'answered_questions' => $answeredQuestions,
                    'total_questions' => $totalQuestions,
                    'sections_completed' => $sectionsCompleted,
                    'time_elapsed' => $questionnaire->started_at->diffInMinutes(now())
                ];
            },
            300 // 5 minutes cache
        );

        return response()->json([
            'success' => true,
            'data' => $progressData
        ]);
    }

    /**
     * Save questionnaire responses
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
     * Get AI-powered insights from responses
     */
    public function getAIInsights($questionnaireId, Request $request): JsonResponse
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
        $questionnaire = HealthQuestionnaire::with(['template'])
            ->where('id', $questionnaireId)
            ->where('beneficiary_id', $beneficiary->id)
            ->firstOrFail();

        try {
            // FIX: Cache AI insights to prevent expensive recomputation
            $insights = $this->cacheService->cacheAIAnalysis(
                $questionnaire->id,
                $this->healthAIService->analyzeResponses(
                    $questionnaire->responses,
                    $questionnaire->template->code
                )
            );

            return response()->json([
                'success' => true,
                'data' => $insights
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate AI insights',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Submit completed questionnaire
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

            // FIX: Add null check and eager loading
            $beneficiary = Auth::user()->beneficiary;
            
            // FIX: Add null check for beneficiary
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found'
                ], 422);
            }
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found'
                ], 422);
            }
            
            // FIX: Add eager loading to prevent N+1 queries
            $questionnaire = HealthQuestionnaire::with(['template', 'beneficiary'])
                ->where('id', $request->questionnaire_id)
                ->where('beneficiary_id', $beneficiary->id)
                ->whereIn('status', ['in_progress', 'ready_for_submission'])
                ->firstOrFail();

            // Analyze responses with AI
            $aiAnalysis = $this->healthAIService->analyzeResponses(
                $questionnaire->responses,
                $questionnaire->template->code
            );

            // Update questionnaire with analysis results
            $questionnaire->update([
                'status' => 'completed',
                'completed_at' => now(),
                'risk_scores' => $aiAnalysis['risk_scores'] ?? [],
                'recommendations' => $aiAnalysis['recommendations'] ?? [],
                'ai_insights' => $aiAnalysis
            ]);
            
            // FIX: Invalidate cache after completion
            $this->cacheService->invalidateQuestionnaireRelatedCache(
                $questionnaire->id,
                $questionnaire->beneficiary_id,
                $questionnaire->template_id
            );

            // Award points for completion
            event(new \App\Events\PointsEarned(
                $beneficiary,
                100,
                'health_questionnaire_completion'
            ));

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Questionnaire submitted successfully',
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'risk_scores' => $questionnaire->risk_scores,
                    'recommendations' => $questionnaire->recommendations
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollback();
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit questionnaire',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Submit progressive health screening results
     */
    public function submitProgressive(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'layer' => 'required|string|in:triage,targeted,specialized',
            'responses' => 'required|array|min:1',
            'scores' => 'required|array|min:1',
            'total_score' => 'required|numeric|min:0|max:100',
            'risk_level' => 'required|string|in:low,moderate,high,critical',
            'recommendations' => 'array',
            'next_steps' => 'array',
            'fraud_score' => 'required|numeric|min:0|max:100',
            'completion_time' => 'required|numeric|min:30|max:3600', // 30 seconds to 1 hour
            'metadata' => 'array'
        ]);
        
        // Add custom validation for medical scores
        $validator->after(function ($validator) use ($request) {
            $this->validateMedicalScores($validator, $request->input('scores', []));
            $this->validateResponseConsistency($validator, $request->input('responses', []), $request->input('scores', []));
        });

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $beneficiary = Auth::user()->beneficiary;
            
            // FIX: Add null check for beneficiary
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found'
                ], 422);
            }

            // Create health questionnaire record with progressive screening data
            $questionnaire = HealthQuestionnaire::create([
                'beneficiary_id' => $beneficiary->id,
                'template_id' => null, // Progressive screening doesn't use traditional templates
                'questionnaire_type' => 'progressive',
                'status' => 'completed',
                'responses' => $request->responses,
                'current_section' => $request->layer,
                'started_at' => now()->subSeconds($request->completion_time),
                'completed_at' => now(),
                'risk_scores' => $request->scores,
                'recommendations' => $request->recommendations,
                'ai_insights' => [
                    'layer' => $request->layer,
                    'total_score' => $request->total_score,
                    'risk_level' => $request->risk_level,
                    'next_steps' => $request->next_steps,
                    'fraud_detection' => [
                        'score' => $request->fraud_score,
                        'flags' => $request->input('metadata.fraud_flags', [])
                    ]
                ],
                'metadata' => array_merge([
                    'type' => 'progressive_screening',
                    'layer' => $request->layer,
                    'user_agent' => $request->userAgent(),
                    'ip_address' => $request->ip(),
                    'request_id' => RequestHelper::generateRequestId($request),
                    'tracking_id' => RequestHelper::generateTrackingId()
                ], $request->input('metadata', []))
            ]);

            // Calculate overall progressive score using evidence-based algorithms
            $progressiveScore = $this->calculateProgressiveScore($request->scores);

            // Generate clinical decision support recommendations
            $clinicalAnalysis = $this->clinicalDecisionService->analyzeResponses($request->responses);
            
            // Update questionnaire with clinical analysis
            $questionnaire->update([
                'ai_insights' => array_merge($questionnaire->ai_insights, [
                    'clinical_analysis' => $clinicalAnalysis,
                    'risk_stratification' => $this->calculateRiskStratification($progressiveScore, $request->risk_level),
                    'care_pathway' => $this->determineCarepathway($clinicalAnalysis, $request->risk_level)
                ])
            ]);

            // Process through coordinator to prevent race conditions
            $coordinatorResult = $this->healthDataCoordinator->processQuestionnaire($questionnaire);

            // Track engagement metrics
            event(new \App\Events\HealthScreeningCompleted(
                $beneficiary,
                $questionnaire,
                $request->layer,
                $request->risk_level
            ));

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Progressive screening submitted successfully',
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'progressive_score' => $progressiveScore,
                    'risk_level' => $request->risk_level,
                    'recommendations' => $request->recommendations,
                    'next_steps' => $request->next_steps,
                    'clinical_decision_support' => $coordinatorResult['clinical_alerts'] ?? [],
                    'gamification' => $coordinatorResult['gamification'] ?? null,
                    'clinical_alerts_scheduled' => $coordinatorResult['clinical_alerts_scheduled'] ?? false,
                    'risk_stratification' => $this->calculateRiskStratification($progressiveScore, $request->risk_level),
                    'care_pathway_recommended' => $this->determineCarepathway($clinicalAnalysis, $request->risk_level)
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollback();
            return response()->json([
                'success' => false,
                'message' => 'Failed to save progressive screening results',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Submit dual pathway health assessment results
     */
    public function submitDualPathway(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'pathway_taken' => 'required|string|in:enhanced,clinical,hybrid,immersive',
            'responses' => 'required|array',
            'clinical_analysis' => 'required|array',
            'fraud_analysis' => 'required|array',
            'user_experience' => 'required|array',
            'recommendations' => 'array',
            'risk_level' => 'required|string|in:low,moderate,high,critical',
            'completion_rate' => 'required|numeric|min:0|max:100',
            'engagement_score' => 'required|numeric|min:0|max:100',
            'timestamp' => 'required|string'
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
            
            // FIX: Add null check for beneficiary
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiary profile not found'
                ], 422);
            }

            // Create health questionnaire record with dual pathway data
            $questionnaire = HealthQuestionnaire::create([
                'beneficiary_id' => $beneficiary->id,
                'template_id' => null, // Dual pathway uses dynamic templates
                'questionnaire_type' => 'dual_pathway',
                'status' => 'completed',
                'responses' => $request->responses,
                'current_section' => 'completed',
                'started_at' => now()->subMinutes(15), // Estimated duration
                'completed_at' => now(),
                'risk_scores' => $request->input('clinical_analysis.scores', []),
                'recommendations' => $request->recommendations,
                'ai_insights' => [
                    'pathway' => $request->pathway_taken,
                    'clinical_analysis' => $request->clinical_analysis,
                    'fraud_analysis' => $request->fraud_analysis,
                    'user_experience' => $request->user_experience,
                    'risk_level' => $request->risk_level,
                    'completion_rate' => $request->completion_rate,
                    'engagement_score' => $request->engagement_score
                ],
                'metadata' => [
                    'type' => 'dual_pathway_assessment',
                    'pathway_taken' => $request->pathway_taken,
                    'user_agent' => $request->userAgent(),
                    'ip_address' => $request->ip(),
                    'request_id' => RequestHelper::generateRequestId($request),
                    'tracking_id' => RequestHelper::generateTrackingId(),
                    'timestamp' => $request->timestamp
                ]
            ]);

            // Award pathway-specific points
            $this->awardDualPathwayPoints($beneficiary, $request->pathway_taken, $request->risk_level, $request->engagement_score);

            // Track pathway metrics
            event(new \App\Events\DualPathwayCompleted(
                $beneficiary,
                $questionnaire,
                $request->pathway_taken,
                $request->risk_level,
                $request->engagement_score
            ));

            // Store user experience insights for future pathway optimization
            $this->storePathwayExperience($beneficiary, $request->all());

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Dual pathway assessment submitted successfully',
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'pathway_taken' => $request->pathway_taken,
                    'risk_level' => $request->risk_level,
                    'engagement_score' => $request->engagement_score,
                    'recommendations' => $request->recommendations,
                    'next_assessment_date' => $this->calculateNextAssessmentDate($request->risk_level)
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollback();
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit dual pathway assessment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate score for progressive screening
     */
    protected function calculateProgressiveScore(array $scores): float
    {
        // Weight different scores for overall health assessment
        $totalScore = 0;
        
        if (isset($scores['pain_severity'])) {
            $totalScore += $scores['pain_severity'] * 2; // Pain has high impact
        }
        
        if (isset($scores['who5'])) {
            $totalScore += (100 - $scores['who5']) / 10; // WHO-5 lower is worse
        }
        
        if (isset($scores['phq2'])) {
            $totalScore += $scores['phq2'] * 3; // Depression screening weight
        }
        
        if (isset($scores['gad2'])) {
            $totalScore += $scores['gad2'] * 3; // Anxiety screening weight
        }
        
        if (isset($scores['pain_interference'])) {
            $totalScore += $scores['pain_interference'] * 1.5;
        }

        // Use comprehensive evidence-based scoring
        return $this->calculateEvidenceBasedScore($scores);
    }
    
    /**
     * Calculate comprehensive score using evidence-based medical algorithms
     */
    protected function calculateEvidenceBasedScore(array $scores): float
    {
        $riskScore = 0;
        $weightedComponents = [];
        
        // PHQ-9 Depression Assessment (0-27 scale)
        if (isset($scores['phq9_total']) || $this->hasPHQ9Items($scores)) {
            $phq9Score = $this->calculatePHQ9Score($scores);
            $riskScore += $phq9Score['weighted_risk'];
            $weightedComponents['depression'] = $phq9Score;
        } elseif (isset($scores['phq2'])) {
            // PHQ-2 as screener (0-6 scale) 
            $phq2Risk = $this->calculatePHQ2Risk($scores['phq2']);
            $riskScore += $phq2Risk;
            $weightedComponents['depression_screener'] = ['score' => $scores['phq2'], 'risk' => $phq2Risk];
        }
        
        // GAD-7 Anxiety Assessment (0-21 scale)
        if (isset($scores['gad7_total']) || $this->hasGAD7Items($scores)) {
            $gad7Score = $this->calculateGAD7Score($scores);
            $riskScore += $gad7Score['weighted_risk'];
            $weightedComponents['anxiety'] = $gad7Score;
        } elseif (isset($scores['gad2'])) {
            // GAD-2 as screener (0-6 scale)
            $gad2Risk = $this->calculateGAD2Risk($scores['gad2']);
            $riskScore += $gad2Risk;
            $weightedComponents['anxiety_screener'] = ['score' => $scores['gad2'], 'risk' => $gad2Risk];
        }
        
        // WHO-5 Well-Being Index (0-100 scale, lower = worse)
        if (isset($scores['who5'])) {
            $who5Risk = $this->calculateWHO5Risk($scores['who5']);
            $riskScore += $who5Risk;
            $weightedComponents['wellbeing'] = ['score' => $scores['who5'], 'risk' => $who5Risk];
        }
        
        // Pain Assessment (0-10 scale)
        if (isset($scores['pain_severity'])) {
            $painRisk = $this->calculatePainRisk($scores['pain_severity'], $scores['pain_interference'] ?? 0);
            $riskScore += $painRisk;
            $weightedComponents['pain'] = [
                'severity' => $scores['pain_severity'],
                'interference' => $scores['pain_interference'] ?? 0,
                'risk' => $painRisk
            ];
        }
        
        // Substance Use Screening (AUDIT-C)
        if (isset($scores['alcohol_frequency'])) {
            $substanceRisk = $this->calculateSubstanceUseRisk($scores);
            $riskScore += $substanceRisk;
            $weightedComponents['substance_use'] = ['risk' => $substanceRisk];
        }
        
        // Social Determinants of Health
        if (isset($scores['social_support'])) {
            $socialRisk = $this->calculateSocialRisk($scores);
            $riskScore += $socialRisk;
            $weightedComponents['social_determinants'] = ['risk' => $socialRisk];
        }
        
        // Store detailed breakdown for clinical review
        $this->storeScoreBreakdown($weightedComponents);
        
        return round(min(100, max(0, $riskScore)), 2);
    }
    
    /**
     * Check if PHQ-9 individual items are present
     */
    protected function hasPHQ9Items(array $scores): bool
    {
        $phq9Items = ['phq9_1', 'phq9_2', 'phq9_3', 'phq9_4', 'phq9_5', 'phq9_6', 'phq9_7', 'phq9_8', 'phq9_9'];
        $count = 0;
        foreach ($phq9Items as $item) {
            if (isset($scores[$item])) $count++;
        }
        return $count >= 5; // Require at least 5 items
    }
    
    /**
     * Check if GAD-7 individual items are present
     */
    protected function hasGAD7Items(array $scores): bool
    {
        $gad7Items = ['gad7_1', 'gad7_2', 'gad7_3', 'gad7_4', 'gad7_5', 'gad7_6', 'gad7_7'];
        $count = 0;
        foreach ($gad7Items as $item) {
            if (isset($scores[$item])) $count++;
        }
        return $count >= 4; // Require at least 4 items
    }
    
    /**
     * Calculate PHQ-9 depression score and risk assessment
     */
    protected function calculatePHQ9Score(array $scores): array
    {
        // PHQ-9 questions scored 0-3 each (total 0-27)
        $phq9Items = ['phq9_1', 'phq9_2', 'phq9_3', 'phq9_4', 'phq9_5', 'phq9_6', 'phq9_7', 'phq9_8', 'phq9_9'];
        
        $totalScore = 0;
        $answeredItems = 0;
        
        foreach ($phq9Items as $item) {
            if (isset($scores[$item]) && is_numeric($scores[$item])) {
                $totalScore += min(3, max(0, (int) $scores[$item]));
                $answeredItems++;
            }
        }
        
        // Use provided total if available and no individual items
        if ($answeredItems < 5 && isset($scores['phq9_total'])) {
            $totalScore = min(27, max(0, (int) $scores['phq9_total']));
            $answeredItems = 9; // Assume complete if total provided
        }
        
        // Require sufficient items for valid score
        if ($answeredItems < 5) {
            return ['total_score' => 0, 'severity' => 'insufficient_data', 'weighted_risk' => 0, 'suicide_risk' => false];
        }
        
        // Suicide risk assessment (item 9)
        $suicideRisk = isset($scores['phq9_9']) && $scores['phq9_9'] > 0;
        
        // Evidence-based severity levels
        $severity = $this->getDepressionSeverity($totalScore);
        $weightedRisk = $this->getDepressionRiskWeight($totalScore, $suicideRisk);
        
        return [
            'total_score' => $totalScore,
            'severity' => $severity,
            'weighted_risk' => $weightedRisk,
            'suicide_risk' => $suicideRisk,
            'suicide_score' => $scores['phq9_9'] ?? 0,
            'completed_items' => $answeredItems,
            'clinical_cutoff' => $totalScore >= 10 ? 'major_depression_likely' : 'below_cutoff'
        ];
    }
    
    /**
     * Calculate GAD-7 anxiety score and risk assessment
     */
    protected function calculateGAD7Score(array $scores): array
    {
        // GAD-7 questions scored 0-3 each (total 0-21)
        $gad7Items = ['gad7_1', 'gad7_2', 'gad7_3', 'gad7_4', 'gad7_5', 'gad7_6', 'gad7_7'];
        
        $totalScore = 0;
        $answeredItems = 0;
        
        foreach ($gad7Items as $item) {
            if (isset($scores[$item]) && is_numeric($scores[$item])) {
                $totalScore += min(3, max(0, (int) $scores[$item]));
                $answeredItems++;
            }
        }
        
        // Use provided total if available and no individual items
        if ($answeredItems < 4 && isset($scores['gad7_total'])) {
            $totalScore = min(21, max(0, (int) $scores['gad7_total']));
            $answeredItems = 7; // Assume complete if total provided
        }
        
        // Require sufficient items for valid score
        if ($answeredItems < 4) {
            return ['total_score' => 0, 'severity' => 'insufficient_data', 'weighted_risk' => 0];
        }
        
        $severity = $this->getAnxietySeverity($totalScore);
        $weightedRisk = $this->getAnxietyRiskWeight($totalScore);
        
        return [
            'total_score' => $totalScore,
            'severity' => $severity,
            'weighted_risk' => $weightedRisk,
            'completed_items' => $answeredItems,
            'clinical_cutoff' => $totalScore >= 10 ? 'anxiety_disorder_likely' : 'below_cutoff'
        ];
    }
    
    /**
     * Calculate PHQ-2 risk (depression screener)
     */
    protected function calculatePHQ2Risk(int $score): float
    {
        // PHQ-2 cutoff is ≥3 for positive screen
        if ($score >= 3) {
            return min(25, $score * 4.2); // Max 25 points for positive screen
        }
        return $score * 2; // Lower weight for negative screen
    }
    
    /**
     * Calculate GAD-2 risk (anxiety screener)
     */
    protected function calculateGAD2Risk(int $score): float
    {
        // GAD-2 cutoff is ≥3 for positive screen
        if ($score >= 3) {
            return min(20, $score * 3.5); // Max 20 points for positive screen
        }
        return $score * 1.5; // Lower weight for negative screen
    }
    
    /**
     * Calculate WHO-5 Well-Being risk
     */
    protected function calculateWHO5Risk(int $score): float
    {
        // WHO-5 scores <50 suggest poor well-being, <25 suggest depression
        if ($score < 25) {
            return 25; // High risk
        } elseif ($score < 50) {
            return 15; // Moderate risk
        } elseif ($score < 68) {
            return 8; // Mild concern
        }
        return 0; // Good well-being
    }
    
    /**
     * Calculate pain-related risk
     */
    protected function calculatePainRisk(int $severity, int $interference): float
    {
        $riskScore = 0;
        
        // Pain severity (0-10 scale)
        if ($severity >= 7) {
            $riskScore += 15; // Severe pain
        } elseif ($severity >= 4) {
            $riskScore += 10; // Moderate pain
        } elseif ($severity >= 1) {
            $riskScore += 5; // Mild pain
        }
        
        // Pain interference (0-10 scale)
        if ($interference >= 7) {
            $riskScore += 10; // Severe interference
        } elseif ($interference >= 4) {
            $riskScore += 6; // Moderate interference
        } elseif ($interference >= 1) {
            $riskScore += 3; // Mild interference
        }
        
        return min(25, $riskScore); // Cap at 25 points
    }
    
    /**
     * Calculate substance use risk (simplified AUDIT-C)
     */
    protected function calculateSubstanceUseRisk(array $scores): float
    {
        $auditScore = 0;
        
        // Alcohol frequency (0-4 scale)
        if (isset($scores['alcohol_frequency'])) {
            $auditScore += min(4, max(0, (int) $scores['alcohol_frequency']));
        }
        
        // Alcohol quantity (0-4 scale)
        if (isset($scores['alcohol_quantity'])) {
            $auditScore += min(4, max(0, (int) $scores['alcohol_quantity']));
        }
        
        // Binge drinking (0-4 scale)
        if (isset($scores['alcohol_binge'])) {
            $auditScore += min(4, max(0, (int) $scores['alcohol_binge']));
        }
        
        // AUDIT-C scoring: ≥4 men, ≥3 women suggests problematic drinking
        if ($auditScore >= 4) {
            return min(15, $auditScore * 2.5); // High risk
        } elseif ($auditScore >= 2) {
            return $auditScore * 1.5; // Moderate risk
        }
        
        return 0;
    }
    
    /**
     * Calculate social determinants risk
     */
    protected function calculateSocialRisk(array $scores): float
    {
        $socialRisk = 0;
        
        // Social support (0-4 scale, lower = worse)
        if (isset($scores['social_support']) && $scores['social_support'] <= 2) {
            $socialRisk += 8;
        }
        
        // Financial stress
        if (isset($scores['financial_stress']) && $scores['financial_stress'] >= 3) {
            $socialRisk += 6;
        }
        
        // Housing stability
        if (isset($scores['housing_stable']) && !$scores['housing_stable']) {
            $socialRisk += 5;
        }
        
        return min(15, $socialRisk); // Cap at 15 points
    }
    
    /**
     * Get depression severity level based on PHQ-9 score
     */
    protected function getDepressionSeverity(int $score): string
    {
        if ($score >= 20) return 'severe';
        if ($score >= 15) return 'moderately_severe';
        if ($score >= 10) return 'moderate';
        if ($score >= 5) return 'mild';
        return 'minimal';
    }
    
    /**
     * Get anxiety severity level based on GAD-7 score
     */
    protected function getAnxietySeverity(int $score): string
    {
        if ($score >= 15) return 'severe';
        if ($score >= 10) return 'moderate';
        if ($score >= 5) return 'mild';
        return 'minimal';
    }
    
    /**
     * Get weighted risk points for depression
     */
    protected function getDepressionRiskWeight(int $score, bool $suicideRisk): float
    {
        $baseWeight = 0;
        
        if ($score >= 20) {
            $baseWeight = 35; // Severe depression
        } elseif ($score >= 15) {
            $baseWeight = 28; // Moderately severe
        } elseif ($score >= 10) {
            $baseWeight = 22; // Moderate
        } elseif ($score >= 5) {
            $baseWeight = 12; // Mild
        } else {
            $baseWeight = $score; // Minimal
        }
        
        // Add critical weight for suicide risk
        if ($suicideRisk) {
            $baseWeight += 25;
        }
        
        return min(50, $baseWeight); // Cap at 50 points
    }
    
    /**
     * Get weighted risk points for anxiety
     */
    protected function getAnxietyRiskWeight(int $score): float
    {
        if ($score >= 15) return 25; // Severe anxiety
        if ($score >= 10) return 20; // Moderate anxiety
        if ($score >= 5) return 12; // Mild anxiety
        return $score * 1.5; // Minimal anxiety
    }
    
    /**
     * Store detailed score breakdown for clinical review
     */
    protected function storeScoreBreakdown(array $components): void
    {
        // Log detailed scoring for clinical audit and ML training
        Log::info('Health Assessment Score Breakdown', [
            'components' => $components,
            'timestamp' => now(),
            'user_id' => Auth::id()
        ]);
    }
    
    /**
     * Calculate risk stratification level
     */
    protected function calculateRiskStratification(float $totalScore, string $riskLevel): array
    {
        $stratification = [
            'numerical_score' => $totalScore,
            'categorical_risk' => $riskLevel,
            'clinical_priority' => $this->getClinicalPriority($totalScore, $riskLevel),
            'intervention_timeframe' => $this->getInterventionTimeframe($riskLevel),
            'care_coordination_required' => $totalScore >= 60 || $riskLevel === 'critical'
        ];
        
        return $stratification;
    }
    
    /**
     * Determine appropriate care pathway
     */
    protected function determineCarepathway(array $clinicalAnalysis, string $riskLevel): array
    {
        $pathway = [
            'primary_care' => true,
            'mental_health_referral' => false,
            'emergency_intervention' => false,
            'specialist_referral' => false,
            'care_management' => false
        ];
        
        // Check for emergency indicators
        if (isset($clinicalAnalysis['clinical_decisions'])) {
            foreach ($clinicalAnalysis['clinical_decisions'] as $decision) {
                if (isset($decision['emergency_required']) && $decision['emergency_required']) {
                    $pathway['emergency_intervention'] = true;
                    $pathway['care_management'] = true;
                }
                
                if (isset($decision['condition'])) {
                    switch ($decision['condition']) {
                        case 'Depression Screening':
                            if ($decision['severity'] !== 'minimal' && $decision['severity'] !== 'mild') {
                                $pathway['mental_health_referral'] = true;
                            }
                            if ($decision['severity'] === 'severe' || $decision['suicide_risk']) {
                                $pathway['specialist_referral'] = true;
                                $pathway['care_management'] = true;
                            }
                            break;
                        case 'Anxiety Screening':
                            if ($decision['severity'] === 'severe' || $decision['severity'] === 'moderate') {
                                $pathway['mental_health_referral'] = true;
                            }
                            break;
                    }
                }
            }
        }
        
        // Risk-based pathway adjustments
        switch ($riskLevel) {
            case 'critical':
                $pathway['emergency_intervention'] = true;
                $pathway['care_management'] = true;
                $pathway['specialist_referral'] = true;
                break;
            case 'high':
                $pathway['mental_health_referral'] = true;
                $pathway['care_management'] = true;
                break;
            case 'moderate':
                $pathway['mental_health_referral'] = true;
                break;
        }
        
        return $pathway;
    }
    
    /**
     * Get clinical priority level
     */
    protected function getClinicalPriority(float $score, string $riskLevel): string
    {
        if ($riskLevel === 'critical' || $score >= 80) {
            return 'immediate';
        } elseif ($riskLevel === 'high' || $score >= 60) {
            return 'urgent';
        } elseif ($riskLevel === 'moderate' || $score >= 40) {
            return 'routine';
        }
        return 'preventive';
    }
    
    /**
     * Get intervention timeframe based on risk level
     */
    protected function getInterventionTimeframe(string $riskLevel): string
    {
        switch ($riskLevel) {
            case 'critical': return 'immediate';
            case 'high': return '24-48 hours';
            case 'moderate': return '1-2 weeks';
            case 'low': return '1 month';
            default: return '3 months';
        }
    }

    /**
     * Award points for progressive screening completion
     */
    protected function awardProgressivePoints($beneficiary, string $layer, string $riskLevel): void
    {
        // Base points by layer
        $layerPoints = [
            'triage' => 50,
            'targeted' => 100,
            'specialized' => 200
        ];

        $points = $layerPoints[$layer] ?? 50;

        // Bonus for honest disclosure (higher risk gets bonus for honesty)
        if ($riskLevel === 'high' || $riskLevel === 'critical') {
            $points += 25; // Bonus for honest disclosure of serious issues
        }

        event(new \App\Events\PointsEarned(
            $beneficiary,
            $points,
            "progressive_health_screening_{$layer}"
        ));

        // Award badges based on completion and risk level
        if ($riskLevel === 'low') {
            event(new \App\Events\BadgeEarned(
                $beneficiary,
                'wellness_champion'
            ));
        } elseif ($riskLevel === 'moderate' || $riskLevel === 'high') {
            event(new \App\Events\BadgeEarned(
                $beneficiary,
                'health_awareness'
            ));
        }

        // Award layer-specific badges
        if ($layer === 'specialized') {
            event(new \App\Events\BadgeEarned(
                $beneficiary,
                'thorough_health_reporter'
            ));
        }
    }

    /**
     * Award points for dual pathway assessment completion
     */
    protected function awardDualPathwayPoints($beneficiary, string $pathway, string $riskLevel, float $engagementScore): void
    {
        // Base points by pathway
        $pathwayPoints = [
            'enhanced' => 150,
            'clinical' => 200,
            'hybrid' => 175,
            'immersive' => 250
        ];

        $points = $pathwayPoints[$pathway] ?? 150;

        // Engagement bonus
        if ($engagementScore > 90) {
            $points += 50;
        } elseif ($engagementScore > 70) {
            $points += 25;
        }

        // Honesty bonus for risk disclosure
        if ($riskLevel === 'high' || $riskLevel === 'critical') {
            $points += 50;
        }

        event(new \App\Events\PointsEarned(
            $beneficiary,
            $points,
            "dual_pathway_assessment_{$pathway}"
        ));

        // Award pathway-specific badges
        $pathwayBadges = [
            'enhanced' => 'wellness_journey_complete',
            'clinical' => 'clinical_assessment_complete',
            'hybrid' => 'adaptive_health_pioneer',
            'immersive' => 'immersive_experience_champion'
        ];

        if (isset($pathwayBadges[$pathway])) {
            event(new \App\Events\BadgeEarned(
                $beneficiary,
                $pathwayBadges[$pathway]
            ));
        }

        // High engagement badge
        if ($engagementScore > 90) {
            event(new \App\Events\BadgeEarned(
                $beneficiary,
                'engaged_participant'
            ));
        }
    }

    /**
     * Store user pathway experience for future optimization
     */
    protected function storePathwayExperience($beneficiary, array $data): void
    {
        // Store experience data for ML optimization
        DB::table('pathway_experiences')->insert([
            'beneficiary_id' => $beneficiary->id,
            'pathway' => $data['pathway_taken'],
            'engagement_score' => $data['engagement_score'],
            'completion_rate' => $data['completion_rate'],
            'fraud_score' => $data['fraud_analysis']['overallScore'] ?? 0,
            'risk_level' => $data['risk_level'],
            'user_satisfaction' => $data['user_experience']['satisfactionScore'] ?? 0,
            'created_at' => now()
        ]);
    }

    /**
     * Calculate next assessment date based on risk level
     */
    protected function calculateNextAssessmentDate(string $riskLevel): string
    {
        $daysUntilNext = [
            'critical' => 7,
            'high' => 30,
            'moderate' => 60,
            'low' => 90
        ];

        $days = $daysUntilNext[$riskLevel] ?? 90;
        
        return now()->addDays($days)->toDateString();
    }

    /**
     * Safely get the first key of an array
     */
    private function getSafeFirstKey($array): ?string
    {
        if (!is_array($array) || empty($array)) {
            return null;
        }
        return array_key_first($array);
    }

    /**
     * Calculate risk level based on total score
     */
    private function calculateRiskLevel(float $score): string
    {
        if ($score >= 80) return 'critical';
        if ($score >= 60) return 'high';
        if ($score >= 40) return 'moderate';
        return 'low';
    }

    /**
     * Submit unified health assessment results
     */
    public function submitUnified(Request $request): JsonResponse
    {
        // Enhanced validation with proper data structure checks
        $validator = Validator::make($request->all(), [
            'responses' => 'required|array|min:1',
            'risk_scores' => 'nullable|array',
            'completed_domains' => 'nullable|array',
            'total_risk_score' => 'nullable|numeric|min:0|max:100',
            'risk_level' => 'nullable|string|in:low,moderate,high,critical',
            'recommendations' => 'nullable|array',
            'next_steps' => 'nullable|array',
            'fraud_detection_score' => 'nullable|numeric|min:0|max:1',
            'timestamp' => 'nullable|string'
        ]);

        // Additional validation for data integrity
        $validator->after(function ($validator) use ($request) {
            // Validate responses structure
            if (!is_array($request->responses) || empty($request->responses)) {
                $validator->errors()->add('responses', 'Responses must be a non-empty array.');
            }

            // Validate completed_domains if provided
            if ($request->has('completed_domains') && !is_null($request->completed_domains) && !is_array($request->completed_domains)) {
                $validator->errors()->add('completed_domains', 'Completed domains must be an array.');
            }

            // Validate risk_level consistency
            if ($request->has('total_risk_score') && $request->has('risk_level')) {
                $score = $request->total_risk_score;
                $level = $request->risk_level;
                
                if ($score !== null && $level !== null) {
                    $expectedLevel = $this->calculateRiskLevel($score);
                    if ($expectedLevel !== $level) {
                        $validator->errors()->add('risk_level', 'Risk level does not match the total risk score.');
                    }
                }
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $user = Auth::user();
            $beneficiary = $user->beneficiary;
            
            // FIX: Handle cases where beneficiary doesn't exist
            if (!$beneficiary) {
                // Create beneficiary record if it doesn't exist
                $beneficiary = \App\Models\Beneficiary::create([
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'cpf' => $user->cpf,
                    'date_of_birth' => $user->birth_date,
                    'gender' => $user->gender ?? 'not_specified',
                    'phone' => $user->phone,
                    'address' => $user->address ?? '',
                    'city' => $user->city ?? '',
                    'state' => $user->state ?? '',
                    'zip_code' => $user->zip_code ?? '',
                    'marital_status' => 'single',
                    'dependents' => 0,
                    'monthly_income' => 0,
                    'has_health_insurance' => false,
                    'employment_status' => 'employed',
                    'occupation' => '',
                    'emergency_contact_name' => '',
                    'emergency_contact_phone' => '',
                    'emergency_contact_relationship' => '',
                    'medical_history' => [],
                    'current_medications' => [],
                    'allergies' => [],
                    'family_medical_history' => []
                ]);
            }

            // Create health questionnaire record
            $questionnaire = HealthQuestionnaire::create([
                'beneficiary_id' => $beneficiary->id,
                'template_id' => null, // Unified assessment doesn't use traditional templates
                'questionnaire_type' => 'unified',
                'status' => 'completed',
                'responses' => $request->responses,
                'current_section' => 'completed',
                'started_at' => now()->subMinutes(10), // Estimated duration
                'completed_at' => now(),
                'risk_scores' => $request->risk_scores,
                'recommendations' => $request->recommendations,
                'ai_insights' => [
                    'total_risk_score' => $request->total_risk_score,
                    'risk_level' => $request->risk_level,
                    'next_steps' => $request->next_steps,
                    'fraud_detection_score' => $request->fraud_detection_score,
                    'completed_domains' => $request->completed_domains
                ],
                'metadata' => [
                    'type' => 'unified_assessment',
                    'user_agent' => $request->userAgent(),
                    'ip_address' => $request->ip(),
                    'request_id' => RequestHelper::generateRequestId($request),
                    'tracking_id' => RequestHelper::generateTrackingId(),
                    'timestamp' => $request->timestamp
                ]
            ]);

            // Award points based on domains completed and risk level
            $basePoints = 150;
            $completedDomains = $request->completed_domains ?? [];
            $domainBonus = is_array($completedDomains) ? count($completedDomains) * 25 : 0;
            $riskLevel = $request->risk_level ?? 'low';
            $honestyBonus = $riskLevel !== 'low' ? 50 : 0;
            
            $totalPoints = $basePoints + $domainBonus + $honestyBonus;

            event(new \App\Events\PointsEarned(
                $beneficiary,
                $totalPoints,
                'unified_health_assessment_complete'
            ));

            // Award badges based on risk assessment and domains
            if ($riskLevel === 'low') {
                event(new \App\Events\BadgeEarned($beneficiary, 'wellness_champion'));
            } elseif ($riskLevel === 'moderate') {
                event(new \App\Events\BadgeEarned($beneficiary, 'health_awareness'));
            } else {
                event(new \App\Events\BadgeEarned($beneficiary, 'health_advocate'));
            }

            // Domain-specific badges
            if (is_array($completedDomains)) {
                if (in_array('mental_health', $completedDomains)) {
                    event(new \App\Events\BadgeEarned($beneficiary, 'mental_wellness_champion'));
                }
                if (in_array('lifestyle', $completedDomains)) {
                    event(new \App\Events\BadgeEarned($beneficiary, 'lifestyle_conscious'));
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Unified health assessment submitted successfully',
                'data' => [
                    'questionnaire_id' => $questionnaire->id,
                    'risk_level' => $request->risk_level,
                    'recommendations' => $request->recommendations,
                    'next_steps' => $request->next_steps
                ]
            ]);

        } catch (\InvalidArgumentException $e) {
            DB::rollback();
            Log::error('Invalid data in health questionnaire submission', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Invalid data provided',
                'error' => 'Please check your input data and try again'
            ], 400);
        } catch (\TypeError $e) {
            DB::rollback();
            Log::error('Type error in health questionnaire submission', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Data type error occurred',
                'error' => 'Invalid data format provided'
            ], 400);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Failed to submit unified health assessment', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit unified health assessment',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Check if a section is complete
     * OPTIMIZED: Uses eager loaded template and efficient array checking
     */
    protected function isSectionComplete(HealthQuestionnaire $questionnaire, string $section): bool
    {
        // Template should already be eager loaded
        $template = $questionnaire->template;
        $sectionQuestions = $template->sections[$section]['questions'] ?? [];
        $responses = $questionnaire->responses ?? [];

        if (empty($sectionQuestions)) {
            return true; // No questions means section is complete
        }

        // Optimize by getting response keys once
        $responseKeys = array_keys($responses);

        foreach ($sectionQuestions as $question) {
            $questionId = $question['id'] ?? $question['key'] ?? null;
            if (!$questionId || !in_array($questionId, $responseKeys, true)) {
                return false;
            }
        }

        return true;
    }
    
    /**
     * Validate medical scores for clinical accuracy
     */
    protected function validateMedicalScores($validator, array $scores): void
    {
        // Validate PHQ-9 scores if present
        if (isset($scores['phq9_total']) && ($scores['phq9_total'] < 0 || $scores['phq9_total'] > 27)) {
            $validator->errors()->add('scores.phq9_total', 'PHQ-9 total score must be between 0 and 27');
        }
        
        // Validate individual PHQ-9 items
        for ($i = 1; $i <= 9; $i++) {
            $key = "phq9_{$i}";
            if (isset($scores[$key]) && ($scores[$key] < 0 || $scores[$key] > 3)) {
                $validator->errors()->add("scores.{$key}", "PHQ-9 item {$i} must be between 0 and 3");
            }
        }
        
        // Validate GAD-7 scores if present
        if (isset($scores['gad7_total']) && ($scores['gad7_total'] < 0 || $scores['gad7_total'] > 21)) {
            $validator->errors()->add('scores.gad7_total', 'GAD-7 total score must be between 0 and 21');
        }
        
        // Validate individual GAD-7 items
        for ($i = 1; $i <= 7; $i++) {
            $key = "gad7_{$i}";
            if (isset($scores[$key]) && ($scores[$key] < 0 || $scores[$key] > 3)) {
                $validator->errors()->add("scores.{$key}", "GAD-7 item {$i} must be between 0 and 3");
            }
        }
        
        // Validate PHQ-2 scores
        if (isset($scores['phq2']) && ($scores['phq2'] < 0 || $scores['phq2'] > 6)) {
            $validator->errors()->add('scores.phq2', 'PHQ-2 score must be between 0 and 6');
        }
        
        // Validate GAD-2 scores
        if (isset($scores['gad2']) && ($scores['gad2'] < 0 || $scores['gad2'] > 6)) {
            $validator->errors()->add('scores.gad2', 'GAD-2 score must be between 0 and 6');
        }
        
        // Validate WHO-5 scores
        if (isset($scores['who5']) && ($scores['who5'] < 0 || $scores['who5'] > 100)) {
            $validator->errors()->add('scores.who5', 'WHO-5 score must be between 0 and 100');
        }
        
        // Validate pain scores
        if (isset($scores['pain_severity']) && ($scores['pain_severity'] < 0 || $scores['pain_severity'] > 10)) {
            $validator->errors()->add('scores.pain_severity', 'Pain severity must be between 0 and 10');
        }
        
        if (isset($scores['pain_interference']) && ($scores['pain_interference'] < 0 || $scores['pain_interference'] > 10)) {
            $validator->errors()->add('scores.pain_interference', 'Pain interference must be between 0 and 10');
        }
        
        // Validate AUDIT-C scores
        foreach (['alcohol_frequency', 'alcohol_quantity', 'alcohol_binge'] as $auditField) {
            if (isset($scores[$auditField]) && ($scores[$auditField] < 0 || $scores[$auditField] > 4)) {
                $validator->errors()->add("scores.{$auditField}", ucfirst(str_replace('_', ' ', $auditField)) . ' must be between 0 and 4');
            }
        }
    }
    
    /**
     * Validate consistency between responses and scores
     */
    protected function validateResponseConsistency($validator, array $responses, array $scores): void
    {
        // Check PHQ-9 consistency
        $phq9Items = ['phq9_1', 'phq9_2', 'phq9_3', 'phq9_4', 'phq9_5', 'phq9_6', 'phq9_7', 'phq9_8', 'phq9_9'];
        $phq9Sum = 0;
        $phq9Count = 0;
        
        foreach ($phq9Items as $item) {
            if (isset($scores[$item])) {
                $phq9Sum += (int) $scores[$item];
                $phq9Count++;
            }
        }
        
        // If we have both individual items and total, check consistency
        if ($phq9Count > 0 && isset($scores['phq9_total']) && $phq9Sum !== (int) $scores['phq9_total']) {
            $validator->errors()->add('scores.phq9_total', 'PHQ-9 total score does not match sum of individual items');
        }
        
        // Check GAD-7 consistency
        $gad7Items = ['gad7_1', 'gad7_2', 'gad7_3', 'gad7_4', 'gad7_5', 'gad7_6', 'gad7_7'];
        $gad7Sum = 0;
        $gad7Count = 0;
        
        foreach ($gad7Items as $item) {
            if (isset($scores[$item])) {
                $gad7Sum += (int) $scores[$item];
                $gad7Count++;
            }
        }
        
        // If we have both individual items and total, check consistency
        if ($gad7Count > 0 && isset($scores['gad7_total']) && $gad7Sum !== (int) $scores['gad7_total']) {
            $validator->errors()->add('scores.gad7_total', 'GAD-7 total score does not match sum of individual items');
        }
        
        // Flag for suspicious patterns (e.g., all maximum scores)
        $maxScores = 0;
        $totalScores = 0;
        
        foreach ($scores as $key => $score) {
            if (is_numeric($score)) {
                $totalScores++;
                
                // Check for maximum scores in depression/anxiety items
                if ((strpos($key, 'phq') === 0 || strpos($key, 'gad') === 0) && (int) $score === 3) {
                    $maxScores++;
                }
            }
        }
        
        // If more than 80% of mental health scores are maximum, flag as suspicious
        if ($totalScores > 0 && ($maxScores / $totalScores) > 0.8) {
            Log::warning('Potentially suspicious questionnaire response pattern detected', [
                'user_id' => Auth::id(),
                'max_scores_percentage' => ($maxScores / $totalScores) * 100,
                'timestamp' => now()
            ]);
        }
    }
    
    /**
     * Create a test method to verify scoring algorithms
     */
    public function testScoring(Request $request): JsonResponse
    {
        // Only available in development/testing environments
        if (!config('app.debug')) {
            return response()->json(['error' => 'Not available in production'], 403);
        }
        
        // Sample test data for PHQ-9 and GAD-7
        $testScores = [
            'phq9_1' => 2, 'phq9_2' => 2, 'phq9_3' => 1, 'phq9_4' => 3, 'phq9_5' => 1,
            'phq9_6' => 2, 'phq9_7' => 1, 'phq9_8' => 2, 'phq9_9' => 0, // PHQ-9 = 14 (moderately severe)
            'gad7_1' => 2, 'gad7_2' => 1, 'gad7_3' => 2, 'gad7_4' => 1,
            'gad7_5' => 1, 'gad7_6' => 0, 'gad7_7' => 1, // GAD-7 = 8 (mild anxiety)
            'who5' => 40, // Poor well-being
            'pain_severity' => 6, 'pain_interference' => 4, // Moderate pain
            'alcohol_frequency' => 2, 'alcohol_quantity' => 1, 'alcohol_binge' => 0 // AUDIT-C = 3
        ];
        
        $progressiveScore = $this->calculateEvidenceBasedScore($testScores);
        $phq9Score = $this->calculatePHQ9Score($testScores);
        $gad7Score = $this->calculateGAD7Score($testScores);
        
        return response()->json([
            'success' => true,
            'test_data' => $testScores,
            'results' => [
                'progressive_score' => $progressiveScore,
                'phq9_analysis' => $phq9Score,
                'gad7_analysis' => $gad7Score,
                'expected_phq9_total' => 14,
                'expected_gad7_total' => 8,
                'scoring_validation' => [
                    'phq9_correct' => $phq9Score['total_score'] === 14,
                    'gad7_correct' => $gad7Score['total_score'] === 8,
                    'phq9_severity' => $phq9Score['severity'] === 'moderately_severe',
                    'gad7_severity' => $gad7Score['severity'] === 'mild'
                ]
            ]
        ]);
    }
}