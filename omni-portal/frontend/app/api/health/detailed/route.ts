import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const checks: Record<string, any> = {};
    const startTime = Date.now();
    
    // Check API backend connectivity with detailed endpoints
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    
    // Check backend health endpoint
    try {
      const healthResponse = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      const healthData = await healthResponse.json();
      checks.backend_health = {
        status: healthResponse.ok ? 'healthy' : 'unhealthy',
        response_time: `${Date.now() - startTime}ms`,
        url: `${apiUrl}/health`,
        details: healthData
      };
    } catch (error) {
      checks.backend_health = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        url: `${apiUrl}/health`
      };
    }
    
    // Check backend liveness
    try {
      const liveResponse = await fetch(`${apiUrl}/health/live`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      checks.backend_live = {
        status: liveResponse.ok ? 'healthy' : 'unhealthy',
        response_time: `${Date.now() - startTime}ms`,
        url: `${apiUrl}/health/live`
      };
    } catch (error) {
      checks.backend_live = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        url: `${apiUrl}/health/live`
      };
    }
    
    // Check backend readiness
    try {
      const readyResponse = await fetch(`${apiUrl}/health/ready`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      checks.backend_ready = {
        status: readyResponse.ok ? 'healthy' : 'unhealthy',
        response_time: `${Date.now() - startTime}ms`,
        url: `${apiUrl}/health/ready`
      };
    } catch (error) {
      checks.backend_ready = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        url: `${apiUrl}/health/ready`
      };
    }
    
    // Check memory usage (more detailed)
    const memUsage = process.memoryUsage();
    const memStatus = memUsage.heapUsed > 1024 * 1024 * 1024 ? 'warning' : 'healthy'; // 1GB threshold
    checks.memory = {
      status: memStatus,
      heap_used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heap_total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heap_usage_percent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    };
    
    // Check environment variables and configuration
    checks.environment = {
      status: process.env.NEXT_PUBLIC_API_URL ? 'healthy' : 'warning',
      node_env: process.env.NODE_ENV,
      api_url_configured: !!process.env.NEXT_PUBLIC_API_URL,
      api_url: process.env.NEXT_PUBLIC_API_URL || 'not_configured',
      port: process.env.PORT || '3000',
      hostname: process.env.HOSTNAME || 'localhost'
    };
    
    // Check Next.js specific health
    checks.nextjs = {
      status: 'healthy',
      version: process.env.npm_package_version || 'unknown',
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    };
    
    // Check if we're in a container
    const isDocker = process.env.HOSTNAME !== 'localhost' || process.env.NODE_ENV === 'production';
    checks.container = {
      status: 'healthy',
      is_containerized: isDocker,
      hostname: process.env.HOSTNAME || 'unknown'
    };
    
    // Overall health status
    const unhealthyServices = Object.values(checks).filter(
      check => check.status === 'unhealthy'
    ).length;
    
    const warningServices = Object.values(checks).filter(
      check => check.status === 'warning'
    ).length;
    
    let overallStatus = 'healthy';
    if (unhealthyServices > 0) {
      overallStatus = 'unhealthy';
    } else if (warningServices > 0) {
      overallStatus = 'degraded';
    }
    
    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
      total_checks: Object.keys(checks).length,
      healthy_checks: Object.values(checks).filter(c => c.status === 'healthy').length,
      warning_checks: warningServices,
      unhealthy_checks: unhealthyServices,
      checks
    };

    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: httpStatus });
    
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      uptime: process.uptime()
    }, { status: 503 });
  }
}