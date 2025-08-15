/**
 * CheckAuthUseCase - Verifies current authentication status
 * Handles session validation and profile fetching
 */

import { AuthService } from '../domain/AuthService';
import { TokenManager } from '../domain/TokenManager';
import { AuthApiClient } from '../infrastructure/AuthApiClient';
import { CookieManager } from '../infrastructure/CookieManager';
import type { AuthResponse } from '@/lib/api/auth';

export interface CheckAuthResult {
  authenticated: boolean;
  user?: AuthResponse['user'];
  error?: string;
}

export class CheckAuthUseCase {
  private lastCheckTime = 0;
  private readonly CHECK_THROTTLE = 2000; // 2 seconds

  constructor(
    private authService: AuthService,
    private tokenManager: TokenManager,
    private apiClient: AuthApiClient,
    private cookieManager: CookieManager
  ) {}

  /**
   * Check authentication status
   */
  async execute(force = false): Promise<CheckAuthResult> {
    try {
      // 1. Throttle checks to prevent excessive API calls
      const now = Date.now();
      if (!force && now - this.lastCheckTime < this.CHECK_THROTTLE) {
        // Return cached result if available
        const hasToken = await this.tokenManager.exists();
        return { authenticated: hasToken };
      }
      this.lastCheckTime = now;

      // 2. Check for auth cookie (fast check)
      const hasAuthCookie = await this.cookieManager.hasAuthCookie();
      if (!hasAuthCookie) {
        return { authenticated: false };
      }

      // 3. Check for stored token
      const token = await this.tokenManager.retrieve();
      const sessionValidation = this.authService.validateSession(token);
      if (!sessionValidation.valid) {
        // Clear invalid session
        await this.clearInvalidSession();
        return { authenticated: false };
      }

      // 4. Fetch user profile to verify session
      try {
        const user = await this.apiClient.getProfile();
        return {
          authenticated: true,
          user
        };
      } catch (error) {
        // Handle 401 specifically
        if (this.is401Error(error)) {
          await this.clearInvalidSession();
          return { authenticated: false };
        }
        
        // For other errors, maintain current state
        return {
          authenticated: hasAuthCookie,
          error: 'Failed to fetch profile'
        };
      }

    } catch (error) {
      console.error('[CheckAuthUseCase] Auth check failed:', error);
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Auth check failed'
      };
    }
  }

  /**
   * Clear invalid session data
   */
  private async clearInvalidSession(): Promise<void> {
    await Promise.all([
      this.tokenManager.clear(),
      this.cookieManager.clearAuthCookie()
    ]);
  }

  /**
   * Check if error is a 401 Unauthorized
   */
  private is401Error(error: any): boolean {
    return error?.status === 401 || 
           error?.message?.includes('401') ||
           error?.message?.includes('Unauthorized');
  }
}