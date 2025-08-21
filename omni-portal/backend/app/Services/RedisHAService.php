<?php

namespace App\Services;

use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Config;
use Exception;
use Redis as PhpRedis;

/**
 * Redis High Availability Service
 * 
 * Provides Redis HA functionality with Sentinel support,
 * automatic failover handling, and connection management.
 */
class RedisHAService
{
    private array $sentinelNodes;
    private string $masterName;
    private array $options;
    private ?PhpRedis $redis = null;
    private array $connectionPool = [];
    private int $maxRetries;
    private int $retryDelay;

    public function __construct()
    {
        $this->sentinelNodes = $this->getSentinelNodes();
        $this->masterName = config('redis-ha.sentinel.master_name', 'mymaster');
        $this->options = config('redis-ha.sentinel.options', []);
        $this->maxRetries = config('redis-ha.failover.max_retries', 3);
        $this->retryDelay = config('redis-ha.failover.retry_delay', 100);
    }

    /**
     * Get current Redis master connection
     */
    public function getMasterConnection(): PhpRedis
    {
        if ($this->redis && $this->redis->ping()) {
            return $this->redis;
        }

        $masterInfo = $this->discoverMaster();
        
        if (!$masterInfo) {
            throw new Exception('Could not discover Redis master from Sentinels');
        }

        $this->redis = $this->createConnection($masterInfo['host'], $masterInfo['port']);
        
        return $this->redis;
    }

    /**
     * Get Redis slave connection for read operations
     */
    public function getSlaveConnection(): PhpRedis
    {
        $slaveInfo = $this->discoverSlave();
        
        if (!$slaveInfo) {
            // Fallback to master if no slaves available
            Log::warning('No Redis slaves available, falling back to master');
            return $this->getMasterConnection();
        }

        $connectionKey = "{$slaveInfo['host']}:{$slaveInfo['port']}";
        
        if (!isset($this->connectionPool[$connectionKey]) || 
            !$this->connectionPool[$connectionKey]->ping()) {
            
            $this->connectionPool[$connectionKey] = $this->createConnection(
                $slaveInfo['host'], 
                $slaveInfo['port']
            );
        }

        return $this->connectionPool[$connectionKey];
    }

    /**
     * Execute command with automatic failover
     */
    public function executeWithFailover(callable $command, bool $readOnly = false)
    {
        $retries = 0;
        
        while ($retries < $this->maxRetries) {
            try {
                $connection = $readOnly ? $this->getSlaveConnection() : $this->getMasterConnection();
                return $command($connection);
                
            } catch (Exception $e) {
                $retries++;
                
                Log::warning("Redis command failed (attempt $retries/{$this->maxRetries})", [
                    'error' => $e->getMessage(),
                    'read_only' => $readOnly
                ]);
                
                if ($retries >= $this->maxRetries) {
                    throw $e;
                }
                
                // Reset connections to force rediscovery
                $this->resetConnections();
                
                // Wait before retry
                usleep($this->retryDelay * 1000);
            }
        }
    }

    /**
     * Health check for the HA setup
     */
    public function healthCheck(): array
    {
        $health = [
            'status' => 'healthy',
            'master' => null,
            'slaves' => [],
            'sentinels' => [],
            'issues' => []
        ];

        try {
            // Check master
            $masterInfo = $this->discoverMaster();
            if ($masterInfo) {
                $health['master'] = $masterInfo;
                
                try {
                    $masterConnection = $this->getMasterConnection();
                    $masterConnection->ping();
                } catch (Exception $e) {
                    $health['issues'][] = "Master connection failed: {$e->getMessage()}";
                    $health['status'] = 'degraded';
                }
            } else {
                $health['issues'][] = 'Could not discover master';
                $health['status'] = 'unhealthy';
            }

            // Check slaves
            $slaves = $this->discoverSlaves();
            $health['slaves'] = $slaves;
            
            if (empty($slaves)) {
                $health['issues'][] = 'No slaves available';
                $health['status'] = 'degraded';
            }

            // Check sentinels
            foreach ($this->sentinelNodes as $node) {
                try {
                    $sentinel = $this->createSentinelConnection($node['host'], $node['port']);
                    $sentinel->ping();
                    $health['sentinels'][] = [
                        'host' => $node['host'],
                        'port' => $node['port'],
                        'status' => 'healthy'
                    ];
                } catch (Exception $e) {
                    $health['sentinels'][] = [
                        'host' => $node['host'],
                        'port' => $node['port'],
                        'status' => 'unhealthy',
                        'error' => $e->getMessage()
                    ];
                    $health['issues'][] = "Sentinel {$node['host']}:{$node['port']} is unhealthy";
                }
            }

        } catch (Exception $e) {
            $health['status'] = 'unhealthy';
            $health['issues'][] = "Health check failed: {$e->getMessage()}";
        }

        return $health;
    }

