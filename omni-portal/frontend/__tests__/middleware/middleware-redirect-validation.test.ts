/**
 * Middleware Redirect Pattern Validation Tests
 * Comprehensive validation of all redirect scenarios to prevent infinite loops
 */

import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// Mock NextResponse with comprehensive tracking
const mockNextResponse = {
  next: jest.fn(() => ({
    headers: { set: jest.fn() },
  })),
  redirect: jest.fn((url) => {
    const urlObj = typeof url === 'string' ? new URL(url) : url;
    return {
      url: urlObj.toString(),
      status: 302,
      headers: { set: jest.fn() },
      redirected: true,
      pathname: urlObj.pathname,
      search: urlObj.search,
    };
  }),
};

jest.mock('next/server', () => ({
  NextResponse: mockNextResponse,
}));

// Mock auth validation with controllable returns
const mockValidateSessionToken = jest.fn();
const mockValidateCookieIntegrity = jest.fn();

jest.mock('@/lib/auth-validation', () => ({
  validateSessionToken: mockValidateSessionToken,
  validateCookieIntegrity: mockValidateCookieIntegrity,
}));

describe('Middleware Redirect Pattern Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Critical Redirect Loop Prevention', () => {
    test('Login page should NEVER redirect to login', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/login');
      middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('Register page should NEVER redirect to login', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/register');
      middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('Public routes should NEVER redirect when unauthenticated', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const publicRoutes = ['/', '/callback', '/forgot-password'];
      
      publicRoutes.forEach(route => {
        jest.clearAllMocks();
        const request = new NextRequest(`http://localhost:3000${route}`);
        middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });
    });
  });

  describe('Protected Route Redirects', () => {
    test('Protected routes should redirect unauthenticated users to login', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const protectedRoutes = ['/dashboard', '/profile', '/rewards'];

      protectedRoutes.forEach(route => {
        jest.clearAllMocks();
        const request = new NextRequest(`http://localhost:3000${route}`);
        middleware(request);

        expect(mockNextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/login',
            search: `?redirect=${encodeURIComponent(route)}`,
          })
        );
      });
    });

    test('Protected routes should allow authenticated users', () => {
      mockValidateCookieIntegrity.mockReturnValue(true);
      mockValidateSessionToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=valid-token-' + 'a'.repeat(40) + '; path=/',
        },
      });

      middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });
  });

  describe('Onboarding Flow Redirects', () => {
    test('Onboarding routes should redirect with flow=onboarding parameter', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const onboardingRoutes = [
        '/health-questionnaire',
        '/document-upload',
        '/interview-schedule'
      ];

      onboardingRoutes.forEach(route => {
        jest.clearAllMocks();
        const request = new NextRequest(`http://localhost:3000${route}`);
        middleware(request);

        expect(mockNextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/login',
            search: `?redirect=${encodeURIComponent(route)}&flow=onboarding`,
          })
        );
      });
    });

    test('Onboarding routes should allow authenticated users (for completion)', () => {
      mockValidateCookieIntegrity.mockReturnValue(true);
      mockValidateSessionToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/health-questionnaire', {
        headers: {
          cookie: 'auth_token=valid-token-' + 'a'.repeat(40) + '; path=/',
        },
      });

      middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });
  });

  describe('Query Parameter Preservation', () => {
    test('Should preserve complex query parameters in redirects', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const complexUrl = '/dashboard?tab=profile&id=123&filter=active&sort=desc';
      const request = new NextRequest(`http://localhost:3000${complexUrl}`);
      middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: `?redirect=${encodeURIComponent(complexUrl)}`,
        })
      );
    });

    test('Should handle URLs with special characters', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const specialUrl = '/dashboard/user@example.com/profile';
      const request = new NextRequest(`http://localhost:3000${specialUrl}`);
      middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: `?redirect=${encodeURIComponent(specialUrl)}`,
        })
      );
    });
  });

  describe('Cookie Authentication States', () => {
    const testCases = [
      {
        name: 'Valid auth token should allow access',
        cookieIntegrity: true,
        sessionToken: true,
        cookie: 'auth_token=valid-token-' + 'a'.repeat(40),
        expectRedirect: false
      },
      {
        name: 'Valid session cookie should allow access',
        cookieIntegrity: true,
        sessionToken: true,
        cookie: 'omni_onboarding_portal_session=123|' + 'a'.repeat(40),
        expectRedirect: false
      },
      {
        name: 'Invalid short cookie should redirect',
        cookieIntegrity: false,
        sessionToken: false,
        cookie: 'auth_token=short',
        expectRedirect: true
      },
      {
        name: 'Empty cookie should redirect',
        cookieIntegrity: false,
        sessionToken: false,
        cookie: 'auth_token=',
        expectRedirect: true
      },
      {
        name: 'Cookie with integrity but invalid session should redirect',
        cookieIntegrity: true,
        sessionToken: false,
        cookie: 'auth_token=looks-valid-but-invalid-' + 'a'.repeat(40),
        expectRedirect: true
      }
    ];

    testCases.forEach(({ name, cookieIntegrity, sessionToken, cookie, expectRedirect }) => {
      test(name, () => {
        mockValidateCookieIntegrity.mockReturnValue(cookieIntegrity);
        mockValidateSessionToken.mockReturnValue(sessionToken);

        const request = new NextRequest('http://localhost:3000/dashboard', {
          headers: { cookie: `${cookie}; path=/` },
        });

        middleware(request);

        if (expectRedirect) {
          expect(mockNextResponse.redirect).toHaveBeenCalledWith(
            expect.objectContaining({
              pathname: '/login',
              search: '?redirect=%2Fdashboard',
            })
          );
        } else {
          expect(mockNextResponse.redirect).not.toHaveBeenCalled();
          expect(mockNextResponse.next).toHaveBeenCalled();
        }
      });
    });
  });

  describe('API Route Handling', () => {
    test('API routes should never redirect, only set CORS headers', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const apiRoutes = [
        '/api/auth/login',
        '/api/users/profile',
        '/api/health-risks',
        '/api/webhooks/callback'
      ];

      apiRoutes.forEach(route => {
        jest.clearAllMocks();
        const mockResponse = { headers: { set: jest.fn() } };
        mockNextResponse.next.mockReturnValue(mockResponse);

        const request = new NextRequest(`http://localhost:3000${route}`);
        middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
        expect(mockResponse.headers.set).toHaveBeenCalledWith(
          'Access-Control-Allow-Origin',
          'http://localhost:3000'
        );
      });
    });
  });

  describe('Edge Cases', () => {
    test('Very long URL paths should not break redirects', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const longPath = '/dashboard/' + 'a'.repeat(1000);
      const request = new NextRequest(`http://localhost:3000${longPath}`);
      middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: `?redirect=${encodeURIComponent(longPath)}`,
        })
      );
    });

    test('Multiple cookies should use first valid authentication', () => {
      mockValidateCookieIntegrity.mockReturnValueOnce(true);
      mockValidateSessionToken.mockReturnValueOnce(true);

      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=valid-' + 'a'.repeat(40) + '; omni_onboarding_portal_session=123|' + 'b'.repeat(40) + '; path=/',
        },
      });

      middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('No cookies on protected route should redirect', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/dashboard');
      middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: '?redirect=%2Fdashboard',
        })
      );
    });
  });
});