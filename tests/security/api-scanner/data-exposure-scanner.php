<?php
/**
 * API Data Exposure Scanner
 * Scans controllers for potential sensitive data exposure in API responses
 */

class DataExposureScanner
{
    private $sensitiveFields = [
        'password', 'password_hash', 'remember_token', 'api_token',
        'secret', 'private_key', 'access_token', 'refresh_token',
        'ssn', 'social_security', 'credit_card', 'bank_account',
        'internal_id', 'admin_notes', 'internal_comments',
        'lgpd_consent_ip', 'session_id', 'csrf_token',
        'security_question', 'security_answer', 'two_factor_secret',
        'email_verification_token', 'password_reset_token'
    ];
    
    private $controllerPath = '../../../omni-portal/backend/app/Http/Controllers/Api/';
    private $exposures = [];
    private $recommendations = [];
    
    public function scanControllers()
    {
        echo "🔍 Scanning controllers for data exposure...\n";
        
        $controllers = glob($this->controllerPath . '*.php');
        
        foreach ($controllers as $controller) {
            $this->scanController($controller);
        }
        
        $this->generateRecommendations();
    }
    
    private function scanController($filePath)
    {
        $content = file_get_contents($filePath);
        $fileName = basename($filePath);
        
        echo "  📄 Scanning $fileName...\n";
        
        // Look for return statements with user data
        $this->checkReturnStatements($content, $fileName);
        
        // Look for direct model outputs
        $this->checkModelOutputs($content, $fileName);
        
        // Look for array/object responses
        $this->checkArrayResponses($content, $fileName);
        
        // Check for missing sanitization
        $this->checkSanitization($content, $fileName);
        
        // Check for debugging information
        $this->checkDebuggingInfo($content, $fileName);
    }
    
    private function checkReturnStatements($content, $fileName)
    {
        // Look for return response()->json() with user objects
        preg_match_all('/return\s+response\(\)->json\(\[.*?\]/s', $content, $matches);
        
        foreach ($matches[0] as $match) {
            // Check if user data is directly returned
            if (strpos($match, '$user') !== false || strpos($match, '$beneficiary') !== false) {
                $this->addExposure($fileName, 'POTENTIAL_USER_DATA_EXPOSURE', $match, 
                    'Direct user/beneficiary object in response may expose sensitive fields');
            }
        }
    }
    
    private function checkModelOutputs($content, $fileName)
    {
        // Look for model->toArray() calls
        if (preg_match_all('/\$\w+->toArray\(\)/', $content, $matches)) {
            foreach ($matches[0] as $match) {
                $this->addExposure($fileName, 'UNFILTERED_MODEL_OUTPUT', $match,
                    'Model toArray() may expose sensitive fields - use hidden or visible properties');
            }
        }
        
        // Look for direct model returns in responses
        preg_match_all('/[\'"]user[\'"]\s*=>\s*\$user[^,\]]*/', $content, $matches);
        foreach ($matches[0] as $match) {
            $this->addExposure($fileName, 'DIRECT_MODEL_RESPONSE', $match,
                'Direct model in response - consider using API resources or filtering');
        }
    }
    
    private function checkArrayResponses($content, $fileName)
    {
        // Check for specific sensitive fields in responses
        foreach ($this->sensitiveFields as $field) {
            if (preg_match_all('/[\'"]\w*' . $field . '\w*[\'"]/', $content, $matches)) {
                foreach ($matches[0] as $match) {
                    $this->addExposure($fileName, 'SENSITIVE_FIELD_EXPOSURE', $match,
                        "Potentially sensitive field '$field' found in response");
                }
            }
        }
    }
    
    private function checkSanitization($content, $fileName)
    {
        // Look for responses that don't use sanitization methods
        $sanitizationMethods = ['htmlspecialchars', 'strip_tags', 'sanitizeUserOutput', 'sanitizeInput'];
        
        $hasUserData = strpos($content, '$user') !== false || strpos($content, '$beneficiary') !== false;
        $hasSanitization = false;
        
        foreach ($sanitizationMethods as $method) {
            if (strpos($content, $method) !== false) {
                $hasSanitization = true;
                break;
            }
        }
        
        if ($hasUserData && !$hasSanitization) {
            $this->addExposure($fileName, 'MISSING_SANITIZATION', 'User data responses',
                'Controller returns user data but lacks sanitization methods');
        }
    }
    
    private function checkDebuggingInfo($content, $fileName)
    {
        $debugPatterns = [
            '/[\'"]error[\'"]\s*=>\s*\$e->getMessage\(\)/',
            '/[\'"]trace[\'"]\s*=>\s*\$e->getTrace/',
            '/config\([\'"]app\.debug[\'"]/',
            '/dump\(/', '/dd\(/', '/var_dump\(/',
            '/print_r\(/', '/error_log\(/'
        ];
        
        foreach ($debugPatterns as $pattern) {
            if (preg_match_all($pattern, $content, $matches)) {
                foreach ($matches[0] as $match) {
                    $this->addExposure($fileName, 'DEBUG_INFO_EXPOSURE', $match,
                        'Potential debugging information in response');
                }
            }
        }
    }
    
