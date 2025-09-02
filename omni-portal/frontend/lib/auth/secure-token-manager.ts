'use client';

import { logger } from '@/lib/logger';

/**
 * SecureTokenManager - Manages authentication tokens exclusively via httpOnly cookies
 * This class provides a secure interface for token management without exposing tokens to JavaScript
 */
export class SecureTokenManager {
  private static readonly COOKIE_NAMES = {
    AUTH_TOKEN: 'auth_token',
    SESSION: 'laravel_session',
    CSRF: 'XSRF-TOKEN',
    AUTHENTICATED: 'authenticated',
    ONBOARDING_SESSION: 'onboarding_session',
    REFRESH_TOKEN: 'refresh_token',
    SESSION_ID: 'session_id'
  } as const;

  private static readonly COOKIE_OPTIONS = {
    DEFAULT_MAX_AGE: 7200, // 2 hours
    REFRESH_MAX_AGE: 2592000, // 30 days
    SAME_SITE: 'Lax' as const,
    SECURE: true,
    PATH: '/'
  };

  /**
   * Check if user has a valid authentication session
   * Note: We can only check for cookie existence, not validity
   */
  static hasValidSession(): boolean {
    if (typeof document === 'undefined') return false;
    
    try {
      const cookies = document.cookie;
      const hasAuthCookie = cookies.includes(`${this.COOKIE_NAMES.AUTH_TOKEN}=`) ||
                           cookies.includes(`${this.COOKIE_NAMES.SESSION}=`);
      const hasAuthenticatedFlag = cookies.includes(`${this.COOKIE_NAMES.AUTHENTICATED}=true`);
      
      return hasAuthCookie && hasAuthenticatedFlag;
    } catch (error) {
      logger.warn('Error checking session validity', error);
      return false;
    }
  }

  /**
   * Check if authentication cookies exist
   */
  static hasAuthCookies(): boolean {
    if (typeof document === 'undefined') return false;
    
    try {
      const cookies = document.cookie;
      return Object.values(this.COOKIE_NAMES).some(cookieName => 
        cookies.includes(`${cookieName}=`)
      );
    } catch (error) {
      logger.warn('Error checking auth cookies', error);
      return false;
    }
  }

  /**
   * Get CSRF token for API requests
   */
  static getCSRFToken(): string | null {
    if (typeof document === 'undefined') return null;
    
    try {
      const cookies = document.cookie;
      const csrfMatch = cookies.match(new RegExp(`${this.COOKIE_NAMES.CSRF}=([^;]+)`));
      
      if (csrfMatch && csrfMatch[1]) {
        // Decode the cookie value as Laravel encodes it
        return decodeURIComponent(csrfMatch[1]);
      }
    } catch (error) {
      logger.warn('Error getting CSRF token', error);
    }
    
    return null;
  }

  /**
   * Get session ID for logging and debugging
   */
  static getSessionId(): string | null {
    if (typeof document === 'undefined') return null;
    
    try {
      const cookies = document.cookie;
      const sessionMatch = cookies.match(new RegExp(`${this.COOKIE_NAMES.SESSION_ID}=([^;]+)`));
      
      if (sessionMatch && sessionMatch[1]) {
        return decodeURIComponent(sessionMatch[1]);
      }
    } catch (error) {
      logger.warn('Error getting session ID', error);
    }
    
    return null;
  }

  /**
   * Set authentication flag (this is the only cookie we can set client-side)
   * All other tokens are managed by the server via httpOnly cookies
   */
  static setAuthenticationFlag(authenticated: boolean = true, maxAge?: number): void {
    if (typeof document === 'undefined') return;
    
    try {
      const age = maxAge || this.COOKIE_OPTIONS.DEFAULT_MAX_AGE;
      const cookieOptions = [
        `${this.COOKIE_NAMES.AUTHENTICATED}=${authenticated}`,
        `path=${this.COOKIE_OPTIONS.PATH}`,
        `max-age=${age}`,
        `SameSite=${this.COOKIE_OPTIONS.SAME_SITE}`,
        this.COOKIE_OPTIONS.SECURE ? 'Secure' : ''
      ].filter(Boolean).join('; ');
      
      document.cookie = cookieOptions;
      
      // Also set onboarding session flag for compatibility
      if (authenticated) {
        const onboardingOptions = [
          `${this.COOKIE_NAMES.ONBOARDING_SESSION}=authenticated`,
          `path=${this.COOKIE_OPTIONS.PATH}`,
          `max-age=${age}`,
          `SameSite=${this.COOKIE_OPTIONS.SAME_SITE}`,
          this.COOKIE_OPTIONS.SECURE ? 'Secure' : ''
        ].filter(Boolean).join('; ');
        
        document.cookie = onboardingOptions;
      }
      
      logger.debug('Authentication flag set', { authenticated });
    } catch (error) {
      logger.error('Error setting authentication flag', error);
    }
  }

