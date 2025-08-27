/**
 * Comprehensive Authentication Token Fix
 * Ensures consistent token storage and retrieval across the entire application
 */

export interface TokenInfo {
  token: string | null;
  source: 'localStorage' | 'cookies' | 'sessionStorage' | null;
  isValid: boolean;
}

export class AuthTokenManager {
  private static instance: AuthTokenManager;
  
  public static getInstance(): AuthTokenManager {
    if (!AuthTokenManager.instance) {
      AuthTokenManager.instance = new AuthTokenManager();
    }
    return AuthTokenManager.instance;
  }

  /**
   * Get authentication token from all possible sources
   */
  public getToken(): TokenInfo {
    // Priority order: localStorage -> sessionStorage -> cookies
    
    // 1. Check localStorage (primary)
    let token = localStorage.getItem('auth_token');
    if (token && token !== 'authenticated' && token !== 'null') {
      return {
        token,
        source: 'localStorage',
        isValid: this.validateToken(token)
      };
    }

    // 2. Check alternative localStorage keys
    token = localStorage.getItem('access_token');
    if (token && token !== 'authenticated' && token !== 'null') {
      return {
        token,
        source: 'localStorage', 
        isValid: this.validateToken(token)
      };
    }

    // 3. Check sessionStorage
    token = sessionStorage.getItem('auth_token');
    if (token && token !== 'authenticated' && token !== 'null') {
      return {
        token,
        source: 'sessionStorage',
        isValid: this.validateToken(token)
      };
    }

    // 4. Check cookies
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const authCookie = cookies.find(c => c.trim().startsWith('auth_token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
        if (token && token !== 'authenticated' && token !== 'null') {
          return {
            token,
            source: 'cookies',
            isValid: this.validateToken(token)
          };
        }
      }
    }

    return {
      token: null,
      source: null,
      isValid: false
    };
  }

  /**
   * Store authentication token consistently across all storage mechanisms
   */
  public setToken(token: string, user?: any): void {
    if (!token || token === 'null') {
      console.error('[AuthTokenManager] Invalid token provided');
      return;
    }

    // Store in localStorage (primary)
    localStorage.setItem('auth_token', token);
    
    // Store user data if provided
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    }

    // Set cookies for server-side access
    if (typeof document !== 'undefined') {
      const maxAge = 24 * 60 * 60; // 24 hours
      document.cookie = `auth_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      document.cookie = `authenticated=true; path=/; max-age=${maxAge}; SameSite=Lax`;
    }

    console.log('[AuthTokenManager] Token stored successfully:', token.substring(0, 10) + '...');
  }

  /**
   * Clear all authentication tokens and user data
   */
  public clearToken(): void {
    // Clear localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');

    // Clear sessionStorage
    sessionStorage.removeItem('auth_token');

    // Clear cookies
    if (typeof document !== 'undefined') {
      const expiry = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = `auth_token=; path=/; ${expiry}`;
      document.cookie = `authenticated=; path=/; ${expiry}`;
      document.cookie = `onboarding_session=; path=/; ${expiry}`;
    }

    console.log('[AuthTokenManager] All tokens cleared');
  }

  /**
   * Basic token validation
   */
  private validateToken(token: string): boolean {
    if (!token || token === 'authenticated' || token === 'null') {
      return false;
    }

    // Basic JWT structure validation
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          // Try to decode the payload
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp;
          
          // Check if token is expired
          if (exp && exp * 1000 < Date.now()) {
            console.warn('[AuthTokenManager] Token is expired');
            return false;
          }
          
          return true;
        } catch (e) {
          console.warn('[AuthTokenManager] Invalid JWT format');
          return false;
        }
      }
    }

    // For non-JWT tokens, assume valid if not empty
    return token.length > 10;
  }

  /**
   * Get authorization header value
   */
  public getAuthHeader(): string | null {
    const tokenInfo = this.getToken();
    return tokenInfo.token ? `Bearer ${tokenInfo.token}` : null;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    const tokenInfo = this.getToken();
    return tokenInfo.isValid;
  }

  /**
   * Debug method to check token status
   */
  public debugTokenStatus(): void {
    const tokenInfo = this.getToken();
    console.group('[AuthTokenManager] Token Debug Status');
    console.log('Token found:', !!tokenInfo.token);
    console.log('Token source:', tokenInfo.source);
    console.log('Token valid:', tokenInfo.isValid);
    if (tokenInfo.token) {
      console.log('Token preview:', tokenInfo.token.substring(0, 20) + '...');
    }
    console.log('localStorage auth_token:', localStorage.getItem('auth_token'));
    console.log('localStorage access_token:', localStorage.getItem('access_token'));
    console.log('document.cookie includes auth:', document.cookie.includes('auth_token'));
    console.groupEnd();
  }
}

// Export singleton instance
export const authTokenManager = AuthTokenManager.getInstance();

// Global access for debugging
if (typeof window !== 'undefined') {
  (window as any).authTokenManager = authTokenManager;
}