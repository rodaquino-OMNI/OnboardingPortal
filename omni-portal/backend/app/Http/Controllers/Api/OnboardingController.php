<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * OnboardingController - Onboarding flow endpoints per API_SPEC.yaml
 *
 * Endpoints:
 * - GET /onboarding/steps - Get all onboarding steps with completion status
 * - GET /onboarding/progress - Get current progress and next steps
 *
 * @see docs/API_SPEC.yaml - Full contract specification
 */
class OnboardingController extends Controller
{
    /**
     * Get onboarding steps
     *
     * GET /onboarding/steps
     */
    public function getSteps(Request $request): JsonResponse
    {
        $user = $request->user();

        // TODO: Implement step tracking logic
        // For now, return stub response with all steps

        $steps = [
            ['id' => 1, 'name' => 'registration', 'label' => 'Registro', 'completed' => (bool) $user->email_verified_at],
            ['id' => 2, 'name' => 'profile', 'label' => 'Perfil', 'completed' => false],
            ['id' => 3, 'name' => 'health_questionnaire', 'label' => 'Questionário de Saúde', 'completed' => false],
            ['id' => 4, 'name' => 'document_upload', 'label' => 'Upload de Documentos', 'completed' => false],
            ['id' => 5, 'name' => 'interview', 'label' => 'Entrevista', 'completed' => false],
        ];

        $completedCount = collect($steps)->where('completed', true)->count();
        $completionPercentage = ($completedCount / count($steps)) * 100;

        return response()->json([
            'steps' => $steps,
            'current_step' => $completedCount + 1,
            'completion_percentage' => $completionPercentage,
        ]);
    }

    /**
     * Get onboarding progress
     *
     * GET /onboarding/progress
     */
    public function getProgress(Request $request): JsonResponse
    {
        $user = $request->user();

        // TODO: Implement progress calculation logic
        // For now, return stub response

        $completedSteps = [];
        $nextStep = 'profile';
        $estimatedTimeRemaining = 300; // 5 minutes

        if ($user->email_verified_at) {
            $completedSteps[] = 'registration';
            $nextStep = 'profile';
        }

        return response()->json([
            'completion_percentage' => (count($completedSteps) / 5) * 100,
            'completed_steps' => $completedSteps,
            'next_step' => $nextStep,
            'estimated_time_remaining' => $estimatedTimeRemaining,
        ]);
    }
}
