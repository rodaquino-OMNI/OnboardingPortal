# Database Query Validator - Quick Start Guide

## Overview

The DatabaseQueryValidator provides runtime security validation of database queries while allowing migrations to run in test environments.

## For Developers

### Running Tests
```bash
# Tests automatically disable the validator
php artisan test

# Run validator-specific tests
php artisan test --filter DatabaseQueryValidatorTest
```

### Running Migrations
```bash
# Development (validator auto-disabled in local env)
php artisan migrate

# Testing (validator disabled)
php artisan migrate --env=testing
```

### Checking Validator Status
```php
use App\Services\DatabaseQueryValidator;

$validator = app(DatabaseQueryValidator::class);
if ($validator->isEnabled()) {
    echo "Validator is active";
}
```

## For DevOps/CI

### Environment Variables

**Testing/CI (Disable Validator):**
```env
APP_ENV=testing
DB_QUERY_VALIDATOR_ENABLED=false
```

**Production (Enable Validator):**
```env
APP_ENV=production
DB_QUERY_VALIDATOR_ENABLED=true
DB_QUERY_VALIDATOR_LOG=true
DB_QUERY_VALIDATOR_STRICT=true
```

### GitHub Actions Example
```yaml
- name: Run Backend Tests
  env:
    APP_ENV: testing
    DB_QUERY_VALIDATOR_ENABLED: false
  run: php artisan test
```

## Configuration

File: `config/database-validator.php`

```php
return [
    'enabled' => env('DB_QUERY_VALIDATOR_ENABLED', true),
    'exclude_environments' => ['testing', 'local'],
    'log_violations' => env('DB_QUERY_VALIDATOR_LOG', true),
    'strict_mode' => env('DB_QUERY_VALIDATOR_STRICT', true),
];
```

## Troubleshooting

### "Query execution blocked for security reasons"

**In Testing:**
- Ensure `APP_ENV=testing` or `DB_QUERY_VALIDATOR_ENABLED=false`
- Check phpunit.xml has the validator env var set

**In Production:**
- This is expected for dangerous queries
- Review logs for the blocked query
- Ensure the query is safe before whitelisting

### Disabling Temporarily

```bash
# Option 1: Environment variable
export DB_QUERY_VALIDATOR_ENABLED=false

# Option 2: .env file
DB_QUERY_VALIDATOR_ENABLED=false
```

## Security Patterns

### Blocked in Production
- `DROP DATABASE`
- `TRUNCATE TABLE`
- `DELETE FROM table WHERE 1=1`
- `UPDATE table SET ... WHERE 1=1`
- `GRANT ALL PRIVILEGES`
- SQL injection attempts

### Allowed in Test/Migration
- `CREATE TABLE`
- `ALTER TABLE`
- `DROP TABLE`
- `CREATE INDEX`
- All schema operations during migrations

## Support

**Full Documentation:** `/docs/phase8/database_validator_fix.md`
**Service Location:** `/app/Services/DatabaseQueryValidator.php`
**Test Suite:** `/tests/Unit/DatabaseQueryValidatorTest.php`
