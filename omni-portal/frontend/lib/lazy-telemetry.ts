/**
 * PERFORMANCE OPTIMIZATION: Lazy loading for OpenTelemetry
 * Reduces initial bundle size by loading telemetry only when needed
 */

let telemetryInitialized = false;
let telemetryPromise: Promise<any> | null = null;

export const initTelemetryLazy = async () => {
  if (telemetryInitialized) {
    return;
  }

  if (telemetryPromise) {
    return telemetryPromise;
  }

  telemetryPromise = (async () => {
    try {
      // Lazy import OpenTelemetry modules
      const [
        { WebTracerProvider },
        { BatchSpanProcessor },
        { getWebAutoInstrumentations },
        { registerInstrumentations },
        { OTLPTraceExporter },
        { Resource },
        { SemanticResourceAttributes }
      ] = await Promise.all([
        import('@opentelemetry/sdk-trace-web'),
        import('@opentelemetry/sdk-trace-web'),
        import('@opentelemetry/auto-instrumentations-web'),
        import('@opentelemetry/instrumentation'),
        import('@opentelemetry/exporter-trace-otlp-http'),
        import('@opentelemetry/resources'),
        import('@opentelemetry/semantic-conventions')
      ]);

      // Initialize only in production or when explicitly enabled
      if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_TELEMETRY === 'true') {
        const provider = new WebTracerProvider({
          resource: new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: 'omni-portal-frontend',
            [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
          }),
        });

        const exporter = new OTLPTraceExporter({
          url: process.env.NEXT_PUBLIC_TELEMETRY_URL || '/api/telemetry/traces',
        });

        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
        provider.register();

        registerInstrumentations({
          instrumentations: [
            getWebAutoInstrumentations({
              '@opentelemetry/instrumentation-fs': {
                enabled: false,
              },
              '@opentelemetry/instrumentation-http': {
                enabled: true,
              },
              '@opentelemetry/instrumentation-fetch': {
                enabled: true,
              },
            }),
          ],
        });

        telemetryInitialized = true;
        console.log('Telemetry initialized successfully');
      }
    } catch (error) {
      console.warn('Failed to initialize telemetry:', error);
    }
  })();

  return telemetryPromise;
};

// Utility to check if telemetry should be loaded
export const shouldLoadTelemetry = () => {
  return process.env.NODE_ENV === 'production' || 
         process.env.NEXT_PUBLIC_ENABLE_TELEMETRY === 'true';
};

// Export for manual initialization in specific components
export { telemetryInitialized };