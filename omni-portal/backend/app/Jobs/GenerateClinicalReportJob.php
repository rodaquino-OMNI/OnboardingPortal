<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Models\ClinicalReport;
use App\Models\ClinicalAlert;
use App\Models\HealthQuestionnaire;
use App\Models\AlertWorkflow;
use App\Services\ReportGenerators\PdfReportGenerator;
use App\Services\ReportGenerators\ExcelReportGenerator;
use App\Services\ReportGenerators\JsonReportGenerator;
use App\Services\ReportGenerators\CsvReportGenerator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Mail\ClinicalReportReady;
use Carbon\Carbon;

class GenerateClinicalReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected ClinicalReport $report;
    public $timeout = 600; // 10 minutes
    public $tries = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(ClinicalReport $report)
    {
        $this->report = $report;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $startTime = microtime(true);
        
        try {
            Log::info("Starting report generation", [
                'report_id' => $this->report->id,
                'type' => $this->report->report_type,
                'format' => $this->report->format
            ]);

            // Update status to processing
            $this->report->update(['generation_status' => 'processing']);

            // Gather report data
            $reportData = $this->gatherReportData();

            // Generate report based on format
            $generator = $this->getReportGenerator();
            $result = $generator->generate($reportData);

            // Save report file
            $filePath = $this->saveReportFile($result);

            // Update report record
            $generationTime = round(microtime(true) - $startTime);
            $this->report->markAsGenerated($filePath, $result['size'], $generationTime);

            // Send notifications if configured
            if ($this->report->shouldBeDistributed()) {
                $this->distributeReport();
            }

            Log::info("Report generation completed", [
                'report_id' => $this->report->id,
                'generation_time' => $generationTime
            ]);

        } catch (\Exception $e) {
            Log::error("Report generation failed", [
                'report_id' => $this->report->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            $this->report->markAsFailed($e->getMessage());
            throw $e;
        }
    }

    /**
     * Gather all data needed for the report
     */
    private function gatherReportData(): array
    {
        $data = [
            'report' => $this->report,
            'period' => [
                'start' => $this->report->period_start,
                'end' => $this->report->period_end,
                'formatted' => $this->report->getFormattedPeriod()
            ],
            'generated_at' => now(),
            'generated_by' => $this->report->generatedBy
        ];

        // Get sections data based on report type
        $sections = $this->report->sections_included ?? $this->report->getDefaultSections();
        
        foreach ($sections as $section) {
            $data['sections'][$section] = $this->getSectionData($section);
        }

        // Add statistics
        $data['statistics'] = $this->calculateStatistics();
        
        // Add risk distribution
        $data['risk_distribution'] = $this->calculateRiskDistribution();
        
        // Add alert summary
        $data['alert_summary'] = $this->getAlertSummary();
        
        // Add intervention outcomes
        $data['intervention_outcomes'] = $this->getInterventionOutcomes();
        
        // Add key findings
        $data['key_findings'] = $this->identifyKeyFindings($data);
        
        // Add trends
        $data['trends'] = $this->analyzeTrends();
        
        // Add recommendations
        $data['recommendations'] = $this->generateRecommendations($data);

        // Update report with calculated data
        $this->report->update([
            'statistics' => $data['statistics'],
            'risk_distribution' => $data['risk_distribution'],
            'alert_summary' => $data['alert_summary'],
            'intervention_outcomes' => $data['intervention_outcomes'],
            'total_patients_analyzed' => $data['statistics']['total_patients'] ?? 0,
            'high_risk_patients' => $data['statistics']['high_risk_patients'] ?? 0,
            'interventions_recommended' => $data['statistics']['interventions_recommended'] ?? 0,
            'follow_ups_scheduled' => $data['statistics']['follow_ups_scheduled'] ?? 0,
            'key_findings' => $data['key_findings'],
            'trends_identified' => $data['trends'],
            'recommendations' => $data['recommendations']
        ]);

        return $data;
    }

    /**
     * Get data for a specific report section
     */
    private function getSectionData(string $section): array
    {
        return match($section) {
            'new_assessments' => $this->getNewAssessments(),
            'critical_alerts' => $this->getCriticalAlerts(),
            'interventions_today' => $this->getTodayInterventions(),
            'key_metrics' => $this->getKeyMetrics(),
            'executive_summary' => $this->getExecutiveSummary(),
            'risk_trends' => $this->getRiskTrends(),
            'alert_analysis' => $this->getAlertAnalysis(),
            'intervention_analysis' => $this->getInterventionAnalysis(),
            'population_health' => $this->getPopulationHealth(),
            'cost_benefit' => $this->getCostBenefitAnalysis(),
            default => []
        };
    }

    /**
     * Get new assessments data
     */
    private function getNewAssessments(): array
    {
        $assessments = HealthQuestionnaire::whereBetween('completed_at', [
                $this->report->period_start,
                $this->report->period_end
            ])
            ->with('beneficiary')
            ->get();

        return [
            'total' => $assessments->count(),
            'by_type' => $assessments->groupBy('questionnaire_type')->map->count(),
            'completion_rate' => $this->calculateCompletionRate($assessments),
            'average_time' => $this->calculateAverageCompletionTime($assessments),
            'details' => $assessments->map(function ($q) {
                return [
                    'id' => $q->id,
                    'beneficiary_name' => $q->beneficiary->name,
                    'completed_at' => $q->completed_at->format('Y-m-d H:i'),
                    'risk_level' => $this->calculateRiskLevel($q->risk_scores['overall'] ?? 0),
                    'risk_score' => $q->risk_scores['overall'] ?? 0
                ];
            })->sortByDesc('risk_score')->values()->take(20)
        ];
    }

    /**
     * Get critical alerts data
     */
    private function getCriticalAlerts(): array
    {
        $alerts = ClinicalAlert::whereBetween('created_at', [
                $this->report->period_start,
                $this->report->period_end
            ])
            ->whereIn('priority', ['critical', 'emergency', 'urgent'])
            ->with(['beneficiary', 'assignedTo'])
            ->get();

        return [
            'total' => $alerts->count(),
            'by_priority' => $alerts->groupBy('priority')->map->count(),
            'by_category' => $alerts->groupBy('category')->map->count(),
            'by_status' => $alerts->groupBy('status')->map->count(),
            'sla_breached' => $alerts->where('sla_breached', true)->count(),
            'average_resolution_time' => $this->calculateAverageResolutionTime($alerts),
            'details' => $alerts->map(function ($alert) {
                return [
                    'id' => $alert->id,
                    'beneficiary_name' => $alert->beneficiary->name,
                    'type' => $alert->alert_type,
                    'category' => $alert->category,
                    'priority' => $alert->priority,
                    'status' => $alert->status,
                    'created_at' => $alert->created_at->format('Y-m-d H:i'),
                    'assigned_to' => $alert->assignedTo?->name,
                    'time_to_sla_breach' => $alert->time_to_sla_breach
                ];
            })->take(50)
        ];
    }

    /**
     * Get today's interventions
     */
    private function getTodayInterventions(): array
    {
        $today = Carbon::today();
        
        $interventions = AlertWorkflow::whereDate('created_at', $today)
            ->where('action_type', 'intervention_planned')
            ->with(['alert', 'performedBy'])
            ->get();

        return [
            'total' => $interventions->count(),
            'by_type' => $this->groupInterventionsByType($interventions),
            'by_performer' => $interventions->groupBy('performedBy.name')->map->count(),
            'details' => $interventions->map(function ($workflow) {
                return [
                    'alert_id' => $workflow->alert_id,
                    'beneficiary_name' => $workflow->alert->beneficiary->name,
                    'intervention_type' => $workflow->interventions_applied[0]['type'] ?? 'unknown',
                    'performed_by' => $workflow->performedBy->name,
                    'time' => $workflow->created_at->format('H:i')
                ];
            })
        ];
    }

    /**
     * Calculate statistics
     */
    private function calculateStatistics(): array
    {
        $startDate = $this->report->period_start;
        $endDate = $this->report->period_end;

        // Total patients with assessments
        $totalPatients = HealthQuestionnaire::whereBetween('completed_at', [$startDate, $endDate])
            ->distinct('beneficiary_id')
            ->count('beneficiary_id');

        // High risk patients
        $highRiskPatients = HealthQuestionnaire::whereBetween('completed_at', [$startDate, $endDate])
            ->whereNotNull('risk_scores')
            ->get()
            ->filter(function ($q) {
                return ($q->risk_scores['overall'] ?? 0) >= 100;
            })
            ->pluck('beneficiary_id')
            ->unique()
            ->count();

        // Interventions
        $interventions = AlertWorkflow::whereBetween('created_at', [$startDate, $endDate])
            ->where('action_type', 'intervention_planned')
            ->count();

        // Follow-ups
        $followUps = AlertWorkflow::whereBetween('created_at', [$startDate, $endDate])
            ->whereNotNull('next_review_date')
            ->count();

        // Alerts statistics
        $totalAlerts = ClinicalAlert::whereBetween('created_at', [$startDate, $endDate])->count();
        $resolvedAlerts = ClinicalAlert::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'resolved')
            ->count();

        return [
            'total_patients' => $totalPatients,
            'high_risk_patients' => $highRiskPatients,
            'high_risk_percentage' => $totalPatients > 0 ? round(($highRiskPatients / $totalPatients) * 100, 2) : 0,
            'total_assessments' => HealthQuestionnaire::whereBetween('completed_at', [$startDate, $endDate])->count(),
            'total_alerts' => $totalAlerts,
            'resolved_alerts' => $resolvedAlerts,
            'resolution_rate' => $totalAlerts > 0 ? round(($resolvedAlerts / $totalAlerts) * 100, 2) : 0,
            'interventions_recommended' => $interventions,
            'follow_ups_scheduled' => $followUps,
            'sla_breaches' => ClinicalAlert::whereBetween('created_at', [$startDate, $endDate])
                ->where('sla_breached', true)
                ->count()
        ];
    }

    /**
     * Calculate risk distribution
     */
    private function calculateRiskDistribution(): array
    {
        $questionnaires = HealthQuestionnaire::whereBetween('completed_at', [
                $this->report->period_start,
                $this->report->period_end
            ])
            ->whereNotNull('risk_scores')
            ->get();

        $distribution = [
            'low' => 0,
            'medium' => 0,
            'high' => 0,
            'critical' => 0
        ];

        foreach ($questionnaires as $q) {
            $level = $this->calculateRiskLevel($q->risk_scores['overall'] ?? 0);
            $distribution[$level]++;
        }

        $total = array_sum($distribution);
        
        // Add percentages
        $distributionWithPercentages = [];
        foreach ($distribution as $level => $count) {
            $distributionWithPercentages[$level] = [
                'count' => $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0
            ];
        }

        return $distributionWithPercentages;
    }

    /**
     * Get alert summary
     */
    private function getAlertSummary(): array
    {
        $alerts = ClinicalAlert::whereBetween('created_at', [
            $this->report->period_start,
            $this->report->period_end
        ])->get();

        return [
            'total' => $alerts->count(),
            'by_type' => $alerts->groupBy('alert_type')->map->count()->toArray(),
            'by_category' => $alerts->groupBy('category')->map->count()->toArray(),
            'by_priority' => $alerts->groupBy('priority')->map->count()->toArray(),
            'by_status' => $alerts->groupBy('status')->map->count()->toArray(),
            'average_risk_score' => round($alerts->avg('risk_score'), 2),
            'top_risk_factors' => $this->getTopRiskFactors($alerts)
        ];
    }

    /**
     * Get intervention outcomes
     */
    private function getInterventionOutcomes(): array
    {
        $workflows = AlertWorkflow::whereBetween('created_at', [
                $this->report->period_start,
                $this->report->period_end
            ])
            ->where('action_type', 'resolved')
            ->whereNotNull('outcome')
            ->get();

        $outcomes = [
            'total' => $workflows->count(),
            'successful' => $workflows->where('outcome', 'successful')->count(),
            'partially_successful' => $workflows->where('outcome', 'partially_successful')->count(),
            'unsuccessful' => $workflows->where('outcome', 'unsuccessful')->count(),
            'patient_declined' => $workflows->where('outcome', 'patient_declined')->count()
        ];

        $outcomes['success_rate'] = $outcomes['total'] > 0 
            ? round((($outcomes['successful'] + $outcomes['partially_successful']) / $outcomes['total']) * 100, 2)
            : 0;

        return $outcomes;
    }

    /**
     * Get report generator based on format
     */
    private function getReportGenerator()
    {
        return match($this->report->format) {
            'pdf' => new PdfReportGenerator($this->report),
            'excel' => new ExcelReportGenerator($this->report),
            'json' => new JsonReportGenerator($this->report),
            'csv' => new CsvReportGenerator($this->report),
            default => throw new \Exception("Unsupported report format: {$this->report->format}")
        };
    }

    /**
     * Save report file to storage
     */
    private function saveReportFile(array $result): string
    {
        $filename = sprintf(
            '%s_%s_%s.%s',
            $this->report->report_type,
            $this->report->period_start->format('Y-m-d'),
            $this->report->period_end->format('Y-m-d'),
            $this->report->format
        );

        $path = sprintf(
            'clinical-reports/%s/%s/%s',
            now()->format('Y'),
            now()->format('m'),
            $filename
        );

        Storage::disk('reports')->put($path, $result['content']);

        return $path;
    }

    /**
     * Distribute report to recipients
     */
    private function distributeReport(): void
    {
        foreach ($this->report->recipients as $recipient) {
            try {
                Mail::to($recipient)->send(new ClinicalReportReady($this->report));
            } catch (\Exception $e) {
                Log::error("Failed to send report email", [
                    'report_id' => $this->report->id,
                    'recipient' => $recipient,
                    'error' => $e->getMessage()
                ]);
            }
        }

        $this->report->markAsDistributed();
    }

    // Helper methods

    private function calculateRiskLevel(int $score): string
    {
        if ($score >= 150) return 'critical';
        if ($score >= 100) return 'high';
        if ($score >= 50) return 'medium';
        return 'low';
    }

    private function calculateCompletionRate($assessments): float
    {
        $completed = $assessments->where('status', 'completed')->count();
        $total = $assessments->count();
        
        return $total > 0 ? round(($completed / $total) * 100, 2) : 0;
    }

    private function calculateAverageCompletionTime($assessments): int
    {
        $times = $assessments->map(function ($q) {
            return $q->started_at && $q->completed_at 
                ? $q->started_at->diffInMinutes($q->completed_at)
                : 0;
        })->filter()->avg();

        return round($times);
    }

    private function calculateAverageResolutionTime($alerts): string
    {
        $resolved = $alerts->where('status', 'resolved');
        
        if ($resolved->isEmpty()) {
            return 'N/A';
        }

        $totalHours = $resolved->sum(function ($alert) {
            return $alert->created_at->diffInHours($alert->resolved_at);
        });

        $avgHours = $totalHours / $resolved->count();
        
        if ($avgHours < 24) {
            return round($avgHours) . ' hours';
        }
        
        return round($avgHours / 24, 1) . ' days';
    }

    private function groupInterventionsByType($interventions): array
    {
        $types = [];
        
        foreach ($interventions as $workflow) {
            $type = $workflow->interventions_applied[0]['type'] ?? 'unknown';
            $types[$type] = ($types[$type] ?? 0) + 1;
        }
        
        return $types;
    }

    private function getTopRiskFactors($alerts): array
    {
        $factors = [];
        
        foreach ($alerts as $alert) {
            foreach ($alert->risk_factors ?? [] as $factor => $value) {
                if (!isset($factors[$factor])) {
                    $factors[$factor] = 0;
                }
                $factors[$factor]++;
            }
        }
        
        arsort($factors);
        
        return array_slice($factors, 0, 10, true);
    }

    private function identifyKeyFindings(array $data): array
    {
        $findings = [];

        // High risk prevalence
        if (($data['statistics']['high_risk_percentage'] ?? 0) > 20) {
            $findings[] = "High prevalence of at-risk patients ({$data['statistics']['high_risk_percentage']}%)";
        }

        // SLA breaches
        if (($data['statistics']['sla_breaches'] ?? 0) > 5) {
            $findings[] = "Significant SLA breaches detected ({$data['statistics']['sla_breaches']} cases)";
        }

        // Low resolution rate
        if (($data['statistics']['resolution_rate'] ?? 0) < 70) {
            $findings[] = "Below-target alert resolution rate ({$data['statistics']['resolution_rate']}%)";
        }

        // High intervention success
        if (($data['intervention_outcomes']['success_rate'] ?? 0) > 80) {
            $findings[] = "Strong intervention effectiveness ({$data['intervention_outcomes']['success_rate']}% success rate)";
        }

        return $findings;
    }

    private function analyzeTrends(): array
    {
        // This would compare with previous periods
        // For now, returning placeholder data
        return [
            'risk_score_trend' => 'stable',
            'alert_volume_trend' => 'increasing',
            'resolution_time_trend' => 'improving'
        ];
    }

    private function generateRecommendations(array $data): array
    {
        $recommendations = [];

        if (($data['statistics']['high_risk_percentage'] ?? 0) > 20) {
            $recommendations[] = 'Implement targeted intervention program for high-risk population';
        }

        if (($data['statistics']['sla_breaches'] ?? 0) > 0) {
            $recommendations[] = 'Review and optimize alert response workflows to prevent SLA breaches';
        }

        if (($data['statistics']['resolution_rate'] ?? 0) < 80) {
            $recommendations[] = 'Increase clinical staff allocation for alert management';
        }

        if (($data['intervention_outcomes']['patient_declined'] ?? 0) > 10) {
            $recommendations[] = 'Develop patient engagement strategies to improve intervention acceptance';
        }

        return $recommendations;
    }

    private function getKeyMetrics(): array
    {
        // Implementation for key metrics section
        return [];
    }

    private function getExecutiveSummary(): array
    {
        // Implementation for executive summary
        return [];
    }

    private function getRiskTrends(): array
    {
        // Implementation for risk trends analysis
        return [];
    }

    private function getAlertAnalysis(): array
    {
        // Implementation for detailed alert analysis
        return [];
    }

    private function getInterventionAnalysis(): array
    {
        // Implementation for intervention analysis
        return [];
    }

    private function getPopulationHealth(): array
    {
        // Implementation for population health metrics
        return [];
    }

    private function getCostBenefitAnalysis(): array
    {
        // Implementation for cost-benefit analysis
        return [];
    }
}