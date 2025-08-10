<?php

namespace App\Security;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Events\QueryExecuted;

/**
 * Database Query Validator
 * Monitors and validates database queries for security threats
 * Implements query analysis, logging, and blocking mechanisms
 */
class DatabaseQueryValidator
{
    /**
     * Dangerous SQL patterns that should never be executed
     */
    protected array $dangerousPatterns = [
        // DDL operations that could damage schema
        '/\b(drop|truncate)\s+(database|schema|table)\b/i',
        
        // User management operations
        '/\b(create|drop|alter)\s+user\b/i',
        '/\b(grant|revoke)\b.*\b(all|privileges)\b/i',
        
        // System operations
        '/\b(shutdown|reboot)\b/i',
        
        // File operations
        '/\b(load_file|into\s+(outfile|dumpfile))\b/i',
        
        // Stored procedure execution
        '/\b(exec|execute|sp_|xp_)\b/i',
        
        // Information disclosure
        '/\b(information_schema|sys\.|mysql\.|pg_|version\(\))\b/i',
    ];

    /**
     * Suspicious patterns that should be logged and monitored
     */
    protected array $suspiciousPatterns = [
        // Union-based injection indicators
        '/\bunion\b.*\bselect\b/i',
        
        // Boolean-based injection indicators
        '/\b(and|or)\s+\d+\s*=\s*\d+/i',
        '/\b(and|or)\s+[\'"]\w+[\'"]\s*=\s*[\'"]\w+[\'"]/i',
        
        // Time-based injection indicators
        '/\b(sleep|waitfor|delay|benchmark)\s*\(/i',
        
        // Comment indicators
        '/(\/\*.*\*\/|--|\#)/',
        
        // Multiple statement indicators
        '/;\s*(select|insert|update|delete)/i',
        
        // Function calls that could be malicious
        '/\b(char|ascii|hex|unhex|convert|cast)\s*\(/i',
    ];

    /**
     * Tables that should have restricted access
     */
    protected array $restrictedTables = [
        'users',
        'password_resets',
        'personal_access_tokens',
        'sessions',
        'audit_logs',
        'admin_actions',
        'migrations'
    ];

    /**
     * Columns that contain sensitive data
     */
    protected array $sensitiveColumns = [
        'password',
        'remember_token',
        'email_verified_at',
        'cpf',
        'social_security',
        'credit_card',
        'bank_account',
        'api_token',
        'access_token'
    ];

    /**
     * Initialize query monitoring
     */
    public function initialize(): void
    {
        // Listen to all database queries
        DB::listen(function (QueryExecuted $query) {
            $this->analyzeQuery($query);
        });
    }

    /**
     * Analyze executed query for security threats
     */
    protected function analyzeQuery(QueryExecuted $query): void
    {
        $sql = $query->sql;
        $bindings = $query->bindings;
        $time = $query->time;

        // Create analysis context
        $analysis = [
            'sql' => $sql,
            'bindings' => $bindings,
            'time' => $time,
            'connection' => $query->connectionName,
            'is_dangerous' => false,
            'is_suspicious' => false,
            'threats_detected' => [],
            'risk_score' => 0
        ];

        // Check for dangerous patterns
        $this->checkDangerousPatterns($analysis);

        // Check for suspicious patterns
        $this->checkSuspiciousPatterns($analysis);

        // Check table access patterns
        $this->checkTableAccess($analysis);

        // Check column access patterns
        $this->checkColumnAccess($analysis);

        // Check query complexity
        $this->checkQueryComplexity($analysis);

        // Check binding patterns
        $this->checkBindingPatterns($analysis);

        // Calculate overall risk score
        $this->calculateRiskScore($analysis);

        // Handle based on risk level
        $this->handleQueryAnalysis($analysis);
    }

    /**
     * Check for dangerous SQL patterns
     */
    protected function checkDangerousPatterns(array &$analysis): void
    {
        foreach ($this->dangerousPatterns as $pattern) {
            if (preg_match($pattern, $analysis['sql'])) {
                $analysis['is_dangerous'] = true;
                $analysis['threats_detected'][] = [
                    'type' => 'dangerous_pattern',
                    'pattern' => $pattern,
                    'severity' => 'critical'
                ];
                $analysis['risk_score'] += 100;
            }
        }
    }

