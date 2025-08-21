'use client';

import { ReactNode } from 'react';
import { useClientOnly } from '@/hooks/useClientOnly';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
  suppressHydrationWarning?: boolean;
}

/**
 * Wrapper component that only renders children on client-side
 * to prevent hydration mismatches from client-only APIs
 * 
 * @param children - Content to render client-side only
 * @param fallback - Optional fallback content for server-side rendering
 * @param suppressHydrationWarning - Whether to suppress hydration warnings
 */
export function ClientOnly({ 
  children, 
  fallback = null,
  suppressHydrationWarning = true
}: ClientOnlyProps) {
  const isClient = useClientOnly();

  if (!isClient) {
    return <>{fallback}</>;
  }

  return suppressHydrationWarning ? (
    <div suppressHydrationWarning>
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}

/**
 * Higher-order component that wraps components requiring client-side rendering
 */
export function withClientOnly<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  fallback?: ReactNode
) {
  return function ClientOnlyWrapper(props: T) {
    return (
      <ClientOnly fallback={fallback}>
        <Component {...props} />
      </ClientOnly>
    );
  };
}