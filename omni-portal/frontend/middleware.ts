import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3000');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-TOKEN');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  }

  // Enhanced auth check for protected routes
  // Check multiple possible cookie names
  const authCookie = request.cookies.get('auth_token');
  const sessionCookie = request.cookies.get('omni_onboarding_portal_session');
  const laravelSession = request.cookies.get('austa_health_portal_session');
  const sanctumToken = request.cookies.get('XSRF-TOKEN');
  const authenticatedCookie = request.cookies.get('authenticated');
  const pathname = request.nextUrl.pathname;
  
  // Check authentication - any of these cookies indicate authentication
  const isAuthenticated = !!(authCookie || sessionCookie || laravelSession || sanctumToken || authenticatedCookie);
  
  // Debug logging to see what cookies are available - RATE LIMITED to prevent spam
  const debugKey = `middleware_debug_${pathname}`;
  const now = Date.now();
  const lastLog = global[debugKey as any] || 0;
  
  if ((pathname === '/home' || pathname === '/login') && (now - lastLog > 5000)) { // Only log once every 5 seconds
    global[debugKey as any] = now;
    console.log(`[MIDDLEWARE] Checking cookies for ${pathname}:`, {
      authCookie: authCookie?.value?.substring(0, 20) + '...' || 'none',
      sessionCookie: !!sessionCookie,
      laravelSession: !!laravelSession,
      sanctumToken: !!sanctumToken,
      authenticatedCookie: !!authenticatedCookie,
      allCookies: request.cookies.getAll().map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })),
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

  // Onboarding routes (temporarily public for testing)
  const onboardingRoutes = [
    '/welcome',
    '/company-info',
    '/health-questionnaire',
    '/document-upload',
    '/interview-schedule',
    '/telemedicine-schedule',
    '/completion',
    '/home' // TEMPORARY: Make home public to prevent redirect loop
  ];

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) ||
                        onboardingRoutes.some(route => pathname.startsWith(route)) ||
                        pathname === '/';

  // If it's a protected route and user is not authenticated, redirect to login
  if (!isPublicRoute && !isAuthenticated) {
    // Prevent redirect loop - check if we're already being redirected
    const referer = request.headers.get('referer');
    if (referer && referer.includes('/login')) {
      console.log('Preventing redirect loop - already coming from login');
      return NextResponse.next();
    }
    
    console.log('Redirecting to login - no auth cookies found for:', pathname, {
      authCookie: !!authCookie,
      sessionCookie: !!sessionCookie,
      laravelSession: !!laravelSession,
      sanctumToken: !!sanctumToken,
      authenticatedCookie: !!authenticatedCookie,
      allCookies: request.cookies.getAll().map(c => c.name)
    });
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
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