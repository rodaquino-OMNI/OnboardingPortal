'use client';

/**
 * DEPRECATED: This store has been consolidated into the main useAuth hook
 * Use useAuth from hooks/auth/useAuth instead
 */

import { useAuth } from '../auth/useAuth';
import { logger } from '@/lib/logger';

/**
 * @deprecated Use useAuth from hooks/auth/useAuth instead
 */
export function useAuthStore() {
  logger.warn('useAuthStore is deprecated, use useAuth from hooks/auth/useAuth instead', null, 'DeprecationWarning');
  return useAuth();
}

/**
 * Default export for backward compatibility
 * @deprecated Use useAuth from hooks/auth/useAuth instead
 */
export default useAuthStore;