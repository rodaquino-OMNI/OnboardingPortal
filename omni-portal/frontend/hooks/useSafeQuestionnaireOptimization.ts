/**
 * Safe Questionnaire Optimization Hook
 * 
 * Integrates all performance optimizations with safety measures:
 * - Safe cache (no critical questions)
 * - Touch optimization (no gestures)
 * - Memory management
 * - Feature monitoring
 * - Automatic rollback
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { SafeQuestionnaireCache } from '@/lib/services/safe-questionnaire-cache';
import { featureMonitor, FeatureFlags } from '@/lib/services/feature-monitor';
import { debounce, throttle } from 'lodash-es';

export interface OptimizationConfig {
  enableCache?: boolean;
  enableTouchOptimization?: boolean;
  enablePerformanceMonitoring?: boolean;
  debugMode?: boolean;
}

export interface OptimizationMetrics {
  cacheHitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  errorCount: number;
  isHealthy: boolean;
}

export function useSafeQuestionnaireOptimization(config: OptimizationConfig = {}) {
  const cacheRef = useRef<SafeQuestionnaireCache | null>(null);
  const metricsRef = useRef<OptimizationMetrics>({
    cacheHitRate: 0,
    avgResponseTime: 0,
    memoryUsage: 0,
    errorCount: 0,
    isHealthy: true,
  });
  const responseTimes = useRef<number[]>([]);
  const featureFlagsRef = useRef<FeatureFlags>(featureMonitor.getFlags());

  // Initialize cache if enabled
  useEffect(() => {
    const flags = featureMonitor.getFlags();
    featureFlagsRef.current = flags;

    if (config.enableCache && flags.cacheEnabled) {
      cacheRef.current = new SafeQuestionnaireCache({
        enableCache: true,
        enableCriticalCache: false, // NEVER enable
        maxMemoryMB: 10,
        maxCacheItems: 50,
      });
      
      // Restore from localStorage
      cacheRef.current.restore();
      
      if (config.debugMode) {
        console.log('[SafeOptimization] Cache initialized');
      }
    }

    // Register for rollback notifications
    const handleRollback = (feature: string) => {
      console.warn(`[SafeOptimization] Feature rolled back: ${feature}`);
      
      if (feature === 'cache' || feature === 'all') {
        // Disable and clear cache
        if (cacheRef.current) {
          cacheRef.current.destroy();
          cacheRef.current = null;
        }
      }
      
      // Update flags
      featureFlagsRef.current = featureMonitor.getFlags();
    };

    featureMonitor.onRollback(handleRollback);

    // Cleanup on unmount
    return () => {
      if (cacheRef.current) {
        cacheRef.current.persist(); // Save before destroy
        cacheRef.current.destroy();
      }
    };
  }, [config.enableCache, config.debugMode]);

  /**
   * Safe response caching
   */
  const cacheResponse = useCallback((questionId: string, value: any) => {
    const startTime = performance.now();
    
    try {
      if (!cacheRef.current || !featureFlagsRef.current.cacheEnabled) {
        return false;
      }

      const success = cacheRef.current.set(questionId, value);
      
      // Record metrics
      const responseTime = performance.now() - startTime;
      responseTimes.current.push(responseTime);
      featureMonitor.recordMetric('responseTime', responseTime);
      
      if (!success) {
        featureMonitor.recordMetric('cacheErrors');
      }
      
      return success;
    } catch (error) {
      console.error('[SafeOptimization] Cache error:', error);
      featureMonitor.recordMetric('cacheErrors');
      return false;
    }
  }, []);

  /**
   * Get cached response
   */
  const getCachedResponse = useCallback((questionId: string) => {
    if (!cacheRef.current || !featureFlagsRef.current.cacheEnabled) {
      featureMonitor.recordMetric('cacheMisses');
      return null;
    }

    const value = cacheRef.current.get(questionId);
    
    if (value !== null) {
      featureMonitor.recordMetric('cacheHits');
    } else {
      featureMonitor.recordMetric('cacheMisses');
    }
    
    return value;
  }, []);

  /**
   * Debounced validation to reduce computation
   */
  const validateWithDebounce = useMemo(
    () => debounce((value: any, validator: (v: any) => string | null) => {
      const startTime = performance.now();
      
      try {
        const result = validator(value);
        
        const responseTime = performance.now() - startTime;
        featureMonitor.recordMetric('responseTime', responseTime);
        
        return result;
      } catch (error) {
        console.error('[SafeOptimization] Validation error:', error);
        featureMonitor.recordMetric('errorRate', 1);
        return 'Erro de validação';
      }
    }, 300),
    []
  );

  /**
   * Throttled progress updates (60fps max)
   */
  const updateProgressThrottled = useMemo(
    () => throttle((progress: number, callback: (p: number) => void) => {
      requestAnimationFrame(() => {
        try {
          callback(progress);
        } catch (error) {
          console.error('[SafeOptimization] Progress update error:', error);
        }
      });
    }, 16), // ~60fps
    []
  );

  /**
   * Safe batch updates
   */
  const batchUpdates = useCallback((updates: Array<() => void>) => {
    requestAnimationFrame(() => {
      updates.forEach(update => {
        try {
          update();
        } catch (error) {
          console.error('[SafeOptimization] Batch update error:', error);
          featureMonitor.recordMetric('errorRate', 1);
        }
      });
    });
  }, []);

  /**
   * Memory-safe computation with caching
   */
  const computeWithCache = useCallback(<T>(
    key: string,
    computeFn: () => T,
    ttl: number = 60000
  ): T => {
    // Try cache first
    const cached = getCachedResponse(key);
    if (cached !== null) {
      return cached as T;
    }

    // Compute and cache
    const startTime = performance.now();
    try {
      const result = computeFn();
      
      // Check memory before caching (Chrome-specific API, fallback to always cache)
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      if (memoryUsage > 0) {
        featureMonitor.recordMetric('memoryUsage', memoryUsage);
      }
      
      // Only cache if memory is ok or API not available
      if (memoryUsage === 0 || memoryUsage < 50 * 1024 * 1024) { // 50MB limit
        cacheResponse(key, result);
      }
      
      const responseTime = performance.now() - startTime;
      featureMonitor.recordMetric('responseTime', responseTime);
      
      return result;
    } catch (error) {
      console.error('[SafeOptimization] Computation error:', error);
      featureMonitor.recordMetric('errorRate', 1);
      throw error;
    }
  }, [cacheResponse, getCachedResponse]);

  /**
   * Touch optimization check
   */
  const isTouchOptimized = useCallback((): boolean => {
    return featureFlagsRef.current.touchOptimizationEnabled;
  }, []);

  /**
   * Get current metrics
   */
  const getMetrics = useCallback((): OptimizationMetrics => {
    const cacheMetrics = cacheRef.current?.getMetrics();
    const healthStatus = featureMonitor.getHealthStatus();
    
    const cacheHitRate = cacheMetrics 
      ? cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses || 1)
      : 0;
    
    const avgResponseTime = responseTimes.current.length > 0
      ? responseTimes.current.reduce((a, b) => a + b, 0) / responseTimes.current.length
      : 0;
    
    return {
      cacheHitRate,
      avgResponseTime,
      memoryUsage: healthStatus.memoryUsage,
      errorCount: healthStatus.recentErrors,
      isHealthy: healthStatus.healthy,
    };
  }, []);

  /**
   * Manual cache clear (for testing)
   */
  const clearCache = useCallback(() => {
    if (cacheRef.current) {
      cacheRef.current.clear();
      if (config.debugMode) {
        console.log('[SafeOptimization] Cache cleared');
      }
    }
  }, [config.debugMode]);

  /**
   * Force persist to localStorage
   */
  const persistCache = useCallback(() => {
    if (cacheRef.current) {
      return cacheRef.current.persist();
    }
    return false;
  }, []);

  /**
   * Check if a question is critical (never cached)
   */
  const isCriticalQuestion = useCallback((questionId: string): boolean => {
    const criticalIds = [
      'phq9_9',
      'harmful_thoughts',
      'emergency_symptoms',
      'chest_pain',
      'stroke_symptoms'
    ];
    
    return criticalIds.some(id => questionId.includes(id));
  }, []);

  /**
   * Safe cleanup for memory management
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // Clean old response times
      if (responseTimes.current.length > 100) {
        responseTimes.current = responseTimes.current.slice(-50);
      }
      
      // Check memory and trigger cleanup if needed (Chrome-specific API)
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      if (memoryUsage > 40 * 1024 * 1024 && cacheRef.current) { // 40MB threshold
        const metrics = cacheRef.current.getMetrics();
        if (metrics.itemCount > 30) {
          // Clear some cache entries
          if (config.debugMode) {
            console.log('[SafeOptimization] Memory pressure, reducing cache');
          }
          // Cache will auto-evict LRU items
        }
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(cleanupInterval);
  }, [config.debugMode]);

  return {
    // Core functions
    cacheResponse,
    getCachedResponse,
    validateWithDebounce,
    updateProgressThrottled,
    batchUpdates,
    computeWithCache,
    
    // Status checks
    isTouchOptimized,
    isCriticalQuestion,
    
    // Metrics and management
    getMetrics,
    clearCache,
    persistCache,
    
    // Feature flags
    flags: featureFlagsRef.current,
    
    // Health status
    isHealthy: featureMonitor.getHealthStatus().healthy,
  };
}