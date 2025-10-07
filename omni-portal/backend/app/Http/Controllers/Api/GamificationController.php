<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Gamification\Services\PointsEngine;
use App\Services\AnalyticsEventRepository;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

/**
 * GamificationController - Gamification endpoints per API_SPEC.yaml
 *
 * Endpoints:
 * - POST /gamification/points/earn - Award points (internal use)
 * - GET /gamification/levels/current - Get current level
 * - GET /gamification/badges - Get user badges
 * - GET /gamification/progress - Get gamification progress
 *
 * @see docs/API_SPEC.yaml - Full contract specification
 * @see docs/GAMIFICATION_SPEC.md - Point values and mechanics
 */
class GamificationController extends Controller
{
    public function __construct(
        private readonly PointsEngine $pointsEngine,
        private readonly AnalyticsEventRepository $analyticsRepository
    ) {}

    /**
     * Award points to user
     *
     * POST /gamification/points/earn
     *
     * Note: This is typically called internally by other services
     */
    public function earnPoints(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'action_type' => ['required', 'in:registration_complete,profile_complete,health_question_answered,document_uploaded,document_approved,interview_scheduled,interview_attended,onboarding_complete'],
            'points' => ['required', 'integer', 'min:1', 'max:500'],
            'bonus_type' => ['nullable', 'in:early_completion,thoroughness,punctuality,zero_errors'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();

        // Map action_type to PointsEngine action format
        $action = str_replace('_complete', '', $request->action_type);

        $awarded = $this->pointsEngine->awardPoints($user, $action, [
            'bonus_type' => $request->bonus_type,
        ]);

        if (!$awarded) {
            return response()->json([
                'message' => 'Pontos já foram concedidos para esta ação',
            ], 200);
        }

        $user->refresh();

        // Track analytics event - persistence with PII detection
        try {
            $this->analyticsRepository->track(
                'gamification.points_earned',
                [
                    'points' => $request->points,
                    'action_type' => $request->action_type,
                    'bonus_type' => $request->bonus_type,
                    'multiplier' => 1.0, // TODO: Get from PointsEngine
                ],
                [
                    'endpoint' => 'POST /gamification/points/earn',
                    'user_role' => $user->role ?? 'beneficiary',
                ],
                $user->id,
                $user->company_id ?? null
            );
        } catch (\Exception $e) {
            // Analytics persistence errors should not block the response
            \Log::warning('Failed to track analytics event', [
                'event' => 'gamification.points_earned',
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'points_earned' => $request->points,
            'total_points' => $user->points_balance,
            'level_up' => false, // TODO: Detect level up from events
            'new_level' => $this->getLevelName($user->current_level),
        ]);
    }

    /**
     * Get current level
     *
     * GET /gamification/levels/current
     */
    public function getCurrentLevel(Request $request): JsonResponse
    {
        $user = $request->user();

        $levelThresholds = [
            1 => 0,
            2 => 500,
            3 => 1500,
            4 => 3000,
            5 => 5000,
        ];

        $currentLevel = $user->current_level;
        $nextLevel = $currentLevel < 5 ? $currentLevel + 1 : null;
        $pointsToNextLevel = $nextLevel ? $levelThresholds[$nextLevel] - $user->points_balance : 0;

        return response()->json([
            'current_level' => $this->getLevelName($currentLevel),
            'total_points' => $user->points_balance,
            'next_level' => $nextLevel ? $this->getLevelName($nextLevel) : null,
            'points_to_next_level' => max(0, $pointsToNextLevel),
            'benefits' => $this->getLevelBenefits($currentLevel),
        ]);
    }

    /**
     * Get user badges
     *
     * GET /gamification/badges
     */
    public function getBadges(Request $request): JsonResponse
    {
        $user = $request->user();

        // TODO: Query badges from database
        // For now, return stub response

        return response()->json([
            'unlocked' => [
                ['id' => 1, 'name' => 'first_steps', 'icon' => '🎯', 'unlocked_at' => $user->email_verified_at],
            ],
            'locked' => [
                ['id' => 2, 'name' => 'health_champion', 'icon' => '❤️', 'requirement' => 'Complete health questionnaire'],
                ['id' => 3, 'name' => 'document_master', 'icon' => '📄', 'requirement' => 'Upload 5 documents'],
            ],
        ]);
    }

    /**
     * Get gamification progress
     *
     * GET /gamification/progress
     */
    public function getProgress(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'points_balance' => $user->points_balance,
            'current_level' => $user->current_level,
            'level_name' => $this->getLevelName($user->current_level),
            'streak_days' => $user->streak_days ?? 0,
            'badges_count' => 1, // Stub
            'next_milestone' => 'Alcance 500 pontos para Bronze',
        ]);
    }

    /**
     * Get level name in Portuguese
     */
    private function getLevelName(int $level): string
    {
        return match($level) {
            1 => 'iniciante',
            2 => 'bronze',
            3 => 'prata',
            4 => 'ouro',
            5 => 'platina',
            default => 'desconhecido',
        };
    }

    /**
     * Get level benefits
     */
    private function getLevelBenefits(int $level): array
    {
        return match($level) {
            1 => ['Acesso básico'],
            2 => ['Suporte prioritário', 'Processamento mais rápido'],
            3 => ['Suporte prioritário 24h', 'Processamento expresso', 'Descontos exclusivos'],
            4 => ['Gerente de conta dedicado', 'Atendimento VIP', 'Eventos exclusivos'],
            5 => ['Todos os benefícios Ouro', 'Acesso antecipado a novos recursos', 'Consultoria personalizada'],
            default => [],
        };
    }
}
