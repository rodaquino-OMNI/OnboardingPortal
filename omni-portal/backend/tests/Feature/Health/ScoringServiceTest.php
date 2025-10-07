<?php

namespace Tests\Feature\Health;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Services\ScoringService;

class ScoringServiceTest extends TestCase
{
    use RefreshDatabase;

    protected ScoringService $scoringService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scoringService = app(ScoringService::class);
    }

    /**
     * @test
     * CRITICAL: Test that PHQ-9 scoring is deterministic
     * Run 100 iterations to ensure no randomness
     */
    public function test_phq9_scoring_deterministic()
    {
        // Arrange - Severe depression answers
        $answers = ['phq9' => [3, 3, 3, 3, 3, 3, 3, 3, 3]];

        // Act - First calculation
        $result1 = $this->scoringService->calculateRiskScore($answers);

        // Assert - Run 100 times to ensure deterministic behavior
        for ($i = 0; $i < 100; $i++) {
            $result = $this->scoringService->calculateRiskScore($answers);

            $this->assertEquals($result1['score_redacted'], $result['score_redacted']);
            $this->assertEquals('critical', $result['risk_band']);
            $this->assertEquals($result1['normalized_score'], $result['normalized_score']);
        }
    }

    /**
     * @test
     * CRITICAL: Test that suicide ideation (Q9) adds 50 points
     */
    public function test_suicide_risk_adds_50_points()
    {
        // Arrange - Only Q9 (suicide ideation) answered with highest severity
        $answersWithSuicide = ['phq9' => [0, 0, 0, 0, 0, 0, 0, 0, 3]];
        $answersWithoutSuicide = ['phq9' => [0, 0, 0, 0, 0, 0, 0, 0, 0]];

        // Act
        $resultWith = $this->scoringService->calculateRiskScore($answersWithSuicide);
        $resultWithout = $this->scoringService->calculateRiskScore($answersWithoutSuicide);

        // Assert
        $this->assertGreaterThanOrEqual(50, $resultWith['score_redacted']);
        $this->assertEquals('critical', $resultWith['risk_band']);
        $this->assertGreaterThan($resultWithout['score_redacted'], $resultWith['score_redacted']);
    }

    /**
     * @test
     * Test PHQ-9 score ranges and risk bands
     */
    public function test_phq9_risk_band_classification()
    {
        // Minimal depression (0-4)
        $minimal = ['phq9' => [0, 0, 0, 0, 0, 0, 0, 1, 0]];
        $resultMinimal = $this->scoringService->calculateRiskScore($minimal);
        $this->assertEquals('minimal', $resultMinimal['risk_band']);

        // Mild depression (5-9)
        $mild = ['phq9' => [1, 1, 1, 1, 1, 0, 0, 0, 0]];
        $resultMild = $this->scoringService->calculateRiskScore($mild);
        $this->assertEquals('mild', $resultMild['risk_band']);

        // Moderate depression (10-14)
        $moderate = ['phq9' => [1, 1, 1, 1, 1, 1, 1, 1, 1]];
        $resultModerate = $this->scoringService->calculateRiskScore($moderate);
        $this->assertEquals('moderate', $resultModerate['risk_band']);

        // Moderately severe (15-19)
        $moderatelySevere = ['phq9' => [2, 2, 2, 2, 2, 1, 1, 1, 0]];
        $resultModeratelySevere = $this->scoringService->calculateRiskScore($moderatelySevere);
        $this->assertEquals('moderately_severe', $resultModeratelySevere['risk_band']);

        // Severe depression (20-27)
        $severe = ['phq9' => [3, 3, 3, 3, 3, 3, 3, 3, 3]];
        $resultSevere = $this->scoringService->calculateRiskScore($severe);
        $this->assertEquals('critical', $resultSevere['risk_band']);
    }

    /**
     * @test
     * Test score normalization (0-100 scale)
     */
    public function test_score_normalization()
    {
        // Minimum score
        $minAnswers = ['phq9' => [0, 0, 0, 0, 0, 0, 0, 0, 0]];
        $minResult = $this->scoringService->calculateRiskScore($minAnswers);
        $this->assertEquals(0, $minResult['normalized_score']);

        // Maximum score
        $maxAnswers = ['phq9' => [3, 3, 3, 3, 3, 3, 3, 3, 3]];
        $maxResult = $this->scoringService->calculateRiskScore($maxAnswers);
        $this->assertEquals(100, $maxResult['normalized_score']);

        // Mid-range score
        $midAnswers = ['phq9' => [1, 1, 1, 1, 1, 1, 1, 1, 1]];
        $midResult = $this->scoringService->calculateRiskScore($midAnswers);
        $this->assertGreaterThan(0, $midResult['normalized_score']);
        $this->assertLessThan(100, $midResult['normalized_score']);
    }

    /**
     * @test
     * Test that score redaction maintains privacy
     */
    public function test_score_redaction_maintains_privacy()
    {
        // Arrange
        $answers = ['phq9' => [2, 2, 2, 2, 2, 2, 2, 2, 2]];

        // Act
        $result = $this->scoringService->calculateRiskScore($answers);

        // Assert - Exact score should not be exposed
        $this->assertArrayHasKey('score_redacted', $result);
        $this->assertArrayHasKey('risk_band', $result);

        // Redacted score should be a range, not exact value
        $this->assertIsString($result['score_redacted']);
        $this->assertMatchesRegularExpression('/^\d+-\d+$/', $result['score_redacted']);
    }

    /**
     * @test
     * Test edge case: Invalid answer values
     */
    public function test_invalid_answer_values_throw_exception()
    {
        // Arrange - Invalid answer value (PHQ-9 only allows 0-3)
        $invalidAnswers = ['phq9' => [0, 0, 0, 0, 0, 0, 0, 0, 5]];

        // Act & Assert
        $this->expectException(\InvalidArgumentException::class);
        $this->scoringService->calculateRiskScore($invalidAnswers);
    }

    /**
     * @test
     * Test edge case: Missing answers
     */
    public function test_missing_answers_throw_exception()
    {
        // Arrange - Only 5 answers instead of 9
        $incompleteAnswers = ['phq9' => [1, 1, 1, 1, 1]];

        // Act & Assert
        $this->expectException(\InvalidArgumentException::class);
        $this->scoringService->calculateRiskScore($incompleteAnswers);
    }

    /**
     * @test
     * Test that recommendations are provided based on risk band
     */
    public function test_recommendations_provided_for_risk_bands()
    {
        // Minimal risk
        $minimal = ['phq9' => [0, 0, 0, 0, 0, 0, 0, 0, 0]];
        $resultMinimal = $this->scoringService->calculateRiskScore($minimal);
        $this->assertArrayHasKey('recommendations', $resultMinimal);
        $this->assertIsArray($resultMinimal['recommendations']);

        // Critical risk
        $critical = ['phq9' => [3, 3, 3, 3, 3, 3, 3, 3, 3]];
        $resultCritical = $this->scoringService->calculateRiskScore($critical);
        $this->assertArrayHasKey('recommendations', $resultCritical);
        $this->assertContains('Immediate mental health evaluation recommended', $resultCritical['recommendations']);
    }

    /**
     * @test
     * Test GAD-7 (Generalized Anxiety Disorder) scoring
     */
    public function test_gad7_scoring()
    {
        // Minimal anxiety
        $minimal = ['gad7' => [0, 0, 0, 0, 0, 0, 0]];
        $resultMinimal = $this->scoringService->calculateRiskScore($minimal);
        $this->assertEquals('minimal', $resultMinimal['risk_band']);

        // Severe anxiety
        $severe = ['gad7' => [3, 3, 3, 3, 3, 3, 3]];
        $resultSevere = $this->scoringService->calculateRiskScore($severe);
        $this->assertEquals('critical', $resultSevere['risk_band']);
    }

    /**
     * @test
     * Test composite scoring (multiple questionnaires)
     */
    public function test_composite_scoring_multiple_questionnaires()
    {
        // Arrange
        $answers = [
            'phq9' => [2, 2, 2, 2, 2, 2, 2, 2, 2], // Moderate depression
            'gad7' => [2, 2, 2, 2, 2, 2, 2],       // Moderate anxiety
        ];

        // Act
        $result = $this->scoringService->calculateRiskScore($answers);

        // Assert
        $this->assertArrayHasKey('composite_score', $result);
        $this->assertArrayHasKey('phq9_score', $result);
        $this->assertArrayHasKey('gad7_score', $result);
    }

    /**
     * @test
     * Test that scoring includes clinical flags
     */
    public function test_scoring_includes_clinical_flags()
    {
        // Arrange - Answers indicating suicide risk
        $answers = ['phq9' => [1, 1, 1, 1, 1, 1, 1, 1, 3]];

        // Act
        $result = $this->scoringService->calculateRiskScore($answers);

        // Assert
        $this->assertArrayHasKey('clinical_flags', $result);
        $this->assertContains('suicide_risk', $result['clinical_flags']);
    }

    /**
     * @test
     * Test performance: Scoring should complete quickly
     */
    public function test_scoring_performance()
    {
        // Arrange
        $answers = ['phq9' => [2, 2, 2, 2, 2, 2, 2, 2, 2]];

        // Act
        $startTime = microtime(true);

        for ($i = 0; $i < 100; $i++) {
            $this->scoringService->calculateRiskScore($answers);
        }

        $endTime = microtime(true);
        $duration = ($endTime - $startTime) * 1000; // Convert to milliseconds

        // Assert - 100 calculations should complete in under 500ms
        $this->assertLessThan(500, $duration);
    }
}
