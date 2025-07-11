<?php

namespace App\Listeners;

use App\Events\UserAction;
use App\Models\GamificationLevel;
use App\Notifications\LevelUpNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class CheckLevelUp implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Handle the event.
     */
    public function handle(UserAction $event): void
    {
        // Only process if this is a points-related action
        if (!$this->isPointsRelatedAction($event->action)) {
            return;
        }
        
        try {
            $beneficiary = $event->beneficiary;
            $progress = $beneficiary->getOrCreateGamificationProgress();
            
            // Check if ready for level up
            $nextLevel = $progress->checkLevelUp();
            
            if ($nextLevel) {
                // Level up the user
                $oldLevel = $progress->current_level;
                $progress->levelUp($nextLevel);
                
                // Dispatch level up event (which will trigger notifications)
                event(new UserAction($beneficiary, 'level_up', [
                    'old_level' => $oldLevel,
                    'new_level' => $nextLevel->level_number,
                    'level_name' => $nextLevel->name,
                    'level_title' => $nextLevel->title,
                    'rewards' => $nextLevel->rewards,
                    'unlocked_features' => $nextLevel->unlocked_features,
                ]));
                
                // Send notification
                if ($beneficiary->user) {
                    $beneficiary->user->notify(new LevelUpNotification($nextLevel));
                }
                
                Log::info('Beneficiary leveled up', [
                    'beneficiary_id' => $beneficiary->id,
                    'old_level' => $oldLevel,
                    'new_level' => $nextLevel->level_number,
                    'total_points' => $progress->total_points,
                ]);
            }
            
            // Update points to next level
            $currentLevel = GamificationLevel::where('level_number', $progress->current_level)->first();
            if ($currentLevel && $currentLevel->getNextLevel()) {
                $progress->points_to_next_level = max(0, 
                    $currentLevel->getNextLevel()->points_required - $progress->total_points
                );
                $progress->save();
            }
            
        } catch (\Exception $e) {
            Log::error('Error checking level up', [
                'beneficiary_id' => $event->beneficiary->id,
                'action' => $event->action,
                'error' => $e->getMessage(),
            ]);
            
            throw $e;
        }
    }

    /**
     * Check if action is points-related.
     */
    protected function isPointsRelatedAction(string $action): bool
    {
        $pointsActions = [
            'registered',
            'profile_field_updated',
            'profile_completed',
            'health_question_answered',
            'health_assessment_completed',
            'document_uploaded',
            'interview_scheduled',
            'interview_completed',
            'onboarding_completed',
            'daily_login',
            'form_submitted_perfectly',
            'task_completed',
            'badge_earned',
        ];
        
        return in_array($action, $pointsActions);
    }

    /**
     * Determine whether the listener should be queued.
     */
    public function shouldQueue(UserAction $event): bool
    {
        return $this->isPointsRelatedAction($event->action);
    }
}