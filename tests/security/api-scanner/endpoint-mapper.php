<?php
/**
 * API Endpoint Security Mapper
 * Maps all API endpoints and analyzes their security configuration
 */

require_once '../../../omni-portal/backend/vendor/autoload.php';

class ApiEndpointMapper
{
    private $endpoints = [];
    private $securityIssues = [];
    
    public function __construct()
    {
        $this->mapEndpoints();
    }
    
    /**
     * Map all API endpoints from routes file
     */
    public function mapEndpoints()
    {
        // Parse the API routes file
        $routesContent = file_get_contents('../../../omni-portal/backend/routes/api.php');
        
        // Extract all Route:: definitions
        preg_match_all('/Route::(\w+)\([\'"]([^\'"]+)[\'"].*?\[([^\]]+)\]/', $routesContent, $matches, PREG_SET_ORDER);
        
        foreach ($matches as $match) {
            $method = strtoupper($match[1]);
            $path = $match[2];
            $controller = $match[3];
            
            $this->endpoints[] = [
                'method' => $method,
                'path' => '/api/' . ltrim($path, '/'),
                'controller' => trim($controller),
                'middleware' => $this->extractMiddleware($routesContent, $path),
                'auth_required' => $this->requiresAuth($routesContent, $path),
                'rate_limited' => $this->hasRateLimit($routesContent, $path),
                'security_level' => $this->assessSecurityLevel($path, $method)
            ];
        }
        
        // Add specific endpoints found in the codebase
        $this->addKnownEndpoints();
    }
    
    /**
     * Add manually identified endpoints from controller analysis
     */
    private function addKnownEndpoints()
    {
        $knownEndpoints = [
            ['GET', '/api/user', 'AuthController@user', true, 'HIGH'],
            ['POST', '/api/auth/login', 'AuthController@login', false, 'CRITICAL'],
            ['POST', '/api/auth/logout', 'AuthController@logout', true, 'HIGH'],
            ['POST', '/api/auth/logout-all', 'AuthController@logoutAll', true, 'HIGH'],
            ['POST', '/api/auth/refresh', 'AuthController@refresh', true, 'HIGH'],
            ['POST', '/api/auth/check-email', 'AuthController@checkEmail', false, 'MEDIUM'],
            ['POST', '/api/auth/check-cpf', 'AuthController@checkCpf', false, 'MEDIUM'],
            ['POST', '/api/auth/register', 'RegisterController@register', false, 'CRITICAL'],
            ['POST', '/api/auth/register/step1', 'RegisterController@step1', false, 'CRITICAL'],
            ['POST', '/api/auth/register/step2', 'RegisterController@step2', true, 'HIGH'],
            ['POST', '/api/auth/register/step3', 'RegisterController@step3', true, 'HIGH'],
            ['GET', '/api/auth/register/progress', 'RegisterController@progress', true, 'MEDIUM'],
            ['POST', '/api/auth/register/validate-profile', 'RegisterController@validateProfileCompletion', true, 'MEDIUM'],
            ['DELETE', '/api/auth/register/cancel', 'RegisterController@cancel', true, 'HIGH'],
            ['GET', '/api/health', 'HealthController@health', false, 'LOW'],
            ['GET', '/api/health/live', 'HealthController@live', false, 'LOW'],
            ['GET', '/api/health/ready', 'HealthController@ready', false, 'LOW'],
            ['GET', '/api/health/status', 'HealthController@status', false, 'LOW'],
            ['GET', '/api/metrics', 'MetricsController@index', false, 'MEDIUM'],
            ['GET', '/api/health-questionnaires/templates', 'HealthQuestionnaireController@getTemplates', true, 'MEDIUM'],
            ['POST', '/api/health-questionnaires/start', 'HealthQuestionnaireController@start', true, 'HIGH'],
            ['GET', '/api/health-questionnaires/{id}/progress', 'HealthQuestionnaireController@getProgress', true, 'HIGH'],
            ['PUT', '/api/health-questionnaires/{id}/responses', 'HealthQuestionnaireController@saveResponses', true, 'CRITICAL'],
            ['POST', '/api/health-questionnaires/{id}/ai-insights', 'HealthQuestionnaireController@getAIInsights', true, 'HIGH'],
            ['POST', '/api/health-questionnaires/submit', 'HealthQuestionnaireController@submitQuestionnaire', true, 'CRITICAL'],
            ['POST', '/api/health-questionnaires/submit-progressive', 'HealthQuestionnaireController@submitProgressive', true, 'CRITICAL'],
            ['POST', '/api/health-questionnaires/submit-unified', 'HealthQuestionnaireController@submitUnified', true, 'CRITICAL'],
            ['POST', '/api/health-questionnaires/submit-dual-pathway', 'HealthQuestionnaireController@submitDualPathway', true, 'CRITICAL'],
            ['GET', '/api/gamification/progress', 'GamificationController@getProgress', false, 'LOW'],
            ['GET', '/api/gamification/badges', 'GamificationController@getBadges', false, 'LOW'],
            ['GET', '/api/gamification/leaderboard', 'GamificationController@getLeaderboard', false, 'LOW'],
            ['GET', '/api/gamification/levels', 'GamificationController@getLevels', false, 'LOW'],
            ['GET', '/api/gamification/stats', 'GamificationController@getStats', true, 'MEDIUM'],
            ['GET', '/api/gamification/achievements', 'GamificationController@getAchievements', true, 'MEDIUM'],
            ['GET', '/api/gamification/activity-feed', 'GamificationController@getActivityFeed', true, 'MEDIUM'],
            ['GET', '/api/gamification/dashboard', 'GamificationController@getDashboard', true, 'MEDIUM'],
        ];
        
        foreach ($knownEndpoints as $endpoint) {
            $this->endpoints[] = [
                'method' => $endpoint[0],
                'path' => $endpoint[1],
                'controller' => $endpoint[2],
                'middleware' => $endpoint[3] ? ['auth:sanctum'] : [],
                'auth_required' => $endpoint[3],
                'rate_limited' => true, // Assume all have rate limiting
                'security_level' => $endpoint[4]
            ];
        }
    }
    
