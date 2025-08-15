/**
 * Authentication Integration Layer
 * Bridges legacy store with new modular architecture
 * NO CIRCULAR DEPENDENCIES - imports directly from store
 */

'use client';

import { useAuthStore } from './stores/useAuthStore';
import { useModularAuth } from '@/modules/auth/presentation/useModularAuth';
import { featureFlags } from '@/lib/feature-flags';
// import { parallelExecutor } from '@/docs/migration-toolkit/parallel-executor';
import { performanceBudgetGuard } from '@/docs/migration-toolkit/performance-budget-guard';
import { useEffect, useCallback, useRef } from 'react';
import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { usageMonitor } from '@/lib/usage-monitor';

// Monitor implementation differences
const monitorImplementations = (legacy: any, modular: any, operation: string) => {
  const differences = [];
  
  // Check for state differences
  if (legacy.isAuthenticated !== modular.isAuthenticated) {
    differences.push({
      field: 'isAuthenticated',
      legacy: legacy.isAuthenticated,
      modular: modular.isAuthenticated
    });
  }
  
  if (legacy.user?.id !== modular.user?.id) {
    differences.push({
      field: 'user.id',
      legacy: legacy.user?.id,
      modular: modular.user?.id
    });
  }
  
  if (differences.length > 0) {
    console.warn(`[AuthIntegration] Implementation mismatch in ${operation}:`, differences);
    // Could send to monitoring service
  }
};

/**
 * Integrated authentication hook
 * Provides parallel execution and gradual migration
 */
export function useAuthIntegration() {
  const legacyAuth = useAuthStore(); // Direct import - no circular dependency
  const shouldUseModular = featureFlags.get('USE_MODULAR_AUTH');
  const shouldRunParallel = featureFlags.get('PARALLEL_EXECUTION');
  
  // Track which version is being used
  useEffect(() => {
    usageMonitor.track('auth.integration', shouldUseModular ? 'modular' : 'legacy', {
      shouldUseModular,
      shouldRunParallel,
      timestamp: Date.now()
    });
  }, [shouldUseModular, shouldRunParallel]);
  
  // Only initialize modular if needed
  const modularAuth = (shouldUseModular || shouldRunParallel) ? useModularAuth() : null;
  
  // Monitor performance
  const performanceRef = useRef<{ start: number; operation: string } | null>(null);
  
  const startOperation = (operation: string) => {
    performanceRef.current = { start: performance.now(), operation };
  };
  
  const endOperation = () => {
    if (performanceRef.current) {
      const duration = performance.now() - performanceRef.current.start;
      performanceBudgetGuard.check('auth', performanceRef.current.operation, duration);
      
      if (duration > 200) {
        console.warn(`[AuthIntegration] ${performanceRef.current.operation} took ${duration}ms`);
      }
    }
  };
  
  // Wrapped login function
  const login = useCallback(async (data: any) => {
    startOperation('login');
    
    // Parallel execution temporarily disabled
    // if (shouldRunParallel && modularAuth) {
    //   // Run both implementations in parallel
    //   const results = await parallelExecutor.execute(
    //     'auth.login',
    //     () => legacyAuth.login(data),
    //     () => modularAuth.login(data)
    //   );
    //   
    //   monitorImplementations(legacyAuth, modularAuth, 'login');
    //   
    //   // Use modular result if enabled, otherwise legacy
    //   if (shouldUseModular) {
    //     endOperation();
    //     return results.newResult;
    //   }
    //   
    //   endOperation();
    //   return results.oldResult;
    // }
    
    // Use single implementation
    const impl = shouldUseModular && modularAuth ? modularAuth : legacyAuth;
    const result = await impl.login(data);
    
    // Emit event for other systems
    eventBus.emit(EventTypes.AUTH_STATE_CHANGED, {
      isAuthenticated: true,
      user: impl.user
    });
    
    endOperation();
    return result;
  }, [legacyAuth, modularAuth, shouldUseModular, shouldRunParallel]);
  
  // Wrapped logout function
  const logout = useCallback(async () => {
    startOperation('logout');
    
    if (shouldRunParallel && modularAuth) {
      await Promise.all([
        legacyAuth.logout(),
        modularAuth.logout()
      ]);
    } else {
      const impl = shouldUseModular && modularAuth ? modularAuth : legacyAuth;
      await impl.logout();
    }
    
    eventBus.emit(EventTypes.AUTH_STATE_CHANGED, {
      isAuthenticated: false,
      user: null
    });
    
    endOperation();
  }, [legacyAuth, modularAuth, shouldUseModular, shouldRunParallel]);
  
  // Return integrated auth interface
  const selectedImpl = shouldUseModular && modularAuth ? modularAuth : legacyAuth;
  
  return {
    ...selectedImpl,
    login,
    logout,
    // Add metadata for debugging
    _implementation: shouldUseModular ? 'modular' : 'legacy',
    _parallel: shouldRunParallel
  };
}

// Export metrics for monitoring
export function useAuthMetrics() {
  return {
    implementation: featureFlags.get('USE_MODULAR_AUTH') ? 'modular' : 'legacy',
    parallel: featureFlags.get('PARALLEL_EXECUTION'),
    performanceBudget: 200, // ms
    monitoring: true
  };
}

// Export for testing
export function useAuthImplementation() {
  const shouldUseModular = featureFlags.get('USE_MODULAR_AUTH');
  return shouldUseModular ? 'modular' : 'legacy';
}