<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use App\Notifications\CostAlertNotification;
use Carbon\Carbon;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use App\Services\OCRUsageTracker;

class TextractCostOptimizationService
{
    private const COST_PER_PAGE = [
        'FORMS' => 0.05,
        'TABLES' => 0.065,
        'QUERIES' => 0.065,
        'SIGNATURES' => 0.065,
        'LAYOUT' => 0.05,
    ];

    private const AWS_SERVICE_FEE_MULTIPLIER = 1.1; // 10% AWS service fees

    protected $cache;
    protected $usageTracker;
    protected $config;

    public function __construct(CacheRepository $cache, OCRUsageTracker $usageTracker)
    {
        $this->cache = $cache;
        $this->usageTracker = $usageTracker;
        $this->config = Config::get('ocr');
    }

    /**
     * Check if document processing is within cost limits
     */
    public function canProcessDocument(string $filePath): bool
    {
        $estimatedCost = $this->estimateProcessingCost($filePath);

        $dailyUsage = $this->getDailyUsage();
        $monthlyUsage = $this->getMonthlyUsage();

        $dailyLimit = $this->config['cost_limits']['daily'] ?? 1000.00;
        $monthlyLimit = $this->config['cost_limits']['monthly'] ?? 25000.00;

        return ($dailyUsage + $estimatedCost) <= $dailyLimit &&
               ($monthlyUsage + $estimatedCost) <= $monthlyLimit;
    }

    /**
     * Estimate processing cost based on document characteristics
     */
    public function estimateProcessingCost(string $filePath, array $features = ['FORMS']): float
    {
        $pageCount = $this->estimatePageCount($filePath);
        $totalCost = 0.0;

        foreach ($features as $feature) {
            $costPerPage = self::COST_PER_PAGE[$feature] ?? 0.05;
            $totalCost += $pageCount * $costPerPage;
        }

        // Add AWS service fees
        $totalCost *= self::AWS_SERVICE_FEE_MULTIPLIER;

        return round($totalCost, 4);
    }

    /**
     * Estimate page count from file
     */
    protected function estimatePageCount(string $filePath): int
    {
        // For images, it's always 1 page
        $imageExtensions = ['jpg', 'jpeg', 'png', 'bmp', 'tiff'];
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        
        if (in_array($extension, $imageExtensions)) {
            return 1;
        }

        // For PDFs, we need to count pages
        if ($extension === 'pdf') {
            try {
                // Using Imagick if available
                if (class_exists('Imagick')) {
                    $imagick = new \Imagick($filePath);
                    return $imagick->getNumberImages();
                }
                
                // Fallback: estimate based on file size
                $fileSize = filesize($filePath);
                $avgPageSize = 100 * 1024; // 100KB average per page
                return max(1, ceil($fileSize / $avgPageSize));
                
            } catch (\Exception $e) {
                Log::warning('Could not determine PDF page count', [
                    'file' => $filePath,
                    'error' => $e->getMessage()
                ]);
                return 1;
            }
        }

        return 1;
    }

    /**
     * Optimize document before processing to reduce costs
     */
    public function optimizeDocument(string $filePath): array
    {
        $optimizationResult = [
            'original_path' => $filePath,
            'optimized_path' => $filePath,
            'original_size' => filesize($filePath),
            'optimized_size' => filesize($filePath),
            'compression_ratio' => 1.0,
            'estimated_cost_reduction' => 0.0,
        ];

        try {
            // Create optimized version
            $optimizedPath = $this->createOptimizedVersion($filePath);
            
            $optimizationResult['optimized_path'] = $optimizedPath;
            $optimizationResult['optimized_size'] = filesize($optimizedPath);
            $optimizationResult['compression_ratio'] = 
                $optimizationResult['optimized_size'] / $optimizationResult['original_size'];
            
            // Calculate cost reduction
            $originalCost = $this->estimateProcessingCost($filePath);
            $optimizedCost = $this->estimateProcessingCost($optimizedPath);
            $optimizationResult['estimated_cost_reduction'] = 
                (($originalCost - $optimizedCost) / $originalCost) * 100;

        } catch (\Exception $e) {
            Log::error('Document optimization failed', [
                'file' => $filePath,
                'error' => $e->getMessage()
            ]);
        }

        return $optimizationResult;
    }

