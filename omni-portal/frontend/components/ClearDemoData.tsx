'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';

export function ClearDemoData() {
  const [isVisible, setIsVisible] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    // Only show in development or if demo data exists
    const isDev = process.env.NODE_ENV === 'development';
    const hasDemo = localStorage.getItem('demo-data') || sessionStorage.getItem('demo-data');
    setIsVisible(isDev || !!hasDemo);
  }, []);

  const clearDemoData = async () => {
    if (isClearing) return;
    
    setIsClearing(true);
    try {
      // Clear localStorage demo data
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('demo') || key.includes('test') || key.includes('sample')) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage demo data
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.includes('demo') || key.includes('test') || key.includes('sample')) {
          sessionStorage.removeItem(key);
        }
      });

      // Clear any cached data
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      console.log('[ClearDemoData] Demo data cleared successfully');
      
      // Auto-hide after clearing
      setTimeout(() => setIsVisible(false), 2000);
    } catch (error) {
      console.error('[ClearDemoData] Error clearing demo data:', error);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-yellow-100 border border-yellow-300 rounded-lg p-3 shadow-lg max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-sm font-medium text-yellow-800">Demo Data Detected</span>
      </div>
      <p className="text-xs text-yellow-700 mb-3">
        Clear demo/test data from storage for clean testing
      </p>
      <Button
        onClick={clearDemoData}
        disabled={isClearing}
        variant="outline"
        size="sm"
        className="w-full text-yellow-800 border-yellow-300 hover:bg-yellow-200"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        {isClearing ? 'Clearing...' : 'Clear Demo Data'}
      </Button>
    </div>
  );
}