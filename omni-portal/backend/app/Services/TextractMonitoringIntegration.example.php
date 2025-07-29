<?php

namespace App\Services;

/**
 * Example of how to integrate TextractMonitoringService with existing OCR services
 */
class TextractMonitoringIntegration
{
    /**
     * Example: Integrate monitoring with EnhancedOCRService
     */
    public function integrateWithEnhancedOCRService()
    {
        // In EnhancedOCRService::processWithTextract() method, add:
        
        $monitoring = app(TextractMonitoringService::class);
        $startTime = microtime(true);
        
        try {
            // Existing Textract processing code...
            $result = $this->textractClient->analyzeDocument([
                'Document' => ['S3Object' => $s3Object],
                'FeatureTypes' => $features,
            ]);
            
            // Calculate metrics
            $processingTime = microtime(true) - $startTime;
            $confidence = $this->calculateAverageConfidence($result);
            $qualityScore = $this->assessDocumentQuality($result);
            
            // Record metrics
            $monitoring->recordProcessingMetrics($filePath, [
                'processing_time' => $processingTime,
                'average_confidence' => $confidence,
                'quality_score' => $qualityScore,
                'pages_processed' => count($result['Blocks'] ?? []),
                'features_used' => $features,
                'forms' => $this->extractForms($result),
                'tables' => $this->extractTables($result),
                'success' => true,
            ]);
            
            return $result;
            
        } catch (\Exception $e) {
            // Record failure metrics
            $monitoring->recordProcessingMetrics($filePath, [
                'processing_time' => microtime(true) - $startTime,
                'success' => false,
                'error' => $e->getMessage(),
            ]);
            
            throw $e;
        }
    }

    /**
     * Example: Add monitoring endpoints to controller
     */
    public function addMonitoringEndpoints()
    {
        // In a controller:
        
        /**
         * Start real-time monitoring
         */
        public function startMonitoring(Request $request)
        {
            $monitoring = app(TextractMonitoringService::class);
            $monitoring->startRealTimeMonitoring();
            
            return response()->json([
                'success' => true,
                'message' => 'Monitoring started successfully',
            ]);
        }
        
        /**
         * Get monitoring status
         */
        public function getMonitoringStatus(Request $request)
        {
            $monitoring = app(TextractMonitoringService::class);
            $status = $monitoring->getMonitoringStatus();
            
            return response()->json($status);
        }
        
        /**
         * Generate performance report
         */
        public function generateReport(Request $request)
        {
            $monitoring = app(TextractMonitoringService::class);
            
            $report = $monitoring->generatePerformanceReport([
                'period' => $request->input('period', '24h'),
            ]);
            
            return response()->json($report->toArray());
        }
        
        /**
         * Get alert history
         */
        public function getAlerts(Request $request)
        {
            $alerting = app(AlertingService::class);
            
            $alerts = $alerting->getAlertHistory([
                'type' => $request->input('type'),
                'severity' => $request->input('severity'),
                'status' => $request->input('status'),
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
                'per_page' => $request->input('per_page', 20),
            ]);
            
            return response()->json($alerts);
        }
    }

    /**
     * Example: Schedule monitoring tasks
     */
    public function scheduleMonitoringTasks()
    {
        // In app/Console/Kernel.php:
        
        // Generate hourly performance reports
        $schedule->call(function () {
            $monitoring = app(TextractMonitoringService::class);
            $report = $monitoring->generatePerformanceReport(['period' => '1h']);
            
            // Store report
            $report->save();
            
            // Check if performance is degrading
            if ($report->isPerformanceDegrading()) {
                // Send alert to administrators
                $alerting = app(AlertingService::class);
                $alerting->sendAlert([
                    'type' => 'performance_degradation',
                    'severity' => 'warning',
                    'message' => 'OCR performance is degrading. Review the latest report.',
                    'report_id' => $report->id,
                ]);
            }
        })->hourly();
        
        // Clean up old metrics data
        $schedule->call(function () {
            DB::table('ocr_processing_metrics')
                ->where('created_at', '<', now()->subDays(30))
                ->delete();
                
            DB::table('ocr_alerts')
                ->where('status', 'resolved')
                ->where('resolved_at', '<', now()->subDays(90))
                ->delete();
        })->daily();
    }

    /**
     * Example: Add monitoring dashboard routes
     */
    public function addMonitoringRoutes()
    {
        // In routes/api.php:
        
        Route::prefix('admin/ocr/monitoring')->middleware(['auth', 'admin'])->group(function () {
            Route::post('/start', [OCRMonitoringController::class, 'startMonitoring']);
            Route::post('/stop', [OCRMonitoringController::class, 'stopMonitoring']);
            Route::get('/status', [OCRMonitoringController::class, 'getMonitoringStatus']);
            Route::get('/report', [OCRMonitoringController::class, 'generateReport']);
            Route::get('/alerts', [OCRMonitoringController::class, 'getAlerts']);
            Route::get('/alerts/stats', [OCRMonitoringController::class, 'getAlertStatistics']);
            Route::post('/alerts/{alert}/resolve', [OCRMonitoringController::class, 'resolveAlert']);
        });
    }

    /**
     * Helper: Calculate average confidence from Textract result
     */
    private function calculateAverageConfidence($textractResult): float
    {
        $confidences = [];
        
        foreach ($textractResult['Blocks'] ?? [] as $block) {
            if (isset($block['Confidence'])) {
                $confidences[] = $block['Confidence'] / 100; // Convert to 0-1 scale
            }
        }
        
        return $confidences ? array_sum($confidences) / count($confidences) : 0.0;
    }

    /**
     * Helper: Assess document quality based on Textract output
     */
    private function assessDocumentQuality($textractResult): float
    {
        $qualityFactors = [
            'confidence' => $this->calculateAverageConfidence($textractResult),
            'text_density' => $this->calculateTextDensity($textractResult),
            'structure_quality' => $this->assessStructureQuality($textractResult),
        ];
        
        // Weighted average
        return (
            $qualityFactors['confidence'] * 0.5 +
            $qualityFactors['text_density'] * 0.3 +
            $qualityFactors['structure_quality'] * 0.2
        );
    }

    /**
     * Helper: Calculate text density
     */
    private function calculateTextDensity($textractResult): float
    {
        $textBlocks = 0;
        $totalBlocks = count($textractResult['Blocks'] ?? []);
        
        foreach ($textractResult['Blocks'] ?? [] as $block) {
            if ($block['BlockType'] === 'LINE' || $block['BlockType'] === 'WORD') {
                $textBlocks++;
            }
        }
        
        return $totalBlocks > 0 ? $textBlocks / $totalBlocks : 0.0;
    }

    /**
     * Helper: Assess structure quality
     */
    private function assessStructureQuality($textractResult): float
    {
        $structuredElements = 0;
        
        foreach ($textractResult['Blocks'] ?? [] as $block) {
            if (in_array($block['BlockType'], ['TABLE', 'FORM', 'KEY_VALUE_SET'])) {
                $structuredElements++;
            }
        }
        
        // More structured elements generally indicate better document quality
        return min($structuredElements / 10, 1.0); // Cap at 1.0
    }
}