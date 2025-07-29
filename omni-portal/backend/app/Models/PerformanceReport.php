<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PerformanceReport extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'period',
        'generated_at',
        'performance',
        'recommendations',
        'alerts',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'generated_at' => 'datetime',
        'performance' => 'array',
        'recommendations' => 'array',
        'alerts' => 'array',
    ];

    /**
     * Get formatted performance metrics
     */
    public function getFormattedPerformance(): array
    {
        $performance = $this->performance ?? [];
        
        return [
            'processing' => [
                'avg_time' => round($performance['avg_processing_time'] ?? 0, 2) . 's',
                'success_rate' => round($performance['success_rate'] ?? 0, 1) . '%',
                'total_documents' => number_format($performance['total_documents_processed'] ?? 0),
            ],
            'quality' => [
                'avg_confidence' => round($performance['avg_confidence_score'] ?? 0, 2),
                'quality_trend' => $performance['quality_trends']['trend_direction'] ?? 'stable',
                'current_quality' => round($performance['quality_trends']['current_quality'] ?? 0, 2),
            ],
            'cost' => [
                'estimated_total' => '$' . number_format($performance['cost_efficiency']['estimated_cost'] ?? 0, 2),
                'per_document' => '$' . number_format($performance['cost_efficiency']['cost_per_document'] ?? 0, 3),
                'efficiency_score' => round($performance['cost_efficiency']['processing_efficiency'] ?? 0, 2),
            ],
        ];
    }

    /**
     * Get high priority recommendations
     */
    public function getHighPriorityRecommendations(): array
    {
        return collect($this->recommendations ?? [])
            ->where('priority', 'high')
            ->values()
            ->toArray();
    }

    /**
     * Get active alerts count by severity
     */
    public function getAlertsSummary(): array
    {
        $alerts = collect($this->alerts ?? []);
        
        return [
            'critical' => $alerts->where('severity', 'critical')->count(),
            'error' => $alerts->where('severity', 'error')->count(),
            'warning' => $alerts->where('severity', 'warning')->count(),
            'total' => $alerts->count(),
        ];
    }

    /**
     * Check if performance is degrading
     */
    public function isPerformanceDegrading(): bool
    {
        $performance = $this->performance ?? [];
        
        // Check multiple indicators
        $indicators = [
            $performance['quality_trends']['trend_direction'] === 'declining',
            ($performance['success_rate'] ?? 100) < 95,
            ($performance['avg_confidence_score'] ?? 1) < 0.8,
            ($performance['avg_processing_time'] ?? 0) > 30,
        ];

        // If 2 or more indicators are true, performance is degrading
        return count(array_filter($indicators)) >= 2;
    }

    /**
     * Get report summary
     */
    public function getSummary(): string
    {
        $performance = $this->getFormattedPerformance();
        $alerts = $this->getAlertsSummary();
        
        $status = 'healthy';
        if ($alerts['critical'] > 0) {
            $status = 'critical';
        } elseif ($alerts['error'] > 0 || $this->isPerformanceDegrading()) {
            $status = 'warning';
        }

        return sprintf(
            'Period: %s | Status: %s | Documents: %s | Success Rate: %s | Alerts: %d',
            $this->period,
            $status,
            $performance['processing']['total_documents'],
            $performance['processing']['success_rate'],
            $alerts['total']
        );
    }

    /**
     * Export report as PDF or CSV
     */
    public function export(string $format = 'pdf'): string
    {
        // This would be implemented with a PDF/CSV generation library
        // For now, return a placeholder path
        return storage_path("app/reports/performance-report-{$this->id}.{$format}");
    }
}