    /**
     * Force failover to a new master
     */
    public function forceFailover(): bool
    {
        foreach ($this->sentinelNodes as $node) {
            try {
                $sentinel = $this->createSentinelConnection($node['host'], $node['port']);
                
                $result = $sentinel->rawCommand('SENTINEL', 'FAILOVER', $this->masterName);
                
                if ($result === 'OK') {
                    Log::info('Redis failover initiated successfully', [
                        'sentinel' => "{$node['host']}:{$node['port']}"
                    ]);
                    
                    // Reset connections to force rediscovery
                    $this->resetConnections();
                    
                    return true;
                }
                
            } catch (Exception $e) {
                Log::warning('Failed to initiate failover via sentinel', [
                    'sentinel' => "{$node['host']}:{$node['port']}",
                    'error' => $e->getMessage()
                ]);
                continue;
            }
        }

        return false;
    }

    /**
     * Get cluster statistics
     */
    public function getClusterStats(): array
    {
        $stats = [
            'master' => null,
            'slaves' => [],
            'total_memory' => 0,
            'total_keys' => 0,
            'connections' => 0
        ];

        try {
            // Master stats
            $master = $this->getMasterConnection();
            $masterInfo = $master->info();
            
            $stats['master'] = [
                'memory_used' => $masterInfo['used_memory'] ?? 0,
                'keys' => $this->getTotalKeys($master),
                'connected_clients' => $masterInfo['connected_clients'] ?? 0,
                'ops_per_sec' => $masterInfo['instantaneous_ops_per_sec'] ?? 0
            ];
            
            $stats['total_memory'] += $stats['master']['memory_used'];
            $stats['total_keys'] += $stats['master']['keys'];
            $stats['connections'] += $stats['master']['connected_clients'];

            // Slave stats
            $slaves = $this->discoverSlaves();
            foreach ($slaves as $slaveInfo) {
                try {
                    $slave = $this->createConnection($slaveInfo['host'], $slaveInfo['port']);
                    $slaveData = $slave->info();
                    
                    $slaveStats = [
                        'host' => $slaveInfo['host'],
                        'port' => $slaveInfo['port'],
                        'memory_used' => $slaveData['used_memory'] ?? 0,
                        'keys' => $this->getTotalKeys($slave),
                        'connected_clients' => $slaveData['connected_clients'] ?? 0,
                        'lag' => $slaveInfo['lag'] ?? 0
                    ];
                    
                    $stats['slaves'][] = $slaveStats;
                    $stats['total_memory'] += $slaveStats['memory_used'];
                    $stats['connections'] += $slaveStats['connected_clients'];
                    
                } catch (Exception $e) {
                    Log::warning('Failed to get slave stats', [
                        'slave' => "{$slaveInfo['host']}:{$slaveInfo['port']}",
                        'error' => $e->getMessage()
                    ]);
                }
            }

        } catch (Exception $e) {
            Log::error('Failed to get cluster stats', ['error' => $e->getMessage()]);
        }

        return $stats;
    }

    /**
     * Discover master from sentinels
     */
    private function discoverMaster(): ?array
    {
        foreach ($this->sentinelNodes as $node) {
            try {
                $sentinel = $this->createSentinelConnection($node['host'], $node['port']);
                
                $masterAddr = $sentinel->rawCommand('SENTINEL', 'get-master-addr-by-name', $this->masterName);
                
                if ($masterAddr && count($masterAddr) >= 2) {
                    return [
                        'host' => $masterAddr[0],
                        'port' => (int)$masterAddr[1]
                    ];
                }
                
            } catch (Exception $e) {
                Log::warning('Failed to discover master from sentinel', [
                    'sentinel' => "{$node['host']}:{$node['port']}",
                    'error' => $e->getMessage()
                ]);
                continue;
            }
        }

        return null;
    }

