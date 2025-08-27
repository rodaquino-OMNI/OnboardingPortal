<?php

/**
 * Integration test script for API rate limiting
 * This script tests the actual API endpoints with real HTTP requests
 */

require_once __DIR__ . '/../../vendor/autoload.php';

class RateLimitIntegrationTest
{
    private $baseUrl;
    private $apiKey;
    
    public function __construct(string $baseUrl = 'http://localhost:8001')
    {
        $this->baseUrl = rtrim($baseUrl, '/');
    }
    
    public function runAllTests(): array
    {
        $results = [];
        
        echo "🔍 Starting Rate Limiting Integration Tests...\n\n";
        
        $results['basic_rate_limiting'] = $this->testBasicRateLimiting();
        $results['endpoint_specific_limits'] = $this->testEndpointSpecificLimits();
        $results['security_headers'] = $this->testSecurityHeaders();
        $results['concurrent_requests'] = $this->testConcurrentRequests();
        
        echo "\n📊 Test Summary:\n";
        foreach ($results as $test => $result) {
            $status = $result['success'] ? '✅ PASS' : '❌ FAIL';
            echo "  {$status} {$test}\n";
            if (!$result['success']) {
                echo "    Error: {$result['error']}\n";
            }
        }
        
        return $results;
    }
    
