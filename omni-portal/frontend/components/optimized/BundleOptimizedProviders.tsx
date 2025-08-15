/**
 * Bundle Optimized Providers
 * Provides lazy-loaded React Query and optimized bundle loading
 */

'use client';

import React, { ReactNode, useState, useEffect, Suspense } from 'react';
import { Toaster } from 'sonner';
import { setupIntelligentPreloading, analyzeBundleSize } from '@/lib/bundle-optimization';

interface BundleOptimizedProvidersProps {
  children: ReactNode;
}

export function BundleOptimizedProviders({ children }: BundleOptimizedProvidersProps) {
  const [queryClient, setQueryClient] = useState<any>(null);
  const [QueryClientProvider, setQueryClientProvider] = useState<any>(null);

  useEffect(() => {
    // Set up bundle optimization immediately
    setupIntelligentPreloading();
    analyzeBundleSize();

    // Lazy load React Query components
    const loadReactQuery = async () => {
      try {
        const { QueryClient, QueryClientProvider: QCP } = await import('@tanstack/react-query');
        
        const client = new QueryClient({
          defaultOptions: {
            queries: {
              staleTime: 5 * 60 * 1000, // 5 minutes
              retry: 1,
              refetchOnWindowFocus: false,
            },
            mutations: {
              retry: 1,
            },
          },
        });

        setQueryClient(client);
        setQueryClientProvider(() => QCP);
      } catch (error) {
        console.warn('Failed to load React Query, continuing without it:', error);
      }
    };

    // Load React Query after initial render to avoid blocking
    setTimeout(loadReactQuery, 100);
  }, []);

  // Render without React Query initially for faster load
  if (!queryClient || !QueryClientProvider) {
    return (
      <>
        {children}
        <Toaster
          position="top-right"
          closeButton
          richColors
          duration={4000}
        />
      </>
    );
  }

  // Render with React Query once loaded
  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="top-right"
            closeButton
            richColors
            duration={4000}
          />
        </QueryClientProvider>
      </Suspense>
    </>
  );
}

// Optimized loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Alternative lightweight providers for critical paths
export function LightweightProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    setupIntelligentPreloading();
  }, []);

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        closeButton
        richColors
        duration={4000}
      />
    </>
  );
}