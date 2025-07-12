<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\HealthAIService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Config;

class HealthAIServiceTest extends TestCase
{
    protected $healthAIService;

    protected function setUp(): void
    {
        parent::setUp();
        
        Config::set('services.anthropic.api_key', 'test-api-key');
        $this->healthAIService = new HealthAIService();
    }

    /** @test */
    public function it_can_analyze_health_query_successfully()
    {
        // Mock successful Claude API response
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => json_encode([
                            'response' => 'Diabetes é uma condição crônica que afeta como seu corpo processa açúcar.',
                            'confidence' => 0.9,
                            'follow_up_questions' => ['Você tem histórico familiar de diabetes?'],
                            'detected_conditions' => ['diabetes'],
                            'recommendations' => ['Manter dieta balanceada', 'Exercitar-se regularmente']
                        ])
                    ]
                ]
            ], 200)
        ]);

        $result = $this->healthAIService->analyzeHealthQuery(
            'O que é diabetes?',
            ['chronic_conditions' => ['diabetes']],
            ['age' => 35]
        );

        $this->assertTrue(is_array($result));
        $this->assertArrayHasKey('response', $result);
        $this->assertArrayHasKey('confidence', $result);
        $this->assertStringContainsString('Diabetes', $result['response']);
        $this->assertEquals(0.9, $result['confidence']);
        $this->assertContains('diabetes', $result['detected_conditions']);
    }

    /** @test */
    public function it_handles_api_failures_gracefully()
    {
        // Mock failed API response
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response('Service Unavailable', 503)
        ]);

        $result = $this->healthAIService->analyzeHealthQuery('Test question');

        $this->assertArrayHasKey('response', $result);
        $this->assertArrayHasKey('confidence', $result);
        $this->assertStringContainsString('temporariamente indisponível', $result['response']);
        $this->assertEquals(0.5, $result['confidence']);
    }

    /** @test */
    public function it_can_generate_recommendations_by_risk_level()
    {
        $responses = [
            'smoking' => 'Fumo diariamente',
            'exercise_frequency' => 'Nunca',
            'alcohol' => 'Diariamente'
        ];

        // Mock successful API response
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => json_encode([
                            'lifestyle' => ['Parar de fumar imediatamente'],
                            'exercise' => ['Começar com caminhadas de 10 minutos'],
                            'diet' => ['Reduzir consumo de álcool'],
                            'medical_consultation' => 'Consulta urgente recomendada'
                        ])
                    ]
                ]
            ], 200)
        ]);

        $recommendations = $this->healthAIService->generateRecommendations($responses, 15.0, 'high');

        $this->assertArrayHasKey('lifestyle', $recommendations);
        $this->assertArrayHasKey('exercise', $recommendations);
        $this->assertArrayHasKey('diet', $recommendations);
        $this->assertIsArray($recommendations['lifestyle']);
    }

    /** @test */
    public function it_can_detect_preexisting_conditions()
    {
        $conversationText = "Eu tomo metformina para diabetes e lisinopril para pressão alta. Também tenho dores no peito às vezes.";

        // Mock successful condition detection response
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => json_encode([
                            'detected_conditions' => [
                                [
                                    'condition' => 'diabetes',
                                    'confidence' => 0.95,
                                    'evidence' => 'metformina',
                                    'type' => 'diagnosed'
                                ],
                                [
                                    'condition' => 'hipertensão',
                                    'confidence' => 0.90,
                                    'evidence' => 'lisinopril',
                                    'type' => 'diagnosed'
                                ]
                            ],
                            'medications' => ['metformina', 'lisinopril'],
                            'symptoms' => ['dores no peito'],
                            'confidence' => 0.88
                        ])
                    ]
                ]
            ], 200)
        ]);

        $result = $this->healthAIService->detectPreExistingConditions($conversationText);

        $this->assertArrayHasKey('detected_conditions', $result);
        $this->assertArrayHasKey('medications', $result);
        $this->assertArrayHasKey('symptoms', $result);
        $this->assertCount(2, $result['detected_conditions']);
        $this->assertContains('metformina', $result['medications']);
        $this->assertContains('lisinopril', $result['medications']);
        $this->assertContains('dores no peito', $result['symptoms']);
    }

    /** @test */
    public function it_provides_fallback_recommendations_for_different_risk_levels()
    {
        // Test high risk recommendations
        $highRiskRecs = $this->healthAIService->getDefaultRecommendations('high');
        $this->assertArrayHasKey('priority_actions', $highRiskRecs);
        $this->assertArrayHasKey('medical_consultation', $highRiskRecs);
        $this->assertStringContainsString('urgente', $highRiskRecs['medical_consultation']);

        // Test medium risk recommendations
        $mediumRiskRecs = $this->healthAIService->getDefaultRecommendations('medium');
        $this->assertArrayHasKey('priority_actions', $mediumRiskRecs);
        $this->assertContains('Agendar consulta médica nos próximos 30 dias', $mediumRiskRecs['priority_actions']);

        // Test low risk recommendations
        $lowRiskRecs = $this->healthAIService->getDefaultRecommendations('low');
        $this->assertArrayHasKey('priority_actions', $lowRiskRecs);
        $this->assertContains('Manter hábitos saudáveis atuais', $lowRiskRecs['priority_actions']);
    }

    /** @test */
    public function it_parses_ai_response_with_malformed_json()
    {
        // Mock response with malformed JSON
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => 'This is a plain text response without JSON formatting.'
                    ]
                ]
            ], 200)
        ]);

        $result = $this->healthAIService->analyzeHealthQuery('Test question');

        $this->assertArrayHasKey('response', $result);
        $this->assertArrayHasKey('confidence', $result);
        $this->assertEquals('This is a plain text response without JSON formatting.', $result['response']);
        $this->assertEquals(0.7, $result['confidence']);
    }

    /** @test */
    public function it_validates_request_timeout_handling()
    {
        // Mock timeout response
        Http::fake([
            'api.anthropic.com/v1/messages' => function () {
                throw new \GuzzleHttp\Exception\ConnectException(
                    'Connection timed out',
                    new \GuzzleHttp\Psr7\Request('POST', 'test')
                );
            }
        ]);

        $result = $this->healthAIService->analyzeHealthQuery('Test question');

        $this->assertArrayHasKey('response', $result);
        $this->assertStringContainsString('temporariamente indisponível', $result['response']);
        $this->assertEquals(0.5, $result['confidence']);
    }
}