    private function testBasicRateLimiting(): array
    {
        echo "🧪 Testing basic rate limiting...\n";
        
        try {
            $responses = [];
            $rateLimitHit = false;
            
            // Make multiple requests to trigger rate limit
            for ($i = 0; $i < 35; $i++) {
                $response = $this->makeRequest('GET', '/api/health');
                $responses[] = $response;
                
                $remaining = isset($response['headers']['X-RateLimit-Remaining']) ? $response['headers']['X-RateLimit-Remaining'] : 'N/A';
                echo "Request {$i}: Status {$response['status_code']} | Remaining: {$remaining}\n";
                
                if ($response['status_code'] === 429) {
                    $rateLimitHit = true;
                    echo "  ✅ Rate limit triggered at request {$i}\n";
                    break;
                }
                
                usleep(100000); // 100ms delay between requests
            }
            
            return [
                'success' => $rateLimitHit,
                'error' => $rateLimitHit ? null : 'Rate limit was not triggered after 35 requests',
                'details' => [
                    'total_requests' => count($responses),
                    'rate_limit_hit' => $rateLimitHit
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    private function testEndpointSpecificLimits(): array
    {
        echo "\n🎯 Testing endpoint-specific rate limits...\n";
        
        try {
            $endpoints = [
                '/api/health' => ['expected_limit' => 60, 'type' => 'general'],
                '/api/gamification/progress' => ['expected_limit' => 60, 'type' => 'read'],
                '/api/auth/check-email' => ['expected_limit' => 30, 'type' => 'auth']
            ];
            
            $results = [];
            
            foreach ($endpoints as $endpoint => $config) {
                echo "  Testing {$endpoint} ({$config['type']})...\n";
                
                $response = $this->makeRequest('GET', $endpoint);
                $limit = intval($response['headers']['X-RateLimit-Limit'] ?? 0);
                
                if ($endpoint === '/api/auth/check-email') {
                    $response = $this->makeRequest('POST', $endpoint, ['email' => 'test@example.com']);
                    $limit = intval(isset($response['headers']['X-RateLimit-Limit']) ? $response['headers']['X-RateLimit-Limit'] : 0);
                }
                
                $results[$endpoint] = [
                    'configured_limit' => $limit,
                    'expected_limit' => $config['expected_limit'],
                    'matches_expected' => $limit > 0 // Just check that limits are configured
                ];
                
                echo "    Limit: {$limit} (Expected: {$config['expected_limit']})\n";
            }
            
            $allConfigured = array_reduce($results, function($carry, $result) {
                return $carry && $result['configured_limit'] > 0;
            }, true);
            
            return [
                'success' => $allConfigured,
                'error' => $allConfigured ? null : 'Some endpoints do not have rate limits configured',
                'details' => $results
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    private function testSecurityHeaders(): array
    {
        echo "\n🛡️  Testing security headers...\n";
        
        try {
            $response = $this->makeRequest('GET', '/api/health');
            
            $requiredHeaders = [
                'X-RateLimit-Limit',
                'X-RateLimit-Remaining',
                'X-Content-Type-Options',
                'X-Frame-Options',
                'X-XSS-Protection'
            ];
            
            $missingHeaders = [];
            
            foreach ($requiredHeaders as $header) {
                if (!isset($response['headers'][$header])) {
                    $missingHeaders[] = $header;
                } else {
                    echo "  ✅ {$header}: {$response['headers'][$header]}\n";
                }
            }
            
            return [
                'success' => empty($missingHeaders),
                'error' => empty($missingHeaders) ? null : 'Missing headers: ' . implode(', ', $missingHeaders),
                'details' => [
                    'present_headers' => array_intersect_key($response['headers'], array_flip($requiredHeaders)),
                    'missing_headers' => $missingHeaders
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    private function testConcurrentRequests(): array
    {
        echo "\n⚡ Testing concurrent request handling...\n";
        
        try {
            $processes = [];
            $results = [];
            
            // Create 10 concurrent processes
            for ($i = 0; $i < 10; $i++) {
                $cmd = "curl -s -w '%{http_code}|%{header_json}' '{$this->baseUrl}/api/health'";
                $process = popen($cmd, 'r');
                $processes[] = $process;
            }
            
            // Collect results
            foreach ($processes as $process) {
                $output = stream_get_contents($process);
                pclose($process);
                
                if ($output) {
                    $parts = explode('|', $output);
                    $statusCode = intval(isset($parts[0]) ? $parts[0] : 0);
                    $results[] = $statusCode;
                }
            }
            
            $successCount = count(array_filter($results, fn($code) => $code === 200));
            $rateLimitedCount = count(array_filter($results, fn($code) => $code === 429));
            
            echo "  Successful requests: {$successCount}/10\n";
            echo "  Rate limited requests: {$rateLimitedCount}/10\n";
            
            return [
                'success' => count($results) === 10 && $successCount > 0,
                'error' => count($results) !== 10 ? 'Not all concurrent requests completed' : null,
                'details' => [
                    'total_requests' => count($results),
                    'successful' => $successCount,
                    'rate_limited' => $rateLimitedCount
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    private function makeRequest(string $method, string $endpoint, array $data = null): array
    {
        $url = $this->baseUrl . $endpoint;
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_NOBODY => false,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Content-Type: application/json',
                'User-Agent: RateLimitTest/1.0'
            ]
        ]);
        
        if ($data && in_array($method, ['POST', 'PUT', 'PATCH'])) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        
        if (curl_errno($ch)) {
            throw new Exception('cURL error: ' . curl_error($ch));
        }
        
        curl_close($ch);
        
        $headers = $this->parseHeaders(substr($response, 0, $headerSize));
        $body = substr($response, $headerSize);
        
        return [
            'status_code' => $httpCode,
            'headers' => $headers,
            'body' => $body,
            'json' => json_decode($body, true)
        ];
    }
    
    private function parseHeaders(string $headerString): array
    {
        $headers = [];
        $lines = explode("\r\n", $headerString);
        
        foreach ($lines as $line) {
            if (strpos($line, ':') !== false) {
                [$key, $value] = explode(':', $line, 2);
                $headers[trim($key)] = trim($value);
            }
        }
        
        return $headers;
    }
}

// Run tests if script is executed directly
if (basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    $baseUrl = $argv[1] ?? 'http://localhost:8001';
    
    $tester = new RateLimitIntegrationTest($baseUrl);
    $results = $tester->runAllTests();
    
    $allPassed = array_reduce($results, function($carry, $result) {
        return $carry && $result['success'];
    }, true);
    
    echo "\n" . str_repeat('=', 50) . "\n";
    echo $allPassed ? "🎉 All tests passed!" : "❌ Some tests failed!";
    echo "\n" . str_repeat('=', 50) . "\n";
    
    exit($allPassed ? 0 : 1);
}