  /**
   * Clear all authentication-related cookies
   * Note: We can only clear client-accessible cookies, httpOnly cookies are cleared by the server
   */
  static clearAll(): void {
    if (typeof document === 'undefined') return;
    
    try {
      const cookiesToClear = Object.values(this.COOKIE_NAMES);
      const expireOptions = `path=${this.COOKIE_OPTIONS.PATH}; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
      
      cookiesToClear.forEach(cookieName => {
        // Clear for current domain
        document.cookie = `${cookieName}=; ${expireOptions}`;
        
        // Clear for localhost (development)
        document.cookie = `${cookieName}=; ${expireOptions}; domain=localhost`;
        
        // Clear for parent domain
        const domain = window.location.hostname;
        if (domain !== 'localhost') {
          document.cookie = `${cookieName}=; ${expireOptions}; domain=.${domain}`;
        }
      });
      
      logger.debug('All accessible cookies cleared');
    } catch (error) {
      logger.error('Error clearing cookies', error);
    }
  }

  /**
   * Get cookie expiration time (approximate)
   * Since we can't read httpOnly cookies, this estimates based on authentication flag
   */
  static getTokenExpiration(): number | null {
    if (typeof document === 'undefined') return null;
    
    try {
      const cookies = document.cookie;
      const authMatch = cookies.match(new RegExp(`${this.COOKIE_NAMES.AUTHENTICATED}=true`));
      
      if (authMatch) {
        // Estimate expiration based on default max age
        // This is approximate since we can't read the actual httpOnly cookie expiration
        const estimatedExpiration = Date.now() + (this.COOKIE_OPTIONS.DEFAULT_MAX_AGE * 1000);
        return estimatedExpiration;
      }
    } catch (error) {
      logger.warn('Error getting token expiration', error);
    }
    
    return null;
  }

  /**
   * Check if token is close to expiration (within 5 minutes)
   */
  static isTokenExpiringSoon(): boolean {
    const expiration = this.getTokenExpiration();
    if (!expiration) return true; // Assume expiring if we can't determine
    
    const fiveMinutes = 5 * 60 * 1000;
    return (expiration - Date.now()) < fiveMinutes;
  }

  /**
   * Get all visible cookie information for debugging
   */
  static getDebugInfo(): Record<string, any> {
    if (typeof document === 'undefined') {
      return { error: 'Not in browser environment' };
    }
    
    try {
      const cookies = document.cookie;
      const info: Record<string, any> = {
        hasValidSession: this.hasValidSession(),
        hasAuthCookies: this.hasAuthCookies(),
        csrfToken: this.getCSRFToken() ? 'present' : 'missing',
        sessionId: this.getSessionId() ? 'present' : 'missing',
        tokenExpiration: this.getTokenExpiration(),
        isExpiringSoon: this.isTokenExpiringSoon(),
        visibleCookies: {}
      };
      
      // Check which auth cookies are visible (non-httpOnly)
      Object.entries(this.COOKIE_NAMES).forEach(([name, cookieName]) => {
        info.visibleCookies[name] = cookies.includes(`${cookieName}=`) ? 'present' : 'missing';
      });
      
      return info;
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Validate session integrity
   * Performs basic checks to ensure the session appears valid
   */
  static validateSession(): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      if (!this.hasValidSession()) {
        issues.push('No valid authentication session found');
        recommendations.push('User needs to login again');
      }
      
      if (!this.getCSRFToken()) {
        issues.push('CSRF token missing');
        recommendations.push('Refresh CSRF token from server');
      }
      
      if (this.isTokenExpiringSoon()) {
        issues.push('Authentication token expiring soon');
        recommendations.push('Refresh token proactively');
      }
      
      const debugInfo = this.getDebugInfo();
      if (debugInfo.error) {
        issues.push(`Debug info error: ${debugInfo.error}`);
      }
      
    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Initialize secure token manager
   * Sets up any necessary event listeners or initialization logic
   */
  static initialize(): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Set up visibility change listener to validate session when tab becomes active
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.hasValidSession()) {
          logger.debug('Tab became active, session still valid');
        }
      });
      
      // Set up beforeunload listener to clean up if needed
      window.addEventListener('beforeunload', () => {
        // Perform any cleanup if necessary
        logger.debug('Page unloading, token manager cleanup');
      });
      
      logger.debug('SecureTokenManager initialized');
    } catch (error) {
      logger.error('Error initializing SecureTokenManager', error);
    }
  }
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  SecureTokenManager.initialize();
}

export default SecureTokenManager;