/**
 * Feature Monitoring and Rollback System
 * 
 * Monitors performance optimization features and automatically
 * disables them if error thresholds are exceeded.
 * 
 * Safety Features:
 * - Automatic rollback on high error rates
 * - Real-time performance monitoring
 * - Kill switch management
 * - Metric collection for analysis
 */

export interface FeatureMetrics {
  cacheErrors: number;
  cacheHits: number;
  cacheMisses: number;
  criticalCacheBlocks: number;
  memoryUsage: number;
  touchErrors: number;
  touchInteractions: number;
  completionRate: number;
  errorRate: number;
  responseTime: number[];
  crashCount: number;
  timestamp: number;
}

export interface RollbackThresholds {
  maxCacheErrorsPerHour: number;
  maxTouchErrorsPerHour: number;
  maxCrashesPerHour: number;
  minCompletionRate: number;
  maxErrorRate: number;
  maxResponseTimeMs: number;
  maxMemoryMB: number;
}

export interface FeatureFlags {
  cacheEnabled: boolean;
  touchOptimizationEnabled: boolean;
  hapticEnabled: boolean;
  performanceOptimizationEnabled: boolean;
}

// Safe default thresholds
const DEFAULT_THRESHOLDS: RollbackThresholds = {
  maxCacheErrorsPerHour: 10,
  maxTouchErrorsPerHour: 50,
  maxCrashesPerHour: 1,
  minCompletionRate: 0.65,
  maxErrorRate: 0.01, // 1% error rate
  maxResponseTimeMs: 500,
  maxMemoryMB: 50,
};

// Conservative feature flags - everything off by default
const DEFAULT_FLAGS: FeatureFlags = {
  cacheEnabled: false,
  touchOptimizationEnabled: false,
  hapticEnabled: false,
  performanceOptimizationEnabled: false,
};

export class FeatureMonitor {
  private metrics: FeatureMetrics[] = [];
  private thresholds: RollbackThresholds;
  private flags: FeatureFlags;
  private rollbackCallbacks: Array<(feature: string) => void> = [];
  private monitoringInterval?: NodeJS.Timeout;
  private hourlyMetrics: Map<string, number> = new Map();
  private isMonitoring: boolean = false;

  constructor(
    thresholds: Partial<RollbackThresholds> = {},
    initialFlags: Partial<FeatureFlags> = {}
  ) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.flags = { ...DEFAULT_FLAGS, ...initialFlags };
    
    // Load saved flags from localStorage
    this.loadFlags();
    
    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Start monitoring system
   */
  private startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Check metrics every minute
    this.monitoringInterval = setInterval(() => {
      this.checkThresholds();
      this.cleanOldMetrics();
    }, 60 * 1000);

