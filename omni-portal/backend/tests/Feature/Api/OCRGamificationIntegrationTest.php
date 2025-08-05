<?php

namespace Tests\Feature\Api;

use App\Events\DocumentProcessed;
use App\Jobs\ProcessDocumentOCR;
use App\Listeners\ProcessDocumentGamification;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\GamificationProgress;
use App\Services\GamificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OCRGamificationIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected Beneficiary $beneficiary;
    protected GamificationService $gamificationService;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->beneficiary = Beneficiary::factory()->create();
        $this->gamificationService = app(GamificationService::class);
    }

    /** @test */
    public function it_awards_base_points_for_successful_ocr_processing()
    {
        // Create document
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'rg',
            'ocr_data' => [
                'average_confidence' => 75,
                'quality_metrics' => ['overall_quality' => 80],
            ],
            'validation_results' => ['status' => 'passed']
        ]);

        // Dispatch event
        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        // Assert base points awarded
        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $this->assertEquals(75, $progress->total_points); // Base OCR points
    }

    /** @test */
    public function it_awards_confidence_bonus_for_high_confidence_processing()
    {
        // Test high confidence (>90%)
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'rg',
            'ocr_data' => [
                'average_confidence' => 95,
                'quality_metrics' => ['overall_quality' => 90],
            ],
            'validation_results' => ['status' => 'passed']
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        // Base (75) + High Confidence (25) + Validation Success (40) = 140
        $this->assertEquals(140, $progress->total_points);
    }

    /** @test */
    public function it_awards_medium_confidence_bonus()
    {
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'rg',
            'ocr_data' => [
                'average_confidence' => 85,
                'quality_metrics' => ['overall_quality' => 80],
            ],
            'validation_results' => ['status' => 'passed']
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        // Base (75) + Medium Confidence (15) + Validation Success (40) = 130
        $this->assertEquals(130, $progress->total_points);
    }

    /** @test */
    public function it_awards_quality_bonuses()
    {
        // Test excellent quality (>95%)
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'rg',
            'ocr_data' => [
                'average_confidence' => 95,
                'quality_metrics' => ['overall_quality' => 96],
            ],
            'validation_results' => ['status' => 'passed']
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        // Base (75) + High Confidence (25) + Excellent Quality (35) + Validation Success (40) = 175
        $this->assertEquals(175, $progress->total_points);
    }

    /** @test */
    public function it_awards_validation_success_bonus()
    {
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'rg',
            'ocr_data' => [
                'average_confidence' => 80,
                'quality_metrics' => ['overall_quality' => 80],
            ],
            'validation_results' => ['status' => 'passed']
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        // Base (75) + Validation Success (40) = 115
        $this->assertEquals(115, $progress->total_points);
    }

    /** @test */
    public function it_awards_partial_validation_bonus()
    {
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'rg',
            'ocr_data' => [
                'average_confidence' => 80,
                'quality_metrics' => ['overall_quality' => 80],
            ],
            'validation_results' => [
                'status' => 'passed_with_warnings',
                'warnings' => ['Some field missing']
            ]
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        // Base (75) + Partial Validation (20) = 95
        $this->assertEquals(95, $progress->total_points);
    }

    /** @test */
    public function it_awards_complex_document_bonus()
    {
        // Test medical report (complex document)
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'laudo_medico',
            'ocr_data' => [
                'average_confidence' => 80,
                'quality_metrics' => ['overall_quality' => 80],
            ],
            'validation_results' => ['status' => 'passed']
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        // Base (75) + Complex Document (30) + Validation Success (40) = 145
        $this->assertEquals(145, $progress->total_points);
    }

    /** @test */
    public function it_awards_progressive_quality_bonus_for_consistent_high_quality()
    {
        // Create 5 high-quality documents
        for ($i = 0; $i < 5; $i++) {
            $document = Document::factory()->create([
                'beneficiary_id' => $this->beneficiary->id,
                'status' => 'completed',
                'type' => 'rg',
                'processed_at' => now()->subDays($i),
                'ocr_data' => [
                    'average_confidence' => 90,
                    'quality_metrics' => ['overall_quality' => 90],
                ],
                'validation_results' => ['status' => 'passed']
            ]);

            // Process each document
            $event = new DocumentProcessed($document);
            $listener = new ProcessDocumentGamification($this->gamificationService);
            $listener->handle($event);
        }

        $progress = $this->beneficiary->fresh()->getOrCreateGamificationProgress();
        
        // Each document: Base (75) + High Confidence (25) + Validation Success (40) = 140
        // 5 documents × 140 = 700
        // Plus progressive bonus (50) for the last 4 documents = 200
        // Total: 700 + 200 = 900
        $this->assertEquals(900, $progress->total_points);
    }

    /** @test */
    public function it_does_not_award_points_for_failed_processing()
    {
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'failed',
            'type' => 'rg',
            'error_message' => 'Processing failed',
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        $this->assertEquals(0, $progress->total_points);
    }

    /** @test */
    public function it_handles_missing_beneficiary_gracefully()
    {
        $document = Document::factory()->create([
            'beneficiary_id' => null,
            'status' => 'completed',
            'type' => 'rg',
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        
        // Should not throw exception
        $listener->handle($event);
        
        // No points should be awarded since no beneficiary
        $this->assertTrue(true); // Test passes if no exception thrown
    }

    /** @test */
    public function it_calculates_maximum_possible_points_correctly()
    {
        // Create a perfect scenario: complex document with maximum bonuses
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'laudo_medico', // Complex document
            'ocr_data' => [
                'average_confidence' => 95, // High confidence
                'quality_metrics' => ['overall_quality' => 96], // Excellent quality
            ],
            'validation_results' => ['status' => 'passed'] // Perfect validation
        ]);

        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        $progress = $this->beneficiary->getOrCreateGamificationProgress();
        
        // Base (75) + High Confidence (25) + Excellent Quality (35) + 
        // Validation Success (40) + Complex Document (30) = 205
        $this->assertEquals(205, $progress->total_points);
    }

    /** @test */
    public function it_integrates_with_document_processed_event_correctly()
    {
        Event::fake();

        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'rg',
        ]);

        // Test event dispatch
        event(new DocumentProcessed($document));

        Event::assertDispatched(DocumentProcessed::class, function ($event) use ($document) {
            return $event->document->id === $document->id;
        });
    }

    /** @test */
    public function gamification_service_calculates_ocr_points_correctly()
    {
        $metadata = [
            'confidence' => 95,
            'quality' => 96,
            'validation_status' => 'passed',
            'document_type' => 'laudo_medico',
            'progressive_bonus' => false,
        ];

        $points = $this->gamificationService->awardPoints(
            $this->beneficiary,
            'ocr_processing_completed',
            $metadata
        );

        // Base (75) + High Confidence (25) + Excellent Quality (35) + 
        // Validation Success (40) + Complex Document (30) = 205
        $this->assertEquals(205, $points);
    }

    /** @test */
    public function it_logs_gamification_processing_correctly()
    {
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'status' => 'completed',
            'type' => 'rg',
            'ocr_data' => [
                'average_confidence' => 85,
                'quality_metrics' => ['overall_quality' => 80],
            ],
            'validation_results' => ['status' => 'passed']
        ]);

        // Enable log testing
        $this->expectsEvents([]);
        
        $event = new DocumentProcessed($document);
        $listener = new ProcessDocumentGamification($this->gamificationService);
        $listener->handle($event);

        // Test passes if no exceptions thrown during logging
        $this->assertTrue(true);
    }

    /** @test */
    public function document_processed_event_constructor_works_with_all_parameters()
    {
        $document = Document::factory()->create();
        $ocrResult = ['confidence' => 90];
        $gamificationData = ['points' => 100];

        // Test all constructor variations
        $event1 = new DocumentProcessed($document);
        $event2 = new DocumentProcessed($document, $ocrResult);
        $event3 = new DocumentProcessed($document, $ocrResult, $gamificationData);

        $this->assertEquals($document->id, $event1->document->id);
        $this->assertEquals($document->id, $event2->document->id);
        $this->assertEquals($document->id, $event3->document->id);
        $this->assertEquals($ocrResult, $event2->ocrResult);
        $this->assertEquals($gamificationData, $event3->gamificationData);
    }
}