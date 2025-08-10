<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClinicalAlert;
use App\Models\ClinicalReport;
use App\Models\AlertWorkflow;
use App\Models\HealthQuestionnaire;
use App\Models\Beneficiary;
use App\Jobs\ProcessHealthRisksJob;
use App\Jobs\GenerateClinicalReportJob;
use App\Services\PredictiveHealthService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class AdminHealthRiskController extends Controller
{
    protected PredictiveHealthService $predictiveService;

    public function __construct(PredictiveHealthService $predictiveService)
    {
        $this->middleware(['auth:sanctum', 'role:admin,clinical_admin,clinical_staff']);
        $this->predictiveService = $predictiveService;
    }

    /**
     * Get dashboard overview with key metrics
     */
    public function dashboard(Request $request): JsonResponse
    {
        $timeframe = $request->get('timeframe', '7days');
        $cacheKey = "admin_dashboard_{$timeframe}";
        
        $data = Cache::remember($cacheKey, 300, function () use ($timeframe) {
            $startDate = $this->getStartDate($timeframe);
            
            return [
                'metrics' => $this->getDashboardMetrics($startDate),
                'alerts' => $this->getRecentAlerts($startDate),
                'risk_distribution' => $this->getRiskDistribution($startDate),
                'trends' => $this->getTrends($startDate),
                'interventions' => $this->getInterventionStats($startDate)
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'generated_at' => now()->toIso8601String()
        ]);
    }

    /**
     * Get list of clinical alerts with filters
     */
    public function getAlerts(Request $request): JsonResponse
    {
        $query = ClinicalAlert::with(['beneficiary', 'assignedTo', 'questionnaire']);

        // Apply filters
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('priority')) {
            $query->whereIn('priority', (array) $request->priority);
        }

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->has('date_from')) {
            $query->where('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('created_at', '<=', $request->date_to);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $alerts = $query->paginate($request->get('per_page', 25));

        return response()->json([
            'success' => true,
            'data' => $alerts
        ]);
    }

    /**
     * Get single alert details with full context
     */
    public function getAlert($id): JsonResponse
    {
        $alert = ClinicalAlert::with([
            'beneficiary',
            'questionnaire',
            'assignedTo',
            'acknowledgedBy',
            'resolvedBy',
            'workflows.performedBy'
        ])->findOrFail($id);

        // Get related alerts for the same beneficiary
        $relatedAlerts = ClinicalAlert::where('beneficiary_id', $alert->beneficiary_id)
            ->where('id', '!=', $alert->id)
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'alert' => $alert,
                'related_alerts' => $relatedAlerts,
                'risk_history' => $this->getBeneficiaryRiskHistory($alert->beneficiary_id),
                'available_interventions' => $this->getAvailableInterventions($alert)
            ]
        ]);
    }

    /**
     * Acknowledge an alert
     */
    public function acknowledgeAlert($id): JsonResponse
    {
        $alert = ClinicalAlert::findOrFail($id);
        
        if (!in_array($alert->status, ['pending'])) {
            return response()->json([
                'success' => false,
                'message' => 'Alert cannot be acknowledged in current status'
            ], 400);
        }

        DB::transaction(function () use ($alert) {
            $alert->update([
                'status' => 'acknowledged',
                'acknowledged_by' => auth()->id(),
                'acknowledged_at' => now()
            ]);

            AlertWorkflow::create([
                'alert_id' => $alert->id,
                'beneficiary_id' => $alert->beneficiary_id,
                'action_type' => 'alert_acknowledged',
                'action_description' => 'Alert acknowledged by clinical staff',
                'performed_by' => auth()->id()
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Alert acknowledged successfully'
        ]);
    }

    /**
     * Create intervention for an alert
     */
    public function createIntervention(Request $request, $alertId): JsonResponse
    {
        $validated = $request->validate([
            'intervention_type' => 'required|string',
            'description' => 'required|string',
            'clinical_notes' => 'nullable|string',
            'resources_needed' => 'nullable|array',
            'expected_outcome' => 'nullable|string',
            'follow_up_date' => 'nullable|date',
            'assigned_to' => 'nullable|exists:users,id'
        ]);

        $alert = ClinicalAlert::findOrFail($alertId);

        DB::transaction(function () use ($alert, $validated) {
            // Update alert status
            $alert->update([
                'status' => 'in_progress',
                'assigned_to' => $validated['assigned_to'] ?? $alert->assigned_to
            ]);

            // Create workflow entry
            AlertWorkflow::create([
                'alert_id' => $alert->id,
                'beneficiary_id' => $alert->beneficiary_id,
                'action_type' => 'intervention_planned',
                'action_description' => $validated['description'],
                'clinical_notes' => $validated['clinical_notes'] ?? null,
                'interventions_applied' => [[
                    'type' => $validated['intervention_type'],
                    'description' => $validated['description'],
                    'resources' => $validated['resources_needed'] ?? [],
                    'expected_outcome' => $validated['expected_outcome'] ?? ''
                ]],
                'next_review_date' => $validated['follow_up_date'] ?? null,
                'assigned_to_next' => $validated['assigned_to'] ?? null,
                'performed_by' => auth()->id()
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Intervention created successfully'
        ]);
    }

    /**
     * Resolve an alert
     */
    public function resolveAlert(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'resolution_notes' => 'required|string',
            'outcome' => 'required|in:successful,partially_successful,unsuccessful',
            'outcome_metrics' => 'nullable|array',
            'follow_up_required' => 'boolean',
            'follow_up_date' => 'required_if:follow_up_required,true|nullable|date'
        ]);

        $alert = ClinicalAlert::findOrFail($id);

        DB::transaction(function () use ($alert, $validated) {
            $alert->update([
                'status' => 'resolved',
                'resolved_by' => auth()->id(),
                'resolved_at' => now(),
                'resolution_notes' => $validated['resolution_notes']
            ]);

            AlertWorkflow::create([
                'alert_id' => $alert->id,
                'beneficiary_id' => $alert->beneficiary_id,
                'action_type' => 'resolved',
                'action_description' => 'Alert resolved',
                'clinical_notes' => $validated['resolution_notes'],
                'outcome' => $validated['outcome'],
                'outcome_metrics' => $validated['outcome_metrics'] ?? null,
                'next_review_date' => $validated['follow_up_date'] ?? null,
                'performed_by' => auth()->id()
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Alert resolved successfully'
        ]);
    }

    /**
     * Get clinical reports list
     */
    public function getReports(Request $request): JsonResponse
    {
        $query = ClinicalReport::with('generatedBy');

        // Apply filters
        if ($request->has('report_type')) {
            $query->where('report_type', $request->report_type);
        }

        if ($request->has('format')) {
            $query->where('format', $request->format);
        }

        if ($request->has('status')) {
            $query->where('generation_status', $request->status);
        }

        if ($request->has('date_from')) {
            $query->where('period_start', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('period_end', '<=', $request->date_to);
        }

        $reports = $query->orderBy('created_at', 'desc')
                        ->paginate($request->get('per_page', 25));

        return response()->json([
            'success' => true,
            'data' => $reports
        ]);
    }

    /**
     * Generate a new clinical report
     */
    public function generateReport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'report_type' => 'required|in:daily_summary,weekly_analysis,monthly_comprehensive,quarterly_trends,annual_review,custom_period',
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
            'format' => 'required|in:pdf,excel,json,csv',
            'sections' => 'nullable|array',
            'filters' => 'nullable|array',
            'recipients' => 'nullable|array',
            'schedule_cron' => 'nullable|string'
        ]);

        // Create report record
        $report = ClinicalReport::create([
            'report_type' => $validated['report_type'],
            'period_start' => $validated['period_start'],
            'period_end' => $validated['period_end'],
            'format' => $validated['format'],
            'sections_included' => $validated['sections'] ?? null,
            'filters_applied' => $validated['filters'] ?? null,
            'recipients' => $validated['recipients'] ?? [],
            'generated_by' => auth()->id(),
            'is_scheduled' => !empty($validated['schedule_cron']),
            'schedule_cron' => $validated['schedule_cron'] ?? null
        ]);

        // Dispatch job to generate report
        GenerateClinicalReportJob::dispatch($report);

        return response()->json([
            'success' => true,
            'message' => 'Report generation started',
            'data' => [
                'report_id' => $report->id,
                'report_uuid' => $report->report_uuid
            ]
        ]);
    }

    /**
     * Download a clinical report
     */
    public function downloadReport($id): JsonResponse
    {
        $report = ClinicalReport::findOrFail($id);

        if ($report->generation_status !== 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Report is not ready for download'
            ], 400);
        }

        if (!$report->canBeViewedBy(auth()->user())) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to download this report'
            ], 403);
        }

        $report->incrementViewCount();

        return response()->json([
            'success' => true,
            'data' => [
                'download_url' => $report->getDownloadUrl(),
                'expires_in' => '30 minutes'
            ]
        ]);
    }

    /**
     * Get workflow history for an alert
     */
    public function getAlertWorkflow($alertId): JsonResponse
    {
        $workflows = AlertWorkflow::with(['performedBy', 'assignedToNext'])
            ->where('alert_id', $alertId)
            ->orderBy('action_timestamp', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $workflows
        ]);
    }

    /**
     * Get population health analytics
     */
    public function getPopulationAnalytics(Request $request): JsonResponse
    {
        $timeframe = $request->get('timeframe', '30days');
        $groupBy = $request->get('group_by', 'risk_category');
        
        $analytics = Cache::remember("population_analytics_{$timeframe}_{$groupBy}", 900, function () use ($timeframe, $groupBy) {
            $startDate = $this->getStartDate($timeframe);
            
            return [
                'summary' => $this->getPopulationSummary($startDate),
                'risk_trends' => $this->getRiskTrends($startDate, $groupBy),
                'intervention_effectiveness' => $this->getInterventionEffectiveness($startDate),
                'predictive_insights' => $this->getPredictiveInsights($startDate)
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $analytics
        ]);
    }

    /**
     * Process health risks manually (trigger job)
     */
    public function processRisks(): JsonResponse
    {
        ProcessHealthRisksJob::dispatch();

        return response()->json([
            'success' => true,
            'message' => 'Risk processing job dispatched'
        ]);
    }

    // Private helper methods

    private function getStartDate(string $timeframe): Carbon
    {
        return match($timeframe) {
            '24hours' => now()->subDay(),
            '7days' => now()->subDays(7),
            '30days' => now()->subDays(30),
            '90days' => now()->subDays(90),
            '1year' => now()->subYear(),
            default => now()->subDays(7)
        };
    }

    private function getDashboardMetrics(Carbon $startDate): array
    {
        return [
            'total_assessments' => HealthQuestionnaire::where('created_at', '>=', $startDate)->count(),
            'critical_alerts' => ClinicalAlert::where('created_at', '>=', $startDate)
                ->whereIn('priority', ['critical', 'emergency'])
                ->count(),
            'active_alerts' => ClinicalAlert::active()->count(),
            'sla_breached' => ClinicalAlert::where('sla_breached', true)->active()->count(),
            'interventions_today' => AlertWorkflow::where('action_type', 'intervention_planned')
                ->whereDate('created_at', today())
                ->count(),
            'resolution_rate' => $this->calculateResolutionRate($startDate)
        ];
    }

    private function getRecentAlerts(Carbon $startDate): array
    {
        return ClinicalAlert::with(['beneficiary', 'assignedTo'])
            ->where('created_at', '>=', $startDate)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->toArray();
    }

    private function getRiskDistribution(Carbon $startDate): array
    {
        $questionnaires = HealthQuestionnaire::where('completed_at', '>=', $startDate)
            ->whereNotNull('risk_scores')
            ->get();

        $distribution = [
            'low' => 0,
            'medium' => 0,
            'high' => 0,
            'critical' => 0
        ];

        foreach ($questionnaires as $q) {
            $overallScore = $q->risk_scores['overall'] ?? 0;
            
            if ($overallScore >= 150) {
                $distribution['critical']++;
            } elseif ($overallScore >= 100) {
                $distribution['high']++;
            } elseif ($overallScore >= 50) {
                $distribution['medium']++;
            } else {
                $distribution['low']++;
            }
        }

        return $distribution;
    }

    private function getTrends(Carbon $startDate): array
    {
        // Implementation would calculate trends over time
        return [
            'alerts_trend' => 'increasing',
            'risk_score_trend' => 'stable',
            'intervention_success_trend' => 'improving'
        ];
    }

    private function getInterventionStats(Carbon $startDate): array
    {
        $workflows = AlertWorkflow::where('action_type', 'resolved')
            ->where('created_at', '>=', $startDate)
            ->get();

        $successful = $workflows->where('outcome', 'successful')->count();
        $partial = $workflows->where('outcome', 'partially_successful')->count();
        $total = $workflows->count();

        return [
            'total_interventions' => $total,
            'successful' => $successful,
            'partially_successful' => $partial,
            'success_rate' => $total > 0 ? round(($successful / $total) * 100, 2) : 0
        ];
    }

    private function calculateResolutionRate(Carbon $startDate): float
    {
        $totalAlerts = ClinicalAlert::where('created_at', '>=', $startDate)->count();
        $resolvedAlerts = ClinicalAlert::where('created_at', '>=', $startDate)
            ->where('status', 'resolved')
            ->count();

        return $totalAlerts > 0 ? round(($resolvedAlerts / $totalAlerts) * 100, 2) : 0;
    }

    private function getBeneficiaryRiskHistory($beneficiaryId): array
    {
        return HealthQuestionnaire::where('beneficiary_id', $beneficiaryId)
            ->whereNotNull('risk_scores')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($q) {
                return [
                    'date' => $q->created_at->format('Y-m-d'),
                    'overall_score' => $q->risk_scores['overall'] ?? 0,
                    'categories' => $q->risk_scores['categories'] ?? []
                ];
            })
            ->toArray();
    }

    private function getAvailableInterventions(ClinicalAlert $alert): array
    {
        // Would fetch from intervention_templates table based on alert category and risk level
        return [
            [
                'type' => 'phone_consultation',
                'name' => 'Phone Consultation',
                'typical_duration' => '30 minutes'
            ],
            [
                'type' => 'in_person_assessment',
                'name' => 'In-Person Assessment',
                'typical_duration' => '1 hour'
            ],
            [
                'type' => 'referral_specialist',
                'name' => 'Referral to Specialist',
                'typical_duration' => '1-2 weeks'
            ]
        ];
    }

    private function getPopulationSummary(Carbon $startDate): array
    {
        $totalBeneficiaries = Beneficiary::count();
        $assessedBeneficiaries = HealthQuestionnaire::where('created_at', '>=', $startDate)
            ->distinct('beneficiary_id')
            ->count('beneficiary_id');

        return [
            'total_population' => $totalBeneficiaries,
            'assessed_population' => $assessedBeneficiaries,
            'coverage_rate' => $totalBeneficiaries > 0 ? round(($assessedBeneficiaries / $totalBeneficiaries) * 100, 2) : 0
        ];
    }

    private function getRiskTrends(Carbon $startDate, string $groupBy): array
    {
        // Implementation would analyze risk trends over time grouped by specified dimension
        return [];
    }

    private function getInterventionEffectiveness(Carbon $startDate): array
    {
        // Implementation would analyze intervention outcomes
        return [];
    }

    private function getPredictiveInsights(Carbon $startDate): array
    {
        // Use the new PredictiveHealthService for actual ML predictions
        $populationTrends = $this->predictiveService->analyzePopulationTrends([
            'date_from' => $startDate->toDateString()
        ]);
        
        return [
            'high_risk_predictions' => $populationTrends['predictions'] ?? [],
            'recommended_focus_areas' => $populationTrends['intervention_opportunities'] ?? [],
            'emerging_risks' => $populationTrends['emerging_risks'] ?? [],
            'cost_impact' => $populationTrends['cost_impact_analysis'] ?? []
        ];
    }
    
    /**
     * Get ML predictions for a specific beneficiary
     */
    public function getPredictions($beneficiaryId, Request $request): JsonResponse
    {
        $daysAhead = $request->input('days_ahead', 30);
        
        $predictions = $this->predictiveService->predictFutureRisk($beneficiaryId, $daysAhead);
        
        return response()->json([
            'success' => true,
            'data' => $predictions
        ]);
    }
    
    /**
     * Get similar patients for a beneficiary
     */
    public function getSimilarPatients($beneficiaryId, Request $request): JsonResponse
    {
        $limit = $request->input('limit', 10);
        
        $similarPatients = $this->predictiveService->findSimilarPatients($beneficiaryId, $limit);
        
        return response()->json([
            'success' => true,
            'data' => $similarPatients
        ]);
    }
    
    /**
     * Generate AI-powered interventions based on risk profile
     */
    public function generateInterventions(Request $request): JsonResponse
    {
        $riskProfile = $request->validate([
            'overall_risk_score' => 'required|numeric',
            'categories' => 'required|array',
            'categories.mental_health' => 'nullable|numeric',
            'categories.cardiovascular' => 'nullable|numeric',
            'categories.substance_abuse' => 'nullable|numeric',
            'categories.chronic_disease' => 'nullable|numeric'
        ]);
        
        $interventions = $this->predictiveService->generateInterventions($riskProfile);
        
        return response()->json([
            'success' => true,
            'data' => $interventions
        ]);
    }
    
    /**
     * Train ML models with new data
     */
    public function trainModels(Request $request): JsonResponse
    {
        $trainingData = $request->input('training_data', []);
        
        // In production, this would be a queued job
        $result = $this->predictiveService->trainModels($trainingData);
        
        return response()->json([
            'success' => true,
            'data' => $result,
            'message' => 'Model training initiated successfully'
        ]);
    }
}