<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Exception;
use PDOException;

class DatabaseHealthService
{
    protected array $connections = [
        'mysql-master',
        'mysql-slave-1', 
        'mysql-slave-2'
    ];

    protected int $healthCheckTimeout = 5; // seconds
    protected int $cacheTimeout = 30; // seconds

    /**
     * Check the health of all database connections
     */
    public function checkAllConnections(): array
    {
        $results = [];
        
        foreach ($this->connections as $connection) {
            $results[$connection] = $this->checkConnection($connection);
        }

        return $results;
    }

    /**
     * Check the health of a specific database connection
     */
    public function checkConnection(string $connection): array
    {
        $cacheKey = "db_health_{$connection}";
        
        // Check cache first to avoid hammering the database
        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        $result = [
            'connection' => $connection,
            'healthy' => false,
            'response_time' => null,
            'error' => null,
            'details' => [],
            'timestamp' => now()->toISOString()
        ];

        try {
            $startTime = microtime(true);
            
            // Test basic connectivity
            $pdo = DB::connection($connection)->getPdo();
            $pdo->setAttribute(\PDO::ATTR_TIMEOUT, $this->healthCheckTimeout);
            
            // Simple health check query
            $healthCheck = DB::connection($connection)
                ->select('SELECT 1 as health_check, NOW() as server_time, @@server_id as server_id');
            
            $endTime = microtime(true);
            $responseTime = round(($endTime - $startTime) * 1000, 2); // Convert to milliseconds

            if (!empty($healthCheck)) {
                $result['healthy'] = true;
                $result['response_time'] = $responseTime;
                $result['details'] = [
                    'server_time' => $healthCheck[0]->server_time,
                    'server_id' => $healthCheck[0]->server_id,
                    'response_time_ms' => $responseTime
                ];

                // Additional checks for slave connections
                if (str_contains($connection, 'slave')) {
                    $result['details']['replication_status'] = $this->checkReplicationStatus($connection);
                }

                // Additional checks for master connection
                if (str_contains($connection, 'master')) {
                    $result['details']['master_status'] = $this->checkMasterStatus($connection);
                }
            }

        } catch (PDOException $e) {
            $result['error'] = "PDO Error: " . $e->getMessage();
            Log::error("Database health check failed for {$connection}", [
                'error' => $e->getMessage(),
                'code' => $e->getCode()
            ]);
        } catch (Exception $e) {
            $result['error'] = "General Error: " . $e->getMessage();
            Log::error("Database health check failed for {$connection}", [
                'error' => $e->getMessage()
            ]);
        }

        // Cache the result to avoid overloading the database
        Cache::put($cacheKey, $result, $this->cacheTimeout);

        return $result;
    }

