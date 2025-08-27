import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

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
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3002');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-TOKEN');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  }

  // Enhanced auth check for protected routes
  const authToken = request.cookies.get('auth_token');
  const sessionCookie = request.cookies.get('omni_onboarding_portal_session');
  const laravelSession = request.cookies.get('austa_health_portal_session');
  const sanctumToken = request.cookies.get('XSRF-TOKEN');
  const authenticatedCookie = request.cookies.get('authenticated');
  
  // Check authentication - multiple indicators for robust detection
  const isAuthenticated = !!(authToken?.value || sessionCookie?.value || laravelSession?.value || sanctumToken?.value || authenticatedCookie?.value === 'true');
  
  // Safe debug logging without global object manipulation
  const now = Date.now();
  if ((pathname === '/home' || pathname === '/login') && (now - lastDebugTime > DEBUG_INTERVAL)) {
    lastDebugTime = now;
    logger.debug('Middleware auth check', {
      pathname,
      hasAuthToken: !!authToken,
      hasSessionCookie: !!sessionCookie,
      hasLaravelSession: !!laravelSession,
      hasSanctumToken: !!sanctumToken,
      isAuthenticated
    }, 'Middleware');
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

  // Protected routes (require full authentication)
  const protectedRoutes = [
    '/home',
    '/profile'
  ];

  // Onboarding routes (accessible during registration flow)
  const onboardingRoutes = [
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
  const isOnboardingRoute = onboardingRoutes.some(route => pathname.startsWith(route));

  // For protected routes, require authentication
  if (isProtectedRoute && !isAuthenticated) {
    // TECHNICAL EXCELLENCE FIX: Skip RSC requests to prevent client/server mismatch
    const isRSCRequest = request.headers.get('rsc') === '1' || 
                        request.headers.get('next-router-state-tree') || 
                        request.headers.get('next-router-prefetch');
    
    if (isRSCRequest) {
      // Return empty response for RSC requests when not authenticated
      return new NextResponse(null, { status: 401 });
    }
    // Enhanced redirect loop prevention
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');
    
    // Check for redirect loops
    if (referer && (referer.includes('/login') || referer.includes('auth'))) {
      logger.warn('Preventing redirect loop - already from auth page', { referer }, 'Middleware');
      return NextResponse.next();
    }
    
    // Check for repeated requests from same source
    const redirectCount = request.headers.get('x-redirect-count');
    if (redirectCount && parseInt(redirectCount) > 3) {
      logger.warn('Preventing redirect loop - too many redirects', { redirectCount }, 'Middleware');
      return NextResponse.next();
    }
    
    // Only log redirects for debugging, avoid spam
    if (now - lastDebugTime > DEBUG_INTERVAL) {
      logger.info('Redirecting to login - no auth cookies found', { pathname }, 'Middleware');
    }
    
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    
    // Add redirect count header to track loops
    const response = NextResponse.redirect(loginUrl);
    response.headers.set('x-redirect-count', String((parseInt(redirectCount || '0') + 1)));
    return response;
  }

  // For onboarding routes, check authentication state and session
  if (isOnboardingRoute) {
    // TECHNICAL EXCELLENCE FIX: Skip RSC request redirects to prevent client/server mismatch
    const isRSCRequest = request.headers.get('rsc') === '1' || 
                        request.headers.get('next-router-state-tree') || 
                        request.headers.get('next-router-prefetch');
    
    if (isRSCRequest) {
      // Allow RSC requests to proceed without redirect to prevent fallback to browser navigation
      return NextResponse.next();
    }
    
    // Check if there's any indication of user being in onboarding flow
    const onboardingSession = request.cookies.get('onboarding_session');
    const hasBasicAuth = request.cookies.get('basic_auth');
    const hasOnboardingToken = request.cookies.get('onboarding_token');
    
    // Allow access if user is authenticated OR has onboarding session
    const hasOnboardingAccess = isAuthenticated || onboardingSession || hasBasicAuth || hasOnboardingToken;
    
    if (!hasOnboardingAccess) {
      // Check for demo access or direct requests to welcome page
      const referer = request.headers.get('referer');
      const userAgent = request.headers.get('user-agent');
      
      // Allow direct access to welcome page for new users
      if (pathname === '/welcome' && (!referer || userAgent?.includes('curl'))) {
        logger.info('Allowing direct access to welcome page', { referer, userAgent: userAgent?.substring(0, 50) }, 'Middleware');
        
        // Set temporary onboarding session for new users
        const response = NextResponse.next();
        response.cookies.set('onboarding_session', 'welcome_access', {
          path: '/',
          maxAge: 60 * 60, // 1 hour
          httpOnly: false,
          secure: false,
          sameSite: 'lax'
        });
        return response;
      }
      
      // For other onboarding routes without proper session, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // For all other routes not explicitly public, check basic auth
  if (!isPublicRoute && !isProtectedRoute && !isOnboardingRoute) {
    // Routes like /admin, /dashboard need some form of authentication
    if (!isAuthenticated && pathname.startsWith('/admin')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Other routes will handle their own authentication at the component level
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
  // Ensure middleware runs on Node.js runtime to avoid Edge Runtime issues
  runtime: 'nodejs'
};