    // Monitor for crashes
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.handleError.bind(this));
      window.addEventListener('unhandledrejection', this.handleRejection.bind(this));
    }
  }

  /**
   * Record a metric event
   */
  recordMetric(type: keyof FeatureMetrics, value: number | boolean = 1): void {
    const now = Date.now();
    const currentMetric = this.getCurrentMetric();
    
    switch (type) {
      case 'cacheErrors':
      case 'cacheHits':
      case 'cacheMisses':
      case 'criticalCacheBlocks':
      case 'touchErrors':
      case 'touchInteractions':
      case 'crashCount':
        (currentMetric[type] as number)++;
        break;
      
      case 'memoryUsage':
      case 'completionRate':
      case 'errorRate':
        (currentMetric[type] as number) = value as number;
        break;
      
      case 'responseTime':
        (currentMetric[type] as number[]).push(value as number);
        break;
    }

    // Update hourly metrics
    const hourKey = `${type}_${Math.floor(now / (60 * 60 * 1000))}`;
    this.hourlyMetrics.set(hourKey, (this.hourlyMetrics.get(hourKey) || 0) + 1);
  }

  /**
   * Get or create current metric object
   */
  private getCurrentMetric(): FeatureMetrics {
    const now = Date.now();
    let current = this.metrics[this.metrics.length - 1];
    
    // Create new metric every minute
    if (!current || now - current.timestamp > 60 * 1000) {
      current = {
        cacheErrors: 0,
        cacheHits: 0,
        cacheMisses: 0,
        criticalCacheBlocks: 0,
        memoryUsage: 0,
        touchErrors: 0,
        touchInteractions: 0,
        completionRate: 1,
        errorRate: 0,
        responseTime: [],
        crashCount: 0,
        timestamp: now,
      };
      this.metrics.push(current);
    }
    
    return current;
  }

  /**
   * Check if any thresholds are exceeded
   */
  private checkThresholds(): void {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recentMetrics = this.metrics.filter(m => m.timestamp > hourAgo);
    
    if (recentMetrics.length === 0) return;
    
    // Calculate hourly rates
    const hourlyStats = {
      cacheErrors: this.getHourlyCount('cacheErrors'),
      touchErrors: this.getHourlyCount('touchErrors'),
      crashes: this.getHourlyCount('crashCount'),
      avgCompletionRate: this.getAverage(recentMetrics, 'completionRate'),
      avgErrorRate: this.getAverage(recentMetrics, 'errorRate'),
      avgResponseTime: this.getAverageResponseTime(recentMetrics),
      maxMemory: Math.max(...recentMetrics.map(m => m.memoryUsage)),
    };

    // Check cache errors
    if (hourlyStats.cacheErrors > this.thresholds.maxCacheErrorsPerHour) {
      this.rollbackFeature('cache', `Cache errors exceeded: ${hourlyStats.cacheErrors}/hour`);
    }

    // Check touch errors
    if (hourlyStats.touchErrors > this.thresholds.maxTouchErrorsPerHour) {
      this.rollbackFeature('touch', `Touch errors exceeded: ${hourlyStats.touchErrors}/hour`);
    }

    // Check crashes
    if (hourlyStats.crashes > this.thresholds.maxCrashesPerHour) {
      this.rollbackAll(`Crashes exceeded: ${hourlyStats.crashes}/hour`);
    }

    // Check completion rate
    if (hourlyStats.avgCompletionRate < this.thresholds.minCompletionRate) {
      this.rollbackAll(`Completion rate too low: ${hourlyStats.avgCompletionRate}`);
    }

    // Check error rate
    if (hourlyStats.avgErrorRate > this.thresholds.maxErrorRate) {
      this.rollbackFeature('cache', `Error rate too high: ${hourlyStats.avgErrorRate}`);
    }

    // Check response time
    if (hourlyStats.avgResponseTime > this.thresholds.maxResponseTimeMs) {
      this.rollbackFeature('performance', `Response time too high: ${hourlyStats.avgResponseTime}ms`);
    }

    // Check memory usage
    if (hourlyStats.maxMemory > this.thresholds.maxMemoryMB * 1024 * 1024) {
      this.rollbackFeature('cache', `Memory usage too high: ${hourlyStats.maxMemory / 1024 / 1024}MB`);
    }
  }

  /**
   * Get hourly count for a metric
   */
  private getHourlyCount(metric: string): number {
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    return this.hourlyMetrics.get(`${metric}_${currentHour}`) || 0;
  }

  /**
   * Calculate average for a metric
   */
  private getAverage(metrics: FeatureMetrics[], field: keyof FeatureMetrics): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + (m[field] as number), 0);
    return sum / metrics.length;
  }

  /**
   * Calculate average response time
   */
  private getAverageResponseTime(metrics: FeatureMetrics[]): number {
    const allTimes = metrics.flatMap(m => m.responseTime);
    if (allTimes.length === 0) return 0;
    return allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
  }

  /**
   * Rollback a specific feature
   */
  private rollbackFeature(feature: string, reason: string): void {
    console.warn(`[FeatureMonitor] Rolling back ${feature}: ${reason}`);
    
    switch (feature) {
      case 'cache':
        this.flags.cacheEnabled = false;
        break;
      case 'touch':
        this.flags.touchOptimizationEnabled = false;
        this.flags.hapticEnabled = false;
        break;
      case 'performance':
        this.flags.performanceOptimizationEnabled = false;
        break;
    }
    
    // Save flags
    this.saveFlags();
    
    // Notify callbacks
    this.rollbackCallbacks.forEach(cb => cb(feature));
    
    // Log to monitoring
    this.logRollback(feature, reason);
  }

  /**
   * Rollback all features
   */
  private rollbackAll(reason: string): void {
    console.error(`[FeatureMonitor] EMERGENCY ROLLBACK: ${reason}`);
    
    this.flags = { ...DEFAULT_FLAGS };
    this.saveFlags();
    
    // Notify callbacks
    this.rollbackCallbacks.forEach(cb => cb('all'));
    
    // Log to monitoring
    this.logRollback('all', reason);
  }

  /**
   * Handle global errors
   */
  private handleError(event: ErrorEvent): void {
    this.recordMetric('crashCount');
    
    // Check if error is related to our features
    if (event.message.includes('cache') || event.message.includes('touch')) {
      this.recordMetric('errorRate', 1);
    }
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleRejection(event: PromiseRejectionEvent): void {
    this.recordMetric('errorRate', 1);
  }

  /**
   * Log rollback event
   */
  private logRollback(feature: string, reason: string): void {
    const event = {
      type: 'FEATURE_ROLLBACK',
      feature,
      reason,
      timestamp: Date.now(),
      metrics: this.getRecentMetrics(),
    };

    // Send to monitoring service
    if (typeof window !== 'undefined' && (window as any).monitoring) {
      (window as any).monitoring.logEvent(event);
    }

    // Also log to console for debugging
    console.table(event.metrics);
  }

  /**
   * Get recent metrics for analysis
   */
  getRecentMetrics(): FeatureMetrics[] {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.metrics.filter(m => m.timestamp > fiveMinutesAgo);
  }

  /**
   * Clean old metrics to prevent memory leak
   */
  private cleanOldMetrics(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    
    // Clean hourly metrics
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    for (const [key] of this.hourlyMetrics) {
      const hour = parseInt(key.split('_').pop() || '0');
      if (hour < currentHour - 1) {
        this.hourlyMetrics.delete(key);
      }
    }
  }

  /**
   * Save flags to localStorage
   */
  private saveFlags(): void {
    try {
      localStorage.setItem('feature_flags', JSON.stringify(this.flags));
    } catch (error) {
      console.error('[FeatureMonitor] Failed to save flags:', error);
    }
  }

  /**
   * Load flags from localStorage
   */
  private loadFlags(): void {
    try {
      const saved = localStorage.getItem('feature_flags');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.flags = { ...this.flags, ...parsed };
      }
    } catch (error) {
      console.error('[FeatureMonitor] Failed to load flags:', error);
    }
  }

  /**
   * Get current feature flags
   */
  getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Manually enable a feature (for testing)
   */
  enableFeature(feature: keyof FeatureFlags): void {
    this.flags[feature] = true;
    this.saveFlags();
  }

  /**
   * Manually disable a feature
   */
  disableFeature(feature: keyof FeatureFlags): void {
    this.flags[feature] = false;
    this.saveFlags();
  }

  /**
   * Register rollback callback
   */
  onRollback(callback: (feature: string) => void): void {
    this.rollbackCallbacks.push(callback);
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    healthy: boolean;
    flags: FeatureFlags;
    recentErrors: number;
    avgResponseTime: number;
    memoryUsage: number;
  } {
    const recent = this.getRecentMetrics();
    const totalErrors = recent.reduce((sum, m) => sum + m.cacheErrors + m.touchErrors, 0);
    const avgResponseTime = this.getAverageResponseTime(recent);
    const memoryUsage = recent.length > 0 ? recent[recent.length - 1].memoryUsage : 0;
    
    return {
      healthy: totalErrors < 10 && avgResponseTime < 500,
      flags: this.getFlags(),
      recentErrors: totalErrors,
      avgResponseTime,
      memoryUsage,
    };
  }

  /**
   * Destroy monitor and cleanup
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', this.handleError.bind(this));
      window.removeEventListener('unhandledrejection', this.handleRejection.bind(this));
    }
    
    this.isMonitoring = false;
  }
}

// Global singleton instance
export const featureMonitor = new FeatureMonitor();