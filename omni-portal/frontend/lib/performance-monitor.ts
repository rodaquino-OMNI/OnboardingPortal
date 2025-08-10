/**
 * Performance monitoring utility for critical paths
 * CRITICAL FIX: Add performance monitoring to identify bottlenecks
 */

interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  mountTime: number;
  updateTime?: number;
  memoryUsage?: number;
  timestamp: number;
}

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
  entryType: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development' || process.env.ENABLE_PERF_MONITOR === 'true';
    
    if (this.isEnabled && typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  private initializeObservers() {
    try {
      // Monitor long tasks
      if ('PerformanceObserver' in window) {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.duration > 50) { // Tasks longer than 50ms
              console.warn(`Long task detected: ${entry.name} (${entry.duration}ms)`);
            }
          });
        });
        
        try {
          longTaskObserver.observe({ type: 'longtask', buffered: true });
          this.observers.push(longTaskObserver);
        } catch (e) {
          // longtask not supported in all browsers
        }

        // Monitor navigation timing
        const navigationObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            console.log('Navigation timing:', {
              name: entry.name,
              duration: entry.duration,
              loadEventEnd: entry.loadEventEnd,
              domContentLoadedEventEnd: entry.domContentLoadedEventEnd
            });
          });
        });
        
        try {
          navigationObserver.observe({ type: 'navigation', buffered: true });
          this.observers.push(navigationObserver);
        } catch (e) {
          // Handle unsupported types
        }
      }
    } catch (error) {
      console.warn('Performance monitoring setup failed:', error);
    }
  }

  startTiming(name: string): () => number {
    if (!this.isEnabled) return () => 0;
    
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      return duration;
    };
  }

  recordComponentTiming(componentName: string, phase: 'mount' | 'render' | 'update', duration: number) {
    if (!this.isEnabled) return;

    const existingMetric = this.metrics.find(m => m.componentName === componentName);
    
    if (existingMetric) {
      if (phase === 'update') {
        existingMetric.updateTime = duration;
      }
    } else {
      const metric: PerformanceMetrics = {
        componentName,
        renderTime: phase === 'render' ? duration : 0,
        mountTime: phase === 'mount' ? duration : 0,
        updateTime: phase === 'update' ? duration : undefined,
        timestamp: Date.now()
      };
      
      // Add memory usage if available
      if ('memory' in performance) {
        metric.memoryUsage = (performance as any).memory.usedJSHeapSize;
      }
      
      this.metrics.push(metric);
    }

    // Warn about slow components
    if (duration > 16) { // Longer than 1 frame at 60fps
      console.warn(`Slow ${phase} detected in ${componentName}: ${duration.toFixed(2)}ms`);
    }
  }

  private recordMetric(name: string, duration: number) {
    if (duration > 10) {
      console.log(`Performance metric: ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getSlowestComponents(limit = 10): PerformanceMetrics[] {
    return this.metrics
      .sort((a, b) => (b.renderTime + b.mountTime) - (a.renderTime + a.mountTime))
      .slice(0, limit);
  }

  clearMetrics() {
    this.metrics = [];
  }

  disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React hook for component performance monitoring
export function usePerformanceMonitor(componentName: string) {
  const startTiming = (phase: 'mount' | 'render' | 'update') => {
    const endTiming = performanceMonitor.startTiming(`${componentName}-${phase}`);
    
    return () => {
      const duration = endTiming();
      performanceMonitor.recordComponentTiming(componentName, phase, duration);
    };
  };

  return { startTiming };
}

// Measure Web Vitals
export function measureWebVitals() {
  if (typeof window === 'undefined') return;

  // Largest Contentful Paint
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    console.log('LCP:', lastEntry.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // First Input Delay
  new PerformanceObserver((entryList) => {
    const firstInput = entryList.getEntries()[0];
    console.log('FID:', firstInput.processingStart - firstInput.startTime);
  }).observe({ type: 'first-input', buffered: true });

  // Cumulative Layout Shift
  new PerformanceObserver((entryList) => {
    let clsValue = 0;
    for (const entry of entryList.getEntries()) {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
      }
    }
    console.log('CLS:', clsValue);
  }).observe({ type: 'layout-shift', buffered: true });
}