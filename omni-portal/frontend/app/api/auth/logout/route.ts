import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookie
    const authToken = request.cookies.get('auth_token');
    
    // Make request to Laravel backend if token exists
    if (authToken) {
      await fetch('http://localhost:8000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken.value}`,
          'Accept': 'application/json',
        },
      });
    }

    // Create response
    const response = NextResponse.json({ message: 'Logged out successfully' });

    // Clear all auth cookies
    response.cookies.delete('auth_token');
    response.cookies.delete('authenticated');
    response.cookies.delete('XSRF-TOKEN');
    response.cookies.delete('austa_health_portal_session');

    return response;
  } catch (error) {
    console.error('Logout proxy error:', error);
    return NextResponse.json(
      { message: 'Logout completed' },
      { status: 200 }
    );
  }
}