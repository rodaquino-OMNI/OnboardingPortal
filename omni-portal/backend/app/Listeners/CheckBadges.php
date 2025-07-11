<?php

namespace App\Listeners;

use App\Events\UserAction;
use App\Services\GamificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class CheckBadges implements ShouldQueue
{
    use InteractsWithQueue;

    protected GamificationService $gamificationService;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public int $backoff = 10;

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
            // Check for specific badges based on the action
            $badgesToCheck = $this->getBadgesToCheck($event->action);
            
            // Always check all badges on certain actions
            if ($this->shouldCheckAllBadges($event->action)) {
                $awardedBadges = $this->gamificationService->checkAndAwardBadges($event->beneficiary);
                
                if (!empty($awardedBadges)) {
                    Log::info('Badges awarded from comprehensive check', [
                        'beneficiary_id' => $event->beneficiary->id,
                        'action' => $event->action,
                        'badges_count' => count($awardedBadges),
                        'badge_ids' => collect($awardedBadges)->pluck('id')->toArray(),
                    ]);
                }
            } else {
                // Check specific badges
                foreach ($badgesToCheck as $badgeSlug) {
                    $this->gamificationService->checkSpecificBadges($event->beneficiary, $badgeSlug);
                }
            }
        } catch (\Exception $e) {
            Log::error('Error checking badges', [
                'beneficiary_id' => $event->beneficiary->id,
                'action' => $event->action,
                'error' => $e->getMessage(),
            ]);
            
            // Rethrow to retry the job
            throw $e;
        }
    }

    /**
     * Get specific badges to check based on action.
     */
    protected function getBadgesToCheck(string $action): array
    {
        $mapping = [
            'registered' => ['welcome', 'first-steps'],
            'profile_completed' => ['perfectionist', 'profile-master'],
            'onboarding_completed' => ['fast-finisher', 'onboarding-hero'],
            'health_assessment_completed' => ['health-conscious', 'wellness-warrior'],
            'document_uploaded' => ['document-master'],
            'interview_completed' => ['interview-ace'],
            'daily_login' => ['early-bird', 'consistent-user'],
            'level_up' => ['level-achiever'],
        ];
        
        return $mapping[$action] ?? [];
    }

    /**
     * Determine if all badges should be checked.
     */
    protected function shouldCheckAllBadges(string $action): bool
    {
        $comprehensiveCheckActions = [
            'onboarding_completed',
            'level_up',
            'milestone_reached',
        ];
        
        return in_array($action, $comprehensiveCheckActions);
    }

    /**
     * Determine whether the listener should be queued.
     */
    public function shouldQueue(UserAction $event): bool
    {
        // Always queue badge checks to avoid blocking
        return true;
    }

    /**
     * Handle a job failure.
     */
    public function failed(UserAction $event, \Throwable $exception): void
    {
        Log::error('Badge check job failed', [
            'beneficiary_id' => $event->beneficiary->id,
            'action' => $event->action,
            'error' => $exception->getMessage(),
        ]);
    }
}