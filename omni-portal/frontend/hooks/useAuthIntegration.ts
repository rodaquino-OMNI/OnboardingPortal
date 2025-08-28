/**
 * DEPRECATED: Authentication Integration Layer
 * This file has been replaced by the consolidated authentication
 * Use useAuth from hooks/auth/useAuth instead
 */

'use client';

import { useAuth } from './auth/useAuth';
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
 * @deprecated Use useAuth from hooks/auth/useAuth instead
 */
export function useAuthIntegration() {
  logger.warn('useAuthIntegration is deprecated, use useAuth from hooks/auth/useAuth instead', null, 'DeprecationWarning');
  return useAuth();
}

/**
 * @deprecated Use useAuth from hooks/auth/useAuth instead
 */
export function useAuthMetrics() {
  logger.warn('useAuthMetrics is deprecated', null, 'DeprecationWarning');
  return {
    implementation: 'consolidated-v1',
    performanceBudget: 200,
    monitoring: true
  };
}

/**
 * @deprecated Use useAuth from hooks/auth/useAuth instead
 */
export function useAuthImplementation() {
  logger.warn('useAuthImplementation is deprecated', null, 'DeprecationWarning');
  return 'consolidated-v1';
}