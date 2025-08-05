<?php

namespace Tests\Unit;

use App\Models\Beneficiary;
use App\Services\GamificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GamificationOCRPointsTest extends TestCase
{
    use RefreshDatabase;

    protected GamificationService $gamificationService;
    protected Beneficiary $beneficiary;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->gamificationService = app(GamificationService::class);
        $this->beneficiary = Beneficiary::factory()->create();
    }

    /** @test */
    public function ocr_point_constants_are_defined_correctly()
    {
        $points = GamificationService::POINTS;

        // Test all OCR-related constants exist
        $this->assertArrayHasKey('ocr_processing_completed', $points);
        $this->assertArrayHasKey('ocr_high_confidence', $points);
        $this->assertArrayHasKey('ocr_medium_confidence', $points);
        $this->assertArrayHasKey('ocr_quality_excellent', $points);
        $this->assertArrayHasKey('ocr_quality_good', $points);
        $this->assertArrayHasKey('ocr_validation_success', $points);
        $this->assertArrayHasKey('ocr_validation_partial', $points);
        $this->assertArrayHasKey('ocr_progressive_quality', $points);
        $this->assertArrayHasKey('ocr_complex_document', $points);

        // Test point values are reasonable
        $this->assertEquals(75, $points['ocr_processing_completed']);
        $this->assertEquals(25, $points['ocr_high_confidence']);
        $this->assertEquals(15, $points['ocr_medium_confidence']);
        $this->assertEquals(35, $points['ocr_quality_excellent']);
        $this->assertEquals(20, $points['ocr_quality_good']);
        $this->assertEquals(40, $points['ocr_validation_success']);
        $this->assertEquals(20, $points['ocr_validation_partial']);
        $this->assertEquals(50, $points['ocr_progressive_quality']);
        $this->assertEquals(30, $points['ocr_complex_document']);
    }

    /** @test */
    public function calculate_ocr_points_with_minimum_scenario()
    {
        $metadata = [
            'confidence' => 50, // Below thresholds
            'quality' => 50,    // Below thresholds
            'validation_status' => 'failed',
            'document_type' => 'rg', // Simple document
            'progressive_bonus' => false,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Only base points should be awarded
        $this->assertEquals(75, $points);
    }

    /** @test */
    public function calculate_ocr_points_with_medium_confidence()
    {
        $metadata = [
            'confidence' => 85, // Medium confidence (80-89%)
            'quality' => 70,
            'validation_status' => 'unknown',
            'document_type' => 'rg',
            'progressive_bonus' => false,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + Medium Confidence (15) = 90
        $this->assertEquals(90, $points);
    }

    /** @test */
    public function calculate_ocr_points_with_high_confidence()
    {
        $metadata = [
            'confidence' => 95, // High confidence (>90%)
            'quality' => 70,
            'validation_status' => 'unknown',
            'document_type' => 'rg',
            'progressive_bonus' => false,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + High Confidence (25) = 100
        $this->assertEquals(100, $points);
    }

    /** @test */
    public function calculate_ocr_points_with_good_quality()
    {
        $metadata = [
            'confidence' => 70,
            'quality' => 88, // Good quality (85-94%)
            'validation_status' => 'unknown',
            'document_type' => 'rg',
            'progressive_bonus' => false,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + Good Quality (20) = 95
        $this->assertEquals(95, $points);
    }

    /** @test */
    public function calculate_ocr_points_with_excellent_quality()
    {
        $metadata = [
            'confidence' => 70,
            'quality' => 96, // Excellent quality (>95%)
            'validation_status' => 'unknown',
            'document_type' => 'rg',
            'progressive_bonus' => false,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + Excellent Quality (35) = 110
        $this->assertEquals(110, $points);
    }

    /** @test */
    public function calculate_ocr_points_with_validation_success()
    {
        $metadata = [
            'confidence' => 70,
            'quality' => 70,
            'validation_status' => 'passed',
            'document_type' => 'rg',
            'progressive_bonus' => false,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + Validation Success (40) = 115
        $this->assertEquals(115, $points);
    }

    /** @test */
    public function calculate_ocr_points_with_partial_validation()
    {
        $metadata = [
            'confidence' => 70,
            'quality' => 70,
            'validation_status' => 'passed_with_warnings',
            'document_type' => 'rg',
            'progressive_bonus' => false,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + Partial Validation (20) = 95
        $this->assertEquals(95, $points);
    }

    /** @test */
    public function calculate_ocr_points_with_complex_documents()
    {
        $complexDocuments = ['laudo_medico', 'formulario', 'comprovante_residencia'];
        
        foreach ($complexDocuments as $docType) {
            $metadata = [
                'confidence' => 70,
                'quality' => 70,
                'validation_status' => 'unknown',
                'document_type' => $docType,
                'progressive_bonus' => false,
            ];

            $points = $this->gamificationService->awardPoints(
                $this->beneficiary,
                'ocr_processing_completed',
                $metadata
            );

            // Base (75) + Complex Document (30) = 105
            $this->assertEquals(105, $points, "Failed for document type: {$docType}");
        }
    }

    /** @test */
    public function calculate_ocr_points_with_progressive_bonus()
    {
        $metadata = [
            'confidence' => 70,
            'quality' => 70,
            'validation_status' => 'unknown',
            'document_type' => 'rg',
            'progressive_bonus' => true,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + Progressive Bonus (50) = 125
        $this->assertEquals(125, $points);
    }

    /** @test */
    public function calculate_ocr_points_maximum_scenario()
    {
        $metadata = [
            'confidence' => 95,    // High confidence bonus
            'quality' => 96,       // Excellent quality bonus
            'validation_status' => 'passed', // Validation success bonus
            'document_type' => 'laudo_medico', // Complex document bonus
            'progressive_bonus' => true, // Progressive bonus
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + High Confidence (25) + Excellent Quality (35) + 
        // Validation Success (40) + Complex Document (30) + Progressive (50) = 255
        $this->assertEquals(255, $points);
    }

    /** @test */
    public function ocr_points_are_added_to_beneficiary_progress()
    {
        $initialProgress = $this->beneficiary->getOrCreateGamificationProgress();
        $initialPoints = $initialProgress->total_points;

        $metadata = [
            'confidence' => 85,
            'quality' => 80,
            'validation_status' => 'passed',
            'document_type' => 'rg',
            'progressive_bonus' => false,
        ];

        $pointsAwarded = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        $updatedProgress = $this->beneficiary->fresh()->getOrCreateGamificationProgress();
        
        $this->assertEquals(
            $initialPoints + $pointsAwarded,
            $updatedProgress->total_points
        );
    }

    /** @test */
    public function non_ocr_actions_still_work_correctly()
    {
        // Test that existing non-OCR actions still work
        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'registration',
            []
        );

        $this->assertEquals(100, $points);
    }

    /** @test */
    public function backward_compatibility_maintained()
    {
        // Test all existing point constants still exist
        $points = GamificationService::POINTS;
        
        $existingActions = [
            'registration' => 100,
            'profile_field' => 10,
            'health_question' => 20,
            'document_required' => 50,
            'document_optional' => 100,
            'interview_scheduled' => 150,
            'interview_completed' => 200,
            'profile_completed' => 50,
            'onboarding_completed' => 200,
            'daily_login' => 5,
            'streak_bonus' => 10,
            'telemedicine_scheduled' => 225,
            'telemedicine_completed' => 500,
            'telemedicine_preparation' => 100,
            'punctuality_bonus' => 50,
        ];

        foreach ($existingActions as $action => $expectedPoints) {
            $this->assertArrayHasKey($action, $points);
            $this->assertEquals($expectedPoints, $points[$action]);
        }
    }
}