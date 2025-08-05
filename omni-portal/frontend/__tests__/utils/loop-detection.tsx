/**
 * Loop Detection Utilities for Testing
 * Utilities to detect and prevent infinite loops during testing
 */

import React from 'react';

interface LoopDetectionConfig {
  maxRenders: number;
  maxEffectRuns: number;
  maxStateUpdates: number;
  timeoutMs: number;
}

interface LoopMetrics {
  renderCount: number;
  effectRuns: number;
  stateUpdates: number;
  warnings: string[];
  errors: string[];
  startTime: number;
  endTime?: number;
}

class LoopDetector {
  private config: LoopDetectionConfig;
  private metrics: Map<string, LoopMetrics> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<LoopDetectionConfig> = {}) {
    this.config = {
      maxRenders: 50,
      maxEffectRuns: 20,
      maxStateUpdates: 100,
      timeoutMs: 5000,
      ...config
    };
  }

  startTracking(componentName: string): void {
    const metrics: LoopMetrics = {
      renderCount: 0,
      effectRuns: 0,
      stateUpdates: 0,
      warnings: [],
      errors: [],
      startTime: performance.now()
    };

    this.metrics.set(componentName, metrics);

    // Set timeout to detect infinite loops
    const timer = setTimeout(() => {
      this.detectInfiniteLoop(componentName);
    }, this.config.timeoutMs);

    this.timers.set(componentName, timer);
  }

  trackRender(componentName: string): void {
    const metrics = this.metrics.get(componentName);
    if (!metrics) return;

    metrics.renderCount++;

    if (metrics.renderCount > this.config.maxRenders) {
      metrics.errors.push(`Excessive renders detected: ${metrics.renderCount}`);
      this.detectInfiniteLoop(componentName);
    } else if (metrics.renderCount > this.config.maxRenders * 0.8) {
      metrics.warnings.push(`High render count: ${metrics.renderCount}`);
    }
  }

  trackEffect(componentName: string, effectName: string): void {
    const metrics = this.metrics.get(componentName);
    if (!metrics) return;

    metrics.effectRuns++;

    if (metrics.effectRuns > this.config.maxEffectRuns) {
      metrics.errors.push(`Excessive effect runs detected: ${metrics.effectRuns} for ${effectName}`);
      this.detectInfiniteLoop(componentName);
    }
  }

  trackStateUpdate(componentName: string, stateName: string): void {
    const metrics = this.metrics.get(componentName);
    if (!metrics) return;

    metrics.stateUpdates++;

    if (metrics.stateUpdates > this.config.maxStateUpdates) {
      metrics.errors.push(`Excessive state updates detected: ${metrics.stateUpdates} for ${stateName}`);
      this.detectInfiniteLoop(componentName);
    }
  }

  stopTracking(componentName: string): LoopMetrics | null {
    const metrics = this.metrics.get(componentName);
    if (!metrics) return null;

    metrics.endTime = performance.now();

    const timer = this.timers.get(componentName);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(componentName);
    }

    this.metrics.delete(componentName);
    return metrics;
  }

  private detectInfiniteLoop(componentName: string): void {
    const metrics = this.metrics.get(componentName);
    if (!metrics) return;

    metrics.errors.push('Potential infinite loop detected');
    
    throw new Error(`
      Infinite loop detected in component: ${componentName}
      Metrics:
      - Renders: ${metrics.renderCount}
      - Effect runs: ${metrics.effectRuns}
      - State updates: ${metrics.stateUpdates}
      - Duration: ${performance.now() - metrics.startTime}ms
      
      Warnings: ${metrics.warnings.join(', ')}
      Errors: ${metrics.errors.join(', ')}
    `);
  }

  getMetrics(componentName: string): LoopMetrics | null {
    return this.metrics.get(componentName) || null;
  }

  getAllMetrics(): Record<string, LoopMetrics> {
    return Object.fromEntries(this.metrics.entries());
  }

  reset(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.metrics.clear();
  }
}

// React hook for loop detection
export function useLoopDetection(componentName: string, detector?: LoopDetector) {
  const loopDetector = React.useMemo(() => detector || new LoopDetector(), [detector]);
  const renderCountRef = React.useRef(0);

  React.useEffect(() => {
    loopDetector.startTracking(componentName);
    return () => {
      loopDetector.stopTracking(componentName);
    };
  }, [componentName, loopDetector]);

  React.useEffect(() => {
    renderCountRef.current++;
    loopDetector.trackRender(componentName);
  });

  const trackEffect = React.useCallback((effectName: string) => {
    loopDetector.trackEffect(componentName, effectName);
  }, [componentName, loopDetector]);

  const trackStateUpdate = React.useCallback((stateName: string) => {
    loopDetector.trackStateUpdate(componentName, stateName);
  }, [componentName, loopDetector]);

  return {
    trackEffect,
    trackStateUpdate,
    getMetrics: () => loopDetector.getMetrics(componentName),
    renderCount: renderCountRef.current
  };
}

// Test utility function
export function withLoopDetection<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  config?: Partial<LoopDetectionConfig>
) {
  const detector = new LoopDetector(config);

  return function WrappedComponent(props: P) {
    const { trackEffect, trackStateUpdate } = useLoopDetection(componentName, detector);

    return (
      <React.StrictMode>
        <Component {...props} />
      </React.StrictMode>
    );
  };
}

// Jest matcher for loop detection
export function expectNoInfiniteLoops(metrics: LoopMetrics | null) {
  if (!metrics) {
    return {
      pass: false,
      message: () => 'No metrics available for loop detection'
    };
  }

  const hasErrors = metrics.errors.length > 0;
  const duration = metrics.endTime ? metrics.endTime - metrics.startTime : 0;
  const isReasonableDuration = duration < 5000; // 5 seconds

  const pass = !hasErrors && isReasonableDuration;

  return {
    pass,
    message: () => pass
      ? `Expected infinite loops, but component behaved normally`
      : `Infinite loop detected:
         - Renders: ${metrics.renderCount}
         - Effects: ${metrics.effectRuns}
         - State updates: ${metrics.stateUpdates}
         - Duration: ${duration}ms
         - Errors: ${metrics.errors.join(', ')}
         - Warnings: ${metrics.warnings.join(', ')}`
  };
}

// Performance monitoring utilities
export class PerformanceTracker {
  private measurements: Map<string, number[]> = new Map();

  startMeasurement(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      const measurements = this.measurements.get(name) || [];
      measurements.push(duration);
      this.measurements.set(name, measurements);
    };
  }

  getAverageTime(name: string): number {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) return 0;
    
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }

  getMaxTime(name: string): number {
    const measurements = this.measurements.get(name) || [];
    return Math.max(...measurements, 0);
  }

  getAllMeasurements(): Record<string, number[]> {
    return Object.fromEntries(this.measurements.entries());
  }

  reset(): void {
    this.measurements.clear();
  }
}

export const globalLoopDetector = new LoopDetector();
export const globalPerformanceTracker = new PerformanceTracker();