    private function addExposure($file, $type, $code, $description)
    {
        $this->exposures[] = [
            'file' => $file,
            'type' => $type,
            'code_snippet' => substr($code, 0, 200) . (strlen($code) > 200 ? '...' : ''),
            'description' => $description,
            'severity' => $this->getSeverity($type),
            'line_context' => $this->getLineContext($code)
        ];
    }
    
    private function getSeverity($type)
    {
        $highSeverity = ['SENSITIVE_FIELD_EXPOSURE', 'DEBUG_INFO_EXPOSURE'];
        $mediumSeverity = ['POTENTIAL_USER_DATA_EXPOSURE', 'UNFILTERED_MODEL_OUTPUT'];
        
        if (in_array($type, $highSeverity)) return 'HIGH';
        if (in_array($type, $mediumSeverity)) return 'MEDIUM';
        return 'LOW';
    }
    
    private function getLineContext($code)
    {
        // Simple heuristic to provide context
        return strlen($code) > 50 ? 'Complex statement' : 'Simple statement';
    }
    
    private function generateRecommendations()
    {
        $this->recommendations = [
            'general' => [
                'Implement Laravel API Resources for structured data output',
                'Use $hidden or $visible properties on Eloquent models',
                'Add sanitizeUserOutput() method to all controllers returning user data',
                'Implement field-level permissions for sensitive data',
                'Use response transformers to filter data based on user roles'
            ],
            'specific' => []
        ];
        
        // Group exposures by type for specific recommendations
        $typeGroups = [];
        foreach ($this->exposures as $exposure) {
            $typeGroups[$exposure['type']][] = $exposure;
        }
        
        foreach ($typeGroups as $type => $exposures) {
            switch ($type) {
                case 'SENSITIVE_FIELD_EXPOSURE':
                    $this->recommendations['specific'][] = 
                        "Hide " . count($exposures) . " sensitive fields using model \$hidden property";
                    break;
                case 'UNFILTERED_MODEL_OUTPUT':
                    $this->recommendations['specific'][] = 
                        "Replace " . count($exposures) . " toArray() calls with API resources";
                    break;
                case 'MISSING_SANITIZATION':
                    $this->recommendations['specific'][] = 
                        "Add sanitization to " . count($exposures) . " controllers";
                    break;
                case 'DEBUG_INFO_EXPOSURE':
                    $this->recommendations['specific'][] = 
                        "Remove or conditionally show " . count($exposures) . " debug statements";
                    break;
            }
        }
    }
    
    public function generateReport()
    {
        $report = [
            'scan_timestamp' => date('Y-m-d H:i:s'),
            'total_exposures' => count($this->exposures),
            'severity_breakdown' => [
                'HIGH' => 0,
                'MEDIUM' => 0,
                'LOW' => 0
            ],
            'exposure_types' => [],
            'exposures' => $this->exposures,
            'recommendations' => $this->recommendations
        ];
        
        // Calculate severity breakdown
        foreach ($this->exposures as $exposure) {
            $report['severity_breakdown'][$exposure['severity']]++;
        }
        
        // Calculate exposure types
        $typeCount = [];
        foreach ($this->exposures as $exposure) {
            $typeCount[$exposure['type']] = ($typeCount[$exposure['type']] ?? 0) + 1;
        }
        $report['exposure_types'] = $typeCount;
        
        return $report;
    }
}

// Run the scanner
echo "🔍 Starting API Data Exposure Analysis...\n";

$scanner = new DataExposureScanner();
$scanner->scanControllers();
$report = $scanner->generateReport();

// Output report
echo "\n📊 Data Exposure Analysis Report\n";
echo "=======================================\n";
echo "Scan Date: " . $report['scan_timestamp'] . "\n";
echo "Total Exposures: " . $report['total_exposures'] . "\n\n";

echo "🚨 Severity Breakdown:\n";
foreach ($report['severity_breakdown'] as $severity => $count) {
    echo "  $severity: $count exposures\n";
}

echo "\n📋 Exposure Types:\n";
foreach ($report['exposure_types'] as $type => $count) {
    echo "  $type: $count\n";
}

if (!empty($report['exposures'])) {
    echo "\n⚠️  Detailed Exposures:\n";
    foreach ($report['exposures'] as $exposure) {
        echo "  🔸 " . $exposure['file'] . " [" . $exposure['severity'] . "]\n";
        echo "    Type: " . $exposure['type'] . "\n";
        echo "    Description: " . $exposure['description'] . "\n";
        echo "    Code: " . $exposure['code_snippet'] . "\n\n";
    }
}

echo "💡 General Recommendations:\n";
foreach ($report['recommendations']['general'] as $rec) {
    echo "  • $rec\n";
}

if (!empty($report['recommendations']['specific'])) {
    echo "\n🎯 Specific Recommendations:\n";
    foreach ($report['recommendations']['specific'] as $rec) {
        echo "  • $rec\n";
    }
}

// Save report
file_put_contents('data-exposure-report.json', json_encode($report, JSON_PRETTY_PRINT));
echo "\n📁 Detailed report saved to: data-exposure-report.json\n";
echo "✅ Data exposure analysis complete!\n";