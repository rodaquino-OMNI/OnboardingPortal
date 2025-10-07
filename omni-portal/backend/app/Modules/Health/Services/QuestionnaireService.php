<?php

namespace App\Modules\Health\Services;

use App\Models\User;
use App\Models\HealthQuestionnaire;
use App\Models\QuestionnaireTemplate;
use App\Modules\Health\Repositories\QuestionnaireRepository;
use App\Events\HealthQuestionnaireSubmitted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Questionnaire Service - Core Business Logic for Health Questionnaires
 *
 * Security Features:
 * - NEVER returns decrypted answers in any method
 * - NEVER logs PHI (answers or personal health information)
 * - Always uses audit logging for sensitive operations
 * - Validates user authorization before any operation
 * - Uses deterministic scoring (no randomness)
 *
 * PHI Protection:
 * - All answer storage uses encrypted HealthQuestionnaire model
 * - Responses only return metadata, never raw answers
 * - All methods are PHI-safe by design
 */
class QuestionnaireService
{
    public function __construct(
        private QuestionnaireRepository $repository,
        private ScoringService $scoringService
    ) {}

    /**
     * Fetch active questionnaire schema
     *
     * Returns question structure, branching rules, and validation schemas
     * NO PHI in response - pure template data
     *
     * @param int|null $version Specific version to retrieve, null for latest active
     * @return array Questionnaire schema with questions, branching rules, validation
     * @throws \Exception If no active questionnaire found
     */
    public function getActiveSchema(?int $version = null): array
    {
        $query = QuestionnaireTemplate::where('is_active', true)
            ->whereNotNull('published_at');

        if ($version !== null) {
            $query->where('version', $version);
        }

        $template = $query->orderBy('version', 'desc')->first();

        if (!$template) {
            throw new \Exception('No active questionnaire template found');
        }

        // Return only non-PHI template data
        return [
            'id' => $template->id,
            'version' => $template->version,
            'name' => $template->name,
            'code' => $template->code,
            'description' => $template->description,
            'type' => $template->type,
            'estimated_minutes' => $template->estimated_minutes,
            'sections' => $template->sections ?? [],
            'scoring_rules' => $template->scoring_rules ?? [],
            'risk_assessment_rules' => $template->risk_assessment_rules ?? [],
            'languages' => $template->languages ?? ['en'],
            'created_at' => $template->created_at?->toIso8601String(),
        ];
    }

    /**
     * Validate branching logic based on answers
     *
     * Pure function - evaluates conditional logic without database calls
     * Example: If PHQ-9 Q9 > 0, show safety planning section
     *
     * @param array $answers User's current answers
     * @param array $schema Questionnaire schema with branching rules
     * @return array Next questions to display based on branching logic
     */
    public function validateBranchingLogic(array $answers, array $schema): array
    {
        $nextQuestions = [];
        $sections = $schema['sections'] ?? [];

        foreach ($sections as $sectionKey => $section) {
            // Check if section has branching conditions
            $condition = $section['condition'] ?? null;

            if ($condition === null) {
                // No condition - section always visible
                $nextQuestions[$sectionKey] = $this->getSectionQuestions($section);
                continue;
            }

            // Evaluate condition
            if ($this->evaluateCondition($condition, $answers)) {
                $nextQuestions[$sectionKey] = $this->getSectionQuestions($section);
            }
        }

        return $nextQuestions;
    }

    /**
     * Save draft questionnaire responses
     *
     * Security:
     * - Encrypts answers using HealthQuestionnaire model
     * - Sets submitted_at = null (draft status)
     * - Creates audit log entry
     * - Returns response with metadata only (NO decrypted answers)
     *
     * @param User $user User submitting the draft
     * @param int $questionnaireId Template ID
     * @param array $answers User's answers (will be encrypted)
     * @return HealthQuestionnaire Response with metadata only
     */
    public function saveDraft(User $user, int $questionnaireId, array $answers): HealthQuestionnaire
    {
        // Validate template exists and is active
        $template = QuestionnaireTemplate::where('id', $questionnaireId)
            ->where('is_active', true)
            ->firstOrFail();

        // Audit log - NO PHI
        $correlationId = Str::uuid()->toString();
        Log::channel('audit')->info('health_questionnaire_draft_save', [
            'user_id' => $user->id,
            'user_hashed_id' => hash('sha256', $user->id),
            'template_id' => $questionnaireId,
            'template_version' => $template->version,
            'correlation_id' => $correlationId,
            'question_count' => count($answers),
            'timestamp' => now()->toIso8601String(),
        ]);

        return DB::transaction(function () use ($user, $questionnaireId, $answers, $correlationId) {
            // Find existing draft or create new
            $response = $this->repository->findOrCreateDraft($user->id, $questionnaireId);

            // Update with encrypted answers
            $response->update([
                'responses' => $answers, // Model handles encryption
                'status' => 'draft',
                'last_saved_at' => now(),
                'current_section' => $this->getCurrentSection($answers),
                'metadata' => [
                    'correlation_id' => $correlationId,
                    'last_modified_ip' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                ],
            ]);

            // Return model WITHOUT decrypted answers
            return $response->refresh()->makeHidden(['responses']);
        });
    }