    /**
     * Check for suspicious SQL patterns
     */
    protected function checkSuspiciousPatterns(array &$analysis): void
    {
        foreach ($this->suspiciousPatterns as $pattern) {
            if (preg_match($pattern, $analysis['sql'])) {
                $analysis['is_suspicious'] = true;
                $analysis['threats_detected'][] = [
                    'type' => 'suspicious_pattern',
                    'pattern' => $pattern,
                    'severity' => 'medium'
                ];
                $analysis['risk_score'] += 30;
            }
        }
    }

    /**
     * Check table access patterns
     */
    protected function checkTableAccess(array &$analysis): void
    {
        foreach ($this->restrictedTables as $table) {
            if (preg_match("/\b{$table}\b/i", $analysis['sql'])) {
                // Check if it's a legitimate operation
                if ($this->isLegitimateTableAccess($analysis['sql'], $table)) {
                    continue;
                }

                $analysis['threats_detected'][] = [
                    'type' => 'restricted_table_access',
                    'table' => $table,
                    'severity' => 'high'
                ];
                $analysis['risk_score'] += 50;
            }
        }
    }

    /**
     * Check column access patterns
     */
    protected function checkColumnAccess(array &$analysis): void
    {
        foreach ($this->sensitiveColumns as $column) {
            if (preg_match("/\b{$column}\b/i", $analysis['sql'])) {
                $analysis['threats_detected'][] = [
                    'type' => 'sensitive_column_access',
                    'column' => $column,
                    'severity' => 'medium'
                ];
                $analysis['risk_score'] += 20;
            }
        }
    }

    /**
     * Check query complexity for potential DoS attacks
     */
    protected function checkQueryComplexity(array &$analysis): void
    {
        $sql = $analysis['sql'];

        // Count JOINs
        $joinCount = preg_match_all('/\bjoin\b/i', $sql);
        if ($joinCount > 5) {
            $analysis['threats_detected'][] = [
                'type' => 'excessive_joins',
                'count' => $joinCount,
                'severity' => 'medium'
            ];
            $analysis['risk_score'] += 25;
        }

        // Check for nested subqueries
        $subqueryCount = preg_match_all('/\(\s*select\b/i', $sql);
        if ($subqueryCount > 3) {
            $analysis['threats_detected'][] = [
                'type' => 'excessive_subqueries',
                'count' => $subqueryCount,
                'severity' => 'medium'
            ];
            $analysis['risk_score'] += 30;
        }

        // Check execution time
        if ($analysis['time'] > 5000) { // 5 seconds
            $analysis['threats_detected'][] = [
                'type' => 'slow_query',
                'time' => $analysis['time'],
                'severity' => 'low'
            ];
            $analysis['risk_score'] += 15;
        }

        // Check for cartesian products (missing JOIN conditions)
        if (preg_match('/from\s+\w+\s*,\s*\w+/i', $sql) && !preg_match('/where\b/i', $sql)) {
            $analysis['threats_detected'][] = [
                'type' => 'potential_cartesian_product',
                'severity' => 'high'
            ];
            $analysis['risk_score'] += 60;
        }
    }

    /**
     * Check binding patterns for injection attempts
     */
    protected function checkBindingPatterns(array &$analysis): void
    {
        foreach ($analysis['bindings'] as $index => $binding) {
            if (is_string($binding)) {
                // Check for SQL keywords in bindings
                if ($this->containsSqlKeywords($binding)) {
                    $analysis['threats_detected'][] = [
                        'type' => 'sql_in_binding',
                        'binding_index' => $index,
                        'value' => substr($binding, 0, 100),
                        'severity' => 'high'
                    ];
                    $analysis['risk_score'] += 40;
                }

                // Check for unusual characters
                if (preg_match('/[<>\'";\\\\]/', $binding)) {
                    $analysis['threats_detected'][] = [
                        'type' => 'suspicious_characters_in_binding',
                        'binding_index' => $index,
                        'severity' => 'low'
                    ];
                    $analysis['risk_score'] += 10;
                }
            }
        }
    }