    /**
     * Create optimized version of document
     */
    protected function createOptimizedVersion(string $filePath): string
    {
        $tempPath = storage_path('app/temp/' . uniqid() . '_' . basename($filePath));
        
        // Ensure temp directory exists
        if (!file_exists(dirname($tempPath))) {
            mkdir(dirname($tempPath), 0755, true);
        }

        // Use Intervention Image for optimization
        $image = \Intervention\Image\Facades\Image::make($filePath);
        
        // Optimize based on image characteristics
        $width = $image->width();
        $height = $image->height();
        
        // Resize if too large (Textract has a 10MB limit)
        if ($width > 2048 || $height > 2048) {
            $image->resize(2048, 2048, function ($constraint) {
                $constraint->aspectRatio();
                $constraint->upsize();
            });
        }
        
        // Enhance for OCR
        $image->contrast(15);
        $image->sharpen(5);
        
        // Save optimized version
        $image->save($tempPath, 85); // 85% quality
        
        return $tempPath;
    }

    /**
     * Implement intelligent batching for cost efficiency
     */
    public function optimizeBatchProcessing(array $documents): array
    {
        // Group documents by type for optimal processing
        $groupedDocs = $this->groupDocumentsByType($documents);

        // Calculate optimal batch sizes
        $batches = [];
        foreach ($groupedDocs as $type => $docs) {
            $batches[$type] = $this->createOptimalBatches($docs, $type);
        }

        // Estimate total cost savings
        $costSavings = $this->calculateBatchSavings($batches);

        return [
            'batches' => $batches,
            'total_documents' => count($documents),
            'estimated_cost_savings' => $costSavings,
            'processing_time_estimate' => $this->estimateBatchProcessingTime($batches),
        ];
    }

    /**
     * Group documents by type
     */
    protected function groupDocumentsByType(array $documents): array
    {
        $grouped = [];
        
        foreach ($documents as $doc) {
            $type = $this->detectDocumentType($doc);
            if (!isset($grouped[$type])) {
                $grouped[$type] = [];
            }
            $grouped[$type][] = $doc;
        }
        
        return $grouped;
    }

    /**
     * Detect document type
     */
    protected function detectDocumentType(string $document): string
    {
        // Simple detection based on filename patterns
        $filename = basename($document);
        
        if (preg_match('/(rg|identidade|cnh|habilitacao)/i', $filename)) {
            return 'id_document';
        }
        
        if (preg_match('/(form|formulario|ficha)/i', $filename)) {
            return 'form_document';
        }
        
        if (preg_match('/(laudo|exame|medico)/i', $filename)) {
            return 'medical_report';
        }
        
        return 'general_document';
    }

    /**
     * Create optimal batches
     */
    protected function createOptimalBatches(array $documents, string $type): array
    {
        $batches = [];
        $batchSize = $this->getOptimalBatchSize($type);
        
        $chunks = array_chunk($documents, $batchSize);
        
        foreach ($chunks as $index => $chunk) {
            $batches[] = [
                'batch_id' => uniqid('batch_'),
                'type' => $type,
                'documents' => $chunk,
                'estimated_cost' => $this->estimateBatchCost($chunk, $type),
                'priority' => $this->calculateBatchPriority($chunk),
            ];
        }
        
        return $batches;
    }

