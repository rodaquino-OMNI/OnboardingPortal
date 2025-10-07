<?php

namespace App\Modules\Health\Repositories;

use App\Models\HealthQuestionnaire;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Questionnaire Repository - Database Operations Layer
 *
 * Encapsulates all database queries for health questionnaires
 * Enables easier testing with mocks/fakes
 *
 * Security:
 * - All PHI is encrypted at model level
 * - Never returns raw encrypted data
 * - Always uses proper query scoping
 */
class QuestionnaireRepository
{
    /**
     * Find existing draft or create new questionnaire response
     *
     * @param int $userId User ID
     * @param int $templateId Questionnaire template ID
     * @return HealthQuestionnaire
     */
    public function findOrCreateDraft(int $userId, int $templateId): HealthQuestionnaire
    {
        return HealthQuestionnaire::firstOrCreate(
            [
                'beneficiary_id' => $userId,
                'template_id' => $templateId,
                'status' => 'draft',
            ],
            [
                'questionnaire_type' => 'health_assessment',
                'started_at' => now(),
                'responses' => [],
            ]
        );
    }

    /**
     * Find questionnaire by ID (with user authorization check)
     *
     * @param int $id Questionnaire ID
     * @param int|null $userId User ID for authorization check
     * @return HealthQuestionnaire|null
     */
    public function findById(int $id, ?int $userId = null): ?HealthQuestionnaire
    {
        $query = HealthQuestionnaire::where('id', $id);

        if ($userId !== null) {
            $query->where('beneficiary_id', $userId);
        }

        return $query->first();
    }

    /**
     * Get user's questionnaire history (metadata only, no PHI)
     *
     * @param int $userId User ID
     * @param int $limit Number of results
     * @return Collection
     */
    public function getUserHistory(int $userId, int $limit = 10): Collection
    {
        return HealthQuestionnaire::where('beneficiary_id', $userId)
            ->whereNotNull('completed_at')
            ->orderBy('completed_at', 'desc')
            ->limit($limit)
            ->get()
            ->makeHidden(['responses']); // NEVER return encrypted answers
    }

    /**
     * Get pending questionnaires for user
     *
     * @param int $userId User ID
     * @return Collection
     */
    public function getPendingQuestionnaires(int $userId): Collection
    {
        return HealthQuestionnaire::where('beneficiary_id', $userId)
            ->where('status', 'draft')
            ->orderBy('last_saved_at', 'desc')
            ->get()
            ->makeHidden(['responses']);
    }

    /**
     * Get questionnaires by risk level (for admin/clinical review)
     *
     * @param string $riskLevel Risk level filter
     * @param int $limit Number of results
     * @return Collection
     */
    public function getByRiskLevel(string $riskLevel, int $limit = 50): Collection
    {
        return HealthQuestionnaire::where('risk_level', $riskLevel)
            ->whereNotNull('completed_at')
            ->orderBy('completed_at', 'desc')
            ->limit($limit)
            ->get()
            ->makeHidden(['responses']); // PHI protection
    }

    /**
     * Get questionnaires requiring follow-up
     *
     * @param int $limit Number of results
     * @return Collection
     */
    public function getRequiringFollowUp(int $limit = 100): Collection
    {
        return HealthQuestionnaire::where('follow_up_required', true)
            ->whereNull('follow_up_completed_at')
            ->where('follow_up_date', '<=', now())
            ->orderBy('risk_level', 'desc')
            ->orderBy('follow_up_date', 'asc')
            ->limit($limit)
            ->get()
            ->makeHidden(['responses']);
    }

    /**
     * Mark questionnaire as reviewed
     *
     * @param int $questionnaireId Questionnaire ID
     * @param int $reviewerId Reviewer user ID
     * @param string|null $notes Review notes (non-PHI)
     * @return bool
     */
    public function markAsReviewed(int $questionnaireId, int $reviewerId, ?string $notes = null): bool
    {
        return HealthQuestionnaire::where('id', $questionnaireId)
            ->update([
                'reviewed_by' => $reviewerId,
                'reviewed_at' => now(),
                'notes' => $notes,
            ]);
    }

    /**
     * Update follow-up status
     *
     * @param int $questionnaireId Questionnaire ID
     * @param bool $completed Follow-up completed
     * @return bool
     */
    public function updateFollowUpStatus(int $questionnaireId, bool $completed): bool
    {
        $data = [];

        if ($completed) {
            $data['follow_up_completed_at'] = now();
        }

        return HealthQuestionnaire::where('id', $questionnaireId)->update($data);
    }

    /**
     * Get aggregated statistics (de-identified)
     *
     * @param array $filters Optional filters
     * @return array
     */
    public function getAggregatedStats(array $filters = []): array
    {
        $query = HealthQuestionnaire::whereNotNull('completed_at');

        // Apply filters
        if (isset($filters['date_from'])) {
            $query->where('completed_at', '>=', $filters['date_from']);
        }
        if (isset($filters['date_to'])) {
            $query->where('completed_at', '<=', $filters['date_to']);
        }

        // Aggregations (no PHI)
        return [
            'total_completed' => $query->count(),
            'by_risk_level' => $query->groupBy('risk_level')
                ->selectRaw('risk_level, count(*) as count')
                ->pluck('count', 'risk_level')
                ->toArray(),
            'requiring_followup' => HealthQuestionnaire::where('follow_up_required', true)
                ->whereNull('follow_up_completed_at')
                ->count(),
        ];
    }
}