    /**
     * Extract middleware from route definition
     */
    private function extractMiddleware($content, $path)
    {
        // Look for middleware patterns around the route
        $middlewares = [];
        
        if (strpos($content, "middleware('auth:sanctum')") !== false && 
            strpos($content, $path) !== false) {
            $middlewares[] = 'auth:sanctum';
        }
        
        if (strpos($content, "middleware('throttle:") !== false) {
            $middlewares[] = 'throttle';
        }
        
        return $middlewares;
    }
    
    /**
     * Check if endpoint requires authentication
     */
    private function requiresAuth($content, $path)
    {
        // Check if the path is within an auth middleware group
        $authPattern = '/middleware\([\'"]auth:sanctum[\'"]\).*?' . preg_quote($path, '/') . '/s';
        return preg_match($authPattern, $content) > 0;
    }
    
    /**
     * Check if endpoint has rate limiting
     */
    private function hasRateLimit($content, $path)
    {
        // Check for throttle middleware
        $throttlePattern = '/throttle:\d+,\d+.*?' . preg_quote($path, '/') . '/s';
        return preg_match($throttlePattern, $content) > 0;
    }
    
    /**
     * Assess security level based on endpoint characteristics
     */
    private function assessSecurityLevel($path, $method)
    {
        $criticalPatterns = ['auth', 'password', 'submit', 'delete', 'admin'];
        $highPatterns = ['register', 'user', 'profile', 'save', 'update'];
        $mediumPatterns = ['get', 'list', 'search', 'check'];
        
        foreach ($criticalPatterns as $pattern) {
            if (strpos($path, $pattern) !== false || 
                ($method === 'POST' && strpos($path, 'questionnaire') !== false)) {
                return 'CRITICAL';
            }
        }
        
        foreach ($highPatterns as $pattern) {
            if (strpos($path, $pattern) !== false) {
                return 'HIGH';
            }
        }
        
        foreach ($mediumPatterns as $pattern) {
            if (strpos($path, $pattern) !== false) {
                return 'MEDIUM';
            }
        }
        
        return 'LOW';
    }
    
    /**
     * Analyze endpoints for security issues
     */
    public function analyzeSecurityIssues()
    {
        foreach ($this->endpoints as $endpoint) {
            $issues = [];
            
            // Check for missing authentication on sensitive endpoints
            if ($endpoint['security_level'] === 'CRITICAL' && !$endpoint['auth_required']) {
                $issues[] = 'CRITICAL endpoint without authentication';
            }
            
            // Check for missing rate limiting
            if (!$endpoint['rate_limited'] && $endpoint['security_level'] !== 'LOW') {
                $issues[] = 'Missing rate limiting on sensitive endpoint';
            }
            
            // Check for data exposure risks
            if ($endpoint['method'] === 'GET' && strpos($endpoint['path'], 'user') !== false) {
                $issues[] = 'Potential user data exposure';
            }
            
            if (!empty($issues)) {
                $this->securityIssues[] = [
                    'endpoint' => $endpoint,
                    'issues' => $issues
                ];
            }
        }
    }
    
