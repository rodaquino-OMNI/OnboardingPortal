/**
 * CookieManager - Handles cookie operations for authentication
 * Abstracts cookie manipulation from business logic
 */

export class CookieManager {
  private readonly COOKIE_NAME = 'authenticated';
  private readonly COOKIE_DOMAIN = 'localhost';
  private readonly COOKIE_MAX_AGE = 86400; // 24 hours
  private readonly ONBOARDING_COOKIE = 'onboarding_session';
  private readonly ONBOARDING_MAX_AGE = 7200; // 2 hours

  /**
   * Set authentication cookie
   */
  async setAuthCookie(authenticated: boolean): Promise<void> {
    if (typeof document === 'undefined') return;

    const cookieValue = authenticated ? 'true' : 'false';
    const cookieString = `${this.COOKIE_NAME}=${cookieValue}; path=/; max-age=${this.COOKIE_MAX_AGE}; SameSite=Lax; domain=${this.COOKIE_DOMAIN}`;
    
    document.cookie = cookieString;
    
    // Verify cookie was set
    if (process.env.NODE_ENV === 'development') {
      console.log('[CookieManager] Cookie set:', cookieString);
    }
  }

  /**
   * Clear authentication cookie
   */
  async clearAuthCookie(): Promise<void> {
    if (typeof document === 'undefined') return;

    // Set cookie with expired date to delete it
    document.cookie = `${this.COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${this.COOKIE_DOMAIN}`;
    
    // Also try to clear auth_token if it exists
    document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${this.COOKIE_DOMAIN}`;
  }

  /**
   * Check if authentication cookie exists
   */
  async hasAuthCookie(): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    const cookies = document.cookie;
    return cookies.includes(`${this.COOKIE_NAME}=true`) || 
           cookies.includes('auth_token=');
  }

  /**
   * Set onboarding session cookie
   */
  async setOnboardingCookie(stage: string): Promise<void> {
    if (typeof document === 'undefined') return;

    const cookieString = `${this.ONBOARDING_COOKIE}=${stage}; path=/; max-age=${this.ONBOARDING_MAX_AGE}; SameSite=Lax`;
    document.cookie = cookieString;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[CookieManager] Onboarding cookie set:', cookieString);
    }
  }

  /**
   * Clear onboarding session cookie
   */
  async clearOnboardingCookie(): Promise<void> {
    if (typeof document === 'undefined') return;

    document.cookie = `${this.ONBOARDING_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  /**
   * Check if onboarding cookie exists
   */
  async hasOnboardingCookie(): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    const cookies = document.cookie;
    return cookies.includes(`${this.ONBOARDING_COOKIE}=`);
  }

  /**
   * Get all cookies (for debugging)
   */
  getAllCookies(): string {
    if (typeof document === 'undefined') return '';
    return document.cookie;
  }
}