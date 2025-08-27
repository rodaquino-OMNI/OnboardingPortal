<?php
/**
 * API Input Validation Security Tester
 * Tests input validation on all API endpoints
 */

class InputValidationTester
{
    private $baseUrl = 'http://localhost:8000/api';
    private $testResults = [];
    private $vulnerabilities = [];
    
    // Common attack payloads for testing
    private $xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        '\';alert("XSS");//',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>'
    ];
    
    private $sqlInjectionPayloads = [
        "' OR 1=1 --",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "1' OR '1'='1",
        "admin'--",
        "' OR 'x'='x",
        "1; DELETE FROM users WHERE 1=1 --"
    ];
    
    private $pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd'
    ];
    
    private $commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& id',
        '|| whoami',
        '`ls`',
        '$(id)',
        '; ping -c 1 127.0.0.1'
    ];
    
    private $oversizePayloads = [
        str_repeat('A', 10000),    // 10KB
        str_repeat('B', 100000),   // 100KB
        str_repeat('C', 1000000),  // 1MB
    ];
    
    public function __construct()
    {
        echo "🔍 API Input Validation Security Tester\n";
        echo "========================================\n";
    }
    
    /**
     * Test all known endpoints for input validation
     */
    public function runTests()
    {
        $endpoints = $this->getTestEndpoints();
        
        foreach ($endpoints as $endpoint) {
            echo "🎯 Testing endpoint: {$endpoint['method']} {$endpoint['path']}\n";
            $this->testEndpoint($endpoint);
        }
        
        $this->generateReport();
    }
    
    /**
     * Get list of endpoints to test
     */
    private function getTestEndpoints()
    {
        return [
            [
                'method' => 'POST',
                'path' => '/auth/login',
                'requires_auth' => false,
                'test_fields' => ['email', 'password', 'device_name'],
                'critical' => true
            ],
            [
                'method' => 'POST',
                'path' => '/auth/check-email',
                'requires_auth' => false,
                'test_fields' => ['email'],
                'critical' => false
            ],
            [
                'method' => 'POST',
                'path' => '/auth/check-cpf',
                'requires_auth' => false,
                'test_fields' => ['cpf'],
                'critical' => false
            ],
            [
                'method' => 'POST',
                'path' => '/auth/register',
                'requires_auth' => false,
                'test_fields' => ['name', 'email', 'password', 'cpf'],
                'critical' => true
            ],
            [
                'method' => 'POST',
                'path' => '/auth/register/step1',
                'requires_auth' => false,
                'test_fields' => ['name', 'email', 'cpf'],
                'critical' => true
            ],
            [
                'method' => 'GET',
                'path' => '/health',
                'requires_auth' => false,
                'test_fields' => [],
                'critical' => false
            ],
            [
                'method' => 'POST',
                'path' => '/health-questionnaires/submit-unified',
                'requires_auth' => true,
                'test_fields' => ['responses', 'risk_scores', 'completed_domains'],
                'critical' => true
            ]
        ];
    }
    
    /**
     * Test a specific endpoint
     */
    private function testEndpoint($endpoint)
    {
        $results = [
            'endpoint' => $endpoint,
            'tests' => []
        ];
        
        // Test XSS vulnerabilities
        $results['tests']['xss'] = $this->testXSS($endpoint);
        
        // Test SQL injection
        $results['tests']['sql_injection'] = $this->testSQLInjection($endpoint);
        
        // Test path traversal
        $results['tests']['path_traversal'] = $this->testPathTraversal($endpoint);
        
        // Test command injection
        $results['tests']['command_injection'] = $this->testCommandInjection($endpoint);
        
        // Test oversized inputs
        $results['tests']['oversize_input'] = $this->testOversizeInput($endpoint);
        
        // Test malformed JSON
        if ($endpoint['method'] === 'POST') {
            $results['tests']['malformed_json'] = $this->testMalformedJSON($endpoint);
        }
        
        // Test content type validation
        $results['tests']['content_type'] = $this->testContentTypeValidation($endpoint);
        
        // Test rate limiting
        $results['tests']['rate_limiting'] = $this->testRateLimiting($endpoint);
        
        $this->testResults[] = $results;
    }
    
    /**
     * Test XSS vulnerabilities
     */
    private function testXSS($endpoint)
    {
        $results = [];
        
        foreach ($this->xssPayloads as $payload) {
            $testData = $this->buildTestData($endpoint['test_fields'], $payload);
            $response = $this->makeRequest($endpoint['method'], $endpoint['path'], $testData);
            
            // Check if payload is reflected unescaped
            if ($response && strpos($response['body'], $payload) !== false) {
                $this->addVulnerability('XSS', $endpoint, $payload, 'Payload reflected unescaped');
                $results[] = ['payload' => $payload, 'vulnerable' => true];
            } else {
                $results[] = ['payload' => $payload, 'vulnerable' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Test SQL injection vulnerabilities
     */
    private function testSQLInjection($endpoint)
    {
        $results = [];
        
        foreach ($this->sqlInjectionPayloads as $payload) {
            $testData = $this->buildTestData($endpoint['test_fields'], $payload);
            $response = $this->makeRequest($endpoint['method'], $endpoint['path'], $testData);
            
            // Check for SQL error messages or unexpected behavior
            if ($response && $this->detectSQLError($response['body'])) {
                $this->addVulnerability('SQL_INJECTION', $endpoint, $payload, 'SQL error detected');
                $results[] = ['payload' => $payload, 'vulnerable' => true];
            } else {
                $results[] = ['payload' => $payload, 'vulnerable' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Test path traversal vulnerabilities
     */
    private function testPathTraversal($endpoint)
    {
        $results = [];
        
        foreach ($this->pathTraversalPayloads as $payload) {
            $testData = $this->buildTestData($endpoint['test_fields'], $payload);
            $response = $this->makeRequest($endpoint['method'], $endpoint['path'], $testData);
            
            // Check for file content or error messages
            if ($response && $this->detectPathTraversal($response['body'])) {
                $this->addVulnerability('PATH_TRAVERSAL', $endpoint, $payload, 'Path traversal detected');
                $results[] = ['payload' => $payload, 'vulnerable' => true];
            } else {
                $results[] = ['payload' => $payload, 'vulnerable' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Test command injection vulnerabilities
     */
    private function testCommandInjection($endpoint)
    {
        $results = [];
        
        foreach ($this->commandInjectionPayloads as $payload) {
            $testData = $this->buildTestData($endpoint['test_fields'], $payload);
            $response = $this->makeRequest($endpoint['method'], $endpoint['path'], $testData);
            
            // Check for command output
            if ($response && $this->detectCommandExecution($response['body'])) {
                $this->addVulnerability('COMMAND_INJECTION', $endpoint, $payload, 'Command execution detected');
                $results[] = ['payload' => $payload, 'vulnerable' => true];
            } else {
                $results[] = ['payload' => $payload, 'vulnerable' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Test oversized input handling
     */
    private function testOversizeInput($endpoint)
    {
        $results = [];
        
        foreach ($this->oversizePayloads as $payload) {
            $testData = $this->buildTestData($endpoint['test_fields'], $payload);
            $response = $this->makeRequest($endpoint['method'], $endpoint['path'], $testData);
            
            // Check if server handles oversized input properly
            if (!$response || $response['status'] !== 413) {
                $this->addVulnerability('OVERSIZED_INPUT', $endpoint, 'Large payload', 
                    'Server may not properly handle large inputs');
                $results[] = ['size' => strlen($payload), 'handled_properly' => false];
            } else {
                $results[] = ['size' => strlen($payload), 'handled_properly' => true];
            }
        }
        
        return $results;
    }
    
    /**
     * Test malformed JSON handling
     */
    private function testMalformedJSON($endpoint)
    {
        $malformedPayloads = [
            '{"incomplete": ',
            '{"unclosed": "string}',
            '{invalid: json}',
            '{"nested": {"incomplete":}}',
            'not json at all',
            '{"unicode": "\\uXXXX"}'
        ];
        
        $results = [];
        
        foreach ($malformedPayloads as $payload) {
            $response = $this->makeRawRequest($endpoint['method'], $endpoint['path'], $payload);
            
            if (!$response || $response['status'] !== 400) {
                $this->addVulnerability('MALFORMED_JSON', $endpoint, $payload, 
                    'Server may not properly validate JSON');
                $results[] = ['payload' => $payload, 'handled_properly' => false];
            } else {
                $results[] = ['payload' => $payload, 'handled_properly' => true];
            }
        }
        
        return $results;
    }
    
    /**
     * Test content type validation
     */
    private function testContentTypeValidation($endpoint)
    {
        if ($endpoint['method'] !== 'POST') {
            return ['skipped' => true];
        }
        
        $testData = $this->buildTestData($endpoint['test_fields'], 'test');
        
        // Test with wrong content type
        $response = $this->makeRequest($endpoint['method'], $endpoint['path'], $testData, [
            'Content-Type' => 'text/plain'
        ]);
        
        if ($response && $response['status'] === 200) {
            $this->addVulnerability('CONTENT_TYPE', $endpoint, 'text/plain', 
                'Server accepts wrong content type');
            return ['accepts_wrong_content_type' => true];
        }
        
        return ['accepts_wrong_content_type' => false];
    }
    
    /**
     * Test rate limiting
     */
    private function testRateLimiting($endpoint)
    {
        $testData = $this->buildTestData($endpoint['test_fields'], 'test');
        $requestCount = 0;
        $rateLimited = false;
        
        // Make multiple rapid requests
        for ($i = 0; $i < 100; $i++) {
            $response = $this->makeRequest($endpoint['method'], $endpoint['path'], $testData);
            $requestCount++;
            
            if ($response && $response['status'] === 429) {
                $rateLimited = true;
                break;
            }
            
            usleep(10000); // 10ms delay
        }
        
        if (!$rateLimited) {
            $this->addVulnerability('RATE_LIMITING', $endpoint, "$requestCount requests", 
                'No rate limiting detected');
        }
        
        return [
            'requests_before_limit' => $requestCount,
            'rate_limited' => $rateLimited
        ];
    }
    
    /**
     * Build test data for the endpoint
     */
    private function buildTestData($fields, $payload)
    {
        $data = [];
        
        foreach ($fields as $field) {
            switch ($field) {
                case 'email':
                    $data[$field] = "test$payload@example.com";
                    break;
                case 'password':
                    $data[$field] = "password123$payload";
                    break;
                case 'cpf':
                    $data[$field] = "12345678901$payload";
                    break;
                default:
                    $data[$field] = "test$payload";
                    break;
            }
        }
        
        return $data;
    }
    
    /**
     * Make HTTP request
     */
    private function makeRequest($method, $path, $data = [], $headers = [])
    {
        $url = $this->baseUrl . $path;
        $defaultHeaders = [
            'Content-Type: application/json',
            'Accept: application/json',
            'X-Requested-With: XMLHttpRequest'
        ];
        
        foreach ($headers as $key => $value) {
            $defaultHeaders[] = "$key: $value";
        }
        
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $defaultHeaders,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);
        
        if ($method === 'POST' && $data) {
            curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        
        if ($response === false) {
            return null;
        }
        
        return [
            'status' => $httpCode,
            'body' => $response
        ];
    }
    
    /**
     * Make raw HTTP request
     */
    private function makeRawRequest($method, $path, $rawData)
    {
        $url = $this->baseUrl . $path;
        
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json'
            ],
            CURLOPT_POSTFIELDS => $rawData,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        
        if ($response === false) {
            return null;
        }
        
        return [
            'status' => $httpCode,
            'body' => $response
        ];
    }
    
    /**
     * Detect SQL error patterns
     */
    private function detectSQLError($response)
    {
        $patterns = [
            'mysql_fetch_array',
            'mysql_num_rows',
            'SQL syntax',
            'mysql_error',
            'ORA-\d+',
            'PostgreSQL.*ERROR',
            'Warning.*mysql_',
            'MySQLSyntaxErrorException',
            'SQLException'
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match("/$pattern/i", $response)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Detect path traversal success
     */
    private function detectPathTraversal($response)
    {
        $patterns = [
            'root:x:0:0',
            'daemon:x:1:1',
            '\\[drivers\\]',
            '\\[boot loader\\]',
            '/etc/passwd',
            '/etc/shadow'
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match("/$pattern/i", $response)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Detect command execution
     */
    private function detectCommandExecution($response)
    {
        $patterns = [
            'uid=\d+',
            'gid=\d+',
            'total \d+',
            'drwxr-xr-x',
            'bin/bash',
            'bin/sh',
            'PING.*bytes from'
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match("/$pattern/i", $response)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Add vulnerability to list
     */
    private function addVulnerability($type, $endpoint, $payload, $description)
    {
        $this->vulnerabilities[] = [
            'type' => $type,
            'endpoint' => $endpoint['method'] . ' ' . $endpoint['path'],
            'payload' => $payload,
            'description' => $description,
            'severity' => $this->getSeverityForType($type),
            'critical_endpoint' => $endpoint['critical'] ?? false
        ];
    }
    
    /**
     * Get severity for vulnerability type
     */
    private function getSeverityForType($type)
    {
        $high = ['SQL_INJECTION', 'COMMAND_INJECTION', 'PATH_TRAVERSAL'];
        $medium = ['XSS', 'RATE_LIMITING', 'OVERSIZED_INPUT'];
        $low = ['CONTENT_TYPE', 'MALFORMED_JSON'];
        
        if (in_array($type, $high)) return 'HIGH';
        if (in_array($type, $medium)) return 'MEDIUM';
        return 'LOW';
    }
    
    /**
     * Generate comprehensive report
     */
    private function generateReport()
    {
        $report = [
            'scan_timestamp' => date('Y-m-d H:i:s'),
            'total_endpoints_tested' => count($this->testResults),
            'total_vulnerabilities' => count($this->vulnerabilities),
            'vulnerability_breakdown' => [
                'HIGH' => 0,
                'MEDIUM' => 0,
                'LOW' => 0
            ],
            'vulnerability_types' => [],
            'vulnerabilities' => $this->vulnerabilities,
            'test_results' => $this->testResults,
            'recommendations' => $this->generateRecommendations()
        ];
        
        // Calculate statistics
        foreach ($this->vulnerabilities as $vuln) {
            $report['vulnerability_breakdown'][$vuln['severity']]++;
            $report['vulnerability_types'][$vuln['type']] = 
                ($report['vulnerability_types'][$vuln['type']] ?? 0) + 1;
        }
        
        // Output report
        echo "\n📊 Input Validation Security Report\n";
        echo "=====================================\n";
        echo "Scan Date: " . $report['scan_timestamp'] . "\n";
        echo "Endpoints Tested: " . $report['total_endpoints_tested'] . "\n";
        echo "Vulnerabilities Found: " . $report['total_vulnerabilities'] . "\n\n";
        
        echo "🚨 Severity Breakdown:\n";
        foreach ($report['vulnerability_breakdown'] as $severity => $count) {
            echo "  $severity: $count\n";
        }
        
        if (!empty($report['vulnerability_types'])) {
            echo "\n📋 Vulnerability Types:\n";
            foreach ($report['vulnerability_types'] as $type => $count) {
                echo "  $type: $count\n";
            }
        }
        
        if (!empty($this->vulnerabilities)) {
            echo "\n⚠️  Critical Vulnerabilities:\n";
            foreach ($this->vulnerabilities as $vuln) {
                if ($vuln['severity'] === 'HIGH') {
                    echo "  🔸 " . $vuln['endpoint'] . " - " . $vuln['type'] . "\n";
                    echo "    " . $vuln['description'] . "\n";
                }
            }
        }
        
        echo "\n💡 Recommendations:\n";
        foreach ($report['recommendations'] as $rec) {
            echo "  • $rec\n";
        }
        
        // Save report
        file_put_contents('input-validation-report.json', json_encode($report, JSON_PRETTY_PRINT));
        echo "\n📁 Detailed report saved to: input-validation-report.json\n";
        echo "✅ Input validation testing complete!\n";
        
        return $report;
    }
    
    /**
     * Generate recommendations based on findings
     */
    private function generateRecommendations()
    {
        $recommendations = [];
        
        if (count($this->vulnerabilities) === 0) {
            $recommendations[] = 'Excellent! No input validation vulnerabilities detected';
        } else {
            $recommendations[] = 'Implement comprehensive input sanitization for all endpoints';
            $recommendations[] = 'Add CSRF protection for state-changing operations';
            $recommendations[] = 'Implement proper JSON schema validation';
            $recommendations[] = 'Add request size limits to prevent DoS attacks';
            $recommendations[] = 'Implement strict content-type validation';
            $recommendations[] = 'Add comprehensive rate limiting to all endpoints';
            $recommendations[] = 'Use parameterized queries to prevent SQL injection';
            $recommendations[] = 'Implement output encoding to prevent XSS';
            $recommendations[] = 'Add input length validation';
            $recommendations[] = 'Implement file upload restrictions and scanning';
        }
        
        return $recommendations;
    }
}

// Run the tests
echo "⚡ Starting Input Validation Security Tests...\n";
echo "Note: Ensure the API server is running on localhost:8000\n\n";

$tester = new InputValidationTester();
$tester->runTests();