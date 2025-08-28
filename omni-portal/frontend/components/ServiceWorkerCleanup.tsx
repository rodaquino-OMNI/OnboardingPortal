'use client';

import { useEffect } from 'react';

export function ServiceWorkerCleanup() {
  useEffect(() => {
    // Clean up any stale service workers
    const cleanupServiceWorkers = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          
          for (const registration of registrations) {
            // Check if service worker is stale or from previous deployment
            if (registration.scope.includes('localhost') || 
                registration.scope.includes('_next') ||
                registration.active?.scriptURL.includes('old-sw.js')) {
              
              console.log('[ServiceWorkerCleanup] Unregistering stale service worker:', registration.scope);
              await registration.unregister();
            }
          }

          // Clear any service worker caches that might be stale
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            const staleCaches = cacheNames.filter(name => 
              name.includes('workbox-') || 
              name.includes('sw-') ||
              name.includes('_next-static')
            );

            await Promise.all(
              staleCaches.map(cacheName => {
                console.log('[ServiceWorkerCleanup] Deleting stale cache:', cacheName);
                return caches.delete(cacheName);
              })
            );
          }
        } catch (error) {
          console.warn('[ServiceWorkerCleanup] Error during cleanup:', error);
        }
      }
    };

    // Run cleanup on mount
    cleanupServiceWorkers();

    // Also run cleanup when the page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cleanupServiceWorkers();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // This component doesn't render anything
  return null;
}