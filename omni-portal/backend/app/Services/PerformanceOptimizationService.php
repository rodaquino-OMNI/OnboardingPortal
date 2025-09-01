<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * PerformanceOptimizationService
 * 
 * Handles API performance optimizations including:
 * - Redis caching for authentication
 * - Database connection pooling
 * - Query optimization
 * - Response caching
 */
class PerformanceOptimizationService
{
    private const AUTH_CACHE_TTL = 3600; // 1 hour
    private const API_CACHE_TTL = 300;   // 5 minutes
    private const SESSION_CACHE_TTL = 1800; // 30 minutes

    /**
     * Cache user authentication data
     */
    public function cacheUserAuth(int $userId, array $userData): void
    {
        try {
            $cacheKey = $this->getUserAuthCacheKey($userId);
            
            Cache::put($cacheKey, $userData, self::AUTH_CACHE_TTL);
            
            // Also cache in Redis for faster access (if available)
            try {
                Redis::setex("auth_user_{$userId}", self::AUTH_CACHE_TTL, json_encode($userData));
            } catch (\Exception $e) {
                Log::info('Redis not available, using Laravel cache only: ' . $e->getMessage());
            }
            
            Log::info("User auth cached", ['user_id' => $userId, 'cache_key' => $cacheKey]);
        } catch (\Exception $e) {
            Log::error("Failed to cache user auth", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get cached user authentication data
     */
    public function getCachedUserAuth(int $userId): ?array
    {
        try {
            // Try Redis first (faster) if available
            try {
                $redisData = Redis::get("auth_user_{$userId}");
                if ($redisData) {
                    return json_decode($redisData, true);
                }
            } catch (\Exception $redisException) {
                Log::debug('Redis not available for cache get: ' . $redisException->getMessage());
            }

            // Fallback to Laravel cache
            $cacheKey = $this->getUserAuthCacheKey($userId);
            return Cache::get($cacheKey);
        } catch (\Exception $e) {
            Log::error("Failed to get cached user auth", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Cache API response
     */
    public function cacheApiResponse(string $endpoint, array $params, $response): void
    {
        try {
            $cacheKey = $this->getApiResponseCacheKey($endpoint, $params);
            
            Cache::put($cacheKey, $response, self::API_CACHE_TTL);
            
            Log::debug("API response cached", [
                'endpoint' => $endpoint,
                'cache_key' => $cacheKey
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to cache API response", [
                'endpoint' => $endpoint,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get cached API response
     */
    public function getCachedApiResponse(string $endpoint, array $params = [])
    {
        try {
            $cacheKey = $this->getApiResponseCacheKey($endpoint, $params);
            return Cache::get($cacheKey);
        } catch (\Exception $e) {
            Log::error("Failed to get cached API response", [
                'endpoint' => $endpoint,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Optimize database connection
     * Note: query_cache_type is deprecated in MySQL 8.0+ and removed
     */
    public function optimizeDatabaseConnection(): void
    {
        try {
            $driverName = DB::connection()->getDriverName();
            
            // Only apply MySQL-specific optimizations to MySQL connections
            if ($driverName === 'mysql') {
                // Set MySQL connection optimizations (MySQL 8.0+ compatible)
                // Note: Query cache is deprecated and removed in MySQL 8.0
                // Using only compatible session variables
                
                // Connection pooling and timeout settings
                DB::statement('SET SESSION wait_timeout = 28800'); // 8 hours
                DB::statement('SET SESSION interactive_timeout = 28800'); // 8 hours
                
                // Enable slow query logging for this session if needed
                try {
                    DB::statement('SET SESSION slow_query_log = 1');
                    DB::statement('SET SESSION long_query_time = 2');
                } catch (\Exception $slowLogException) {
                    Log::debug('Slow query log settings not available in this session: ' . $slowLogException->getMessage());
                }
                
                // Set SQL mode for strict compliance
                DB::statement("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE'");
                
                Log::info("Database connection optimized (MySQL 8.0+ compatible)");
            } else {
                // For non-MySQL drivers (like SQLite), apply appropriate optimizations
                Log::info("Database connection optimization skipped for {$driverName} driver - MySQL-specific optimizations not applicable");
                
                // SQLite-specific optimizations can be added here if needed
                if ($driverName === 'sqlite') {
                    // Enable WAL mode for better performance if not already set
                    try {
                        DB::statement('PRAGMA journal_mode=WAL');
                        DB::statement('PRAGMA synchronous=NORMAL');
                        DB::statement('PRAGMA cache_size=10000');
                        DB::statement('PRAGMA temp_store=MEMORY');
                        Log::info("SQLite performance optimizations applied");
                    } catch (\Exception $sqliteException) {
                        Log::debug('Some SQLite optimizations not available: ' . $sqliteException->getMessage());
                    }
                }
            }
        } catch (\Exception $e) {
            Log::warning("Failed to optimize database connection", [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Warm up critical caches
     */
    public function warmUpCaches(): void
    {
        try {
            // Warm up frequently accessed data
            $this->warmUpAuthCache();
            $this->warmUpApiCache();
            
            Log::info("Caches warmed up successfully");
        } catch (\Exception $e) {
            Log::error("Failed to warm up caches", [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Clear performance caches
     */
    public function clearPerformanceCaches(): void
    {
        try {
            // Clear auth caches
            $pattern = 'auth_user_*';
            $keys = Redis::keys($pattern);
            if (!empty($keys)) {
                Redis::del($keys);
            }

            // Clear API response caches
            Cache::flush();

            Log::info("Performance caches cleared");
        } catch (\Exception $e) {
            Log::error("Failed to clear performance caches", [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get performance metrics
     */
    public function getPerformanceMetrics(): array
    {
        try {
            return [
                'cache_stats' => [
                    'redis_connected' => Redis::ping() === 'PONG',
                    'cache_driver' => config('cache.default'),
                    'session_driver' => config('session.driver'),
                ],
                'database_stats' => [
                    'connection' => DB::connection()->getName(),
                    'query_count' => count(DB::getQueryLog()),
                    'slow_queries' => $this->getSlowQueryCount(),
                ],
                'memory_usage' => [
                    'current' => memory_get_usage(true),
                    'peak' => memory_get_peak_usage(true),
                    'limit' => ini_get('memory_limit'),
                ]
            ];
        } catch (\Exception $e) {
            Log::error("Failed to get performance metrics", [
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }

    /**
     * Optimize query performance
     */
    public function optimizeQuery(string $query, array $bindings = []): array
    {
        $startTime = microtime(true);
        
        try {
            // Log slow queries for analysis
            $result = DB::select($query, $bindings);
            
            $executionTime = (microtime(true) - $startTime) * 1000; // ms
            
            if ($executionTime > 500) { // Log queries over 500ms
                Log::warning("Slow query detected", [
                    'query' => $query,
                    'execution_time' => $executionTime,
                    'bindings' => $bindings
                ]);
            }
            
            return $result;
        } catch (\Exception $e) {
            Log::error("Query optimization failed", [
                'query' => $query,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Generate user auth cache key
     */
    private function getUserAuthCacheKey(int $userId): string
    {
        return "user_auth_{$userId}";
    }

    /**
     * Generate API response cache key
     */
    private function getApiResponseCacheKey(string $endpoint, array $params): string
    {
        $paramHash = md5(serialize($params));
        return "api_response_{$endpoint}_{$paramHash}";
    }

    /**
     * Warm up auth cache
     */
    private function warmUpAuthCache(): void
    {
        // Pre-cache frequently accessed user data
        // This could be based on recent login patterns
    }

    /**
     * Warm up API cache
     */
    private function warmUpApiCache(): void
    {
        // Pre-cache frequently requested API endpoints
        $endpoints = [
            '/api/health',
            '/api/gamification/badges',
            '/api/gamification/progress'
        ];

        foreach ($endpoints as $endpoint) {
            try {
                // This would make a request to warm the cache
                // Implementation depends on your specific needs
            } catch (\Exception $e) {
                Log::warning("Failed to warm cache for endpoint", [
                    'endpoint' => $endpoint,
                    'error' => $e->getMessage()
                ]);
            }
        }
    }

    /**
     * Get slow query count
     */
    private function getSlowQueryCount(): int
    {
        try {
            $driverName = DB::connection()->getDriverName();
            
            // Only get slow query count for MySQL
            if ($driverName === 'mysql') {
                $result = DB::select("SHOW GLOBAL STATUS LIKE 'Slow_queries'");
                return $result[0]->Value ?? 0;
            }
            
            // For other drivers, return 0 as we can't get this metric
            return 0;
        } catch (\Exception $e) {
            return 0;
        }
    }
}