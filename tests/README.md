# Database Test Suite

This directory contains comprehensive database testing tools for the Onboarding Portal project.

## Test Files

### 1. `run_database_tests.php`
A comprehensive database test runner that validates:

- **Database Connectivity**: Tests MySQL connection with SQLite fallback
- **Schema Validation**: Verifies tables exist and have correct structure
- **CRUD Operations**: Tests Create, Read, Update, Delete operations
- **Foreign Key Constraints**: Validates referential integrity
- **Indexes**: Checks index creation and usage
- **Performance**: Tests query execution speed and bulk operations
- **Connection Pooling**: Validates multiple database connections

**Usage:**
```bash
cd tests
php run_database_tests.php
```

### 2. `sqlite_test.php`
A focused SQLite database test that covers:

- **Connection Testing**: SQLite connectivity verification
- **Table Creation**: DDL operations and schema creation
- **CRUD Operations**: Basic data manipulation
- **Transactions**: Commit and rollback functionality
- **Indexes**: Index creation and verification
- **Foreign Keys**: Constraint validation and CASCADE operations
- **Performance**: Bulk insert and select benchmarks

**Usage:**
```bash
cd tests
php sqlite_test.php
```

## Test Results

Both tests provide clear pass/fail results with:
- ✅ **Passed tests**: Green checkmarks with success details
- ❌ **Failed tests**: Red X marks with failure reasons
- 📊 **Summary statistics**: Total tests, pass rate, and failure details

## Features

### Automatic Fallback
If MySQL connection fails, tests automatically fall back to SQLite for validation.

### Comprehensive Coverage
Tests cover all major database operations:
- Connection management
- Schema validation
- Data operations (CRUD)
- Constraints and relationships
- Performance benchmarks
- Error handling

### No Framework Dependencies
Tests run as standalone PHP scripts without requiring Laravel or other frameworks.

### Cleanup
Tests automatically clean up temporary files and test data after execution.

## Configuration

The comprehensive test runner automatically loads configuration from:
1. Laravel `.env` file (if available)
2. Fallback default configuration

Default configuration:
```php
'host' => 'localhost'
'port' => '3306'
'database' => 'onboarding_portal'
'username' => 'root'
'password' => ''
'driver' => 'mysql'
```

## Expected Results

A healthy database should achieve:
- **95-100% pass rate** on all tests
- **Sub-second performance** for basic operations
- **Proper constraint enforcement** for data integrity
- **Successful connection pooling** for scalability

## Troubleshooting

### Common Issues:

1. **MySQL Connection Failed**: 
   - Check database credentials in `.env` file
   - Ensure MySQL server is running
   - Tests will fall back to SQLite automatically

2. **Permission Denied**:
   - Ensure PHP has write permissions to the `tests` directory
   - Required for creating temporary SQLite database files

3. **Missing Tables**:
   - Run Laravel migrations first: `php artisan migrate`
   - Or use SQLite tests which create tables automatically

### Performance Expectations:

- **Bulk inserts**: < 2 seconds for 100-1000 records
- **Select queries**: < 0.5 seconds for typical result sets
- **Connection creation**: < 5 seconds per connection
- **Transaction processing**: Near-instantaneous for test data

## Integration

These tests can be integrated into:
- **CI/CD pipelines** for automated testing
- **Development workflows** for database validation
- **Performance monitoring** for regression detection
- **Health checks** for production environments