    /**
     * Get optimal batch size for document type
     */
    protected function getOptimalBatchSize(string $type): int
    {
        // Optimal batch sizes based on document type
        $batchSizes = [
            'id_document' => 10,      // Quick processing
            'form_document' => 5,     // More complex
            'medical_report' => 3,    // Most complex
            'general_document' => 8,  // Standard
        ];
        
        return $batchSizes[$type] ?? 5;
    }

    /**
     * Estimate batch cost
     */
    protected function estimateBatchCost(array $documents, string $type): float
    {
        $features = $this->getFeaturesForType($type);
        $totalCost = 0.0;
        
        foreach ($documents as $doc) {
            $totalCost += $this->estimateProcessingCost($doc, $features);
        }
        
        // Apply batch discount (hypothetical)
        if (count($documents) > 5) {
            $totalCost *= 0.95; // 5% discount for larger batches
        }
        
        return $totalCost;
    }

    /**
     * Get features for document type
     */
    protected function getFeaturesForType(string $type): array
    {
        $featureMap = [
            'id_document' => ['FORMS'],
            'form_document' => ['FORMS', 'TABLES'],
            'medical_report' => ['FORMS', 'TABLES'],
            'general_document' => ['FORMS'],
        ];
        
        return $featureMap[$type] ?? ['FORMS'];
    }

    /**
     * Calculate batch priority
     */
    protected function calculateBatchPriority(array $documents): int
    {
        // Priority based on document age, size, etc.
        $totalSize = array_sum(array_map('filesize', $documents));
        
        if ($totalSize < 1024 * 1024) { // Less than 1MB total
            return 1; // High priority
        } elseif ($totalSize < 10 * 1024 * 1024) { // Less than 10MB
            return 2; // Medium priority
        } else {
            return 3; // Low priority
        }
    }

    /**
     * Calculate batch savings
     */
    protected function calculateBatchSavings(array $batches): float
    {
        $individualCost = 0.0;
        $batchedCost = 0.0;
        
        foreach ($batches as $type => $typeBatches) {
            foreach ($typeBatches as $batch) {
                $individualCost += count($batch['documents']) * 
                    $this->estimateProcessingCost($batch['documents'][0] ?? '');
                $batchedCost += $batch['estimated_cost'];
            }
        }
        
        return $individualCost - $batchedCost;
    }

    /**
     * Estimate batch processing time
     */
    protected function estimateBatchProcessingTime(array $batches): array
    {
        $totalTime = 0;
        $breakdown = [];
        
        foreach ($batches as $type => $typeBatches) {
            $typeTime = 0;
            foreach ($typeBatches as $batch) {
                // Base time: 2 seconds per document + overhead
                $batchTime = count($batch['documents']) * 2 + 5;
                $typeTime += $batchTime;
            }
            $breakdown[$type] = $typeTime;
            $totalTime += $typeTime;
        }
        
        return [
            'total_seconds' => $totalTime,
            'formatted' => $this->formatTime($totalTime),
            'breakdown' => $breakdown,
        ];
    }

    /**
     * Format time in human-readable format
     */
    protected function formatTime(int $seconds): string
    {
        if ($seconds < 60) {
            return $seconds . ' seconds';
        } elseif ($seconds < 3600) {
            return round($seconds / 60, 1) . ' minutes';
        } else {
            return round($seconds / 3600, 1) . ' hours';
        }
    }

