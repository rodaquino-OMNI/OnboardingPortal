'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { authSync } from '@/lib/auth-sync';
import { authDiag } from '@/lib/auth-diagnostics';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const router = useRouter();
  const mountedRef = useRef(false);
  const checkInProgressRef = useRef(false);
  const [clientReady, setClientReady] = useState(false);

  // Set client ready state to prevent SSR/CSR mismatch
  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    // Only run auth checks on client side after hydration
    if (!clientReady) return;
    if (mountedRef.current) return;
    mountedRef.current = true;
    
    authDiag.log('MOUNT', 'DashboardLayout', {
      isAuthenticated,
      isLoading,
      path: window.location.pathname
    });
    
    // Use AuthSync for reliable authentication checking
    const checkAuthStatus = async () => {
      if (checkInProgressRef.current) {
        authDiag.log('AUTH_CHECK', 'DashboardLayout', 'Check already in progress, skipping');
        return;
      }
      checkInProgressRef.current = true;
      
      const hasAuthCookie = authSync.hasAuthCookies();
      
      authDiag.log('COOKIE_CHECK', 'DashboardLayout', {
        hasAuthCookie,
        isAuthenticated,
        isLoading,
        cookies: document.cookie.substring(0, 100)
      });
      
      if (!hasAuthCookie) {
        // No cookie, redirect to login only after checking
        authDiag.log('REDIRECT', 'DashboardLayout', {
          reason: 'No auth cookie found',
          target: '/login'
        });
        router.push('/login');
        checkInProgressRef.current = false;
        return;
      }
      
      // Has cookie, update state
      authDiag.log('STATE_CHANGE', 'DashboardLayout', 'Auth cookie found, updating state');
      
      try {
        await checkAuth();
        authDiag.log('AUTH_CHECK', 'DashboardLayout', {
          success: true,
          isAuthenticated,
          isLoading
        });
      } catch (error) {
        authDiag.log('ERROR', 'DashboardLayout', {
          error: error instanceof Error ? error.message : 'Unknown error',
          willRedirect: true
        });
        router.push('/login');
      } finally {
        checkInProgressRef.current = false;
      }
      
      // Force sync if needed
      authSync.forceSyncIfNeeded(isAuthenticated);
    };
    
    checkAuthStatus();
    
    // Start monitoring for auth changes
    authSync.startMonitoring((hasAuth) => {
      authDiag.log('AUTH_MONITOR', 'DashboardLayout', {
        hasAuth,
        isAuthenticated,
        willRedirect: !hasAuth && isAuthenticated
      });
      
      if (!hasAuth && isAuthenticated) {
        // Lost authentication, redirect
        authDiag.log('REDIRECT', 'DashboardLayout', {
          reason: 'Lost authentication',
          target: '/login'
        });
        router.push('/login');
      }
    });
    
    return () => {
      authSync.stopMonitoring();
    };
  }, [clientReady]); // Run once after client is ready

  // REMOVED the second useEffect that was causing premature redirects
  // The auth check is now handled entirely in the first useEffect

  // During SSR or initial client load, show loading
  if (!clientReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // After client is ready, check authentication
  const hasAuthCookie = typeof document !== 'undefined' && 
    (document.cookie.includes('authenticated=true') || document.cookie.includes('auth_token='));
  
  // Still loading auth state but have cookies
  if (!isAuthenticated && hasAuthCookie) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Definitely not authenticated
  if (!isAuthenticated && !hasAuthCookie) {
    return null;
  }

  return <>{children}</>;
}