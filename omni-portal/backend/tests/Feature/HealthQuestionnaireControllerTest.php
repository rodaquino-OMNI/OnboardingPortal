<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\QuestionnaireTemplate;
use App\Models\HealthQuestionnaire;
use App\Services\HealthAIService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

class HealthQuestionnaireControllerTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $beneficiary;
    protected $template;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create(['user_id' => $this->user->id]);
        
        $this->template = QuestionnaireTemplate::factory()->create([
            'code' => 'initial_health_assessment',
            'sections' => [
                [
                    'title' => 'Informações Básicas',
                    'questions' => [
                        [
                            'id' => 'height',
                            'text' => 'Qual é sua altura?',
                            'type' => 'number',
                            'required' => true
                        ],
                        [
                            'id' => 'weight',
                            'text' => 'Qual é seu peso?',
                            'type' => 'number',
                            'required' => true
                        ]
                    ]
                ]
            ]
        ]);
    }

    /** @test */
    public function it_can_get_questionnaire_templates()
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/health-questionnaires/templates');

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        '*' => [
                            'id',
                            'name',
                            'code',
                            'description',
                            'estimated_minutes',
                            'sections'
                        ]
                    ]
                ]);
    }

    /** @test */
    public function it_can_start_a_new_questionnaire()
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/health-questionnaires/start', [
            'template_id' => $this->template->id
        ]);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'id',
                        'beneficiary_id',
                        'template_id',
                        'responses',
                        'score',
                        'risk_level'
                    ]
                ]);

        $this->assertDatabaseHas('health_questionnaires', [
            'beneficiary_id' => $this->beneficiary->id,
            'template_id' => $this->template->id
        ]);
    }

    /** @test */
    public function it_prevents_starting_duplicate_questionnaires()
    {
        Sanctum::actingAs($this->user);

        // Create existing questionnaire
        HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'template_id' => $this->template->id,
            'completed_at' => null
        ]);

        $response = $this->postJson('/api/health-questionnaires/start', [
            'template_id' => $this->template->id
        ]);

        $response->assertStatus(200)
                ->assertJson([
                    'success' => true,
                    'message' => 'Questionnaire already started'
                ]);
    }

    /** @test */
    public function it_validates_template_id_when_starting_questionnaire()
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/health-questionnaires/start', [
            'template_id' => 99999 // Non-existent template
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['template_id']);
    }

    /** @test */
    public function it_can_save_questionnaire_responses()
    {
        Sanctum::actingAs($this->user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'template_id' => $this->template->id
        ]);

        $responses = [
            'height' => 175,
            'weight' => 70
        ];

        $response = $this->putJson("/api/health-questionnaires/{$questionnaire->id}/responses", [
            'responses' => $responses,
            'section_id' => 'section_0',
            'is_complete' => false
        ]);

        $response->assertStatus(200)
                ->assertJson(['success' => true]);

        $questionnaire->refresh();
        $this->assertEquals($responses, $questionnaire->responses);
    }

    /** @test */
    public function it_validates_responses_data()
    {
        Sanctum::actingAs($this->user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id
        ]);

        $response = $this->putJson("/api/health-questionnaires/{$questionnaire->id}/responses", [
            'section_id' => 'section_0'
            // Missing responses
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['responses']);
    }

    /** @test */
    public function it_can_get_questionnaire_progress()
    {
        Sanctum::actingAs($this->user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'template_id' => $this->template->id,
            'responses' => ['height' => 175] // Partial responses
        ]);

        $response = $this->getJson("/api/health-questionnaires/{$questionnaire->id}/progress");

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'questionnaire',
                        'progress' => [
                            'percentage',
                            'current_section',
                            'answered_questions',
                            'total_questions'
                        ],
                        'completion_percentage',
                        'total_sections'
                    ]
                ]);
    }

    /** @test */
    public function it_can_get_ai_insights()
    {
        Sanctum::actingAs($this->user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'responses' => ['chronic_conditions' => ['diabetes']]
        ]);

        // Mock successful AI response
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => json_encode([
                            'response' => 'Diabetes é uma condição que requer cuidado constante.',
                            'confidence' => 0.9,
                            'follow_up_questions' => ['Há quanto tempo você tem diabetes?'],
                            'detected_conditions' => ['diabetes'],
                            'recommendations' => ['Monitorar glicemia regularmente']
                        ])
                    ]
                ]
            ], 200)
        ]);

        $response = $this->postJson("/api/health-questionnaires/{$questionnaire->id}/ai-insights", [
            'question' => 'O que preciso saber sobre diabetes?',
            'context' => ['age' => 35]
        ]);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'response',
                        'confidence',
                        'follow_up_questions',
                        'detected_conditions',
                        'recommendations'
                    ]
                ]);
    }

    /** @test */
    public function it_validates_ai_insights_request()
    {
        Sanctum::actingAs($this->user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id
        ]);

        $response = $this->postJson("/api/health-questionnaires/{$questionnaire->id}/ai-insights", [
            // Missing question
            'context' => []
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['question']);
    }

    /** @test */
    public function it_handles_ai_service_errors_gracefully()
    {
        Sanctum::actingAs($this->user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id
        ]);

        // Mock AI service failure
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response('Service Error', 503)
        ]);

        $response = $this->postJson("/api/health-questionnaires/{$questionnaire->id}/ai-insights", [
            'question' => 'Test question'
        ]);

        $response->assertStatus(503)
                ->assertJson([
                    'success' => false,
                    'message' => 'AI service temporarily unavailable'
                ]);
    }

    /** @test */
    public function it_prevents_unauthorized_access_to_questionnaires()
    {
        $otherUser = User::factory()->create();
        $otherBeneficiary = Beneficiary::factory()->create(['user_id' => $otherUser->id]);
        
        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $otherBeneficiary->id
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->getJson("/api/health-questionnaires/{$questionnaire->id}/progress");
        $response->assertStatus(404);

        $response = $this->putJson("/api/health-questionnaires/{$questionnaire->id}/responses", [
            'responses' => ['test' => 'value'],
            'section_id' => 'section_0'
        ]);
        $response->assertStatus(404);
    }

    /** @test */
    public function it_completes_questionnaire_and_calculates_score()
    {
        Sanctum::actingAs($this->user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $this->beneficiary->id,
            'template_id' => $this->template->id
        ]);

        // Mock AI service for recommendations
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'text' => json_encode([
                            'lifestyle' => ['Manter atividade física regular'],
                            'diet' => ['Consumir mais vegetais'],
                            'exercise' => ['30 minutos de caminhada diária']
                        ])
                    ]
                ]
            ], 200)
        ]);

        $response = $this->putJson("/api/health-questionnaires/{$questionnaire->id}/responses", [
            'responses' => [
                'height' => 175,
                'weight' => 70
            ],
            'section_id' => 'section_0',
            'is_complete' => true
        ]);

        $response->assertStatus(200);

        $questionnaire->refresh();
        $this->assertNotNull($questionnaire->completed_at);
        $this->assertNotNull($questionnaire->score);
        $this->assertNotNull($questionnaire->risk_level);
        $this->assertNotNull($questionnaire->recommendations);
    }

    /** @test */
    public function it_requires_authentication_for_all_endpoints()
    {
        $endpoints = [
            ['GET', '/api/health-questionnaires/templates', []],
            ['POST', '/api/health-questionnaires/start', ['template_id' => 1]],
            ['GET', '/api/health-questionnaires/1/progress', []],
            ['PUT', '/api/health-questionnaires/1/responses', ['responses' => [], 'section_id' => 'test']],
            ['POST', '/api/health-questionnaires/1/ai-insights', ['question' => 'test']]
        ];

        foreach ($endpoints as $endpoint) {
            $method = $endpoint[0];
            $url = $endpoint[1];
            $data = $endpoint[2] ?? [];
            $response = $this->json($method, $url, $data);
            $response->assertStatus(401);
        }
    }
}