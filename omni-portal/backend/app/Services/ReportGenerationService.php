<?php

namespace App\Services;

use App\Models\ClinicalAlert;
use App\Models\ClinicalReport;
use App\Models\Beneficiary;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Collection;
use Carbon\Carbon;
use App\Services\SimplePdfGenerator;
// External package imports (conditional loading in methods)
// use Barryvdh\DomPDF\Facade\Pdf;
// use PhpOffice\PhpSpreadsheet\Spreadsheet;
// use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
// use PhpOffice\PhpSpreadsheet\Writer\Csv;
// use PhpOffice\PhpSpreadsheet\Style\Fill;
// use PhpOffice\PhpSpreadsheet\Style\Color;
// use PhpOffice\PhpSpreadsheet\Style\Alignment;
// use PhpOffice\PhpSpreadsheet\Style\Border;

class ReportGenerationService
{
    /**
     * Generate a clinical report based on parameters
     *
     * @param ClinicalReport $report
     * @return string File path
     */
    public function generateReport(ClinicalReport $report): string
    {
        try {
            Log::info("Generating report {$report->id} in format {$report->format}");
            
            // Update status to processing
            $report->update(['status' => 'processing']);
            
            // Get data based on report parameters
            $data = $this->gatherReportData($report);
            
            // Generate report in specified format
            $filePath = match($report->format) {
                'pdf' => $this->generatePdfReport($report, $data),
                'excel' => $this->generateExcelReport($report, $data),
                'csv' => $this->generateCsvReport($report, $data),
                'json' => $this->generateJsonReport($report, $data),
                default => throw new \Exception("Unsupported format: {$report->format}")
            };
            
            // Update report with file information
            $fileSize = Storage::size($filePath);
            $report->update([
                'status' => 'completed',
                'file_path' => $filePath,
                'file_url' => Storage::url($filePath),
                'file_size' => $fileSize,
                'generated_at' => now(),
                'metadata' => array_merge($report->metadata ?? [], [
                    'processing_time' => now()->diffInSeconds($report->created_at),
                    'total_alerts' => $data['alerts']->count(),
                    'total_beneficiaries' => $data['beneficiaries_count'] ?? 0
                ])
            ]);
            
            Log::info("Report {$report->id} generated successfully at {$filePath}");
            
            return $filePath;
            
        } catch (\Exception $e) {
            Log::error("Error generating report {$report->id}: " . $e->getMessage());
            
            $report->update([
                'status' => 'failed',
                'metadata' => array_merge($report->metadata ?? [], [
                    'error' => $e->getMessage(),
                    'failed_at' => now()->toDateTimeString()
                ])
            ]);
            
            throw $e;
        }
    }
    
    /**
     * Gather data for the report based on parameters
     */
    protected function gatherReportData(ClinicalReport $report): array
    {
        $parameters = $report->parameters;
        $query = ClinicalAlert::with(['beneficiary', 'questionnaire', 'workflows']);
        
        // Apply timeframe filter
        $timeframe = $parameters['timeframe'] ?? '30days';
        $startDate = $this->calculateStartDate($timeframe);
        $query->where('created_at', '>=', $startDate);
        
        // Apply filters
        if (!empty($parameters['filters']['priority'])) {
            $query->whereIn('priority', $parameters['filters']['priority']);
        }
        
        if (!empty($parameters['filters']['categories'])) {
            $query->whereIn('category', $parameters['filters']['categories']);
        }
        
        if (!empty($parameters['filters']['beneficiary_ids'])) {
            $query->whereIn('beneficiary_id', $parameters['filters']['beneficiary_ids']);
        }
        
        $alerts = $query->orderBy('created_at', 'desc')->get();
        
        // Calculate additional metrics
        $metrics = $this->calculateMetrics($alerts);
        
        // Get category distribution
        $categoryDistribution = $alerts->groupBy('category')->map->count();
        
        // Get priority distribution
        $priorityDistribution = $alerts->groupBy('priority')->map->count();
        
        // Get top beneficiaries
        $topBeneficiaries = $alerts->groupBy('beneficiary_id')
            ->map(function ($group) {
                $beneficiary = $group->first()->beneficiary;
                return [
                    'beneficiary' => $beneficiary,
                    'alert_count' => $group->count(),
                    'average_risk_score' => $group->avg('risk_score')
                ];
            })
            ->sortByDesc('alert_count')
            ->take(10);
        
        return [
            'report' => $report,
            'alerts' => $alerts,
            'metrics' => $metrics,
            'category_distribution' => $categoryDistribution,
            'priority_distribution' => $priorityDistribution,
            'top_beneficiaries' => $topBeneficiaries,
            'beneficiaries_count' => $alerts->pluck('beneficiary_id')->unique()->count(),
            'start_date' => $startDate,
            'end_date' => now(),
            'generated_by' => $report->generatedBy
        ];
    }
    
