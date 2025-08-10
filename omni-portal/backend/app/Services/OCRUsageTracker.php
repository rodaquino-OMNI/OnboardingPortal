<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class OCRUsageTracker
{
    protected $config;
    protected $cachePrefix = 'ocr_usage';

    public function __construct()
    {
        $this->config = Config::get('ocr.monitoring', [
            'enabled' => true,
            'daily_budget' => 100.0,
            'monthly_budget' => 2000.0,
            'alert_threshold' => 80
        ]);
    }

    /**
     * Record OCR service usage
     */
    public function recordUsage(string $service, int $pages = 1): void
    {
        $today = now()->format('Y-m-d');
        $month = now()->format('Y-m');
        
        // Daily usage
        $dailyKey = $this->cachePrefix . '_' . $service . '_daily_' . $today;
        $dailyUsage = Cache::get($dailyKey, 0);
        Cache::put($dailyKey, $dailyUsage + $pages, now()->endOfDay());
        
        // Monthly usage
        $monthlyKey = $this->cachePrefix . '_' . $service . '_monthly_' . $month;
        $monthlyUsage = Cache::get($monthlyKey, 0);
        Cache::put($monthlyKey, $monthlyUsage + $pages, now()->endOfMonth());
        
        Log::info("OCR usage recorded", [
            'service' => $service,
            'pages' => $pages,
            'daily_total' => $dailyUsage + $pages,
            'monthly_total' => $monthlyUsage + $pages
        ]);
    }
    
    /**
     * Get current usage statistics
     */
    public function getUsageStats(string $service): array
    {
        $today = now()->format('Y-m-d');
        $month = now()->format('Y-m');
        
        $dailyKey = $this->cachePrefix . '_' . $service . '_daily_' . $today;
        $monthlyKey = $this->cachePrefix . '_' . $service . '_monthly_' . $month;
        
        return [
            'daily' => Cache::get($dailyKey, 0),
            'monthly' => Cache::get($monthlyKey, 0),
            'date' => $today,
            'month' => $month
        ];
    }
    
    /**
     * Check if service is within usage limits
     */
    public function isWithinLimits(string $service): bool
    {
        $stats = $this->getUsageStats($service);
        $limits = config('ocr.usage_limits.' . $service, []);
        
        if (isset($limits['daily']) && $stats['daily'] >= $limits['daily']) {
            return false;
        }
        
        if (isset($limits['monthly']) && $stats['monthly'] >= $limits['monthly']) {
            return false;
        }
        
        return true;
    }

    /**
     * Get daily usage for specific service
     */
    public function getDailyUsage(string $service = 'all'): float
    {
        $today = now()->format('Y-m-d');
        
        if ($service === 'all') {
            $total = 0.0;
            $services = ['textract', 'tesseract'];
            foreach ($services as $svc) {
                $key = $this->cachePrefix . '_' . $svc . '_daily_' . $today;
                $total += Cache::get($key, 0);
            }
            return $total;
        }
        
        $key = $this->cachePrefix . '_' . $service . '_daily_' . $today;
        return Cache::get($key, 0);
    }

    /**
     * Get monthly usage for specific service
     */
    public function getMonthlyUsage(string $service = 'all'): float
    {
        $currentMonth = now()->format('Y-m');
        
        if ($service === 'all') {
            $total = 0.0;
            $services = ['textract', 'tesseract'];
            foreach ($services as $svc) {
                $key = $this->cachePrefix . '_' . $svc . '_monthly_' . $currentMonth;
                $total += Cache::get($key, 0);
            }
            return $total;
        }
        
        $key = $this->cachePrefix . '_' . $service . '_monthly_' . $currentMonth;
        return Cache::get($key, 0);
    }
}