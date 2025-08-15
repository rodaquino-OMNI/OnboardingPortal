<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Session;

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
     * Test Redis session functionality
     */
    public function testRedisSession(Request $request)
    {
        try {
            // Test Redis connection
            $redisConnection = Redis::connection('session');
            $redisConnection->ping();
            
            // Test session storage
            $sessionKey = 'test_session_' . time();
            $sessionData = [
                'user_id' => 123,
                'test_data' => 'Redis session test',
                'timestamp' => now()->toISOString()
            ];
            
            // Store session data
            Session::put($sessionKey, $sessionData);
            
            // Retrieve session data
            $retrievedData = Session::get($sessionKey);
            
            // Check if data matches
            $isWorking = $retrievedData === $sessionData;
            
            // Get session ID and Redis key info
            $sessionId = Session::getId();
            $redisKey = config('session.connection') . ':' . $sessionId;
            
            return response()->json([
                'status' => 'success',
                'message' => 'Redis session test completed',
                'results' => [
                    'redis_connection' => 'connected',
                    'session_driver' => config('session.driver'),
                    'session_connection' => config('session.connection'),
                    'redis_database' => config('database.redis.session.database'),
                    'session_id' => $sessionId,
                    'redis_key_pattern' => $redisKey,
                    'session_working' => $isWorking,
                    'stored_data' => $sessionData,
                    'retrieved_data' => $retrievedData
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Redis session test failed',
                'error' => $e->getMessage(),
                'config' => [
                    'session_driver' => config('session.driver'),
                    'session_connection' => config('session.connection'),
                    'redis_host' => config('database.redis.session.host'),
                    'redis_port' => config('database.redis.session.port'),
                    'redis_database' => config('database.redis.session.database')
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
            
            // Test all Redis connections
            foreach (['default', 'cache', 'session'] as $connection) {
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
                'session_config' => [
                    'driver' => config('session.driver'),
                    'connection' => config('session.connection'),
                    'lifetime' => config('session.lifetime'),
                    'encrypt' => config('session.encrypt')
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
}