    /**
     * Calculate metrics from alerts collection
     */
    protected function calculateMetrics(Collection $alerts): array
    {
        $totalAlerts = $alerts->count();
        $resolvedAlerts = $alerts->where('status', 'resolved')->count();
        $overdueAlerts = $alerts->where('sla_status', 'overdue')->count();
        
        return [
            'total_alerts' => $totalAlerts,
            'resolved_alerts' => $resolvedAlerts,
            'pending_alerts' => $alerts->where('status', 'pending')->count(),
            'escalated_alerts' => $alerts->where('status', 'escalated')->count(),
            'resolution_rate' => $totalAlerts > 0 ? round(($resolvedAlerts / $totalAlerts) * 100, 2) : 0,
            'sla_compliance' => $totalAlerts > 0 ? round((($totalAlerts - $overdueAlerts) / $totalAlerts) * 100, 2) : 100,
            'average_risk_score' => round($alerts->avg('risk_score'), 2),
            'critical_alerts' => $alerts->whereIn('priority', ['emergency', 'urgent'])->count(),
            'average_resolution_time' => $this->calculateAverageResolutionTime($alerts)
        ];
    }
    
    /**
     * Calculate average resolution time in hours
     */
    protected function calculateAverageResolutionTime(Collection $alerts): float
    {
        $resolvedAlerts = $alerts->where('status', 'resolved')
            ->filter(fn($alert) => $alert->resolved_at);
        
        if ($resolvedAlerts->isEmpty()) {
            return 0;
        }
        
        $totalHours = $resolvedAlerts->sum(function ($alert) {
            return $alert->created_at->diffInHours($alert->resolved_at);
        });
        
        return round($totalHours / $resolvedAlerts->count(), 2);
    }
    
    /**
     * Generate PDF report
     */
    protected function generatePdfReport(ClinicalReport $report, array $data): string
    {
        // Check if DomPDF is available
        if (class_exists('Barryvdh\DomPDF\Facade\Pdf')) {
            $pdfClass = 'Barryvdh\DomPDF\Facade\Pdf';
            $pdf = $pdfClass::loadView('reports.clinical-report', $data);
            $pdf->setPaper('A4', 'portrait');
            
            $fileName = "clinical-report-{$report->id}-" . now()->format('YmdHis') . ".pdf";
            $filePath = "reports/{$fileName}";
            
            Storage::put($filePath, $pdf->output());
            
            return $filePath;
        } else {
            // Use simple PDF generator as fallback
            Log::info("Using SimplePdfGenerator as DomPDF is not installed");
            $simplePdf = new SimplePdfGenerator();
            return $simplePdf->generate($report, $data);
        }
    }
    