    /**
     * Monitor and alert on cost overruns
     */
    public function monitorCosts(): array
    {
        $currentUsage = [
            'daily' => $this->getDailyUsage(),
            'weekly' => $this->getWeeklyUsage(),
            'monthly' => $this->getMonthlyUsage(),
        ];

        $limits = [
            'daily' => $this->config['cost_limits']['daily'] ?? 1000.00,
            'weekly' => $this->config['cost_limits']['weekly'] ?? 5000.00,
            'monthly' => $this->config['cost_limits']['monthly'] ?? 25000.00,
        ];

        $alerts = [];
        foreach ($currentUsage as $period => $usage) {
            $threshold = $limits[$period] * 0.8; // Alert at 80%
            if ($usage >= $threshold) {
                $alerts[] = [
                    'period' => $period,
                    'usage' => $usage,
                    'limit' => $limits[$period],
                    'percentage' => ($usage / $limits[$period]) * 100,
                    'severity' => $usage >= $limits[$period] * 0.95 ? 'critical' : 'warning',
                ];
            }
        }

        // Send alerts if necessary
        if (!empty($alerts)) {
            $this->sendCostAlerts($alerts);
        }

        return [
            'current_usage' => $currentUsage,
            'limits' => $limits,
            'alerts' => $alerts,
            'projected_monthly_cost' => $this->projectMonthlyCost(),
            'cost_trends' => $this->analyzeCostTrends(),
        ];
    }

    /**
     * Get current daily usage
     */
    public function getDailyUsage(): float
    {
        return $this->usageTracker->getDailyUsage('textract');
    }

    /**
     * Get current weekly usage
     */
    public function getWeeklyUsage(): float
    {
        return $this->usageTracker->getWeeklyUsage('textract');
    }

    /**
     * Get current monthly usage
     */
    public function getMonthlyUsage(): float
    {
        return $this->usageTracker->getMonthlyUsage('textract');
    }

    /**
     * Record actual processing cost
     */
    public function recordActualCost(float $estimatedCost, array $processingResult): void
    {
        $actualCost = $this->calculateActualCost($processingResult);
        
        $this->usageTracker->recordUsage('textract', [
            'estimated_cost' => $estimatedCost,
            'actual_cost' => $actualCost,
            'accuracy' => abs($estimatedCost - $actualCost) / $estimatedCost,
            'processing_time' => $processingResult['processing_time'] ?? null,
            'pages_processed' => $processingResult['pages_processed'] ?? 1,
            'features_used' => $processingResult['features_used'] ?? ['FORMS'],
            'confidence_score' => $processingResult['average_confidence'] ?? null,
        ]);

        // Update cost prediction model
        $this->updateCostPredictionModel($estimatedCost, $actualCost, $processingResult);
    }

    /**
     * Calculate actual cost from processing result
     */
    protected function calculateActualCost(array $processingResult): float
    {
        $pages = $processingResult['pages_processed'] ?? 1;
        $features = $processingResult['features_used'] ?? ['FORMS'];
        
        $cost = 0.0;
        foreach ($features as $feature) {
            $cost += $pages * (self::COST_PER_PAGE[$feature] ?? 0.05);
        }
        
        return $cost * self::AWS_SERVICE_FEE_MULTIPLIER;
    }

    /**
     * Update cost prediction model
     */
    protected function updateCostPredictionModel(float $estimated, float $actual, array $result): void
    {
        // Store prediction accuracy data
        $accuracy = abs($estimated - $actual) / $estimated;
        
        $predictionData = Cache::get('textract_cost_predictions', []);
        $predictionData[] = [
            'timestamp' => now(),
            'estimated' => $estimated,
            'actual' => $actual,
            'accuracy' => $accuracy,
            'pages' => $result['pages_processed'] ?? 1,
            'features' => $result['features_used'] ?? ['FORMS'],
        ];
        
        // Keep last 1000 predictions
        if (count($predictionData) > 1000) {
            $predictionData = array_slice($predictionData, -1000);
        }
        
        Cache::put('textract_cost_predictions', $predictionData, now()->addDays(30));
        
        // Log if prediction was significantly off
        if ($accuracy > 0.2) { // More than 20% off
            Log::warning('Textract cost prediction inaccurate', [
                'estimated' => $estimated,
                'actual' => $actual,
                'accuracy' => $accuracy,
                'result' => $result,
            ]);
        }
    }

