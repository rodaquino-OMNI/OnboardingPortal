<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use OpenTelemetry\API\Globals;
use OpenTelemetry\Context\Propagation\ArrayAccessGetterSetter;
use OpenTelemetry\Context\Propagation\MultiTextMapPropagator;
use OpenTelemetry\Context\Propagation\TraceContextPropagator;
use OpenTelemetry\Contrib\Otlp\SpanExporter;
use OpenTelemetry\SDK\Common\Attribute\Attributes;
use OpenTelemetry\SDK\Resource\ResourceInfo;
use OpenTelemetry\SDK\Resource\ResourceInfoFactory;
use OpenTelemetry\SDK\Trace\Sampler\AlwaysOnSampler;
use OpenTelemetry\SDK\Trace\Sampler\ParentBased;
use OpenTelemetry\SDK\Trace\Sampler\TraceIdRatioBasedSampler;
use OpenTelemetry\SDK\Trace\SpanProcessor\BatchSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use OpenTelemetry\SDK\Trace\TracerProviderBuilder;
use Psr\Http\Message\ServerRequestInterface;

class TracingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        if (!config('otel.enabled')) {
            return;
        }

        $this->app->singleton(TracerProvider::class, function () {
            return $this->createTracerProvider();
        });
    }

    public function boot(): void
    {
        if (!config('otel.enabled')) {
            return;
        }

        $tracerProvider = $this->app->make(TracerProvider::class);
        
        // Set global tracer provider
        Globals::registerInitializer(function () use ($tracerProvider) {
            return Globals::tracerProvider($tracerProvider);
        });

        // Set up propagation
        $this->setupPropagation();

        // Register event listeners for automatic instrumentation
        $this->registerEventListeners();
    }

    private function createTracerProvider(): TracerProvider
    {
        $resource = ResourceInfoFactory::emptyResource()->merge(
            ResourceInfo::create(Attributes::create(config('otel.resource_attributes')))
        );

        $exporter = $this->createExporter();
        
        $spanProcessor = new BatchSpanProcessor(
            $exporter,
            app()->make('clock'),
            2048, // maxQueueSize
            5000, // scheduledDelayMillis
            30000, // exportTimeoutMillis
            512   // maxExportBatchSize
        );

        $sampler = new ParentBased(
            new TraceIdRatioBasedSampler(config('otel.sampling.ratio', 0.1))
        );

        return TracerProviderBuilder::create()
            ->addSpanProcessor($spanProcessor)
            ->setResource($resource)
            ->setSampler($sampler)
            ->build();
    }

    private function createExporter()
    {
        $exporterType = config('otel.exporter.type', 'otlp');
        
        switch ($exporterType) {
            case 'jaeger':
            case 'otlp':
                return new SpanExporter(
                    config('otel.exporter.endpoint', 'http://jaeger:14268/api/traces'),
                    config('otel.exporter.headers', []),
                    config('otel.exporter.timeout', 30)
                );
            
            default:
                throw new \InvalidArgumentException("Unsupported exporter type: {$exporterType}");
        }
    }

    private function setupPropagation(): void
    {
        $propagators = [];
        
        foreach (config('otel.propagators', []) as $propagatorName) {
            switch ($propagatorName) {
                case 'tracecontext':
                    $propagators[] = TraceContextPropagator::getInstance();
                    break;
                case 'jaeger':
                    // Add Jaeger propagator if available
                    break;
                case 'b3':
                    // Add B3 propagator if available
                    break;
                case 'baggage':
                    // Add baggage propagator if available
                    break;
            }
        }

        if (!empty($propagators)) {
            $multiPropagator = new MultiTextMapPropagator($propagators);
            Globals::registerInitializer(function () use ($multiPropagator) {
                return Globals::propagator($multiPropagator);
            });
        }
    }

    private function registerEventListeners(): void
    {
        // Database query instrumentation
        if (config('otel.instrumentation.laravel.database_queries')) {
            \DB::listen(function ($query) {
                $tracer = Globals::tracerProvider()->getTracer('laravel-database');
                
                $span = $tracer->spanBuilder('db.query')
                    ->setSpanKind(\OpenTelemetry\API\Trace\SpanKind::KIND_CLIENT)
                    ->setAttributes([
                        'db.system' => 'mysql',
                        'db.connection_string' => config('database.connections.' . $query->connectionName . '.host'),
                        'db.user' => config('database.connections.' . $query->connectionName . '.username'),
                        'db.name' => config('database.connections.' . $query->connectionName . '.database'),
                        'db.statement' => $query->sql,
                        'db.operation' => $this->getDbOperation($query->sql),
                        'db.execution_time' => $query->time,
                    ])
                    ->startSpan();

                $span->end();
            });
        }

        // Cache operation instrumentation
        if (config('otel.instrumentation.laravel.cache_operations')) {
            \Event::listen('cache:*', function ($event, $data) {
                $tracer = Globals::tracerProvider()->getTracer('laravel-cache');
                
                $operation = str_replace('cache:', '', $event);
                
                $span = $tracer->spanBuilder("cache.{$operation}")
                    ->setSpanKind(\OpenTelemetry\API\Trace\SpanKind::KIND_CLIENT)
                    ->setAttributes([
                        'cache.operation' => $operation,
                        'cache.key' => $data[0] ?? 'unknown',
                        'cache.driver' => config('cache.default'),
                    ])
                    ->startSpan();

                $span->end();
            });
        }

        // Queue job instrumentation
        if (config('otel.instrumentation.laravel.queue_jobs')) {
            \Event::listen('queue:*', function ($event, $data) {
                $tracer = Globals::tracerProvider()->getTracer('laravel-queue');
                
                $operation = str_replace('queue:', '', $event);
                
                $span = $tracer->spanBuilder("queue.{$operation}")
                    ->setSpanKind(\OpenTelemetry\API\Trace\SpanKind::KIND_PRODUCER)
                    ->setAttributes([
                        'queue.operation' => $operation,
                        'queue.name' => $data['job']->getQueue() ?? 'default',
                        'queue.job' => get_class($data['job'] ?? new \stdClass()),
                    ])
                    ->startSpan();

                $span->end();
            });
        }
    }

    private function getDbOperation(string $sql): string
    {
        $sql = trim(strtoupper($sql));
        
        if (str_starts_with($sql, 'SELECT')) return 'SELECT';
        if (str_starts_with($sql, 'INSERT')) return 'INSERT';
        if (str_starts_with($sql, 'UPDATE')) return 'UPDATE';
        if (str_starts_with($sql, 'DELETE')) return 'DELETE';
        if (str_starts_with($sql, 'CREATE')) return 'CREATE';
        if (str_starts_with($sql, 'DROP')) return 'DROP';
        if (str_starts_with($sql, 'ALTER')) return 'ALTER';
        
        return 'OTHER';
    }
}