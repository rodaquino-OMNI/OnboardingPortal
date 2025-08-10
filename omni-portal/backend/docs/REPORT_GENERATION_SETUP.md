# Report Generation Setup Guide

## Overview

The OnboardingPortal health risk management system includes comprehensive report generation capabilities supporting multiple formats (PDF, Excel, CSV, JSON). The system is designed to work with or without external dependencies.

## Basic Setup (No External Dependencies)

The system works out-of-the-box with basic functionality:

- **PDF**: Generates HTML-based reports that can be printed to PDF
- **Excel**: Falls back to CSV format
- **CSV**: Native PHP implementation
- **JSON**: Native PHP implementation

## Full Setup (With External Packages)

For production-quality reports with advanced features, install the following packages:

### 1. PDF Generation (DomPDF)

```bash
composer require barryvdh/laravel-dompdf
```

After installation, publish the configuration:

```bash
php artisan vendor:publish --provider="Barryvdh\DomPDF\ServiceProvider"
```

Benefits:
- True PDF generation with proper formatting
- Support for images and complex layouts
- Page headers/footers
- Watermarks

### 2. Excel Generation (PhpSpreadsheet)

```bash
composer require phpoffice/phpspreadsheet
```

Benefits:
- Multi-sheet workbooks
- Advanced formatting and styling
- Charts and graphs
- Formula support
- Native .xlsx format

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Report Generation
REPORT_STORAGE_PATH=reports
REPORT_MAX_SIZE_MB=50
REPORT_RETENTION_DAYS=90

# PDF Settings (if using DomPDF)
DOMPDF_ENABLE_PHP=false
DOMPDF_ENABLE_REMOTE=true
DOMPDF_PAPER_SIZE=A4
DOMPDF_PAPER_ORIENTATION=portrait

# Excel Settings
PHPSPREADSHEET_MEMORY_LIMIT=512M
```

### Storage Configuration

Ensure proper permissions for report storage:

```bash
# Create directories
mkdir -p storage/app/reports
mkdir -p storage/app/reports/pdf

# Set permissions
chmod -R 755 storage/app/reports
chown -R www-data:www-data storage/app/reports
```

## Usage Examples

### Generate PDF Report

```php
use App\Services\ReportGenerationService;

$service = new ReportGenerationService();
$report = ClinicalReport::create([
    'report_type' => 'summary',
    'format' => 'pdf',
    'parameters' => [
        'timeframe' => '30days',
        'filters' => [
            'priority' => ['high', 'urgent'],
            'categories' => ['mental_health']
        ]
    ],
    'requested_by_id' => auth()->id()
]);

$filePath = $service->generateReport($report);
```

### Generate Excel Report

```php
$report = ClinicalReport::create([
    'report_type' => 'detailed',
    'format' => 'excel',
    'parameters' => [
        'timeframe' => '90days',
        'include_charts' => true,
        'include_recommendations' => true
    ],
    'requested_by_id' => auth()->id()
]);

$filePath = $service->generateReport($report);
```

## Scheduled Report Generation

Add to `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule)
{
    // Generate weekly summary reports
    $schedule->job(new GenerateClinicalReportsJob('weekly_summary'))
        ->weekly()
        ->mondays()
        ->at('08:00');
    
    // Generate monthly detailed reports
    $schedule->job(new GenerateClinicalReportsJob('monthly_detailed'))
        ->monthly()
        ->at('09:00');
}
```

## Troubleshooting

### Memory Issues

If you encounter memory issues with large reports:

1. Increase PHP memory limit:
```php
ini_set('memory_limit', '512M');
```

2. Use chunked processing:
```php
$alerts->chunk(1000, function ($chunk) {
    // Process chunk
});
```

3. Generate reports asynchronously using queues

### PDF Generation Issues

Common issues and solutions:

1. **Blank PDFs**: Enable PHP in DomPDF config
2. **Missing fonts**: Install required fonts
3. **Images not showing**: Enable remote content in config

### Excel Generation Issues

1. **File corrupted**: Ensure no output before file generation
2. **Memory exhausted**: Use chunked writing
3. **Formulas not working**: Check formula syntax

## Performance Optimization

### 1. Use Queues

Always generate reports asynchronously:

```php
GenerateClinicalReportsJob::dispatch($report)->onQueue('reports');
```

### 2. Cache Common Data

```php
$metrics = Cache::remember("report_metrics_{$timeframe}", 3600, function () {
    return $this->calculateMetrics();
});
```

### 3. Optimize Queries

```php
$alerts = ClinicalAlert::with(['beneficiary', 'questionnaire'])
    ->select(['id', 'beneficiary_id', 'category', 'priority', 'risk_score'])
    ->where('created_at', '>=', $startDate)
    ->cursor(); // Use cursor for large datasets
```

## Security Considerations

1. **Access Control**: Ensure proper authorization
2. **Data Sanitization**: Sanitize all user inputs
3. **File Storage**: Store reports in non-public directories
4. **Encryption**: Consider encrypting sensitive reports
5. **Retention**: Implement automatic cleanup of old reports

## API Endpoints

### Generate Report
```
POST /api/admin/health-risks/reports/generate
{
    "report_type": "summary",
    "format": "pdf",
    "timeframe": "30days",
    "filters": {
        "priority": ["high", "urgent"]
    }
}
```

### Download Report
```
GET /api/admin/health-risks/reports/{id}/download
```

### List Reports
```
GET /api/admin/health-risks/reports
```

## Frontend Integration

The frontend provides a user-friendly interface for report generation:

1. Navigate to `/admin/health-risks/reports`
2. Click "Novo Relatório"
3. Select report type, format, and filters
4. Click "Gerar Relatório"
5. Download when ready

## Monitoring

Monitor report generation with Laravel Telescope or custom logging:

```php
Log::channel('reports')->info('Report generated', [
    'report_id' => $report->id,
    'format' => $report->format,
    'size' => $fileSize,
    'duration' => $processingTime
]);
```

## Maintenance

### Clean Old Reports

Add to scheduled tasks:

```php
$schedule->command('reports:cleanup --days=90')
    ->daily()
    ->at('02:00');
```

### Monitor Storage Usage

```bash
du -h storage/app/reports/
```

## Support

For issues or questions:
1. Check Laravel logs: `storage/logs/laravel.log`
2. Check report-specific logs: `storage/logs/reports.log`
3. Verify package installation: `composer show`
4. Test with small datasets first