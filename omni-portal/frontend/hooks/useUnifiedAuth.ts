'use client';

/**
 * DEPRECATED: This hook has been consolidated into the main useAuth hook
 * Import from useAuth instead for the unified implementation
 */

import { useAuth } from './auth/useAuth';
import { logger } from '@/lib/logger';


/**
 * @deprecated Use the consolidated useAuth hook instead
 */
export function useUnifiedAuth() {
  logger.warn('useUnifiedAuth is deprecated, use useAuth from hooks/auth/useAuth instead', null, 'DeprecationWarning');
  return useAuth();
}

/**
 * @deprecated Use the consolidated useAuth hook instead
 */
export const useUnifiedAuthStore = () => {
  logger.warn('useUnifiedAuthStore is deprecated, use the consolidated useAuth hook instead');
  return useAuth();

};


/**
 * Legacy compatibility exports - will be removed after migration
 * @deprecated Use useAuth() from hooks/auth/useAuth instead
 */
export const useAuthLegacy = useUnifiedAuth;
export const useAuthStore = useUnifiedAuthStore;