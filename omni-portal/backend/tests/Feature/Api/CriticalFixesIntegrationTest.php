<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\GamificationProgress;
use App\Models\GamificationBadge;
use App\Models\HealthQuestionnaire;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

/**
 * Critical Fixes Integration Test Suite
 * Tests the backend integration for gamification and health questionnaire fixes
 */
class CriticalFixesIntegrationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $user;
    protected $headers;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $this->headers = [
            'Authorization' => 'Bearer ' . $this->user->createToken('test')->plainTextToken,
            'Accept' => 'application/json',
        ];

        // Setup test database state
        $this->seed();
    }

    /** @test */
    public function it_handles_gamification_system_repair_integration()
    {
        // Test gamification initialization with proper coordination
        $response = $this->getJson('/api/gamification/user-stats', $this->headers);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'points',
                        'level',
                        'badges',
                        'achievements',
                        'leaderboard_position',
                        'coordination_hooks' => [
                            'claude_flow_integration',
                            'swarm_coordination_id'
                        ]
                    ]
                ]);

        // Verify coordination hooks are properly configured
        $data = $response->json('data');
        $this->assertArrayHasKey('coordination_hooks', $data);
        $this->assertTrue($data['coordination_hooks']['claude_flow_integration']);
    }

    /** @test */
    public function it_processes_health_questionnaire_unified_flow()
    {
        // Start unified health questionnaire
        $response = $this->postJson('/api/health-questionnaires/unified/start', [
            'template_code' => 'unified_health_assessment',
            'coordination_mode' => 'claude_flow_enhanced'
        ], $this->headers);

        $response->assertStatus(201)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'questionnaire_id',
                        'flow_state' => [
                            'current_domain',
                            'current_layer',
                            'progress_percentage',
                            'estimated_time_remaining'
                        ],
                        'unified_components' => [
                            'triage_engine_active',
                            'progressive_disclosure_enabled',
                            'ai_assistance_ready'
                        ]
                    ]
                ]);

        $questionnaireId = $response->json('data.questionnaire_id');
        
        // Test unified response processing
        $unifiedResponse = $this->postJson("/api/health-questionnaires/{$questionnaireId}/unified-response", [
            'question_id' => 'age',
            'response' => 35,
            'response_metadata' => [
                'input_method' => 'unified_component',
                'validation_passed' => true,
                'ai_assistance_used' => false
            ]
        ], $this->headers);

        $unifiedResponse->assertStatus(200)
                       ->assertJsonStructure([
                           'success',
                           'data' => [
                               'next_question' => [
                                   'id',
                                   'text',
                                   'type',
                                   'domain',
                                   'unified_rendering_config'
                               ],
                               'flow_transition' => [
                                   'from_domain',
                                   'to_domain',
                                   'transition_reason'
                               ],
                               'gamification_events' => [
                                   'points_awarded',
                                   'badges_unlocked',
                                   'achievements_unlocked'
                               ]
                           ]
                       ]);
    }

    /** @test */
    public function it_handles_concurrent_gamification_operations()
    {
        // Simulate concurrent point additions (race condition test)
        $promises = [];
        
        for ($i = 0; $i < 10; $i++) {
            $promises[] = $this->postJson('/api/gamification/add-points', [
                'points' => 10,
                'reason' => "concurrent_test_{$i}",
                'coordination_id' => 'swarm-test-123'
            ], $this->headers);
        }

        // All requests should succeed
        foreach ($promises as $response) {
            $response->assertStatus(200);
        }

        // Verify final point total is correct (100 points total)
        $finalStats = $this->getJson('/api/gamification/user-stats', $this->headers);
        $finalPoints = $finalStats->json('data.points');
        
        $this->assertEquals(100, $finalPoints);
    }

    /** @test */
    public function it_validates_badge_assignment_system_repair()
    {
        // Test health questionnaire completion badge
        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $this->user->id,
            'status' => 'in_progress'
        ]);

        // Complete questionnaire
        $response = $this->postJson("/api/health-questionnaires/{$questionnaire->id}/complete", [
            'completion_metadata' => [
                'total_questions' => 25,
                'completion_time_minutes' => 8,
                'ai_assistance_used' => true,
                'unified_flow_used' => true
            ]
        ], $this->headers);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'questionnaire_status',
                        'gamification_rewards' => [
                            'points_awarded',
                            'badges_unlocked' => [
                                '*' => [
                                    'id',
                                    'name',
                                    'description',
                                    'icon',
                                    'unlock_criteria_met'
                                ]
                            ],
                            'level_progression'
                        ]
                    ]
                ]);

        // Verify specific badges were unlocked
        $badges = $response->json('data.gamification_rewards.badges_unlocked');
        $badgeIds = array_column($badges, 'id');
        
        $this->assertContains('health_questionnaire_master', $badgeIds);
        $this->assertContains('unified_flow_expert', $badgeIds);
    }

    /** @test */
    public function it_handles_health_questionnaire_domain_transitions()
    {
        $questionnaire = HealthQuestionnaire::factory()->create([
            'user_id' => $this->user->id,
            'status' => 'in_progress'
        ]);

        // Submit triage responses that should trigger pain domain
        $response = $this->postJson("/api/health-questionnaires/{$questionnaire->id}/domain-transition", [
            'current_domain' => 'triage',
            'trigger_responses' => [
                'pain_severity' => 8,
                'pain_duration' => 'chronic',
                'pain_impact' => 'severe'
            ],
            'unified_flow_context' => [
                'user_age' => 45,
                'emergency_screening_passed' => true,
                'progressive_disclosure_active' => true
            ]
        ], $this->headers);

        $response->assertStatus(200)
                ->assertJson([
                    'success' => true,
                    'data' => [
                        'domain_transition' => [
                            'from' => 'triage',
                            'to' => 'pain_management',
                            'transition_type' => 'automatic_progressive',
                            'reason' => 'high_pain_score_detected'
                        ],
                        'next_questions_preview' => [
                            'count' => 8,
                            'estimated_time_minutes' => 4,
                            'requires_specialist_review' => true
                        ]
                    ]
                ]);
    }

    /** @test */
    public function it_maintains_state_consistency_across_components()
    {
        // Start questionnaire
        $startResponse = $this->postJson('/api/health-questionnaires/unified/start', [
            'template_code' => 'unified_health_assessment'
        ], $this->headers);

        $questionnaireId = $startResponse->json('data.questionnaire_id');

        // Submit multiple responses
        $responses = [
            ['question_id' => 'age', 'response' => 35],
            ['question_id' => 'gender', 'response' => 'male'],
            ['question_id' => 'emergency_check', 'response' => ['none']],
            ['question_id' => 'pain_severity', 'response' => 6]
        ];

        foreach ($responses as $responseData) {
            $this->postJson("/api/health-questionnaires/{$questionnaireId}/unified-response", 
                $responseData, $this->headers)
                ->assertStatus(200);
        }

        // Verify state consistency
        $stateResponse = $this->getJson("/api/health-questionnaires/{$questionnaireId}/state", $this->headers);
        
        $stateResponse->assertStatus(200)
                     ->assertJsonStructure([
                         'success',
                         'data' => [
                             'questionnaire_state' => [
                                 'responses_count',
                                 'current_domain',
                                 'progress_percentage',
                                 'state_checksum'
                             ],
                             'gamification_state' => [
                                 'points_accumulated',
                                 'badges_progress',
                                 'achievements_unlocked'
                             ],
                             'unified_flow_state' => [
                                 'active_components',
                                 'domain_progression',
                                 'ai_insights_available'
                             ]
                         ]
                     ]);

        // Verify data integrity
        $state = $stateResponse->json('data');
        $this->assertEquals(4, $state['questionnaire_state']['responses_count']);
        $this->assertEquals('pain_management', $state['questionnaire_state']['current_domain']);
        $this->assertGreaterThan(0, $state['gamification_state']['points_accumulated']);
    }

    /** @test */
    public function it_handles_api_failure_recovery_gracefully()
    {
        // Simulate database connection failure
        \DB::shouldReceive('transaction')->andThrow(new \Exception('Database connection lost'));

        $response = $this->postJson('/api/gamification/add-points', [
            'points' => 50,
            'reason' => 'failure_test'
        ], $this->headers);

        // Should return appropriate error response
        $response->assertStatus(503)
                ->assertJson([
                    'success' => false,
                    'error' => 'service_temporarily_unavailable',
                    'message' => 'Sistema temporariamente indisponível. Tente novamente.',
                    'retry_after' => 30
                ]);
    }

    /** @test */
    public function it_validates_performance_under_load()
    {
        $startTime = microtime(true);

        // Simulate high load scenario
        $responses = [];
        for ($i = 0; $i < 50; $i++) {
            $responses[] = $this->postJson('/api/gamification/add-points', [
                'points' => 1,
                'reason' => "load_test_{$i}"
            ], $this->headers);
        }

        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds

        // Should complete within reasonable time (under 5 seconds)
        $this->assertLessThan(5000, $executionTime);

        // All requests should succeed
        foreach ($responses as $response) {
            $response->assertStatus(200);
        }

        // Verify final state is consistent
        $finalStats = $this->getJson('/api/gamification/user-stats', $this->headers);
        $this->assertEquals(50, $finalStats->json('data.points'));
    }

    /** @test */
    public function it_validates_security_measures_in_fixes()
    {
        // Test rate limiting on gamification endpoints
        for ($i = 0; $i < 61; $i++) {
            $response = $this->postJson('/api/gamification/add-points', [
                'points' => 1,
                'reason' => 'rate_limit_test'
            ], $this->headers);

            if ($i < 60) {
                $response->assertStatus(200);
            } else {
                $response->assertStatus(429); // Too Many Requests
            }
        }

        // Test input validation on health questionnaire
        $response = $this->postJson('/api/health-questionnaires/unified/start', [
            'template_code' => '<script>alert("xss")</script>',
            'malicious_param' => '../../etc/passwd'
        ], $this->headers);

        $response->assertStatus(422)
                ->assertJsonStructure([
                    'success',
                    'errors' => [
                        'template_code'
                    ]
                ]);
    }

    /** @test */
    public function it_validates_lgpd_compliance_in_fixes()
    {
        // Test data processing consent
        $response = $this->postJson('/api/health-questionnaires/unified/start', [
            'template_code' => 'unified_health_assessment',
            'consent' => [
                'data_processing' => true,
                'health_data_sharing' => false,
                'marketing_communications' => false
            ]
        ], $this->headers);

        $response->assertStatus(201)
                ->assertJsonPath('data.privacy_settings.data_processing_consented', true)
                ->assertJsonPath('data.privacy_settings.health_data_sharing_consented', false);

        // Test data anonymization in gamification
        $leaderboardResponse = $this->getJson('/api/gamification/leaderboard', $this->headers);
        
        $leaderboardResponse->assertStatus(200);
        
        $leaderboardData = $leaderboardResponse->json('data.top_users');
        foreach ($leaderboardData as $user) {
            // Personal identifiers should be anonymized
            $this->assertStringNotContainsString('@', $user['display_name'] ?? '');
            $this->assertArrayNotHasKey('email', $user);
            $this->assertArrayNotHasKey('cpf', $user);
        }
    }

    /** @test */
    public function it_validates_monitoring_and_alerting_integration()
    {
        // Test error tracking integration
        $response = $this->postJson('/api/gamification/add-points', [
            'points' => 'invalid_type', // Should trigger error
            'reason' => 'monitoring_test'
        ], $this->headers);

        $response->assertStatus(422);

        // Verify error was logged for monitoring
        $this->assertDatabaseHas('error_logs', [
            'user_id' => $this->user->id,
            'endpoint' => '/api/gamification/add-points',
            'error_type' => 'validation_error'
        ]);

        // Test performance metrics collection
        $metricsResponse = $this->getJson('/api/system/health-check', $this->headers);
        
        $metricsResponse->assertStatus(200)
                       ->assertJsonStructure([
                           'status',
                           'metrics' => [
                               'gamification_system' => [
                                   'response_time_ms',
                                   'success_rate',
                                   'active_users'
                               ],
                               'health_questionnaire' => [
                                   'completion_rate',
                                   'average_completion_time',
                                   'unified_flow_adoption'
                               ]
                           ]
                       ]);
    }

    protected function tearDown(): void
    {
        Cache::flush();
        Queue::fake();
        parent::tearDown();
    }
}