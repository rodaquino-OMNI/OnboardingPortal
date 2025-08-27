<?php

namespace Tests\Performance;

use App\Models\User;
use App\Models\Beneficiary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ApiPerformanceTest extends TestCase
{
    use DatabaseTransactions;

    private $metrics = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->metrics = [
            'queries' => [],
            'response_times' => [],
            'memory_usage' => [],
            'cache_hits' => 0,
            'cache_misses' => 0
        ];
        
        // Enable query logging
        DB::enableQueryLog();
    }

    /**
     * Test health endpoint performance
     */
    public function test_health_endpoint_performance()
    {
        $startTime = microtime(true);
        $startMemory = memory_get_usage();
        
        $response = $this->get('/api/health');
        
        $endTime = microtime(true);
        $endMemory = memory_get_usage();
        
        $this->recordMetrics('health_endpoint', [
            'response_time' => ($endTime - $startTime) * 1000, // ms
            'memory_used' => $endMemory - $startMemory,
            'queries' => count(DB::getQueryLog()),
            'status' => $response->getStatusCode()
        ]);
        
        $response->assertStatus(200);
        $this->assertLessThan(200, ($endTime - $startTime) * 1000, 'Health endpoint should respond in under 200ms');
        $this->assertLessThan(5, count(DB::getQueryLog()), 'Health endpoint should use minimal database queries');
    }

    /**
     * Test auth check-email performance
     */
    public function test_auth_check_email_performance()
    {
        DB::flushQueryLog();
        $startTime = microtime(true);
        $startMemory = memory_get_usage();
        
        $response = $this->postJson('/api/auth/check-email', [
            'email' => 'test@example.com'
        ]);
        
        $endTime = microtime(true);
        $endMemory = memory_get_usage();
        
        $this->recordMetrics('auth_check_email', [
            'response_time' => ($endTime - $startTime) * 1000,
            'memory_used' => $endMemory - $startMemory,
            'queries' => count(DB::getQueryLog()),
            'status' => $response->getStatusCode()
        ]);
        
        $response->assertStatus(200);
        $this->assertLessThan(500, ($endTime - $startTime) * 1000, 'Email check should respond in under 500ms');
        $this->assertLessThan(3, count(DB::getQueryLog()), 'Email check should use minimal queries');
    }

    /**
     * Test authentication flow performance
     */
    public function test_authentication_flow_performance()
    {
        // Create test user
        $user = User::factory()->create([
            'email' => 'performance.test@example.com',
            'password' => bcrypt('password123'),
            'is_active' => true
        ]);

        // Create beneficiary
        Beneficiary::factory()->create(['user_id' => $user->id]);

        DB::flushQueryLog();
        $startTime = microtime(true);
        $startMemory = memory_get_usage();
        
        $response = $this->postJson('/api/auth/login', [
            'email' => 'performance.test@example.com',
            'password' => 'password123'
        ]);
        
        $endTime = microtime(true);
        $endMemory = memory_get_usage();
        
        $queries = DB::getQueryLog();
        
        $this->recordMetrics('auth_login', [
            'response_time' => ($endTime - $startTime) * 1000,
            'memory_used' => $endMemory - $startMemory,
            'queries' => count($queries),
            'status' => $response->getStatusCode(),
            'query_details' => $queries
        ]);
        
        $response->assertStatus(200);
        $this->assertLessThan(1000, ($endTime - $startTime) * 1000, 'Login should complete in under 1 second');
        
        // Check for N+1 queries
        $this->checkForN1Queries($queries);
    }

    /**
     * Test concurrent request handling
     */
    public function test_concurrent_request_simulation()
    {
        $concurrentRequests = 10;
        $responseTimes = [];
        
        for ($i = 0; $i < $concurrentRequests; $i++) {
            $startTime = microtime(true);
            
            $response = $this->get('/api/health');
            
            $endTime = microtime(true);
            $responseTimes[] = ($endTime - $startTime) * 1000;
            
            $response->assertStatus(200);
        }
        
        $avgResponseTime = array_sum($responseTimes) / count($responseTimes);
        $maxResponseTime = max($responseTimes);
        
        $this->recordMetrics('concurrent_requests', [
            'concurrent_requests' => $concurrentRequests,
            'avg_response_time' => $avgResponseTime,
            'max_response_time' => $maxResponseTime,
            'response_times' => $responseTimes
        ]);
        
        $this->assertLessThan(300, $avgResponseTime, 'Average response time should be under 300ms under load');
        $this->assertLessThan(1000, $maxResponseTime, 'Max response time should be under 1s under load');
    }

    /**
     * Test health questionnaire submission performance
     */
    public function test_health_questionnaire_performance()
    {
        $user = User::factory()->create(['is_active' => true]);
        Beneficiary::factory()->create(['user_id' => $user->id]);
        
        $this->actingAs($user, 'sanctum');
        
        DB::flushQueryLog();
        $startTime = microtime(true);
        $startMemory = memory_get_usage();
        
        $response = $this->postJson('/api/health-questionnaires/submit-unified', [
            'responses' => [
                'phq2_1' => 2,
                'phq2_2' => 1,
                'gad2_1' => 1,
                'gad2_2' => 0,
                'pain_severity' => 5,
                'who5_1' => 3,
                'who5_2' => 2,
                'who5_3' => 3,
                'who5_4' => 2,
                'who5_5' => 3
            ],
            'risk_scores' => [
                'depression' => 30,
                'anxiety' => 25,
                'pain' => 50,
                'wellbeing' => 65
            ],
            'completed_domains' => ['mental_health', 'pain', 'lifestyle'],
            'total_risk_score' => 42.5,
            'risk_level' => 'moderate',
            'recommendations' => [
                'Consider speaking with a healthcare provider',
                'Regular exercise and stress management'
            ],
            'fraud_detection_score' => 15
        ]);
        
        $endTime = microtime(true);
        $endMemory = memory_get_usage();
        
        $queries = DB::getQueryLog();
        
        $this->recordMetrics('health_questionnaire_submit', [
            'response_time' => ($endTime - $startTime) * 1000,
            'memory_used' => $endMemory - $startMemory,
            'queries' => count($queries),
            'status' => $response->getStatusCode(),
            'query_details' => $queries
        ]);
        
        $response->assertStatus(200);
        $this->assertLessThan(2000, ($endTime - $startTime) * 1000, 'Health questionnaire submission should complete in under 2 seconds');
        
        // Check for N+1 queries
        $this->checkForN1Queries($queries);
    }

    /**
     * Test rate limiting implementation
     */
    public function test_rate_limiting_enforcement()
    {
        $requests = [];
        $rateLimitHit = false;
        
        // Send requests until rate limit is hit
        for ($i = 0; $i < 100; $i++) {
            $startTime = microtime(true);
            $response = $this->postJson('/api/auth/check-email', [
                'email' => "test{$i}@example.com"
            ]);
            $endTime = microtime(true);
            
            $requests[] = [
                'request_number' => $i + 1,
                'status' => $response->getStatusCode(),
                'response_time' => ($endTime - $startTime) * 1000,
                'headers' => [
                    'x-ratelimit-limit' => $response->headers->get('X-RateLimit-Limit'),
                    'x-ratelimit-remaining' => $response->headers->get('X-RateLimit-Remaining')
                ]
            ];
            
            if ($response->getStatusCode() === 429) {
                $rateLimitHit = true;
                break;
            }
        }
        
        $this->recordMetrics('rate_limiting', [
            'total_requests' => count($requests),
            'rate_limit_hit' => $rateLimitHit,
            'requests_before_limit' => $rateLimitHit ? count($requests) - 1 : count($requests),
            'request_details' => $requests
        ]);
        
        $this->assertTrue($rateLimitHit, 'Rate limiting should be enforced');
    }

    /**
     * Check for N+1 query problems
     */
    private function checkForN1Queries(array $queries)
    {
        $queryPatterns = [];
        $potentialN1 = [];
        
        foreach ($queries as $query) {
            $sql = $query['query'];
            $pattern = preg_replace('/\d+/', '?', $sql); // Replace numbers with placeholders
            
            if (!isset($queryPatterns[$pattern])) {
                $queryPatterns[$pattern] = 0;
            }
            $queryPatterns[$pattern]++;
            
            // Flag patterns that occur more than 3 times (potential N+1)
            if ($queryPatterns[$pattern] > 3) {
                $potentialN1[$pattern] = $queryPatterns[$pattern];
            }
        }
        
        if (!empty($potentialN1)) {
            $this->recordMetrics('n1_queries_detected', $potentialN1);
        }
        
        $this->assertEmpty($potentialN1, 'No N+1 query patterns should be detected. Found: ' . json_encode($potentialN1));
    }

    /**
     * Record performance metrics
     */
    private function recordMetrics(string $operation, array $data)
    {
        $this->metrics[$operation] = $data;
        
        // Output metrics for debugging
        echo "\n=== PERFORMANCE METRICS: {$operation} ===\n";
        echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
    }

    protected function tearDown(): void
    {
        // Store final metrics
        file_put_contents(
            storage_path('logs/api_performance_metrics_' . date('Y-m-d_H-i-s') . '.json'),
            json_encode($this->metrics, JSON_PRETTY_PRINT)
        );
        
        parent::tearDown();
    }
}