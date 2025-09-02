<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use OpenTelemetry\API\Globals;
use OpenTelemetry\API\Trace\Span;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\Context\Context;
use Symfony\Component\HttpFoundation\Response;

class TracingMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!config('otel.enabled', false)) {
            return $next($request);
        }

        $tracer = Globals::tracerProvider()->getTracer('laravel-http');
        
        // Get request ID for correlation
        $requestId = RequestIDMiddleware::getRequestId($request) ?? 'unknown';
        
        $spanBuilder = $tracer->spanBuilder($request->method() . ' ' . $request->getPathInfo())
            ->setSpanKind(SpanKind::KIND_SERVER)
            ->setAttributes([
                'http.method' => $request->method(),
                'http.url' => $request->fullUrl(),
                'http.route' => $request->route()?->getName() ?? 'unknown',
                'http.user_agent' => $request->userAgent(),
                'http.scheme' => $request->getScheme(),
                'http.host' => $request->getHost(),
                'http.target' => $request->getRequestUri(),
                'http.flavor' => $request->getProtocolVersion(),
                // Request correlation attributes
                'request.id' => $requestId,
                'trace.id' => $requestId,
                'correlation.id' => $requestId,
                // Client IP for better tracing
                'client.ip' => $request->ip(),
                // Avoid using Auth facade which triggers session initialization
                // 'user.id' => Auth::id(),
                // 'user.authenticated' => Auth::check(),
            ]);

        $span = $spanBuilder->startSpan();
        $scope = $span->activate();

        try {
            $response = $next($request);

            $span->setAttributes([
                'http.status_code' => $response->getStatusCode(),
                'http.response.size' => strlen($response->getContent()),
                'response.headers.content_type' => $response->headers->get('Content-Type'),
            ]);

            // Set span status based on HTTP status code
            if ($response->getStatusCode() >= 400) {
                $span->setStatus(
                    $response->getStatusCode() >= 500 ? StatusCode::STATUS_ERROR : StatusCode::STATUS_OK,
                    'HTTP ' . $response->getStatusCode()
                );
            }

            return $response;
        } catch (\Throwable $exception) {
            // Add request ID to exception context
            $span->setAttributes([
                'exception.request_id' => $requestId,
                'exception.type' => get_class($exception),
            ]);
            
            $span->recordException($exception);
            $span->setStatus(StatusCode::STATUS_ERROR, $exception->getMessage());
            throw $exception;
        } finally {
            $scope->detach();
            $span->end();
        }
    }
}