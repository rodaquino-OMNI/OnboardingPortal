// Monitoring utilities for Next.js application
import { metricsStore } from './metrics-store';

export interface MonitoringConfig {
  enableConsoleLogging?: boolean;
  enableMetrics?: boolean;
  enablePerformanceTracking?: boolean;
  apiEndpoint?: string;
}

export class ApplicationMonitoring {
  private config: MonitoringConfig;
  private startTime: number;
  
  constructor(config: MonitoringConfig = {}) {
    this.config = {
      enableConsoleLogging: true,
      enableMetrics: true,
      enablePerformanceTracking: true,
      ...config,
    };
    this.startTime = Date.now();
    
    if (typeof window !== 'undefined') {
      this.initializeBrowserMonitoring();
    }
  }
  
  private initializeBrowserMonitoring() {
    // Track page views
    this.trackPageView(window.location.pathname);
    
    // Track navigation
    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      window.addEventListener('beforeunload', () => {
        this.trackEvent('page_unload', { page: window.location.pathname });
      });
      
      // Track errors
      window.addEventListener('error', (event) => {
        this.trackError('javascript_error', event.error, {
          filename: event.filename,
          lineno: event.lineno.toString(),
          colno: event.colno.toString(),
        });
      });
      
      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.trackError('unhandled_promise_rejection', event.reason, {
          promise: 'unhandled',
        });
      });
      
      // Track performance
      if (this.config.enablePerformanceTracking) {
        this.trackPerformanceMetrics();
      }
    }
  }
  
  trackPageView(pathname: string) {
    if (this.config.enableMetrics) {
      try {
        // This will only work on the server side where metricsStore is available
        if (typeof metricsStore !== 'undefined') {
          metricsStore.increment('nextjs_page_views_total', {
            page: pathname,
          });
        }
      } catch (error) {
        console.warn('Failed to track page view:', error);
      }
    }
    
    if (this.config.enableConsoleLogging) {
      console.log(`[Monitor] Page view: ${pathname}`);
    }
  }
  
  trackEvent(eventName: string, properties: Record<string, string> = {}) {
    if (this.config.enableMetrics) {
      try {
        if (typeof metricsStore !== 'undefined') {
          metricsStore.increment('nextjs_events_total', {
            event: eventName,
            ...properties,
          });
        }
      } catch (error) {
        console.warn('Failed to track event:', error);
      }
    }
    
    if (this.config.enableConsoleLogging) {
      console.log(`[Monitor] Event: ${eventName}`, properties);
    }
  }
  
  trackApiCall(endpoint: string, method: string, duration: number, status: number) {
    if (this.config.enableMetrics) {
      try {
        if (typeof metricsStore !== 'undefined') {
          metricsStore.increment('nextjs_api_calls_total', {
            endpoint,
            method,
            status: status.toString(),
          });
          
          metricsStore.observe('nextjs_api_call_duration_seconds', duration / 1000, {
            endpoint,
            method,
          });
        }
      } catch (error) {
        console.warn('Failed to track API call:', error);
      }
    }
    
    if (this.config.enableConsoleLogging) {
      console.log(`[Monitor] API Call: ${method} ${endpoint} - ${status} (${duration}ms)`);
    }
  }
  
  trackError(errorType: string, error: Error | any, context: Record<string, string> = {}) {
    if (this.config.enableMetrics) {
      try {
        if (typeof metricsStore !== 'undefined') {
          metricsStore.increment('nextjs_errors_total', {
            error_type: errorType,
            ...context,
          });
        }
      } catch (err) {
        console.warn('Failed to track error:', err);
      }
    }
    
    if (this.config.enableConsoleLogging) {
      console.error(`[Monitor] Error: ${errorType}`, error, context);
    }
  }
  
  private trackPerformanceMetrics() {
    if (typeof window === 'undefined') return;
    
    // Wait for the page to load completely
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          const metrics = {
            dns_lookup: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcp_connection: navigation.connectEnd - navigation.connectStart,
            request_response: navigation.responseEnd - navigation.requestStart,
            dom_processing: navigation.domContentLoadedEventEnd - navigation.responseEnd,
            total_load_time: navigation.loadEventEnd - navigation.fetchStart,
          };
          
          Object.entries(metrics).forEach(([name, duration]) => {
            if (duration > 0 && typeof metricsStore !== 'undefined') {
              try {
                metricsStore.observe('nextjs_performance_timing_seconds', duration / 1000, {
                  metric: name,
                  page: window.location.pathname,
                });
              } catch (error) {
                console.warn('Failed to track performance metric:', error);
              }
            }
          });
        }
      }, 100);
    });
  }
  
  // Method to create a timer for measuring operation duration
  startTimer(operationName: string) {
    const startTime = Date.now();
    
    return {
      end: (tags: Record<string, string> = {}) => {
        const duration = Date.now() - startTime;
        
        if (this.config.enableMetrics && typeof metricsStore !== 'undefined') {
          try {
            metricsStore.observe('nextjs_operation_duration_seconds', duration / 1000, {
              operation: operationName,
              ...tags,
            });
          } catch (error) {
            console.warn('Failed to record timer:', error);
          }
        }
        
        if (this.config.enableConsoleLogging) {
          console.log(`[Monitor] Timer: ${operationName} completed in ${duration}ms`, tags);
        }
        
        return duration;
      }
    };
  }
  
  // Create a wrapper for async operations
  async trackAsyncOperation<T>(
    operationName: string, 
    operation: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const timer = this.startTimer(operationName);
    
    try {
      const result = await operation();
      timer.end({ ...tags, status: 'success' });
      return result;
    } catch (error) {
      timer.end({ ...tags, status: 'error' });
      this.trackError('async_operation_failed', error, { operation: operationName, ...tags });
      throw error;
    }
  }
  
  // Get current application metrics summary
  getMetricsSummary() {
    const uptime = Date.now() - this.startTime;
    
    return {
      uptime: uptime,
      uptimeFormatted: this.formatDuration(uptime),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    };
  }
  
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// Global monitoring instance
export const monitoring = new ApplicationMonitoring();

// Helper function to wrap API calls with monitoring
export function withMonitoring<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  operationName: string
): T {
  return (async (...args: unknown[]) => {
    return monitoring.trackAsyncOperation(operationName, () => fn(...args));
  }) as T;
}