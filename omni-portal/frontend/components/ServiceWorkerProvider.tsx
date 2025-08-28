'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ServiceWorkerContextType {
  registration: ServiceWorkerRegistration | null;
  isRegistered: boolean;
  isSupported: boolean;
  updateAvailable: boolean;
  updateServiceWorker: () => Promise<void>;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType | undefined>(undefined);

export const useServiceWorker = () => {
  const context = useContext(ServiceWorkerContext);
  if (context === undefined) {
    throw new Error('useServiceWorker must be used within a ServiceWorkerProvider');
  }
  return context;
};

interface ServiceWorkerProviderProps {
  children: ReactNode;
}

export function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check if service workers are supported
    const supported = 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (!supported) {
      console.log('[ServiceWorker] Service workers not supported');
      return;
    }

    // Register service worker in production only
    if (process.env.NODE_ENV === 'production') {
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      
      console.log('[ServiceWorker] Registration successful:', reg);
      setRegistration(reg);
      setIsRegistered(true);

      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              console.log('[ServiceWorker] Update available');
              setUpdateAvailable(true);
            }
          });
        }
      });

      // Check for waiting service worker
      if (reg.waiting) {
        console.log('[ServiceWorker] Update ready');
        setUpdateAvailable(true);
      }

    } catch (error) {
      console.error('[ServiceWorker] Registration failed:', error);
    }
  };

  const updateServiceWorker = async () => {
    if (!registration) return;

    const waitingServiceWorker = registration.waiting;
    if (waitingServiceWorker) {
      // Tell the waiting service worker to skip waiting
      waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Listen for the controlling service worker change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[ServiceWorker] Controller changed, reloading page');
        window.location.reload();
      });
    }
  };

  const contextValue: ServiceWorkerContextType = {
    registration,
    isRegistered,
    isSupported,
    updateAvailable,
    updateServiceWorker,
  };

  return (
    <ServiceWorkerContext.Provider value={contextValue}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}