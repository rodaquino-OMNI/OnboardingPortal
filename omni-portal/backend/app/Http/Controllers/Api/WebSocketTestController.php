<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\HealthRiskAlert;
use App\Events\SystemAlert;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class WebSocketTestController extends Controller
{
    /**
     * Test WebSocket connection and broadcast functionality
     */
    public function testConnection(): JsonResponse
    {
        try {
            // Generate a test alert
            $alertData = [
                'id' => 'test_' . time(),
                'type' => 'info',
                'category' => 'system',
                'title' => 'WebSocket Connection Test',
                'message' => 'This is a test message to verify WebSocket connectivity is working properly.',
                'timestamp' => now()->toISOString(),
                'priority' => 'low',
                'resolved' => false,
                'source' => 'websocket_test',
                'actionRequired' => false,
                'autoResolve' => true,
                'escalationLevel' => 0,
                'metadata' => [
                    'test' => true,
                    'environment' => config('app.env')
                ]
            ];

            // Broadcast the test alert
            broadcast(new SystemAlert($alertData));

            Log::info('WebSocket test alert broadcasted', ['alert_id' => $alertData['id']]);

            return response()->json([
                'success' => true,
                'message' => 'WebSocket test alert sent successfully',
                'alert_id' => $alertData['id'],
                'websocket_config' => [
                    'enabled' => config('broadcasting.default') === 'reverb',
                    'host' => config('reverb.servers.reverb.host', 'localhost'),
                    'port' => config('reverb.servers.reverb.port', 8080),
                    'app_key' => config('reverb.apps.0.key'),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('WebSocket test failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'WebSocket test failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate multiple test alerts for load testing
     */
    public function loadTest(Request $request): JsonResponse
    {
        $count = $request->input('count', 5);
        $count = min($count, 50); // Limit to 50 alerts max

        try {
            $alerts = [];
            
            for ($i = 1; $i <= $count; $i++) {
                $alertData = [
                    'id' => 'load_test_' . time() . '_' . $i,
                    'type' => collect(['info', 'warning', 'critical'])->random(),
                    'category' => collect(['health', 'system', 'security', 'performance'])->random(),
                    'title' => "Load Test Alert #{$i}",
                    'message' => "This is load test message #{$i} to verify WebSocket handles multiple concurrent messages.",
                    'timestamp' => now()->toISOString(),
                    'priority' => collect(['low', 'medium', 'high'])->random(),
                    'resolved' => false,
                    'source' => 'load_test',
                    'actionRequired' => rand(0, 1) === 1,
                    'autoResolve' => true,
                    'escalationLevel' => 0,
                    'metadata' => [
                        'test' => true,
                        'load_test' => true,
                        'sequence' => $i,
                        'total' => $count
                    ]
                ];

                if ($alertData['category'] === 'health') {
                    broadcast(new HealthRiskAlert($alertData));
                } else {
                    broadcast(new SystemAlert($alertData));
                }

                $alerts[] = $alertData['id'];
                
                // Small delay between broadcasts
                usleep(100000); // 100ms
            }

            Log::info('WebSocket load test completed', [
                'count' => $count,
                'alert_ids' => $alerts
            ]);

            return response()->json([
                'success' => true,
                'message' => "Successfully broadcast {$count} test alerts",
                'count' => $count,
                'alert_ids' => $alerts
            ]);
        } catch (\Exception $e) {
            Log::error('WebSocket load test failed', [
                'error' => $e->getMessage(),
                'count' => $count
            ]);

            return response()->json([
                'success' => false,
                'message' => 'WebSocket load test failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get WebSocket server status and configuration
     */
    public function status(): JsonResponse
    {
        return response()->json([
            'websocket' => [
                'driver' => config('broadcasting.default'),
                'enabled' => config('broadcasting.default') === 'reverb',
                'reverb' => [
                    'host' => config('reverb.servers.reverb.host', 'localhost'),
                    'port' => config('reverb.servers.reverb.port', 8080),
                    'app_id' => config('reverb.apps.0.id'),
                    'app_key' => config('reverb.apps.0.key'),
                    'allowed_origins' => config('reverb.servers.reverb.options.allowed_origins', []),
                ],
                'pusher_compatibility' => [
                    'app_id' => config('broadcasting.connections.pusher.app_id'),
                    'key' => config('broadcasting.connections.pusher.key'),
                    'host' => config('broadcasting.connections.pusher.options.host'),
                    'port' => config('broadcasting.connections.pusher.options.port'),
                    'scheme' => config('broadcasting.connections.pusher.options.scheme'),
                ]
            ],
            'channels' => [
                'public' => [
                    'public.alerts',
                    'public.system'
                ],
                'private' => [
                    'private-admin.alerts',
                    'private-admin.system',
                    'private-admin.security',
                    'private-admin.performance',
                    'private-admin.compliance',
                    'private-health.alerts'
                ]
            ],
            'events' => [
                'health.risk.alert',
                'system.alert'
            ],
            'server_time' => now()->toISOString(),
            'environment' => config('app.env')
        ]);
    }
}