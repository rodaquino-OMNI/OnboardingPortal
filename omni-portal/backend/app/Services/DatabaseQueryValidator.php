<?php

namespace App\Services;

use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Database Query Validator
 *
 * Provides runtime validation of database queries for security and performance.
 * Automatically disabled in test/CI environments to prevent migration interference.
 *
 * @package App\Services
 */
class DatabaseQueryValidator
{
    /**
     * Dangerous SQL patterns that should be blocked in production
     *
     * @var array<string>
     */
    protected array $dangerousPatterns = [
        '/DROP\s+DATABASE/i',
        '/TRUNCATE\s+TABLE/i',
        '/DELETE\s+FROM.*WHERE\s+1\s*=\s*1/i',
        '/UPDATE.*SET.*WHERE\s+1\s*=\s*1/i',
        '/GRANT\s+ALL/i',
        '/REVOKE\s+ALL/i',
    ];

    /**
     * Schema operation patterns (allowed during migrations in test environments)
     *
     * @var array<string>
     */
    protected array $schemaPatterns = [
        '/CREATE\s+TABLE/i',
        '/ALTER\s+TABLE/i',
        '/DROP\s+TABLE/i',
        '/CREATE\s+INDEX/i',
        '/DROP\s+INDEX/i',
        '/ADD\s+COLUMN/i',
        '/DROP\s+COLUMN/i',
        '/MODIFY\s+COLUMN/i',
        '/RENAME\s+TABLE/i',
    ];

    /**
     * Check if validator is enabled based on configuration and environment
     *
     * @return bool
     */
    public function isEnabled(): bool
    {
        // Check if explicitly disabled via config
        if (!config('database-validator.enabled', true)) {
            return false;
        }

        // Check if explicitly disabled via environment variable
        if (env('DB_QUERY_VALIDATOR_ENABLED') === false || env('DB_QUERY_VALIDATOR_ENABLED') === 'false') {
            return false;
        }

        // Check if current environment is excluded
        $excludedEnvironments = config('database-validator.exclude_environments', ['testing', 'local']);
        if (in_array(App::environment(), $excludedEnvironments, true)) {
            return false;
        }

        return true;
    }

    /**
     * Check if we're in a migration context
     *
     * @return bool
     */
    protected function isMigrationContext(): bool
    {
        // Check if running via artisan migrate command
        if (php_sapi_name() === 'cli') {
            $args = $_SERVER['argv'] ?? [];
            foreach ($args as $arg) {
                if (str_contains($arg, 'migrate') || str_contains($arg, 'db:seed')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Validate a database query for security concerns
     *
     * @param string $query The SQL query to validate
     * @param array<string, mixed> $bindings Query parameter bindings
     * @return void
     * @throws RuntimeException If query is dangerous and strict mode is enabled
     */
    public function validateQuery(string $query, array $bindings = []): void
    {
        // Skip validation if disabled
        if (!$this->isEnabled()) {
            return;
        }

        // Allow schema operations in test environments or during migrations
        if ($this->isTestEnvironment() && $this->isSchemaOperation($query)) {
            return;
        }

        // Allow schema operations during migration context
        if ($this->isMigrationContext() && $this->isSchemaOperation($query)) {
            return;
        }

        // Check for dangerous patterns
        foreach ($this->dangerousPatterns as $pattern) {
            if (preg_match($pattern, $query)) {
                $this->handleViolation($query, $pattern);
                return;
            }
        }

        // Additional validation can be added here
        $this->validateBindings($query, $bindings);
    }

    /**
     * Check if running in test environment
     *
     * @return bool
     */
    protected function isTestEnvironment(): bool
    {
        return App::environment('testing') ||
               env('APP_ENV') === 'testing' ||
               defined('PHPUNIT_RUNNING');
    }

    /**
     * Check if query is a schema operation
     *
     * @param string $query
     * @return bool
     */
    protected function isSchemaOperation(string $query): bool
    {
        foreach ($this->schemaPatterns as $pattern) {
            if (preg_match($pattern, $query)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate query parameter bindings
     *
     * @param string $query
     * @param array<string, mixed> $bindings
     * @return void
     */
    protected function validateBindings(string $query, array $bindings): void
    {
        // Check for suspicious binding values
        foreach ($bindings as $key => $value) {
            if (is_string($value)) {
                // Check for SQL injection attempts in bindings
                if ($this->containsSqlInjectionAttempt($value)) {
                    $this->handleViolation(
                        $query,
                        "Suspicious binding value detected: {$key}",
                        ['binding_key' => $key, 'binding_value' => $value]
                    );
                }
            }
        }
    }

    /**
     * Check if string contains potential SQL injection attempt
     *
     * @param string $value
     * @return bool
     */
    protected function containsSqlInjectionAttempt(string $value): bool
    {
        $injectionPatterns = [
            '/;\s*DROP\s+TABLE/i',
            '/;\s*DELETE\s+FROM/i',
            '/UNION\s+SELECT/i',
            '/--\s*$/m',
            '/\/\*.*\*\//s',
        ];

        foreach ($injectionPatterns as $pattern) {
            if (preg_match($pattern, $value)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Handle a validation violation
     *
     * @param string $query
     * @param string $reason
     * @param array<string, mixed> $context
     * @return void
     * @throws RuntimeException If strict mode is enabled
     */
    protected function handleViolation(string $query, string $reason, array $context = []): void
    {
        $message = "Database query validation failed: {$reason}";

        // Log the violation
        if (config('database-validator.log_violations', true)) {
            Log::warning($message, array_merge([
                'query' => $this->sanitizeQueryForLogging($query),
                'reason' => $reason,
                'environment' => App::environment(),
            ], $context));
        }

        // Throw exception in strict mode
        if (config('database-validator.strict_mode', true)) {
            throw new RuntimeException("Query execution blocked for security reasons.");
        }
    }

    /**
     * Sanitize query for safe logging (remove sensitive data)
     *
     * @param string $query
     * @return string
     */
    protected function sanitizeQueryForLogging(string $query): string
    {
        // Replace potential sensitive values with placeholders
        $sanitized = preg_replace('/\'[^\']*\'/i', "'***'", $query);
        $sanitized = preg_replace('/\d{11,}/i', '***', $sanitized ?? $query);

        return $sanitized ?? $query;
    }

    /**
     * Add a custom dangerous pattern
     *
     * @param string $pattern Regular expression pattern
     * @return self
     */
    public function addDangerousPattern(string $pattern): self
    {
        $this->dangerousPatterns[] = $pattern;
        return $this;
    }

    /**
     * Add a custom schema pattern
     *
     * @param string $pattern Regular expression pattern
     * @return self
     */
    public function addSchemaPattern(string $pattern): self
    {
        $this->schemaPatterns[] = $pattern;
        return $this;
    }

    /**
     * Get all dangerous patterns
     *
     * @return array<string>
     */
    public function getDangerousPatterns(): array
    {
        return $this->dangerousPatterns;
    }

    /**
     * Get all schema patterns
     *
     * @return array<string>
     */
    public function getSchemaPatterns(): array
    {
        return $this->schemaPatterns;
    }
}
