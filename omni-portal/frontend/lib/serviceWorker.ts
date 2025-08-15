// Service Worker Registration and Management
// Utility functions for service worker lifecycle

export interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig;

  constructor(config: ServiceWorkerConfig = {}) {
    this.config = config;
  }

  // Register service worker
  async register(swUrl: string = '/sw.js'): Promise<boolean> {
    if (!this.isSupported()) {
      console.log('Service workers are not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register(swUrl);
      
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdateFound();
      });

      // Check if there's already a service worker controlling the page
      if (navigator.serviceWorker.controller) {
        console.log('Service worker is already controlling the page');
        this.config.onSuccess?.(this.registration);
      }

      // Listen for messages from service worker
      this.setupMessageListener();

      console.log('Service worker registered successfully');
      return true;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      this.config.onError?.(error as Error);
      return false;
    }
  }

  // Unregister service worker
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      console.log('Service worker unregistered:', result);
      return result;
    } catch (error) {
      console.error('Service worker unregistration failed:', error);
      return false;
    }
  }

  // Update service worker
  async update(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      console.log('Service worker update triggered');
      return true;
    } catch (error) {
      console.error('Service worker update failed:', error);
      return false;
    }
  }

  // Skip waiting and activate new service worker
  skipWaiting(): void {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // Clear all caches
  async clearCaches(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CACHE_CLEAR' });
      }

      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );

      console.log('All caches cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear caches:', error);
      return false;
    }
  }

  // Get cache size
  async getCacheSize(): Promise<number> {
    if (!this.isSupported()) {
      return 0;
    }

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  // Check if service workers are supported
  private isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'serviceWorker' in navigator && 
           'caches' in window;
  }

  // Handle service worker updates
  private handleUpdateFound(): void {
    if (!this.registration) return;

    const installingWorker = this.registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // New update available
          console.log('New service worker update available');
          this.config.onUpdate?.(this.registration!);
        } else {
          // Service worker installed for the first time
          console.log('Service worker installed for the first time');
          this.config.onSuccess?.(this.registration!);
        }
      }
    });
  }

  // Setup message listener for service worker communication
  private setupMessageListener(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Message from service worker:', event.data);
      
      // Handle different message types
      switch (event.data?.type) {
        case 'CACHE_UPDATED':
          console.log('Cache updated:', event.data.cacheName);
          break;
        case 'OFFLINE_MODE':
          console.log('App is now offline');
          break;
        case 'ONLINE_MODE':
          console.log('App is now online');
          break;
      }
    });
  }

  // Get registration status
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  // Check if service worker is active
  isActive(): boolean {
    return !!navigator.serviceWorker.controller;
  }
}

// React hook for service worker management
import { useState, useEffect, useCallback } from 'react';

export function useServiceWorker(config: ServiceWorkerConfig = {}) {
  const [isSupported] = useState(() => 
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  );
  const [isRegistered, setIsRegistered] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [manager] = useState(() => new ServiceWorkerManager({
    ...config,
    onSuccess: (registration) => {
      setIsRegistered(true);
      config.onSuccess?.(registration);
    },
    onUpdate: (registration) => {
      setHasUpdate(true);
      config.onUpdate?.(registration);
    },
    onError: (error) => {
      setIsRegistered(false);
      config.onError?.(error);
    }
  }));

  useEffect(() => {
    if (isSupported) {
      manager.register();
    }
  }, [isSupported, manager]);

  const updateServiceWorker = useCallback(async () => {
    setIsUpdating(true);
    try {
      await manager.update();
      manager.skipWaiting();
      window.location.reload();
    } finally {
      setIsUpdating(false);
    }
  }, [manager]);

  const clearCaches = useCallback(async () => {
    return manager.clearCaches();
  }, [manager]);

  return {
    isSupported,
    isRegistered,
    isUpdating,
    hasUpdate,
    updateServiceWorker,
    clearCaches,
    manager
  };
}

// Connection status hook
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Default service worker configuration
export const defaultServiceWorkerConfig: ServiceWorkerConfig = {
  onUpdate: (registration) => {
    console.log('Service worker update available');
    // You can show a notification to the user here
  },
  onSuccess: (registration) => {
    console.log('Service worker registered successfully');
  },
  onError: (error) => {
    console.error('Service worker registration error:', error);
  }
};

// Export default instance
export const serviceWorkerManager = new ServiceWorkerManager(defaultServiceWorkerConfig);