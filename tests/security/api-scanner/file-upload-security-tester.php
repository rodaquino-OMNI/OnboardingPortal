<?php
/**
 * File Upload Security Tester
 * Tests file upload endpoints for security vulnerabilities
 */

class FileUploadSecurityTester
{
    private $baseUrl = 'http://localhost:8000/api';
    private $uploadEndpoints = [];
    private $vulnerabilities = [];
    private $testResults = [];
    
    // Malicious file payloads for testing
    private $maliciousFiles = [
        'php_shell' => [
            'name' => 'shell.php',
            'content' => '<?php system($_GET["cmd"]); ?>',
            'type' => 'application/x-php'
        ],
        'jsp_shell' => [
            'name' => 'shell.jsp',
            'content' => '<%@ page import="java.io.*" %><% String cmd = request.getParameter("cmd"); Process p = Runtime.getRuntime().exec(cmd); %>',
            'type' => 'application/x-jsp'
        ],
        'asp_shell' => [
            'name' => 'shell.asp',
            'content' => '<%eval request("cmd")%>',
            'type' => 'application/x-asp'
        ],
        'executable' => [
            'name' => 'malware.exe',
            'content' => 'MZ\x90\x00' . str_repeat('A', 100), // Fake PE header
            'type' => 'application/octet-stream'
        ],
        'script_in_image' => [
            'name' => 'malicious.jpg',
            'content' => "\xFF\xD8\xFF\xE0<?php system('whoami'); ?>", // JPEG header + PHP
            'type' => 'image/jpeg'
        ],
        'html_with_js' => [
            'name' => 'malicious.html',
            'content' => '<html><script>alert("XSS")</script></html>',
            'type' => 'text/html'
        ],
        'zip_bomb' => [
            'name' => 'bomb.zip',
            'content' => $this->createZipBomb(),
            'type' => 'application/zip'
        ],
        'oversized' => [
            'name' => 'large.txt',
            'content' => str_repeat('A', 50 * 1024 * 1024), // 50MB
            'type' => 'text/plain'
        ]
    ];
    
    private $doubleExtensionTests = [
        'shell.php.jpg',
        'shell.jsp.png',
        'shell.asp.gif',
        'script.js.txt',
        'malware.exe.pdf'
    ];
    
    private $nullByteTests = [
        'shell.php%00.jpg',
        'script.js%00.txt',
        'malware.exe%00.png'
    ];
    
    public function __construct()
    {
        echo "🔍 File Upload Security Tester\n";
        echo "===============================\n";
        $this->discoverUploadEndpoints();
    }
    
    /**
     * Discover file upload endpoints
     */
    private function discoverUploadEndpoints()
    {
        // Known upload endpoints from the codebase
        $this->uploadEndpoints = [
            [
                'path' => '/documents/upload',
                'method' => 'POST',
                'requires_auth' => true,
                'field_name' => 'document',
                'controller' => 'DocumentController'
            ],
            [
                'path' => '/documents/upload-v2',
                'method' => 'POST',
                'requires_auth' => true,
                'field_name' => 'file',
                'controller' => 'DocumentControllerV2'
            ],
            [
                'path' => '/documents/upload-v3',
                'method' => 'POST',
                'requires_auth' => true,
                'field_name' => 'files',
                'controller' => 'DocumentControllerV3'
            ],
            [
                'path' => '/images/process',
                'method' => 'POST',
                'requires_auth' => true,
                'field_name' => 'image',
                'controller' => 'ImageProcessingController'
            ],
            [
                'path' => '/profile/avatar',
                'method' => 'POST',
                'requires_auth' => true,
                'field_name' => 'avatar',
                'controller' => 'ProfileController'
            ]
        ];
        
        echo "📁 Found " . count($this->uploadEndpoints) . " upload endpoints\n";
    }
    
    /**
     * Run all security tests
     */
    public function runTests()
    {
        foreach ($this->uploadEndpoints as $endpoint) {
            echo "\n🎯 Testing endpoint: {$endpoint['method']} {$endpoint['path']}\n";
            $this->testEndpoint($endpoint);
        }
        
        $this->generateReport();
    }
    
