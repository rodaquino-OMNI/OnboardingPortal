/**
 * DEPRECATED: useAuthWithMigration
 * This file is being replaced by unified authentication
 * Use useUnifiedAuth instead
 */

'use client';

import { useUnifiedAuth } from './useUnifiedAuth';
import { logger } from '@/lib/logger';

/**
 * @deprecated Use useUnifiedAuth instead
 */
export function useAuthWithMigration() {
  logger.warn('useAuthWithMigration is deprecated, use useUnifiedAuth instead', null, 'DeprecationWarning');
  return useUnifiedAuth();
}

/**
 * @deprecated Use useUnifiedAuth instead
 */
export const useAuth = useAuthWithMigration;