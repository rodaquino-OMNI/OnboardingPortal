/**
 * Comprehensive Middleware Redirect Pattern Tests
 * Tests ALL redirect scenarios to prevent infinite loops and ensure proper authentication flow
 */

import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// Enhanced mock for NextResponse with better tracking
const mockNextResponse = {
  next: jest.fn(() => ({
    headers: {
      set: jest.fn(),
    },
  })),
  redirect: jest.fn((url) => {
    const urlObj = typeof url === 'string' ? new URL(url) : url;
    return {
      url: urlObj.toString(),
      status: 302,
      headers: {
        set: jest.fn(),
      },
      redirected: true,
      pathname: urlObj.pathname,
      search: urlObj.search,
    };
  }),
};

jest.mock('next/server', () => ({
  NextResponse: mockNextResponse,
}));

// Mock auth validation functions to control authentication state
jest.mock('@/lib/auth-validation', () => ({
  validateSessionToken: jest.fn(),
  validateCookieIntegrity: jest.fn(),
}));

import { validateSessionToken, validateCookieIntegrity } from '@/lib/auth-validation';

describe('Comprehensive Middleware Redirect Pattern Tests', () => {
  let mockValidateSessionToken: jest.MockedFunction<typeof validateSessionToken>;
  let mockValidateCookieIntegrity: jest.MockedFunction<typeof validateCookieIntegrity>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateSessionToken = validateSessionToken as jest.MockedFunction<typeof validateSessionToken>;
    mockValidateCookieIntegrity = validateCookieIntegrity as jest.MockedFunction<typeof validateCookieIntegrity>;
  });

  describe('1. Unauthenticated Access to Protected Routes (Should Redirect to /login)', () => {
    const protectedRoutes = [
      '/dashboard',
      '/profile',
      '/home',
      '/rewards',
      '/lgpd',
      '/video-consultation',
      '/admin/dashboard',
      '/admin/health-risks',
      '/admin/health-risks/analytics',
    ];

    protectedRoutes.forEach(route => {
      test(`Unauthenticated access to ${route} should redirect to login`, () => {
        // Mock no authentication
        mockValidateCookieIntegrity.mockReturnValue(false);
        mockValidateSessionToken.mockReturnValue(false);

        const request = new NextRequest(`http://localhost:3000${route}`);
        const response = middleware(request);

        expect(mockNextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/login',
            search: `?redirect=${encodeURIComponent(route)}`,
          })
        );
        expect(mockNextResponse.next).not.toHaveBeenCalled();
      });

      test(`Unauthenticated access to ${route} with query params should preserve all parameters`, () => {
        mockValidateCookieIntegrity.mockReturnValue(false);
        mockValidateSessionToken.mockReturnValue(false);

        const routeWithParams = `${route}?tab=settings&id=123&filter=active`;
        const request = new NextRequest(`http://localhost:3000${routeWithParams}`);
        const response = middleware(request);

        expect(mockNextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/login',
            search: `?redirect=${encodeURIComponent(routeWithParams)}`,
          })
        );
      });
    });
  });

  describe('2. Authenticated Access to Protected Routes (Should Allow)', () => {
    const protectedRoutes = [
      '/dashboard',
      '/profile',
      '/home',
      '/rewards',
      '/lgpd',
      '/video-consultation',
      '/admin/dashboard',
    ];

    protectedRoutes.forEach(route => {
      test(`Authenticated access to ${route} with valid auth_token should allow`, () => {
        mockValidateCookieIntegrity.mockReturnValue(true);
        mockValidateSessionToken.mockReturnValue(true);

        const request = new NextRequest(`http://localhost:3000${route}`, {
          headers: {
            cookie: 'auth_token=valid-token-12345678901234567890123456789012; path=/',
          },
        });

        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });

      test(`Authenticated access to ${route} with valid session cookie should allow`, () => {
        mockValidateCookieIntegrity.mockReturnValue(true);
        mockValidateSessionToken.mockReturnValue(true);

        const request = new NextRequest(`http://localhost:3000${route}`, {
          headers: {
            cookie: 'omni_onboarding_portal_session=123|abcdef1234567890abcdef1234567890abcdef12; path=/',
          },
        });

        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });
    });
  });

  describe('3. Unauthenticated Access to Public Routes (Should Allow)', () => {
    const publicRoutes = [
      '/',
      '/login',
      '/register',
      '/forgot-password',
      '/callback',
      '/_next/static/css/app.css',
      '/_next/image/image.jpg',
      '/favicon.ico',
      '/api/health',
      '/api/auth/callback',
    ];

    publicRoutes.forEach(route => {
      test(`Unauthenticated access to public route ${route} should allow`, () => {
        mockValidateCookieIntegrity.mockReturnValue(false);
        mockValidateSessionToken.mockReturnValue(false);

        const request = new NextRequest(`http://localhost:3000${route}`);
        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });
    });
  });

  describe('4. Authenticated Access to Public Routes (Should Allow)', () => {
    const publicRoutes = [
      '/',
      '/login',
      '/register',
      '/forgot-password',
      '/callback',
    ];

    publicRoutes.forEach(route => {
      test(`Authenticated access to public route ${route} should allow`, () => {
        mockValidateCookieIntegrity.mockReturnValue(true);
        mockValidateSessionToken.mockReturnValue(true);

        const request = new NextRequest(`http://localhost:3000${route}`, {
          headers: {
            cookie: 'auth_token=valid-token-12345678901234567890123456789012; path=/',
          },
        });

        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });
    });
  });

  describe('5. Redirect with Query Parameters Preservation', () => {
    const testCases = [
      {
        route: '/dashboard',
        params: '?tab=profile',
        expected: '/dashboard?tab=profile'
      },
      {
        route: '/dashboard',
        params: '?tab=profile&id=123',
        expected: '/dashboard?tab=profile&id=123'
      },
      {
        route: '/dashboard',
        params: '?search=test%20query&page=2&sort=desc',
        expected: '/dashboard?search=test%20query&page=2&sort=desc'
      },
      {
        route: '/admin/health-risks',
        params: '?filter=high&status=active&date=2024-01-01',
        expected: '/admin/health-risks?filter=high&status=active&date=2024-01-01'
      },
    ];

    testCases.forEach(({ route, params, expected }) => {
      test(`Should preserve query parameters: ${params}`, () => {
        mockValidateCookieIntegrity.mockReturnValue(false);
        mockValidateSessionToken.mockReturnValue(false);

        const fullRoute = `${route}${params}`;
        const request = new NextRequest(`http://localhost:3000${fullRoute}`);
        const response = middleware(request);

        expect(mockNextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/login',
            search: `?redirect=${encodeURIComponent(expected)}`,
          })
        );
      });
    });
  });

  describe('6. Onboarding Flow Redirects with flow=onboarding Parameter', () => {
    const onboardingRoutes = [
      '/health-questionnaire',
      '/document-upload',
      '/interview-schedule',
      '/telemedicine-schedule',
      '/company-info',
      '/welcome',
      '/completion',
    ];

    onboardingRoutes.forEach(route => {
      test(`Unauthenticated access to onboarding route ${route} should redirect with flow=onboarding`, () => {
        mockValidateCookieIntegrity.mockReturnValue(false);
        mockValidateSessionToken.mockReturnValue(false);

        const request = new NextRequest(`http://localhost:3000${route}`);
        const response = middleware(request);

        expect(mockNextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/login',
            search: `?redirect=${encodeURIComponent(route)}&flow=onboarding`,
          })
        );
      });

      test(`Authenticated access to onboarding route ${route} should allow (for completion)`, () => {
        mockValidateCookieIntegrity.mockReturnValue(true);
        mockValidateSessionToken.mockReturnValue(true);

        const request = new NextRequest(`http://localhost:3000${route}`, {
          headers: {
            cookie: 'auth_token=valid-token-12345678901234567890123456789012; path=/',
          },
        });

        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });
    });
  });

  describe('7. Redirect Loops Prevention', () => {
    test('Should not redirect /login to /login', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/login');
      const response = middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('Should not redirect /register to /login', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/register');
      const response = middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('Should not redirect /callback to /login', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/callback');
      const response = middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('Should not redirect API routes to /login', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const apiRoutes = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/health',
        '/api/users/profile',
      ];

      apiRoutes.forEach(route => {
        jest.clearAllMocks();
        const request = new NextRequest(`http://localhost:3000${route}`);
        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
      });
    });
  });

  describe('8. Various Cookie States Testing', () => {
    describe('Valid Cookie States', () => {
      const validCookieTests = [
        {
          name: 'Valid Laravel Sanctum token',
          cookie: 'auth_token=123|abcdef1234567890abcdef1234567890abcdef12',
          cookieIntegrityResult: true,
          sessionTokenResult: true,
        },
        {
          name: 'Valid session token',
          cookie: 'omni_onboarding_portal_session=abcdef1234567890abcdef1234567890abcdef1234567890',
          cookieIntegrityResult: true,
          sessionTokenResult: true,
        },
        {
          name: 'Valid long session token',
          cookie: 'auth_token=' + 'a'.repeat(128),
          cookieIntegrityResult: true,
          sessionTokenResult: true,
        },
      ];

      validCookieTests.forEach(({ name, cookie, cookieIntegrityResult, sessionTokenResult }) => {
        test(`${name} should allow access to protected routes`, () => {
          mockValidateCookieIntegrity.mockReturnValue(cookieIntegrityResult);
          mockValidateSessionToken.mockReturnValue(sessionTokenResult);

          const request = new NextRequest('http://localhost:3000/dashboard', {
            headers: { cookie: `${cookie}; path=/` },
          });

          const response = middleware(request);

          expect(mockNextResponse.redirect).not.toHaveBeenCalled();
          expect(mockNextResponse.next).toHaveBeenCalled();
        });
      });
    });

    describe('Invalid Cookie States', () => {
      const invalidCookieTests = [
        {
          name: 'Too short cookie',
          cookie: 'auth_token=short',
          cookieIntegrityResult: false,
          sessionTokenResult: false,
        },
        {
          name: 'Empty cookie value',
          cookie: 'auth_token=',
          cookieIntegrityResult: false,
          sessionTokenResult: false,
        },
        {
          name: 'Cookie with XSS attempt',
          cookie: 'auth_token=<script>alert(1)</script>' + 'a'.repeat(32),
          cookieIntegrityResult: false,
          sessionTokenResult: false,
        },
        {
          name: 'Cookie with SQL injection attempt',
          cookie: 'auth_token=\'; DROP TABLE users; --' + 'a'.repeat(32),
          cookieIntegrityResult: false,
          sessionTokenResult: false,
        },
        {
          name: 'Cookie with null bytes',
          cookie: 'auth_token=valid\\x00token' + 'a'.repeat(32),
          cookieIntegrityResult: false,
          sessionTokenResult: false,
        },
      ];

      invalidCookieTests.forEach(({ name, cookie, cookieIntegrityResult, sessionTokenResult }) => {
        test(`${name} should redirect to login`, () => {
          mockValidateCookieIntegrity.mockReturnValue(cookieIntegrityResult);
          mockValidateSessionToken.mockReturnValue(sessionTokenResult);

          const request = new NextRequest('http://localhost:3000/dashboard', {
            headers: { cookie: `${cookie}; path=/` },
          });

          const response = middleware(request);

          expect(mockNextResponse.redirect).toHaveBeenCalledWith(
            expect.objectContaining({
              pathname: '/login',
              search: '?redirect=%2Fdashboard',
            })
          );
        });
      });
    });

    describe('Missing Cookie States', () => {
      test('No cookies should redirect to login for protected routes', () => {
        mockValidateCookieIntegrity.mockReturnValue(false);
        mockValidateSessionToken.mockReturnValue(false);

        const request = new NextRequest('http://localhost:3000/dashboard');
        const response = middleware(request);

        expect(mockNextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/login',
            search: '?redirect=%2Fdashboard',
          })
        );
      });

      test('Only unrelated cookies should redirect to login', () => {
        mockValidateCookieIntegrity.mockReturnValue(false);
        mockValidateSessionToken.mockReturnValue(false);

        const request = new NextRequest('http://localhost:3000/dashboard', {
          headers: {
            cookie: 'some_other_cookie=value; analytics_id=12345; path=/',
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
    });
  });

  describe('9. Comprehensive Test Matrix - Edge Cases', () => {
    test('Very long URL path should not break redirect', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const longPath = '/dashboard/' + 'a'.repeat(2000);
      const request = new NextRequest(`http://localhost:3000${longPath}`);
      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: `?redirect=${encodeURIComponent(longPath)}`,
        })
      );
    });

    test('URL with special characters should be properly encoded', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const specialPath = '/dashboard/user@domain.com/profile?search=hello world&id=123#section';
      const request = new NextRequest(`http://localhost:3000${specialPath}`);
      const response = middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/login',
          search: expect.stringContaining('redirect='),
        })
      );

      // Verify the redirect parameter is properly encoded
      const calls = (mockNextResponse.redirect as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const redirectUrl = lastCall[0];
      expect(redirectUrl.search).toContain(encodeURIComponent('/dashboard/user@domain.com/profile?search=hello world&id=123'));
    });

    test('Multiple authentication cookies should use first valid one', () => {
      mockValidateCookieIntegrity.mockReturnValueOnce(true);
      mockValidateSessionToken.mockReturnValueOnce(true);

      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=valid-token-12345678901234567890123456789012; omni_onboarding_portal_session=123|abcdef1234567890abcdef1234567890abcdef12; path=/',
        },
      });

      const response = middleware(request);

      expect(mockNextResponse.redirect).not.toHaveBeenCalled();
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    test('Partial auth state should still redirect', () => {
      // Cookie integrity passes but session token validation fails
      mockValidateCookieIntegrity.mockReturnValue(true);
      mockValidateSessionToken.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'auth_token=looks-valid-but-fails-verification-12345678901234567890; path=/',
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
  });

  describe('10. API Route CORS Handling (No Redirects)', () => {
    test('API routes should never redirect, only set CORS headers', () => {
      mockValidateCookieIntegrity.mockReturnValue(false);
      mockValidateSessionToken.mockReturnValue(false);

      const mockResponse = {
        headers: { set: jest.fn() },
      };
      mockNextResponse.next.mockReturnValue(mockResponse);

      const apiRoutes = [
        '/api/auth/login',
        '/api/users/profile',
        '/api/health-risks/data',
        '/api/webhooks/callback',
      ];

      apiRoutes.forEach(route => {
        jest.clearAllMocks();
        const request = new NextRequest(`http://localhost:3000${route}`);
        const response = middleware(request);

        expect(mockNextResponse.redirect).not.toHaveBeenCalled();
        expect(mockNextResponse.next).toHaveBeenCalled();
        expect(mockResponse.headers.set).toHaveBeenCalledWith(
          'Access-Control-Allow-Origin',
          'http://localhost:3000'
        );
      });
    });
  });
});