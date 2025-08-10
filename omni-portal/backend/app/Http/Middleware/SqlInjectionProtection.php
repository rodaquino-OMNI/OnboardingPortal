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
     * SQL injection patterns to detect
     */
    private const DANGEROUS_PATTERNS = [
        '/(\bunion\b.*\bselect\b)/i',
        '/(\bselect\b.*\bfrom\b.*\bwhere\b)/i',
        '/(\binsert\b.*\binto\b)/i',
        '/(\bupdate\b.*\bset\b)/i',
        '/(\bdelete\b.*\bfrom\b)/i',
        '/(\bdrop\b.*\btable\b)/i',
        '/(\bcreate\b.*\btable\b)/i',
        '/(\balter\b.*\btable\b)/i',
        '/(\bexec\b|\bexecute\b)/i',
        '/(\bscript\b.*\b>)/i',
        '/(\b<\s*script\b)/i',
        '/(\bjavascript\s*:)/i',
        '/(\bonload\s*=)/i',
        '/(\bonerror\s*=)/i',
        '/(\bor\b\s*\d+\s*=\s*\d+)/i',
        '/(\band\b\s*\d+\s*=\s*\d+)/i',
        '/(\'\s*or\s*\')/i',
        '/(\"\s*or\s*\")/i',
        '/(--\s*$)/m',
        '/(\bwaitfor\b.*\bdelay\b)/i',
        '/(\bsleep\b\s*\()/i',
        '/(\bbenchmark\b\s*\()/i',
    ];
    
    /**
     * High-risk SQL keywords
     */
    private const HIGH_RISK_KEYWORDS = [
        'union', 'select', 'insert', 'update', 'delete', 'drop', 
        'create', 'alter', 'exec', 'execute', 'script', 'javascript',
        'waitfor', 'delay', 'sleep', 'benchmark', 'load_file', 'outfile'
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
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Check if IP is blocked
        if ($this->isIpBlocked($request->ip())) {
            $this->logBlockedAttempt($request);
            throw new HttpException(403, 'Access denied due to security violations.');
        }
        
        // Analyze request for SQL injection attempts
        $threats = $this->analyzeRequest($request);
        
        if (!empty($threats)) {
            $this->handleThreatDetection($request, $threats);
            
            // Block high-risk requests immediately
            if ($this->isHighRiskThreat($threats)) {
                throw new HttpException(400, 'Invalid request detected.');
            }
        }
        
        // Monitor query execution
        $this->enableQueryMonitoring();
        
        $response = $next($request);
        
        // Validate response doesn't contain sensitive SQL data
        $this->validateResponse($response);
        
        return $response;
    }
    
    /**
     * Analyze request for SQL injection attempts
     */
    private function analyzeRequest(Request $request): array
    {
        $threats = [];
        
        // Check all input sources
        $inputSources = [
            'query' => $request->query(),
            'post' => $request->post(),
            'json' => $request->json()->all(),
            'route' => $request->route() ? $request->route()->parameters() : [],
            'headers' => $this->getSuspiciousHeaders($request),
        ];
        
        foreach ($inputSources as $source => $data) {
            $threats = array_merge($threats, $this->scanForThreats($data, $source));
        }
        
        // Check URL path
        $pathThreats = $this->scanValue($request->path(), 'path');
        if (!empty($pathThreats)) {
            $threats[] = ['source' => 'path', 'threats' => $pathThreats];
        }
        
        return $threats;
    }
    
    /**
     * Scan data for SQL injection threats
     */
    private function scanForThreats($data, string $source): array
    {
        $threats = [];
        
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                if (is_array($value)) {
                    $threats = array_merge($threats, $this->scanForThreats($value, $source));
                } else {
                    $keyThreats = $this->scanValue($key, $source);
                    $valueThreats = $this->scanValue($value, $source);
                    
                    if (!empty($keyThreats) || !empty($valueThreats)) {
                        $threats[] = [
                            'source' => $source,
                            'key' => $key,
                            'value' => $value,
                            'threats' => array_merge($keyThreats, $valueThreats),
                        ];
                    }
                }
            }
        } else {
            $valueThreats = $this->scanValue($data, $source);
            if (!empty($valueThreats)) {
                $threats[] = [
                    'source' => $source,
                    'value' => $data,
                    'threats' => $valueThreats,
                ];
            }
        }
        
        return $threats;
    }
    
    /**
     * Scan a single value for threats
     */
    private function scanValue($value, string $source): array
    {
        if (!is_string($value) || empty($value)) {
            return [];
        }
        
        $threats = [];
        
        // Decode potential obfuscation
        $decodedValue = $this->decodeValue($value);
        
        // Check against dangerous patterns
        foreach (self::DANGEROUS_PATTERNS as $pattern) {
            if (preg_match($pattern, $decodedValue)) {
                $threats[] = [
                    'type' => 'pattern',
                    'pattern' => $pattern,
                    'severity' => 'high',
                ];
            }
        }
        
        // Check for high-risk keywords
        $lowerValue = strtolower($decodedValue);
        foreach (self::HIGH_RISK_KEYWORDS as $keyword) {
            if (strpos($lowerValue, $keyword) !== false) {
                // Check if it's in a suspicious context
                if ($this->isKeywordSuspicious($keyword, $decodedValue, $source)) {
                    $threats[] = [
                        'type' => 'keyword',
                        'keyword' => $keyword,
                        'severity' => 'medium',
                    ];
                }
            }
        }
        
        // Check for encoded/obfuscated SQL
        if ($this->hasEncodedSql($value)) {
            $threats[] = [
                'type' => 'encoded',
                'severity' => 'high',
            ];
        }
        
        return $threats;
    }
    
    /**
     * Decode potentially obfuscated values
     */
    private function decodeValue(string $value): string
    {
        // URL decode
        $decoded = urldecode($value);
        
        // HTML entity decode
        $decoded = html_entity_decode($decoded, ENT_QUOTES | ENT_HTML5);
        
        // Base64 decode if it looks like base64
        if (preg_match('/^[a-zA-Z0-9\/\r\n+]*={0,2}$/', $decoded) && strlen($decoded) % 4 === 0) {
            $base64Decoded = base64_decode($decoded, true);
            if ($base64Decoded !== false) {
                $decoded = $base64Decoded;
            }
        }
        
        // Hex decode
        $decoded = preg_replace_callback('/\\\\x([0-9a-fA-F]{2})/', function($matches) {
            return chr(hexdec($matches[1]));
        }, $decoded);
        
        return $decoded;
    }
    
    /**
     * Check if keyword is in suspicious context
     */
    private function isKeywordSuspicious(string $keyword, string $value, string $source): bool
    {
        // Whitelist certain sources/contexts
        $whitelist = [
            'select' => ['source' => ['headers'], 'fields' => ['accept-language', 'user-agent']],
            'update' => ['source' => ['route'], 'context' => '/api/profile/update'],
            'delete' => ['source' => ['route'], 'context' => '/api/*/delete'],
        ];
        
        if (isset($whitelist[$keyword])) {
            // Check if this context is whitelisted
            if (in_array($source, $whitelist[$keyword]['source'] ?? [])) {
                return false;
            }
        }
        
        // Keywords in certain fields are more suspicious
        $suspiciousFields = ['email', 'password', 'cpf', 'id', 'user_id', 'token'];
        if (in_array($source, $suspiciousFields)) {
            return true;
        }
        
        return true;
    }
    
    /**
     * Check for encoded SQL patterns
     */
    private function hasEncodedSql(string $value): bool
    {
        // Check for common SQL encoding patterns
        $patterns = [
            '/\b0x[0-9a-fA-F]+\b/', // Hex encoded
            '/char\s*\([0-9,\s]+\)/i', // CHAR() encoding
            '/concat\s*\(/i', // CONCAT function
            '/\\\\\d{3}/', // Octal encoding
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Get suspicious headers
     */
    private function getSuspiciousHeaders(Request $request): array
    {
        $suspicious = [];
        $checkHeaders = ['referer', 'user-agent', 'x-forwarded-for', 'x-real-ip'];
        
        foreach ($checkHeaders as $header) {
            $value = $request->header($header);
            if ($value) {
                $suspicious[$header] = $value;
            }
        }
        
        return $suspicious;
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
     * Check if threat is high risk
     */
    private function isHighRiskThreat(array $threats): bool
    {
        foreach ($threats as $threat) {
            if (isset($threat['threats'])) {
                foreach ($threat['threats'] as $t) {
                    if (($t['severity'] ?? '') === 'high') {
                        return true;
                    }
                }
            }
        }
        
        return false;
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
     * Enable query monitoring
     */
    private function enableQueryMonitoring(): void
    {
        if (config('app.debug') || config('security.sql_monitoring', false)) {
            \DB::listen(function ($query) {
                // Monitor for dangerous query patterns
                $this->monitorQuery($query->sql, $query->bindings);
            });
        }
    }
    
    /**
     * Monitor executed queries
     */
    private function monitorQuery(string $sql, array $bindings): void
    {
        // Check for dangerous patterns in actual queries
        $dangerousQueries = [
            '/\bdrop\s+table\b/i',
            '/\btruncate\s+table\b/i',
            '/\bdelete\s+from\s+users\b/i',
            '/\bupdate\s+users\s+set\s+role\s*=/i',
        ];
        
        foreach ($dangerousQueries as $pattern) {
            if (preg_match($pattern, $sql)) {
                Log::critical('Dangerous query executed', [
                    'sql' => $sql,
                    'bindings' => $bindings,
                    'user_id' => auth()->id(),
                    'ip' => request()->ip(),
                ]);
            }
        }
    }
    
    /**
     * Validate response doesn't leak SQL information
     */
    private function validateResponse($response): void
    {
        if (!$response || !method_exists($response, 'getContent')) {
            return;
        }
        
        $content = $response->getContent();
        
        // Check for SQL error messages
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
            }
        }
    }
}