    /**
     * Generate Excel report
     */
    protected function generateExcelReport(ClinicalReport $report, array $data): string
    {
        // Check if PhpSpreadsheet is available
        if (!class_exists('PhpOffice\PhpSpreadsheet\Spreadsheet')) {
            Log::info("PhpSpreadsheet not installed, generating CSV instead");
            return $this->generateCsvReport($report, $data);
        }
        
        $spreadsheetClass = 'PhpOffice\PhpSpreadsheet\Spreadsheet';
        $spreadsheet = new $spreadsheetClass();
        
        // Summary Sheet
        $summarySheet = $spreadsheet->getActiveSheet();
        $summarySheet->setTitle('Resumo');
        $this->fillSummarySheet($summarySheet, $data);
        
        // Alerts Sheet
        $alertsSheet = $spreadsheet->createSheet();
        $alertsSheet->setTitle('Alertas');
        $this->fillAlertsSheet($alertsSheet, $data['alerts']);
        
        // Analytics Sheet
        $analyticsSheet = $spreadsheet->createSheet();
        $analyticsSheet->setTitle('Análises');
        $this->fillAnalyticsSheet($analyticsSheet, $data);
        
        // Save file
        $fileName = "clinical-report-{$report->id}-" . now()->format('YmdHis') . ".xlsx";
        $filePath = "reports/{$fileName}";
        $tempPath = storage_path('app/' . $filePath);
        
        // Ensure directory exists
        Storage::makeDirectory('reports');
        
        $xlsxClass = 'PhpOffice\PhpSpreadsheet\Writer\Xlsx';
        $writer = new $xlsxClass($spreadsheet);
        $writer->save($tempPath);
        
        return $filePath;
    }
    
