import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { logger } from './logger';

/**
 * Memory leak prevention utilities for React components
 */
export class MemoryLeakPrevention {
  private static timeouts = new Set<NodeJS.Timeout>();
  private static intervals = new Set<NodeJS.Timeout>();
  private static abortControllers = new Set<AbortController>();
  private static eventListeners = new Map<Element, Array<{ event: string; listener: EventListener; options?: AddEventListenerOptions }>>();

  /**
   * Register a timeout for automatic cleanup
   */
  static registerTimeout(timeout: NodeJS.Timeout): NodeJS.Timeout {
    this.timeouts.add(timeout);
    return timeout;
  }

  /**
   * Register an interval for automatic cleanup
   */
  static registerInterval(interval: NodeJS.Timeout): NodeJS.Timeout {
    this.intervals.add(interval);
    return interval;
  }

  /**
   * Register an AbortController for automatic cleanup
   */
  static registerAbortController(controller: AbortController): AbortController {
    this.abortControllers.add(controller);
    return controller;
  }

  /**
   * Register an event listener for automatic cleanup
   */
  static registerEventListener(
    element: Element,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    if (!this.eventListeners.has(element)) {
      this.eventListeners.set(element, []);
    }
    this.eventListeners.get(element)!.push({ event, listener, options });
    element.addEventListener(event, listener, options);
  }

  /**
   * Clean up a specific timeout
   */
  static clearTimeout(timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    this.timeouts.delete(timeout);
  }

  /**
   * Clean up a specific interval
   */
  static clearInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  /**
   * Clean up all registered resources
   */
  static cleanup(): void {
    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();

    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    // Abort all controllers
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();

    // Remove all event listeners
    this.eventListeners.forEach((listeners, element) => {
      listeners.forEach(({ event, listener, options }) => {
        element.removeEventListener(event, listener, options);
      });
    });
    this.eventListeners.clear();

    logger.info('Memory leak prevention cleanup completed', { 
      timestamp: Date.now() 
    }, 'MemoryLeakPrevention');
  }

  /**
   * Get current resource counts for monitoring
   */
  static getResourceCounts() {
    return {
      timeouts: this.timeouts.size,
      intervals: this.intervals.size,
      abortControllers: this.abortControllers.size,
      eventListeners: this.eventListeners.size
    };
  }
}

/**
 * Hook for safe timeout management with automatic cleanup
 */
export function useSafeTimeout() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setSafeTimeout = useCallback((callback: () => void, delay: number) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      MemoryLeakPrevention.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Set new timeout with registration
    const timeout = setTimeout(callback, delay);
    timeoutRef.current = MemoryLeakPrevention.registerTimeout(timeout);
    return timeout;
  }, []);

  const clearSafeTimeout = useCallback(() => {
    if (timeoutRef.current) {
      MemoryLeakPrevention.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSafeTimeout();
    };
  }, [clearSafeTimeout]);

  return { setSafeTimeout, clearSafeTimeout };
}

/**
 * Hook for safe interval management with automatic cleanup
 */
export function useSafeInterval() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const setSafeInterval = useCallback((callback: () => void, delay: number) => {
    // Clear existing interval
    if (intervalRef.current) {
      MemoryLeakPrevention.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set new interval with registration
    const interval = setInterval(callback, delay);
    intervalRef.current = MemoryLeakPrevention.registerInterval(interval);
    return interval;
  }, []);

  const clearSafeInterval = useCallback(() => {
    if (intervalRef.current) {
      MemoryLeakPrevention.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSafeInterval();
    };
  }, [clearSafeInterval]);

  return { setSafeInterval, clearSafeInterval };
}

/**
 * Hook for safe fetch requests with automatic abort on unmount
 */
export function useSafeFetch() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const safeFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    // Abort previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    const controller = new AbortController();
    abortControllerRef.current = MemoryLeakPrevention.registerAbortController(controller);

    // Add abort signal to options
    const fetchOptions = {
      ...options,
      signal: controller.signal
    };

    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, this is expected behavior
        logger.debug('Fetch request aborted', { url }, 'useSafeFetch');
        return null;
      }
      throw error;
    }
  }, []);

  const abortRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRequest();
    };
  }, [abortRequest]);

  return { safeFetch, abortRequest };
}

