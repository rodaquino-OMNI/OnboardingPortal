/**
 * Performance Budget Guard - Ensure no regression during migration
 * Automatically triggers rollback if performance degrades beyond thresholds
 */

export interface PerformanceMetrics {
  apiResponseTime: number;      // ms
  memoryUsage: number;          // MB
  testCoverage: number;         // percentage
  errorRate: number;            // errors per minute
  renderCycles: number;         // React render count
  bundleSize: number;           // KB
  startupTime: number;          // seconds
  securityScore: number;        // 0-100
}

export interface PerformanceBudget {
  apiResponseTime: { max: number; tolerance: number };
  memoryUsage: { max: number; tolerance: number };
  testCoverage: { min: number; tolerance: number };
  errorRate: { max: number; tolerance: number };
  renderCycles: { max: number; tolerance: number };
  bundleSize: { max: number; tolerance: number };
  startupTime: { max: number; tolerance: number };
  securityScore: { min: number; tolerance: number };
}

export interface RollbackDecision {
  shouldRollback: boolean;
  violations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export class PerformanceBudgetGuard {
  private baseline: PerformanceMetrics = {
    apiResponseTime: 200,    // <200ms current
    memoryUsage: 820,        // ~820MB current
    testCoverage: 83,        // 83% current
    errorRate: 1.0,          // baseline error rate
    renderCycles: 3,         // max render cycles
    bundleSize: 2048,        // 2MB bundle
    startupTime: 60,         // 60 seconds
    securityScore: 85        // 85/100 current
  };

  private budget: PerformanceBudget = {
    apiResponseTime: { max: 220, tolerance: 1.1 },  // Allow 10% degradation
    memoryUsage: { max: 900, tolerance: 1.1 },      // Allow 10% increase
    testCoverage: { min: 83, tolerance: 0 },        // No tolerance for coverage drop
    errorRate: { max: 1.05, tolerance: 1.05 },      // Allow 5% increase
    renderCycles: { max: 3, tolerance: 1.33 },      // Allow 33% increase
    bundleSize: { max: 2560, tolerance: 1.25 },     // Allow 25% increase
    startupTime: { max: 66, tolerance: 1.1 },       // Allow 10% increase
    securityScore: { min: 85, tolerance: 0 }        // No tolerance for security drop
  };

  private history: PerformanceMetrics[] = [];
  private rollbackHandlers: (() => Promise<void>)[] = [];

  /**
   * Check current metrics against budget
   */
  async checkBudget(current: PerformanceMetrics): Promise<RollbackDecision> {
    console.log('[PerformanceBudget] Checking metrics against budget...');
    
    const violations: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check API response time
    if (current.apiResponseTime > this.budget.apiResponseTime.max) {
      violations.push(
        `API response time ${current.apiResponseTime}ms exceeds budget ${this.budget.apiResponseTime.max}ms`
      );
      maxSeverity = this.escalateSeverity(maxSeverity, 'high');
    }

    // Check memory usage
    if (current.memoryUsage > this.budget.memoryUsage.max) {
      violations.push(
        `Memory usage ${current.memoryUsage}MB exceeds budget ${this.budget.memoryUsage.max}MB`
      );
      maxSeverity = this.escalateSeverity(maxSeverity, 'medium');
    }

    // Check test coverage - CRITICAL
    if (current.testCoverage < this.budget.testCoverage.min) {
      violations.push(
        `Test coverage ${current.testCoverage}% below minimum ${this.budget.testCoverage.min}%`
      );
      maxSeverity = 'critical'; // Test coverage drop is always critical
    }

    // Check error rate
    const errorRateIncrease = current.errorRate / this.baseline.errorRate;
    if (errorRateIncrease > this.budget.errorRate.max) {
      violations.push(
        `Error rate increased by ${((errorRateIncrease - 1) * 100).toFixed(1)}%`
      );
      maxSeverity = this.escalateSeverity(maxSeverity, 'high');
    }

    // Check render cycles
    if (current.renderCycles > this.budget.renderCycles.max) {
      violations.push(
        `Render cycles ${current.renderCycles} exceeds budget ${this.budget.renderCycles.max}`
      );
      maxSeverity = this.escalateSeverity(maxSeverity, 'medium');
    }

    // Check bundle size
    if (current.bundleSize > this.budget.bundleSize.max) {
      violations.push(
        `Bundle size ${current.bundleSize}KB exceeds budget ${this.budget.bundleSize.max}KB`
      );
      maxSeverity = this.escalateSeverity(maxSeverity, 'low');
    }

    // Check security score - CRITICAL
    if (current.securityScore < this.budget.securityScore.min) {
      violations.push(
        `Security score ${current.securityScore} below minimum ${this.budget.securityScore.min}`
      );
      maxSeverity = 'critical'; // Security score drop is always critical
    }

    // Store metrics for trending
    this.history.push(current);
    if (this.history.length > 100) {
      this.history.shift(); // Keep last 100 measurements
    }

    // Determine if rollback is needed
    const shouldRollback = maxSeverity === 'critical' || 
                          (maxSeverity === 'high' && violations.length > 2);

    // Generate recommendation
    const recommendation = this.generateRecommendation(violations, maxSeverity);

    // If rollback needed, trigger it
    if (shouldRollback) {
      await this.triggerRollback(violations);
    }

    return {
      shouldRollback,
      violations,
      severity: maxSeverity,
      recommendation
    };
  }

  /**
   * Register a rollback handler
   */
  registerRollbackHandler(handler: () => Promise<void>): void {
    this.rollbackHandlers.push(handler);
  }

  /**
   * Trigger rollback
   */
  private async triggerRollback(violations: string[]): Promise<void> {
    console.error('🚨 PERFORMANCE BUDGET EXCEEDED - TRIGGERING ROLLBACK', violations);
    
    // Send alert
    await this.sendAlert({
      type: 'PERFORMANCE_ROLLBACK',
      violations,
      timestamp: new Date().toISOString()
    });

    // Execute all rollback handlers
    for (const handler of this.rollbackHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Rollback handler failed:', error);
      }
    }
  }

