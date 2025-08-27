// Lazy loaded OpenTelemetry imports to reduce initial bundle size
let tracingModules: any = null;

async function loadTracingModules() {
  if (tracingModules) return tracingModules;
  
  const [
    { WebTracerProvider },
    { Resource },
    { SemanticResourceAttributes },
    { BatchSpanProcessor },
    { JaegerExporter },
    { OTLPTraceExporter },
    { registerInstrumentations },
    { FetchInstrumentation },
    { XMLHttpRequestInstrumentation },
    { UserInteractionInstrumentation },
    { DocumentLoadInstrumentation },
    { ZoneContextManager },
    { context, trace }
  ] = await Promise.all([
    import('@opentelemetry/sdk-trace-web'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
    import('@opentelemetry/sdk-trace-web'),
    import('@opentelemetry/exporter-jaeger'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/instrumentation'),
    import('@opentelemetry/instrumentation-fetch'),
    import('@opentelemetry/instrumentation-xml-http-request'),
    import('@opentelemetry/instrumentation-user-interaction'),
    import('@opentelemetry/instrumentation-document-load'),
    import('@opentelemetry/context-zone'),
    import('@opentelemetry/api')
  ]);

  tracingModules = {
    WebTracerProvider,
    Resource,
    SemanticResourceAttributes,
    BatchSpanProcessor,
    JaegerExporter,
    OTLPTraceExporter,
    registerInstrumentations,
    FetchInstrumentation,
    XMLHttpRequestInstrumentation,
    UserInteractionInstrumentation,
    DocumentLoadInstrumentation,
    ZoneContextManager,
    context,
    trace
  };

  return tracingModules;
}

// Configuration
const config = {
  serviceName: process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME || 'omni-portal-frontend',
  serviceVersion: process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  jaegerEndpoint: process.env.NEXT_PUBLIC_JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  otlpEndpoint: process.env.NEXT_PUBLIC_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  samplingRatio: parseFloat(process.env.NEXT_PUBLIC_OTEL_SAMPLING_RATIO || '0.1'),
  enabled: process.env.NEXT_PUBLIC_OTEL_ENABLED !== 'false',
};

let isInitialized = false;

export async function initializeTracing(): Promise<void> {
  if (!config.enabled || isInitialized || typeof window === 'undefined') {
    return;
  }

  try {
    const {
      WebTracerProvider,
      Resource,
      SemanticResourceAttributes,
      BatchSpanProcessor,
      JaegerExporter,
      OTLPTraceExporter,
      registerInstrumentations,
      FetchInstrumentation,
      XMLHttpRequestInstrumentation,
      UserInteractionInstrumentation,
      DocumentLoadInstrumentation,
      ZoneContextManager
    } = await loadTracingModules();

    // Create resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
    });

    // Create tracer provider
    const provider = new WebTracerProvider({
      resource,
      sampler: {
        shouldSample: () => ({
          decision: Math.random() < config.samplingRatio ? 1 : 0, // SamplingDecision.RECORD_AND_SAMPLE : SamplingDecision.NOT_RECORD
          attributes: {},
        }),
        toString: () => 'CustomSampler',
      },
    });

    // Create exporter (try Jaeger first, fallback to OTLP)
    let exporter;
    try {
      exporter = new JaegerExporter({
        endpoint: config.jaegerEndpoint,
      });
    } catch (error) {
      console.warn('Failed to create Jaeger exporter, falling back to OTLP:', error);
      exporter = new OTLPTraceExporter({
        url: config.otlpEndpoint,
      });
    }

    // Add span processor
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));

    // Register the provider
    provider.register({
      contextManager: new ZoneContextManager(),
    });

    // Register instrumentations
    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: [
            /^https?:\/\/localhost/,
            /^https?:\/\/.*\.localhost/,
            /^https?:\/\/.*\.local/,
            /^https?:\/\/backend/,
          ],
          clearTimingResources: true,
          applyCustomAttributesOnSpan: (span, request, result) => {
            span.setAttributes({
              'http.request.method': request.method || 'GET',
              'http.request.url': request.url || '',
              'http.response.status_code': result.status,
              'http.response.size': result.headers.get('content-length') || 0,
            });
          },
        }),
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: [
            /^https?:\/\/localhost/,
            /^https?:\/\/.*\.localhost/,
            /^https?:\/\/.*\.local/,
            /^https?:\/\/backend/,
          ],
        }),
        new UserInteractionInstrumentation({
          eventNames: ['click', 'submit', 'keydown'],
        }),
        new DocumentLoadInstrumentation(),
      ],
    });

    isInitialized = true;
    console.log('OpenTelemetry tracing initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry tracing:', error);
  }
}

// Custom tracing utilities
export async function createSpan(name: string, attributes?: Record<string, any>) {
  if (!config.enabled || typeof window === 'undefined') {
    return null;
  }

  const { trace } = await loadTracingModules();
  const tracer = trace.getTracer(config.serviceName, config.serviceVersion);
  return tracer.startSpan(name, {
    attributes: {
      'service.name': config.serviceName,
      ...attributes,
    },
  });
}

export async function withTracing<T>(
  name: string,
  fn: () => T | Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  if (!config.enabled || typeof window === 'undefined') {
    return fn();
  }

  const span = await createSpan(name, attributes);
  if (!span) {
    return fn();
  }

  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result
        .then((value) => {
          span.setStatus({ code: 1 }); // OK
          return value;
        })
        .catch((error) => {
          span.setStatus({ code: 2, message: error.message }); // ERROR
          span.recordException(error);
          throw error;
        })
        .finally(() => {
          span.end();
        });
    } else {
      span.setStatus({ code: 1 }); // OK
      span.end();
      return result;
    }
  } catch (error) {
    span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
    span.recordException(error as Error);
    span.end();
    throw error;
  }
}

export async function addSpanEvent(name: string, attributes?: Record<string, any>) {
  if (!config.enabled || typeof window === 'undefined') {
    return;
  }

  const { trace } = await loadTracingModules();
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}

export async function setSpanAttribute(key: string, value: any) {
  if (!config.enabled || typeof window === 'undefined') {
    return;
  }

  const { trace } = await loadTracingModules();
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setAttribute(key, value);
  }
}

// React hook for tracing
export function useTracing(componentName: string) {
  if (!config.enabled || typeof window === 'undefined') {
    return {
      createSpan: () => null,
      withTracing: <T>(name: string, fn: () => T) => fn(),
      addEvent: () => {},
      setAttribute: () => {},
    };
  }

  return {
    createSpan: (name: string, attributes?: Record<string, any>) =>
      createSpan(`${componentName}.${name}`, attributes),
    
    withTracing: <T>(name: string, fn: () => T | Promise<T>, attributes?: Record<string, any>) =>
      withTracing(`${componentName}.${name}`, fn, attributes),
    
    addEvent: (name: string, attributes?: Record<string, any>) =>
      addSpanEvent(`${componentName}.${name}`, attributes),
    
    setAttribute: (key: string, value: any) =>
      setSpanAttribute(`${componentName}.${key}`, value),
  };
}

// Initialize when module loads in browser (only if enabled)
if (typeof window !== 'undefined' && config.enabled) {
  // Defer initialization to avoid blocking page load
  setTimeout(() => {
    initializeTracing().catch(console.error);
  }, 1000);
}