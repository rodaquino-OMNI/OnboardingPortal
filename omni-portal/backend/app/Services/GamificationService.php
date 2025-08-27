<?php

namespace App\Services;

use App\Models\Beneficiary;
use App\Models\GamificationBadge;
use App\Models\GamificationLevel;
use App\Models\GamificationProgress;
use App\Events\UserAction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GamificationService
{
    /**
     * Point values for different actions - SYNCHRONIZED WITH FRONTEND
     */
    const POINTS = [
        // Registration and Profile
        'registration' => 100,
        'profile_field' => 10,
        'profile_completed' => 50,
        'profile_photo_upload' => 10,
        'profile_update' => 5,
        
        // Health Questions
        'health_question' => 20,
        'health_question_answered' => 2,
        'health_section_complete' => 15,
        'health_questionnaire_complete' => 150,
        'health_perfect_accuracy' => 50,
        
        // Documents
        'document_required' => 50,
        'document_optional' => 100,
        'document_upload' => 20,
        'document_verified' => 30,
        'all_documents_complete' => 100,
        
        // Interview
        'interview_scheduled' => 150,
        'interview_completed' => 200,
        'interview_rescheduled' => -10,
        
        // Telemedicine
        'telemedicine_scheduled' => 225,
        'telemedicine_completed' => 500,
        'telemedicine_preparation' => 100,
        
        // Engagement
        'daily_login' => 5,
        'streak_bonus' => 10,
        'weekly_streak' => 25,
        'monthly_streak' => 100,
        'punctuality_bonus' => 50,
        
        // Completion Bonuses
        'onboarding_completed' => 200,
        'onboarding_complete' => 500,
        'speed_bonus_24h' => 100,
        'speed_bonus_48h' => 50,
        'speed_bonus_72h' => 25,
        
        // Penalties
        'missed_appointment' => -50,
        'incomplete_form' => -5,
        'document_rejected' => -10,
        
        // OCR Processing Points
        'ocr_processing_completed' => 75,
        'ocr_high_confidence' => 25,
        'ocr_medium_confidence' => 15,
        'ocr_quality_excellent' => 35,
        'ocr_quality_good' => 20,
        'ocr_validation_success' => 40,
        'ocr_validation_partial' => 20,
        'ocr_progressive_quality' => 50,
        'ocr_complex_document' => 30,
    ];

    /**
     * Award points to a beneficiary for an action.
     */
    public function awardPoints(Beneficiary $beneficiary, string $action, array $metadata = []): int
    {
        $points = $this->calculatePoints($action, $metadata);
        
        if ($points <= 0) {
            return 0;
        }

        DB::transaction(function () use ($beneficiary, $points, $action, $metadata) {
            $progress = $beneficiary->getOrCreateGamificationProgress();
            $oldLevel = $progress->current_level;
            
            // Add points
            $progress->addPoints($points);
            
            // Update activity streak
            $progress->updateStreak();
            
            // Track specific action counts
            $this->updateActionCounts($progress, $action, $metadata);
            
            // Check for level up
            if ($newLevel = $progress->checkLevelUp()) {
                $progress->levelUp($newLevel);
                
                // Dispatch level up event
                event(new UserAction($beneficiary, 'level_up', [
                    'old_level' => $oldLevel,
                    'new_level' => $newLevel->level_number,
                    'level_name' => $newLevel->name,
                ]));
            }
            
            // Log the point award
            Log::info('Points awarded', [
                'beneficiary_id' => $beneficiary->id,
                'action' => $action,
                'points' => $points,
                'total_points' => $progress->total_points,
            ]);
        });

        return $points;
    }

    /**
     * Calculate points for an action.
     */
    protected function calculatePoints(string $action, array $metadata = []): int
    {
        $basePoints = self::POINTS[$action] ?? 0;
        
        // Apply modifiers based on metadata
        switch ($action) {
            case 'document_upload':
                // Determine if document is required or optional
                $isRequired = $metadata['is_required'] ?? true;
                $basePoints = $isRequired ? self::POINTS['document_required'] : self::POINTS['document_optional'];
                break;
                
            case 'interview':
                // Determine if scheduled or completed
                $isCompleted = $metadata['is_completed'] ?? false;
                $basePoints = $isCompleted ? self::POINTS['interview_completed'] : self::POINTS['interview_scheduled'];
                break;
                
            case 'streak_bonus':
                // Calculate streak bonus
                $streakDays = $metadata['streak_days'] ?? 0;
                $basePoints = min($streakDays * self::POINTS['streak_bonus'], 100); // Cap at 100
                break;
                
            case 'telemedicine_scheduled':
            case 'telemedicine_completed':
            case 'telemedicine_preparation':
                // Use base points from metadata if provided, otherwise default
                $basePoints = $metadata['base_points'] ?? self::POINTS[$action];
                break;
                
            // OCR Processing Points with Confidence-Based Scoring
            case 'ocr_processing_completed':
                $basePoints = $this->calculateOCRPoints($metadata);
                break;
        }
        
        // Calculate multipliers properly (completion bonus + additional multiplier)
        $completionMultiplier = 1.0;
        if ($metadata['is_completion_reward'] ?? false) {
            $completionMultiplier = 1.5; // 50% bonus for completion rewards
        }
        
        $additionalMultiplier = $metadata['multiplier'] ?? 1.0;
        $multiplier = $completionMultiplier * $additionalMultiplier;
        
        return (int) round($basePoints * $multiplier);
    }

    /**
     * Update specific action counts in progress.
     */
    protected function updateActionCounts(GamificationProgress $progress, string $action, array $metadata = []): void
    {
        switch ($action) {
            case 'document_upload':
                $progress->increment('documents_uploaded');
                break;
                
            case 'health_assessment':
                $progress->increment('health_assessments_completed');
                break;
                
            case 'profile_completed':
                $progress->profile_completed = true;
                break;
                
            case 'onboarding_completed':
                $progress->onboarding_completed = true;
                break;
                
            case 'perfect_form':
                $progress->increment('perfect_forms');
                break;
                
            case 'task_completed':
                $progress->increment('tasks_completed');
                break;
        }
        
        $progress->save();
    }

    /**
     * Calculate OCR processing points with confidence-based scoring and quality bonuses
     */
    protected function calculateOCRPoints(array $metadata): int
    {
        $basePoints = self::POINTS['ocr_processing_completed'];
        $bonusPoints = 0;
        
        // Confidence-based bonuses
        $confidence = $metadata['confidence'] ?? 0;
        if ($confidence >= 90) {
            $bonusPoints += self::POINTS['ocr_high_confidence'];
        } elseif ($confidence >= 80) {
            $bonusPoints += self::POINTS['ocr_medium_confidence'];
        }
        
        // Quality-based bonuses
        $quality = $metadata['quality'] ?? 0;
        if ($quality >= 95) {
            $bonusPoints += self::POINTS['ocr_quality_excellent'];
        } elseif ($quality >= 85) {
            $bonusPoints += self::POINTS['ocr_quality_good'];
        }
        
        // Validation success bonuses
        $validationStatus = $metadata['validation_status'] ?? 'unknown';
        switch ($validationStatus) {
            case 'passed':
                $bonusPoints += self::POINTS['ocr_validation_success'];
                break;
            case 'passed_with_warnings':
                $bonusPoints += self::POINTS['ocr_validation_partial'];
                break;
        }
        
        // Progressive quality reward (for users with consistent high-quality processing)
        if ($metadata['progressive_bonus'] ?? false) {
            $bonusPoints += self::POINTS['ocr_progressive_quality'];
        }
        
        // Complex document bonus
        $documentType = $metadata['document_type'] ?? '';
        if (in_array($documentType, ['laudo_medico', 'formulario', 'comprovante_residencia'])) {
            $bonusPoints += self::POINTS['ocr_complex_document'];
        }
        
        return $basePoints + $bonusPoints;
    }

    /**
     * Check and award badges for a beneficiary.
     */
    public function checkAndAwardBadges(Beneficiary $beneficiary): array
    {
        $awardedBadges = [];
        $badges = GamificationBadge::where('is_active', true)->get();
        
        foreach ($badges as $badge) {
            if ($badge->checkCriteria($beneficiary)) {
                $this->awardBadge($beneficiary, $badge);
                $awardedBadges[] = $badge;
            }
        }
        
        return $awardedBadges;
    }

    /**
     * Award a specific badge to a beneficiary.
     */
    public function awardBadge(Beneficiary $beneficiary, GamificationBadge $badge): void
    {
        // Check if already has this badge (and max count)
        $existingCount = $beneficiary->badges()->where('gamification_badge_id', $badge->id)->count();
        if ($existingCount >= $badge->max_per_user) {
            return;
        }
        
        DB::transaction(function () use ($beneficiary, $badge) {
            // Award the badge
            $beneficiary->badges()->attach($badge->id, [
                'earned_at' => now(),
            ]);
            
            // Award badge points
            if ($badge->points_value > 0) {
                $this->awardPoints($beneficiary, 'badge_earned', [
                    'badge_id' => $badge->id,
                    'badge_slug' => $badge->slug,
                    'points' => $badge->points_value,
                ]);
            }
            
            // Update progress
            $progress = $beneficiary->getOrCreateGamificationProgress();
            $progress->last_badge_earned_at = now();
            
            // Update badges earned array
            $badgesEarned = $progress->badges_earned ?? [];
            $badgesEarned[] = [
                'badge_id' => $badge->id,
                'earned_at' => now()->toIso8601String(),
            ];
            $progress->badges_earned = $badgesEarned;
            $progress->save();
            
            // Dispatch badge earned event
            event(new UserAction($beneficiary, 'badge_earned', [
                'badge_id' => $badge->id,
                'badge_name' => $badge->name,
                'badge_slug' => $badge->slug,
                'badge_rarity' => $badge->rarity,
            ]));
            
            Log::info('Badge awarded', [
                'beneficiary_id' => $beneficiary->id,
                'badge_id' => $badge->id,
                'badge_slug' => $badge->slug,
            ]);
        });
    }

    /**
     * Get leaderboard for a company or globally.
     */
    public function getLeaderboard(?int $companyId = null, int $limit = 10): array
    {
        // Pre-load all levels to eliminate N+1 queries - Technical Excellence
        $levelsMap = \Cache::remember('gamification_levels_map', 3600, function () {
            return GamificationLevel::pluck('name', 'level_number')->toArray();
        });
        
        // Optimize query with selective loading and proper indexes
        $query = GamificationProgress::with(['beneficiary:id,full_name,profile_picture,company_id'])
            ->select(['beneficiary_id', 'total_points', 'current_level', 'badges_earned', 'engagement_score'])
            ->orderBy('total_points', 'desc')
            ->orderBy('current_level', 'desc')
            ->orderBy('engagement_score', 'desc');
        
        if ($companyId) {
            $query->whereHas('beneficiary', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            });
        }
        
        // Single query execution with optimized mapping
        return $query->limit($limit)->get()->map(function ($progress) use ($levelsMap) {
            return [
                'beneficiary_id' => $progress->beneficiary_id,
                'name' => $progress->beneficiary->full_name ?? 'Unknown',
                'avatar' => $progress->beneficiary->profile_picture ?? null,
                'total_points' => $progress->total_points,
                'current_level' => $progress->current_level,
                'level_name' => $levelsMap[$progress->current_level] ?? 'Level ' . $progress->current_level,
                'badges_count' => is_array($progress->badges_earned) ? count($progress->badges_earned) : 0,
                'engagement_score' => $progress->engagement_score,
            ];
        })->toArray();
    }

    /**
     * Get gamification statistics for a beneficiary.
     */
    public function getStatistics(Beneficiary $beneficiary): array
    {
        $progress = $beneficiary->getOrCreateGamificationProgress();
        $currentLevel = $beneficiary->getCurrentLevel();
        $nextLevel = $currentLevel ? $currentLevel->getNextLevel() : null;
        
        return [
            'total_points' => $progress->total_points,
            'current_level' => [
                'number' => $progress->current_level,
                'name' => $currentLevel->name ?? 'Unknown',
                'color' => $currentLevel->color_theme ?? '#3B82F6',
                'icon' => $currentLevel->icon ?? null,
            ],
            'next_level' => $nextLevel ? [
                'number' => $nextLevel->level_number,
                'name' => $nextLevel->name,
                'points_required' => $nextLevel->points_required,
                'points_remaining' => max(0, $nextLevel->points_required - $progress->total_points),
                'progress_percentage' => $currentLevel->calculateProgress($progress->total_points),
            ] : null,
            'streak_days' => $progress->streak_days,
            'badges_earned' => $beneficiary->badges()->count(),
            'tasks_completed' => $progress->tasks_completed,
            'engagement_score' => $progress->engagement_score,
            'last_activity' => $progress->last_activity_date?->toDateString(),
            'member_since' => $beneficiary->created_at->toDateString(),
        ];
    }

    /**
     * Check specific badge criteria for common badges.
     */
    public function checkSpecificBadges(Beneficiary $beneficiary, string $badgeSlug): void
    {
        $badge = GamificationBadge::where('slug', $badgeSlug)->first();
        
        if ($badge && $badge->checkCriteria($beneficiary)) {
            $this->awardBadge($beneficiary, $badge);
        }
    }
}