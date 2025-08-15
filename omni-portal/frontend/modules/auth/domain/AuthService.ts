/**
 * AuthService - Pure business logic for authentication
 * No external dependencies, no side effects
 */

import type { LoginData, RegisterData } from '@/lib/schemas/auth';

export interface AuthValidationResult {
  valid: boolean;
  error?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  expired?: boolean;
  error?: string;
}

export class AuthService {
  /**
   * Validate login credentials
   */
  validateCredentials(data: LoginData): AuthValidationResult {
    if (!data.login || !data.password) {
      return { valid: false, error: 'Login and password are required' };
    }

    if (data.password.length < 6) {
      return { valid: false, error: 'Password must be at least 6 characters' };
    }

    return { valid: true };
  }

  /**
   * Validate registration data
   */
  validateRegistration(data: RegisterData): AuthValidationResult {
    if (!data.email || !data.password) {
      return { valid: false, error: 'Email and password are required' };
    }

    if (!this.isValidEmail(data.email)) {
      return { valid: false, error: 'Invalid email format' };
    }

    if (data.password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (!data.fullName || data.fullName.length < 2) {
      return { valid: false, error: 'Full name must be at least 2 characters' };
    }

    return { valid: true };
  }

  /**
   * Check if session is valid
   */
  validateSession(token: string | null): SessionValidationResult {
    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    // In real implementation, would validate JWT expiry
    return { valid: true };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}