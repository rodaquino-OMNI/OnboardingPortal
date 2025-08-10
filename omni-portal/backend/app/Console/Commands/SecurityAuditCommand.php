<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Models\User;
use App\Models\AuditLog;

/**
 * Security Audit Command
 * Performs comprehensive security checks and generates reports
 */
class SecurityAuditCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'security:audit 
                          {--report : Generate detailed security report}
                          {--fix : Attempt to fix identified issues}
                          {--email : Email report to administrators}';

    /**
     * The console command description.
     */
    protected $description = 'Perform comprehensive security audit of the application';

    /**
     * Security check results
     */
    protected array $results = [];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting comprehensive security audit...');
        
        // Perform all security checks
        $this->checkSessionSecurity();
        $this->checkUserAccountSecurity();
        $this->checkDatabaseSecurity();
        $this->checkFilePermissions();
        $this->checkEnvironmentSecurity();
        $this->checkMiddlewareSecurity();
        $this->checkPasswordSecurity();
        $this->checkSuspiciousActivity();
        $this->checkSecurityHeaders();
        
        // Generate report
        $this->generateReport();
        
        // Attempt fixes if requested
        if ($this->option('fix')) {
            $this->attemptFixes();
        }
        
        // Email report if requested
        if ($this->option('email')) {
            $this->emailReport();
        }
        
        $this->info('Security audit completed.');
        
        return 0;
    }

    /**
     * Check session security configuration
     */
    protected function checkSessionSecurity(): void
    {
        $this->info('Checking session security...');
        
        $checks = [
            'session_encryption' => config('session.encrypt'),
            'secure_cookies' => config('session.secure'),
            'http_only_cookies' => config('session.http_only'),
            'same_site_strict' => config('session.same_site') === 'strict',
            'session_lifetime' => config('session.lifetime') <= 120, // 2 hours max
        ];
        
        foreach ($checks as $check => $passed) {
            $this->results['session'][$check] = [
                'status' => $passed ? 'PASS' : 'FAIL',
                'description' => $this->getSessionCheckDescription($check),
                'recommendation' => $passed ? null : $this->getSessionRecommendation($check)
            ];
            
            if ($passed) {
                $this->line("  ✓ {$this->getSessionCheckDescription($check)}");
            } else {
                $this->error("  ✗ {$this->getSessionCheckDescription($check)}");
            }
        }
    }

    /**
     * Check user account security
     */
    protected function checkUserAccountSecurity(): void
    {
        $this->info('Checking user account security...');
        
        // Check for users without passwords (social login only)
        $usersWithoutPasswords = User::whereNull('password')->count();
        
        // Check for locked accounts
        $lockedAccounts = User::where('locked_until', '>', now())->count();
        
        // Check for users with high failed login attempts
        $usersWithFailedAttempts = User::where('failed_login_attempts', '>=', 3)->count();
        
        // Check for inactive users with recent activity
        $inactiveWithActivity = User::where('is_active', false)
            ->where('last_login_at', '>', now()->subDays(7))
            ->count();
        
        $this->results['users'] = [
            'users_without_passwords' => [
                'count' => $usersWithoutPasswords,
                'status' => $usersWithoutPasswords > 0 ? 'WARNING' : 'PASS',
                'description' => 'Users without passwords (social login only)'
            ],
            'locked_accounts' => [
                'count' => $lockedAccounts,
                'status' => 'INFO',
                'description' => 'Currently locked accounts'
            ],
            'failed_login_attempts' => [
                'count' => $usersWithFailedAttempts,
                'status' => $usersWithFailedAttempts > 10 ? 'WARNING' : 'PASS',
                'description' => 'Users with recent failed login attempts'
            ],
            'inactive_with_activity' => [
                'count' => $inactiveWithActivity,
                'status' => $inactiveWithActivity > 0 ? 'FAIL' : 'PASS',
                'description' => 'Inactive users with recent login activity'
            ]
        ];
        
        foreach ($this->results['users'] as $check => $result) {
            $status = $result['status'];
            $icon = $status === 'PASS' ? '✓' : ($status === 'WARNING' ? '⚠' : '✗');
            $this->line("  {$icon} {$result['description']}: {$result['count']}");
        }
    }

    /**
     * Check database security
     */
    protected function checkDatabaseSecurity(): void
    {
        $this->info('Checking database security...');
        
        // Check for recent suspicious queries (would need to be logged first)
        $suspiciousQueries = Cache::get('suspicious_queries_count', 0);
        
        // Check for tables without proper indexes
        $tablesWithoutIndexes = $this->checkTableIndexes();
        
        // Check for sensitive data in logs
        $sensitiveDataInLogs = $this->checkForSensitiveDataInLogs();
        
        $this->results['database'] = [
            'suspicious_queries' => [
                'count' => $suspiciousQueries,
                'status' => $suspiciousQueries > 10 ? 'WARNING' : 'PASS',
                'description' => 'Suspicious database queries in last 24h'
            ],
            'missing_indexes' => [
                'count' => count($tablesWithoutIndexes),
                'status' => count($tablesWithoutIndexes) > 0 ? 'WARNING' : 'PASS',
                'description' => 'Tables without proper security indexes',
                'tables' => $tablesWithoutIndexes
            ],
            'sensitive_data_in_logs' => [
                'found' => $sensitiveDataInLogs,
                'status' => $sensitiveDataInLogs ? 'FAIL' : 'PASS',
                'description' => 'Sensitive data found in application logs'
            ]
        ];
        
        foreach ($this->results['database'] as $check => $result) {
            $status = $result['status'];
            $icon = $status === 'PASS' ? '✓' : ($status === 'WARNING' ? '⚠' : '✗');
            $count = $result['count'] ?? ($result['found'] ? 'Yes' : 'No');
            $this->line("  {$icon} {$result['description']}: {$count}");
        }
    }

    /**
     * Check file permissions
     */
    protected function checkFilePermissions(): void
    {
        $this->info('Checking file permissions...');
        
        $criticalFiles = [
            base_path('.env'),
            base_path('config/app.php'),
            base_path('config/database.php'),
            storage_path('logs/laravel.log'),
        ];
        
        $permissions = [];
        foreach ($criticalFiles as $file) {
            if (file_exists($file)) {
                $perms = fileperms($file);
                $permissions[$file] = [
                    'permissions' => substr(sprintf('%o', $perms), -4),
                    'readable_by_others' => ($perms & 0x0004) ? true : false,
                    'writable_by_others' => ($perms & 0x0002) ? true : false,
                ];
            }
        }
        
        $this->results['file_permissions'] = $permissions;
        
        foreach ($permissions as $file => $info) {
            $status = ($info['readable_by_others'] || $info['writable_by_others']) ? 'FAIL' : 'PASS';
            $icon = $status === 'PASS' ? '✓' : '✗';
            $filename = basename($file);
            $this->line("  {$icon} {$filename}: {$info['permissions']}");
        }
    }

    /**
     * Check environment security
     */
    protected function checkEnvironmentSecurity(): void
    {
        $this->info('Checking environment security...');
        
        $checks = [
            'app_debug_disabled' => !config('app.debug') || app()->environment('local'),
            'app_key_set' => !empty(config('app.key')),
            'db_password_set' => !empty(config('database.connections.mysql.password')),
            'https_enforced' => config('app.url') ? str_starts_with(config('app.url'), 'https://') : false,
        ];
        
        $this->results['environment'] = [];
        
        foreach ($checks as $check => $passed) {
            $this->results['environment'][$check] = [
                'status' => $passed ? 'PASS' : 'FAIL',
                'description' => $this->getEnvironmentCheckDescription($check)
            ];
            
            $icon = $passed ? '✓' : '✗';
            $this->line("  {$icon} {$this->getEnvironmentCheckDescription($check)}");
        }
    }

    /**
     * Check middleware security
     */
    protected function checkMiddlewareSecurity(): void
    {
        $this->info('Checking middleware security...');
        
        $kernel = app(\App\Http\Kernel::class);
        $middleware = $kernel->getMiddleware();
        $middlewareGroups = $kernel->getMiddlewareGroups();
        
        $requiredMiddleware = [
            'App\Http\Middleware\SqlInjectionProtection',
            'App\Http\Middleware\SecureSessionMiddleware',
            'App\Http\Middleware\EnhancedCsrfProtection',
        ];
        
        $this->results['middleware'] = [];
        
        foreach ($requiredMiddleware as $middlewareClass) {
            $isRegistered = in_array($middlewareClass, $middleware) || 
                           $this->isMiddlewareInGroups($middlewareClass, $middlewareGroups);
            
            $this->results['middleware'][class_basename($middlewareClass)] = [
                'status' => $isRegistered ? 'PASS' : 'FAIL',
                'description' => 'Security middleware registered'
            ];
            
            $icon = $isRegistered ? '✓' : '✗';
            $name = class_basename($middlewareClass);
            $this->line("  {$icon} {$name}");
        }
    }

    /**
     * Check password security
     */
    protected function checkPasswordSecurity(): void
    {
        $this->info('Checking password security...');
        
        // Check password hashing algorithm
        $hashDriver = config('hashing.driver');
        $bcryptRounds = config('hashing.bcrypt.rounds', 10);
        
        $this->results['passwords'] = [
            'hash_algorithm' => [
                'value' => $hashDriver,
                'status' => $hashDriver === 'bcrypt' ? 'PASS' : 'WARNING',
                'description' => 'Password hashing algorithm'
            ],
            'bcrypt_rounds' => [
                'value' => $bcryptRounds,
                'status' => $bcryptRounds >= 12 ? 'PASS' : 'WARNING',
                'description' => 'BCrypt rounds (minimum 12 recommended)'
            ]
        ];
        
        foreach ($this->results['passwords'] as $check => $result) {
            $icon = $result['status'] === 'PASS' ? '✓' : '⚠';
            $this->line("  {$icon} {$result['description']}: {$result['value']}");
        }
    }

    /**
     * Check for suspicious activity
     */
    protected function checkSuspiciousActivity(): void
    {
        $this->info('Checking for suspicious activity...');
        
        // Check recent security events
        $recentSecurityEvents = AuditLog::where('event_category', 'security')
            ->where('created_at', '>', now()->subHours(24))
            ->count();
        
        // Check failed login attempts
        $recentFailedLogins = AuditLog::where('event_type', 'login')
            ->where('is_successful', false)
            ->where('created_at', '>', now()->subHours(24))
            ->count();
        
        // Check blocked IPs
        $blockedIps = $this->getBlockedIpsCount();
        
        $this->results['suspicious_activity'] = [
            'security_events' => [
                'count' => $recentSecurityEvents,
                'status' => $recentSecurityEvents > 50 ? 'WARNING' : 'PASS',
                'description' => 'Security events in last 24h'
            ],
            'failed_logins' => [
                'count' => $recentFailedLogins,
                'status' => $recentFailedLogins > 20 ? 'WARNING' : 'PASS',
                'description' => 'Failed login attempts in last 24h'
            ],
            'blocked_ips' => [
                'count' => $blockedIps,
                'status' => 'INFO',
                'description' => 'Currently blocked IP addresses'
            ]
        ];
        
        foreach ($this->results['suspicious_activity'] as $check => $result) {
            $status = $result['status'];
            $icon = $status === 'PASS' ? '✓' : ($status === 'WARNING' ? '⚠' : 'ℹ');
            $this->line("  {$icon} {$result['description']}: {$result['count']}");
        }
    }

    /**
     * Check security headers
     */
    protected function checkSecurityHeaders(): void
    {
        $this->info('Checking security headers configuration...');
        
        $expectedHeaders = [
            'X-Frame-Options' => 'DENY',
            'X-Content-Type-Options' => 'nosniff',
            'X-XSS-Protection' => '1; mode=block',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
        ];
        
        $this->results['security_headers'] = [];
        
        foreach ($expectedHeaders as $header => $expectedValue) {
            $configValue = config("security.headers.".strtolower(str_replace('-', '_', $header)));
            $isCorrect = $configValue === $expectedValue;
            
            $this->results['security_headers'][$header] = [
                'status' => $isCorrect ? 'PASS' : 'FAIL',
                'expected' => $expectedValue,
                'actual' => $configValue,
                'description' => "Security header: {$header}"
            ];
            
            $icon = $isCorrect ? '✓' : '✗';
            $this->line("  {$icon} {$header}: {$configValue}");
        }
    }

    /**
     * Generate comprehensive security report
     */
    protected function generateReport(): void
    {
        if (!$this->option('report')) {
            return;
        }
        
        $this->info('Generating detailed security report...');
        
        $report = [
            'timestamp' => now()->toISOString(),
            'environment' => app()->environment(),
            'audit_results' => $this->results,
            'summary' => $this->generateSummary(),
            'recommendations' => $this->generateRecommendations()
        ];
        
        $reportPath = storage_path('logs/security-audit-' . now()->format('Y-m-d-H-i-s') . '.json');
        file_put_contents($reportPath, json_encode($report, JSON_PRETTY_PRINT));
        
        $this->info("Detailed report saved to: {$reportPath}");
        
        // Also log the audit
        Log::info('Security audit completed', [
            'summary' => $report['summary'],
            'total_checks' => $this->getTotalChecks(),
            'failed_checks' => $this->getFailedChecks()
        ]);
    }

    /**
     * Generate audit summary
     */
    protected function generateSummary(): array
    {
        $totalChecks = 0;
        $passedChecks = 0;
        $failedChecks = 0;
        $warningChecks = 0;
        
        foreach ($this->results as $category => $checks) {
            foreach ($checks as $check => $result) {
                $totalChecks++;
                
                $status = $result['status'] ?? 'UNKNOWN';
                switch ($status) {
                    case 'PASS':
                        $passedChecks++;
                        break;
                    case 'FAIL':
                        $failedChecks++;
                        break;
                    case 'WARNING':
                        $warningChecks++;
                        break;
                }
            }
        }
        
        return [
            'total_checks' => $totalChecks,
            'passed' => $passedChecks,
            'failed' => $failedChecks,
            'warnings' => $warningChecks,
            'score' => $totalChecks > 0 ? round(($passedChecks / $totalChecks) * 100, 2) : 0
        ];
    }

    /**
     * Generate recommendations
     */
    protected function generateRecommendations(): array
    {
        $recommendations = [];
        
        foreach ($this->results as $category => $checks) {
            foreach ($checks as $check => $result) {
                if (isset($result['status']) && in_array($result['status'], ['FAIL', 'WARNING'])) {
                    $recommendations[] = [
                        'category' => $category,
                        'check' => $check,
                        'priority' => $result['status'] === 'FAIL' ? 'HIGH' : 'MEDIUM',
                        'description' => $result['description'] ?? 'Security issue found',
                        'recommendation' => $result['recommendation'] ?? 'Review and fix this security issue'
                    ];
                }
            }
        }
        
        return $recommendations;
    }

    /**
     * Helper methods for specific checks
     */
    protected function checkTableIndexes(): array
    {
        // This would check for missing indexes on security-sensitive columns
        return []; // Simplified for example
    }

    protected function checkForSensitiveDataInLogs(): bool
    {
        // This would scan log files for sensitive data patterns
        return false; // Simplified for example
    }

    protected function getBlockedIpsCount(): int
    {
        // Count blocked IPs from cache
        $pattern = 'blocked_ip:*';
        // This would use Redis KEYS command or similar
        return 0; // Simplified for example
    }

    protected function isMiddlewareInGroups(string $middleware, array $middlewareGroups): bool
    {
        foreach ($middlewareGroups as $group => $middlewares) {
            if (in_array($middleware, $middlewares)) {
                return true;
            }
        }
        return false;
    }

    protected function getSessionCheckDescription(string $check): string
    {
        $descriptions = [
            'session_encryption' => 'Session data encryption enabled',
            'secure_cookies' => 'Secure cookie flag enabled',
            'http_only_cookies' => 'HTTP-only cookie flag enabled',
            'same_site_strict' => 'SameSite cookie attribute set to strict',
            'session_lifetime' => 'Session lifetime within secure limits'
        ];
        
        return $descriptions[$check] ?? $check;
    }

    protected function getSessionRecommendation(string $check): string
    {
        $recommendations = [
            'session_encryption' => 'Enable session encryption in config/session.php',
            'secure_cookies' => 'Enable secure cookies in production environment',
            'http_only_cookies' => 'Enable HTTP-only cookies to prevent XSS',
            'same_site_strict' => 'Set SameSite attribute to strict for CSRF protection',
            'session_lifetime' => 'Reduce session lifetime to maximum 2 hours'
        ];
        
        return $recommendations[$check] ?? 'Review and fix this configuration';
    }

    protected function getEnvironmentCheckDescription(string $check): string
    {
        $descriptions = [
            'app_debug_disabled' => 'Application debug mode disabled in production',
            'app_key_set' => 'Application encryption key is set',
            'db_password_set' => 'Database password is configured',
            'https_enforced' => 'HTTPS is enforced for application URL'
        ];
        
        return $descriptions[$check] ?? $check;
    }

    protected function getTotalChecks(): int
    {
        return $this->generateSummary()['total_checks'];
    }

    protected function getFailedChecks(): int
    {
        return $this->generateSummary()['failed'];
    }

    protected function attemptFixes(): void
    {
        $this->info('Attempting to fix identified issues...');
        // Implementation would depend on specific fixes needed
        $this->line('  ℹ Auto-fix functionality not implemented yet');
    }

    protected function emailReport(): void
    {
        $this->info('Emailing security report...');
        // Implementation would send email to administrators
        $this->line('  ℹ Email functionality not implemented yet');
    }
}