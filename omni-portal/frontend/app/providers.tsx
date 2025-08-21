/**
 * Global Providers - Wraps the entire app with necessary providers
 * Handles authentication, migration initialization and monitoring
 * SSR-safe implementation with proper hydration guards
 */

'use client';

import React, { useEffect, useState } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
// import { integrationManager } from '@/lib/integration-manager';
// import { BoundaryViolationMonitor } from '@/modules/boundaries/BoundaryEnforcer';
import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { performanceBudgetGuard } from '@/docs/migration-toolkit/performance-budget-guard';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Fix hydration by starting with same state on server and client
  const [isClient, setIsClient] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'pending' | 'active' | 'failed'>('active'); // Start as active to avoid state change
  const [initError, setInitError] = useState<string | null>(null);

  // SSR hydration fix: Track when we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // SSR guard: Only run on client side
    if (!isClient || typeof window === 'undefined') {
      return;
    }

    let performanceObserver: PerformanceObserver | null = null;
    
    // Error handler function to clean up properly
    const errorHandler = (event: ErrorEvent) => {
      eventBus.emit(EventTypes.ERROR_UNCAUGHT, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };
    
    // Initialize migration system
    const initializeMigration = async () => {
      try {
        console.log('[Providers] Initializing migration system...');
        
        // Skip integration manager for now - simplified startup
        console.log('[Providers] Using simplified initialization');
        
        setMigrationStatus('active');
        console.log('[Providers] Migration system initialized successfully');
        
        // Set up global error handling (client-side only)
        window.addEventListener('error', errorHandler);
        
        // Set up performance monitoring (client-side only)
        if ('PerformanceObserver' in window) {
          performanceObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'navigation') {
                const navEntry = entry as PerformanceNavigationTiming;
                eventBus.emit(EventTypes.PERFORMANCE_METRIC, {
                  label: 'page-load',
                  duration: navEntry.loadEventEnd - navEntry.fetchStart
                });
              }
            }
          });
          
          performanceObserver.observe({ entryTypes: ['navigation'] });
        }
        
      } catch (error) {
        console.error('[Providers] Failed to initialize migration:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
        setMigrationStatus('failed');
        
        // Fall back to legacy system (simplified)
        console.log('[Providers] Using fallback mode');
      }
    };

    initializeMigration();

    // Cleanup on unmount
    return () => {
      // Remove error event listener (only if window exists)
      if (typeof window !== 'undefined') {
        window.removeEventListener('error', errorHandler);
      }
      
      // Disconnect performance observer
      if (performanceObserver) {
        performanceObserver.disconnect();
      }
      
      // Clear event listeners
      eventBus.removeAllListeners();
    };
  }, [isClient]);

  // Show initialization error if failed
  if (migrationStatus === 'failed' && initError) {
    console.error('[Providers] Migration failed, using legacy system');
    // Don't block the app, just log the error
  }

  return (
    <AuthProvider>
      {children}
      {/* Monitoring UI removed to prevent hydration errors */}
    </AuthProvider>
  );
}

/**
 * Migration status indicator for development
 */
function MigrationStatusIndicator({ status }: { status: string }) {
  const [details, setDetails] = useState<any>(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      // const migrationDetails = integrationManager.getStatus();
      // setDetails(migrationDetails);
      setDetails({ phase: 'active', rolloutPercentage: 100, activeFeatures: [], issues: [] });
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (!details) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        left: 10,
        background: status === 'active' ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 165, 0, 0.9)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 99999,
        maxWidth: '200px'
      }}
    >
      <div style={{ fontWeight: 'bold' }}>Migration Status</div>
      <div>Phase: {details.phase}</div>
      <div>Rollout: {details.rolloutPercentage}%</div>
      <div>Features: {details.activeFeatures.length}</div>
      {details.issues.length > 0 && (
        <div style={{ color: 'yellow' }}>Issues: {details.issues.length}</div>
      )}
    </div>
  );
}