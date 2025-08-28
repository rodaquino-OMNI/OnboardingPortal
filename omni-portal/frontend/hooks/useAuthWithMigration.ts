/**
 * DEPRECATED: useAuthWithMigration
 * This file has been replaced by consolidated authentication
 * Use useAuth from hooks/auth/useAuth instead
 */

'use client';

import { useAuth } from './auth/useAuth';
import { logger } from '@/lib/logger';

/**
 * @deprecated Use useAuth from hooks/auth/useAuth instead
 */
export function useAuthWithMigration() {
  logger.warn('useAuthWithMigration is deprecated, use useAuth from hooks/auth/useAuth instead', null, 'DeprecationWarning');
  return useAuth();
}

/**
 * @deprecated Use useAuth from hooks/auth/useAuth instead
 */
export const useAuthMigration = useAuthWithMigration;