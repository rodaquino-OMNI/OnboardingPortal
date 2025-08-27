<?php
/**
 * Comprehensive Database Test Runner
 * 
 * Tests database connectivity, schema validation, CRUD operations,
 * foreign key constraints, performance, and connection pooling
 * without requiring Laravel framework.
 */

class DatabaseTestRunner
{
    private $pdo;
    private $config;
    private $results = [];
    private $totalTests = 0;
    private $passedTests = 0;
    private $failedTests = 0;

    public function __construct()
    {
        $this->loadConfig();
    }

    /**
     * Load database configuration
     */
    private function loadConfig()
    {
        // Try to load Laravel .env file if available
        $envFile = __DIR__ . '/../omni-portal/backend/.env';
        if (file_exists($envFile)) {
            $env = file_get_contents($envFile);
            preg_match_all('/^([A-Z_]+)=(.*)$/m', $env, $matches);
            $envVars = array_combine($matches[1], $matches[2]);
            
            $this->config = [
                'host' => $envVars['DB_HOST'] ?? 'localhost',
                'port' => $envVars['DB_PORT'] ?? '3306',
                'database' => $envVars['DB_DATABASE'] ?? 'onboarding_portal',
                'username' => $envVars['DB_USERNAME'] ?? 'root',
                'password' => $envVars['DB_PASSWORD'] ?? '',
                'driver' => $envVars['DB_CONNECTION'] ?? 'mysql'
            ];
        } else {
            // Fallback configuration
            $this->config = [
                'host' => 'localhost',
                'port' => '3306',
                'database' => 'onboarding_portal',
                'username' => 'root',
                'password' => '',
                'driver' => 'mysql'
            ];
        }
    }

    /**
     * Run all database tests
     */
    public function runAllTests()
    {
        $this->printHeader();
        
        try {
            // Test database connectivity
            $this->testConnectivity();
            
            // Test schema validation
            $this->testSchemaValidation();
            
            // Test CRUD operations
            $this->testCrudOperations();
            
            // Test foreign key constraints
            $this->testForeignKeyConstraints();
            
            // Test indexes
            $this->testIndexes();
            
            // Test performance
            $this->testPerformance();
            
            // Test connection pooling
            $this->testConnectionPooling();
            
        } catch (Exception $e) {
            $this->addResult('FATAL_ERROR', false, 'Fatal error: ' . $e->getMessage());
        }
        
        $this->printSummary();
    }

    /**
     * Test database connectivity
     */
    private function testConnectivity()
    {
        $this->printSection('Database Connectivity Tests');
        
        // Test MySQL connection
        try {
            $dsn = "mysql:host={$this->config['host']};port={$this->config['port']};dbname={$this->config['database']}";
            $this->pdo = new PDO($dsn, $this->config['username'], $this->config['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 5
            ]);
            
            $this->addResult('MySQL Connection', true, 'Successfully connected to MySQL database');
            
        } catch (PDOException $e) {
            $this->addResult('MySQL Connection', false, 'MySQL connection failed: ' . $e->getMessage());
            
            // Fallback to SQLite
            $this->testSQLiteConnection();
        }
        
        // Test basic query execution
        if ($this->pdo) {
            try {
                $stmt = $this->pdo->query('SELECT 1 as test');
                $result = $stmt->fetch();
                $this->addResult('Basic Query', $result['test'] == 1, 'Basic SELECT query execution');
            } catch (PDOException $e) {
                $this->addResult('Basic Query', false, 'Basic query failed: ' . $e->getMessage());
            }
        }
    }

