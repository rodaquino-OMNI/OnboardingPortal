/**
 * AuthApiClient - Handles all authentication-related API calls
 * Infrastructure layer - communicates with external API
 */

import type { LoginData, RegisterData } from '@/lib/schemas/auth';
import type { AuthResponse } from '@/lib/api/auth';

export class AuthApiClient {
  private readonly baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  private abortController: AbortController | null = null;

  /**
   * Login API call
   */
  async login(data: LoginData): Promise<AuthResponse> {
    this.abortController = new AbortController();

    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
      signal: this.abortController.signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Login failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Register API call
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    this.abortController = new AbortController();

    const response = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
      signal: this.abortController.signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Registration failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Logout API call
   */
  async logout(): Promise<void> {
    this.abortController = new AbortController();

    const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      signal: this.abortController.signal
    });

    if (!response.ok && response.status !== 401) {
      console.warn('Logout API call failed:', response.status);
    }
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<AuthResponse['user']> {
    this.abortController = new AbortController();

    const response = await fetch(`${this.baseUrl}/api/auth/profile`, {
      method: 'GET',
      credentials: 'include',
      signal: this.abortController.signal
    });

    if (!response.ok) {
      const error = { status: response.status, message: `HTTP ${response.status}` };
      throw error;
    }

    return response.json();
  }

  /**
   * Get social login redirect URL
   */
  async getSocialRedirect(provider: 'google' | 'facebook' | 'instagram'): Promise<{ url: string }> {
    const response = await fetch(`${this.baseUrl}/api/auth/social/${provider}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to get ${provider} redirect URL`);
    }

    return response.json();
  }

  /**
   * Cancel any pending requests
   */
  cancelPendingRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}