  /**
   * Generate recommendation based on violations
   */
  private generateRecommendation(
    violations: string[],
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): string {
    if (violations.length === 0) {
      return 'All metrics within budget. Safe to proceed.';
    }

    if (severity === 'critical') {
      return 'CRITICAL: Immediate rollback required. Do not proceed with migration.';
    }

    if (severity === 'high') {
      return 'HIGH RISK: Consider rolling back or implementing optimizations before proceeding.';
    }

    if (severity === 'medium') {
      return 'MODERATE RISK: Monitor closely and optimize where possible.';
    }

    return 'LOW RISK: Minor violations detected. Continue with caution.';
  }

  /**
   * Escalate severity level
   */
  private escalateSeverity(
    current: 'low' | 'medium' | 'high' | 'critical',
    new_: 'low' | 'medium' | 'high' | 'critical'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const levels = { low: 0, medium: 1, high: 2, critical: 3 };
    return levels[new_] > levels[current] ? new_ : current;
  }

  /**
   * Get current metrics (would connect to real monitoring)
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    // In real implementation, this would fetch from monitoring tools
    // For now, return baseline with some variation
    const variation = () => 0.95 + Math.random() * 0.1; // ±5% variation

    return {
      apiResponseTime: this.baseline.apiResponseTime * variation(),
      memoryUsage: this.baseline.memoryUsage * variation(),
      testCoverage: this.baseline.testCoverage, // From test runner
      errorRate: this.baseline.errorRate * variation(),
      renderCycles: Math.round(this.baseline.renderCycles * variation()),
      bundleSize: this.baseline.bundleSize * variation(),
      startupTime: this.baseline.startupTime * variation(),
      securityScore: this.baseline.securityScore
    };
  }

  /**
   * Update baseline metrics
   */
  updateBaseline(metrics: Partial<PerformanceMetrics>): void {
    this.baseline = { ...this.baseline, ...metrics };
    console.log('[PerformanceBudget] Baseline updated:', this.baseline);
  }

  /**
   * Get performance trend
   */
  getTrend(metric: keyof PerformanceMetrics): 'improving' | 'stable' | 'degrading' {
    if (this.history.length < 10) return 'stable';

    const recent = this.history.slice(-10);
    const values = recent.map(m => m[metric]);
    
    // Calculate trend
    const firstHalf = values.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = values.slice(5).reduce((a, b) => a + b, 0) / 5;
    
    const change = ((secondHalf - firstHalf) / firstHalf) * 100;

    // For metrics where lower is better
    const lowerIsBetter = ['apiResponseTime', 'memoryUsage', 'errorRate', 'renderCycles', 'bundleSize', 'startupTime'];
    
    if (lowerIsBetter.includes(metric)) {
      if (change < -2) return 'improving';
      if (change > 2) return 'degrading';
    } else {
      // For metrics where higher is better (testCoverage, securityScore)
      if (change > 2) return 'improving';
      if (change < -2) return 'degrading';
    }

    return 'stable';
  }

  /**
   * Send alert to monitoring system
   */
  private async sendAlert(alert: any): Promise<void> {
    try {
      await fetch('/api/alerts/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Get summary report
   */
  getSummaryReport(): string {
    const trends = {
      apiResponseTime: this.getTrend('apiResponseTime'),
      memoryUsage: this.getTrend('memoryUsage'),
      testCoverage: this.getTrend('testCoverage'),
      errorRate: this.getTrend('errorRate'),
      securityScore: this.getTrend('securityScore')
    };

    return `
Performance Budget Summary
==========================
API Response: ${trends.apiResponseTime} (budget: ${this.budget.apiResponseTime.max}ms)
Memory Usage: ${trends.memoryUsage} (budget: ${this.budget.memoryUsage.max}MB)
Test Coverage: ${trends.testCoverage} (minimum: ${this.budget.testCoverage.min}%)
Error Rate: ${trends.errorRate} (max increase: ${((this.budget.errorRate.max - 1) * 100).toFixed(0)}%)
Security Score: ${trends.securityScore} (minimum: ${this.budget.securityScore.min})
    `.trim();
  }
}

// Export singleton instance
export const performanceBudgetGuard = new PerformanceBudgetGuard();