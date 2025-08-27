<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Cache;
use App\Helpers\RequestHelper;

class TestController extends Controller
{
    public function test()
    {
        return response()->json([
            'status' => 'success',
            'message' => 'API is working',
            'timestamp' => now()
        ]);
    }
    
    /**
     * Test stateless cache functionality (replaces session tests)
     */
    public function testStatelessCache(Request $request)
    {
        try {
            // Test Redis connection for cache
            $redisConnection = Redis::connection('cache');
            $redisConnection->ping();
            
            // Test cache storage (stateless approach)
            $cacheKey = 'test_cache_' . time();
            $testData = [
                'user_id' => 123,
                'test_data' => 'Stateless cache test',
                'request_id' => RequestHelper::generateRequestId($request),
                'timestamp' => now()->toISOString()
            ];
            
            // Store data in cache
            Cache::put($cacheKey, $testData, 300); // 5 minutes
            
            // Retrieve cache data
            $retrievedData = Cache::get($cacheKey);
            
            // Check if data matches
            $isWorking = $retrievedData === $testData;
            
            // Test request helper functionality
            $requestId = RequestHelper::generateRequestId($request);
            $trackingId = RequestHelper::generateTrackingId();
            $fingerprint = RequestHelper::getClientFingerprint($request);
            
            return response()->json([
                'status' => 'success',
                'message' => 'Stateless cache test completed',
                'results' => [
                    'redis_connection' => 'connected',
                    'cache_driver' => config('cache.default'),
                    'cache_connection' => config('cache.stores.redis.connection'),
                    'redis_database' => config('database.redis.cache.database'),
                    'cache_key' => $cacheKey,
                    'cache_working' => $isWorking,
                    'stored_data' => $testData,
                    'retrieved_data' => $retrievedData,
                    'request_helpers' => [
                        'request_id' => $requestId,
                        'tracking_id' => $trackingId,
                        'client_fingerprint' => substr($fingerprint, 0, 16) . '...',
                        'has_valid_request_id' => RequestHelper::hasValidRequestId($request)
                    ]
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Stateless cache test failed',
                'error' => $e->getMessage(),
                'config' => [
                    'cache_driver' => config('cache.default'),
                    'cache_connection' => config('cache.stores.redis.connection')
                ]
            ], 500);
        }
    }
    
    /**
     * Test Redis connection and configuration
     */
    public function testRedisConfig()
    {
        try {
            $connections = [];
            
            // Test all Redis connections (focus on cache instead of session)
            foreach (['default', 'cache'] as $connection) {
                try {
                    $redis = Redis::connection($connection);
                    $redis->ping();
                    $connections[$connection] = [
                        'status' => 'connected',
                        'host' => config("database.redis.{$connection}.host"),
                        'port' => config("database.redis.{$connection}.port"),
                        'database' => config("database.redis.{$connection}.database")
                    ];
                } catch (\Exception $e) {
                    $connections[$connection] = [
                        'status' => 'failed',
                        'error' => $e->getMessage()
                    ];
                }
            }
            
            return response()->json([
                'status' => 'success',
                'message' => 'Redis configuration test completed',
                'connections' => $connections,
                'cache_config' => [
                    'driver' => config('cache.default'),
                    'connection' => config('cache.stores.redis.connection'),
                    'prefix' => config('cache.prefix'),
                    'serialization' => config('cache.stores.redis.options.serializer')
                ],
                'api_mode' => [
                    'stateless' => true,
                    'session_dependency' => 'removed',
                    'authentication' => 'token_based'
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Redis configuration test failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Test stateless security features
     */
    public function testStatelessSecurity(Request $request)
    {
        try {
            // Test request helper functions
            $requestId = RequestHelper::generateRequestId($request);
            $trackingId = RequestHelper::generateTrackingId();
            $fingerprint = RequestHelper::getClientFingerprint($request);
            $operationId = RequestHelper::getOperationId(123, 'test_security');

            // Test rate limiting mechanism
            $rateLimitKey = "test_rate_limit:" . $fingerprint;
            $currentCount = Cache::get($rateLimitKey, 0);
            Cache::put($rateLimitKey, $currentCount + 1, 60);

            return response()->json([
                'status' => 'success',
                'message' => 'Stateless security test completed',
                'security_features' => [
                    'request_id' => $requestId,
                    'tracking_id' => $trackingId,
                    'client_fingerprint' => substr($fingerprint, 0, 16) . '...',
                    'operation_id' => $operationId,
                    'rate_limit_key' => $rateLimitKey,
                    'rate_limit_count' => $currentCount + 1,
                    'request_validation' => RequestHelper::hasValidRequestId($request)
                ],
                'request_info' => [
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'method' => $request->method(),
                    'path' => $request->path(),
                    'headers_count' => count($request->headers->all())
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Stateless security test failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}