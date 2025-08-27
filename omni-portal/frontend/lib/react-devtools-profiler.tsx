'use client';

import { Profiler, ProfilerOnRenderCallback, ReactNode, memo, useEffect, useState } from 'react';
import { logger } from './logger';

/**
 * Enhanced React DevTools Profiler integration for performance monitoring
 */

export interface ProfilerData {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  interactions: Set<any>;
}

export interface PerformanceMetrics {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  slowestRender: number;
  fastestRender: number;
  mountTime: number;
  lastRenderTime: number;
  warningCount: number;
}

class ReactPerformanceMonitor {
  private metrics = new Map<string, PerformanceMetrics>();
  private onProfilerDataCallbacks = new Set<(data: ProfilerData) => void>();
  private performanceThresholds = {
    slowRender: 16, // 16ms for 60fps
    verySlowRender: 50,
    excessiveRenders: 10 // in 1 second
  };

  constructor() {
    // Initialize React DevTools integration if available
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      this.initializeDevToolsIntegration();
    }
  }

  private initializeDevToolsIntegration() {
    // Hook into React DevTools if available
    if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const devTools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      
      // Listen for fiber commits
      devTools.onCommitFiberRoot = (id: any, root: any, ...args: any[]) => {
        this.handleFiberCommit(id, root);
      };
    }

    // Make performance monitor available globally for debugging
    (window as any).__REACT_PERFORMANCE_MONITOR__ = this;
  }

  private handleFiberCommit(id: any, root: any) {
    // Process fiber tree for performance data
    if (root && root.current) {
      this.processFiberNode(root.current);
    }
  }

  private processFiberNode(fiber: any) {
    // Extract performance data from fiber node
    if (fiber.elementType && fiber.actualDuration !== undefined) {
      const componentName = this.getComponentName(fiber);
      if (componentName) {
        this.recordRenderData({
          id: componentName,
          phase: fiber.alternate ? 'update' : 'mount',
          actualDuration: fiber.actualDuration,
          baseDuration: fiber.treeBaseDuration || 0,
          startTime: fiber.actualStartTime || 0,
          commitTime: Date.now(),
          interactions: new Set()
        } as ProfilerData);
      }
    }

    // Process children
    if (fiber.child) {
      this.processFiberNode(fiber.child);
    }
    if (fiber.sibling) {
      this.processFiberNode(fiber.sibling);
    }
  }

  private getComponentName(fiber: any): string | null {
    if (fiber.elementType) {
      if (typeof fiber.elementType === 'function') {
        return fiber.elementType.name || fiber.elementType.displayName || 'Anonymous';
      }
      if (typeof fiber.elementType === 'string') {
        return fiber.elementType;
      }
    }
    return null;
  }

  public onProfilerData(callback: (data: ProfilerData) => void) {
    this.onProfilerDataCallbacks.add(callback);
    
    return () => {
      this.onProfilerDataCallbacks.delete(callback);
    };
  }

  public recordRenderData(data: ProfilerData) {
    const existing = this.metrics.get(data.id) || {
      componentName: data.id,
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      slowestRender: 0,
      fastestRender: Infinity,
      mountTime: data.phase === 'mount' ? data.actualDuration : 0,
      lastRenderTime: 0,
      warningCount: 0
    };

    existing.renderCount++;
    existing.totalRenderTime += data.actualDuration;
    existing.averageRenderTime = existing.totalRenderTime / existing.renderCount;
    existing.slowestRender = Math.max(existing.slowestRender, data.actualDuration);
    existing.fastestRender = Math.min(existing.fastestRender, data.actualDuration);
    existing.lastRenderTime = data.actualDuration;

    // Performance warnings
    if (data.actualDuration > this.performanceThresholds.slowRender) {
      existing.warningCount++;
      
      const logLevel = data.actualDuration > this.performanceThresholds.verySlowRender ? 'warn' : 'info';
      logger[logLevel](`Slow render detected: ${data.id}`, {
        actualDuration: data.actualDuration,
        phase: data.phase,
        renderCount: existing.renderCount,
        averageRenderTime: existing.averageRenderTime
      }, 'ReactProfiler');
    }

    this.metrics.set(data.id, existing);

    // Notify callbacks
    this.onProfilerDataCallbacks.forEach(callback => {
      callback(data);
    });
  }

  public getMetrics(componentName?: string): PerformanceMetrics | Map<string, PerformanceMetrics> {
    if (componentName) {
      return this.metrics.get(componentName);
    }
    return new Map(this.metrics);
  }

  public getSlowComponents(threshold = this.performanceThresholds.slowRender): PerformanceMetrics[] {
    return Array.from(this.metrics.values())
      .filter(metric => metric.averageRenderTime > threshold)
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime);
  }

  public generatePerformanceReport(): string {
    const slowComponents = this.getSlowComponents();
    const totalComponents = this.metrics.size;
    const totalRenders = Array.from(this.metrics.values()).reduce((sum, metric) => sum + metric.renderCount, 0);

    let report = `# React Performance Report\n\n`;
    report += `**Summary:**\n`;
    report += `- Total Components: ${totalComponents}\n`;
    report += `- Total Renders: ${totalRenders}\n`;
    report += `- Slow Components: ${slowComponents.length}\n\n`;

    if (slowComponents.length > 0) {
      report += `**Slow Components (>${this.performanceThresholds.slowRender}ms avg):**\n\n`;
      slowComponents.forEach((metric, index) => {
        report += `${index + 1}. **${metric.componentName}**\n`;
        report += `   - Renders: ${metric.renderCount}\n`;
        report += `   - Avg Time: ${metric.averageRenderTime.toFixed(2)}ms\n`;
        report += `   - Slowest: ${metric.slowestRender.toFixed(2)}ms\n`;
        report += `   - Warnings: ${metric.warningCount}\n\n`;
      });
    }

    return report;
  }

  public reset() {
    this.metrics.clear();
  }

  public exportMetrics(): Record<string, PerformanceMetrics> {
    const exported: Record<string, PerformanceMetrics> = {};
    this.metrics.forEach((metrics, componentName) => {
      exported[componentName] = { ...metrics };
    });
    return exported;
  }
}

