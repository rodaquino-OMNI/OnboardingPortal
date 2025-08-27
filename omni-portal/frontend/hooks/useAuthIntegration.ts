/**
 * DEPRECATED: Authentication Integration Layer
 * This file is being replaced by unified authentication
 * Use useUnifiedAuth instead
 */

'use client';

import { useUnifiedAuth } from './useUnifiedAuth';
import { logger } from '@/lib/logger';

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
 * @deprecated Use useUnifiedAuth instead
 */
export function useAuthIntegration() {
  logger.warn('useAuthIntegration is deprecated, use useUnifiedAuth instead', null, 'DeprecationWarning');
  return useUnifiedAuth();
}

/**
 * @deprecated Use useUnifiedAuth instead
 */
export function useAuthMetrics() {
  logger.warn('useAuthMetrics is deprecated', null, 'DeprecationWarning');
  return {
    implementation: 'unified',
    performanceBudget: 200,
    monitoring: true
  };
}

/**
 * @deprecated Use useUnifiedAuth instead
 */
export function useAuthImplementation() {
  logger.warn('useAuthImplementation is deprecated', null, 'DeprecationWarning');
  return 'unified';
}