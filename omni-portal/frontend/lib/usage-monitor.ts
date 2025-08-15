/**
 * Usage Monitor - Tracks which code paths are actually being executed
 * This ensures we know if new architecture is being used
 */

class UsageMonitor {
  private executionCounts: Map<string, number> = new Map();
  private lastReport: number = Date.now();
  private reportInterval = 10000; // Report every 10 seconds
  
  track(component: string, action: string, metadata?: any): void {
    const key = `${component}.${action}`;
    const count = this.executionCounts.get(key) || 0;
    this.executionCounts.set(key, count + 1);
    
    // Log immediately in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[USAGE] ${key} executed (count: ${count + 1})`, metadata);
    }
    
    // Send event for analytics
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('usage.tracked', {
        detail: {
          component,
          action,
          count: count + 1,
          metadata,
          timestamp: Date.now()
        }
      }));
    }
    
    // Auto-report periodically
    if (Date.now() - this.lastReport > this.reportInterval) {
      this.report();
    }
  }
  
  report(): void {
    if (this.executionCounts.size === 0) return;
    
    console.group('[USAGE REPORT]');
    console.log('Code paths executed:');
    
    const sorted = Array.from(this.executionCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    for (const [path, count] of sorted) {
      const [component, action] = path.split('.');
      const isNew = component.includes('modular') || component.includes('unified');
      const icon = isNew ? '🆕' : '🔄';
      console.log(`  ${icon} ${path}: ${count} executions`);
    }
    
    // Check if new architecture is being used
    const newArchPaths = sorted.filter(([path]) => 
      path.includes('modular') || 
      path.includes('unified') || 
      path.includes('integration')
    );
    
    if (newArchPaths.length === 0) {
      console.warn('⚠️  NEW ARCHITECTURE NOT BEING EXECUTED!');
    } else {
      console.log(`✅ New architecture active: ${newArchPaths.length} code paths`);
    }
    
    console.groupEnd();
    
    this.lastReport = Date.now();
  }
  
  getStats(): { total: number; newArch: number; legacy: number } {
    let total = 0;
    let newArch = 0;
    let legacy = 0;
    
    for (const [path, count] of this.executionCounts) {
      total += count;
      if (path.includes('modular') || path.includes('unified') || path.includes('integration')) {
        newArch += count;
      } else {
        legacy += count;
      }
    }
    
    return { total, newArch, legacy };
  }
  
  reset(): void {
    this.executionCounts.clear();
    this.lastReport = Date.now();
  }
}

// Singleton instance
export const usageMonitor = new UsageMonitor();

// Auto-report on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    usageMonitor.report();
  });
  
  // Report periodically
  setInterval(() => {
    usageMonitor.report();
  }, 30000); // Every 30 seconds
}

// Export for testing
export default usageMonitor;