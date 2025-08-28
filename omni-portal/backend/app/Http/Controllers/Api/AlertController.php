<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\HealthRiskAlert;
use App\Events\SystemAlert;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class AlertController extends Controller
{
    /**
     * Test endpoint to broadcast health risk alerts
     */
    public function broadcastHealthAlert(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:critical,warning,info,success',
            'category' => 'required|in:health,security,system,compliance,performance',
            'title' => 'required|string|max:255',
            'message' => 'required|string|max:1000',
            'priority' => 'required|in:low,medium,high,critical',
            'source' => 'string|max:255',
            'actionRequired' => 'boolean',
            'autoResolve' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $alertData = [
            'id' => 'alert_' . time() . '_' . substr(md5(uniqid()), 0, 8),
            'type' => $request->input('type'),
            'category' => $request->input('category'),
            'title' => $request->input('title'),
            'message' => $request->input('message'),
            'timestamp' => now()->toISOString(),
            'priority' => $request->input('priority'),
            'resolved' => false,
            'source' => $request->input('source', 'api'),
            'actionRequired' => $request->boolean('actionRequired', false),
            'autoResolve' => $request->boolean('autoResolve', false),
            'escalationLevel' => 0,
            'metadata' => [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'environment' => config('app.env'),
                'created_via' => 'api'
            ]
        ];

        try {
            // Broadcast the alert
            if ($alertData['category'] === 'health') {
                broadcast(new HealthRiskAlert($alertData));
            } else {
                broadcast(new SystemAlert($alertData));
            }

            Log::info('Alert broadcasted successfully', ['alert_id' => $alertData['id']]);

            return response()->json([
                'success' => true,
                'message' => 'Alert broadcasted successfully',
                'alert_id' => $alertData['id'],
                'data' => $alertData
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to broadcast alert', [
                'error' => $e->getMessage(),
                'alert_data' => $alertData
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to broadcast alert',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate and broadcast a sample alert for testing
     */
    public function generateSampleAlert(): JsonResponse
    {
        $categories = ['health', 'security', 'system', 'compliance', 'performance'];
        $types = ['critical', 'warning', 'info'];
        $priorities = ['low', 'medium', 'high', 'critical'];
        
        $category = $categories[array_rand($categories)];
        $type = $types[array_rand($types)];
        $priority = $priorities[array_rand($priorities)];
        
        $messages = [
            'health' => [
                'High-risk patient detected in questionnaire responses',
                'Unusual health pattern identified requiring review',
                'Mental health screening flagged for immediate attention',
                'Chronic condition progression detected in patient data'
            ],
            'security' => [
                'Multiple failed login attempts detected',
                'Suspicious activity from unusual IP address',
                'Potential data breach attempt blocked',
                'Unauthorized access attempt to admin panel'
            ],
            'system' => [
                'Database performance degradation detected',
                'High memory usage on application server',
                'API response times exceeding threshold',
                'Backup process completed with warnings'
            ],
            'compliance' => [
                'LGPD consent expiration approaching for users',
                'Audit trail discrepancy detected',
                'Data retention policy violation flagged',
                'Privacy policy acceptance required for users'
            ],
            'performance' => [
                'System response time exceeding SLA thresholds',
                'High CPU utilization on web servers',
                'Database connection pool nearly exhausted',
                'CDN performance degradation detected'
            ]
        ];

        $categoryMessages = $messages[$category];
        $message = $categoryMessages[array_rand($categoryMessages)];

        $alertData = [
            'id' => 'sample_alert_' . time() . '_' . substr(md5(uniqid()), 0, 8),
            'type' => $type,
            'category' => $category,
            'title' => ucfirst($category) . ' Alert',
            'message' => $message,
            'timestamp' => now()->toISOString(),
            'priority' => $priority,
            'resolved' => false,
            'source' => 'sample_generator',
            'actionRequired' => $type === 'critical' || $priority === 'critical',
            'autoResolve' => $type === 'info',
            'escalationLevel' => 0,
            'metadata' => [
                'generated' => true,
                'environment' => config('app.env'),
                'sample' => true
            ]
        ];

        try {
            if ($category === 'health') {
                broadcast(new HealthRiskAlert($alertData));
            } else {
                broadcast(new SystemAlert($alertData));
            }

            return response()->json([
                'success' => true,
                'message' => 'Sample alert generated and broadcasted',
                'alert_id' => $alertData['id'],
                'data' => $alertData
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to generate sample alert', [
                'error' => $e->getMessage(),
                'alert_data' => $alertData
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to generate sample alert',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get WebSocket connection info
     */
    public function connectionInfo(): JsonResponse
    {
        return response()->json([
            'websocket' => [
                'enabled' => config('broadcasting.default') === 'reverb',
                'host' => config('reverb.servers.reverb.host'),
                'port' => config('reverb.servers.reverb.port'),
                'scheme' => config('reverb.servers.reverb.options.scheme'),
                'app_key' => config('reverb.apps.0.key'),
                'app_id' => config('reverb.apps.0.id'),
            ],
            'channels' => [
                'health_alerts' => 'private-health.alerts',
                'admin_alerts' => 'private-admin.alerts',
                'system_alerts' => 'private-admin.system',
                'public_demo' => 'public.alerts'
            ]
        ]);
    }
}