/**
 * Performance monitoring hook for React components
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const [renderStats, setRenderStats] = useState({
    totalRenders: 0,
    avgRenderTime: 0,
    lastRenderDuration: 0
  });

  useEffect(() => {
    renderCountRef.current += 1;
    const now = Date.now();
    const renderDuration = now - lastRenderTime.current;
    lastRenderTime.current = now;

    setRenderStats(prev => ({
      totalRenders: renderCountRef.current,
      avgRenderTime: (prev.avgRenderTime * (renderCountRef.current - 1) + renderDuration) / renderCountRef.current,
      lastRenderDuration: renderDuration
    }));

    // Log performance warnings for slow renders
    if (renderDuration > 16) { // 16ms is the target for 60fps
      logger.warn(`Slow render detected in ${componentName}`, {
        duration: renderDuration,
        totalRenders: renderCountRef.current
      }, 'PerformanceMonitor');
    }
  });

  const logRenderStats = useCallback(() => {
    logger.info(`Render stats for ${componentName}`, renderStats, 'PerformanceMonitor');
  }, [componentName, renderStats]);

  return {
    renderStats,
    logRenderStats
  };
}

/**
 * Optimized state updater that batches updates
 */
export function useBatchedState<T>(initialState: T) {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef<Partial<T>[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const batchedSetState = useCallback((updater: Partial<T> | ((prev: T) => Partial<T>)) => {
    const update = typeof updater === 'function' ? updater(state) : updater;
    pendingUpdates.current.push(update);

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Batch updates to next tick
    updateTimeoutRef.current = setTimeout(() => {
      if (pendingUpdates.current.length > 0) {
        setState(prev => {
          let newState = { ...prev };
          pendingUpdates.current.forEach(update => {
            newState = { ...newState, ...update };
          });
          pendingUpdates.current = [];
          return newState;
        });
      }
    }, 0);
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return [state, batchedSetState] as const;
}

/**
 * Debounced value hook for performance optimization
 */
export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const { setSafeTimeout, clearSafeTimeout } = useSafeTimeout();

  useEffect(() => {
    clearSafeTimeout();
    setSafeTimeout(() => setDebouncedValue(value), delay);
    
    return () => clearSafeTimeout();
  }, [value, delay, setSafeTimeout, clearSafeTimeout]);

  return debouncedValue;
}

/**
 * Throttled callback hook for performance optimization
 */
export function useThrottled<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        callback(...args);
      }, delay - (now - lastCall.current));
    }
  }, [callback, delay]) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * Memoization utility for expensive computations
 */
export function createMemoizer<T extends (...args: any[]) => any>() {
  const cache = new Map<string, ReturnType<T>>();
  const maxCacheSize = 100; // Prevent memory leaks

  return function memoize(fn: T, keyFn?: (...args: Parameters<T>) => string): T {
    return ((...args: Parameters<T>) => {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key)!;
      }

      const result = fn(...args);
      
      // Implement LRU cache to prevent unbounded growth
      if (cache.size >= maxCacheSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      cache.set(key, result);
      return result;
    }) as T;
  };
}

/**
 * React DevTools profiler integration
 */
export function useProfiler(componentName: string, actualDuration?: number) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const profilerData = {
        componentName,
        timestamp: Date.now(),
        actualDuration: actualDuration || 0
      };

      // Send to React DevTools if available
      if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot?.(1, {
          current: {
            componentName,
            actualDuration: actualDuration || 0
          }
        });
      }

      // Log to console for debugging
      if (actualDuration && actualDuration > 16) {
        console.warn(`Slow component: ${componentName} took ${actualDuration}ms`);
      }
    }
  }, [componentName, actualDuration]);
}

/**
 * Hook for monitoring component lifecycle and performance
 */
export function useComponentLifecycle(componentName: string) {
  const mountTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);
  const updateCount = useRef<number>(0);

  // Track mount
  useEffect(() => {
    const now = Date.now();
    logger.info(`Component ${componentName} mounted`, {
      mountTime: now - mountTime.current
    }, 'ComponentLifecycle');

    // Track unmount
    return () => {
      logger.info(`Component ${componentName} unmounted`, {
        totalLifetime: Date.now() - mountTime.current,
        totalRenders: renderCount.current,
        totalUpdates: updateCount.current
      }, 'ComponentLifecycle');
    };
  }, [componentName]);

  // Track renders
  useEffect(() => {
    renderCount.current += 1;
  });

  // Track updates (excluding first render)
  useEffect(() => {
    if (renderCount.current > 1) {
      updateCount.current += 1;
    }
  });

  return {
    renderCount: renderCount.current,
    updateCount: updateCount.current,
    lifetime: Date.now() - mountTime.current
  };
}

// Global cleanup function to be called on app unmount
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    MemoryLeakPrevention.cleanup();
  });
}

// Export utilities for global access
if (typeof window !== 'undefined') {
  (window as any).__REACT_PERF_UTILS__ = {
    MemoryLeakPrevention,
    getResourceCounts: () => MemoryLeakPrevention.getResourceCounts()
  };
}
