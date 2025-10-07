<?php

namespace Tests\Unit\Modules\Health\Services;

use App\Modules\Health\Services\ScoringService;
use PHPUnit\Framework\TestCase;

/**
 * Scoring Service Unit Tests
 *
 * Tests:
 * - Deterministic scoring (same inputs = same outputs)
 * - Boundary value testing
 * - Edge cases (empty answers, invalid data)
 * - PHI protection (no leakage in responses)
 * - Clinical accuracy (PHQ-9, GAD-7, AUDIT-C)
 * - Safety trigger detection
 * - Risk band classification
 */
class ScoringServiceTest extends TestCase
{
    private ScoringService $scoringService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scoringService = new ScoringService();
    }

    /**
     * Test: Deterministic scoring - same inputs produce same outputs
     */
    public function test_deterministic_scoring(): void
    {
        $answers = $this->getMockAnswers();

        // Run scoring multiple times
        $result1 = $this->scoringService->calculateRiskScore($answers);
        $result2 = $this->scoringService->calculateRiskScore($answers);
        $result3 = $this->scoringService->calculateRiskScore($answers);

        // All results must be identical
        $this->assertEquals($result1, $result2);
        $this->assertEquals($result2, $result3);
    }

    /**
     * Test: PHQ-9 minimal depression (0-4) → 0 risk points
     */
    public function test_phq9_minimal_depression(): void
    {
        $answers = $this->getPhq9Answers([1, 1, 1, 1, 0, 0, 0, 0, 0]); // Total: 4

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(0, $result['categories']['depression']['risk_points']);
        $this->assertEquals('minimal', $result['categories']['depression']['severity']);
    }

    /**
     * Test: PHQ-9 mild depression (5-9) → 10 risk points
     */
    public function test_phq9_mild_depression(): void
    {
        $answers = $this->getPhq9Answers([1, 1, 1, 1, 1, 1, 1, 0, 0]); // Total: 7

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(10, $result['categories']['depression']['risk_points']);
        $this->assertEquals('mild', $result['categories']['depression']['severity']);
    }

    /**
     * Test: PHQ-9 moderate depression (10-14) → 20 risk points
     */
    public function test_phq9_moderate_depression(): void
    {
        $answers = $this->getPhq9Answers([2, 2, 2, 2, 1, 1, 1, 1, 0]); // Total: 12

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(20, $result['categories']['depression']['risk_points']);
        $this->assertEquals('moderate', $result['categories']['depression']['severity']);
    }

    /**
     * Test: PHQ-9 moderately severe (15-19) → 40 risk points
     */
    public function test_phq9_moderately_severe_depression(): void
    {
        $answers = $this->getPhq9Answers([2, 2, 2, 2, 2, 2, 2, 2, 1]); // Total: 17

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(40, $result['categories']['depression']['risk_points']);
        $this->assertEquals('moderately_severe', $result['categories']['depression']['severity']);
    }

    /**
     * Test: PHQ-9 severe depression (20-27) → 60 risk points
     */
    public function test_phq9_severe_depression(): void
    {
        $answers = $this->getPhq9Answers([3, 3, 3, 3, 3, 3, 3, 3, 3]); // Total: 27

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(60, $result['categories']['depression']['risk_points']);
        $this->assertEquals('severe', $result['categories']['depression']['severity']);
    }

    /**
     * Test: GAD-7 minimal anxiety (0-4) → 0 risk points
     */
    public function test_gad7_minimal_anxiety(): void
    {
        $answers = $this->getGad7Answers([1, 1, 1, 1, 0, 0, 0]); // Total: 4

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(0, $result['categories']['anxiety']['risk_points']);
        $this->assertEquals('minimal', $result['categories']['anxiety']['severity']);
    }

    /**
     * Test: GAD-7 severe anxiety (15-21) → 40 risk points
     */
    public function test_gad7_severe_anxiety(): void
    {
        $answers = $this->getGad7Answers([3, 3, 3, 3, 3, 3, 0]); // Total: 18

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(40, $result['categories']['anxiety']['risk_points']);
        $this->assertEquals('severe', $result['categories']['anxiety']['severity']);
    }

    /**
     * Test: AUDIT-C low risk (0-2) → 0 risk points
     */
    public function test_auditc_low_risk(): void
    {
        $answers = $this->getAuditCAnswers([1, 1, 0]); // Total: 2

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(0, $result['categories']['alcohol_use']['risk_points']);
        $this->assertEquals('low_risk', $result['categories']['alcohol_use']['severity']);
    }

    /**
     * Test: AUDIT-C very high risk (8-12) → 40 risk points
     */
    public function test_auditc_very_high_risk(): void
    {
        $answers = $this->getAuditCAnswers([4, 4, 2]); // Total: 10

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals(40, $result['categories']['alcohol_use']['risk_points']);
        $this->assertEquals('very_high_risk', $result['categories']['alcohol_use']['severity']);
    }

    /**
     * Test: Suicide ideation trigger (PHQ-9 Q9 > 0) → +50 points
     */
    public function test_suicide_ideation_safety_trigger(): void
    {
        $answers = $this->getPhq9Answers([0, 0, 0, 0, 0, 0, 0, 0, 2]); // Q9 = 2 (suicide ideation)

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertArrayHasKey('suicide_ideation', $result['categories']['safety_triggers']);
        $this->assertEquals(50, $result['categories']['safety_triggers']['suicide_ideation']);
    }

    /**
     * Test: Violence risk trigger → +30 points
     */
    public function test_violence_risk_safety_trigger(): void
    {
        $answers = array_merge(
            $this->getBaseAnswers(),
            ['violence_risk' => 'yes']
        );

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertArrayHasKey('violence_risk', $result['categories']['safety_triggers']);
        $this->assertEquals(30, $result['categories']['safety_triggers']['violence_risk']);
    }

    /**
     * Test: Anaphylaxis without EpiPen → +60 points
     */
    public function test_anaphylaxis_without_epipen(): void
    {
        $answers = array_merge(
            $this->getBaseAnswers(),
            [
                'has_anaphylaxis' => 'yes',
                'has_epipen' => 'no'
            ]
        );

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertArrayHasKey('anaphylaxis_no_epipen', $result['categories']['allergy_risks']);
        $this->assertEquals(60, $result['categories']['allergy_risks']['anaphylaxis_no_epipen']);
    }

    /**
     * Test: Risk band - Low (0-30 points)
     */
    public function test_risk_band_low(): void
    {
        $answers = $this->getPhq9Answers([1, 1, 1, 1, 0, 0, 0, 0, 0]); // 4 points → 0 risk points

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals('low', $result['risk_band']);
        $this->assertLessThanOrEqual(30, $result['score_redacted']);
    }

    /**
     * Test: Risk band - Moderate (31-70 points)
     */
    public function test_risk_band_moderate(): void
    {
        $answers = array_merge(
            $this->getPhq9Answers([2, 2, 2, 2, 1, 1, 1, 1, 0]), // 12 → 20 points
            $this->getGad7Answers([2, 2, 2, 2, 1, 1, 0]) // 10 → 20 points
        );

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals('moderate', $result['risk_band']);
        $this->assertGreaterThanOrEqual(31, $result['score_redacted']);
        $this->assertLessThanOrEqual(70, $result['score_redacted']);
    }

    /**
     * Test: Risk band - High (71-120 points)
     */
    public function test_risk_band_high(): void
    {
        $answers = array_merge(
            $this->getPhq9Answers([3, 3, 3, 3, 3, 3, 3, 3, 0]), // 24 → 60 points
            $this->getGad7Answers([2, 2, 2, 2, 1, 1, 0]) // 10 → 20 points
        );

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals('high', $result['risk_band']);
        $this->assertGreaterThanOrEqual(71, $result['score_redacted']);
        $this->assertLessThanOrEqual(120, $result['score_redacted']);
    }

    /**
     * Test: Risk band - Critical (121+ points)
     */
    public function test_risk_band_critical(): void
    {
        $answers = array_merge(
            $this->getPhq9Answers([3, 3, 3, 3, 3, 3, 3, 3, 3]), // 27 → 60 points
            $this->getGad7Answers([3, 3, 3, 3, 3, 3, 0]), // 18 → 40 points
            $this->getAuditCAnswers([4, 4, 2]), // 10 → 40 points
            ['violence_risk' => 'yes'] // +30 points
        );

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertEquals('critical', $result['risk_band']);
        $this->assertGreaterThanOrEqual(121, $result['score_redacted']);
    }

    /**
     * Test: Empty answers → Low risk (0 points)
     */
    public function test_empty_answers_low_risk(): void
    {
        $result = $this->scoringService->calculateRiskScore([]);

        $this->assertEquals(0, $result['score_redacted']);
        $this->assertEquals('low', $result['risk_band']);
    }

    /**
     * Test: Redacted analytics - NO PHI
     */
    public function test_redacted_analytics_no_phi(): void
    {
        $answers = array_merge(
            $this->getPhq9Answers([2, 2, 2, 2, 1, 1, 1, 1, 0]),
            $this->getGad7Answers([2, 2, 2, 2, 1, 1, 0]),
            ['violence_risk' => 'yes']
        );

        $result = $this->scoringService->calculateRiskScore($answers);
        $redacted = $this->scoringService->redactForAnalytics($result);

        // Verify only boolean flags and bands are present
        $this->assertArrayHasKey('risk_band', $redacted);
        $this->assertArrayHasKey('has_depression_risk', $redacted);
        $this->assertArrayHasKey('has_anxiety_risk', $redacted);
        $this->assertArrayHasKey('has_safety_triggers', $redacted);

        // Verify NO raw scores or answer content
        $this->assertArrayNotHasKey('responses', $redacted);
        $this->assertArrayNotHasKey('answers', $redacted);

        // Verify only boolean values for flags
        $this->assertIsBool($redacted['has_depression_risk']);
        $this->assertIsBool($redacted['has_anxiety_risk']);
        $this->assertIsBool($redacted['has_safety_triggers']);
    }

    /**
     * Test: Recommendations generated for critical risk
     */
    public function test_recommendations_for_critical_risk(): void
    {
        $answers = array_merge(
            $this->getPhq9Answers([3, 3, 3, 3, 3, 3, 3, 3, 3]),
            ['violence_risk' => 'yes']
        );

        $result = $this->scoringService->calculateRiskScore($answers);

        $this->assertNotEmpty($result['recommendations']);
        $this->assertContains('Immediate clinical intervention recommended', $result['recommendations']);
    }

    /**
     * Helper: Get PHQ-9 answers
     */
    private function getPhq9Answers(array $scores): array
    {
        return [
            'phq9_q1' => $scores[0] ?? 0,
            'phq9_q2' => $scores[1] ?? 0,
            'phq9_q3' => $scores[2] ?? 0,
            'phq9_q4' => $scores[3] ?? 0,
            'phq9_q5' => $scores[4] ?? 0,
            'phq9_q6' => $scores[5] ?? 0,
            'phq9_q7' => $scores[6] ?? 0,
            'phq9_q8' => $scores[7] ?? 0,
            'phq9_q9' => $scores[8] ?? 0,
        ];
    }

    /**
     * Helper: Get GAD-7 answers
     */
    private function getGad7Answers(array $scores): array
    {
        return [
            'gad7_q1' => $scores[0] ?? 0,
            'gad7_q2' => $scores[1] ?? 0,
            'gad7_q3' => $scores[2] ?? 0,
            'gad7_q4' => $scores[3] ?? 0,
            'gad7_q5' => $scores[4] ?? 0,
            'gad7_q6' => $scores[5] ?? 0,
            'gad7_q7' => $scores[6] ?? 0,
        ];
    }

    /**
     * Helper: Get AUDIT-C answers
     */
    private function getAuditCAnswers(array $scores): array
    {
        return [
            'auditc_q1' => $scores[0] ?? 0,
            'auditc_q2' => $scores[1] ?? 0,
            'auditc_q3' => $scores[2] ?? 0,
        ];
    }

    /**
     * Helper: Get base answers (all zeros)
     */
    private function getBaseAnswers(): array
    {
        return array_merge(
            $this->getPhq9Answers([0, 0, 0, 0, 0, 0, 0, 0, 0]),
            $this->getGad7Answers([0, 0, 0, 0, 0, 0, 0]),
            $this->getAuditCAnswers([0, 0, 0])
        );
    }

    /**
     * Helper: Get mock answers for determinism testing
     */
    private function getMockAnswers(): array
    {
        return array_merge(
            $this->getPhq9Answers([2, 2, 1, 1, 2, 1, 1, 1, 0]),
            $this->getGad7Answers([2, 2, 1, 1, 1, 0, 0]),
            $this->getAuditCAnswers([1, 1, 0])
        );
    }
}
