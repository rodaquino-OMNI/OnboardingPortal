import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookie
    const authToken = request.cookies.get('auth_token');
    
    if (!authToken) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Make request to Laravel backend - using correct endpoint
    const response = await fetch('http://localhost:8000/api/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken.value}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Profile proxy error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}