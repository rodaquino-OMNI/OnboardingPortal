/**
 * useAuthWithMigration - Temporary hook for parallel auth implementation
 * Runs both old and new implementations based on feature flags
 */

'use client';

import { useAuth as useLegacyAuth } from './useAuth';
import { useModularAuth } from '@/modules/auth/presentation/useModularAuth';
import { featureFlags } from '@/lib/feature-flags';
// import { parallelExecutor } from '@/docs/migration-toolkit/parallel-executor';
import { useEffect } from 'react';

export function useAuthWithMigration() {
  const shouldUseModular = featureFlags.get('USE_MODULAR_AUTH');
  const shouldRunParallel = featureFlags.get('PARALLEL_EXECUTION');

  // Get both implementations
  const legacyAuth = useLegacyAuth();
  const modularAuth = shouldUseModular || shouldRunParallel ? useModularAuth() : null;

  // Run parallel comparison in development
  useEffect(() => {
    if (shouldRunParallel && modularAuth && process.env.NODE_ENV === 'development') {
      // Compare auth states
      const comparison = {
        user: {
          legacy: legacyAuth.user,
          modular: modularAuth.user,
          match: JSON.stringify(legacyAuth.user) === JSON.stringify(modularAuth.user)
        },
        isAuthenticated: {
          legacy: legacyAuth.isAuthenticated,
          modular: modularAuth.isAuthenticated,
          match: legacyAuth.isAuthenticated === modularAuth.isAuthenticated
        },
        isLoading: {
          legacy: legacyAuth.isLoading,
          modular: modularAuth.isLoading,
          match: legacyAuth.isLoading === modularAuth.isLoading
        }
      };

      // Log discrepancies
      if (!comparison.user.match || !comparison.isAuthenticated.match) {
        console.warn('[AuthMigration] State mismatch detected:', comparison);
      }
    }
  }, [
    shouldRunParallel,
    legacyAuth.user,
    legacyAuth.isAuthenticated,
    modularAuth?.user,
    modularAuth?.isAuthenticated
  ]);

  // Return the appropriate implementation
  if (shouldUseModular && modularAuth) {
    console.log('[AuthMigration] Using MODULAR auth implementation');
    return modularAuth;
  }

  console.log('[AuthMigration] Using LEGACY auth implementation');
  return legacyAuth;
}

// Export as default useAuth for easy migration
export const useAuth = useAuthWithMigration;