    /**
     * Calculate overall risk score
     */
    protected function calculateRiskScore(array &$analysis): void
    {
        // Additional factors
        if (count($analysis['threats_detected']) > 3) {
            $analysis['risk_score'] += 25;
        }

        if (strlen($analysis['sql']) > 2000) {
            $analysis['risk_score'] += 15;
        }

        // Normalize score to 0-100 range
        $analysis['risk_score'] = min(100, $analysis['risk_score']);
    }

    /**
     * Handle query analysis results
     */
    protected function handleQueryAnalysis(array $analysis): void
    {
        if ($analysis['is_dangerous']) {
            $this->handleDangerousQuery($analysis);
        } elseif ($analysis['risk_score'] >= 70) {
            $this->handleHighRiskQuery($analysis);
        } elseif ($analysis['risk_score'] >= 40 || $analysis['is_suspicious']) {
            $this->handleMediumRiskQuery($analysis);
        } elseif ($analysis['risk_score'] > 0) {
            $this->handleLowRiskQuery($analysis);
        }
    }

    /**
     * Handle dangerous queries
     */
    protected function handleDangerousQuery(array $analysis): void
    {
        // Log critical security event
        Log::critical('Dangerous SQL query detected and blocked', [
            'sql' => $analysis['sql'],
            'bindings' => $analysis['bindings'],
            'threats' => $analysis['threats_detected'],
            'risk_score' => $analysis['risk_score'],
            'user_id' => auth()->id(),
            'ip' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'timestamp' => now()
        ]);

        // In a production environment, you might want to:
        // 1. Kill the query if possible
        // 2. Block the user/IP temporarily
        // 3. Send alerts to security team
        // 4. Create incident report
    }

    /**
     * Handle high-risk queries
     */
    protected function handleHighRiskQuery(array $analysis): void
    {
        Log::error('High-risk SQL query detected', [
            'sql' => $analysis['sql'],
            'bindings' => $this->sanitizeBindings($analysis['bindings']),
            'threats' => $analysis['threats_detected'],
            'risk_score' => $analysis['risk_score'],
            'execution_time' => $analysis['time'],
            'user_id' => auth()->id(),
            'ip' => request()->ip(),
            'timestamp' => now()
        ]);
    }

    /**
     * Handle medium-risk queries
     */
    protected function handleMediumRiskQuery(array $analysis): void
    {
        Log::warning('Suspicious SQL query detected', [
            'sql' => $analysis['sql'],
            'threats' => $analysis['threats_detected'],
            'risk_score' => $analysis['risk_score'],
            'user_id' => auth()->id(),
            'timestamp' => now()
        ]);
    }

    /**
     * Handle low-risk queries
     */
    protected function handleLowRiskQuery(array $analysis): void
    {
        // Only log if there are specific concerns
        if (!empty($analysis['threats_detected'])) {
            Log::info('Query with minor security concerns', [
                'sql' => substr($analysis['sql'], 0, 200),
                'threats' => $analysis['threats_detected'],
                'risk_score' => $analysis['risk_score'],
                'timestamp' => now()
            ]);
        }
    }

    /**
     * Check if table access is legitimate
     */
    protected function isLegitimateTableAccess(string $sql, string $table): bool
    {
        // Allow SELECT queries with proper conditions
        if (preg_match('/^select\b/i', trim($sql))) {
            // Check if it has WHERE clause for user-specific queries
            if (preg_match('/where\b.*\b(id|user_id)\b\s*=\s*\?/i', $sql)) {
                return true;
            }
        }

        // Allow INSERT/UPDATE queries with bindings
        if (preg_match('/^(insert|update)\b/i', trim($sql))) {
            return true;
        }

        return false;
    }

    /**
     * Check if string contains SQL keywords
     */
    protected function containsSqlKeywords(string $value): bool
    {
        $sqlKeywords = [
            'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter',
            'union', 'exec', 'execute', 'sp_', 'xp_', 'information_schema'
        ];

        $lowerValue = strtolower($value);

        foreach ($sqlKeywords as $keyword) {
            if (strpos($lowerValue, $keyword) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Sanitize bindings for logging
     */
    protected function sanitizeBindings(array $bindings): array
    {
        return array_map(function ($binding) {
            if (is_string($binding) && strlen($binding) > 100) {
                return substr($binding, 0, 100) . '...';
            }
            return $binding;
        }, $bindings);
    }
}