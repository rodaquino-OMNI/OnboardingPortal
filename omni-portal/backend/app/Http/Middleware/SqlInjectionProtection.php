<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpKernel\Exception\HttpException;

class SqlInjectionProtection
{
    /**
     * Optimized SQL injection patterns (reduced complexity)
     */
    private const CRITICAL_PATTERNS = [
        '/union\s+select/i',
        '/select\s+.*\s+from/i',
        '/insert\s+into/i',
        '/update\s+.*\s+set/i',
        '/delete\s+from/i',
        '/drop\s+table/i',
        '/create\s+table/i',
        '/alter\s+table/i',
        '/exec\b|execute\b/i',
        '/script[^a-z]/i',
        '/<script/i',
        '/javascript:/i',
        '/\'\s*or\s*\'/i',
        '/"\s*or\s*"/i',
        '/--\s*$/m',
        '/sleep\s*\(/i',
        '/benchmark\s*\(/i',
    ];
    
    /**
     * Medium priority patterns (checked only if critical patterns pass)
     */
    private const MEDIUM_PATTERNS = [
        '/onload\s*=/i',
        '/onerror\s*=/i',
        '/\bor\s+\d+\s*=\s*\d+/i',
        '/\band\s+\d+\s*=\s*\d+/i',
        '/waitfor\s+delay/i',
        '/load_file/i',
        '/outfile/i',
    ];
    
    /**
     * Fast keyword detection (case-insensitive string contains)
     */
    private const CRITICAL_KEYWORDS = [
        'union select', 'select from', 'insert into', 'delete from', 
        'drop table', 'create table', 'alter table', 'javascript:', 
        'script>', '<script', "'or'", '"or"', '--', 'sleep(', 'benchmark('
    ];
    
    /**
     * Whitelisted IP addresses (trusted sources)
     */
    private const WHITELISTED_IPS = [
        '127.0.0.1',
        '::1',
        // Add your trusted IPs here
        // '192.168.1.100',
        // '10.0.0.0/8',
    ];
    
    /**
     * Safe routes that skip heavy analysis
     */
    private const SAFE_ROUTES = [
        'api/health',
        'api/status',
        'api/version',
        'heartbeat',
        'ping',
        'metrics',
    ];
    
    /**
     * Content types that are safe to skip
     */
    private const SAFE_CONTENT_TYPES = [
        'image/',
        'video/',
        'audio/',
        'application/pdf',
        'text/css',
        'text/javascript',
        'application/javascript',
    ];
    
    /**
     * Maximum allowed violations per IP before blocking
     */
    private const MAX_VIOLATIONS = 3;
    
    /**
     * Block duration in minutes
     */
    private const BLOCK_DURATION = 60;
    
    /**
     * Pattern cache TTL in seconds
     */
    private const PATTERN_CACHE_TTL = 300;
    
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $ip = $request->ip();
        
        // Early return: Check if IP is whitelisted
        if ($this->isIpWhitelisted($ip)) {
            return $next($request);
        }
        
        // Early return: Check if route is safe
        if ($this->isSafeRoute($request)) {
            return $next($request);
        }
        
        // Early return: Check if content type is safe
        if ($this->isSafeContentType($request)) {
            return $next($request);
        }
        
        // Check if IP is blocked
        if ($this->isIpBlocked($ip)) {
            $this->logBlockedAttempt($request);
            throw new HttpException(403, 'Access denied due to security violations.');
        }
        
        // Fast threat detection using cached patterns
        $threats = $this->fastThreatDetection($request);
        
        if (!empty($threats)) {
            $this->handleThreatDetection($request, $threats);
            
            // Block critical threats immediately
            if ($this->isCriticalThreat($threats)) {
                throw new HttpException(400, 'Invalid request detected.');
            }
        }
        
        // Only enable monitoring for suspicious requests or debug mode
        if (!empty($threats) || config('app.debug')) {
            $this->enableQueryMonitoring();
        }
        
        $response = $next($request);
        
        // Only validate response if threats were detected
        if (!empty($threats)) {
            $this->validateResponse($response);
        }
        
