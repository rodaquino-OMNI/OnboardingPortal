<?php

namespace App\Listeners;

use App\Events\UserAction;
use App\Services\GamificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class AwardPoints implements ShouldQueue
{
    use InteractsWithQueue;

    protected GamificationService $gamificationService;

    /**
     * Create the event listener.
     */
    public function __construct(GamificationService $gamificationService)
    {
        $this->gamificationService = $gamificationService;
    }

    /**
     * Handle the event.
     */
    public function handle(UserAction $event): void
    {
        try {
            // Map user actions to gamification actions
            $pointActions = $this->mapActionToPoints($event->action);
            
            if (empty($pointActions)) {
                return;
            }
            
            foreach ($pointActions as $pointAction => $metadata) {
                $points = $this->gamificationService->awardPoints(
                    $event->beneficiary,
                    $pointAction,
                    array_merge($event->metadata, $metadata)
                );
                
                if ($points > 0) {
                    Log::info('Points awarded from event', [
                        'beneficiary_id' => $event->beneficiary->id,
                        'event_action' => $event->action,
                        'point_action' => $pointAction,
                        'points' => $points,
                    ]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Error awarding points', [
                'beneficiary_id' => $event->beneficiary->id,
                'action' => $event->action,
                'error' => $e->getMessage(),
            ]);
            
            // Rethrow to retry the job
            throw $e;
        }
    }

    /**
     * Map user actions to point-awarding actions.
     */
    protected function mapActionToPoints(string $action): array
    {
        $mapping = [
            'registered' => ['registration' => []],
            'profile_field_updated' => ['profile_field' => []],
            'profile_completed' => ['profile_completed' => []],
            'health_question_answered' => ['health_question' => []],
            'health_assessment_completed' => ['health_assessment' => []],
            'document_uploaded' => ['document_upload' => []],
            'interview_scheduled' => ['interview' => ['is_completed' => false]],
            'interview_completed' => ['interview' => ['is_completed' => true]],
            'onboarding_completed' => ['onboarding_completed' => []],
            'daily_login' => ['daily_login' => []],
            'form_submitted_perfectly' => ['perfect_form' => []],
            'task_completed' => ['task_completed' => []],
        ];
        
        return $mapping[$action] ?? [];
    }

    /**
     * Determine whether the listener should be queued.
     */
    public function shouldQueue(UserAction $event): bool
    {
        // Only queue for actions that award points
        return !empty($this->mapActionToPoints($event->action));
    }
}