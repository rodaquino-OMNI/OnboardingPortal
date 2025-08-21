<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class DatabaseQueryValidator
{
    /**
     * Dangerous query patterns that should never be executed
     */
    private const DANGEROUS_PATTERNS = [
        '/\bdrop\s+(table|database|index|view)\b/i',
        '/\btruncate\s+table\b/i',
        '/\balter\s+table\s+\w+\s+drop\b/i',
        '/\bdelete\s+from\s+(users|permissions|roles)\b/i',
        '/\bupdate\s+(users|permissions|roles)\s+set\s+(role|is_admin|permissions)\s*=/i',
        '/\bgrant\s+\w+\s+to\b/i',
        '/\brevoke\s+\w+\s+from\b/i',
        '/\bcreate\s+user\b/i',
        '/\bload\s+data\s+infile\b/i',
        '/\binto\s+outfile\b/i',
        '/\bexec\s*\(/i',
        '/\bexecute\s+immediate\b/i',
    ];
    
    /**
     * Suspicious query patterns that should be monitored
     */
    private const SUSPICIOUS_PATTERNS = [
        '/\bunion\s+select\b/i',
        '/\bor\s+1\s*=\s*1\b/i',
        '/\bor\s+\'1\'\s*=\s*\'1\'/i',
        '/\b(sleep|benchmark|waitfor)\s*\(/i',
        '/\bhaving\s+1\s*=\s*1\b/i',
        '/\bconcat\s*\(.*version\s*\(\)/i',
        '/\b@@version\b/i',
        '/\bdatabase\s*\(\s*\)/i',
        '/\buser\s*\(\s*\)/i',
        '/\bload_file\s*\(/i',
    ];
    
    /**
     * Tables that contain sensitive data
     */
    private const SENSITIVE_TABLES = [
        'users',
        'password_resets',
        'personal_access_tokens',
        'sessions',
        'beneficiaries',
        'health_questionnaires',
        'documents',
        'audit_logs',
    ];
    
    /**
     * Columns that contain sensitive data
     */
    private const SENSITIVE_COLUMNS = [
        'password',
        'remember_token',
        'api_token',
        'cpf',
        'rg',
        'birth_date',
        'health_data',
        'medical_history',
        'secret_answer',
        'two_factor_secret',
    ];
    
    /**
     * Initialize query monitoring
     */
    public static function initialize(): void
    {
        // Skip initialization in testing environment or when explicitly disabled
        if (app()->environment('testing') || !config('security.query_validator_enabled', true)) {
            return;
        }
        
        DB::listen(function ($query) {
            self::validateQuery($query);
        });
    }
    
    /**
     * Validate a database query
     */
    private static function validateQuery($query): void
    {
        $sql = $query->sql;
        $bindings = $query->bindings;
        $time = $query->time;
        
        // Check for dangerous patterns
        foreach (self::DANGEROUS_PATTERNS as $pattern) {
            if (preg_match($pattern, $sql)) {
                self::handleDangerousQuery($sql, $bindings, $pattern);
                return;
            }
        }
        
        // Check for suspicious patterns
        foreach (self::SUSPICIOUS_PATTERNS as $pattern) {
            if (preg_match($pattern, $sql)) {
                self::handleSuspiciousQuery($sql, $bindings, $pattern);
            }
        }
        
        // Monitor queries on sensitive tables
        self::monitorSensitiveDataAccess($sql, $bindings);
        
        // Monitor slow queries
        self::monitorSlowQueries($sql, $time);
        
        // Track query statistics
        self::trackQueryStatistics($sql);
    }
    
    /**
     * Handle dangerous query detection
     */
    private static function handleDangerousQuery(string $sql, array $bindings, string $pattern): void
    {
        $context = [
            'sql' => $sql,
            'bindings' => $bindings,
            'pattern' => $pattern,
            'user_id' => auth()->id(),
            'ip' => request()->ip() ?? 'console',
            'url' => request()->fullUrl() ?? 'console',
            'stack_trace' => debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 10),
        ];
        
        Log::critical('DANGEROUS QUERY BLOCKED', $context);
        
        // Notify administrators
        self::notifyAdministrators('Dangerous Query Blocked', $context);
        
        // Block the query execution
        throw new \Exception('Query execution blocked for security reasons.');
    }
    
    /**
     * Handle suspicious query detection
     */
    private static function handleSuspiciousQuery(string $sql, array $bindings, string $pattern): void
    {
        $ip = request()->ip() ?? 'console';
        
        // Increment suspicious query counter
        $key = "suspicious_queries:{$ip}";
        $count = Cache::increment($key);
        Cache::put($key, $count, 3600); // 1 hour
        
        $context = [
            'sql' => $sql,
            'bindings' => $bindings,
            'pattern' => $pattern,
            'user_id' => auth()->id(),
            'ip' => $ip,
            'url' => request()->fullUrl() ?? 'console',
            'suspicious_count' => $count,
        ];
        
        Log::warning('Suspicious query detected', $context);
        
        // Block if too many suspicious queries
        if ($count > 10) {
            self::blockSuspiciousIp($ip);
            throw new \Exception('Too many suspicious queries detected.');
        }
    }
    
    /**
     * Monitor access to sensitive data
     */
    private static function monitorSensitiveDataAccess(string $sql, array $bindings): void
    {
        $lowerSql = strtolower($sql);
        
        // Check for sensitive table access
        foreach (self::SENSITIVE_TABLES as $table) {
            if (strpos($lowerSql, $table) !== false) {
                // Check if selecting sensitive columns
                foreach (self::SENSITIVE_COLUMNS as $column) {
                    if (strpos($lowerSql, $column) !== false) {
                        Log::info('Sensitive data accessed', [
                            'table' => $table,
                            'column' => $column,
                            'user_id' => auth()->id(),
                            'ip' => request()->ip() ?? 'console',
                            'operation' => self::getQueryOperation($sql),
                        ]);
                    }
                }
            }
        }
    }
    
    /**
     * Monitor slow queries
     */
    private static function monitorSlowQueries(string $sql, float $time): void
    {
        // Log queries taking more than 1 second
        if ($time > 1000) {
            Log::warning('Slow query detected', [
                'sql' => $sql,
                'time_ms' => $time,
                'user_id' => auth()->id(),
                'ip' => request()->ip() ?? 'console',
            ]);
            
            // Track slow query patterns
            $operation = self::getQueryOperation($sql);
            $key = "slow_queries:{$operation}";
            $slowCount = Cache::increment($key);
            Cache::put($key, $slowCount, 86400); // 24 hours
        }
    }
    
    /**
     * Track query statistics
     */
    private static function trackQueryStatistics(string $sql): void
    {
        $operation = self::getQueryOperation($sql);
        $hour = date('Y-m-d:H');
        
        // Track queries per operation type
        $key = "query_stats:{$hour}:{$operation}";
        $statCount = Cache::increment($key);
        Cache::put($key, $statCount, 86400); // 24 hours
        
        // Track total queries
        $totalKey = "query_stats:{$hour}:total";
        $totalCount = Cache::increment($totalKey);
        Cache::put($totalKey, $totalCount, 86400); // 24 hours
    }
    
    /**
     * Get query operation type
     */
    private static function getQueryOperation(string $sql): string
    {
        $sql = strtolower(trim($sql));
        
        if (strpos($sql, 'select') === 0) return 'select';
        if (strpos($sql, 'insert') === 0) return 'insert';
        if (strpos($sql, 'update') === 0) return 'update';
        if (strpos($sql, 'delete') === 0) return 'delete';
        if (strpos($sql, 'create') === 0) return 'create';
        if (strpos($sql, 'drop') === 0) return 'drop';
        if (strpos($sql, 'alter') === 0) return 'alter';
        
        return 'other';
    }
    
    /**
     * Block suspicious IP
     */
    private static function blockSuspiciousIp(string $ip): void
    {
        Cache::put("blocked_ip:{$ip}", true, now()->addHours(24));
        
        Log::critical('IP blocked for suspicious database queries', [
            'ip' => $ip,
            'duration' => '24 hours',
        ]);
    }
    
    /**
     * Notify administrators of security issues
     */
    private static function notifyAdministrators(string $subject, array $context): void
    {
        // TODO: Implement email/notification to administrators
        // For now, just log critically
        Log::critical("SECURITY ALERT: {$subject}", $context);
    }
    
    /**
     * Get query statistics
     */
    public static function getStatistics(): array
    {
        $hour = date('Y-m-d:H');
        $stats = [];
        
        $operations = ['select', 'insert', 'update', 'delete', 'total'];
        
        foreach ($operations as $operation) {
            $key = "query_stats:{$hour}:{$operation}";
            $stats[$operation] = Cache::get($key, 0);
        }
        
        return $stats;
    }
    
    /**
     * Check if IP is blocked
     */
    public static function isIpBlocked(string $ip): bool
    {
        return Cache::has("blocked_ip:{$ip}");
    }
}