        return $response;
    }
    
    /**
     * Check if IP is whitelisted
     */
    private function isIpWhitelisted(string $ip): bool
    {
        // Check exact IP matches
        if (in_array($ip, self::WHITELISTED_IPS)) {
            return true;
        }
        
        // Check CIDR ranges (basic implementation)
        foreach (self::WHITELISTED_IPS as $whitelist) {
            if (strpos($whitelist, '/') !== false) {
                if ($this->ipInRange($ip, $whitelist)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if IP is in CIDR range
     */
    private function ipInRange(string $ip, string $cidr): bool
    {
        list($subnet, $mask) = explode('/', $cidr);
        
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return (ip2long($ip) & ~((1 << (32 - $mask)) - 1)) == ip2long($subnet);
        }
        
        // IPv6 support would require more complex logic
        return false;
    }
    
    /**
     * Check if route is safe
     */
    private function isSafeRoute(Request $request): bool
    {
        $path = trim($request->path(), '/');
        
        foreach (self::SAFE_ROUTES as $safeRoute) {
            if (str_starts_with($path, $safeRoute)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if content type is safe
     */
    private function isSafeContentType(Request $request): bool
    {
        $contentType = $request->header('Content-Type', '');
        
        foreach (self::SAFE_CONTENT_TYPES as $safeType) {
            if (str_starts_with($contentType, $safeType)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Fast threat detection with caching
     */
    private function fastThreatDetection(Request $request): array
    {
        // Create cache key based on request signature
        $requestSignature = $this->createRequestSignature($request);
        $cacheKey = "sql_injection_scan:{$requestSignature}";
        
        // Check cache first
        $cachedResult = Cache::get($cacheKey);
        if ($cachedResult !== null) {
            return $cachedResult;
        }
        
        $threats = [];
        
        // Quick keyword scan first (faster than regex)
        $suspiciousInput = $this->extractSuspiciousInput($request);
        if (!$this->hasQuickKeywordThreats($suspiciousInput)) {
            // Cache negative result for longer
            Cache::put($cacheKey, [], self::PATTERN_CACHE_TTL * 2);
            return [];
        }
        
        // If keywords found, do detailed pattern matching
        $threats = $this->detailedThreatAnalysis($request);
        
        // Cache result
        Cache::put($cacheKey, $threats, self::PATTERN_CACHE_TTL);
        
        return $threats;
    }
    
    /**
     * Create request signature for caching
     */
    private function createRequestSignature(Request $request): string
    {
        $data = [
            'method' => $request->method(),
            'path' => $request->path(),
            'query' => $request->query(),
            'input' => $request->except(['_token', 'password', 'password_confirmation']),
        ];
        
        return md5(serialize($data));
    }
    
    /**
     * Extract potentially suspicious input for quick scanning
     */
    private function extractSuspiciousInput(Request $request): string
    {
        $input = [];
        
        // Collect all input in a single string for fast scanning
        $input[] = $request->path();
        $input[] = implode(' ', $request->query());
        $input[] = implode(' ', $request->except(['_token', 'password', 'password_confirmation']));
        
        // Add suspicious headers
        foreach (['referer', 'user-agent', 'x-forwarded-for'] as $header) {
            $value = $request->header($header);
            if ($value) {
                $input[] = $value;
            }
        }
        
        return strtolower(implode(' ', $input));
    }
    
    /**
     * Quick keyword threat detection
     */
    private function hasQuickKeywordThreats(string $input): bool
    {
        foreach (self::CRITICAL_KEYWORDS as $keyword) {
            if (strpos($input, strtolower($keyword)) !== false) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Detailed threat analysis with optimized patterns
     */
    private function detailedThreatAnalysis(Request $request): array
    {
        $threats = [];
        
        // Check critical patterns first
        $criticalThreats = $this->scanWithPatterns($request, self::CRITICAL_PATTERNS, 'critical');
        if (!empty($criticalThreats)) {
            $threats = array_merge($threats, $criticalThreats);
        }
        
        // Only check medium patterns if no critical threats found
        if (empty($criticalThreats)) {
            $mediumThreats = $this->scanWithPatterns($request, self::MEDIUM_PATTERNS, 'medium');
            $threats = array_merge($threats, $mediumThreats);
        }
        
        return $threats;
    }
    
    /**
     * Scan request with specific pattern set
     */
    private function scanWithPatterns(Request $request, array $patterns, string $severity): array
    {
        $threats = [];
        
        // Get input sources
        $inputSources = [
            'query' => $request->query(),
            'post' => $request->except(['_token', 'password', 'password_confirmation']),
            'path' => $request->path(),
        ];
        
        // Only check JSON if content type suggests it
        if ($request->isJson()) {
            $inputSources['json'] = $request->json()->all();
        }
        
        foreach ($inputSources as $source => $data) {
            $sourceThreats = $this->scanDataWithPatterns($data, $patterns, $source, $severity);
            if (!empty($sourceThreats)) {
                $threats = array_merge($threats, $sourceThreats);
                
                // Early exit for critical threats
                if ($severity === 'critical') {
                    break;
                }
            }
        }
        
        return $threats;
    }
    
    /**
     * Scan data with pattern set
     */
    private function scanDataWithPatterns($data, array $patterns, string $source, string $severity): array
    {
        if (is_string($data)) {
            return $this->scanStringWithPatterns($data, $patterns, $source, $severity);
        }
        
        if (is_array($data)) {
            $threats = [];
            foreach ($data as $key => $value) {
                if (is_string($value)) {
                    $valueThreats = $this->scanStringWithPatterns($value, $patterns, $source, $severity);
                    if (!empty($valueThreats)) {
                        $threats = array_merge($threats, $valueThreats);
                        
                        // Early exit for critical threats
                        if ($severity === 'critical') {
                            break;
                        }
                    }
                }
            }
            return $threats;
        }
        
        return [];
    }
    
    /**
     * Scan string with pattern set
     */
    private function scanStringWithPatterns(string $value, array $patterns, string $source, string $severity): array
    {
        if (empty($value) || strlen($value) > 10000) { // Skip very long values
            return [];
        }
        
        $threats = [];
        $decodedValue = $this->quickDecode($value);
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $decodedValue)) {
                $threats[] = [
                    'source' => $source,
                    'value' => substr($value, 0, 200), // Limit logged value
                    'pattern' => $pattern,
                    'severity' => $severity,
                ];
                
                // Early exit for critical threats
                if ($severity === 'critical') {
                    break;
                }
            }
        }
        
        return $threats;
    }
    
    /**
     * Quick decode (optimized version)
     */
    private function quickDecode(string $value): string
    {
        // Only decode if necessary
        if (strpos($value, '%') !== false) {
            $value = urldecode($value);
        }
        
        if (strpos($value, '&') !== false) {
            $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5);
        }
        
        return $value;
    }
    
    /**
     * Check if threat is critical (replaces isHighRiskThreat)
     */
    private function isCriticalThreat(array $threats): bool
    {
        foreach ($threats as $threat) {
            if (($threat['severity'] ?? '') === 'critical') {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Handle threat detection
     */
    private function handleThreatDetection(Request $request, array $threats): void
    {
        $ip = $request->ip();
        
        // Log the threat
        Log::warning('SQL injection attempt detected', [
            'ip' => $ip,
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'threats' => $threats,
            'user_agent' => $request->userAgent(),
            'user_id' => auth()->id(),
        ]);
        
        // Increment violation counter
        $violations = $this->incrementViolations($ip);
        
        // Block IP if violations exceed threshold
        if ($violations >= self::MAX_VIOLATIONS) {
            $this->blockIp($ip);
        }
        
        // Rate limit suspicious requests
        $this->rateLimitRequest($request);
    }
    
    
    /**
     * Check if IP is blocked
     */
    private function isIpBlocked(string $ip): bool
    {
        return Cache::has("sql_injection_blocked:{$ip}");
    }
    
    /**
     * Block IP address
     */
    private function blockIp(string $ip): void
    {
        Cache::put("sql_injection_blocked:{$ip}", true, now()->addMinutes(self::BLOCK_DURATION));
        
        Log::critical('IP blocked for SQL injection attempts', [
            'ip' => $ip,
            'duration' => self::BLOCK_DURATION . ' minutes',
        ]);
    }
    
    /**
     * Increment violation counter
     */
    private function incrementViolations(string $ip): int
    {
        $key = "sql_injection_violations:{$ip}";
        $violations = Cache::get($key, 0) + 1;
        
        Cache::put($key, $violations, now()->addHours(1));
        
        return $violations;
    }
    
    /**
     * Rate limit suspicious requests
     */
    private function rateLimitRequest(Request $request): void
    {
        $key = "sql_injection_rate_limit:{$request->ip()}";
        $attempts = Cache::get($key, 0) + 1;
        
        Cache::put($key, $attempts, now()->addMinutes(1));
        
        if ($attempts > 10) {
            throw new HttpException(429, 'Too many requests.');
        }
    }
    
    /**
     * Log blocked attempt
     */
    private function logBlockedAttempt(Request $request): void
    {
        Log::critical('Blocked SQL injection attempt from banned IP', [
            'ip' => $request->ip(),
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'user_agent' => $request->userAgent(),
        ]);
    }
    
    /**
     * Enable query monitoring (optimized)
     */
    private function enableQueryMonitoring(): void
    {
        if (config('app.debug') || config('security.sql_monitoring', false)) {
            \DB::listen(function ($query) {
                // Only monitor if query contains suspicious patterns
                if ($this->isQuerySuspicious($query->sql)) {
                    $this->monitorQuery($query->sql, $query->bindings);
                }
            });
        }
    }
    
    /**
     * Quick check if query is suspicious
     */
    private function isQuerySuspicious(string $sql): bool
    {
        $suspiciousKeywords = ['drop table', 'truncate table', 'delete from users', 'update users set role'];
        $lowerSql = strtolower($sql);
        
        foreach ($suspiciousKeywords as $keyword) {
            if (strpos($lowerSql, $keyword) !== false) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Monitor executed queries (optimized)
     */
    private function monitorQuery(string $sql, array $bindings): void
    {
        // Use faster patterns for critical queries only
        $criticalPatterns = [
            '/\bdrop\s+table\b/i',
            '/\btruncate\s+table\b/i',
            '/\bdelete\s+from\s+users\b/i',
            '/\bupdate\s+users\s+set\s+role\s*=/i',
        ];
        
        foreach ($criticalPatterns as $pattern) {
            if (preg_match($pattern, $sql)) {
                Log::critical('Dangerous query executed', [
                    'sql' => substr($sql, 0, 500), // Limit SQL length
                    'bindings' => array_slice($bindings, 0, 10), // Limit bindings
                    'user_id' => auth()->id(),
                    'ip' => request()->ip(),
                ]);
                break; // Exit on first match
            }
        }
    }
    
    /**
     * Validate response doesn't leak SQL information (optimized)
     */
    private function validateResponse($response): void
    {
        if (!$response || !method_exists($response, 'getContent')) {
            return;
        }
        
        $content = $response->getContent();
        
        // Skip validation for very large responses
        if (strlen($content) > 50000) {
            return;
        }
        
        // Quick keyword check first
        $errorKeywords = ['SQLSTATE', 'mysql_', 'mysqli_', 'pg_query', 'sqlite_'];
        $lowerContent = strtolower($content);
        $hasErrorKeyword = false;
        
        foreach ($errorKeywords as $keyword) {
            if (strpos($lowerContent, strtolower($keyword)) !== false) {
                $hasErrorKeyword = true;
                break;
            }
        }
        
        // Only run regex if keywords found
        if ($hasErrorKeyword) {
            $errorPatterns = [
                '/SQLSTATE\[\w+\]/',
                '/SQL syntax/',
                '/mysql_/',
                '/mysqli_/',
                '/pg_query/',
                '/sqlite_/',
            ];
            
            foreach ($errorPatterns as $pattern) {
                if (preg_match($pattern, $content)) {
                    Log::error('SQL error exposed in response', [
                        'pattern' => $pattern,
                        'url' => request()->fullUrl(),
                    ]);
                    
                    // In production, replace with generic error
                    if (!config('app.debug')) {
                        $response->setContent(json_encode([
                            'message' => 'An error occurred processing your request.',
                            'error' => 'server_error',
                        ]));
                    }
                    break; // Exit on first match
                }
            }
        }
    }
}