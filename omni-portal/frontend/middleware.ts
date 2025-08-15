import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Safe debug logging without global object manipulation
let lastDebugTime = 0;
const DEBUG_INTERVAL = 5000; // 5 seconds

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle Tesseract .needs-setup file (not meant to be served)
  if (pathname === '/tesseract/.needs-setup') {
    return new NextResponse(null, { status: 204 });
  }

  // Handle CORS for API routes
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    
    // Fixed CORS to match actual development port  
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3000');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-TOKEN');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  }

  // Enhanced auth check for protected routes
  const authCookie = request.cookies.get('auth_token');
  const sessionCookie = request.cookies.get('omni_onboarding_portal_session');
  const laravelSession = request.cookies.get('austa_health_portal_session');
  const sanctumToken = request.cookies.get('XSRF-TOKEN');
  const authenticatedCookie = request.cookies.get('authenticated');
  
  // Check authentication - any of these cookies indicate authentication
  const isAuthenticated = !!(authCookie || sessionCookie || laravelSession || sanctumToken || authenticatedCookie);
  
  // Safe debug logging without global object manipulation
  const now = Date.now();
  if ((pathname === '/home' || pathname === '/login') && (now - lastDebugTime > DEBUG_INTERVAL)) {
    lastDebugTime = now;
    console.log(`[MIDDLEWARE] Auth check for ${pathname}:`, {
      hasAuthToken: !!authCookie,
      hasSessionCookie: !!sessionCookie,
      hasLaravelSession: !!laravelSession,
      hasSanctumToken: !!sanctumToken,
      isAuthenticated
    });
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/register', 
    '/forgot-password',
    '/callback',
    '/api',
    '/_next',
    '/favicon.ico',
    '/sw.js',
    '/manifest.json',
    '/icons',
    '/tesseract'
  ];

  // Protected onboarding routes (require authentication but allow partial completion)
  const protectedRoutes = [
    '/home',
    '/profile',
    '/welcome',
    '/company-info', 
    '/health-questionnaire',
    '/document-upload',
    '/interview-schedule',
    '/telemedicine-schedule',
    '/completion'
  ];

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // For protected routes, require authentication
  if (isProtectedRoute && !isAuthenticated) {
    // Prevent redirect loop - check if we're already being redirected
    const referer = request.headers.get('referer');
    if (referer && referer.includes('/login')) {
      console.log('[MIDDLEWARE] Preventing redirect loop - already from login');
      return NextResponse.next();
    }
    
    // Only log redirects for debugging, avoid spam
    if (now - lastDebugTime > DEBUG_INTERVAL) {
      console.log(`[MIDDLEWARE] Redirecting ${pathname} to login - no auth cookies found`);
    }
    
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For all other routes not explicitly public, allow access (catch-all for admin, etc.)
  if (!isPublicRoute && !isProtectedRoute) {
    // These routes will handle their own authentication at the component level
    return NextResponse.next();
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

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