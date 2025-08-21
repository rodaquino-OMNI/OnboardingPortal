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
      
      try {
        const hasAuthCookie = authSync.hasAuthCookies();
        
        authDiag.log('COOKIE_CHECK', 'DashboardLayout', {
          hasAuthCookie,
          isAuthenticated,
          isLoading,
          cookies: document.cookie.substring(0, 100)
        });
        
        if (!hasAuthCookie && !isAuthenticated) {
          // No auth - redirect only once
          authDiag.log('NO_AUTH', 'DashboardLayout', 'No authentication found, redirecting');
          router.push('/login');
          return;
        }
        
        if (hasAuthCookie && !isAuthenticated) {
          // Has cookie but not authenticated - check auth
          authDiag.log('STATE_SYNC', 'DashboardLayout', 'Auth cookie found, syncing state');
          await checkAuth();
        }
        
      } catch (error) {
        authDiag.log('ERROR', 'DashboardLayout', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        router.push('/login');
      } finally {
        checkInProgressRef.current = false;
      }
    };
    
    checkAuthStatus();
    
  }, [clientReady]); // FIXED: Remove circular dependencies

  // Monitor auth state changes only
  useEffect(() => {
    if (!clientReady || !mountedRef.current) return;
    
    // Only monitor for auth loss, not initial checks
    const interval = setInterval(() => {
      const hasAuth = authSync.hasAuthCookies();
      
      // Only redirect if we had auth and lost it
      if (!hasAuth && isAuthenticated && !checkInProgressRef.current) {
        authDiag.log('AUTH_LOST', 'DashboardLayout', 'Authentication lost, redirecting');
        router.push('/login');
      }
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, [clientReady, isAuthenticated, router]); // Safe dependencies

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

  // Definitely not authenticated - redirect to login
  if (!isAuthenticated && !hasAuthCookie) {
    router.push('/login');
    return null;
  }

  return <>{children}</>;
}