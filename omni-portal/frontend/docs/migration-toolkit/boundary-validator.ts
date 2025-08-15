/**
 * Boundary Validator - Ensures architectural boundaries are respected
 */

type BoundaryLevel = 'off' | 'log' | 'warn' | 'strict';

export type BoundaryPhase = 'initialization' | 'migration' | 'validation' | 'enforcement';

interface BoundaryViolation {
  from: string;
  to: string;
  type: 'circular' | 'layer' | 'coupling';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
}

class BoundaryValidator {
  private violations: BoundaryViolation[] = [];
  private level: BoundaryLevel = 'log';

  /**
   * Set enforcement level
   */
  setLevel(level: BoundaryLevel): void {
    this.level = level;
    console.log(`[BoundaryValidator] Enforcement level set to: ${level}`);
  }

  /**
   * Validate import boundary
   */
  validateImport(from: string, to: string): boolean {
    const violation = this.checkBoundaryViolation(from, to);
    
    if (violation) {
      this.violations.push(violation);
      
      switch (this.level) {
        case 'off':
          return true;
          
        case 'log':
          console.log(`[BoundaryValidator] ${violation.message}`);
          return true;
          
        case 'warn':
          console.warn(`[BoundaryValidator] ${violation.message}`);
          return true;
          
        case 'strict':
          console.error(`[BoundaryValidator] ${violation.message}`);
          throw new Error(`Boundary violation: ${violation.message}`);
          
        default:
          return true;
      }
    }
    
    return true;
  }

  /**
   * Check for boundary violations
   */
  private checkBoundaryViolation(from: string, to: string): BoundaryViolation | null {
    // Check for circular dependencies
    if (this.isCircularDependency(from, to)) {
      return {
        from,
        to,
        type: 'circular',
        severity: 'high',
        message: `Circular dependency detected: ${from} -> ${to}`,
        timestamp: Date.now()
      };
    }

    // Check for layer violations
    if (this.isLayerViolation(from, to)) {
      return {
        from,
        to,
        type: 'layer',
        severity: 'medium',
        message: `Layer violation: ${from} should not import from ${to}`,
        timestamp: Date.now()
      };
    }

    // Check for tight coupling
    if (this.isTightCoupling(from, to)) {
      return {
        from,
        to,
        type: 'coupling',
        severity: 'low',
        message: `Tight coupling detected: ${from} -> ${to}`,
        timestamp: Date.now()
      };
    }

    return null;
  }

  private isCircularDependency(from: string, to: string): boolean {
    // Simplified circular dependency check
    return from.includes('useAuth') && to.includes('useAuth') && from !== to;
  }

  private isLayerViolation(from: string, to: string): boolean {
    // Presentation layer should not import from infrastructure directly
    if (from.includes('/presentation/') && to.includes('/infrastructure/')) {
      return true;
    }
    
    // Domain should not import from infrastructure or presentation
    if (from.includes('/domain/') && (to.includes('/infrastructure/') || to.includes('/presentation/'))) {
      return true;
    }
    
    return false;
  }

  private isTightCoupling(from: string, to: string): boolean {
    // Check for too many imports from same module
    return false; // Placeholder for more complex analysis
  }

  /**
   * Get all violations
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
   * Get violation report
   */
  getReport(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const violation of this.violations) {
      byType[violation.type] = (byType[violation.type] || 0) + 1;
      bySeverity[violation.severity] = (bySeverity[violation.severity] || 0) + 1;
    }

    return {
      total: this.violations.length,
      byType,
      bySeverity
    };
  }
}

export const boundaryValidator = new BoundaryValidator();