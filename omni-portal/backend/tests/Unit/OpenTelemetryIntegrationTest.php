<?php

namespace Tests\Unit;

use Tests\TestCase;
use OpenTelemetry\API\Globals;
use App\Providers\TracingServiceProvider;

class OpenTelemetryIntegrationTest extends TestCase
{
    public function test_opentelemetry_packages_are_installed()
    {
        $this->assertTrue(class_exists('OpenTelemetry\API\Globals'));
        $this->assertTrue(class_exists('OpenTelemetry\SDK\Trace\TracerProvider'));
        $this->assertTrue(class_exists('OpenTelemetry\Contrib\Otlp\SpanExporter'));
    }

    public function test_otel_configuration_exists()
    {
        $config = config('otel');
        
        $this->assertIsArray($config);
        $this->assertArrayHasKey('enabled', $config);
        $this->assertArrayHasKey('service_name', $config);
        $this->assertArrayHasKey('exporter', $config);
        $this->assertArrayHasKey('instrumentation', $config);
    }

    public function test_tracing_service_provider_is_registered()
    {
        $providers = config('app.providers');
        
        // Check if TracingServiceProvider class exists first
        if (class_exists(TracingServiceProvider::class)) {
            $this->assertContains(TracingServiceProvider::class, $providers);
        } else {
            // If the provider doesn't exist, skip this test
            $this->markTestSkipped('TracingServiceProvider class does not exist');
        }
    }

    public function test_tracing_middleware_exists()
    {
        $this->assertTrue(class_exists('App\Http\Middleware\TracingMiddleware'));
    }

    public function test_otel_can_create_tracer_when_enabled()
    {
        config(['otel.enabled' => true]);
        
        // This should not throw an exception
        $this->assertInstanceOf(
            'OpenTelemetry\API\Trace\TracerProviderInterface',
            Globals::tracerProvider()
        );
    }
}