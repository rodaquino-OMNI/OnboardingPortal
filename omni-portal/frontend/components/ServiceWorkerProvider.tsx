'use client';

import { useEffect, useState } from 'react';
import { useServiceWorker, useConnectionStatus } from '@/lib/serviceWorker';

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
}

export function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [showOfflineNotification, setShowOfflineNotification] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isOnline = useConnectionStatus();

  const {
    isSupported,
    isRegistered,
    hasUpdate,
    updateServiceWorker,
    isUpdating
  } = useServiceWorker({
    onUpdate: () => {
      setShowUpdateNotification(true);
    },
    onSuccess: () => {
      console.log('Service worker registered successfully');
    },
    onError: (error) => {
      console.error('Service worker error:', error);
    }
  });

  // Set mounted state for client-only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show offline notification
  useEffect(() => {
    if (!isOnline && isRegistered) {
      setShowOfflineNotification(true);
      const timer = setTimeout(() => {
        setShowOfflineNotification(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowOfflineNotification(false);
      return () => {}; // Return empty cleanup function for else case
    }
  }, [isOnline, isRegistered]);

  const handleUpdate = async () => {
    await updateServiceWorker();
    setShowUpdateNotification(false);
  };

  const dismissUpdateNotification = () => {
    setShowUpdateNotification(false);
  };

  return (
    <>
      {children}
      
      {/* Update Notification */}
      {showUpdateNotification && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="flex items-start">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900">
                App Update Available
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                A new version of the app is available. Update now for the latest features.
              </p>
            </div>
            <button
              onClick={dismissUpdateNotification}
              className="ml-3 text-gray-400 hover:text-gray-600"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex space-x-2">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update Now'}
            </button>
            <button
              onClick={dismissUpdateNotification}
              className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Offline Notification */}
      {showOfflineNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-amber-100 border border-amber-300 rounded-lg shadow-lg p-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-800">
                You're offline. Some features may be limited.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Debug (Development Only) - Disabled to prevent hydration issues */}
      {/* Debug UI removed to fix React hydration error #418 */}
    </>
  );
}

export default ServiceWorkerProvider;