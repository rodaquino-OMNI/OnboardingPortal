<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HealthQuestionnaire;
use App\Models\QuestionnaireTemplate;
use App\Services\HealthAIService;
use App\Services\ClinicalDecisionService;
use App\Services\HealthDataCoordinator;
use App\Http\Middleware\RateLimitHealthEndpoints;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class HealthQuestionnaireController extends Controller
{
    protected $healthAIService;
    protected $clinicalDecisionService;
    protected $healthDataCoordinator;

    public function __construct(
        HealthAIService $healthAIService, 
        ClinicalDecisionService $clinicalDecisionService,
        HealthDataCoordinator $healthDataCoordinator
    )
    {
        $this->middleware('auth:sanctum');
        $this->middleware(RateLimitHealthEndpoints::class);
        $this->healthAIService = $healthAIService;
        $this->clinicalDecisionService = $clinicalDecisionService;
        $this->healthDataCoordinator = $healthDataCoordinator;
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

            // Create new questionnaire instance
            $questionnaire = HealthQuestionnaire::create([
                'beneficiary_id' => $beneficiary->id,
                'template_id' => $template->id,
                'questionnaire_type' => $template->type ?? 'initial',
                'status' => 'draft', // Use valid status until enum is fixed
                'responses' => [],
                'current_section' => array_key_first($template->sections),
                'started_at' => now(),
                'metadata' => [
                    'user_agent' => $request->userAgent(),
                    'ip_address' => $request->ip(),
                    'session_id' => session()->getId()
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
        $questionnaire = HealthQuestionnaire::where('id', $questionnaireId)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
            ->firstOrFail();

        $template = $questionnaire->template;
        $totalQuestions = collect($template->sections)->sum(function ($section) {
            return count($section['questions'] ?? []);
        });

        $answeredQuestions = count($questionnaire->responses ?? []);
        $progressPercentage = $totalQuestions > 0 ? round(($answeredQuestions / $totalQuestions) * 100) : 0;

        return response()->json([
            'success' => true,
            'data' => [
                'status' => $questionnaire->status,
                'current_section' => $questionnaire->current_section,
                'progress_percentage' => $progressPercentage,
                'answered_questions' => $answeredQuestions,
                'total_questions' => $totalQuestions,
                'sections_completed' => $questionnaire->getSectionsCompleted(),
                'time_elapsed' => $questionnaire->started_at->diffInMinutes(now())
            ]
        ]);
    }

    /**
     * Save questionnaire responses
     */
    public function saveResponses($questionnaireId, Request $request): JsonResponse
    {
        $questionnaire = HealthQuestionnaire::where('id', $questionnaireId)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
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

            // Check if questionnaire is complete
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
        $questionnaire = HealthQuestionnaire::where('id', $questionnaireId)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
            ->firstOrFail();

        try {
            $insights = $this->healthAIService->analyzeResponses(
                $questionnaire->responses,
                $questionnaire->template->code
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

            $questionnaire = HealthQuestionnaire::where('id', $request->questionnaire_id)
                ->where('beneficiary_id', Auth::user()->beneficiary->id)
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

            // Award points for completion
            event(new \App\Events\PointsEarned(
                Auth::user()->beneficiary,
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
            'responses' => 'required|array',
            'scores' => 'required|array',
            'total_score' => 'required|numeric',
            'risk_level' => 'required|string|in:low,moderate,high,critical',
            'recommendations' => 'array',
            'next_steps' => 'array',
            'fraud_score' => 'required|numeric|min:0|max:100',
            'completion_time' => 'required|numeric',
            'metadata' => 'array'
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
                    'session_id' => session()->getId()
                ], $request->input('metadata', []))
            ]);

            // Calculate overall progressive score
            $progressiveScore = $this->calculateProgressiveScore($request->scores);

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
                    'gamification' => $coordinatorResult['gamification'] ?? null,
                    'clinical_alerts_scheduled' => $coordinatorResult['clinical_alerts_scheduled'] ?? false
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
                    'session_id' => session()->getId(),
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

        return round($totalScore, 2);
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
     * Submit unified health assessment results
     */
    public function submitUnified(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'responses' => 'required|array',
            'risk_scores' => 'required|array',
            'completed_domains' => 'required|array',
            'total_risk_score' => 'required|numeric',
            'risk_level' => 'required|string|in:low,moderate,high,critical',
            'recommendations' => 'array',
            'next_steps' => 'array',
            'fraud_detection_score' => 'required|numeric',
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
                    'session_id' => session()->getId(),
                    'timestamp' => $request->timestamp
                ]
            ]);

            // Award points based on domains completed and risk level
            $basePoints = 150;
            $domainBonus = count($request->completed_domains) * 25;
            $honestyBonus = $request->risk_level !== 'low' ? 50 : 0;
            
            $totalPoints = $basePoints + $domainBonus + $honestyBonus;

            event(new \App\Events\PointsEarned(
                $beneficiary,
                $totalPoints,
                'unified_health_assessment_complete'
            ));

            // Award badges based on risk assessment and domains
            if ($request->risk_level === 'low') {
                event(new \App\Events\BadgeEarned($beneficiary, 'wellness_champion'));
            } elseif ($request->risk_level === 'moderate') {
                event(new \App\Events\BadgeEarned($beneficiary, 'health_awareness'));
            } else {
                event(new \App\Events\BadgeEarned($beneficiary, 'health_advocate'));
            }

            // Domain-specific badges
            if (in_array('mental_health', $request->completed_domains)) {
                event(new \App\Events\BadgeEarned($beneficiary, 'mental_wellness_champion'));
            }
            if (in_array('lifestyle', $request->completed_domains)) {
                event(new \App\Events\BadgeEarned($beneficiary, 'lifestyle_conscious'));
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

        } catch (\Exception $e) {
            DB::rollback();
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit unified health assessment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if a section is complete
     */
    protected function isSectionComplete(HealthQuestionnaire $questionnaire, string $section): bool
    {
        $template = $questionnaire->template;
        $sectionQuestions = $template->sections[$section]['questions'] ?? [];
        $responses = $questionnaire->responses ?? [];

        foreach ($sectionQuestions as $question) {
            if (!isset($responses[$question['id']])) {
                return false;
            }
        }

        return true;
    }
}