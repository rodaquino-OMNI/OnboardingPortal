import { http, HttpResponse } from 'msw';

describe('MSW v2 Configuration Verification', () => {
  it('should intercept API calls correctly', async () => {
    // Make a real fetch call that should be intercepted by MSW
    const response = await fetch('http://localhost:8000/api/health');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
  });

  it('should handle auth endpoint with correct credentials', async () => {
    const loginData = {
      login: 'test@example.com',
      password: 'password123'
    };

    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.token).toBeDefined();
  });

  it('should handle auth endpoint with invalid credentials', async () => {
    const loginData = {
      login: 'wrong@example.com',
      password: 'wrongpassword'
    };

    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Credenciais inválidas');
  });

  it('should allow runtime handler modifications', () => {
    // Test that we can access the global MSW server for advanced usage
    expect(global.mswServer).toBeDefined();
    expect(typeof global.mswServer.use).toBe('function');
    expect(typeof global.mswServer.resetHandlers).toBe('function');
  });

  it('should handle server errors correctly', async () => {
    // Use the global server to add a temporary handler
    global.mswServer.use(
      http.get('http://localhost:8000/api/test-error', () => {
        return HttpResponse.json(
          { error: 'Test server error' },
          { status: 500 }
        );
      })
    );

    const response = await fetch('http://localhost:8000/api/test-error');
    const data = await response.json();
    
    expect(response.status).toBe(500);
    expect(data.error).toBe('Test server error');
  });
});