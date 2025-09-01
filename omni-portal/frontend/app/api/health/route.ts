import { NextResponse } from 'next/server';

export async function GET() {
  // Check basic application health
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '0.1.0',
  };

  // You can add more health checks here:
  // - Database connectivity
  // - External service availability
  // - Memory usage
  // - etc.

  return NextResponse.json(health, { status: 200 });
}

// Handle HEAD requests for health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}