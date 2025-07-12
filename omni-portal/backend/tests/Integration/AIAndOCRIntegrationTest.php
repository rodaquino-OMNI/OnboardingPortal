<?php

namespace Tests\Integration;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\HealthQuestionnaire;
use App\Models\QuestionnaireTemplate;
use App\Models\Document;
use App\Services\HealthAIService;
use App\Services\OCRService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

class AIAndOCRIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $beneficiary;
    protected $template;
    protected $questionnaire;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $this->user->id,
            'full_name' => 'João Silva Santos',
            'cpf' => '123.456.789-00',
            'birth_date' => '1990-05-15'
        ]);
        
        $this->template = QuestionnaireTemplate::factory()->create([
            'code' => 'initial_health_assessment'
        ]);
        
        $this->questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'template_id' => $this->template->id
        ]);
    }

    /** @test */
    public function it_can_detect_health_conditions_through_conversation_and_update_questionnaire()
    {
        Sanctum::actingAs($this->user);

        // Mock Claude API for condition detection
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => json_encode([
                            'response' => 'Entendi que você tem diabetes e toma metformina. É importante manter o controle glicêmico.',
                            'confidence' => 0.92,
                            'follow_up_questions' => [
                                'Há quanto tempo você tem diabetes?',
                                'Você monitora sua glicemia regularmente?'
                            ],
                            'detected_conditions' => ['diabetes'],
                            'recommendations' => [
                                'Manter dieta com baixo índice glicêmico',
                                'Praticar exercícios aeróbicos regularmente',
                                'Monitorar glicemia conforme orientação médica'
                            ]
                        ])
                    ]
                ]
            ], 200)
        ]);

        // User asks about their diabetes medication
        $response = $this->postJson("/api/health-questionnaires/{$this->questionnaire->id}/ai-insights", [
            'question' => 'Eu tomo metformina para diabetes, isso é normal?',
            'context' => [
                'age' => 34,
                'chronic_conditions' => []
            ]
        ]);

        $response->assertStatus(200);
        $aiData = $response->json('data');
        
        // Verify AI detected diabetes
        $this->assertContains('diabetes', $aiData['detected_conditions']);
        $this->assertGreaterThan(0.9, $aiData['confidence']);
        $this->assertStringContainsString('diabetes', $aiData['response']);
        $this->assertNotEmpty($aiData['recommendations']);

        // Now update questionnaire responses to include detected condition
        $updateResponse = $this->putJson("/api/health-questionnaires/{$this->questionnaire->id}/responses", [
            'responses' => [
                'chronic_conditions' => ['diabetes'], // Based on AI detection
                'current_medications' => ['metformina'],
                'height' => 175,
                'weight' => 80
            ],
            'section_id' => 'section_0',
            'is_complete' => true
        ]);

        $updateResponse->assertStatus(200);

        // Verify questionnaire was updated with AI insights
        $this->questionnaire->refresh();
        $this->assertEquals(['diabetes'], $this->questionnaire->responses['chronic_conditions']);
        $this->assertNotNull($this->questionnaire->completed_at);
        $this->assertNotNull($this->questionnaire->recommendations);
    }

    /** @test */
    public function it_can_process_document_with_ocr_and_cross_validate_with_beneficiary_data()
    {
        Sanctum::actingAs($this->user);

        // Create document record
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'type' => 'rg',
            'status' => 'processing'
        ]);

        // Mock OCR service with extracted data that matches beneficiary
        $ocrService = $this->app->make(OCRService::class);
        
        $mockOcrData = [
            'raw_text' => "REGISTRO GERAL\nNome: JOÃO SILVA SANTOS\nRG: 12.345.678-9\nData Nascimento: 15/05/1990",
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 0.95],
                ['key' => 'RG', 'value' => '12.345.678-9', 'confidence' => 0.98],
                ['key' => 'Data Nascimento', 'value' => '15/05/1990', 'confidence' => 0.92]
            ]
        ];

        // Extract structured data
        $extractedData = $ocrService->extractStructuredData('rg', $mockOcrData);
        
        // Validate against beneficiary data
        $validation = $ocrService->validateExtractedData('rg', $extractedData, $this->beneficiary);

        // Update document with OCR results
        $document->update([
            'ocr_data' => $extractedData,
            'validation_results' => $validation,
            'status' => $validation['is_valid'] ? 'approved' : 'rejected'
        ]);

        // Verify successful validation
        $this->assertTrue($validation['is_valid']);
        $this->assertEmpty($validation['errors']);
        $this->assertGreaterThan(80, $validation['confidence_score']);
        $this->assertEquals('approved', $document->fresh()->status);

        // Test API endpoint
        $response = $this->postJson("/api/documents/{$document->id}/validate-ocr");
        
        $response->assertStatus(200)
                ->assertJson([
                    'success' => true,
                    'data' => [
                        'validation' => [
                            'is_valid' => true
                        ]
                    ]
                ]);
    }

    /** @test */
    public function it_can_detect_inconsistencies_between_documents_and_questionnaire_responses()
    {
        Sanctum::actingAs($this->user);

        // User claims to be 25 years old in questionnaire
        $this->questionnaire->update([
            'responses' => [
                'age' => 25, // Inconsistent with birth_date (1990 = ~34 years old)
                'chronic_conditions' => ['nenhuma']
            ]
        ]);

        // Document shows birth date that indicates age ~34
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'type' => 'rg',
            'ocr_data' => [
                'name' => 'JOÃO SILVA SANTOS',
                'birth_date' => '15/05/1990'
            ],
            'status' => 'approved'
        ]);

        // Create a service to detect inconsistencies
        $inconsistencies = $this->detectDataInconsistencies($this->beneficiary);

        $this->assertNotEmpty($inconsistencies);
        $this->assertArrayHasKey('age_mismatch', $inconsistencies);
        $this->assertEquals(
            'Age in questionnaire (25) does not match calculated age from birth date (34)',
            $inconsistencies['age_mismatch']
        );
    }

    /** @test */
    public function it_can_use_ai_to_enhance_ocr_accuracy()
    {
        Sanctum::actingAs($this->user);

        // OCR extracted unclear text
        $unclearOcrData = [
            'raw_text' => "Nome: JOÃ0 S1LVA SANT0S\nRG: 12.345.67B-9", // Contains OCR errors (0 instead of O, B instead of 8)
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃ0 S1LVA SANT0S', 'confidence' => 0.65],
                ['key' => 'RG', 'value' => '12.345.67B-9', 'confidence' => 0.70]
            ]
        ];

        // Mock AI service to help correct OCR errors
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => json_encode([
                            'corrected_name' => 'JOÃO SILVA SANTOS',
                            'corrected_rg' => '12.345.678-9',
                            'confidence' => 0.88,
                            'corrections_made' => [
                                'Replaced 0 with O in name',
                                'Replaced 1 with I in name', 
                                'Replaced B with 8 in RG number'
                            ]
                        ])
                    ]
                ]
            ], 200)
        ]);

        $healthAIService = $this->app->make(HealthAIService::class);
        
        // Use AI to enhance OCR accuracy
        $correctedData = $healthAIService->enhanceOCRAccuracy($unclearOcrData, 'rg');

        $this->assertEquals('JOÃO SILVA SANTOS', $correctedData['corrected_name']);
        $this->assertEquals('12.345.678-9', $correctedData['corrected_rg']);
        $this->assertGreaterThan(0.8, $correctedData['confidence']);
    }

    /** @test */
    public function it_can_generate_comprehensive_health_profile_from_all_data_sources()
    {
        Sanctum::actingAs($this->user);

        // Complete questionnaire with health data
        $this->questionnaire->update([
            'responses' => [
                'height' => 175,
                'weight' => 85,
                'chronic_conditions' => ['diabetes', 'hipertensão'],
                'smoking' => 'Ex-fumante',
                'exercise_frequency' => '1-2 vezes',
                'stress_level' => 7
            ],
            'score' => 12.5,
            'risk_level' => 'high',
            'completed_at' => now()
        ]);

        // Add AI conversation insights
        $aiInsights = [
            'detected_conditions' => ['diabetes', 'hipertensão', 'ansiedade'],
            'medications' => ['metformina', 'losartana'],
            'lifestyle_factors' => ['sedentary', 'high_stress']
        ];

        // Add document validation results
        $documents = [
            Document::factory()->create([
                'beneficiary_id' => $this->beneficiary->id,
                'type' => 'rg',
                'status' => 'approved',
                'validation_results' => ['is_valid' => true, 'confidence_score' => 95]
            ])
        ];

        // Mock comprehensive health profile generation
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => json_encode([
                            'overall_risk_score' => 8.5,
                            'risk_category' => 'high',
                            'primary_concerns' => [
                                'Diabetes management',
                                'Hypertension control',
                                'Weight management',
                                'Stress reduction'
                            ],
                            'recommended_actions' => [
                                'Immediate medical consultation required',
                                'Start structured exercise program',
                                'Nutrition counseling',
                                'Stress management techniques'
                            ],
                            'follow_up_timeline' => '2 weeks',
                            'specialist_referrals' => ['endocrinologist', 'cardiologist']
                        ])
                    ]
                ]
            ], 200)
        ]);

        $healthAIService = $this->app->make(HealthAIService::class);
        
        $healthProfile = $healthAIService->generateComprehensiveHealthProfile(
            $this->beneficiary,
            $this->questionnaire,
            $aiInsights,
            $documents
        );

        $this->assertArrayHasKey('overall_risk_score', $healthProfile);
        $this->assertArrayHasKey('primary_concerns', $healthProfile);
        $this->assertArrayHasKey('recommended_actions', $healthProfile);
        $this->assertEquals('high', $healthProfile['risk_category']);
        $this->assertContains('Diabetes management', $healthProfile['primary_concerns']);
        $this->assertContains('endocrinologist', $healthProfile['specialist_referrals']);
    }

    /** @test */
    public function it_can_handle_complex_document_validation_scenarios()
    {
        Sanctum::actingAs($this->user);

        // Test scenario: Document name has slight differences but should still validate
        $document = Document::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'type' => 'rg'
        ]);

        $ocrService = $this->app->make(OCRService::class);

        // OCR extracted name with common variations
        $extractedData = [
            'name' => 'JOAO SILVA SANTOS', // Missing accent
            'birth_date' => '15/05/1990'
        ];

        $validation = $ocrService->validateExtractedData('rg', $extractedData, $this->beneficiary);

        // Should still validate with high confidence despite accent difference
        $this->assertTrue($validation['is_valid']);
        $this->assertGreaterThan(70, $validation['confidence_score']);
        
        // Test with more significant name difference
        $extractedData['name'] = 'MARIA OLIVEIRA COSTA';
        $validation = $ocrService->validateExtractedData('rg', $extractedData, $this->beneficiary);
        
        $this->assertFalse($validation['is_valid']);
        $this->assertContains('Nome no documento não confere', $validation['errors']);
    }

    /**
     * Helper method to detect data inconsistencies across sources
     */
    protected function detectDataInconsistencies(Beneficiary $beneficiary): array
    {
        $inconsistencies = [];
        
        // Check age consistency
        $birthDate = $beneficiary->birth_date;
        $currentAge = $birthDate ? $birthDate->diffInYears(now()) : null;
        
        $questionnaire = $beneficiary->healthQuestionnaires()->latest()->first();
        if ($questionnaire && isset($questionnaire->responses['age'])) {
            $reportedAge = $questionnaire->responses['age'];
            
            if ($currentAge && abs($currentAge - $reportedAge) > 2) {
                $inconsistencies['age_mismatch'] = 
                    "Age in questionnaire ($reportedAge) does not match calculated age from birth date ($currentAge)";
            }
        }
        
        return $inconsistencies;
    }
}