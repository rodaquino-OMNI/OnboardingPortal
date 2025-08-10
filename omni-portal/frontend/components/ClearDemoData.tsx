'use client';

import { useEffect } from 'react';
import { clearAllDemoData } from '@/lib/clear-demo-data';

export function ClearDemoData() {
  useEffect(() => {
    // Clear demo data on mount in production
    if (process.env.NODE_ENV === 'production') {
      clearAllDemoData();
    }
  }, []);

  return null;
}