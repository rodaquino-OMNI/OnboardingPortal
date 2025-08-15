/**
 * LogoutUseCase - Orchestrates the logout flow
 * Ensures complete cleanup of authentication state
 */

import { TokenManager } from '../domain/TokenManager';
import { AuthApiClient } from '../infrastructure/AuthApiClient';
import { CookieManager } from '../infrastructure/CookieManager';
import { AuthStorage } from '../infrastructure/AuthStorage';

export interface LogoutResult {
  success: boolean;
  error?: string;
}

export class LogoutUseCase {
  constructor(
    private tokenManager: TokenManager,
    private apiClient: AuthApiClient,
    private cookieManager: CookieManager,
    private authStorage: AuthStorage
  ) {}

  /**
   * Execute logout flow
   */
  async execute(): Promise<LogoutResult> {
    try {
      // 1. Call logout API (ignore errors - we're logging out anyway)
      try {
        await this.apiClient.logout();
      } catch (error) {
        console.warn('[LogoutUseCase] API logout failed, continuing cleanup:', error);
      }

      // 2. Clear token
      await this.tokenManager.clear();

      // 3. Clear authentication cookie
      await this.cookieManager.clearAuthCookie();

      // 4. Clear all auth-related storage
      await this.authStorage.clearAll();

      return { success: true };

    } catch (error) {
      console.error('[LogoutUseCase] Logout cleanup failed:', error);
      
      // Even if cleanup partially fails, consider logout successful
      // to prevent user from being stuck in authenticated state
      return {
        success: true,
        error: 'Partial logout - some cleanup failed'
      };
    }
  }
}