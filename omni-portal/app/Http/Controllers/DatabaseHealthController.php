<?php

namespace App\Http\Controllers;

use App\Services\DatabaseHealthService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class DatabaseHealthController extends Controller
{
    protected DatabaseHealthService $healthService;

    public function __construct(DatabaseHealthService $healthService)
    {
        $this->healthService = $healthService;
    }

    /**
     * Get health status of all database connections
     */
    public function index(): JsonResponse
    {
        try {
            $healthResults = $this->healthService->checkAllConnections();
            
            $overallHealth = collect($healthResults)->every(function ($result) {
                return $result['healthy'];
            });

            return response()->json([
                'status' => $overallHealth ? 'healthy' : 'unhealthy',
                'timestamp' => now()->toISOString(),
                'connections' => $healthResults,
                'summary' => [
                    'total_connections' => count($healthResults),
                    'healthy_connections' => collect($healthResults)->where('healthy', true)->count(),
                    'unhealthy_connections' => collect($healthResults)->where('healthy', false)->count(),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Database health check failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Health check service unavailable',
                'timestamp' => now()->toISOString()
            ], 500);
        }
    }

    /**
     * Get health status of a specific connection
     */
    public function show(string $connection): JsonResponse
    {
        try {
            $healthResult = $this->healthService->checkConnection($connection);
            
            return response()->json([
                'status' => $healthResult['healthy'] ? 'healthy' : 'unhealthy',
                'timestamp' => now()->toISOString(),
                'connection' => $healthResult
            ]);

        } catch (\Exception $e) {
            Log::error("Database health check failed for connection: {$connection}", [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => "Health check failed for connection: {$connection}",
                'timestamp' => now()->toISOString()
            ], 500);
        }
    }

    /**
     * Get connection statistics
     */
    public function statistics(): JsonResponse
    {
        try {
            $stats = $this->healthService->getConnectionStatistics();
            
            return response()->json([
                'status' => 'success',
                'timestamp' => now()->toISOString(),
                'statistics' => $stats
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get connection statistics', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to retrieve connection statistics',
                'timestamp' => now()->toISOString()
            ], 500);
        }
    }

    /**
     * Test failover capability
     */
    public function testFailover(): JsonResponse
    {
        try {
            $failoverResults = $this->healthService->testFailover();
            
            return response()->json([
                'status' => 'success',
                'message' => 'Failover test completed',
                'timestamp' => now()->toISOString(),
                'results' => $failoverResults
            ]);

        } catch (\Exception $e) {
            Log::error('Failover test failed', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failover test failed',
                'error' => $e->getMessage(),
                'timestamp' => now()->toISOString()
            ], 500);
        }
    }

    /**
     * Get the best available read connection
     */
    public function bestReadConnection(): JsonResponse
    {
        try {
            $bestConnection = $this->healthService->getBestReadConnection();
            
            return response()->json([
                'status' => 'success',
                'timestamp' => now()->toISOString(),
                'best_read_connection' => $bestConnection,
                'connection_health' => $this->healthService->checkConnection($bestConnection)
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get best read connection', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to determine best read connection',
                'timestamp' => now()->toISOString()
            ], 500);
        }
    }

    /**
     * Refresh connection cache
     */
    public function refreshConnections(): JsonResponse
    {
        try {
            $this->healthService->refreshConnections();
            
            return response()->json([
                'status' => 'success',
                'message' => 'Connection cache refreshed',
                'timestamp' => now()->toISOString()
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to refresh connections', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to refresh connection cache',
                'timestamp' => now()->toISOString()
            ], 500);
        }
    }

    /**
     * Get replication lag information
     */
    public function replicationLag(): JsonResponse
    {
        try {
            $lagInfo = [];
            $slaveConnections = ['mysql-slave-1', 'mysql-slave-2'];
            
            foreach ($slaveConnections as $connection) {
                $health = $this->healthService->checkConnection($connection);
                if ($health['healthy'] && isset($health['details']['replication_status'])) {
                    $lagInfo[$connection] = [
                        'seconds_behind_master' => $health['details']['replication_status']['seconds_behind_master'],
                        'status' => $health['details']['replication_status']['status'],
                        'last_check' => $health['timestamp']
                    ];
                } else {
                    $lagInfo[$connection] = [
                        'status' => 'unavailable',
                        'error' => $health['error'] ?? 'Unknown error'
                    ];
                }
            }
            
            return response()->json([
                'status' => 'success',
                'timestamp' => now()->toISOString(),
                'replication_lag' => $lagInfo
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get replication lag information', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to retrieve replication lag information',
                'timestamp' => now()->toISOString()
            ], 500);
        }
    }

    /**
     * Health check endpoint for load balancers
     */
    public function healthCheck(): JsonResponse
    {
        try {
            $masterHealth = $this->healthService->checkConnection('mysql-master');
            
            if ($masterHealth['healthy']) {
                return response()->json([
                    'status' => 'ok',
                    'timestamp' => now()->toISOString()
                ], 200);
            } else {
                return response()->json([
                    'status' => 'degraded',
                    'message' => 'Master database unavailable',
                    'timestamp' => now()->toISOString()
                ], 503);
            }

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Health check failed',
                'timestamp' => now()->toISOString()
            ], 503);
        }
    }
}