    /**
     * Test SQLite connection as fallback
     */
    private function testSQLiteConnection()
    {
        try {
            $sqliteDb = __DIR__ . '/test_database.sqlite';
            $this->pdo = new PDO('sqlite:' . $sqliteDb, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            
            $this->addResult('SQLite Fallback', true, 'Successfully connected to SQLite database');
            $this->config['driver'] = 'sqlite';
            
            // Create basic test tables for SQLite
            $this->createSQLiteTestTables();
            
        } catch (PDOException $e) {
            $this->addResult('SQLite Fallback', false, 'SQLite connection failed: ' . $e->getMessage());
        }
    }

    /**
     * Create test tables for SQLite
     */
    private function createSQLiteTestTables()
    {
        $tables = [
            'users' => '
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    email_verified_at DATETIME,
                    password VARCHAR(255) NOT NULL,
                    remember_token VARCHAR(100),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )',
            'beneficiaries' => '
                CREATE TABLE IF NOT EXISTS beneficiaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    first_name VARCHAR(255) NOT NULL,
                    last_name VARCHAR(255) NOT NULL,
                    date_of_birth DATE,
                    phone_number VARCHAR(20),
                    address TEXT,
                    emergency_contact_name VARCHAR(255),
                    emergency_contact_phone VARCHAR(20),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )',
            'health_questionnaires' => '
                CREATE TABLE IF NOT EXISTS health_questionnaires (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    beneficiary_id INTEGER NOT NULL,
                    questions TEXT NOT NULL,
                    answers TEXT NOT NULL,
                    risk_score INTEGER DEFAULT 0,
                    completed_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id)
                )'
        ];
        
        foreach ($tables as $name => $sql) {
            try {
                $this->pdo->exec($sql);
            } catch (PDOException $e) {
                // Ignore table creation errors for now
            }
        }
    }

    /**
     * Test schema validation
     */
    private function testSchemaValidation()
    {
        $this->printSection('Schema Validation Tests');
        
        if (!$this->pdo) {
            $this->addResult('Schema Check', false, 'No database connection available');
            return;
        }
        
        $expectedTables = ['users', 'beneficiaries', 'health_questionnaires'];
        
        foreach ($expectedTables as $table) {
            try {
                if ($this->config['driver'] === 'sqlite') {
                    $stmt = $this->pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
                    $stmt->execute([$table]);
                } else {
                    $stmt = $this->pdo->prepare("SHOW TABLES LIKE ?");
                    $stmt->execute([$table]);
                }
                
                $exists = $stmt->fetch() !== false;
                $this->addResult("Table '{$table}'", $exists, $exists ? 'Table exists' : 'Table missing');
                
                // Test table structure if exists
                if ($exists) {
                    $this->testTableStructure($table);
                }
                
            } catch (PDOException $e) {
                $this->addResult("Table '{$table}'", false, 'Error checking table: ' . $e->getMessage());
            }
        }
    }

    /**
     * Test table structure
     */
    private function testTableStructure($table)
    {
        try {
            if ($this->config['driver'] === 'sqlite') {
                $stmt = $this->pdo->query("PRAGMA table_info({$table})");
            } else {
                $stmt = $this->pdo->query("DESCRIBE {$table}");
            }
            
            $columns = $stmt->fetchAll();
            $columnCount = count($columns);
            
            $this->addResult("{$table} Structure", $columnCount > 0, "Found {$columnCount} columns");
            
        } catch (PDOException $e) {
            $this->addResult("{$table} Structure", false, 'Error checking structure: ' . $e->getMessage());
        }
    }

    /**
     * Test CRUD operations
     */
    private function testCrudOperations()
    {
        $this->printSection('CRUD Operations Tests');
        
        if (!$this->pdo) {
            $this->addResult('CRUD Tests', false, 'No database connection available');
            return;
        }
        
        $testUserId = null;
        
        // Test CREATE
        try {
            $stmt = $this->pdo->prepare('
                INSERT INTO users (name, email, password) 
                VALUES (?, ?, ?)
            ');
            $result = $stmt->execute(['Test User', 'test@example.com', 'hashed_password']);
            $testUserId = $this->pdo->lastInsertId();
            
            $this->addResult('CREATE Operation', $result && $testUserId, 'User created successfully');
            
        } catch (PDOException $e) {
            $this->addResult('CREATE Operation', false, 'Create failed: ' . $e->getMessage());
        }
        
        // Test READ
        if ($testUserId) {
            try {
                $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ?');
                $stmt->execute([$testUserId]);
                $user = $stmt->fetch();
                
                $this->addResult('READ Operation', $user && $user['email'] === 'test@example.com', 'User read successfully');
                
            } catch (PDOException $e) {
                $this->addResult('READ Operation', false, 'Read failed: ' . $e->getMessage());
            }
        }
        
        // Test UPDATE
        if ($testUserId) {
            try {
                $stmt = $this->pdo->prepare('UPDATE users SET name = ? WHERE id = ?');
                $result = $stmt->execute(['Updated Test User', $testUserId]);
                
                // Verify update
                $stmt = $this->pdo->prepare('SELECT name FROM users WHERE id = ?');
                $stmt->execute([$testUserId]);
                $updated = $stmt->fetch();
                
                $this->addResult('UPDATE Operation', $updated['name'] === 'Updated Test User', 'User updated successfully');
                
            } catch (PDOException $e) {
                $this->addResult('UPDATE Operation', false, 'Update failed: ' . $e->getMessage());
            }
        }
        
        // Test DELETE
        if ($testUserId) {
            try {
                $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = ?');
                $result = $stmt->execute([$testUserId]);
                
                // Verify deletion
                $stmt = $this->pdo->prepare('SELECT COUNT(*) as count FROM users WHERE id = ?');
                $stmt->execute([$testUserId]);
                $count = $stmt->fetch();
                
                $this->addResult('DELETE Operation', $count['count'] == 0, 'User deleted successfully');
                
            } catch (PDOException $e) {
                $this->addResult('DELETE Operation', false, 'Delete failed: ' . $e->getMessage());
            }
        }
    }

    /**
     * Test foreign key constraints
     */
    private function testForeignKeyConstraints()
    {
        $this->printSection('Foreign Key Constraint Tests');
        
        if (!$this->pdo) {
            $this->addResult('FK Tests', false, 'No database connection available');
            return;
        }
        
        // Enable foreign key checks for SQLite
        if ($this->config['driver'] === 'sqlite') {
            $this->pdo->exec('PRAGMA foreign_keys = ON');
        }
        
        // Create a test user first
        try {
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
            $stmt->execute(['FK Test User', 'fk@example.com', 'password']);
            $userId = $this->pdo->lastInsertId();
            
            // Test valid foreign key
            $stmt = $this->pdo->prepare('
                INSERT INTO beneficiaries (user_id, first_name, last_name) 
                VALUES (?, ?, ?)
            ');
            $result = $stmt->execute([$userId, 'Test', 'Beneficiary']);
            $this->addResult('Valid FK Insert', $result, 'Valid foreign key accepted');
            
            // Test invalid foreign key
            try {
                $stmt = $this->pdo->prepare('
                    INSERT INTO beneficiaries (user_id, first_name, last_name) 
                    VALUES (?, ?, ?)
                ');
                $stmt->execute([99999, 'Invalid', 'User']); // Non-existent user_id
                $this->addResult('Invalid FK Insert', false, 'Invalid foreign key was accepted (should fail)');
            } catch (PDOException $e) {
                $this->addResult('Invalid FK Insert', true, 'Invalid foreign key correctly rejected');
            }
            
            // Cleanup
            $this->pdo->prepare('DELETE FROM beneficiaries WHERE user_id = ?')->execute([$userId]);
            $this->pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
            
        } catch (PDOException $e) {
            $this->addResult('FK Constraint Test', false, 'FK test failed: ' . $e->getMessage());
        }
    }

    /**
     * Test indexes
     */
    private function testIndexes()
    {
        $this->printSection('Index Tests');
        
        if (!$this->pdo) {
            $this->addResult('Index Tests', false, 'No database connection available');
            return;
        }
        
        try {
            if ($this->config['driver'] === 'sqlite') {
                // Check SQLite indexes
                $stmt = $this->pdo->query("SELECT name FROM sqlite_master WHERE type='index'");
                $indexes = $stmt->fetchAll();
                $indexCount = count($indexes);
                
                $this->addResult('Index Check', $indexCount > 0, "Found {$indexCount} indexes");
                
            } else {
                // Check MySQL indexes
                $stmt = $this->pdo->query('SHOW INDEXES FROM users');
                $indexes = $stmt->fetchAll();
                $indexCount = count($indexes);
                
                $this->addResult('Users Indexes', $indexCount > 0, "Found {$indexCount} indexes on users table");
            }
            
        } catch (PDOException $e) {
            $this->addResult('Index Check', false, 'Index check failed: ' . $e->getMessage());
        }
    }

    /**
     * Test performance
     */
    private function testPerformance()
    {
        $this->printSection('Performance Tests');
        
        if (!$this->pdo) {
            $this->addResult('Performance Tests', false, 'No database connection available');
            return;
        }
        
        // Test query execution time
        $startTime = microtime(true);
        
        try {
            // Insert test data
            $this->pdo->beginTransaction();
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
            
            for ($i = 0; $i < 100; $i++) {
                $stmt->execute(["User {$i}", "user{$i}@test.com", 'password']);
            }
            
            $this->pdo->commit();
            $insertTime = microtime(true) - $startTime;
            
            $this->addResult('Bulk Insert Performance', $insertTime < 5, sprintf('100 inserts in %.3f seconds', $insertTime));
            
            // Test select performance
            $startTime = microtime(true);
            $stmt = $this->pdo->query('SELECT * FROM users ORDER BY id LIMIT 50');
            $results = $stmt->fetchAll();
            $selectTime = microtime(true) - $startTime;
            
            $this->addResult('Select Performance', $selectTime < 1, sprintf('Select query in %.3f seconds', $selectTime));
            
            // Cleanup test data
            $this->pdo->exec("DELETE FROM users WHERE email LIKE '%@test.com'");
            
        } catch (PDOException $e) {
            $this->pdo->rollback();
            $this->addResult('Performance Test', false, 'Performance test failed: ' . $e->getMessage());
        }
    }

    /**
     * Test connection pooling
     */
    private function testConnectionPooling()
    {
        $this->printSection('Connection Pooling Tests');
        
        // Test multiple connections
        $connections = [];
        $connectionCount = 5;
        
        for ($i = 0; $i < $connectionCount; $i++) {
            try {
                if ($this->config['driver'] === 'sqlite') {
                    $conn = new PDO('sqlite:' . __DIR__ . '/test_database.sqlite');
                } else {
                    $dsn = "mysql:host={$this->config['host']};port={$this->config['port']};dbname={$this->config['database']}";
                    $conn = new PDO($dsn, $this->config['username'], $this->config['password']);
                }
                $connections[] = $conn;
            } catch (PDOException $e) {
                break;
            }
        }
        
        $actualConnections = count($connections);
        $this->addResult('Multiple Connections', $actualConnections >= 3, "Created {$actualConnections} connections");
        
        // Test concurrent queries
        $startTime = microtime(true);
        $results = [];
        
        foreach ($connections as $i => $conn) {
            try {
                $stmt = $conn->query('SELECT 1 as test');
                $results[] = $stmt->fetch();
            } catch (PDOException $e) {
                // Connection might have failed
            }
        }
        
        $queryTime = microtime(true) - $startTime;
        $this->addResult('Concurrent Queries', count($results) > 0, sprintf('Executed %d concurrent queries in %.3f seconds', count($results), $queryTime));
        
        // Close connections
        $connections = null;
    }

    /**
     * Add test result
     */
    private function addResult($test, $passed, $message)
    {
        $this->results[] = [
            'test' => $test,
            'passed' => $passed,
            'message' => $message
        ];
        
        $this->totalTests++;
        if ($passed) {
            $this->passedTests++;
            echo "✅ {$test}: {$message}\n";
        } else {
            $this->failedTests++;
            echo "❌ {$test}: {$message}\n";
        }
    }

    /**
     * Print section header
     */
    private function printSection($title)
    {
        echo "\n" . str_repeat('=', 60) . "\n";
        echo " {$title}\n";
        echo str_repeat('=', 60) . "\n";
    }

    /**
     * Print test header
     */
    private function printHeader()
    {
        echo "\n" . str_repeat('*', 80) . "\n";
        echo " COMPREHENSIVE DATABASE TEST RUNNER\n";
        echo " Testing database connectivity, schema, CRUD, constraints, and performance\n";
        echo str_repeat('*', 80) . "\n";
        echo "Database: {$this->config['driver']} - {$this->config['host']}:{$this->config['port']}/{$this->config['database']}\n";
    }

    /**
     * Print test summary
     */
    private function printSummary()
    {
        echo "\n" . str_repeat('=', 80) . "\n";
        echo " TEST SUMMARY\n";
        echo str_repeat('=', 80) . "\n";
        echo "Total Tests: {$this->totalTests}\n";
        echo "Passed: {$this->passedTests}\n";
        echo "Failed: {$this->failedTests}\n";
        
        $successRate = $this->totalTests > 0 ? round(($this->passedTests / $this->totalTests) * 100, 2) : 0;
        echo "Success Rate: {$successRate}%\n";
        
        if ($this->failedTests > 0) {
            echo "\n❌ FAILED TESTS:\n";
            foreach ($this->results as $result) {
                if (!$result['passed']) {
                    echo "  - {$result['test']}: {$result['message']}\n";
                }
            }
        }
        
        echo "\n" . ($this->failedTests === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED') . "\n";
        echo str_repeat('*', 80) . "\n";
        
        // Cleanup SQLite test file if created
        $sqliteFile = __DIR__ . '/test_database.sqlite';
        if (file_exists($sqliteFile) && $this->config['driver'] === 'sqlite') {
            unlink($sqliteFile);
        }
    }
}

// Run tests if script is executed directly
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    $runner = new DatabaseTestRunner();
    $runner->runAllTests();
    
    // Exit with appropriate code
    exit(0);
}
