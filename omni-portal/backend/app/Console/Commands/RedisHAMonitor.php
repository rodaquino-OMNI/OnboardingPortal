<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\RedisHAService;
use Illuminate\Support\Facades\Log;

/**
 * Redis HA Monitoring Command
 * 
 * Provides monitoring and management capabilities for Redis HA cluster
 */
class RedisHAMonitor extends Command
{
    protected $signature = 'redis:ha 
                           {action : Action to perform (status|health|stats|failover|monitor)}
                           {--interval=30 : Monitoring interval in seconds}
                           {--duration=0 : Monitoring duration in minutes (0 = infinite)}';

    protected $description = 'Monitor and manage Redis High Availability cluster';

    private RedisHAService $redisHA;

    public function __construct(RedisHAService $redisHA)
    {
        parent::__construct();
        $this->redisHA = $redisHA;
    }

    public function handle(): int
    {
        $action = $this->argument('action');

        try {
            switch ($action) {
                case 'status':
                    return $this->showStatus();
                
                case 'health':
                    return $this->checkHealth();
                
                case 'stats':
                    return $this->showStats();
                
                case 'failover':
                    return $this->performFailover();
                
                case 'monitor':
                    return $this->startMonitoring();
                
                default:
                    $this->error("Unknown action: {$action}");
                    $this->showUsage();
                    return 1;
            }
        } catch (\Exception $e) {
            $this->error("Command failed: {$e->getMessage()}");
            Log::error('Redis HA command failed', [
                'action' => $action,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }
    }

    /**
     * Show Redis HA status
     */
    private function showStatus(): int
    {
        $this->info('Redis High Availability Status');
        $this->line(str_repeat('=', 40));

        try {
            $master = $this->redisHA->getMasterConnection();
            $masterInfo = $master->info();

            $this->line('');
            $this->info('Master Status:');
            $this->table(
                ['Property', 'Value'],
                [
                    ['Status', 'Online'],
                    ['Role', $masterInfo['role'] ?? 'unknown'],
                    ['Connected Clients', $masterInfo['connected_clients'] ?? '0'],
                    ['Used Memory', $this->formatBytes($masterInfo['used_memory'] ?? 0)],
                    ['Ops/sec', $masterInfo['instantaneous_ops_per_sec'] ?? '0'],
                    ['Connected Slaves', $masterInfo['connected_slaves'] ?? '0'],
                ]
            );

            // Test slave connection
            try {
                $slave = $this->redisHA->getSlaveConnection();
                $this->info('✓ Slave connection successful');
            } catch (\Exception $e) {
                $this->warn('✗ Slave connection failed: ' . $e->getMessage());
            }

            $this->info('✓ Redis HA is operational');
            return 0;

        } catch (\Exception $e) {
            $this->error('✗ Redis HA is not operational: ' . $e->getMessage());
            return 1;
        }
    }

    /**
     * Perform comprehensive health check
     */
    private function checkHealth(): int
    {
        $this->info('Redis HA Health Check');
        $this->line(str_repeat('=', 40));

        $health = $this->redisHA->healthCheck();

        // Overall status
        $statusColor = match($health['status']) {
            'healthy' => 'info',
            'degraded' => 'warn',
            'unhealthy' => 'error',
            default => 'line'
        };

        $this->$statusColor("Overall Status: " . strtoupper($health['status']));
        $this->line('');

        // Master status
        if ($health['master']) {
            $this->info('Master: ' . $health['master']['host'] . ':' . $health['master']['port']);
        } else {
            $this->error('Master: Not available');
        }

        // Slaves status
        $this->info('Slaves: ' . count($health['slaves']) . ' available');
        foreach ($health['slaves'] as $slave) {
            $this->line("  - {$slave['host']}:{$slave['port']} (lag: {$slave['lag']}ms)");
        }

        // Sentinels status
        $healthySentinels = array_filter($health['sentinels'], fn($s) => $s['status'] === 'healthy');
        $this->info('Sentinels: ' . count($healthySentinels) . '/' . count($health['sentinels']) . ' healthy');
        
        foreach ($health['sentinels'] as $sentinel) {
            $status = $sentinel['status'] === 'healthy' ? '✓' : '✗';
            $this->line("  {$status} {$sentinel['host']}:{$sentinel['port']}");
        }

        // Issues
        if (!empty($health['issues'])) {
            $this->line('');
            $this->warn('Issues detected:');
            foreach ($health['issues'] as $issue) {
                $this->line("  - {$issue}");
            }
        }

        return $health['status'] === 'healthy' ? 0 : 1;
    }

    /**
     * Show cluster statistics
     */
    private function showStats(): int
    {
        $this->info('Redis HA Cluster Statistics');
        $this->line(str_repeat('=', 40));

        $stats = $this->redisHA->getClusterStats();

        // Overall stats
        $this->line('');
        $this->info('Cluster Overview:');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Total Memory Used', $this->formatBytes($stats['total_memory'])],
                ['Total Keys', number_format($stats['total_keys'])],
                ['Total Connections', $stats['connections']],
                ['Active Slaves', count($stats['slaves'])],
            ]
        );

        // Master stats
        if ($stats['master']) {
            $this->line('');
            $this->info('Master Statistics:');
            $this->table(
                ['Metric', 'Value'],
                [
                    ['Memory Used', $this->formatBytes($stats['master']['memory_used'])],
                    ['Keys', number_format($stats['master']['keys'])],
                    ['Connected Clients', $stats['master']['connected_clients']],
                    ['Operations/sec', $stats['master']['ops_per_sec']],
                ]
            );
        }

        // Slave stats
        if (!empty($stats['slaves'])) {
            $this->line('');
            $this->info('Slave Statistics:');
            
            $slaveData = [];
            foreach ($stats['slaves'] as $slave) {
                $slaveData[] = [
                    $slave['host'] . ':' . $slave['port'],
                    $this->formatBytes($slave['memory_used']),
                    number_format($slave['keys']),
                    $slave['connected_clients'],
                    $slave['lag'] . 'ms'
                ];
            }
            
            $this->table(
                ['Slave', 'Memory', 'Keys', 'Clients', 'Lag'],
                $slaveData
            );
        }

        return 0;
    }