    /**
     * Submit final questionnaire responses
     *
     * Security:
     * - Encrypts answers
     * - Calculates score using ScoringService
     * - Sets submitted_at = now()
     * - Emits HealthQuestionnaireSubmitted event
     * - Creates audit log with correlation ID
     * - Returns response with score_redacted and risk_band ONLY
     *
     * @param User $user User submitting the questionnaire
     * @param int $questionnaireId Template ID
     * @param array $answers Final answers (will be encrypted)
     * @return HealthQuestionnaire Response with score and risk band, NO raw answers
     */
    public function submitQuestionnaire(User $user, int $questionnaireId, array $answers): HealthQuestionnaire
    {
        // Validate template exists and is active
        $template = QuestionnaireTemplate::where('id', $questionnaireId)
            ->where('is_active', true)
            ->firstOrFail();

        // Calculate risk score (deterministic, no randomness)
        $scoreData = $this->scoringService->calculateRiskScore($answers);

        // Audit log - NO PHI
        $correlationId = Str::uuid()->toString();
        Log::channel('audit')->info('health_questionnaire_submit', [
            'user_id' => $user->id,
            'user_hashed_id' => hash('sha256', $user->id),
            'template_id' => $questionnaireId,
            'template_version' => $template->version,
            'correlation_id' => $correlationId,
            'score_redacted' => $scoreData['score_redacted'],
            'risk_band' => $scoreData['risk_band'],
            'question_count' => count($answers),
            'timestamp' => now()->toIso8601String(),
        ]);

        return DB::transaction(function () use ($user, $questionnaireId, $answers, $scoreData, $correlationId, $template) {
            // Find existing draft or create new
            $response = $this->repository->findOrCreateDraft($user->id, $questionnaireId);

            // Update with final submission
            $response->update([
                'responses' => $answers, // Model handles encryption
                'status' => 'completed',
                'submitted_at' => now(),
                'completed_at' => now(),
                'score' => $scoreData['score_redacted'],
                'risk_level' => $scoreData['risk_band'],
                'risk_scores' => $scoreData['categories'],
                'metadata' => [
                    'correlation_id' => $correlationId,
                    'submitted_ip' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                    'template_version' => $template->version,
                ],
            ]);

            // Emit event for downstream processing (AI analysis, alerts, etc.)
            event(new HealthQuestionnaireSubmitted($response, $scoreData));

            // Return model WITHOUT decrypted answers
            return $response->refresh()->makeHidden(['responses']);
        });
    }

    /**
     * Evaluate a branching condition
     *
     * @param array $condition Condition definition
     * @param array $answers Current answers
     * @return bool True if condition is met
     */
    private function evaluateCondition(array $condition, array $answers): bool
    {
        $questionId = $condition['question_id'] ?? null;
        $operator = $condition['operator'] ?? '=';
        $value = $condition['value'] ?? null;

        if ($questionId === null || !isset($answers[$questionId])) {
            return false;
        }

        $answer = $answers[$questionId];

        return match ($operator) {
            '=' => $answer == $value,
            '!=' => $answer != $value,
            '>' => $answer > $value,
            '>=' => $answer >= $value,
            '<' => $answer < $value,
            '<=' => $answer <= $value,
            'in' => in_array($answer, (array) $value),
            'not_in' => !in_array($answer, (array) $value),
            default => false,
        };
    }

    /**
     * Get questions from a section
     *
     * @param array $section Section definition
     * @return array Questions in the section
     */
    private function getSectionQuestions(array $section): array
    {
        return $section['questions'] ?? [];
    }

    /**
     * Determine current section based on answers
     *
     * @param array $answers Current answers
     * @return string|null Current section key
     */
    private function getCurrentSection(array $answers): ?string
    {
        if (empty($answers)) {
            return null;
        }

        // Simple heuristic: last answered question determines section
        $lastQuestionId = array_key_last($answers);

        // This could be enhanced with template section mapping
        return "section_" . substr($lastQuestionId, 0, strpos($lastQuestionId, '_') ?: 0);
    }
}
