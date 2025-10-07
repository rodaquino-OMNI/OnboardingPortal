/**
 * Feature Flag Provider - Context provider for feature flags
 *
 * Provides feature flag state to the entire application
 * Fetches flags from backend on mount and caches them
 */

'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';

interface FeatureFlags {
  sliceB_documents: boolean;
  sliceC_health: boolean;
  [key: string]: boolean;
}

interface FeatureFlagContextValue {
  flags: FeatureFlags;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: { sliceB_documents: false, sliceC_health: false },
  isLoading: true,
  error: null,
  refetch: async () => {},
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>({
    sliceB_documents: false,
    sliceC_health: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadFlags = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<FeatureFlags>('/api/feature-flags');
      setFlags(response.data);
    } catch (err) {
      console.error('Failed to load feature flags:', err);
      setError(err instanceof Error ? err : new Error('Failed to load feature flags'));
      // Set default flags on error
      setFlags({ sliceB_documents: false, sliceC_health: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading, error, refetch: loadFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}

export function useFeatureFlag(key: keyof FeatureFlags): boolean {
  const { flags, isLoading } = useFeatureFlags();
  return !isLoading && (flags[key] ?? false);
}
