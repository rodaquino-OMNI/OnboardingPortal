/**
 * Boundary Validator - Soft enforcement with gradual migration
 * Phase 1: Log only (weeks 1-2)
 * Phase 2: Warn in dev (weeks 3-4)  
 * Phase 3: Strict enforcement (weeks 5-6)
 */

export enum BoundaryPhase {
  LOG_ONLY = 'log_only',
  WARN_IN_DEV = 'warn_in_dev',
  STRICT = 'strict'
}

export interface BoundaryViolation {
  type: 'layer_violation' | 'circular_dependency' | 'direct_access' | 'state_conflict';
  source: string;
  target: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stackTrace?: string;
}

export class BoundaryValidator {
  private phase: BoundaryPhase = BoundaryPhase.LOG_ONLY;
  private violations: BoundaryViolation[] = [];
  private metricsEndpoint = '/api/metrics/boundary-violations';

  constructor(phase: BoundaryPhase = BoundaryPhase.LOG_ONLY) {
    this.phase = phase;
  }

  /**
   * Validate layer boundaries
   */
  validateLayerBoundary(
    sourceLayer: 'presentation' | 'application' | 'domain' | 'infrastructure',
    targetLayer: 'presentation' | 'application' | 'domain' | 'infrastructure',
    context: string
  ): boolean {
    const allowedFlows: Record<string, string[]> = {
      presentation: ['application'],
      application: ['domain'],
      domain: [], // Domain should not depend on anything
      infrastructure: [] // Infrastructure is used by others
    };

    const isValid = allowedFlows[sourceLayer]?.includes(targetLayer) || 
                    targetLayer === 'infrastructure';

    if (!isValid) {
      this.recordViolation({
        type: 'layer_violation',
        source: sourceLayer,
        target: targetLayer,
        severity: 'high',
        message: `Layer violation: ${sourceLayer} -> ${targetLayer} in ${context}`,
        stackTrace: new Error().stack
      });
    }

    return this.handleViolation(isValid);
  }

  /**
   * Validate state access patterns
   */
  validateStateAccess(
    component: string,
    stateSystem: string,
    operation: 'read' | 'write'
  ): boolean {
    // Check if component is allowed to access this state system
    const allowedStateSystems = this.getAllowedStateSystems(component);
    const isValid = allowedStateSystems.includes(stateSystem);

    if (!isValid) {
      this.recordViolation({
        type: 'state_conflict',
        source: component,
        target: stateSystem,
        severity: 'medium',
        message: `Unauthorized state access: ${component} -> ${stateSystem} (${operation})`
      });
    }

    return this.handleViolation(isValid);
  }

  /**
   * Validate API call patterns
   */
  validateApiCall(
    source: string,
    apiPattern: 'gateway' | 'direct' | 'legacy'
  ): boolean {
    // Only gateway pattern should be allowed in strict mode
    const isValid = this.phase === BoundaryPhase.LOG_ONLY || 
                   apiPattern === 'gateway';

    if (!isValid) {
      this.recordViolation({
        type: 'direct_access',
        source: source,
        target: `API (${apiPattern})`,
        severity: 'medium',
        message: `Non-gateway API access: ${source} using ${apiPattern} pattern`
      });
    }

    return this.handleViolation(isValid);
  }

  /**
   * Check for circular dependencies
   */
  validateDependency(
    source: string,
    target: string,
    dependencyGraph: Map<string, Set<string>>
  ): boolean {
    // Check if adding this dependency creates a cycle
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const dependencies = dependencyGraph.get(node) || new Set();
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Temporarily add the new dependency
    if (!dependencyGraph.has(source)) {
      dependencyGraph.set(source, new Set());
    }
    dependencyGraph.get(source)!.add(target);

    const hasCircular = hasCycle(source);

    if (hasCircular) {
      this.recordViolation({
        type: 'circular_dependency',
        source: source,
        target: target,
        severity: 'critical',
        message: `Circular dependency detected: ${source} <-> ${target}`
      });
      
      // Remove the dependency if it creates a cycle
      dependencyGraph.get(source)!.delete(target);
    }

    return this.handleViolation(!hasCircular);
  }

  /**
   * Handle violations based on current phase
   */
  private handleViolation(isValid: boolean): boolean {
    if (isValid) return true;

    switch (this.phase) {
      case BoundaryPhase.LOG_ONLY:
        // Just log, don't fail
        this.logViolations();
        return true;

      case BoundaryPhase.WARN_IN_DEV:
        // Fail in dev, log in prod
        if (process.env.NODE_ENV === 'development') {
          this.logViolations();
          throw new BoundaryViolationError(this.violations);
        }
        this.logViolations();
        return true;

      case BoundaryPhase.STRICT:
        // Always fail
        this.logViolations();
        throw new BoundaryViolationError(this.violations);

      default:
        return true;
    }
  }

  /**
   * Record violation for monitoring
   */
  private recordViolation(violation: BoundaryViolation): void {
    this.violations.push(violation);
    
    // Send to metrics endpoint for monitoring
    if (typeof window !== 'undefined') {
      fetch(this.metricsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(violation)
      }).catch(console.error);
    }
  }

  /**
   * Log violations with appropriate severity
   */
  private logViolations(): void {
    const grouped = this.groupViolationsBySeverity();
    
    if (grouped.critical.length > 0) {
      console.error('🚨 CRITICAL Boundary Violations:', grouped.critical);
    }
    if (grouped.high.length > 0) {
      console.error('❌ HIGH Boundary Violations:', grouped.high);
    }
    if (grouped.medium.length > 0) {
      console.warn('⚠️ MEDIUM Boundary Violations:', grouped.medium);
    }
    if (grouped.low.length > 0) {
      console.log('ℹ️ LOW Boundary Violations:', grouped.low);
    }
  }

  /**
   * Group violations by severity
   */
  private groupViolationsBySeverity() {
    return this.violations.reduce((acc, violation) => {
      acc[violation.severity].push(violation);
      return acc;
    }, {
      low: [] as BoundaryViolation[],
      medium: [] as BoundaryViolation[],
      high: [] as BoundaryViolation[],
      critical: [] as BoundaryViolation[]
    });
  }

  /**
   * Get allowed state systems for a component
   */
  private getAllowedStateSystems(component: string): string[] {
    // Define which components can access which state systems
    const stateAccessMatrix: Record<string, string[]> = {
      'auth/*': ['zustand:auth', 'cookies:auth'],
      'profile/*': ['zustand:user', 'context:user'],
      'health/*': ['zustand:health', 'localStorage:health'],
      'admin/*': ['zustand:admin', 'context:admin']
    };

    // Find matching pattern
    for (const [pattern, allowed] of Object.entries(stateAccessMatrix)) {
      if (component.match(pattern.replace('*', '.*'))) {
        return allowed;
      }
    }

    return [];
  }

  /**
   * Get current violations
   */
  getViolations(): BoundaryViolation[] {
    return [...this.violations];
  }

  /**
   * Clear violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Set enforcement phase
   */
  setPhase(phase: BoundaryPhase): void {
    this.phase = phase;
    console.log(`Boundary validation phase set to: ${phase}`);
  }
}

/**
 * Custom error for boundary violations
 */
export class BoundaryViolationError extends Error {
  constructor(public violations: BoundaryViolation[]) {
    super(`Boundary violations detected: ${violations.length} issues found`);
    this.name = 'BoundaryViolationError';
  }
}

// Export singleton instance
export const boundaryValidator = new BoundaryValidator();