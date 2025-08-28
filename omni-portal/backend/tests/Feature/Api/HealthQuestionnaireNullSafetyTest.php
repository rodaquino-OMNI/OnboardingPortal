<?php

namespace Tests\Feature\Api;

use App\Models\User;
use App\Models\Beneficiary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HealthQuestionnaireNullSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $beneficiary;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->user = User::factory()->create([
            'email_verified_at' => now()
        ]);
        
        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $this->user->id
        ]);

        Sanctum::actingAs($this->user);
    }

    public function test_submit_unified_handles_null_completed_domains()
    {
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'responses' => ['phq9_1' => 2, 'gad7_1' => 1],
            'completed_domains' => null,
            'risk_level' => 'low'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Unified health assessment submitted successfully'
            ]);
    }

    public function test_submit_unified_handles_empty_array_completed_domains()
    {
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'responses' => ['phq9_1' => 2, 'gad7_1' => 1],
            'completed_domains' => [],
            'risk_level' => 'low'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Unified health assessment submitted successfully'
            ]);
    }

    public function test_submit_unified_rejects_invalid_completed_domains_type()
    {
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'responses' => ['phq9_1' => 2, 'gad7_1' => 1],
            'completed_domains' => 'not_an_array',
            'risk_level' => 'low'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['completed_domains']);
    }

    public function test_submit_unified_handles_null_risk_level()
    {
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'responses' => ['phq9_1' => 2, 'gad7_1' => 1],
            'completed_domains' => ['mental_health'],
            'risk_level' => null
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Unified health assessment submitted successfully'
            ]);
    }

    public function test_submit_unified_requires_non_empty_responses()
    {
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'responses' => [],
            'completed_domains' => ['mental_health'],
            'risk_level' => 'low'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['responses']);
    }

    public function test_submit_unified_validates_risk_level_consistency()
    {
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'responses' => ['phq9_1' => 2, 'gad7_1' => 1],
            'total_risk_score' => 85,
            'risk_level' => 'low' // Should be 'critical' for score 85
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['risk_level']);
    }

    public function test_submit_unified_handles_all_null_optional_fields()
    {
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'responses' => ['phq9_1' => 2, 'gad7_1' => 1],
            'risk_scores' => null,
            'completed_domains' => null,
            'total_risk_score' => null,
            'risk_level' => null,
            'recommendations' => null,
            'next_steps' => null,
            'fraud_detection_score' => null,
            'timestamp' => null
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Unified health assessment submitted successfully'
            ]);
    }

    public function test_calculate_risk_level_helper_works_correctly()
    {
        // This tests the private calculateRiskLevel method indirectly
        $testCases = [
            ['score' => 90, 'expected' => 'critical'],
            ['score' => 75, 'expected' => 'high'],
            ['score' => 50, 'expected' => 'moderate'],
            ['score' => 25, 'expected' => 'low'],
            ['score' => 0, 'expected' => 'low']
        ];

        foreach ($testCases as $case) {
            $response = $this->postJson('/api/health-questionnaires/submit-unified', [
                'responses' => ['phq9_1' => 2, 'gad7_1' => 1],
                'total_risk_score' => $case['score'],
                'risk_level' => $case['expected']
            ]);

            $response->assertStatus(200, 
                "Failed for score {$case['score']} expecting {$case['expected']}"
            );
        }
    }
}