    /**
     * Test a specific upload endpoint
     */
    private function testEndpoint($endpoint)
    {
        $results = [
            'endpoint' => $endpoint,
            'tests' => []
        ];
        
        // Test malicious file uploads
        $results['tests']['malicious_files'] = $this->testMaliciousFiles($endpoint);
        
        // Test file type validation
        $results['tests']['file_type_validation'] = $this->testFileTypeValidation($endpoint);
        
        // Test file size limits
        $results['tests']['file_size_limits'] = $this->testFileSizeLimits($endpoint);
        
        // Test double extension attacks
        $results['tests']['double_extension'] = $this->testDoubleExtension($endpoint);
        
        // Test null byte attacks
        $results['tests']['null_byte'] = $this->testNullByte($endpoint);
        
        // Test path traversal in filenames
        $results['tests']['path_traversal'] = $this->testPathTraversalInFilename($endpoint);
        
        // Test MIME type spoofing
        $results['tests']['mime_spoofing'] = $this->testMimeSpoofing($endpoint);
        
        // Test content validation
        $results['tests']['content_validation'] = $this->testContentValidation($endpoint);
        
        // Test directory listing
        $results['tests']['directory_listing'] = $this->testDirectoryListing($endpoint);
        
        $this->testResults[] = $results;
    }
    
    /**
     * Test malicious file uploads
     */
    private function testMaliciousFiles($endpoint)
    {
        $results = [];
        
        foreach ($this->maliciousFiles as $type => $file) {
            echo "  🔸 Testing $type file upload...\n";
            
            $response = $this->uploadFile($endpoint, $file);
            
            if ($response && $response['status'] === 200) {
                $this->addVulnerability('MALICIOUS_FILE_UPLOAD', $endpoint, $type, 
                    "Server accepted $type file upload");
                $results[$type] = ['accepted' => true, 'response' => $response];
            } else {
                $results[$type] = ['accepted' => false, 'response' => $response];
            }
        }
        
        return $results;
    }
    
