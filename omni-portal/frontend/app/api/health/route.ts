import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const checks: Record<string, any> = {};
    const startTime = Date.now();
    
    // Check API backend connectivity - use internal Docker service name in container
    const isInContainer = process.env.HOSTNAME === '0.0.0.0' || process.env.NODE_ENV === 'production';
    const apiUrl = isInContainer 
      ? 'http://nginx/api' // Use nginx service internally
      : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api');
    
    // For detailed health checks, also try direct backend connection
    const backendDirectUrl = isInContainer ? 'http://backend:8000/api' : 'http://localhost:8000/api';
    
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      checks.backend = {
        status: response.ok ? 'healthy' : 'unhealthy',
        response_time: `${Date.now() - startTime}ms`,
        url: `${apiUrl}/health`
      };
    } catch (error) {
      checks.backend = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        url: `${apiUrl}/health`
      };
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
      status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning', // 500MB threshold
      heap_used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heap_total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    };
    
    // Check environment variables
    checks.environment = {
      status: process.env.NEXT_PUBLIC_API_URL ? 'healthy' : 'warning',
      node_env: process.env.NODE_ENV,
      api_url_configured: !!process.env.NEXT_PUBLIC_API_URL
    };
    
    // Overall health status - frontend is healthy if it can respond
    // Backend connectivity is informational but not required for frontend health
    const isHealthy = checks.memory?.status === 'healthy' && checks.environment?.status !== 'unhealthy';
    
    const health = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
      checks
    };

    return NextResponse.json(health, { status: isHealthy ? 200 : 503 });
    
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

// Handle HEAD requests for health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}