    /**
     * Perform manual failover
     */
    private function performFailover(): int
    {
        $this->warn('Initiating Redis failover...');
        
        if (!$this->confirm('Are you sure you want to force a failover? This will promote a slave to master.')) {
            $this->info('Failover cancelled.');
            return 0;
        }

        $this->info('Forcing failover...');
        
        if ($this->redisHA->forceFailover()) {
            $this->info('✓ Failover initiated successfully');
            
            // Wait a moment for failover to complete
            $this->info('Waiting for failover to complete...');
            sleep(5);
            
            // Check new status
            $this->line('');
            $this->info('New cluster status:');
            return $this->showStatus();
            
        } else {
            $this->error('✗ Failed to initiate failover');
            return 1;
        }
    }

    /**
     * Start continuous monitoring
     */
    private function startMonitoring(): int
    {
        $interval = (int)$this->option('interval');
        $duration = (int)$this->option('duration');
        
        $this->info("Starting Redis HA monitoring (interval: {$interval}s)");
        if ($duration > 0) {
            $this->info("Monitoring duration: {$duration} minutes");
        } else {
            $this->info("Monitoring duration: infinite (press Ctrl+C to stop)");
        }
        
        $this->line(str_repeat('=', 50));

        $startTime = time();
        $endTime = $duration > 0 ? $startTime + ($duration * 60) : 0;

        while (true) {
            $currentTime = time();
            
            // Check if we should stop
            if ($endTime > 0 && $currentTime >= $endTime) {
                $this->info('Monitoring duration completed.');
                break;
            }

            $this->line('');
            $this->info('[' . date('Y-m-d H:i:s') . '] Health Check');
            $this->line(str_repeat('-', 30));

            try {
                $health = $this->redisHA->healthCheck();
                
                // Show summary
                $statusIcon = match($health['status']) {
                    'healthy' => '✓',
                    'degraded' => '⚠',
                    'unhealthy' => '✗',
                    default => '?'
                };

                $this->line("Status: {$statusIcon} " . strtoupper($health['status']));
                
                if ($health['master']) {
                    $this->line("Master: {$health['master']['host']}:{$health['master']['port']}");
                }
                
                $healthySentinels = array_filter($health['sentinels'], fn($s) => $s['status'] === 'healthy');
                $this->line("Slaves: " . count($health['slaves']) . " | Sentinels: " . count($healthySentinels) . "/" . count($health['sentinels']));

                if (!empty($health['issues'])) {
                    $this->warn("Issues: " . implode(', ', $health['issues']));
                }

                // Get quick stats
                $stats = $this->redisHA->getClusterStats();
                if ($stats['master']) {
                    $this->line("Memory: " . $this->formatBytes($stats['total_memory']) . 
                               " | Keys: " . number_format($stats['total_keys']) . 
                               " | Connections: " . $stats['connections']);
                }

            } catch (\Exception $e) {
                $this->error("Monitoring error: {$e->getMessage()}");
            }

            // Wait for next check
            sleep($interval);
        }

        return 0;
    }

    /**
     * Show command usage
     */
    private function showUsage(): void
    {
        $this->line('');
        $this->info('Available actions:');
        $this->line('  status   - Show current Redis HA status');
        $this->line('  health   - Perform comprehensive health check');
        $this->line('  stats    - Show cluster statistics');
        $this->line('  failover - Force failover to new master');
        $this->line('  monitor  - Start continuous monitoring');
        $this->line('');
        $this->info('Examples:');
        $this->line('  php artisan redis:ha status');
        $this->line('  php artisan redis:ha monitor --interval=10 --duration=30');
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, 2) . ' ' . $units[$i];
    }
}