    /**
     * Test file type validation
     */
    private function testFileTypeValidation($endpoint)
    {
        $testFiles = [
            ['name' => 'test.txt', 'content' => 'Hello World', 'type' => 'text/plain'],
            ['name' => 'test.pdf', 'content' => '%PDF-1.4', 'type' => 'application/pdf'],
            ['name' => 'test.jpg', 'content' => "\xFF\xD8\xFF\xE0", 'type' => 'image/jpeg'],
            ['name' => 'test.png', 'content' => "\x89PNG\r\n\x1a\n", 'type' => 'image/png'],
            ['name' => 'test.docx', 'content' => 'PK', 'type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        ];
        
        $results = [];
        
        foreach ($testFiles as $file) {
            $response = $this->uploadFile($endpoint, $file);
            $results[$file['name']] = [
                'accepted' => $response && $response['status'] === 200,
                'response' => $response
            ];
        }
        
        return $results;
    }
    
    /**
     * Test file size limits
     */
    private function testFileSizeLimits($endpoint)
    {
        $sizes = [
            '1KB' => 1024,
            '100KB' => 100 * 1024,
            '1MB' => 1024 * 1024,
            '10MB' => 10 * 1024 * 1024,
            '50MB' => 50 * 1024 * 1024,
            '100MB' => 100 * 1024 * 1024
        ];
        
        $results = [];
        
        foreach ($sizes as $label => $size) {
            echo "  🔸 Testing $label file upload...\n";
            
            $file = [
                'name' => "test_$label.txt",
                'content' => str_repeat('A', $size),
                'type' => 'text/plain'
            ];
            
            $response = $this->uploadFile($endpoint, $file);
            
            $results[$label] = [
                'size' => $size,
                'accepted' => $response && $response['status'] === 200,
                'response' => $response
            ];
            
            // If very large files are accepted, it's a vulnerability
            if ($size > 10 * 1024 * 1024 && $response && $response['status'] === 200) {
                $this->addVulnerability('LARGE_FILE_UPLOAD', $endpoint, $label, 
                    "Server accepts files larger than $label without proper limits");
            }
        }
        
        return $results;
    }
    
    /**
     * Test double extension attacks
     */
    private function testDoubleExtension($endpoint)
    {
        $results = [];
        
        foreach ($this->doubleExtensionTests as $filename) {
            $file = [
                'name' => $filename,
                'content' => '<?php system($_GET["cmd"]); ?>',
                'type' => 'image/jpeg'
            ];
            
            $response = $this->uploadFile($endpoint, $file);
            
            if ($response && $response['status'] === 200) {
                $this->addVulnerability('DOUBLE_EXTENSION', $endpoint, $filename, 
                    'Server accepted file with double extension');
                $results[$filename] = ['vulnerable' => true];
            } else {
                $results[$filename] = ['vulnerable' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Test null byte attacks
     */
    private function testNullByte($endpoint)
    {
        $results = [];
        
        foreach ($this->nullByteTests as $filename) {
            $file = [
                'name' => $filename,
                'content' => '<?php system($_GET["cmd"]); ?>',
                'type' => 'image/jpeg'
            ];
            
            $response = $this->uploadFile($endpoint, $file);
            
            if ($response && $response['status'] === 200) {
                $this->addVulnerability('NULL_BYTE_INJECTION', $endpoint, $filename, 
                    'Server vulnerable to null byte injection');
                $results[$filename] = ['vulnerable' => true];
            } else {
                $results[$filename] = ['vulnerable' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Test path traversal in filenames
     */
    private function testPathTraversalInFilename($endpoint)
    {
        $pathTraversalNames = [
            '../../../evil.php',
            '..\\..\\..\\evil.asp',
            'dir/subdir/../../evil.jsp',
            '%2e%2e%2f%2e%2e%2f%2e%2e%2fevil.php',
            '....//....//evil.php'
        ];
        
        $results = [];
        
        foreach ($pathTraversalNames as $filename) {
            $file = [
                'name' => $filename,
                'content' => 'malicious content',
                'type' => 'text/plain'
            ];
            
            $response = $this->uploadFile($endpoint, $file);
            
            if ($response && $response['status'] === 200) {
                $this->addVulnerability('PATH_TRAVERSAL_FILENAME', $endpoint, $filename, 
                    'Server vulnerable to path traversal in filename');
                $results[$filename] = ['vulnerable' => true];
            } else {
                $results[$filename] = ['vulnerable' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Test MIME type spoofing
     */
    private function testMimeSpoofing($endpoint)
    {
        $spoofingTests = [
            [
                'name' => 'shell.php',
                'content' => '<?php system($_GET["cmd"]); ?>',
                'declared_type' => 'image/jpeg',
                'actual_type' => 'php'
            ],
            [
                'name' => 'script.js',
                'content' => 'alert("XSS");',
                'declared_type' => 'text/plain',
                'actual_type' => 'javascript'
            ],
            [
                'name' => 'executable.exe',
                'content' => 'MZ\x90\x00',
                'declared_type' => 'image/png',
                'actual_type' => 'executable'
            ]
        ];
        
        $results = [];
        
        foreach ($spoofingTests as $test) {
            $file = [
                'name' => $test['name'],
                'content' => $test['content'],
                'type' => $test['declared_type']
            ];
            
            $response = $this->uploadFile($endpoint, $file);
            
            if ($response && $response['status'] === 200) {
                $this->addVulnerability('MIME_SPOOFING', $endpoint, $test['name'], 
                    'Server accepts spoofed MIME type');
                $results[$test['name']] = ['vulnerable' => true];
            } else {
                $results[$test['name']] = ['vulnerable' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Test content validation
     */
    private function testContentValidation($endpoint)
    {
        $contentTests = [
            [
                'name' => 'fake.jpg',
                'content' => 'This is not a JPEG file',
                'type' => 'image/jpeg'
            ],
            [
                'name' => 'fake.pdf',
                'content' => 'This is not a PDF file',
                'type' => 'application/pdf'
            ],
            [
                'name' => 'fake.png',
                'content' => 'This is not a PNG file',
                'type' => 'image/png'
            ]
        ];
        
        $results = [];
        
        foreach ($contentTests as $test) {
            $response = $this->uploadFile($endpoint, $test);
            
            if ($response && $response['status'] === 200) {
                $this->addVulnerability('CONTENT_VALIDATION', $endpoint, $test['name'], 
                    'Server does not validate file content against declared type');
                $results[$test['name']] = ['validates_content' => false];
            } else {
                $results[$test['name']] = ['validates_content' => true];
            }
        }
        
        return $results;
    }
    
    /**
     * Test directory listing vulnerability
     */
    private function testDirectoryListing($endpoint)
    {
        // Try to access potential upload directories
        $uploadPaths = [
            '/uploads/',
            '/storage/uploads/',
            '/public/uploads/',
            '/files/',
            '/documents/',
            '/images/',
            '/media/'
        ];
        
        $results = [];
        
        foreach ($uploadPaths as $path) {
            $response = $this->makeGetRequest($path);
            
            if ($response && $response['status'] === 200 && 
                (strpos($response['body'], 'Index of') !== false || 
                 strpos($response['body'], '<a href=') !== false)) {
                $this->addVulnerability('DIRECTORY_LISTING', $endpoint, $path, 
                    'Upload directory allows listing');
                $results[$path] = ['allows_listing' => true];
            } else {
                $results[$path] = ['allows_listing' => false];
            }
        }
        
        return $results;
    }
    
    /**
     * Upload file to endpoint
     */
    private function uploadFile($endpoint, $file)
    {
        $url = $this->baseUrl . $endpoint['path'];
        $fieldName = $endpoint['field_name'];
        
        // Create temporary file
        $tempFile = tempnam(sys_get_temp_dir(), 'security_test_');
        file_put_contents($tempFile, $file['content']);
        
        $postData = [
            $fieldName => new CURLFile($tempFile, $file['type'], $file['name'])
        ];
        
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'X-Requested-With: XMLHttpRequest'
            ],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        
        // Clean up
        unlink($tempFile);
        
        if ($response === false) {
            return null;
        }
        
        return [
            'status' => $httpCode,
            'body' => $response
        ];
    }
    
    /**
     * Make GET request
     */
    private function makeGetRequest($path)
    {
        $url = $this->baseUrl . $path;
        
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
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
     * Create a zip bomb for testing
     */
    private function createZipBomb()
    {
        // Simple zip bomb (not actually dangerous for testing)
        return "PK\x03\x04" . str_repeat('A', 1000);
    }
    
    /**
     * Add vulnerability to list
     */
    private function addVulnerability($type, $endpoint, $payload, $description)
    {
        $this->vulnerabilities[] = [
            'type' => $type,
            'endpoint' => $endpoint['method'] . ' ' . $endpoint['path'],
            'controller' => $endpoint['controller'],
            'payload' => $payload,
            'description' => $description,
            'severity' => $this->getSeverityForType($type)
        ];
    }
    
    /**
     * Get severity for vulnerability type
     */
    private function getSeverityForType($type)
    {
        $critical = ['MALICIOUS_FILE_UPLOAD', 'PATH_TRAVERSAL_FILENAME', 'NULL_BYTE_INJECTION'];
        $high = ['DOUBLE_EXTENSION', 'MIME_SPOOFING', 'DIRECTORY_LISTING'];
        $medium = ['CONTENT_VALIDATION', 'LARGE_FILE_UPLOAD'];
        
        if (in_array($type, $critical)) return 'CRITICAL';
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
            'total_endpoints_tested' => count($this->uploadEndpoints),
            'total_vulnerabilities' => count($this->vulnerabilities),
            'vulnerability_breakdown' => [
                'CRITICAL' => 0,
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
        echo "\n📊 File Upload Security Report\n";
        echo "===============================\n";
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
                if ($vuln['severity'] === 'CRITICAL') {
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
        file_put_contents('file-upload-security-report.json', json_encode($report, JSON_PRETTY_PRINT));
        echo "\n📁 Detailed report saved to: file-upload-security-report.json\n";
        echo "✅ File upload security testing complete!\n";
        
        return $report;
    }
    
    /**
     * Generate recommendations
     */
    private function generateRecommendations()
    {
        return [
            'Implement strict file type validation based on file headers, not just extensions',
            'Add file size limits appropriate for each endpoint',
            'Scan uploaded files for malware using antivirus engines',
            'Store uploaded files outside the web root directory',
            'Disable directory listing for upload directories',
            'Implement content-based validation for image and document files',
            'Use whitelisting for allowed file types and extensions',
            'Sanitize file names to prevent path traversal attacks',
            'Implement virus scanning for all uploaded files',
            'Add authentication and authorization for sensitive upload endpoints',
            'Monitor and log all file upload activities',
            'Implement rate limiting for upload endpoints',
            'Use secure file storage services for production environments'
        ];
    }
}

// Run the tests
echo "⚡ Starting File Upload Security Tests...\n";
echo "Note: Ensure the API server is running on localhost:8000\n\n";

$tester = new FileUploadSecurityTester();
$tester->runTests();