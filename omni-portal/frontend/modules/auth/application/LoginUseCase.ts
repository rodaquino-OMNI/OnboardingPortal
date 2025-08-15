/**
 * LoginUseCase - Orchestrates the login flow
 * Coordinates between domain, infrastructure, and presentation layers
 */

import { AuthService } from '../domain/AuthService';
import { TokenManager } from '../domain/TokenManager';
import { AuthApiClient } from '../infrastructure/AuthApiClient';
import { CookieManager } from '../infrastructure/CookieManager';
import type { LoginData } from '@/lib/schemas/auth';
import type { AuthResponse } from '@/lib/api/auth';

export interface LoginResult {
  success: boolean;
  user?: AuthResponse['user'];
  error?: string;
  requires2FA?: boolean;
}

export class LoginUseCase {
  constructor(
    private authService: AuthService,
    private tokenManager: TokenManager,
    private apiClient: AuthApiClient,
    private cookieManager: CookieManager
  ) {}

  /**
   * Execute login flow
   */
  async execute(data: LoginData): Promise<LoginResult> {
    try {
      // 1. Validate credentials
      const validation = this.authService.validateCredentials(data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // 2. Call API
      const response = await this.apiClient.login(data);

      // 3. Store token
      if (response.token) {
        await this.tokenManager.store(response.token);
      }

      // 4. Set authentication cookie
      await this.cookieManager.setAuthCookie(true);

      // 5. Return success
      return {
        success: true,
        user: response.user,
        requires2FA: false
      };

    } catch (error) {
      console.error('[LoginUseCase] Login failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
        requires2FA: false
      };
    }
  }

  /**
   * Cancel any pending login requests
   */
  cancel(): void {
    this.apiClient.cancelPendingRequests();
  }
}