    /**
     * Generate security report
     */
    public function generateReport()
    {
        $this->analyzeSecurityIssues();
        
        $report = [
            'scan_timestamp' => date('Y-m-d H:i:s'),
            'total_endpoints' => count($this->endpoints),
            'endpoints_by_security_level' => [
                'CRITICAL' => 0,
                'HIGH' => 0,
                'MEDIUM' => 0,
                'LOW' => 0
            ],
            'security_statistics' => [
                'authenticated_endpoints' => 0,
                'rate_limited_endpoints' => 0,
                'public_endpoints' => 0
            ],
            'endpoints' => $this->endpoints,
            'security_issues' => $this->securityIssues,
            'recommendations' => []
        ];
        
        // Calculate statistics
        foreach ($this->endpoints as $endpoint) {
            $report['endpoints_by_security_level'][$endpoint['security_level']]++;
            
            if ($endpoint['auth_required']) {
                $report['security_statistics']['authenticated_endpoints']++;
            } else {
                $report['security_statistics']['public_endpoints']++;
            }
            
            if ($endpoint['rate_limited']) {
                $report['security_statistics']['rate_limited_endpoints']++;
            }
        }
        
        // Generate recommendations
        $report['recommendations'] = $this->generateRecommendations();
        
        return $report;
    }
    
    /**
     * Generate security recommendations
     */
    private function generateRecommendations()
    {
        $recommendations = [];
        
        if (count($this->securityIssues) > 0) {
            $recommendations[] = 'Address ' . count($this->securityIssues) . ' security issues found in endpoint analysis';
        }
        
        $publicCritical = array_filter($this->endpoints, function($ep) {
            return $ep['security_level'] === 'CRITICAL' && !$ep['auth_required'];
        });
        
        if (count($publicCritical) > 0) {
            $recommendations[] = 'Add authentication to ' . count($publicCritical) . ' critical public endpoints';
        }
        
        $unratedLimited = array_filter($this->endpoints, function($ep) {
            return !$ep['rate_limited'] && $ep['security_level'] !== 'LOW';
        });
        
        if (count($unratedLimited) > 0) {
            $recommendations[] = 'Add rate limiting to ' . count($unratedLimited) . ' sensitive endpoints';
        }
        
        $recommendations[] = 'Implement API versioning strategy for backward compatibility';
        $recommendations[] = 'Add comprehensive input sanitization for all endpoints';
        $recommendations[] = 'Implement response data filtering to prevent sensitive data exposure';
        
        return $recommendations;
    }
}

// Run the analysis
echo "🔍 Starting API Endpoint Security Analysis...\n";

$mapper = new ApiEndpointMapper();
$report = $mapper->generateReport();

// Output report
echo "\n📊 API Security Analysis Report\n";
echo "=====================================\n";
echo "Scan Date: " . $report['scan_timestamp'] . "\n";
echo "Total Endpoints: " . $report['total_endpoints'] . "\n\n";

echo "🔒 Security Level Distribution:\n";
foreach ($report['endpoints_by_security_level'] as $level => $count) {
    echo "  $level: $count endpoints\n";
}

echo "\n📈 Security Statistics:\n";
echo "  Authenticated: " . $report['security_statistics']['authenticated_endpoints'] . "\n";
echo "  Public: " . $report['security_statistics']['public_endpoints'] . "\n";
echo "  Rate Limited: " . $report['security_statistics']['rate_limited_endpoints'] . "\n";

if (!empty($report['security_issues'])) {
    echo "\n⚠️  Security Issues Found: " . count($report['security_issues']) . "\n";
    foreach ($report['security_issues'] as $issue) {
        echo "  • " . $issue['endpoint']['method'] . " " . $issue['endpoint']['path'] . "\n";
        foreach ($issue['issues'] as $desc) {
            echo "    - $desc\n";
        }
    }
}

echo "\n💡 Recommendations:\n";
foreach ($report['recommendations'] as $rec) {
    echo "  • $rec\n";
}

// Save detailed report to file
file_put_contents('api-security-report.json', json_encode($report, JSON_PRETTY_PRINT));
echo "\n📁 Detailed report saved to: api-security-report.json\n";
echo "✅ Analysis complete!\n";