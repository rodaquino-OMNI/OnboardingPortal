<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class DatabaseCacheService
{
    private const DEFAULT_TTL = 300; // 5 minutes
    private const HEAVY_QUERY_TTL = 1800; // 30 minutes
    private const DASHBOARD_TTL = 60; // 1 minute for real-time dashboards
    
    /**
     * Cache a database query result with intelligent TTL
     */
    public function cacheQuery(string $cacheKey, \Closure $query, ?int $ttl = null): mixed
    {
        $ttl = $ttl ?? self::DEFAULT_TTL;
        
        return Cache::remember($cacheKey, $ttl, function() use ($query, $cacheKey) {
            $startTime = microtime(true);
            $result = $query();
            $executionTime = round((microtime(true) - $startTime) * 1000, 2);
            
            // Log slow queries for monitoring
            if ($executionTime > 1000) { // Queries taking more than 1 second
                Log::warning('Slow query cached', [
                    'cache_key' => $cacheKey,
                    'execution_time_ms' => $executionTime,
                    'timestamp' => now()->toISOString()
                ]);
            }
            
            return $result;
        });
    }

    /**
     * Cache health questionnaire dashboard data
     */
    public function getHealthDashboardData(int $userId = null, int $days = 30): array
    {
        $cacheKey = "health_dashboard_" . ($userId ?? 'all') . "_{$days}d_" . now()->format('Y-m-d-H');
        
        return $this->cacheQuery($cacheKey, function() use ($userId, $days) {
            $query = DB::table('health_questionnaires as hq')
                ->join('beneficiaries as b', 'hq.beneficiary_id', '=', 'b.id')
                ->join('users as u', 'b.user_id', '=', 'u.id')
                ->select([
                    'hq.id',
                    'hq.status',
                    'hq.created_at',
                    'hq.severity_level',
                    'hq.emergency_detected',
                    'b.id as beneficiary_id',
                    'b.email as beneficiary_email',
                    'u.name as beneficiary_name',
                    'hq.template_id'
                ])
                ->where('hq.created_at', '>=', Carbon::now()->subDays($days))
                ->whereIn('hq.status', ['completed', 'reviewed']);
                
            if ($userId) {
                $query->where('u.id', $userId);
            }
            
            return $query->orderBy('hq.created_at', 'desc')
                        ->orderBy('hq.severity_level', 'desc')
                        ->limit(100)
                        ->get();
        }, self::DASHBOARD_TTL);
    }

    /**
     * Cache health questionnaire statistics
     */
    public function getHealthStatistics(int $days = 30): array
    {
        $cacheKey = "health_statistics_{$days}d_" . now()->format('Y-m-d-H');
        
        return $this->cacheQuery($cacheKey, function() use ($days) {
            $cutoffDate = Carbon::now()->subDays($days);
            
            return [
                'total_questionnaires' => DB::table('health_questionnaires')
                    ->where('created_at', '>=', $cutoffDate)
                    ->count(),
                    
                'completed_questionnaires' => DB::table('health_questionnaires')
                    ->where('created_at', '>=', $cutoffDate)
                    ->where('status', 'completed')
                    ->count(),
                    
                'high_risk_count' => DB::table('health_questionnaires')
                    ->where('created_at', '>=', $cutoffDate)
                    ->where('severity_level', 'high')
                    ->count(),
                    
                'emergency_detected_count' => DB::table('health_questionnaires')
                    ->where('created_at', '>=', $cutoffDate)
                    ->where('emergency_detected', true)
                    ->count(),
                    
                'completion_rate' => DB::select("
                    SELECT ROUND(
                        (COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0) / COUNT(*), 2
                    ) as rate
                    FROM health_questionnaires 
                    WHERE created_at >= ?
                ", [$cutoffDate])[0]->rate ?? 0,
                
                'by_template' => DB::table('health_questionnaires as hq')
                    ->join('questionnaire_templates as qt', 'hq.template_id', '=', 'qt.id')
                    ->select([
                        'qt.name as template_name',
                        DB::raw('COUNT(*) as total'),
                        DB::raw("COUNT(CASE WHEN hq.status = 'completed' THEN 1 END) as completed")
                    ])
                    ->where('hq.created_at', '>=', $cutoffDate)
                    ->groupBy('qt.id', 'qt.name')
                    ->get(),
                    
                'daily_trend' => DB::select("
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                        COUNT(CASE WHEN severity_level = 'high' THEN 1 END) as high_risk
                    FROM health_questionnaires 
                    WHERE created_at >= ?
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                    LIMIT 30
                ", [$cutoffDate])
            ];
        }, self::HEAVY_QUERY_TTL);
    }

    /**
     * Cache user activity summary
     */
    public function getUserActivitySummary(int $userId, int $days = 30): array
    {
        $cacheKey = "user_activity_{$userId}_{$days}d_" . now()->format('Y-m-d');
        
        return $this->cacheQuery($cacheKey, function() use ($userId, $days) {
            $cutoffDate = Carbon::now()->subDays($days);
            
            return [
                'questionnaires' => DB::table('health_questionnaires as hq')
                    ->join('beneficiaries as b', 'hq.beneficiary_id', '=', 'b.id')
                    ->where('b.user_id', $userId)
                    ->where('hq.created_at', '>=', $cutoffDate)
                    ->selectRaw('
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = "completed" THEN 1 END) as completed,
                        MAX(created_at) as last_activity
                    ')
                    ->first(),
                    
                'documents' => DB::table('documents')
                    ->where('user_id', $userId)
                    ->where('created_at', '>=', $cutoffDate)
                    ->selectRaw('
                        COUNT(*) as total,
                        COUNT(CASE WHEN ocr_status = "completed" THEN 1 END) as processed,
                        MAX(created_at) as last_upload
                    ')
                    ->first(),
                    
                'gamification' => DB::table('gamification_progress as gp')
                    ->join('beneficiaries as b', 'gp.beneficiary_id', '=', 'b.id')
                    ->where('b.user_id', $userId)
                    ->select(['gp.level', 'gp.points', 'gp.updated_at'])
                    ->orderBy('gp.updated_at', 'desc')
                    ->first()
            ];
        }, self::HEAVY_QUERY_TTL);
    }

    /**
     * Cache OCR usage analytics
     */
    public function getOCRUsageAnalytics(int $days = 7): array
    {
        $cacheKey = "ocr_usage_{$days}d_" . now()->format('Y-m-d-H');
        
        return $this->cacheQuery($cacheKey, function() use ($days) {
            $cutoffDate = Carbon::now()->subDays($days);
            
            return [
                'total_requests' => DB::table('ocr_usage_logs')
                    ->where('created_at', '>=', $cutoffDate)
                    ->count(),
                    
                'total_cost' => DB::table('ocr_usage_logs')
                    ->where('created_at', '>=', $cutoffDate)
                    ->sum('cost_usd'),
                    
                'by_user' => DB::table('ocr_usage_logs as oul')
                    ->join('users as u', 'oul.user_id', '=', 'u.id')
                    ->select([
                        'u.name',
                        'u.email',
                        DB::raw('COUNT(*) as requests'),
                        DB::raw('SUM(cost_usd) as total_cost')
                    ])
                    ->where('oul.created_at', '>=', $cutoffDate)
                    ->groupBy('u.id', 'u.name', 'u.email')
                    ->orderBy('requests', 'desc')
                    ->limit(20)
                    ->get(),
                    
                'daily_usage' => DB::select("
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as requests,
                        SUM(cost_usd) as cost,
                        AVG(processing_time) as avg_processing_time
                    FROM ocr_usage_logs 
                    WHERE created_at >= ?
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                ", [$cutoffDate])
            ];
        }, self::DASHBOARD_TTL);
    }

    /**
     * Cache interview scheduling data
     */
    public function getInterviewSchedulingData(int $days = 14): array
    {
        $cacheKey = "interview_scheduling_{$days}d_" . now()->format('Y-m-d');
        
        return $this->cacheQuery($cacheKey, function() use ($days) {
            $futureDate = Carbon::now()->addDays($days);
            
            return [
                'upcoming_slots' => DB::table('interview_slots')
                    ->where('scheduled_at', '>=', now())
                    ->where('scheduled_at', '<=', $futureDate)
                    ->where('is_available', true)
                    ->orderBy('scheduled_at')
                    ->limit(50)
                    ->get(),
                    
                'booked_interviews' => DB::table('interviews as i')
                    ->join('interview_slots as s', 'i.interview_slot_id', '=', 's.id')
                    ->join('beneficiaries as b', 'i.beneficiary_id', '=', 'b.id')
                    ->join('users as u', 'b.user_id', '=', 'u.id')
                    ->select([
                        'i.id',
                        's.scheduled_at',
                        'u.name as beneficiary_name',
                        'b.email as beneficiary_email',
                        'i.status'
                    ])
                    ->where('s.scheduled_at', '>=', now())
                    ->where('s.scheduled_at', '<=', $futureDate)
                    ->orderBy('s.scheduled_at')
                    ->get(),
                    
                'utilization_stats' => DB::select("
                    SELECT 
                        DATE(scheduled_at) as date,
                        COUNT(*) as total_slots,
                        COUNT(CASE WHEN is_available = false THEN 1 END) as booked_slots,
                        ROUND(
                            (COUNT(CASE WHEN is_available = false THEN 1 END) * 100.0) / COUNT(*), 2
                        ) as utilization_rate
                    FROM interview_slots 
                    WHERE scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
                    GROUP BY DATE(scheduled_at)
                    ORDER BY date
                ", [$days])
            ];
        }, self::HEAVY_QUERY_TTL);
    }

    /**
     * Invalidate related cache entries
     */
    public function invalidateHealthCache(int $userId = null): void
    {
        $patterns = [
            'health_dashboard_*',
            'health_statistics_*',
            'user_activity_*'
        ];
        
        if ($userId) {
            $patterns[] = "user_activity_{$userId}_*";
        }
        
        foreach ($patterns as $pattern) {
            Cache::forget($pattern);
        }
    }

    /**
     * Get cache performance metrics
     */
    public function getCacheMetrics(): array
    {
        // This would require Redis INFO commands or cache driver specific metrics
        return [
            'hit_ratio' => $this->getCacheHitRatio(),
            'memory_usage' => $this->getCacheMemoryUsage(),
            'key_count' => $this->getCacheKeyCount(),
            'evictions' => $this->getCacheEvictions()
        ];
    }

    private function getCacheHitRatio(): float
    {
        // Implementation depends on cache driver
        // For Redis, you would use Redis::info() to get hit/miss stats
        return 0.0; // Placeholder
    }

    private function getCacheMemoryUsage(): string
    {
        // Implementation depends on cache driver
        return '0MB'; // Placeholder
    }

    private function getCacheKeyCount(): int
    {
        // Implementation depends on cache driver
        return 0; // Placeholder
    }

    private function getCacheEvictions(): int
    {
        // Implementation depends on cache driver
        return 0; // Placeholder
    }

    /**
     * Warm up critical caches
     */
    public function warmUpCache(): array
    {
        $warmedUp = [];
        
        // Warm up dashboard data
        $warmedUp['health_dashboard'] = $this->getHealthDashboardData();
        $warmedUp['health_statistics'] = $this->getHealthStatistics();
        $warmedUp['ocr_analytics'] = $this->getOCRUsageAnalytics();
        $warmedUp['interview_scheduling'] = $this->getInterviewSchedulingData();
        
        return [
            'success' => true,
            'warmed_caches' => count($warmedUp),
            'cache_keys' => array_keys($warmedUp),
            'timestamp' => now()->toISOString()
        ];
    }
}