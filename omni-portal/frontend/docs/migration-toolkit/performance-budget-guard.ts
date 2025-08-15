/**
 * Performance Budget Guard - Ensures migrations don't degrade performance
 */

interface PerformanceBudget {
  [operation: string]: number; // milliseconds
}

class PerformanceBudgetGuard {
  private budgets: PerformanceBudget = {
    'auth.login': 1000,
    'auth.logout': 500,
    'auth.checkAuth': 800,
    'api.request': 2000,
    'ui.render': 100,
    'data.load': 1500
  };

  private violations: Array<{
    operation: string;
    actual: number;
    budget: number;
    timestamp: number;
  }> = [];

  /**
   * Check if operation is within budget
   */
  check(category: string, operation: string, duration: number): boolean {
    const key = `${category}.${operation}`;
    const budget = this.budgets[key] || this.budgets[category] || 1000;
    
    const withinBudget = duration <= budget;
    
    if (!withinBudget) {
      this.violations.push({
        operation: key,
        actual: duration,
        budget,
        timestamp: Date.now()
      });
      
      console.warn(`[Performance Budget] VIOLATION: ${key} took ${duration}ms (budget: ${budget}ms)`);
    }
    
    return withinBudget;
  }

  /**
   * Set budget for operation
   */
  setBudget(operation: string, milliseconds: number): void {
    this.budgets[operation] = milliseconds;
  }

  /**
   * Get current violations
   */
  getViolations(): typeof this.violations {
    return [...this.violations];
  }

  /**
   * Clear violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Get budget report
   */
  getReport(): {
    totalViolations: number;
    categories: Record<string, { violations: number; avgOverage: number }>;
  } {
    const categories: Record<string, { violations: number; avgOverage: number }> = {};
    
    for (const violation of this.violations) {
      const category = violation.operation.split('.')[0];
      if (!category) continue; // Skip if no category found
      if (!categories[category]) {
        categories[category] = { violations: 0, avgOverage: 0 };
      }
      
      // Store reference to avoid TypeScript undefined concerns
      const categoryData = categories[category]!;
      categoryData.violations++;
      const overage = violation.actual - violation.budget;
      categoryData.avgOverage = 
        (categoryData.avgOverage + overage) / categoryData.violations;
    }
    
    return {
      totalViolations: this.violations.length,
      categories
    };
  }
}

export const performanceBudgetGuard = new PerformanceBudgetGuard();