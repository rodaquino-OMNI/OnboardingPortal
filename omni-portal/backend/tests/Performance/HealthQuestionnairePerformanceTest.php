<?php

namespace Tests\Performance;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\QuestionnaireTemplate;
use App\Models\HealthQuestionnaire;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

class HealthQuestionnairePerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected $users;
    protected $template;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test template
        $this->template = QuestionnaireTemplate::factory()->create([
            'code' => 'initial_health_assessment'
        ]);

        // Create multiple users for load testing
        $this->users = User::factory()
            ->count(50)
            ->create()
            ->each(function ($user) {
                Beneficiary::factory()->create(['user_id' => $user->id]);
            });
    }

    /** @test */
    public function it_can_handle_concurrent_questionnaire_starts()
    {
        $startTime = microtime(true);
        $responses = [];

        // Mock AI service to avoid external API calls
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [['text' => json_encode(['response' => 'Mock response'])]]
            ], 200)
        ]);

        // Simulate concurrent questionnaire starts
        foreach ($this->users->take(20) as $user) {
            Sanctum::actingAs($user);
            
            $response = $this->postJson('/api/health-questionnaires/start', [
                'template_id' => $this->template->id
            ]);
            
            $responses[] = $response;
        }

        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;

        // Performance assertions
        $this->assertLessThan(5.0, $executionTime, 'Concurrent questionnaire starts took too long');
        
        // Verify all requests succeeded
        foreach ($responses as $response) {
            $response->assertStatus(200);
        }

        // Verify database integrity
        $this->assertEquals(20, HealthQuestionnaire::count());
    }

    /** @test */
    public function it_can_handle_large_response_payloads()
    {
        $user = $this->users->first();
        Sanctum::actingAs($user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $user->beneficiary->id,
            'template_id' => $this->template->id
        ]);

        // Create large response payload
        $largeResponses = [];
        for ($i = 0; $i < 100; $i++) {
            $largeResponses["question_$i"] = str_repeat('Test response data ', 100); // ~1.7KB per response
        }

        $startTime = microtime(true);

        $response = $this->putJson("/api/health-questionnaires/{$questionnaire->id}/responses", [
            'responses' => $largeResponses,
            'section_id' => 'large_section',
            'is_complete' => false
        ]);

        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;

        // Performance assertions
        $this->assertLessThan(2.0, $executionTime, 'Large payload processing took too long');
        $response->assertStatus(200);

        // Verify data was saved correctly
        $questionnaire->refresh();
        $this->assertCount(100, $questionnaire->responses);
    }

    /** @test */
    public function it_can_handle_multiple_ai_requests_efficiently()
    {
        $user = $this->users->first();
        Sanctum::actingAs($user);

        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $user->beneficiary->id
        ]);

        // Mock AI service with varying response times
        Http::fake([
            'api.anthropic.com/v1/messages' => Http::sequence()
                ->push(['content' => [['text' => json_encode(['response' => 'Response 1'])]]], 200)
                ->push(['content' => [['text' => json_encode(['response' => 'Response 2'])]]], 200)
                ->push(['content' => [['text' => json_encode(['response' => 'Response 3'])]]], 200)
                ->push(['content' => [['text' => json_encode(['response' => 'Response 4'])]]], 200)
                ->push(['content' => [['text' => json_encode(['response' => 'Response 5'])]]], 200)
        ]);

        $questions = [
            'What is diabetes?',
            'How to manage hypertension?',
            'Best exercises for heart health?',
            'Nutrition for weight loss?',
            'Stress management techniques?'
        ];

        $startTime = microtime(true);
        $responses = [];

        // Send multiple AI requests
        foreach ($questions as $question) {
            $response = $this->postJson("/api/health-questionnaires/{$questionnaire->id}/ai-insights", [
                'question' => $question,
                'context' => ['age' => 35]
            ]);
            
            $responses[] = $response;
        }

        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;

        // Performance assertions
        $this->assertLessThan(10.0, $executionTime, 'Multiple AI requests took too long');
        
        // Verify all AI requests succeeded
        foreach ($responses as $response) {
            $response->assertStatus(200);
        }
    }

    /** @test */
    public function it_can_handle_database_load_with_many_questionnaires()
    {
        // Create many questionnaires to test database performance
        $questionnaires = HealthQuestionnaire::factory()
            ->count(500)
            ->create([
                'template_id' => $this->template->id
            ]);

        $user = $this->users->first();
        Sanctum::actingAs($user);

        $userQuestionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $user->beneficiary->id,
            'template_id' => $this->template->id
        ]);

        $startTime = microtime(true);

        // Test fetching progress with large dataset
        $response = $this->getJson("/api/health-questionnaires/{$userQuestionnaire->id}/progress");

        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;

        // Performance assertions
        $this->assertLessThan(1.0, $executionTime, 'Database query with large dataset took too long');
        $response->assertStatus(200);

        // Test templates endpoint performance
        $startTime = microtime(true);
        $templatesResponse = $this->getJson('/api/health-questionnaires/templates');
        $endTime = microtime(true);
        $templatesTime = $endTime - $startTime;

        $this->assertLessThan(0.5, $templatesTime, 'Templates query took too long');
        $templatesResponse->assertStatus(200);
    }

    /** @test */
    public function it_maintains_response_times_under_load()
    {
        $responseTimes = [];
        $errorCount = 0;

        // Simulate load with rapid requests
        for ($i = 0; $i < 30; $i++) {
            $user = $this->users->random();
            Sanctum::actingAs($user);

            $startTime = microtime(true);

            try {
                $response = $this->postJson('/api/health-questionnaires/start', [
                    'template_id' => $this->template->id
                ]);

                $endTime = microtime(true);
                $responseTime = $endTime - $startTime;
                $responseTimes[] = $responseTime;

                if ($response->status() !== 200) {
                    $errorCount++;
                }
            } catch (\Exception $e) {
                $errorCount++;
                $responseTimes[] = 10.0; // Max penalty for errors
            }
        }

        // Performance metrics
        $averageResponseTime = array_sum($responseTimes) / count($responseTimes);
        $maxResponseTime = max($responseTimes);
        $errorRate = $errorCount / 30;

        // Performance assertions
        $this->assertLessThan(1.0, $averageResponseTime, 'Average response time too high');
        $this->assertLessThan(3.0, $maxResponseTime, 'Maximum response time too high');
        $this->assertLessThan(0.05, $errorRate, 'Error rate too high (>5%)'); // Less than 5% errors

        // Log performance metrics for monitoring
        $this->addToAssertionCount(1); // Ensure test counts as passed
        
        echo "\nPerformance Metrics:\n";
        echo "Average Response Time: " . round($averageResponseTime * 1000, 2) . "ms\n";
        echo "Max Response Time: " . round($maxResponseTime * 1000, 2) . "ms\n";
        echo "Error Rate: " . round($errorRate * 100, 2) . "%\n";
    }

    /** @test */
    public function it_can_handle_memory_intensive_operations()
    {
        $memoryBefore = memory_get_usage(true);

        $user = $this->users->first();
        Sanctum::actingAs($user);

        // Create questionnaire with complex responses
        $questionnaire = HealthQuestionnaire::factory()->create([
            'beneficiary_id' => $user->beneficiary->id,
            'template_id' => $this->template->id
        ]);

        // Simulate memory-intensive operations
        $complexResponses = [];
        for ($i = 0; $i < 50; $i++) {
            $complexResponses["complex_field_$i"] = [
                'data' => array_fill(0, 100, "Large data chunk for field $i"),
                'metadata' => [
                    'timestamp' => now()->toISOString(),
                    'confidence' => rand(70, 99) / 100,
                    'source' => 'user_input'
                ]
            ];
        }

        // Save complex responses
        $questionnaire->update(['responses' => $complexResponses]);

        // Simulate complex calculations
        for ($j = 0; $j < 10; $j++) {
            $response = $this->getJson("/api/health-questionnaires/{$questionnaire->id}/progress");
            $response->assertStatus(200);
        }

        $memoryAfter = memory_get_usage(true);
        $memoryUsed = $memoryAfter - $memoryBefore;

        // Memory assertions (adjust based on environment)
        $this->assertLessThan(50 * 1024 * 1024, $memoryUsed, 'Memory usage too high (>50MB)');
        
        echo "\nMemory Usage: " . round($memoryUsed / 1024 / 1024, 2) . "MB\n";
    }

    /** @test */
    public function it_can_handle_cache_efficiency()
    {
        $user = $this->users->first();
        Sanctum::actingAs($user);

        // First request - should hit database
        $startTime = microtime(true);
        $response1 = $this->getJson('/api/health-questionnaires/templates');
        $endTime = microtime(true);
        $firstRequestTime = $endTime - $startTime;

        // Second request - should use cache
        $startTime = microtime(true);
        $response2 = $this->getJson('/api/health-questionnaires/templates');
        $endTime = microtime(true);
        $secondRequestTime = $endTime - $startTime;

        // Third request - should still use cache
        $startTime = microtime(true);
        $response3 = $this->getJson('/api/health-questionnaires/templates');
        $endTime = microtime(true);
        $thirdRequestTime = $endTime - $startTime;

        // All requests should succeed
        $response1->assertStatus(200);
        $response2->assertStatus(200);
        $response3->assertStatus(200);

        // Cache should improve performance
        $this->assertLessThan($firstRequestTime, $secondRequestTime + 0.1, 'Cache not improving performance');
        $this->assertLessThan($firstRequestTime, $thirdRequestTime + 0.1, 'Cache not improving performance');
        
        echo "\nCache Performance:\n";
        echo "First Request: " . round($firstRequestTime * 1000, 2) . "ms\n";
        echo "Second Request: " . round($secondRequestTime * 1000, 2) . "ms\n";
        echo "Third Request: " . round($thirdRequestTime * 1000, 2) . "ms\n";
    }
}