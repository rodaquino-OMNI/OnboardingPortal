// MSW v2 handlers for API mocking
const { http, HttpResponse } = require('msw');

// Auth endpoints
const authHandlers = [
  // Login endpoint
  http.post('http://localhost:8000/api/auth/login', async ({ request }) => {
    try {
      const body = await request.json();
      
      if (body.login === 'test@example.com' && body.password === 'password123') {
        return HttpResponse.json({
          success: true,
          user: { 
            id: 1, 
            name: 'Test User', 
            email: 'test@example.com',
            role: 'user'
          },
          token: 'mock-jwt-token-123'
        });
      }
      
      return HttpResponse.json(
        { 
          success: false, 
          error: 'Credenciais inválidas',
          message: 'Email ou senha incorretos'
        },
        { status: 401 }
      );
    } catch (error) {
      return HttpResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }
  }),

  // Register endpoint
  http.post('http://localhost:8000/api/auth/register', async ({ request }) => {
    try {
      const body = await request.json();
      
      return HttpResponse.json({
        success: true,
        user: {
          id: 2,
          name: body.name || 'New User',
          email: body.email,
          role: 'user'
        },
        token: 'mock-jwt-token-456'
      });
    } catch (error) {
      return HttpResponse.json(
        { success: false, error: 'Registration failed' },
        { status: 400 }
      );
    }
  }),

  // Social login endpoints
  http.post('http://localhost:8000/api/auth/social/google', async ({ request }) => {
    return HttpResponse.json({
      success: true,
      user: {
        id: 3,
        name: 'Google User',
        email: 'google@example.com',
        role: 'user',
        provider: 'google'
      },
      token: 'mock-google-token-789'
    });
  }),

  http.post('http://localhost:8000/api/auth/social/facebook', async ({ request }) => {
    return HttpResponse.json({
      success: true,
      user: {
        id: 4,
        name: 'Facebook User',
        email: 'facebook@example.com',
        role: 'user',
        provider: 'facebook'
      },
      token: 'mock-facebook-token-abc'
    });
  }),

  // User profile endpoint
  http.get('http://localhost:8000/api/user/profile', ({ request }) => {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      created_at: new Date().toISOString()
    });
  }),

  // Logout endpoint
  http.post('http://localhost:8000/api/auth/logout', () => {
    return HttpResponse.json({ success: true, message: 'Logged out successfully' });
  })
];

// Health check endpoints
const healthHandlers = [
  http.get('http://localhost:8000/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        cache: 'connected'
      }
    });
  }),

  http.get('http://localhost:3000/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      frontend: true,
      timestamp: new Date().toISOString()
    });
  })
];

// Session management endpoints
const sessionHandlers = [
  http.get('http://localhost:3000/api/auth/sessions', () => {
    return HttpResponse.json({
      sessions: [
        { 
          id: '1', 
          device: 'Chrome Browser', 
          last_active: new Date().toISOString(),
          ip_address: '127.0.0.1',
          location: 'Local'
        }
      ]
    });
  }),

  http.delete('http://localhost:3000/api/auth/sessions/:sessionId', ({ params }) => {
    return HttpResponse.json({
      success: true,
      message: `Session ${params.sessionId} terminated`
    });
  })
];

// 2FA endpoints
const twoFactorHandlers = [
  http.post('http://localhost:3000/api/auth/2fa/verify', async ({ request }) => {
    try {
      const body = await request.json();
      
      if (body.code === '123456' || body.code === '000000') {
        return HttpResponse.json({
          success: true,
          user: { 
            id: 1, 
            name: 'Test User', 
            email: 'test@example.com',
            two_factor_enabled: true
          }
        });
      }
      
      return HttpResponse.json(
        { error: 'Invalid 2FA code', success: false },
        { status: 400 }
      );
    } catch (error) {
      return HttpResponse.json(
        { error: 'Invalid request format', success: false },
        { status: 400 }
      );
    }
  }),

  http.post('http://localhost:3000/api/auth/2fa/enable', () => {
    return HttpResponse.json({
      success: true,
      qr_code: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48L3N2Zz4=',
      secret: 'MOCK2FASECRET123'
    });
  })
];

// Error simulation handlers for testing error cases
const errorHandlers = [
  // Network error simulation
  http.get('http://localhost:8000/api/error/network', () => {
    return HttpResponse.error();
  }),

  // Server error simulation  
  http.get('http://localhost:8000/api/error/server', () => {
    return HttpResponse.json(
      { error: 'Internal server error', message: 'Something went wrong' },
      { status: 500 }
    );
  }),

  // Rate limit error simulation
  http.post('http://localhost:8000/api/error/ratelimit', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded', retry_after: 60 },
      { status: 429 }
    );
  })
];

// Combined handlers export
const handlers = [
  ...authHandlers,
  ...healthHandlers,
  ...sessionHandlers,
  ...twoFactorHandlers,
  ...errorHandlers
];

module.exports = {
  authHandlers,
  healthHandlers,
  sessionHandlers,
  twoFactorHandlers,
  errorHandlers,
  handlers
};

// Default export for backwards compatibility
module.exports.default = handlers;