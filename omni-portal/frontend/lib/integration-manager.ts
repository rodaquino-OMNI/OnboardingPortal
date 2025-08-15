/**
 * Integration Manager - Manages the transition from old to new architecture
 * Ensures safe migration without disrupting users
 */

import { featureFlags } from './feature-flags';
import { performanceBudgetGuard } from '@/docs/migration-toolkit/performance-budget-guard';
import { boundaryValidator, BoundaryPhase } from '@/docs/migration-toolkit/boundary-validator';
import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { unifiedState } from '@/modules/state/UnifiedStateAdapter';
import { apiGateway } from '@/modules/api/ApiGateway';

export interface MigrationStatus {
  phase: 'inactive' | 'testing' | 'canary' | 'partial' | 'full' | 'complete';
  rolloutPercentage: number;
  activeFeatures: string[];
  issues: string[];
  metrics: {
    errorRate: number;
    performanceScore: number;
    userSatisfaction: number;
  };
}

export class IntegrationManager {
  private static instance: IntegrationManager;
  private status: MigrationStatus = {
    phase: 'inactive',
    rolloutPercentage: 0,
    activeFeatures: [],
    issues: [],
    metrics: {
      errorRate: 0,
      performanceScore: 100,
      userSatisfaction: 100
    }
  };
  
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeMonitoring();
  }

  static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  /**
   * Initialize the new architecture with safety checks
   */
  async initialize(): Promise<void> {
    console.log('[IntegrationManager] Initializing new architecture...');
    
    // Step 1: Verify all components are ready
    const readiness = await this.checkReadiness();
    if (!readiness.ready) {
      console.error('[IntegrationManager] System not ready:', readiness.issues);
      return;
    }
    
    // Step 2: Set up monitoring
    this.setupMetricsCollection();
    
    // Step 3: Enable testing phase (no users affected)
    await this.activatePhase('testing');
    
    // Step 4: Run validation suite
    const validation = await this.validateIntegration();
    if (!validation.success) {
      console.error('[IntegrationManager] Validation failed:', validation.errors);
      await this.rollback();
      return;
    }
    
    console.log('[IntegrationManager] Initialization complete');
  }

  /**
   * Check if system is ready for migration
   */
  private async checkReadiness(): Promise<{ ready: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check if old auth is working
    try {
      const authCheck = await fetch('/api/auth/profile', { 
        credentials: 'include',
        method: 'GET'
      });
      if (!authCheck.ok && authCheck.status !== 401) {
        issues.push('Auth system not responding');
      }
    } catch (error) {
      issues.push('Cannot reach auth API');
    }
    
    // Check if new modules are available
    if (typeof unifiedState === 'undefined') {
      issues.push('UnifiedStateAdapter not available');
    }
    
    if (typeof apiGateway === 'undefined') {
      issues.push('ApiGateway not available');
    }
    
    if (typeof eventBus === 'undefined') {
      issues.push('EventBus not available');
    }
    
    // Check performance baseline
    const metrics = await performanceBudgetGuard.getCurrentMetrics();
    if (metrics.apiResponseTime > 500) {
      issues.push('API response time too high for migration');
    }
    
    return {
      ready: issues.length === 0,
      issues
    };
  }

  /**
   * Activate a migration phase
   */
  async activatePhase(phase: 'testing' | 'canary' | 'partial' | 'full'): Promise<void> {
    console.log(`[IntegrationManager] Activating phase: ${phase}`);
    
    // Save current state for rollback
    this.saveRollbackPoint();
    
    switch (phase) {
      case 'testing':
        // Enable parallel execution for comparison
        featureFlags.set('PARALLEL_EXECUTION', true);
        featureFlags.set('ENFORCE_BOUNDARIES', 'log');
        boundaryValidator.setPhase(BoundaryPhase.LOG_ONLY);
        this.status.rolloutPercentage = 0;
        break;
        
      case 'canary':
        // 1% of users get new features
        featureFlags.setRolloutPercentage('USE_MODULAR_AUTH', 1);
        featureFlags.setRolloutPercentage('USE_UNIFIED_STATE', 1);
        featureFlags.setRolloutPercentage('USE_API_GATEWAY', 1);
        featureFlags.set('ENFORCE_BOUNDARIES', 'log');
        this.status.rolloutPercentage = 1;
        break;
        
      case 'partial':
        // 50% rollout
        featureFlags.setRolloutPercentage('USE_MODULAR_AUTH', 50);
        featureFlags.setRolloutPercentage('USE_UNIFIED_STATE', 50);
        featureFlags.setRolloutPercentage('USE_API_GATEWAY', 50);
        featureFlags.setRolloutPercentage('USE_EVENT_BUS', 50);
        featureFlags.set('ENFORCE_BOUNDARIES', 'warn');
        boundaryValidator.setPhase(BoundaryPhase.WARN_IN_DEV);
        this.status.rolloutPercentage = 50;
        break;
        
      case 'full':
        // 100% rollout
        featureFlags.setRolloutPercentage('USE_MODULAR_AUTH', 100);
        featureFlags.setRolloutPercentage('USE_UNIFIED_STATE', 100);
        featureFlags.setRolloutPercentage('USE_API_GATEWAY', 100);
        featureFlags.setRolloutPercentage('USE_EVENT_BUS', 100);
        featureFlags.set('ENFORCE_BOUNDARIES', 'strict');
        featureFlags.set('PARALLEL_EXECUTION', false); // Stop parallel execution
        boundaryValidator.setPhase(BoundaryPhase.STRICT);
        this.status.rolloutPercentage = 100;
        break;
    }
    
    this.status.phase = phase;
    
    // Emit phase change event
    eventBus.emit('migration.phase.changed', { phase, rollout: this.status.rolloutPercentage });
    
    // Start monitoring for issues
    this.startMonitoring();
  }

  /**
   * Validate integration is working correctly
   */
  private async validateIntegration(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Test auth flow
    try {
      // Test modular auth in isolation
      const { authContainer } = await import('@/modules/auth/container');
      const checkAuthUseCase = authContainer.getCheckAuthUseCase();
      const result = await checkAuthUseCase.execute();
      console.log('[IntegrationManager] Auth check result:', result);
    } catch (error) {
      errors.push(`Auth validation failed: ${error}`);
    }
    
    // Test state management
    try {
      unifiedState.set('test', 'validation', true);
      const value = unifiedState.get('test', 'validation');
      if (value !== true) {
        errors.push('State management validation failed');
      }
      unifiedState.remove('test', 'validation');
    } catch (error) {
      errors.push(`State validation failed: ${error}`);
    }
    
    // Test API gateway
    try {
      const metrics = apiGateway.getMetrics();
      console.log('[IntegrationManager] API Gateway metrics:', metrics);
    } catch (error) {
      errors.push(`API Gateway validation failed: ${error}`);
    }
    
    // Test event bus
    try {
      let received = false;
      const unsubscribe = eventBus.once('test.validation', () => {
        received = true;
      });
      eventBus.emit('test.validation', {});
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!received) {
        errors.push('Event bus validation failed');
      }
      unsubscribe();
    } catch (error) {
      errors.push(`Event bus validation failed: ${error}`);
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Set up metrics collection
   */
  private setupMetricsCollection(): void {
    // Monitor errors
    eventBus.on(EventTypes.ERROR_UNCAUGHT, (event) => {
      this.status.issues.push(event.payload.message);
      this.status.metrics.errorRate++;
      
      // Auto-rollback on critical errors
      if (this.status.metrics.errorRate > 10) {
        console.error('[IntegrationManager] Error rate too high, rolling back');
        this.rollback();
      }
    });
    
    // Monitor performance
    eventBus.on(EventTypes.PERFORMANCE_METRIC, (event) => {
      if (event.payload.duration > 1000) {
        this.status.metrics.performanceScore = Math.max(0, this.status.metrics.performanceScore - 1);
      }
    });
    
    // Monitor boundary violations
    const violations = boundaryValidator.getViolations();
    if (violations.length > 0) {
      this.status.issues.push(...violations.map(v => v.message));
    }
  }

  /**
   * Initialize monitoring systems
   */
  private initializeMonitoring(): void {
    // Set up performance monitoring
    performanceBudgetGuard.registerRollbackHandler(async () => {
      console.error('[IntegrationManager] Performance budget exceeded, rolling back');
      await this.rollback();
    });
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(async () => {
      // Check metrics
      const metrics = await performanceBudgetGuard.getCurrentMetrics();
      const decision = await performanceBudgetGuard.checkBudget(metrics);
      
      if (decision.shouldRollback) {
        console.error('[IntegrationManager] Rollback triggered:', decision.violations);
        await this.rollback();
      }
      
      // Check error rate
      if (this.status.metrics.errorRate > 5) {
        console.warn('[IntegrationManager] High error rate detected');
      }
      
      // Report status
      if (process.env.NODE_ENV === 'development') {
        console.log('[IntegrationManager] Status:', this.status);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Save rollback point
   */
  private saveRollbackPoint(): void {
    const snapshot = {
      flags: featureFlags.getAllFlags(),
      phase: this.status.phase,
      timestamp: Date.now()
    };
    
    localStorage.setItem('migration_rollback_point', JSON.stringify(snapshot));
  }

  /**
   * Rollback to previous state
   */
  async rollback(): Promise<void> {
    console.log('[IntegrationManager] Rolling back migration...');
    
    // Disable all new features
    featureFlags.set('USE_MODULAR_AUTH', false);
    featureFlags.set('USE_UNIFIED_STATE', false);
    featureFlags.set('USE_API_GATEWAY', false);
    featureFlags.set('USE_EVENT_BUS', false);
    featureFlags.set('ENFORCE_BOUNDARIES', 'off');
    featureFlags.set('PARALLEL_EXECUTION', false);
    
    // Reset rollout percentages
    featureFlags.setRolloutPercentage('USE_MODULAR_AUTH', 0);
    featureFlags.setRolloutPercentage('USE_UNIFIED_STATE', 0);
    featureFlags.setRolloutPercentage('USE_API_GATEWAY', 0);
    featureFlags.setRolloutPercentage('USE_EVENT_BUS', 0);
    
    // Reset boundary validator
    boundaryValidator.setPhase(BoundaryPhase.LOG_ONLY);
    
    // Clear monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Reset status
    this.status = {
      phase: 'inactive',
      rolloutPercentage: 0,
      activeFeatures: [],
      issues: [],
      metrics: {
        errorRate: 0,
        performanceScore: 100,
        userSatisfaction: 100
      }
    };
    
    // Emit rollback event
    eventBus.emit('migration.rollback', { reason: 'Manual or automatic rollback' });
    
    console.log('[IntegrationManager] Rollback complete');
  }

  /**
   * Get current migration status
   */
  getStatus(): MigrationStatus {
    return { ...this.status };
  }

  /**
   * Check gamification impact
   */
  async checkGamificationImpact(): Promise<{ safe: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check if points are still being tracked
    try {
      const testPoints = 100;
      eventBus.emit('gamification.points.add', { points: testPoints });
      
      // Check if points were recorded
      const userPoints = unifiedState.get('gamification', 'points');
      if (userPoints === undefined) {
        issues.push('Points not being tracked in new system');
      }
    } catch (error) {
      issues.push(`Gamification check failed: ${error}`);
    }
    
    return {
      safe: issues.length === 0,
      issues
    };
  }

  /**
   * Check backend compatibility
   */
  async checkBackendCompatibility(): Promise<{ compatible: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Test auth endpoints
    const endpoints = [
      '/api/auth/login',
      '/api/auth/profile',
      '/api/auth/logout'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${endpoint}`, {
          method: endpoint.includes('login') ? 'POST' : 'GET',
          credentials: 'include'
        });
        
        // We expect 401 for unauthenticated requests, but not 500
        if (response.status >= 500) {
          issues.push(`Backend endpoint ${endpoint} returning errors`);
        }
      } catch (error) {
        issues.push(`Cannot reach ${endpoint}`);
      }
    }
    
    return {
      compatible: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const integrationManager = IntegrationManager.getInstance();