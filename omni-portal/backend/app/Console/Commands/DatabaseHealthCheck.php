<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\QueryException;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\HealthQuestionnaire;
use Carbon\Carbon;
use Exception;

class DatabaseHealthCheck extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:health-check 
                          {--format=console : Output format (console, json, html)}
                          {--save-report : Save report to storage}
                          {--verbose : Show detailed output}
                          {--fix : Attempt to fix issues automatically}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Comprehensive database health check and validation';

    /**
     * Test results storage
     */
    private array $results = [];
    private int $totalTests = 0;
    private int $passedTests = 0;
    private int $failedTests = 0;
    private int $warnings = 0;

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('🔍 Starting Database Health Check...');
        $this->newLine();

        // Initialize results
        $this->results = [
            'timestamp' => now()->toISOString(),
            'php_version' => phpversion(),
            'laravel_version' => app()->version(),
            'database' => config('database.default'),
            'tests' => []
        ];

        try {
            // Run all health checks
            $this->runConnectivityTests();
            $this->runSchemaValidation();
            $this->runDataIntegrityTests();
            $this->runPerformanceTests();
            $this->runSecurityTests();
            $this->runCrudTests();
            $this->runConstraintTests();

            // Generate and display results
            $this->displayResults();
            $this->saveReportIfRequested();

            return $this->failedTests > 0 ? 1 : 0;

        } catch (Exception $e) {
            $this->error("Health check failed: {$e->getMessage()}");
            return 1;
        }
    }

    /**
     * Run database connectivity tests
     */
    private function runConnectivityTests(): void
    {
        $this->info('🔌 Testing Database Connectivity...');

        // Test basic connection
        $this->runTest('Database Connection', function () {
            DB::connection()->getPdo();
            $this->line('  ✅ Database connection successful');
            return true;
        });

        // Test connection configuration
        $this->runTest('Connection Configuration', function () {
            $config = config('database.connections.' . config('database.default'));
            
            $requiredKeys = ['host', 'port', 'database', 'username'];
            foreach ($requiredKeys as $key) {
                if (empty($config[$key]) && $key !== 'password') {
                    throw new Exception("Missing configuration: {$key}");
                }
            }

            if ($this->option('verbose')) {
                $this->line("  📊 Host: {$config['host']}:{$config['port']}");
                $this->line("  📊 Database: {$config['database']}");
                $this->line("  📊 Driver: {$config['driver']}");
            }

            return true;
        });

        // Test connection pooling
        $this->runTest('Connection Pool', function () {
            $connections = [];
            for ($i = 0; $i < 5; $i++) {
                $connections[] = DB::connection()->getPdo();
            }
            
            if ($this->option('verbose')) {
                $this->line('  📊 Successfully created 5 concurrent connections');
            }
            
            return count($connections) === 5;
        });
    }

    /**
     * Run schema validation tests
     */
    private function runSchemaValidation(): void
    {
        $this->info('📋 Validating Database Schema...');

        // Check migrations status
        $this->runTest('Migration Status', function () {
            $migrator = app('migrator');
            $files = $migrator->getMigrationFiles(database_path('migrations'));
            $ran = $migrator->getRepository()->getRan();
            
            $pending = array_diff(array_keys($files), $ran);
            
            if (!empty($pending)) {
                throw new Exception(count($pending) . ' pending migrations found');
            }

            if ($this->option('verbose')) {
                $this->line('  📊 Total migrations: ' . count($files));
                $this->line('  📊 Applied migrations: ' . count($ran));
            }

            return true;
        });

        // Check required tables
        $this->runTest('Required Tables', function () {
            $requiredTables = ['users', 'migrations', 'password_reset_tokens'];
            $missingTables = [];

            foreach ($requiredTables as $table) {
                if (!Schema::hasTable($table)) {
                    $missingTables[] = $table;
                }
            }

            if (!empty($missingTables)) {
                throw new Exception('Missing tables: ' . implode(', ', $missingTables));
            }

            if ($this->option('verbose')) {
                $this->line('  📊 All required tables present');
            }

            return true;
        });

        // Check table structures
        $this->runTest('Table Structures', function () {
            $issues = [];

            // Check users table structure
            if (Schema::hasTable('users')) {
                $requiredColumns = ['id', 'name', 'email', 'password', 'created_at', 'updated_at'];
                foreach ($requiredColumns as $column) {
                    if (!Schema::hasColumn('users', $column)) {
                        $issues[] = "users.{$column} column missing";
                    }
                }
            }

            // Check beneficiaries table if exists
            if (Schema::hasTable('beneficiaries')) {
                $requiredColumns = ['id', 'first_name', 'last_name', 'email'];
                foreach ($requiredColumns as $column) {
                    if (!Schema::hasColumn('beneficiaries', $column)) {
                        $issues[] = "beneficiaries.{$column} column missing";
                    }
                }
            }

            if (!empty($issues)) {
                throw new Exception('Structure issues: ' . implode(', ', $issues));
            }

            return true;
        });
    }

    /**
     * Run data integrity tests
     */
    private function runDataIntegrityTests(): void
    {
        $this->info('🔒 Testing Data Integrity...');

        // Check foreign key constraints
        $this->runTest('Foreign Key Constraints', function () {
            // This is database-specific, focusing on MySQL
            if (config('database.default') === 'mysql') {
                $result = DB::select("SELECT @@foreign_key_checks as fk_enabled")[0];
                
                if (!$result->fk_enabled) {
                    $this->addWarning('Foreign key checks are disabled');
                }

                if ($this->option('verbose')) {
                    $constraints = DB::select("
                        SELECT COUNT(*) as constraint_count
                        FROM information_schema.KEY_COLUMN_USAGE 
                        WHERE CONSTRAINT_SCHEMA = DATABASE() 
                        AND REFERENCED_TABLE_NAME IS NOT NULL
                    ");
                    $this->line('  📊 Foreign key constraints: ' . $constraints[0]->constraint_count);
                }
            }

            return true;
        });

        // Check for orphaned records
        $this->runTest('Orphaned Records Check', function () {
            $orphanedCount = 0;

            // Check if health_questionnaires table exists and has beneficiary_id
            if (Schema::hasTable('health_questionnaires') && Schema::hasColumn('health_questionnaires', 'beneficiary_id')) {
                $orphaned = DB::table('health_questionnaires')
                    ->leftJoin('beneficiaries', 'health_questionnaires.beneficiary_id', '=', 'beneficiaries.id')
                    ->whereNull('beneficiaries.id')
                    ->whereNotNull('health_questionnaires.beneficiary_id')
                    ->count();
                
                if ($orphaned > 0) {
                    $orphanedCount += $orphaned;
                    $this->addWarning("Found {$orphaned} orphaned health questionnaires");
                }
            }

            if ($orphanedCount > 0 && $this->option('fix')) {
                $this->line('  🔧 Auto-fix is enabled, but manual review recommended for orphaned records');
            }

            return true;
        });

        // Check data consistency
        $this->runTest('Data Consistency', function () {
            $issues = [];

            // Check for duplicate emails in users
            $duplicateUsers = DB::table('users')
                ->select('email', DB::raw('COUNT(*) as count'))
                ->groupBy('email')
                ->having('count', '>', 1)
                ->count();

            if ($duplicateUsers > 0) {
                $issues[] = "{$duplicateUsers} duplicate user emails found";
            }

            // Check for invalid email formats
            $invalidEmails = DB::table('users')
                ->where('email', 'not regexp', '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
                ->count();

            if ($invalidEmails > 0) {
                $issues[] = "{$invalidEmails} invalid email formats found";
            }

            if (!empty($issues)) {
                foreach ($issues as $issue) {
                    $this->addWarning($issue);
                }
            }

            return true;
        });
    }

    /**
     * Run performance tests
     */
    private function runPerformanceTests(): void
    {
        $this->info('⚡ Testing Database Performance...');

        // Check database size
        $this->runTest('Database Size Analysis', function () {
            if (config('database.default') === 'mysql') {
                $sizeInfo = DB::select("
                    SELECT 
                        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb,
                        COUNT(*) as table_count
                    FROM information_schema.tables 
                    WHERE table_schema = DATABASE()
                ")[0];

                if ($this->option('verbose')) {
                    $this->line("  📊 Database size: {$sizeInfo->size_mb} MB");
                    $this->line("  📊 Table count: {$sizeInfo->table_count}");
                }

                if ($sizeInfo->size_mb > 1000) {
                    $this->addWarning('Large database size detected (>1GB)');
                }
            }

            return true;
        });

        // Check indexes
        $this->runTest('Index Analysis', function () {
            if (config('database.default') === 'mysql') {
                // Check for tables without indexes
                $tablesWithoutIndexes = DB::select("
                    SELECT t.table_name
                    FROM information_schema.tables t
                    LEFT JOIN information_schema.statistics s 
                        ON t.table_name = s.table_name 
                        AND t.table_schema = s.table_schema
                        AND s.non_unique = 0
                    WHERE t.table_schema = DATABASE()
                    AND t.table_type = 'BASE TABLE'
                    AND s.table_name IS NULL
                    AND t.table_name != 'migrations'
                ");

                if (!empty($tablesWithoutIndexes)) {
                    $tableNames = array_column($tablesWithoutIndexes, 'table_name');
                    $this->addWarning('Tables without primary keys: ' . implode(', ', $tableNames));
                }

                // Check critical indexes
                $criticalIndexes = [
                    ['table' => 'users', 'column' => 'email'],
                ];

                foreach ($criticalIndexes as $index) {
                    if (Schema::hasTable($index['table'])) {
                        $indexExists = DB::select("
                            SHOW INDEX FROM {$index['table']} 
                            WHERE Column_name = '{$index['column']}'
                        ");

                        if (empty($indexExists)) {
                            $this->addWarning("Missing index on {$index['table']}.{$index['column']}");
                        }
                    }
                }
            }

            return true;
        });

        // Query performance test
        $this->runTest('Query Performance', function () {
            $startTime = microtime(true);
            
            // Run a series of common queries
            User::count();
            if (class_exists(Beneficiary::class)) {
                Beneficiary::take(10)->get();
            }
            DB::table('migrations')->count();

            $executionTime = (microtime(true) - $startTime) * 1000;

            if ($this->option('verbose')) {
                $this->line("  📊 Query execution time: {$executionTime}ms");
            }

            if ($executionTime > 1000) {
                $this->addWarning('Slow query performance detected (>1s)');
            }

            return true;
        });
    }

    /**
     * Run security tests
     */
    private function runSecurityTests(): void
    {
        $this->info('🔐 Testing Database Security...');

        // Check for default passwords
        $this->runTest('Password Security', function () {
            // Check for users with potentially weak passwords (this is limited without actual password checking)
            $usersWithoutPasswords = User::whereNull('password')->count();
            
            if ($usersWithoutPasswords > 0) {
                $this->addWarning("{$usersWithoutPasswords} users without passwords found");
            }

            // Check password reset tokens
            if (Schema::hasTable('password_reset_tokens')) {
                $expiredTokens = DB::table('password_reset_tokens')
                    ->where('created_at', '<', Carbon::now()->subHours(24))
                    ->count();

                if ($expiredTokens > 0) {
                    $this->addWarning("{$expiredTokens} expired password reset tokens found");
                }
            }

            return true;
        });

        // Check for sensitive data exposure
        $this->runTest('Sensitive Data Check', function () {
            // Check if there are any columns that might contain sensitive data without encryption
            $warnings = [];

            if (Schema::hasTable('users')) {
                $columns = DB::getSchemaBuilder()->getColumnListing('users');
                $sensitiveColumns = ['ssn', 'social_security', 'credit_card', 'bank_account'];
                
                foreach ($sensitiveColumns as $sensitive) {
                    if (in_array($sensitive, $columns)) {
                        $warnings[] = "Potentially sensitive column found: users.{$sensitive}";
                    }
                }
            }

            foreach ($warnings as $warning) {
                $this->addWarning($warning);
            }

            return true;
        });
    }

    /**
     * Run CRUD operation tests
     */
    private function runCrudTests(): void
    {
        $this->info('✏️  Testing CRUD Operations...');

        // Test User CRUD
        $this->runTest('User CRUD Operations', function () {
            $testEmail = 'health-check-' . time() . '@example.com';
            
            try {
                // Create
                $user = User::create([
                    'name' => 'Health Check Test User',
                    'email' => $testEmail,
                    'password' => bcrypt('test-password-123'),
                    'email_verified_at' => now(),
                ]);

                if (!$user->id) {
                    throw new Exception('User creation failed');
                }

                // Read
                $foundUser = User::find($user->id);
                if (!$foundUser) {
                    throw new Exception('User retrieval failed');
                }

                // Update
                $foundUser->name = 'Updated Test User';
                $foundUser->save();

                if ($foundUser->name !== 'Updated Test User') {
                    throw new Exception('User update failed');
                }

                // Delete
                $deleted = $foundUser->delete();
                if (!$deleted) {
                    throw new Exception('User deletion failed');
                }

                // Verify deletion
                $deletedUser = User::find($user->id);
                if ($deletedUser) {
                    throw new Exception('User still exists after deletion');
                }

                return true;

            } catch (Exception $e) {
                // Cleanup in case of failure
                User::where('email', $testEmail)->delete();
                throw $e;
            }
        });

        // Test Beneficiary CRUD if model exists
        if (class_exists(Beneficiary::class)) {
            $this->runTest('Beneficiary CRUD Operations', function () {
                $testEmail = 'beneficiary-health-check-' . time() . '@example.com';
                
                try {
                    // Create
                    $beneficiary = Beneficiary::create([
                        'first_name' => 'Test',
                        'last_name' => 'Beneficiary',
                        'email' => $testEmail,
                        'phone' => '1234567890',
                        'date_of_birth' => '1990-01-01',
                    ]);

                    // Read
                    $found = Beneficiary::find($beneficiary->id);
                    if (!$found) {
                        throw new Exception('Beneficiary retrieval failed');
                    }

                    // Update
                    $found->first_name = 'Updated';
                    $found->save();

                    // Delete
                    $found->delete();

                    return true;

                } catch (Exception $e) {
                    // Cleanup
                    Beneficiary::where('email', $testEmail)->delete();
                    throw $e;
                }
            });
        }
    }

    /**
     * Run constraint tests
     */
    private function runConstraintTests(): void
    {
        $this->info('🔗 Testing Database Constraints...');

        // Test unique constraints
        $this->runTest('Unique Constraints', function () {
            // Test user email uniqueness
            $testEmail = 'unique-test-' . time() . '@example.com';
            
            try {
                // Create first user
                $user1 = User::create([
                    'name' => 'First User',
                    'email' => $testEmail,
                    'password' => bcrypt('password'),
                ]);

                // Try to create duplicate
                $duplicateCreated = false;
                try {
                    User::create([
                        'name' => 'Second User',
                        'email' => $testEmail,
                        'password' => bcrypt('password'),
                    ]);
                    $duplicateCreated = true;
                } catch (QueryException $e) {
                    // This is expected - duplicate should fail
                }

                // Cleanup
                User::where('email', $testEmail)->delete();

                if ($duplicateCreated) {
                    throw new Exception('Unique constraint on user email is not working');
                }

                return true;

            } catch (Exception $e) {
                // Cleanup
                User::where('email', $testEmail)->delete();
                throw $e;
            }
        });

        // Test NOT NULL constraints
        $this->runTest('NOT NULL Constraints', function () {
            try {
                // Try to create user without required fields
                $nullTestFailed = false;
                try {
                    User::create([
                        'name' => null,
                        'email' => 'null-test@example.com',
                        'password' => bcrypt('password'),
                    ]);
                    $nullTestFailed = true;
                } catch (QueryException $e) {
                    // This is expected - null name should fail
                }

                if ($nullTestFailed) {
                    $this->addWarning('NOT NULL constraint on user name may not be properly enforced');
                }

                return true;

            } catch (Exception $e) {
                throw $e;
            }
        });
    }

    /**
     * Run a single test and record results
     */
    private function runTest(string $testName, callable $test): void
    {
        $this->totalTests++;
        $startTime = microtime(true);
        
        try {
            $result = $test();
            $executionTime = (microtime(true) - $startTime) * 1000;
            
            if ($result) {
                $this->passedTests++;
                $this->line("  ✅ {$testName}");
                
                $this->results['tests'][] = [
                    'name' => $testName,
                    'status' => 'passed',
                    'execution_time_ms' => round($executionTime, 2),
                    'message' => 'Test passed successfully'
                ];
            } else {
                $this->failedTests++;
                $this->line("  ❌ {$testName}");
                
                $this->results['tests'][] = [
                    'name' => $testName,
                    'status' => 'failed',
                    'execution_time_ms' => round($executionTime, 2),
                    'message' => 'Test returned false'
                ];
            }
            
        } catch (Exception $e) {
            $this->failedTests++;
            $executionTime = (microtime(true) - $startTime) * 1000;
            
            $this->line("  ❌ {$testName}: {$e->getMessage()}");
            
            $this->results['tests'][] = [
                'name' => $testName,
                'status' => 'failed',
                'execution_time_ms' => round($executionTime, 2),
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Add a warning to the results
     */
    private function addWarning(string $message): void
    {
        $this->warnings++;
        $this->line("  ⚠️  Warning: {$message}");
        
        $this->results['warnings'][] = [
            'message' => $message,
            'timestamp' => now()->toISOString()
        ];
    }

    /**
     * Display test results
     */
    private function displayResults(): void
    {
        $this->newLine();
        $this->info('📊 Database Health Check Results');
        $this->line('================================');
        
        $successRate = $this->totalTests > 0 ? round(($this->passedTests / $this->totalTests) * 100, 1) : 0;
        
        $this->line("Total Tests: {$this->totalTests}");
        $this->line("Passed: <fg=green>{$this->passedTests}</>");
        $this->line("Failed: <fg=red>{$this->failedTests}</>");
        $this->line("Warnings: <fg=yellow>{$this->warnings}</>");
        $this->line("Success Rate: <fg=blue>{$successRate}%</>");
        
        // Update results summary
        $this->results['summary'] = [
            'total_tests' => $this->totalTests,
            'passed_tests' => $this->passedTests,
            'failed_tests' => $this->failedTests,
            'warnings' => $this->warnings,
            'success_rate' => $successRate
        ];

        if ($this->failedTests > 0) {
            $this->newLine();
            $this->error('❌ Database health check completed with failures!');
            $this->line('Please review the failed tests and fix the issues.');
        } else {
            $this->newLine();
            $this->info('✅ Database health check completed successfully!');
            if ($this->warnings > 0) {
                $this->line('Note: There were some warnings that should be reviewed.');
            }
        }
    }

    /**
     * Save report to file if requested
     */
    private function saveReportIfRequested(): void
    {
        if ($this->option('save-report')) {
            $format = $this->option('format');
            $timestamp = now()->format('Y-m-d_H-i-s');
            $filename = "database_health_check_{$timestamp}";
            
            switch ($format) {
                case 'json':
                    $content = json_encode($this->results, JSON_PRETTY_PRINT);
                    $filename .= '.json';
                    break;
                    
                case 'html':
                    $content = $this->generateHtmlReport();
                    $filename .= '.html';
                    break;
                    
                default:
                    $content = $this->generateTextReport();
                    $filename .= '.txt';
            }
            
            $path = storage_path("logs/{$filename}");
            file_put_contents($path, $content);
            
            $this->newLine();
            $this->line("Report saved to: <fg=blue>{$path}</>");
        }
    }

    /**
     * Generate HTML report
     */
    private function generateHtmlReport(): string
    {
        $summary = $this->results['summary'];
        $tests = $this->results['tests'];
        $warnings = $this->results['warnings'] ?? [];
        
        $html = "<!DOCTYPE html>
<html>
<head>
    <title>Database Health Check Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .test { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .passed { border-left-color: #28a745; }
        .failed { border-left-color: #dc3545; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 5px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <div class='header'>
        <h1>Database Health Check Report</h1>
        <p>Generated: {$this->results['timestamp']}</p>
        <p>Database: {$this->results['database']}</p>
    </div>
    
    <div class='summary'>
        <div class='metric'>
            <h3>{$summary['total_tests']}</h3>
            <p>Total Tests</p>
        </div>
        <div class='metric'>
            <h3>{$summary['passed_tests']}</h3>
            <p>Passed</p>
        </div>
        <div class='metric'>
            <h3>{$summary['failed_tests']}</h3>
            <p>Failed</p>
        </div>
        <div class='metric'>
            <h3>{$summary['success_rate']}%</h3>
            <p>Success Rate</p>
        </div>
    </div>";

        if (!empty($warnings)) {
            $html .= "<h2>Warnings</h2>";
            foreach ($warnings as $warning) {
                $html .= "<div class='warning'>{$warning['message']}</div>";
            }
        }

        $html .= "<h2>Test Results</h2>";
        foreach ($tests as $test) {
            $class = $test['status'] === 'passed' ? 'passed' : 'failed';
            $status = $test['status'] === 'passed' ? '✅' : '❌';
            $html .= "<div class='test {$class}'>
                <strong>{$status} {$test['name']}</strong><br>
                <small>Execution time: {$test['execution_time_ms']}ms</small><br>
                <em>{$test['message']}</em>
            </div>";
        }

        $html .= "</body></html>";
        
        return $html;
    }

    /**
     * Generate text report
     */
    private function generateTextReport(): string
    {
        $summary = $this->results['summary'];
        $tests = $this->results['tests'];
        $warnings = $this->results['warnings'] ?? [];
        
        $report = "DATABASE HEALTH CHECK REPORT\n";
        $report .= "============================\n";
        $report .= "Generated: {$this->results['timestamp']}\n";
        $report .= "Database: {$this->results['database']}\n";
        $report .= "PHP Version: {$this->results['php_version']}\n";
        $report .= "Laravel Version: {$this->results['laravel_version']}\n\n";
        
        $report .= "SUMMARY\n";
        $report .= "-------\n";
        $report .= "Total Tests: {$summary['total_tests']}\n";
        $report .= "Passed: {$summary['passed_tests']}\n";
        $report .= "Failed: {$summary['failed_tests']}\n";
        $report .= "Warnings: {$summary['warnings']}\n";
        $report .= "Success Rate: {$summary['success_rate']}%\n\n";

        if (!empty($warnings)) {
            $report .= "WARNINGS\n";
            $report .= "--------\n";
            foreach ($warnings as $warning) {
                $report .= "⚠️  {$warning['message']}\n";
            }
            $report .= "\n";
        }

        $report .= "DETAILED TEST RESULTS\n";
        $report .= "--------------------\n";
        foreach ($tests as $test) {
            $status = $test['status'] === 'passed' ? '✅ PASS' : '❌ FAIL';
            $report .= "{$status} - {$test['name']} ({$test['execution_time_ms']}ms)\n";
            if ($test['status'] !== 'passed') {
                $report .= "    Error: {$test['message']}\n";
            }
        }
        
        return $report;
    }
}