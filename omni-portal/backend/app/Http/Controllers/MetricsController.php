<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Prometheus\CollectorRegistry;
use Prometheus\RenderTextFormat;
use Prometheus\Storage\InMemory;

class MetricsController extends Controller
{
    private CollectorRegistry $registry;

    public function __construct()
    {
        $this->registry = new CollectorRegistry(new InMemory());
    }

    public function __invoke(Request $request): Response
    {
        // HTTP request metrics
        $httpRequestsTotal = $this->registry->getOrRegisterCounter(
            'laravel',
            'http_requests_total',
            'Total number of HTTP requests',
            ['method', 'status', 'route']
        );

        $httpRequestDuration = $this->registry->getOrRegisterHistogram(
            'laravel',
            'http_request_duration_seconds',
            'HTTP request duration in seconds',
            ['method', 'status', 'route'],
            [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0]
        );

        // Database metrics
        $databaseQueryTotal = $this->registry->getOrRegisterCounter(
            'laravel',
            'database_queries_total',
            'Total number of database queries',
            ['type', 'connection']
        );

        $databaseQueryDuration = $this->registry->getOrRegisterHistogram(
            'laravel',
            'database_query_duration_seconds',
            'Database query duration in seconds',
            ['type', 'connection'],
            [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
        );

        // Cache metrics
        $cacheOperationsTotal = $this->registry->getOrRegisterCounter(
            'laravel',
            'cache_operations_total',
            'Total number of cache operations',
            ['operation', 'driver']
        );

        // Queue metrics
        $queueJobsTotal = $this->registry->getOrRegisterCounter(
            'laravel',
            'queue_jobs_total',
            'Total number of queue jobs',
            ['queue', 'status']
        );

        $queueJobDuration = $this->registry->getOrRegisterHistogram(
            'laravel',
            'queue_job_duration_seconds',
            'Queue job duration in seconds',
            ['queue', 'job'],
            [0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 300.0]
        );

        // Memory usage
        $memoryUsage = $this->registry->getOrRegisterGauge(
            'laravel',
            'memory_usage_bytes',
            'Current memory usage in bytes'
        );
        $memoryUsage->set(memory_get_usage(true));

        // Peak memory usage
        $peakMemoryUsage = $this->registry->getOrRegisterGauge(
            'laravel',
            'memory_peak_usage_bytes',
            'Peak memory usage in bytes'
        );
        $peakMemoryUsage->set(memory_get_peak_usage(true));

        // Active database connections
        $activeConnections = $this->registry->getOrRegisterGauge(
            'laravel',
            'database_connections_active',
            'Number of active database connections',
            ['connection']
        );

        try {
            $connections = \DB::connection()->select('SHOW STATUS LIKE "Threads_connected"');
            if (!empty($connections)) {
                $activeConnections->set($connections[0]->Value, ['default']);
            }
        } catch (\Exception $e) {
            // Ignore database connection errors for metrics
        }

        // Application info
        $appInfo = $this->registry->getOrRegisterGauge(
            'laravel',
            'app_info',
            'Application information',
            ['version', 'environment', 'debug']
        );
        $appInfo->set(1, [
            config('app.version', '1.0.0'),
            config('app.env'),
            config('app.debug') ? 'true' : 'false'
        ]);

        // Laravel version info
        $laravelInfo = $this->registry->getOrRegisterGauge(
            'laravel',
            'laravel_info',
            'Laravel framework information',
            ['version']
        );
        $laravelInfo->set(1, [app()->version()]);

        // Generate and return metrics
        $renderer = new RenderTextFormat();
        $result = $renderer->render($this->registry->getMetricFamilySamples());

        return response($result, 200, [
            'Content-Type' => RenderTextFormat::MIME_TYPE,
        ]);
    }
}