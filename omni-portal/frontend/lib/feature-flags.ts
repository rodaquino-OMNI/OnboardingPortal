/**
 * Feature Flags System
 * Controls gradual rollout of new features
 */

interface FeatureFlags {
  USE_MODULAR_AUTH: boolean;
  USE_UNIFIED_STATE: boolean;
  USE_API_GATEWAY: boolean;
  USE_EVENT_BUS: boolean;
  ENFORCE_BOUNDARIES: 'off' | 'log' | 'warn' | 'strict';
  PARALLEL_EXECUTION: boolean;
}

class FeatureFlagManager {
  private flags: FeatureFlags = {
    USE_MODULAR_AUTH: true,         // ACTIVATED at 1% for validation
    USE_UNIFIED_STATE: true,        // ACTIVATED at 1% for validation
    USE_API_GATEWAY: true,          // ACTIVATED at 1% for validation
    USE_EVENT_BUS: true,            // ACTIVATED at 1% for validation
    ENFORCE_BOUNDARIES: 'log',      // LOG ONLY to start monitoring
    PARALLEL_EXECUTION: true        // ACTIVATED for comparison
  };

  private rolloutPercentages: Record<keyof FeatureFlags, number> = {
    USE_MODULAR_AUTH: 10,           // 10% rollout - SAFE GRADUAL ACTIVATION 
    USE_UNIFIED_STATE: 10,          // 10% rollout - SAFE GRADUAL ACTIVATION
    USE_API_GATEWAY: 10,            // 10% rollout - SAFE GRADUAL ACTIVATION
    USE_EVENT_BUS: 100,             // 100% - Events are safe and needed for integration
    ENFORCE_BOUNDARIES: 100,        // 100% - Logging only, safe for all users
    PARALLEL_EXECUTION: 5           // 5% get parallel validation for monitoring
  };

  /**
   * Get feature flag value
   */
  get<K extends keyof FeatureFlags>(flag: K): FeatureFlags[K] {
    // ALWAYS enable for developers
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[FeatureFlags] ${flag} ENABLED (dev mode)`);
      return this.flags[flag];
    }
    
    // Check if user is in rollout percentage
    if (this.isUserInRollout(flag)) {
      return this.flags[flag];
    }

    // Return default (disabled) value
    if (flag === 'ENFORCE_BOUNDARIES') {
      return 'off' as FeatureFlags[K];
    }
    return false as FeatureFlags[K];
  }

  /**
   * Set feature flag value (for testing/override)
   */
  set<K extends keyof FeatureFlags>(flag: K, value: FeatureFlags[K]): void {
    this.flags[flag] = value;
    console.log(`[FeatureFlags] ${flag} set to:`, value);
  }

  /**
   * Set rollout percentage for gradual release
   */
  setRolloutPercentage(flag: keyof FeatureFlags, percentage: number): void {
    this.rolloutPercentages[flag] = Math.min(100, Math.max(0, percentage));
    console.log(`[FeatureFlags] ${flag} rollout set to ${percentage}%`);
  }

  /**
   * Check if current user is in rollout
   */
  private isUserInRollout(flag: keyof FeatureFlags): boolean {
    const percentage = this.rolloutPercentages[flag];
    
    // If 0% or 100%, return accordingly
    if (percentage === 0) return false;
    if (percentage >= 100) return true;

    // Use consistent user hash for stable rollout
    const userId = this.getUserId();
    const hash = this.hashCode(userId + flag);
    const bucket = Math.abs(hash) % 100;
    
    return bucket < percentage;
  }

  /**
   * Get or generate user ID for consistent rollout
   */
  private getUserId(): string {
    if (typeof window === 'undefined') return 'server';

    let userId = localStorage.getItem('feature_flag_user_id');
    if (!userId) {
      userId = Math.random().toString(36).substring(7);
      localStorage.setItem('feature_flag_user_id', userId);
    }
    return userId;
  }

  /**
   * Simple hash function for consistent bucketing
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Get all flags and their current values
   */
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Get rollout status
   */
  getRolloutStatus(): Record<keyof FeatureFlags, { enabled: boolean; percentage: number }> {
    const status: any = {};
    
    for (const flag of Object.keys(this.flags) as Array<keyof FeatureFlags>) {
      status[flag] = {
        enabled: this.get(flag),
        percentage: this.rolloutPercentages[flag]
      };
    }
    
    return status;
  }

  /**
   * Enable parallel execution for migration safety
   */
  enableParallelExecution(): void {
    this.set('PARALLEL_EXECUTION', true);
    console.log('[FeatureFlags] Parallel execution enabled for migration safety');
  }

  /**
   * Migration rollout plan
   */
  applyMigrationPhase(phase: 'testing' | 'canary' | 'partial' | 'full' | 'rollback'): void {
    switch (phase) {
      case 'testing':
        // Internal testing only
        this.setRolloutPercentage('USE_MODULAR_AUTH', 0);
        this.set('PARALLEL_EXECUTION', true);
        this.set('ENFORCE_BOUNDARIES', 'log');
        break;

      case 'canary':
        // 1% of users
        this.setRolloutPercentage('USE_MODULAR_AUTH', 1);
        this.set('PARALLEL_EXECUTION', true);
        this.set('ENFORCE_BOUNDARIES', 'log');
        break;

      case 'partial':
        // 50% of users
        this.setRolloutPercentage('USE_MODULAR_AUTH', 50);
        this.set('PARALLEL_EXECUTION', true);
        this.set('ENFORCE_BOUNDARIES', 'warn');
        break;

      case 'full':
        // 100% of users
        this.setRolloutPercentage('USE_MODULAR_AUTH', 100);
        this.set('PARALLEL_EXECUTION', false);
        this.set('ENFORCE_BOUNDARIES', 'strict');
        break;

      case 'rollback':
        // Emergency rollback
        this.setRolloutPercentage('USE_MODULAR_AUTH', 0);
        this.set('PARALLEL_EXECUTION', false);
        this.set('ENFORCE_BOUNDARIES', 'off');
        console.error('[FeatureFlags] EMERGENCY ROLLBACK INITIATED');
        break;
    }

    console.log(`[FeatureFlags] Migration phase '${phase}' applied`);
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagManager();

// Export type for use in components
export type { FeatureFlags };