// Global performance monitor instance
export const performanceMonitor = new ReactPerformanceMonitor();

/**
 * Enhanced Profiler component with automatic performance monitoring
 */
interface EnhancedProfilerProps {
  id: string;
  children: ReactNode;
  onRender?: ProfilerOnRenderCallback;
  logSlowRenders?: boolean;
  threshold?: number;
  disabled?: boolean;
}

export const EnhancedProfiler = memo(function EnhancedProfiler({
  id,
  children,
  onRender,
  logSlowRenders = true,
  threshold = 16,
  disabled = process.env.NODE_ENV === 'production'
}: EnhancedProfilerProps) {
  if (disabled) {
    return <>{children}</>;
  }

  const handleRender: ProfilerOnRenderCallback = (
    profileId,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    interactions
  ) => {
    const profilerData: ProfilerData = {
      id: profileId,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      interactions
    };

    // Record in performance monitor
    performanceMonitor.recordRenderData(profilerData);

    // Log slow renders if enabled
    if (logSlowRenders && actualDuration > threshold) {
      logger.warn(`Slow render: ${profileId}`, {
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime
      }, 'EnhancedProfiler');
    }

    // Call custom onRender callback
    onRender?.(profileId, phase, actualDuration, baseDuration, startTime, commitTime, interactions);
  };

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
});

/**
 * Component to display performance metrics in development
 */
export const PerformancePanel = memo(function PerformancePanel() {
  const [metrics, setMetrics] = useState<Map<string, PerformanceMetrics>>(new Map());
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      setMetrics(new Map(performanceMonitor.getMetrics() as Map<string, PerformanceMetrics>));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setShowPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !showPanel) {
    return null;
  }

  const slowComponents = Array.from(metrics.values())
    .filter(metric => metric.averageRenderTime > 16)
    .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
    .slice(0, 10);

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-white border border-gray-300 rounded-lg shadow-lg z-50 font-mono text-xs">
      <div className="flex items-center justify-between p-2 bg-gray-100 border-b border-gray-300">
        <h3 className="font-semibold">React Performance Monitor</h3>
        <button
          onClick={() => setShowPanel(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>
      
      <div className="p-2 max-h-64 overflow-y-auto">
        <div className="mb-2">
          <strong>Total Components:</strong> {metrics.size}
        </div>
        
        {slowComponents.length > 0 && (
          <>
            <div className="mb-2">
              <strong>Slow Components (&gt;16ms):</strong>
            </div>
            {slowComponents.map((metric) => (
              <div key={metric.componentName} className="mb-1 p-1 bg-red-50 rounded">
                <div className="font-medium text-red-700">{metric.componentName}</div>
                <div className="text-red-600">
                  Avg: {metric.averageRenderTime.toFixed(1)}ms | 
                  Renders: {metric.renderCount} | 
                  Max: {metric.slowestRender.toFixed(1)}ms
                </div>
              </div>
            ))}
          </>
        )}
        
        <div className="mt-2 pt-2 border-t border-gray-200 text-gray-500">
          Press Ctrl+Shift+P to toggle
        </div>
      </div>
    </div>
  );
});

/**
 * Hook for accessing performance data
 */
export function usePerformanceMetrics(componentName?: string) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | Map<string, PerformanceMetrics> | undefined>();

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(performanceMonitor.getMetrics(componentName));
    };

    updateMetrics();
    
    const unsubscribe = performanceMonitor.onProfilerData(updateMetrics);
    return unsubscribe;
  }, [componentName]);

  return metrics;
}

/**
 * HOC for adding performance profiling to components
 */
export function withPerformanceProfiler<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  options: {
    profileId?: string;
    logSlowRenders?: boolean;
    threshold?: number;
  } = {}
) {
  const {
    profileId = Component.displayName || Component.name || 'Anonymous',
    logSlowRenders = true,
    threshold = 16
  } = options;

  const WrappedComponent = memo((props: T) => (
    <EnhancedProfiler
      id={profileId}
      logSlowRenders={logSlowRenders}
      threshold={threshold}
    >
      <Component {...props} />
    </EnhancedProfiler>
  ));

  WrappedComponent.displayName = `withPerformanceProfiler(${profileId})`;

  return WrappedComponent;
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__PERFORMANCE_UTILS__ = {
    monitor: performanceMonitor,
    generateReport: () => performanceMonitor.generatePerformanceReport(),
    getSlowComponents: (threshold?: number) => performanceMonitor.getSlowComponents(threshold),
    exportMetrics: () => performanceMonitor.exportMetrics(),
    reset: () => performanceMonitor.reset()
  };
  
  console.log('🔍 React Performance Monitor initialized. Use window.__PERFORMANCE_UTILS__ for debugging.');
}

export default performanceMonitor;