    /**
     * Discover a single slave for read operations
     */
    private function discoverSlave(): ?array
    {
        $slaves = $this->discoverSlaves();
        
        if (empty($slaves)) {
            return null;
        }

        // Return slave with lowest lag
        usort($slaves, function($a, $b) {
            return ($a['lag'] ?? 0) <=> ($b['lag'] ?? 0);
        });

        return $slaves[0];
    }

    /**
     * Discover all slaves from sentinels
     */
    private function discoverSlaves(): array
    {
        foreach ($this->sentinelNodes as $node) {
            try {
                $sentinel = $this->createSentinelConnection($node['host'], $node['port']);
                
                $slaves = $sentinel->rawCommand('SENTINEL', 'slaves', $this->masterName);
                
                $result = [];
                foreach ($slaves as $slave) {
                    if (is_array($slave) && count($slave) >= 6) {
                        // Parse slave info (format: [key, value, key, value, ...])
                        $slaveInfo = [];
                        for ($i = 0; $i < count($slave); $i += 2) {
                            if (isset($slave[$i + 1])) {
                                $slaveInfo[$slave[$i]] = $slave[$i + 1];
                            }
                        }
                        
                        if (isset($slaveInfo['ip']) && isset($slaveInfo['port']) && 
                            $slaveInfo['flags'] !== 'slave,s_down,slave') {
                            
                            $result[] = [
                                'host' => $slaveInfo['ip'],
                                'port' => (int)$slaveInfo['port'],
                                'lag' => (int)($slaveInfo['master-link-down-time'] ?? 0)
                            ];
                        }
                    }
                }
                
                return $result;
                
            } catch (Exception $e) {
                Log::warning('Failed to discover slaves from sentinel', [
                    'sentinel' => "{$node['host']}:{$node['port']}",
                    'error' => $e->getMessage()
                ]);
                continue;
            }
        }

        return [];
    }

    /**
     * Create Redis connection
     */
    private function createConnection(string $host, int $port): PhpRedis
    {
        $redis = new PhpRedis();
        
        $timeout = config('redis-ha.connections.default.options.connection_timeout', 5.0);
        $readTimeout = config('redis-ha.connections.default.options.read_timeout', 5.0);
        
        if (!$redis->connect($host, $port, $timeout)) {
            throw new Exception("Failed to connect to Redis at {$host}:{$port}");
        }
        
        $redis->setOption(PhpRedis::OPT_READ_TIMEOUT, $readTimeout);
        
        $password = config('redis-ha.connections.default.password');
        if ($password) {
            $redis->auth($password);
        }
        
        return $redis;
    }

    /**
     * Create Sentinel connection
     */
    private function createSentinelConnection(string $host, int $port): PhpRedis
    {
        $sentinel = new PhpRedis();
        
        $timeout = config('redis-ha.sentinel.options.sentinel_timeout', 3.0);
        
        if (!$sentinel->connect($host, $port, $timeout)) {
            throw new Exception("Failed to connect to Sentinel at {$host}:{$port}");
        }
        
        return $sentinel;
    }

    /**
     * Reset all connections
     */
    private function resetConnections(): void
    {
        if ($this->redis) {
            try {
                $this->redis->close();
            } catch (Exception $e) {
                // Ignore close errors
            }
            $this->redis = null;
        }

        foreach ($this->connectionPool as $connection) {
            try {
                $connection->close();
            } catch (Exception $e) {
                // Ignore close errors
            }
        }
        
        $this->connectionPool = [];
    }

    /**
     * Get sentinel nodes from configuration
     */
    private function getSentinelNodes(): array
    {
        return config('redis-ha.sentinel.nodes', [
            ['host' => '127.0.0.1', 'port' => 26379],
            ['host' => '127.0.0.1', 'port' => 26380],
            ['host' => '127.0.0.1', 'port' => 26381],
        ]);
    }

    /**
     * Get total keys from Redis instance
     */
    private function getTotalKeys(PhpRedis $redis): int
    {
        try {
            $info = $redis->info('keyspace');
            $total = 0;
            
            foreach ($info as $key => $value) {
                if (strpos($key, 'db') === 0) {
                    preg_match('/keys=(\d+)/', $value, $matches);
                    if (isset($matches[1])) {
                        $total += (int)$matches[1];
                    }
                }
            }
            
            return $total;
        } catch (Exception $e) {
            return 0;
        }
    }
}