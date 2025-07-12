<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HealthQuestionnaire;
use App\Models\QuestionnaireTemplate;
use App\Services\HealthAIService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class HealthQuestionnaireController extends Controller
{
    protected $healthAIService;

    public function __construct(HealthAIService $healthAIService)
    {
        $this->middleware('auth:sanctum');
        $this->healthAIService = $healthAIService;
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

        $beneficiary = Auth::user()->beneficiary;
        
        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Beneficiary profile not found'
            ], 404);
        }

        // Check if questionnaire already exists
        $existingQuestionnaire = HealthQuestionnaire::where('beneficiary_id', $beneficiary->id)
            ->where('template_id', $request->template_id)
            ->where('completed_at', null)
            ->first();

        if ($existingQuestionnaire) {
            return response()->json([
                'success' => true,
                'data' => $existingQuestionnaire,
                'message' => 'Questionnaire already started'
            ]);
        }

        $questionnaire = HealthQuestionnaire::create([
            'beneficiary_id' => $beneficiary->id,
            'template_id' => $request->template_id,
            'responses' => [],
            'score' => 0,
            'risk_level' => 'unknown'
        ]);

        return response()->json([
            'success' => true,
            'data' => $questionnaire->load('template'),
            'message' => 'Health questionnaire started successfully'
        ]);
    }

    /**
     * Save questionnaire responses
     */
    public function saveResponses(Request $request, $questionnaireId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'responses' => 'required|array',
            'section_id' => 'required|string',
            'is_complete' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $questionnaire = HealthQuestionnaire::where('id', $questionnaireId)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
            ->first();

        if (!$questionnaire) {
            return response()->json([
                'success' => false,
                'message' => 'Questionnaire not found'
            ], 404);
        }

        DB::transaction(function () use ($questionnaire, $request) {
            // Merge new responses with existing ones
            $currentResponses = $questionnaire->responses ?? [];
            $newResponses = array_merge($currentResponses, $request->responses);
            
            $questionnaire->update([
                'responses' => $newResponses
            ]);

            // If questionnaire is complete, calculate score and risk
            if ($request->is_complete) {
                $this->completeQuestionnaire($questionnaire);
            }

            // Award gamification points
            $this->awardCompletionPoints($questionnaire, $request->section_id);
        });

        return response()->json([
            'success' => true,
            'data' => $questionnaire->fresh(),
            'message' => 'Responses saved successfully'
        ]);
    }

    /**
     * Get AI-powered health insights
     */
    public function getAIInsights(Request $request, $questionnaireId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'question' => 'required|string|max:500',
            'context' => 'array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $questionnaire = HealthQuestionnaire::where('id', $questionnaireId)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
            ->first();

        if (!$questionnaire) {
            return response()->json([
                'success' => false,
                'message' => 'Questionnaire not found'
            ], 404);
        }

        try {
            $aiResponse = $this->healthAIService->analyzeHealthQuery(
                $request->question,
                $questionnaire->responses ?? [],
                $request->context ?? []
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'response' => $aiResponse['response'],
                    'confidence' => $aiResponse['confidence'],
                    'follow_up_questions' => $aiResponse['follow_up_questions'] ?? [],
                    'detected_conditions' => $aiResponse['detected_conditions'] ?? [],
                    'recommendations' => $aiResponse['recommendations'] ?? []
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'AI service temporarily unavailable',
                'error' => $e->getMessage()
            ], 503);
        }
    }

    /**
     * Get questionnaire progress
     */
    public function getProgress($questionnaireId): JsonResponse
    {
        $questionnaire = HealthQuestionnaire::where('id', $questionnaireId)
            ->where('beneficiary_id', Auth::user()->beneficiary->id)
            ->with('template')
            ->first();

        if (!$questionnaire) {
            return response()->json([
                'success' => false,
                'message' => 'Questionnaire not found'
            ], 404);
        }

        $template = $questionnaire->template;
        $sections = $template->sections ?? [];
        $responses = $questionnaire->responses ?? [];
        
        $progress = $this->calculateProgress($sections, $responses);

        return response()->json([
            'success' => true,
            'data' => [
                'questionnaire' => $questionnaire,
                'progress' => $progress,
                'completion_percentage' => $progress['percentage'],
                'current_section' => $progress['current_section'],
                'total_sections' => count($sections)
            ]
        ]);
    }

    /**
     * Complete questionnaire and calculate final scores
     */
    protected function completeQuestionnaire(HealthQuestionnaire $questionnaire): void
    {
        $template = $questionnaire->template;
        $responses = $questionnaire->responses;

        // Calculate health score based on template rules
        $score = $this->calculateHealthScore($template, $responses);
        $riskLevel = $this->determineRiskLevel($template, $score);

        // Generate AI-powered recommendations
        $recommendations = $this->healthAIService->generateRecommendations(
            $responses,
            $score,
            $riskLevel
        );

        $questionnaire->update([
            'score' => $score,
            'risk_level' => $riskLevel,
            'recommendations' => $recommendations,
            'completed_at' => now()
        ]);

        // Award completion points
        $this->awardCompletionBonus($questionnaire);
    }

    /**
     * Calculate health score based on responses
     */
    protected function calculateHealthScore($template, $responses): float
    {
        $scoringRules = $template->scoring_rules ?? [];
        $totalScore = 0;

        foreach ($scoringRules as $questionId => $rules) {
            if (isset($responses[$questionId])) {
                $response = $responses[$questionId];
                
                if (is_array($rules)) {
                    $totalScore += $rules[$response] ?? 0;
                } elseif ($rules === 'count') {
                    $totalScore += is_array($response) ? count($response) : 1;
                }
            }
        }

        return $totalScore;
    }

    /**
     * Determine risk level based on score
     */
    protected function determineRiskLevel($template, $score): string
    {
        $riskRules = $template->risk_assessment_rules ?? [];
        
        if ($score >= ($riskRules['high_threshold'] ?? 15)) {
            return 'high';
        } elseif ($score >= ($riskRules['medium_threshold'] ?? 8)) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Calculate questionnaire progress
     */
    protected function calculateProgress($sections, $responses): array
    {
        $totalQuestions = 0;
        $answeredQuestions = 0;
        $currentSection = 0;

        foreach ($sections as $index => $section) {
            $sectionQuestions = $section['questions'] ?? [];
            $sectionAnswered = 0;

            foreach ($sectionQuestions as $question) {
                $totalQuestions++;
                
                if (isset($responses[$question['id']])) {
                    $answeredQuestions++;
                    $sectionAnswered++;
                }
            }

            // If section is not complete, mark as current
            if ($sectionAnswered < count($sectionQuestions) && $currentSection === 0) {
                $currentSection = $index;
            }
        }

        $percentage = $totalQuestions > 0 ? ($answeredQuestions / $totalQuestions) * 100 : 0;

        return [
            'percentage' => round($percentage, 2),
            'current_section' => $currentSection,
            'answered_questions' => $answeredQuestions,
            'total_questions' => $totalQuestions
        ];
    }

    /**
     * Award gamification points for section completion
     */
    protected function awardCompletionPoints($questionnaire, $sectionId): void
    {
        // Award points based on section completion
        $pointsPerSection = 50;
        
        event(new \App\Events\PointsEarned(
            $questionnaire->beneficiary,
            $pointsPerSection,
            "health_questionnaire_section_{$sectionId}"
        ));
    }

    /**
     * Award bonus points for full questionnaire completion
     */
    protected function awardCompletionBonus($questionnaire): void
    {
        $completionBonus = 200;
        
        event(new \App\Events\PointsEarned(
            $questionnaire->beneficiary,
            $completionBonus,
            'health_questionnaire_completed'
        ));

        // Check for perfect score badge
        if ($questionnaire->score <= 5) { // Low risk score
            event(new \App\Events\BadgeEarned(
                $questionnaire->beneficiary,
                'health_conscious'
            ));
        }
    }
}