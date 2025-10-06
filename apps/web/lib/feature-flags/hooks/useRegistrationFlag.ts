/**
 * Sprint 2C - Registration Flag Hook
 *
 * ADR-002 Compliant: No browser storage
 * ADR-003 Compliant: Orchestration layer only (not in packages/ui)
 */

'use client';

import { useEffect, useState } from 'react';
import { getRegistrationFlags, trackFlagExposure, type FeatureFlag } from '../registration-flags';

export interface UseRegistrationFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
  error: Error | null;
  variant?: 'control' | 'treatment';
  metadata?: Record<string, unknown>;
}

/**
 * Hook to check registration feature flag
 * Server-side evaluation, client-side rendering
 */
export function useRegistrationFlag(userId?: string): UseRegistrationFlagResult {
  const [flag, setFlag] = useState<FeatureFlag | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      // Get flag configuration (server-side evaluation)
      const flags = getRegistrationFlags();
      const registrationFlag = flags.sliceA_registration;

      setFlag(registrationFlag);

      // Track exposure event
      trackFlagExposure(registrationFlag, userId);

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load feature flag'));
      setIsLoading(false);
    }
  }, [userId]);

  if (error) {
    return {
      isEnabled: false,
      isLoading: false,
      error,
    };
  }

  if (isLoading || !flag) {
    return {
      isEnabled: false,
      isLoading: true,
      error: null,
    };
  }

  return {
    isEnabled: flag.enabled,
    isLoading: false,
    error: null,
    variant: flag.variant,
    metadata: flag.metadata,
  };
}

/**
 * Server component utility to check flag
 */
export function checkRegistrationFlag(): boolean {
  const flags = getRegistrationFlags();
  return flags.sliceA_registration.enabled;
}
