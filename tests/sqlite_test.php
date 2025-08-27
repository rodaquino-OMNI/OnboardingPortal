<?php
/**
 * Simple SQLite Database Test
 * 
 * Basic test to verify SQLite database operations work correctly.
 * This is a lightweight test focused on core SQLite functionality.
 */

class SQLiteTest
{
    private $pdo;
    private $dbFile;
    private $results = [];
    private $totalTests = 0;
    private $passedTests = 0;
    private $failedTests = 0;

    public function __construct()
    {
        $this->dbFile = __DIR__ . '/sqlite_test_db.sqlite';
        $this->cleanup(); // Start with clean database
    }

    /**
     * Run all SQLite tests
     */
    public function runTests()
    {
        $this->printHeader();
        
        try {
            $this->testConnection();
            $this->testTableCreation();
            $this->testBasicCrud();
            $this->testTransactions();
            $this->testIndexes();
            $this->testForeignKeys();
            $this->testPerformance();
            
        } catch (Exception $e) {
            $this->addResult('FATAL_ERROR', false, 'Fatal error: ' . $e->getMessage());
        }
        
        $this->printSummary();
        $this->cleanup();
    }

    /**
     * Test SQLite connection
     */
    private function testConnection()
    {
        $this->printSection('SQLite Connection Test');
        
        try {
            $this->pdo = new PDO('sqlite:' . $this->dbFile, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            
            // Test basic query
            $stmt = $this->pdo->query('SELECT sqlite_version() as version');
            $result = $stmt->fetch();
            
            $this->addResult('SQLite Connection', true, 'Connected to SQLite v' . $result['version']);
            
        } catch (PDOException $e) {
            $this->addResult('SQLite Connection', false, 'Connection failed: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Test table creation
     */
    private function testTableCreation()
    {
        $this->printSection('Table Creation Tests');
        
        // Create users table
        try {
            $this->pdo->exec('
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    age INTEGER CHECK(age >= 0),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ');
            
            $this->addResult('Users Table Creation', true, 'Users table created successfully');
            
        } catch (PDOException $e) {
            $this->addResult('Users Table Creation', false, 'Failed to create users table: ' . $e->getMessage());
        }
        
        // Create posts table with foreign key
        try {
            $this->pdo->exec('
                CREATE TABLE posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ');
            
            $this->addResult('Posts Table Creation', true, 'Posts table created successfully');
            
        } catch (PDOException $e) {
            $this->addResult('Posts Table Creation', false, 'Failed to create posts table: ' . $e->getMessage());
        }
        
        // Verify tables exist
        try {
            $stmt = $this->pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            $expectedTables = ['users', 'posts'];
            $foundTables = array_intersect($expectedTables, $tables);
            
            $this->addResult('Table Verification', count($foundTables) == count($expectedTables), 
                'Found ' . count($foundTables) . '/' . count($expectedTables) . ' expected tables');
                
        } catch (PDOException $e) {
            $this->addResult('Table Verification', false, 'Table verification failed: ' . $e->getMessage());
        }
    }

    /**
     * Test basic CRUD operations
     */
    private function testBasicCrud()
    {
        $this->printSection('CRUD Operations Tests');
        
        $userId = null;
        
        // CREATE - Insert user
        try {
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
            $result = $stmt->execute(['John Doe', 'john@example.com', 30]);
            $userId = $this->pdo->lastInsertId();
            
            $this->addResult('CREATE User', $result && $userId > 0, "User created with ID: {$userId}");
            
        } catch (PDOException $e) {
            $this->addResult('CREATE User', false, 'User creation failed: ' . $e->getMessage());
        }
        
        // READ - Select user
        if ($userId) {
            try {
                $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ?');
                $stmt->execute([$userId]);
                $user = $stmt->fetch();
                
                $success = $user && $user['name'] === 'John Doe' && $user['email'] === 'john@example.com';
                $this->addResult('READ User', $success, $success ? 'User data retrieved correctly' : 'User data mismatch');
                
            } catch (PDOException $e) {
                $this->addResult('READ User', false, 'User read failed: ' . $e->getMessage());
            }
        }
        
        // UPDATE - Modify user
        if ($userId) {
            try {
                $stmt = $this->pdo->prepare('UPDATE users SET age = ? WHERE id = ?');
                $result = $stmt->execute([31, $userId]);
                
                // Verify update
                $stmt = $this->pdo->prepare('SELECT age FROM users WHERE id = ?');
                $stmt->execute([$userId]);
                $updatedUser = $stmt->fetch();
                
                $success = $updatedUser && $updatedUser['age'] == 31;
                $this->addResult('UPDATE User', $success, $success ? 'User age updated to 31' : 'Update verification failed');
                
            } catch (PDOException $e) {
                $this->addResult('UPDATE User', false, 'User update failed: ' . $e->getMessage());
            }
        }
        
        // Test multiple inserts
        try {
            $users = [
                ['Jane Smith', 'jane@example.com', 25],
                ['Bob Johnson', 'bob@example.com', 35],
                ['Alice Brown', 'alice@example.com', 28]
            ];
            
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
            $insertCount = 0;
            
            foreach ($users as $user) {
                if ($stmt->execute($user)) {
                    $insertCount++;
                }
            }
            
            $this->addResult('Bulk INSERT', $insertCount === count($users), "Inserted {$insertCount}/" . count($users) . " users");
            
        } catch (PDOException $e) {
            $this->addResult('Bulk INSERT', false, 'Bulk insert failed: ' . $e->getMessage());
        }
        
        // DELETE - Remove test user
        if ($userId) {
            try {
                $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = ?');
                $result = $stmt->execute([$userId]);
                
                // Verify deletion
                $stmt = $this->pdo->prepare('SELECT COUNT(*) as count FROM users WHERE id = ?');
                $stmt->execute([$userId]);
                $count = $stmt->fetch();
                
                $success = $count['count'] == 0;
                $this->addResult('DELETE User', $success, $success ? 'User deleted successfully' : 'Delete verification failed');
                
            } catch (PDOException $e) {
                $this->addResult('DELETE User', false, 'User deletion failed: ' . $e->getMessage());
            }
        }
    }

    /**
     * Test transactions
     */
    private function testTransactions()
    {
        $this->printSection('Transaction Tests');
        
        // Test successful transaction
        try {
            $this->pdo->beginTransaction();
            
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
            $stmt->execute(['Transaction User 1', 'trans1@example.com', 25]);
            $stmt->execute(['Transaction User 2', 'trans2@example.com', 30]);
            
            $this->pdo->commit();
            
            // Verify both users exist
            $stmt = $this->pdo->query("SELECT COUNT(*) as count FROM users WHERE email LIKE '%trans%@example.com'");
            $result = $stmt->fetch();
            
            $this->addResult('Transaction Commit', $result['count'] == 2, 'Transaction committed successfully');
            
        } catch (PDOException $e) {
            $this->pdo->rollback();
            $this->addResult('Transaction Commit', false, 'Transaction failed: ' . $e->getMessage());
        }
        
        // Test transaction rollback
        try {
            $this->pdo->beginTransaction();
            
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
            $stmt->execute(['Rollback User 1', 'rollback1@example.com', 25]);
            
            // Intentionally cause an error (duplicate email)
            try {
                $stmt->execute(['Rollback User 2', 'rollback1@example.com', 30]); // Duplicate email
                $this->pdo->commit();
                $this->addResult('Transaction Rollback', false, 'Transaction should have failed due to duplicate email');
            } catch (PDOException $e) {
                $this->pdo->rollback();
                
                // Verify no rollback users exist
                $stmt = $this->pdo->query("SELECT COUNT(*) as count FROM users WHERE email LIKE '%rollback%@example.com'");
                $result = $stmt->fetch();
                
                $this->addResult('Transaction Rollback', $result['count'] == 0, 'Transaction rolled back successfully');
            }
            
        } catch (PDOException $e) {
            $this->pdo->rollback();
            $this->addResult('Transaction Rollback', false, 'Rollback test failed: ' . $e->getMessage());
        }
    }

    /**
     * Test indexes
     */
    private function testIndexes()
    {
        $this->printSection('Index Tests');
        
        // Create index on email column
        try {
            $this->pdo->exec('CREATE INDEX idx_users_email ON users(email)');
            $this->addResult('Index Creation', true, 'Index on users.email created');
            
        } catch (PDOException $e) {
            $this->addResult('Index Creation', false, 'Index creation failed: ' . $e->getMessage());
        }
        
        // Verify index exists
        try {
            $stmt = $this->pdo->query("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_email'");
            $index = $stmt->fetch();
            
            $this->addResult('Index Verification', $index !== false, 'Index verified in sqlite_master');
            
        } catch (PDOException $e) {
            $this->addResult('Index Verification', false, 'Index verification failed: ' . $e->getMessage());
        }
        
        // Test query with index (using EXPLAIN QUERY PLAN)
        try {
            $stmt = $this->pdo->query("EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'test@example.com'");
            $plan = $stmt->fetchAll();
            
            // Look for index usage in query plan
            $usesIndex = false;
            foreach ($plan as $row) {
                if (stripos($row['detail'], 'idx_users_email') !== false) {
                    $usesIndex = true;
                    break;
                }
            }
            
            $this->addResult('Index Usage', $usesIndex, $usesIndex ? 'Query uses index' : 'Query plan analyzed');
            
        } catch (PDOException $e) {
            $this->addResult('Index Usage', false, 'Query plan analysis failed: ' . $e->getMessage());
        }
    }

    /**
     * Test foreign key constraints
     */
    private function testForeignKeys()
    {
        $this->printSection('Foreign Key Tests');
        
        // Enable foreign key constraints
        try {
            $this->pdo->exec('PRAGMA foreign_keys = ON');
            $this->addResult('FK Enable', true, 'Foreign key constraints enabled');
            
        } catch (PDOException $e) {
            $this->addResult('FK Enable', false, 'Failed to enable foreign keys: ' . $e->getMessage());
        }
        
        // Create a user for FK testing
        $userId = null;
        try {
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
            $stmt->execute(['FK Test User', 'fk@example.com', 25]);
            $userId = $this->pdo->lastInsertId();
            
        } catch (PDOException $e) {
            $this->addResult('FK Test Setup', false, 'Failed to create test user: ' . $e->getMessage());
            return;
        }
        
        // Test valid foreign key
        try {
            $stmt = $this->pdo->prepare('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)');
            $result = $stmt->execute([$userId, 'Test Post', 'This is a test post']);
            
            $this->addResult('Valid FK Insert', $result, 'Post created with valid foreign key');
            
        } catch (PDOException $e) {
            $this->addResult('Valid FK Insert', false, 'Valid FK insert failed: ' . $e->getMessage());
        }
        
        // Test invalid foreign key
        try {
            $stmt = $this->pdo->prepare('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)');
            $stmt->execute([99999, 'Invalid Post', 'This should fail']); // Non-existent user_id
            
            $this->addResult('Invalid FK Insert', false, 'Invalid FK was accepted (should have failed)');
            
        } catch (PDOException $e) {
            $this->addResult('Invalid FK Insert', true, 'Invalid FK correctly rejected');
        }
        
        // Test CASCADE delete
        try {
            // First verify post exists
            $stmt = $this->pdo->prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?');
            $stmt->execute([$userId]);
            $beforeDelete = $stmt->fetch();
            
            // Delete user (should cascade to posts)
            $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            
            // Verify posts were deleted
            $stmt = $this->pdo->prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?');
            $stmt->execute([$userId]);
            $afterDelete = $stmt->fetch();
            
            $cascaded = $beforeDelete['count'] > 0 && $afterDelete['count'] == 0;
            $this->addResult('FK CASCADE Delete', $cascaded, $cascaded ? 'CASCADE delete worked' : 'CASCADE delete may not have worked');
            
        } catch (PDOException $e) {
            $this->addResult('FK CASCADE Delete', false, 'CASCADE test failed: ' . $e->getMessage());
        }
    }

    /**
     * Test performance
     */
    private function testPerformance()
    {
        $this->printSection('Performance Tests');
        
        // Test bulk insert performance
        try {
            $startTime = microtime(true);
            
            $this->pdo->beginTransaction();
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
            
            for ($i = 0; $i < 1000; $i++) {
                $stmt->execute(["Perf User {$i}", "perf{$i}@example.com", rand(18, 80)]);
            }
            
            $this->pdo->commit();
            $insertTime = microtime(true) - $startTime;
            
            $this->addResult('Bulk Insert Performance', $insertTime < 2.0, 
                sprintf('1000 inserts completed in %.3f seconds', $insertTime));
            
        } catch (PDOException $e) {
            $this->pdo->rollback();
            $this->addResult('Bulk Insert Performance', false, 'Bulk insert failed: ' . $e->getMessage());
        }
        
        // Test select performance
        try {
            $startTime = microtime(true);
            
            $stmt = $this->pdo->query('SELECT * FROM users WHERE age > 30 ORDER BY name LIMIT 100');
            $results = $stmt->fetchAll();
            
            $selectTime = microtime(true) - $startTime;
            
            $this->addResult('Select Performance', $selectTime < 0.5, 
                sprintf('Selected %d records in %.3f seconds', count($results), $selectTime));
            
        } catch (PDOException $e) {
            $this->addResult('Select Performance', false, 'Select performance test failed: ' . $e->getMessage());
        }
        
        // Test database size
        if (file_exists($this->dbFile)) {
            $dbSize = filesize($this->dbFile);
            $dbSizeMB = round($dbSize / 1024 / 1024, 2);
            
            $this->addResult('Database Size', $dbSize > 0, "Database file size: {$dbSizeMB} MB");
        }
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
        echo "\n" . str_repeat('-', 50) . "\n";
        echo " {$title}\n";
        echo str_repeat('-', 50) . "\n";
    }

    /**
     * Print test header
     */
    private function printHeader()
    {
        echo "\n" . str_repeat('*', 60) . "\n";
        echo " SQLITE DATABASE TEST\n";
        echo " Testing SQLite database operations\n";
        echo str_repeat('*', 60) . "\n";
        echo "Database File: {$this->dbFile}\n";
    }

    /**
     * Print test summary
     */
    private function printSummary()
    {
        echo "\n" . str_repeat('=', 60) . "\n";
        echo " TEST SUMMARY\n";
        echo str_repeat('=', 60) . "\n";
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
        echo str_repeat('*', 60) . "\n";
    }

    /**
     * Clean up test database
     */
    private function cleanup()
    {
        if (file_exists($this->dbFile)) {
            unlink($this->dbFile);
        }
    }

    /**
     * Destructor to ensure cleanup
     */
    public function __destruct()
    {
        $this->cleanup();
    }
}

// Run tests if script is executed directly
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    $test = new SQLiteTest();
    $test->runTests();
    
    exit(0);
}
