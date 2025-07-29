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
        $this->config = Config::get('ocr.monitoring');
    }

    /**
     * Check if we can process a document within budget limits
     */
    public function canProcessDocument(): bool
    {
        if (!$this->config['enabled']) {
            return true;
        }

        $dailyUsage = $this->getDailyUsage();
        $monthlyUsage = $this->getMonthlyUsage();

        $dailyBudget = $this->config['daily_budget'];
        $monthlyBudget = $this->config['monthly_budget'];

        // Check if we're within budget limits
        $canProcess = ($dailyUsage < $dailyBudget) && ($monthlyUsage < $monthlyBudget);

        if (!$canProcess) {
            Log::warning('OCR processing blocked by budget limits', [
                'daily_usage' => $dailyUsage,
                'daily_budget' => $dailyBudget,
                'monthly_usage' => $monthlyUsage,
                'monthly_budget' => $monthlyBudget
            ]);

            // Send alert if near threshold
            $this->checkAndSendAlerts($dailyUsage, $monthlyUsage);
        }

        return $canProcess;
    }

    /**
     * Record OCR usage
     */
    public function recordUsage(string $provider, $pagesOrData = 1, float $cost = null): void
    {
        if (!$this->config['enabled']) {
            return;
        }

        // Handle both old format (int pages) and new format (array data)
        $pages = is_array($pagesOrData) ? ($pagesOrData['pages_processed'] ?? 1) : $pagesOrData;
        $additionalData = is_array($pagesOrData) ? $pagesOrData : [];

        // Calculate cost if not provided
        if ($cost === null) {
            $cost = $this->calculateCost($provider, $pages);
        }

        $today = now()->format('Y-m-d');
        $currentMonth = now()->format('Y-m');

        // Update daily usage
        $dailyKey = "{$this->cachePrefix}:daily:{$today}";
        $dailyUsage = Cache::get($dailyKey, 0);
        Cache::put($dailyKey, $dailyUsage + $cost, now()->endOfDay());

        // Update monthly usage
        $monthlyKey = "{$this->cachePrefix}:monthly:{$currentMonth}";
        $monthlyUsage = Cache::get($monthlyKey, 0);
        Cache::put($monthlyKey, $monthlyUsage + $cost, now()->endOfMonth());

        // Record detailed usage in database for analytics
        $this->recordDetailedUsage($provider, $pages, $cost, $additionalData);

        // Log usage
        $logData = [
            'provider' => $provider,
            'pages' => $pages,
            'cost' => $cost,
            'daily_total' => $dailyUsage + $cost,
            'monthly_total' => $monthlyUsage + $cost
        ];
        
        // Include additional data if provided
        if (!empty($additionalData)) {
            $logData = array_merge($logData, $additionalData);
        }
        
        Log::info('OCR usage recorded', $logData);

        // Check for budget alerts
        $this->checkAndSendAlerts($dailyUsage + $cost, $monthlyUsage + $cost);
    }

    /**
     * Get current daily usage (deprecated - use the version with service parameter)
     */
    // public function getDailyUsage(): float
    // {
    //     $today = now()->format('Y-m-d');
    //     $dailyKey = "{$this->cachePrefix}:daily:{$today}";
    //     return Cache::get($dailyKey, 0);
    // }

    /**
     * Get current monthly usage (deprecated - use the version with service parameter)
     */
    // public function getMonthlyUsage(): float
    // {
    //     $currentMonth = now()->format('Y-m');
    //     $monthlyKey = "{$this->cachePrefix}:monthly:{$currentMonth}";
    //     return Cache::get($monthlyKey, 0);
    // }

    /**
     * Get usage statistics
     */
    public function getUsageStatistics(int $days = 30): array
    {
        return DB::table('ocr_usage_logs')
            ->select(
                'provider',
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(pages) as total_pages'),
                DB::raw('SUM(cost) as total_cost'),
                DB::raw('COUNT(*) as total_requests')
            )
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('provider', 'date')
            ->orderBy('date', 'desc')
            ->get()
            ->toArray();
    }

    /**
     * Calculate cost based on provider and pages
     */
    protected function calculateCost(string $provider, int $pages): float
    {
        $costPerPage = match ($provider) {
            'textract' => Config::get('ocr.drivers.textract.cost_per_page', 0.05),
            'tesseract' => 0.0, // Free local processing
            default => 0.0
        };

        return $costPerPage * $pages;
    }

    /**
     * Record detailed usage in database
     */
    protected function recordDetailedUsage(string $provider, int $pages, float $cost, array $additionalData = []): void
    {
        try {
            $logData = [
                'provider' => $provider,
                'pages' => $pages,
                'cost' => $cost,
                'user_id' => auth()->id(),
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
                'updated_at' => now()
            ];
            
            // Add additional data fields if they exist
            if (isset($additionalData['estimated_cost'])) {
                $logData['estimated_cost'] = $additionalData['estimated_cost'];
            }
            if (isset($additionalData['accuracy'])) {
                $logData['accuracy'] = $additionalData['accuracy'];
            }
            if (isset($additionalData['processing_time'])) {
                $logData['processing_time'] = $additionalData['processing_time'];
            }
            
            DB::table('ocr_usage_logs')->insert($logData);
        } catch (\Exception $e) {
            Log::error('Failed to record detailed OCR usage', [
                'error' => $e->getMessage(),
                'provider' => $provider,
                'pages' => $pages,
                'cost' => $cost
            ]);
        }
    }

    /**
     * Get weekly usage for specific service
     */
    public function getWeeklyUsage(string $service = 'all'): float
    {
        $weeklyTotal = 0.0;
        
        // Sum up last 7 days
        for ($i = 0; $i < 7; $i++) {
            $date = now()->subDays($i)->format('Y-m-d');
            $key = "{$this->cachePrefix}:daily:{$service}:{$date}";
            $dailyUsage = Cache::get($key, 0);
            $weeklyTotal += $dailyUsage;
        }
        
        return $weeklyTotal;
    }

    /**
     * Record usage for specific service (Alternative version - commented out to avoid duplication)
     */
    // public function recordUsage(string $service, array $data): void
    // {
    //     $today = now()->format('Y-m-d');
    //     $currentMonth = now()->format('Y-m');
    //     
    //     // Calculate cost from data
    //     $cost = $data['actual_cost'] ?? 0;
    //     
    //     // Update daily usage
    //     $dailyKey = "{$this->cachePrefix}:daily:{$service}:{$today}";
    //     $currentDaily = Cache::get($dailyKey, 0);
    //     Cache::put($dailyKey, $currentDaily + $cost, now()->endOfDay());
    //     
    //     // Update monthly usage
    //     $monthlyKey = "{$this->cachePrefix}:monthly:{$service}:{$currentMonth}";
    //     $currentMonthly = Cache::get($monthlyKey, 0);
    //     Cache::put($monthlyKey, $currentMonthly + $cost, now()->endOfMonth());
    //     
    //     // Store detailed usage log in database
    //     try {
    //         DB::table('ocr_usage_logs')->insert([
    //             'service' => $service,
    //             'cost' => $cost,
    //             'estimated_cost' => $data['estimated_cost'] ?? $cost,
    //             'pages_processed' => $data['pages_processed'] ?? 1,
    //             'processing_time' => $data['processing_time'] ?? null,
    //             'confidence_score' => $data['confidence_score'] ?? null,
    //             'features_used' => json_encode($data['features_used'] ?? []),
    //             'metadata' => json_encode($data),
    //             'created_at' => now(),
    //         ]);
    //     } catch (\Exception $e) {
    //         Log::error('Failed to record OCR usage', [
    //             'service' => $service,
    //             'error' => $e->getMessage(),
    //             'data' => $data
    //         ]);
    //     }
    // }

    /**
     * Get daily usage for specific service
     */
    public function getDailyUsage(string $service = 'all'): float
    {
        $today = now()->format('Y-m-d');
        
        if ($service === 'all') {
            // Sum all services
            $total = 0.0;
            $services = ['textract', 'tesseract'];
            foreach ($services as $svc) {
                $key = "{$this->cachePrefix}:daily:{$svc}:{$today}";
                $total += Cache::get($key, 0);
            }
            return $total;
        }
        
        $key = "{$this->cachePrefix}:daily:{$service}:{$today}";
        return Cache::get($key, 0);
    }

    /**
     * Get monthly usage for specific service
     */
    public function getMonthlyUsage(string $service = 'all'): float
    {
        $currentMonth = now()->format('Y-m');
        
        if ($service === 'all') {
            // Sum all services
            $total = 0.0;
            $services = ['textract', 'tesseract'];
            foreach ($services as $svc) {
                $key = "{$this->cachePrefix}:monthly:{$svc}:{$currentMonth}";
                $total += Cache::get($key, 0);
            }
            return $total;
        }
        
        $key = "{$this->cachePrefix}:monthly:{$service}:{$currentMonth}";
        return Cache::get($key, 0);
    }

    /**
     * Check budget thresholds and send alerts
     */
    protected function checkAndSendAlerts(float $dailyUsage, float $monthlyUsage): void
    {
        $alertThreshold = $this->config['alert_threshold'] / 100;
        $dailyBudget = $this->config['daily_budget'];
        $monthlyBudget = $this->config['monthly_budget'];

        // Check daily threshold
        if ($dailyUsage >= ($dailyBudget * $alertThreshold)) {
            $this->sendBudgetAlert('daily', $dailyUsage, $dailyBudget);
        }

        // Check monthly threshold
        if ($monthlyUsage >= ($monthlyBudget * $alertThreshold)) {
            $this->sendBudgetAlert('monthly', $monthlyUsage, $monthlyBudget);
        }
    }

    /**
     * Send budget alert
     */
    protected function sendBudgetAlert(string $period, float $usage, float $budget): void
    {
        $percentage = ($usage / $budget) * 100;
        
        Log::warning("OCR budget alert: {$period} usage at {$percentage}%", [
            'period' => $period,
            'usage' => $usage,
            'budget' => $budget,
            'percentage' => $percentage
        ]);

        // Here you could integrate with notification services
        // event(new OCRBudgetAlert($period, $usage, $budget, $percentage));
    }

    /**
     * Reset usage tracking (for testing)
     */
    public function resetUsage(): void
    {
        $today = now()->format('Y-m-d');
        $currentMonth = now()->format('Y-m');

        Cache::forget("{$this->cachePrefix}:daily:{$today}");
        Cache::forget("{$this->cachePrefix}:monthly:{$currentMonth}");
    }

    /**
     * Get current budget status
     */
    public function getBudgetStatus(): array
    {
        $dailyUsage = $this->getDailyUsage();
        $monthlyUsage = $this->getMonthlyUsage();
        $dailyBudget = $this->config['daily_budget'];
        $monthlyBudget = $this->config['monthly_budget'];

        return [
            'daily' => [
                'usage' => $dailyUsage,
                'budget' => $dailyBudget,
                'percentage' => ($dailyUsage / $dailyBudget) * 100,
                'remaining' => $dailyBudget - $dailyUsage
            ],
            'monthly' => [
                'usage' => $monthlyUsage,
                'budget' => $monthlyBudget,
                'percentage' => ($monthlyUsage / $monthlyBudget) * 100,
                'remaining' => $monthlyBudget - $monthlyUsage
            ]
        ];
    }
}