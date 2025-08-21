/**
 * Authentication Synchronization Utility
 * Ensures cookies and client state are properly synchronized
 */

export class AuthSync {
  private static instance: AuthSync;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): AuthSync {
    if (!AuthSync.instance) {
      AuthSync.instance = new AuthSync();
    }
    return AuthSync.instance;
  }

  /**
   * Check if authentication cookies exist
   */
  hasAuthCookies(): boolean {
    if (typeof document === 'undefined') return false;
    
    return document.cookie.includes('authenticated=true') || 
           document.cookie.includes('auth_token=') ||
           document.cookie.includes('austa_health_portal_session=') ||
           document.cookie.includes('XSRF-TOKEN=');
  }

  /**
   * Extract auth token from cookies
   */
  getAuthToken(): string | null {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * Clear all authentication cookies
   */
  clearAuthCookies(): void {
    if (typeof document === 'undefined') return;
    
    // Clear cookies by setting them to expire
    document.cookie = 'authenticated=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'XSRF-TOKEN=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'austa_health_portal_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }

  /**
   * Start monitoring authentication state
   */
  startMonitoring(callback: (isAuthenticated: boolean) => void): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Check every second for auth state changes
    this.syncInterval = setInterval(() => {
      const hasAuth = this.hasAuthCookies();
      callback(hasAuth);
    }, 1000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Force synchronization by checking session storage instead of reloading
   */
  private lastSyncTime = 0;
  private readonly SYNC_THROTTLE = 3000; // 3 seconds minimum between syncs
  private reloadCount = 0;
  private readonly MAX_RELOADS = 2; // Maximum reloads per session

  forceSyncIfNeeded(clientIsAuthenticated: boolean): void {
    const cookieIsAuthenticated = this.hasAuthCookies();
    
    // If there's a mismatch, try to sync without reload first
    if (clientIsAuthenticated !== cookieIsAuthenticated) {
      console.warn('Auth state mismatch detected, attempting sync...', {
        client: clientIsAuthenticated,
        cookies: cookieIsAuthenticated
      });
      
      const now = Date.now();
      const timeSinceLastSync = now - this.lastSyncTime;
      
      if (timeSinceLastSync < this.SYNC_THROTTLE) {
        console.warn(`Sync throttled. ${this.SYNC_THROTTLE - timeSinceLastSync}ms until next sync allowed`);
        return;
      }
      
      this.lastSyncTime = now;
      
      // Check reload count from sessionStorage
      const storedReloadCount = parseInt(sessionStorage.getItem('auth_reload_count') || '0', 10);
      this.reloadCount = storedReloadCount;
      
      if (cookieIsAuthenticated && !clientIsAuthenticated && this.reloadCount < this.MAX_RELOADS) {
        // Only reload if we haven't exceeded the limit
        console.warn('Forcing reload to sync auth state...');
        this.reloadCount++;
        sessionStorage.setItem('auth_reload_count', String(this.reloadCount));
        sessionStorage.setItem('auth_last_reload', String(now));
        
        // Clear reload count after successful auth
        setTimeout(() => {
          sessionStorage.removeItem('auth_reload_count');
        }, 30000); // Clear after 30 seconds
        
        window.location.reload();
      } else if (this.reloadCount >= this.MAX_RELOADS) {
        console.error('Maximum reloads exceeded. Manual intervention required.');
        // Emit event for manual handling
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-sync-failed', {
            detail: { reason: 'max_reloads_exceeded', reloadCount: this.reloadCount }
          }));
        }
      }
    }
  }
}

export const authSync = AuthSync.getInstance();