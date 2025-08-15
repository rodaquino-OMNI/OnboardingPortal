/**
 * AuthStorage - Unified storage abstraction for authentication data
 * Manages localStorage, sessionStorage, and cookies through a single interface
 */

import { TokenStorage } from '../domain/TokenManager';

export class LocalStorageStrategy implements TokenStorage {
  private readonly key = 'auth_token';

  async store(token: string): Promise<void> {
    try {
      // Handle quota exceeded errors
      if (localStorage.length > 100) {
        localStorage.clear();
      }
      localStorage.setItem(this.key, token);
    } catch (error) {
      console.warn('[LocalStorageStrategy] Storage failed:', error);
      // Try clearing and retrying
      try {
        localStorage.clear();
        localStorage.setItem(this.key, token);
      } catch (retryError) {
        throw new Error('Failed to store in localStorage');
      }
    }
  }

  async retrieve(): Promise<string | null> {
    try {
      return localStorage.getItem(this.key);
    } catch (error) {
      console.warn('[LocalStorageStrategy] Retrieval failed:', error);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.key);
      localStorage.removeItem('auth_user');
    } catch (error) {
      console.warn('[LocalStorageStrategy] Clear failed:', error);
    }
  }
}

export class SessionStorageStrategy implements TokenStorage {
  private readonly key = 'auth_token';

  async store(token: string): Promise<void> {
    try {
      sessionStorage.setItem(this.key, token);
    } catch (error) {
      throw new Error('Failed to store in sessionStorage');
    }
  }

  async retrieve(): Promise<string | null> {
    try {
      return sessionStorage.getItem(this.key);
    } catch (error) {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      sessionStorage.removeItem(this.key);
    } catch (error) {
      console.warn('[SessionStorageStrategy] Clear failed:', error);
    }
  }
}

export class AuthStorage {
  private strategies = {
    local: new LocalStorageStrategy(),
    session: new SessionStorageStrategy()
  };

  /**
   * Store data using specified strategy
   */
  async store(key: string, value: any, strategy: 'local' | 'session' = 'local'): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    await this.strategies[strategy].store(data);
  }

  /**
   * Retrieve data using specified strategy
   */
  async retrieve(key: string, strategy: 'local' | 'session' = 'local'): Promise<any> {
    const data = await this.strategies[strategy].retrieve();
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return data; // Return as string if not valid JSON
    }
  }

  /**
   * Clear all auth-related storage
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.strategies.local.clear(),
      this.strategies.session.clear()
    ]);
  }

  /**
   * Get default token storage strategy
   */
  getDefaultTokenStorage(): TokenStorage {
    return this.strategies.local;
  }
}