    /**
     * Check replication status for slave connections
     */
    protected function checkReplicationStatus(string $connection): array
    {
        try {
            $slaveStatus = DB::connection($connection)
                ->select('SHOW SLAVE STATUS');

            if (empty($slaveStatus)) {
                return ['status' => 'no_replication_configured'];
            }

            $status = (array) $slaveStatus[0];
            
            return [
                'slave_io_running' => $status['Slave_IO_Running'] ?? 'Unknown',
                'slave_sql_running' => $status['Slave_SQL_Running'] ?? 'Unknown',
                'seconds_behind_master' => $status['Seconds_Behind_Master'] ?? 'Unknown',
                'master_host' => $status['Master_Host'] ?? 'Unknown',
                'master_port' => $status['Master_Port'] ?? 'Unknown',
                'last_error' => $status['Last_Error'] ?? '',
                'gtid_executed' => $status['Retrieved_Gtid_Set'] ?? '',
                'status' => ($status['Slave_IO_Running'] === 'Yes' && $status['Slave_SQL_Running'] === 'Yes') ? 'healthy' : 'unhealthy'
            ];

        } catch (Exception $e) {
            return [
                'status' => 'error',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Check master status for master connection
     */
    protected function checkMasterStatus(string $connection): array
    {
        try {
            $masterStatus = DB::connection($connection)
                ->select('SHOW MASTER STATUS');

            if (empty($masterStatus)) {
                return ['status' => 'no_binary_logging'];
            }

            $status = (array) $masterStatus[0];
            
            return [
                'file' => $status['File'] ?? 'Unknown',
                'position' => $status['Position'] ?? 'Unknown',
                'binlog_do_db' => $status['Binlog_Do_DB'] ?? '',
                'binlog_ignore_db' => $status['Binlog_Ignore_DB'] ?? '',
                'executed_gtid_set' => $status['Executed_Gtid_Set'] ?? '',
                'status' => 'healthy'
            ];

        } catch (Exception $e) {
            return [
                'status' => 'error',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Get the best available read connection
     */
    public function getBestReadConnection(): string
    {
        $slaves = ['mysql-slave-1', 'mysql-slave-2'];
        
        foreach ($slaves as $slave) {
            $health = $this->checkConnection($slave);
            
            if ($health['healthy'] && 
                isset($health['details']['replication_status']['status']) && 
                $health['details']['replication_status']['status'] === 'healthy') {
                return $slave;
            }
        }

        // Fallback to master if slaves are unavailable
        Log::warning('All slave connections unavailable, falling back to master for reads');
        return 'mysql-master';
    }

    /**
     * Get connection statistics
     */
    public function getConnectionStatistics(): array
    {
        $stats = [];

        foreach ($this->connections as $connection) {
            try {
                $processlist = DB::connection($connection)
                    ->select('SHOW PROCESSLIST');

                $status = DB::connection($connection)
                    ->select("SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Max_used_connections', 'Uptime')");

                $statusArray = [];
                foreach ($status as $stat) {
                    $statusArray[$stat->Variable_name] = $stat->Value;
                }

                $stats[$connection] = [
                    'active_connections' => count($processlist),
                    'threads_connected' => $statusArray['Threads_connected'] ?? 0,
                    'threads_running' => $statusArray['Threads_running'] ?? 0,
                    'max_used_connections' => $statusArray['Max_used_connections'] ?? 0,
                    'uptime' => $statusArray['Uptime'] ?? 0,
                ];

            } catch (Exception $e) {
                $stats[$connection] = [
                    'error' => $e->getMessage()
                ];
            }
        }

        return $stats;
    }

    /**
     * Test failover capability
     */
    public function testFailover(): array
    {
        $results = [
            'test_timestamp' => now()->toISOString(),
            'steps' => []
        ];

        // Step 1: Write to master
        try {
            $testData = 'failover_test_' . time();
            
            DB::connection('mysql-master')->insert(
                'INSERT INTO health_check (server_type, server_id, status) VALUES (?, ?, ?)',
                ['failover_test', 999, $testData]
            );

            $results['steps']['write_to_master'] = [
                'status' => 'success',
                'test_data' => $testData
            ];

            // Step 2: Wait for replication
            sleep(2);

            // Step 3: Read from slaves
            $readResults = [];
            foreach (['mysql-slave-1', 'mysql-slave-2'] as $slave) {
                try {
                    $readData = DB::connection($slave)
                        ->select(
                            'SELECT status FROM health_check WHERE server_type = ? AND server_id = ? ORDER BY last_update DESC LIMIT 1',
                            ['failover_test', 999]
                        );

                    if (!empty($readData) && $readData[0]->status === $testData) {
                        $readResults[$slave] = 'success';
                    } else {
                        $readResults[$slave] = 'data_mismatch';
                    }

                } catch (Exception $e) {
                    $readResults[$slave] = 'error: ' . $e->getMessage();
                }
            }

            $results['steps']['read_from_slaves'] = $readResults;

            // Cleanup
            DB::connection('mysql-master')->delete(
                'DELETE FROM health_check WHERE server_type = ? AND server_id = ?',
                ['failover_test', 999]
            );

        } catch (Exception $e) {
            $results['steps']['write_to_master'] = [
                'status' => 'error',
                'error' => $e->getMessage()
            ];
        }

        return $results;
    }

    /**
     * Force connection refresh (clear cache)
     */
    public function refreshConnections(): void
    {
        foreach ($this->connections as $connection) {
            Cache::forget("db_health_{$connection}");
        }
    }
}