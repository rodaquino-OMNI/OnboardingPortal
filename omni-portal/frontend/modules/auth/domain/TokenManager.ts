/**
 * TokenManager - Handles token storage and retrieval
 * Abstracted from specific storage mechanism
 */

export interface TokenStorage {
  store(token: string): Promise<void>;
  retrieve(): Promise<string | null>;
  clear(): Promise<void>;
}

export class TokenManager {
  private readonly TOKEN_KEY = 'auth_token';
  private storage: TokenStorage;

  constructor(storage: TokenStorage) {
    this.storage = storage;
  }

  /**
   * Store authentication token
   */
  async store(token: string): Promise<void> {
    if (!token) {
      throw new Error('Token cannot be empty');
    }

    try {
      await this.storage.store(token);
    } catch (error) {
      console.error('[TokenManager] Failed to store token:', error);
      throw new Error('Failed to store authentication token');
    }
  }

  /**
   * Retrieve authentication token
   */
  async retrieve(): Promise<string | null> {
    try {
      return await this.storage.retrieve();
    } catch (error) {
      console.error('[TokenManager] Failed to retrieve token:', error);
      return null;
    }
  }

  /**
   * Clear authentication token
   */
  async clear(): Promise<void> {
    try {
      await this.storage.clear();
    } catch (error) {
      console.error('[TokenManager] Failed to clear token:', error);
      throw new Error('Failed to clear authentication token');
    }
  }

  /**
   * Check if token exists
   */
  async exists(): Promise<boolean> {
    const token = await this.retrieve();
    return token !== null && token !== '';
  }
}