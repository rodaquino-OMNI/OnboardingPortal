/**
 * PERFORMANCE OPTIMIZATION: Service Worker for caching and offline support
 */

export const setupServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    // Register service worker only in production
    if (process.env.NODE_ENV === 'production') {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered:', registration);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              console.log('New version available, consider prompting user to refresh');
            }
          });
        }
      });

      return registration;
    }
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
  }
};

// Cache strategies
export const cacheStrategies = {
  // Cache first for static assets
  cacheFirst: (request: Request) => {
    return caches.match(request).then(response => {
      return response || fetch(request).then(fetchResponse => {
        const responseClone = fetchResponse.clone();
        caches.open('static-cache-v1').then(cache => {
          cache.put(request, responseClone);
        });
        return fetchResponse;
      });
    });
  },

  // Network first for API calls
  networkFirst: (request: Request) => {
    return fetch(request).then(response => {
      const responseClone = response.clone();
      caches.open('api-cache-v1').then(cache => {
        cache.put(request, responseClone);
      });
      return response;
    }).catch(() => {
      return caches.match(request);
    });
  },

  // Stale while revalidate for dynamic content
  staleWhileRevalidate: (request: Request) => {
    const fetchPromise = fetch(request).then(response => {
      const responseClone = response.clone();
      caches.open('dynamic-cache-v1').then(cache => {
        cache.put(request, responseClone);
      });
      return response;
    });

    return caches.match(request).then(cacheResponse => {
      return cacheResponse || fetchPromise;
    });
  }
};

// Cache management
export const clearOldCaches = async () => {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    !['static-cache-v1', 'api-cache-v1', 'dynamic-cache-v1'].includes(name)
  );
  
  await Promise.all(oldCaches.map(name => caches.delete(name)));
};