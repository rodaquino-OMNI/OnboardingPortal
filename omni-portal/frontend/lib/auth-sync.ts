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
           document.cookie.includes('auth_token=');
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
   * Force synchronization by reloading if state mismatch detected
   */
  forceSyncIfNeeded(clientIsAuthenticated: boolean): void {
    const cookieIsAuthenticated = this.hasAuthCookies();
    
    // If there's a mismatch, force reload to sync
    if (clientIsAuthenticated !== cookieIsAuthenticated) {
      console.warn('Auth state mismatch detected, forcing sync...');
      if (cookieIsAuthenticated && !clientIsAuthenticated) {
        // Cookies exist but client says not authenticated - reload
        window.location.reload();
      }
    }
  }
}

export const authSync = AuthSync.getInstance();