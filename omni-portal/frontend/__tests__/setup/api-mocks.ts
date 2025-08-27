import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Ensure MSW has access to required globals
if (typeof global.fetch === 'undefined') {
  // This should not happen with our polyfills, but safety check
  console.warn('fetch not available for MSW - tests may fail');
}

// Mock handlers for API endpoints
export const handlers = [
  // Auth endpoints
  http.post('http://localhost:8000/api/auth/login', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.login === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        success: true,
        user: { id: 1, name: 'Test User', email: 'test@example.com' },
        token: 'mock-token'
      });
    }
    
    return HttpResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // Health check endpoint
  http.get('http://localhost:8000/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }),

  // Sessions endpoint
  http.get('http://localhost:3000/api/auth/sessions', () => {
    return HttpResponse.json({
      sessions: [
        { id: '1', device: 'Chrome Browser', last_active: new Date().toISOString() }
      ]
    });
  }),

  // 2FA verify endpoint
  http.post('http://localhost:3000/api/auth/2fa/verify', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.code === '123456') {
      return HttpResponse.json({
        success: true,
        user: { id: 1, name: 'Test User', email: 'test@example.com' }
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid 2FA code' },
      { status: 400 }
    );
  })
];

// Create MSW server
export const server = setupServer(...handlers);

// Server lifecycle
export const startServer = () => server.listen({ onUnhandledRequest: 'warn' });
export const stopServer = () => server.close();
export const resetHandlers = () => server.resetHandlers();