    /**
     * Fill summary sheet with report overview
     */
    protected function fillSummarySheet($sheet, array $data): void
    {
        // Title
        $sheet->setCellValue('A1', 'Relatório Clínico de Riscos de Saúde');
        $sheet->mergeCells('A1:F1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        $alignmentClass = 'PhpOffice\PhpSpreadsheet\Style\Alignment';
        if (class_exists($alignmentClass)) {
            $sheet->getStyle('A1')->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
        }
        
        // Report info
        $sheet->setCellValue('A3', 'Tipo de Relatório:');
        $sheet->setCellValue('B3', ucfirst($data['report']->report_type));
        $sheet->setCellValue('A4', 'Período:');
        $sheet->setCellValue('B4', $data['start_date']->format('d/m/Y') . ' - ' . $data['end_date']->format('d/m/Y'));
        $sheet->setCellValue('A5', 'Gerado por:');
        $sheet->setCellValue('B5', $data['generated_by']->name ?? 'Sistema');
        
        // Metrics
        $sheet->setCellValue('A7', 'Métricas Principais');
        $sheet->getStyle('A7')->getFont()->setBold(true)->setSize(14);
        
        $row = 9;
        foreach ($data['metrics'] as $key => $value) {
            $label = ucwords(str_replace('_', ' ', $key));
            $sheet->setCellValue("A{$row}", $label . ':');
            $sheet->setCellValue("B{$row}", $value);
            $row++;
        }
        
        // Style adjustments
        $sheet->getColumnDimension('A')->setWidth(30);
        $sheet->getColumnDimension('B')->setWidth(20);
    }
    
    /**
     * Fill alerts sheet with detailed alert data
     */
    protected function fillAlertsSheet($sheet, Collection $alerts): void
    {
        // Headers
        $headers = [
            'ID', 'Beneficiário', 'CPF', 'Categoria', 'Prioridade', 
            'Score de Risco', 'Status', 'SLA', 'Criado em', 'Resolvido em'
        ];
        
        foreach ($headers as $col => $header) {
            $cell = chr(65 + $col) . '1';
            $sheet->setCellValue($cell, $header);
            $sheet->getStyle($cell)->getFont()->setBold(true);
            $fillClass = 'PhpOffice\PhpSpreadsheet\Style\Fill';
            if (class_exists($fillClass)) {
                $sheet->getStyle($cell)->getFill()
                    ->setFillType($fillClass::FILL_SOLID)
                    ->getStartColor()->setARGB('FFE0E0E0');
            }
        }
        
        // Data
        $row = 2;
        foreach ($alerts as $alert) {
            $sheet->setCellValue("A{$row}", $alert->id);
            $sheet->setCellValue("B{$row}", $alert->beneficiary->full_name ?? 'N/A');
            $sheet->setCellValue("C{$row}", $alert->beneficiary->cpf ?? 'N/A');
            $sheet->setCellValue("D{$row}", ucfirst(str_replace('_', ' ', $alert->category)));
            $sheet->setCellValue("E{$row}", ucfirst($alert->priority));
            $sheet->setCellValue("F{$row}", $alert->risk_score);
            $sheet->setCellValue("G{$row}", ucfirst($alert->status));
            $sheet->setCellValue("H{$row}", $alert->sla_status);
            $sheet->setCellValue("I{$row}", $alert->created_at->format('d/m/Y H:i'));
            $sheet->setCellValue("J{$row}", $alert->resolved_at ? $alert->resolved_at->format('d/m/Y H:i') : '-');
            
            // Color code by priority
            $priorityColor = match($alert->priority) {
                'emergency' => 'FFFF0000',
                'urgent' => 'FFFF6600',
                'high' => 'FFFFFF00',
                'medium' => 'FF0099FF',
                default => 'FFCCCCCC'
            };
            $fillClass = 'PhpOffice\PhpSpreadsheet\Style\Fill';
            if (class_exists($fillClass)) {
                $sheet->getStyle("E{$row}")->getFill()
                    ->setFillType($fillClass::FILL_SOLID)
                    ->getStartColor()->setARGB($priorityColor);
            }
            
            $row++;
        }
        
        // Auto-size columns
        foreach (range('A', 'J') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }
    }
    
    /**
     * Fill analytics sheet with charts data
     */
    protected function fillAnalyticsSheet($sheet, array $data): void
    {
        // Category Distribution
        $sheet->setCellValue('A1', 'Distribuição por Categoria');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        
        $row = 3;
        foreach ($data['category_distribution'] as $category => $count) {
            $sheet->setCellValue("A{$row}", ucfirst(str_replace('_', ' ', $category)));
            $sheet->setCellValue("B{$row}", $count);
            $row++;
        }
        
        // Priority Distribution
        $sheet->setCellValue('D1', 'Distribuição por Prioridade');
        $sheet->getStyle('D1')->getFont()->setBold(true)->setSize(14);
        
        $row = 3;
        foreach ($data['priority_distribution'] as $priority => $count) {
            $sheet->setCellValue("D{$row}", ucfirst($priority));
            $sheet->setCellValue("E{$row}", $count);
            $row++;
        }
        
        // Top Beneficiaries
        $sheet->setCellValue('A10', 'Top 10 Beneficiários com Mais Alertas');
        $sheet->getStyle('A10')->getFont()->setBold(true)->setSize(14);
        
        $sheet->setCellValue('A12', 'Nome');
        $sheet->setCellValue('B12', 'Alertas');
        $sheet->setCellValue('C12', 'Score Médio');
        
        $row = 13;
        foreach ($data['top_beneficiaries'] as $item) {
            $sheet->setCellValue("A{$row}", $item['beneficiary']->full_name ?? 'N/A');
            $sheet->setCellValue("B{$row}", $item['alert_count']);
            $sheet->setCellValue("C{$row}", round($item['average_risk_score'], 2));
            $row++;
        }
    }
    
    /**
     * Generate CSV report
     */
    protected function generateCsvReport(ClinicalReport $report, array $data): string
    {
        // Headers
        $headers = [
            'ID do Alerta', 'Nome do Beneficiário', 'CPF', 'Categoria', 
            'Prioridade', 'Score de Risco', 'Status', 'Status SLA', 
            'Criado em', 'Resolvido em', 'Tempo de Resolução (horas)'
        ];
        
        // Create CSV content
        $csvContent = [];
        $csvContent[] = $headers;
        
        // Add data rows
        foreach ($data['alerts'] as $alert) {
            $row = [
                $alert->id,
                $alert->beneficiary->full_name ?? 'N/A',
                $alert->beneficiary->cpf ?? 'N/A',
                $alert->category,
                $alert->priority,
                $alert->risk_score,
                $alert->status,
                $alert->sla_status,
                $alert->created_at->format('Y-m-d H:i:s'),
                $alert->resolved_at ? $alert->resolved_at->format('Y-m-d H:i:s') : '',
                $alert->resolved_at ? $alert->created_at->diffInHours($alert->resolved_at) : ''
            ];
            $csvContent[] = $row;
        }
        
        // Generate CSV string
        $output = fopen('php://temp', 'r+');
        foreach ($csvContent as $row) {
            fputcsv($output, $row);
        }
        rewind($output);
        $csvData = stream_get_contents($output);
        fclose($output);
        
        // Save file
        $fileName = "clinical-report-{$report->id}-" . now()->format('YmdHis') . ".csv";
        $filePath = "reports/{$fileName}";
        
        Storage::makeDirectory('reports');
        Storage::put($filePath, $csvData);
        
        return $filePath;
    }
    
    /**
     * Generate JSON report
     */
    protected function generateJsonReport(ClinicalReport $report, array $data): string
    {
        $jsonData = [
            'report' => [
                'id' => $report->id,
                'type' => $report->report_type,
                'format' => $report->format,
                'generated_at' => now()->toIso8601String(),
                'generated_by' => $data['generated_by']->name ?? 'System',
                'parameters' => $report->parameters
            ],
            'summary' => [
                'period' => [
                    'start' => $data['start_date']->toIso8601String(),
                    'end' => $data['end_date']->toIso8601String()
                ],
                'metrics' => $data['metrics'],
                'distributions' => [
                    'by_category' => $data['category_distribution']->toArray(),
                    'by_priority' => $data['priority_distribution']->toArray()
                ]
            ],
            'alerts' => $data['alerts']->map(function ($alert) {
                return [
                    'id' => $alert->id,
                    'beneficiary' => [
                        'id' => $alert->beneficiary_id,
                        'name' => $alert->beneficiary->full_name ?? null,
                        'cpf' => $alert->beneficiary->cpf ?? null
                    ],
                    'category' => $alert->category,
                    'priority' => $alert->priority,
                    'risk_score' => $alert->risk_score,
                    'status' => $alert->status,
                    'sla_status' => $alert->sla_status,
                    'clinical_recommendations' => $alert->clinical_recommendations,
                    'intervention_options' => $alert->intervention_options,
                    'created_at' => $alert->created_at->toIso8601String(),
                    'acknowledged_at' => $alert->acknowledged_at?->toIso8601String(),
                    'resolved_at' => $alert->resolved_at?->toIso8601String(),
                    'workflows' => $alert->workflows->map(function ($workflow) {
                        return [
                            'action_type' => $workflow->action_type,
                            'action_description' => $workflow->action_description,
                            'performed_at' => $workflow->performed_at->toIso8601String(),
                            'performed_by' => $workflow->performedBy->name ?? null
                        ];
                    })
                ];
            }),
            'top_beneficiaries' => $data['top_beneficiaries']->map(function ($item) {
                return [
                    'beneficiary' => [
                        'id' => $item['beneficiary']->id,
                        'name' => $item['beneficiary']->full_name,
                        'cpf' => $item['beneficiary']->cpf
                    ],
                    'alert_count' => $item['alert_count'],
                    'average_risk_score' => round($item['average_risk_score'], 2)
                ];
            })->values()
        ];
        
        $fileName = "clinical-report-{$report->id}-" . now()->format('YmdHis') . ".json";
        $filePath = "reports/{$fileName}";
        
        Storage::put($filePath, json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        return $filePath;
    }
    
    /**
     * Calculate start date based on timeframe
     */
    protected function calculateStartDate(string $timeframe): Carbon
    {
        return match($timeframe) {
            '24hours' => now()->subHours(24),
            '7days' => now()->subDays(7),
            '30days' => now()->subDays(30),
            '90days' => now()->subDays(90),
            default => now()->subDays(30)
        };
    }
}