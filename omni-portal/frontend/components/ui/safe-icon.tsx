'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SafeIconProps {
  icon: LucideIcon;
  className?: string;
  fallbackClassName?: string;
}

/**
 * SafeIcon - Prevents hydration mismatches with SVG icons
 * Renders a placeholder during SSR and the actual icon after hydration
 */
export function SafeIcon({ icon: Icon, className = '', fallbackClassName = '' }: SafeIconProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or before mount, show a placeholder
  if (!mounted) {
    return (
      <div 
        className={fallbackClassName || `${className} bg-gray-200 rounded animate-pulse`}
        aria-hidden="true"
      />
    );
  }

  // After mount, show the actual icon
  return <Icon className={className} />;
}

/**
 * Hook to safely use icons without hydration issues
 */
export function useSafeIcon() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}