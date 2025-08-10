import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Make request to Laravel backend
    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Extract token from response or cookie header
    const setCookieHeader = response.headers.get('set-cookie');
    let authToken = null;

    if (setCookieHeader) {
      const tokenMatch = setCookieHeader.match(/auth_token=([^;]+)/);
      if (tokenMatch) {
        authToken = decodeURIComponent(tokenMatch[1]);
      }
    }

    // Create response with data
    const nextResponse = NextResponse.json(data);

    // Set cookie on frontend domain
    if (authToken) {
      nextResponse.cookies.set('auth_token', authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    // Also set a frontend-accessible session flag
    nextResponse.cookies.set('authenticated', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return nextResponse;
  } catch (error) {
    console.error('Login proxy error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}