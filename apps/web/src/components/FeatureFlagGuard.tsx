/**
 * Feature Flag Guard - Protects routes based on feature flags
 *
 * Redirects to home if feature is disabled
 * Provides fallback UI while checking
 */

'use client';

import { useFeatureFlags } from '@/providers/FeatureFlagProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface FeatureFlagGuardProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureFlagGuard({ flag, children, fallback }: FeatureFlagGuardProps) {
  const { flags, isLoading } = useFeatureFlags();
  const router = useRouter();
  const isEnabled = flags[flag];

  useEffect(() => {
    // Only redirect after loading is complete
    if (!isLoading && !isEnabled) {
      router.push('/');
    }
  }, [isEnabled, isLoading, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show fallback or default message if disabled
  if (!isEnabled) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Feature Not Available</h1>
          <p className="mt-2 text-gray-600">This feature is currently disabled.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
