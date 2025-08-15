/**
 * Dependency Injection Container for Authentication Module
 * Wires together all auth components
 */

import { AuthService } from './domain/AuthService';
import { TokenManager } from './domain/TokenManager';
import { LoginUseCase } from './application/LoginUseCase';
import { LogoutUseCase } from './application/LogoutUseCase';
import { CheckAuthUseCase } from './application/CheckAuthUseCase';
import { AuthApiClient } from './infrastructure/AuthApiClient';
import { CookieManager } from './infrastructure/CookieManager';
import { AuthStorage } from './infrastructure/AuthStorage';

class AuthContainer {
  private authService: AuthService | null = null;
  private tokenManager: TokenManager | null = null;
  private apiClient: AuthApiClient | null = null;
  private cookieManager: CookieManager | null = null;
  private authStorage: AuthStorage | null = null;
  
  private loginUseCase: LoginUseCase | null = null;
  private logoutUseCase: LogoutUseCase | null = null;
  private checkAuthUseCase: CheckAuthUseCase | null = null;

  // Domain services
  getAuthService(): AuthService {
    if (!this.authService) {
      this.authService = new AuthService();
    }
    return this.authService;
  }

  getTokenManager(): TokenManager {
    if (!this.tokenManager) {
      const storage = this.getAuthStorage().getDefaultTokenStorage();
      this.tokenManager = new TokenManager(storage);
    }
    return this.tokenManager;
  }

  // Infrastructure services
  getApiClient(): AuthApiClient {
    if (!this.apiClient) {
      this.apiClient = new AuthApiClient();
    }
    return this.apiClient;
  }

  getCookieManager(): CookieManager {
    if (!this.cookieManager) {
      this.cookieManager = new CookieManager();
    }
    return this.cookieManager;
  }

  getAuthStorage(): AuthStorage {
    if (!this.authStorage) {
      this.authStorage = new AuthStorage();
    }
    return this.authStorage;
  }

  // Use cases
  getLoginUseCase(): LoginUseCase {
    if (!this.loginUseCase) {
      this.loginUseCase = new LoginUseCase(
        this.getAuthService(),
        this.getTokenManager(),
        this.getApiClient(),
        this.getCookieManager()
      );
    }
    return this.loginUseCase;
  }

  getLogoutUseCase(): LogoutUseCase {
    if (!this.logoutUseCase) {
      this.logoutUseCase = new LogoutUseCase(
        this.getTokenManager(),
        this.getApiClient(),
        this.getCookieManager(),
        this.getAuthStorage()
      );
    }
    return this.logoutUseCase;
  }

  getCheckAuthUseCase(): CheckAuthUseCase {
    if (!this.checkAuthUseCase) {
      this.checkAuthUseCase = new CheckAuthUseCase(
        this.getAuthService(),
        this.getTokenManager(),
        this.getApiClient(),
        this.getCookieManager()
      );
    }
    return this.checkAuthUseCase;
  }

  // Reset container (useful for testing)
  reset(): void {
    this.authService = null;
    this.tokenManager = null;
    this.apiClient = null;
    this.cookieManager = null;
    this.authStorage = null;
    this.loginUseCase = null;
    this.logoutUseCase = null;
    this.checkAuthUseCase = null;
  }
}

// Export singleton instance
export const authContainer = new AuthContainer();