    /**
     * Project monthly cost based on current usage
     */
    protected function projectMonthlyCost(): float
    {
        $dailyAverage = $this->getAverageDailyUsage();
        $daysInMonth = Carbon::now()->daysInMonth;
        $daysPassed = Carbon::now()->day;
        
        if ($daysPassed === 0) {
            return $dailyAverage * $daysInMonth;
        }
        
        $currentMonthlyUsage = $this->getMonthlyUsage();
        $projectedTotal = ($currentMonthlyUsage / $daysPassed) * $daysInMonth;
        
        return round($projectedTotal, 2);
    }

    /**
     * Get average daily usage
     */
    protected function getAverageDailyUsage(): float
    {
        $history = Cache::get('textract_daily_usage_history', []);
        
        if (empty($history)) {
            return $this->getDailyUsage();
        }
        
        return array_sum($history) / count($history);
    }

    /**
     * Analyze cost trends
     */
    protected function analyzeCostTrends(): array
    {
        $history = Cache::get('textract_usage_history', []);
        
        if (count($history) < 7) {
            return [
                'trend' => 'insufficient_data',
                'change_percentage' => 0,
                'recommendation' => 'Need more data for trend analysis',
            ];
        }
        
        // Calculate trend over last 7 days
        $recentHistory = array_slice($history, -7);
        $oldAverage = array_sum(array_slice($recentHistory, 0, 3)) / 3;
        $newAverage = array_sum(array_slice($recentHistory, -3)) / 3;
        
        $changePercentage = (($newAverage - $oldAverage) / $oldAverage) * 100;
        
        $trend = 'stable';
        if ($changePercentage > 10) {
            $trend = 'increasing';
        } elseif ($changePercentage < -10) {
            $trend = 'decreasing';
        }
        
        $recommendation = $this->getCostRecommendation($trend, $changePercentage);
        
        return [
            'trend' => $trend,
            'change_percentage' => round($changePercentage, 2),
            'recommendation' => $recommendation,
            'history' => $recentHistory,
        ];
    }

    /**
     * Get cost recommendation based on trend
     */
    protected function getCostRecommendation(string $trend, float $changePercentage): string
    {
        switch ($trend) {
            case 'increasing':
                if ($changePercentage > 25) {
                    return 'Cost increasing rapidly. Consider reviewing document processing volume or optimizing feature usage.';
                }
                return 'Cost trending upward. Monitor usage closely.';
                
            case 'decreasing':
                return 'Cost optimization efforts are working. Continue monitoring.';
                
            default:
                return 'Costs are stable. No action required.';
        }
    }

    /**
     * Send cost alerts
     */
    protected function sendCostAlerts(array $alerts): void
    {
        foreach ($alerts as $alert) {
            Log::warning('Textract cost alert', $alert);
            
            // Send notification to administrators
            if ($alert['severity'] === 'critical') {
                $this->sendCriticalCostAlert($alert);
            }
        }
    }

    /**
     * Send critical cost alert
     */
    protected function sendCriticalCostAlert(array $alert): void
    {
        // Get admin emails from config
        $adminEmails = $this->config['notifications']['admin_emails'] ?? [];
        
        if (empty($adminEmails)) {
            Log::error('No admin emails configured for cost alerts');
            return;
        }
        
        // Send email notification
        // Note: You'll need to create the CostAlertNotification class
        try {
            Notification::route('mail', $adminEmails)
                ->notify(new CostAlertNotification($alert));
        } catch (\Exception $e) {
            Log::error('Failed to send cost alert notification', [
                'error' => $e->getMessage(),
                'alert' => $alert,
            ]);
        }
    }

    /**
     * Calculate cost reduction from optimization
     */
    public function calculateCostReduction(string $originalPath, string $optimizedPath): float
    {
        $originalCost = $this->estimateProcessingCost($originalPath);
        $optimizedCost = $this->estimateProcessingCost($optimizedPath);
        
        if ($originalCost === 0) {
            return 0;
        }
        
        return (($originalCost - $optimizedCost) / $originalCost) * 100;
    }
}