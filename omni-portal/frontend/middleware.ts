import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSessionToken, validateCookieIntegrity } from './lib/auth-validation';

export function middleware(request: NextRequest) {
  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    
    // Use environment variable for CORS origin
    const allowedOrigin = process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || 'http://localhost:3000';
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN, X-CSRF-TOKEN');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  }

  // Enhanced auth check for protected routes
  const authCookie = request.cookies.get('auth_token');
  const sessionCookie = request.cookies.get('omni_onboarding_portal_session');
  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/callback',
    '/api',
    '/_next',
    '/favicon.ico'
  ];

  // Semi-protected onboarding routes - require basic auth but not full completion
  const onboardingRoutes = [
    '/health-questionnaire',
    '/document-upload',
    '/interview-schedule',
    '/telemedicine-schedule',
    '/company-info',
    '/welcome',
    '/completion'
  ];

  // Check if the current path is public or onboarding
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  const isOnboardingRoute = onboardingRoutes.some(route => pathname.startsWith(route));
  
  // SECURE: Properly validate authentication tokens
  // This prevents authentication bypass with arbitrary strings
  const isAuthenticated = 
    (authCookie && validateCookieIntegrity(authCookie.value) && validateSessionToken(authCookie.value)) ||
    (sessionCookie && validateCookieIntegrity(sessionCookie.value) && validateSessionToken(sessionCookie.value));

  // Handle routing based on authentication and route type
  if (!isPublicRoute && !isAuthenticated) {
    // For onboarding routes, redirect to login with specific onboarding redirect
    if (isOnboardingRoute) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('flow', 'onboarding');
      return NextResponse.redirect(loginUrl);
    }
    
    // For other protected routes, redirect to login normally
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and trying to access onboarding routes, allow access
  // This enables users to complete their onboarding process even after login

  // Add security headers to all responses
  const response = NextResponse.next();
  
  // Comprehensive security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:8000 http://localhost:8080 http://localhost:8081 ws://localhost:8080 ws://localhost:8081",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  response.headers.set('Content-Security-Policy', cspHeader);
  
  // Strict Transport Security (for HTTPS environments)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public|sw.js|manifest.json).*)',
  ],
};