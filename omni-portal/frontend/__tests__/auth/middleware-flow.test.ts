/**
 * Middleware Flow Tests
 * Tests for Next.js middleware authentication handling
 */

import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// Mock NextResponse
const mockNextResponse = {
  next: jest.fn(() => ({
    headers: {
      set: jest.fn(),
    },
  })),
  redirect: jest.fn((url) => ({
    url: url.toString(),
    status: 302,
    headers: {
      set: jest.fn(),
    },
  })),
};

jest.mock('next/server', () => ({
  NextResponse: mockNextResponse,
}));

describe('Middleware Authentication Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cookie Validation Logic', () => {
    test('should accept valid auth_token cookie', () => {
      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=valid-token-12345678901; path=/',
        },
      });

      const response = middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('should accept valid session cookie', () => {
      const request = new NextRequest('http://localhost:3000/profile', {
        headers: {
          cookie: 'omni_onboarding_portal_session=session-token-12345678901; path=/',
        },
      });

      const response = middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('should reject short/invalid cookies', () => {
      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=short; path=/',
        },
      });

      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: '?redirect=%2Fdashboard',
        })
      );
    });

    test('should handle missing cookies', () => {
      const request = new NextRequest('http://localhost:3000/dashboard');

      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: '?redirect=%2Fdashboard',
        })
      );
    });

    test('should handle empty cookie values', () => {
      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=; path=/',
        },
      });

      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
        })
      );
    });
  });

  describe('Public Route Handling', () => {
    const publicRoutes = [
      '/',
      '/login',
      '/register', 
      '/forgot-password',
      '/callback',
      '/api/auth/login',
      '/_next/static/chunk.js',
      '/favicon.ico',
    ];

    publicRoutes.forEach(route => {
      test(`should allow access to public route: ${route}`, () => {
        const request = new NextRequest(`http://localhost:3000${route}`);

        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });
    });
  });

  describe('Protected Route Handling', () => {
    const protectedRoutes = [
      '/dashboard',
      '/profile',
      '/health-questionnaire',
      '/document-upload',
      '/lgpd',
      '/rewards',
    ];

    protectedRoutes.forEach(route => {
      test(`should redirect unauthenticated users from: ${route}`, () => {
        const request = new NextRequest(`http://localhost:3000${route}`);

        const response = middleware(request);

        expect(mockNextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/login',
            search: `?redirect=${encodeURIComponent(route)}`,
          })
        );
      });

      test(`should allow authenticated users to access: ${route}`, () => {
        const request = new NextRequest(`http://localhost:3000${route}`, {
          headers: {
            cookie: 'auth_token=valid-token-12345678901; path=/',
          },
        });

        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });
    });
  });

  describe('CORS Handling for API Routes', () => {
    test('should set CORS headers for API routes', () => {
      const mockResponse = {
        headers: {
          set: jest.fn(),
        },
      };
      mockNextResponse.next.mockReturnValue(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/auth/login');

      middleware(request);

      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'http://localhost:3000'
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-CSRF-TOKEN'
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        'true'
      );
    });
  });

  describe('Security Headers', () => {
    test('should set security headers on all responses', () => {
      const mockResponse = {
        headers: {
          set: jest.fn(),
        },
      };
      mockNextResponse.next.mockReturnValue(mockResponse);

      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=valid-token-12345678901; path=/',
        },
      });

      middleware(request);

      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'X-Frame-Options',
        'DENY'
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'X-XSS-Protection',
        '1; mode=block'
      );
    });
  });

  describe('Redirect Parameter Handling', () => {
    test('should preserve redirect parameter in login URL', () => {
      const request = new NextRequest('http://localhost:3000/dashboard/settings');

      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '?redirect=%2Fdashboard%2Fsettings',
        })
      );
    });

    test('should handle complex URLs with query parameters', () => {
      const request = new NextRequest('http://localhost:3000/dashboard?tab=profile&id=123');

      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '?redirect=%2Fdashboard%3Ftab%3Dprofile%26id%3D123',
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed cookies gracefully', () => {
      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=malformed|||cookie|||data; path=/',
        },
      });

      const response = middleware(request);

      // Should still redirect to login for malformed cookies
      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
        })
      );
    });

    test('should handle very long URLs', () => {
      const longPath = '/dashboard/' + 'a'.repeat(1000);
      const request = new NextRequest(`http://localhost:3000${longPath}`);

      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: `?redirect=${encodeURIComponent(longPath)}`,
        })
      );
    });

    test('should handle URLs with special characters', () => {
      const specialPath = '/dashboard/user@domain.com/profile';
      const request = new NextRequest(`http://localhost:3000${specialPath}`);

      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: `?redirect=${encodeURIComponent(specialPath)}`,
        })
      );
    });
  });
});