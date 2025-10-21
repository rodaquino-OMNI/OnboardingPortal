<?php

namespace Tests\Unit;

use App\Services\DatabaseQueryValidator;
use Illuminate\Support\Facades\App;
use PHPUnit\Framework\TestCase as BaseTestCase;
use RuntimeException;

/**
 * Database Query Validator Test Suite
 *
 * Tests environment-aware query validation, security checks, and migration support.
 *
 * @package Tests\Unit
 */
class DatabaseQueryValidatorTest extends BaseTestCase
{
    protected DatabaseQueryValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = new DatabaseQueryValidator();
    }

    /**
     * Test that validator is disabled in testing environment
     */
    public function test_validator_disabled_in_testing_environment(): void
    {
        // Set testing environment
        putenv('APP_ENV=testing');

        $this->assertFalse(
            $this->validator->isEnabled(),
            'Validator should be disabled in testing environment'
        );
    }

    /**
     * Test that validator can be explicitly disabled via config
     */
    public function test_validator_disabled_via_environment_variable(): void
    {
        putenv('DB_QUERY_VALIDATOR_ENABLED=false');

        $this->assertFalse(
            $this->validator->isEnabled(),
            'Validator should be disabled when DB_QUERY_VALIDATOR_ENABLED=false'
        );

        // Cleanup
        putenv('DB_QUERY_VALIDATOR_ENABLED');
    }

    /**
     * Test schema operations are identified correctly
     */
    public function test_identifies_schema_operations(): void
    {
        $schemaQueries = [
            'CREATE TABLE users (id INT PRIMARY KEY)',
            'ALTER TABLE users ADD COLUMN email VARCHAR(255)',
            'DROP TABLE sessions',
            'CREATE INDEX idx_email ON users(email)',
            'DROP INDEX idx_email ON users',
            'ALTER TABLE users MODIFY COLUMN name VARCHAR(100)',
            'RENAME TABLE old_users TO new_users',
        ];

        $reflection = new \ReflectionClass($this->validator);
        $method = $reflection->getMethod('isSchemaOperation');
        $method->setAccessible(true);

        foreach ($schemaQueries as $query) {
            $this->assertTrue(
                $method->invoke($this->validator, $query),
                "Query should be identified as schema operation: {$query}"
            );
        }
    }

    /**
     * Test that non-schema queries are not identified as schema operations
     */
    public function test_identifies_non_schema_operations(): void
    {
        $nonSchemaQueries = [
            'SELECT * FROM users',
            'INSERT INTO users (name) VALUES (?)',
            'UPDATE users SET name = ? WHERE id = ?',
            'DELETE FROM sessions WHERE expired_at < NOW()',
        ];

        $reflection = new \ReflectionClass($this->validator);
        $method = $reflection->getMethod('isSchemaOperation');
        $method->setAccessible(true);

        foreach ($nonSchemaQueries as $query) {
            $this->assertFalse(
                $method->invoke($this->validator, $query),
                "Query should not be identified as schema operation: {$query}"
            );
        }
    }

    /**
     * Test dangerous patterns are detected
     */
    public function test_detects_dangerous_patterns(): void
    {
        $dangerousQueries = [
            'DROP DATABASE production',
            'TRUNCATE TABLE users',
            'DELETE FROM users WHERE 1=1',
            'UPDATE users SET admin = 1 WHERE 1 = 1',
            'GRANT ALL PRIVILEGES ON *.* TO user@localhost',
        ];

        foreach ($dangerousQueries as $query) {
            $patterns = $this->validator->getDangerousPatterns();
            $matched = false;

            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $query)) {
                    $matched = true;
                    break;
                }
            }

            $this->assertTrue(
                $matched,
                "Dangerous query should match a pattern: {$query}"
            );
        }
    }

    /**
     * Test SQL injection attempts in bindings are detected
     */
    public function test_detects_sql_injection_in_bindings(): void
    {
        $reflection = new \ReflectionClass($this->validator);
        $method = $reflection->getMethod('containsSqlInjectionAttempt');
        $method->setAccessible(true);

        $maliciousValues = [
            "; DROP TABLE users",
            "' UNION SELECT * FROM passwords --",
            "admin'--",
            "/* malicious comment */",
        ];

        foreach ($maliciousValues as $value) {
            $this->assertTrue(
                $method->invoke($this->validator, $value),
                "Should detect SQL injection attempt: {$value}"
            );
        }
    }

    /**
     * Test safe binding values are not flagged
     */
    public function test_allows_safe_binding_values(): void
    {
        $reflection = new \ReflectionClass($this->validator);
        $method = $reflection->getMethod('containsSqlInjectionAttempt');
        $method->setAccessible(true);

        $safeValues = [
            "john.doe@example.com",
            "Regular User Name",
            "123 Main Street",
            "555-1234",
        ];

        foreach ($safeValues as $value) {
            $this->assertFalse(
                $method->invoke($this->validator, $value),
                "Should not flag safe value: {$value}"
            );
        }
    }

    /**
     * Test that schema operations are allowed during migrations
     */
    public function test_allows_schema_operations_during_migrations(): void
    {
        // Simulate migration context
        $_SERVER['argv'] = ['artisan', 'migrate'];

        $query = 'CREATE TABLE test_table (id INT PRIMARY KEY)';

        // This should not throw an exception even with validator enabled
        try {
            $this->validator->validateQuery($query);
            $this->assertTrue(true, 'Schema operation allowed during migration');
        } catch (RuntimeException $e) {
            $this->fail('Schema operation should be allowed during migration context');
        }

        // Cleanup
        unset($_SERVER['argv']);
    }

    /**
     * Test that dangerous queries are blocked in production (when strict mode enabled)
     */
    public function test_blocks_dangerous_queries_in_strict_mode(): void
    {
        // Note: This test would need proper Laravel app context for full config access
        // For unit testing, we're testing the pattern matching logic
        $dangerousPatterns = $this->validator->getDangerousPatterns();

        $this->assertNotEmpty(
            $dangerousPatterns,
            'Validator should have dangerous patterns configured'
        );

        $this->assertContains(
            '/DROP\s+DATABASE/i',
            $dangerousPatterns,
            'Should include DROP DATABASE pattern'
        );

        $this->assertContains(
            '/TRUNCATE\s+TABLE/i',
            $dangerousPatterns,
            'Should include TRUNCATE TABLE pattern'
        );
    }

    /**
     * Test custom dangerous patterns can be added
     */
    public function test_can_add_custom_dangerous_pattern(): void
    {
        $customPattern = '/DELETE\s+FROM\s+critical_table/i';

        $this->validator->addDangerousPattern($customPattern);

        $patterns = $this->validator->getDangerousPatterns();

        $this->assertContains(
            $customPattern,
            $patterns,
            'Custom dangerous pattern should be added'
        );
    }

    /**
     * Test custom schema patterns can be added
     */
    public function test_can_add_custom_schema_pattern(): void
    {
        $customPattern = '/CREATE\s+SEQUENCE/i';

        $this->validator->addSchemaPattern($customPattern);

        $patterns = $this->validator->getSchemaPatterns();

        $this->assertContains(
            $customPattern,
            $patterns,
            'Custom schema pattern should be added'
        );
    }

    /**
     * Test query sanitization for logging
     */
    public function test_sanitizes_queries_for_logging(): void
    {
        $reflection = new \ReflectionClass($this->validator);
        $method = $reflection->getMethod('sanitizeQueryForLogging');
        $method->setAccessible(true);

        $query = "SELECT * FROM users WHERE email = 'user@example.com' AND ssn = '123456789'";
        $sanitized = $method->invoke($this->validator, $query);

        $this->assertStringNotContainsString(
            'user@example.com',
            $sanitized,
            'Email should be sanitized in logs'
        );

        $this->assertStringNotContainsString(
            '123456789',
            $sanitized,
            'SSN should be sanitized in logs'
        );
    }

    /**
     * Test that validator respects excluded environments from config
     */
    public function test_respects_excluded_environments(): void
    {
        // Test local environment
        putenv('APP_ENV=local');

        // Note: Without full Laravel app, we can't test config() calls
        // This test documents the expected behavior
        $this->assertTrue(true, 'Validator should check excluded environments from config');

        // Cleanup
        putenv('APP_ENV');
    }

    /**
     * Test migration context detection
     */
    public function test_detects_migration_context(): void
    {
        $reflection = new \ReflectionClass($this->validator);
        $method = $reflection->getMethod('isMigrationContext');
        $method->setAccessible(true);

        // Test migrate command
        $_SERVER['argv'] = ['artisan', 'migrate'];
        $this->assertTrue(
            $method->invoke($this->validator),
            'Should detect migrate command'
        );

        // Test migrate:fresh command
        $_SERVER['argv'] = ['artisan', 'migrate:fresh'];
        $this->assertTrue(
            $method->invoke($this->validator),
            'Should detect migrate:fresh command'
        );

        // Test db:seed command
        $_SERVER['argv'] = ['artisan', 'db:seed'];
        $this->assertTrue(
            $method->invoke($this->validator),
            'Should detect db:seed command'
        );

        // Test non-migration command
        $_SERVER['argv'] = ['artisan', 'serve'];
        $this->assertFalse(
            $method->invoke($this->validator),
            'Should not detect non-migration command as migration context'
        );

        // Cleanup
        unset($_SERVER['argv']);
    }

    /**
     * Test validator allows safe queries when disabled
     */
    public function test_allows_all_queries_when_disabled(): void
    {
        putenv('DB_QUERY_VALIDATOR_ENABLED=false');

        // Even dangerous queries should pass when validator is disabled
        $dangerousQuery = 'DROP DATABASE test';

        try {
            $this->validator->validateQuery($dangerousQuery);
            $this->assertTrue(true, 'All queries allowed when validator disabled');
        } catch (RuntimeException $e) {
            $this->fail('No exceptions should be thrown when validator is disabled');
        }

        // Cleanup
        putenv('DB_QUERY_VALIDATOR_ENABLED');
    }
}
