import { NextResponse } from 'next/server';
import { metricsStore } from '@/lib/metrics-store';

// Record basic metrics on module load
metricsStore.set('nextjs_build_info', 1, {
  version: process.env.npm_package_version || '1.0.0',
  node_version: process.version,
  env: process.env.NODE_ENV || 'development',
});

export async function GET() {
  try {
    // Record request metrics
    metricsStore.increment('nextjs_http_requests_total', {
      method: 'GET',
      route: '/api/metrics',
      status: '200',
    });
    
    // Record current memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      metricsStore.set('nextjs_memory_usage_bytes', memUsage.heapUsed, { type: 'heap_used' });
      metricsStore.set('nextjs_memory_usage_bytes', memUsage.heapTotal, { type: 'heap_total' });
      metricsStore.set('nextjs_memory_usage_bytes', memUsage.rss, { type: 'rss' });
    }
    
    // Record uptime
    metricsStore.set('nextjs_uptime_seconds', process.uptime());
    
    const metrics = metricsStore.getPrometheusFormat();
    
    return new NextResponse(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    // Record error metrics
    metricsStore.increment('nextjs_http_requests_total', {
      method: 'GET',
      route: '/api/metrics',
      status: '500',
    });
    
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Note: metricsStore is available via import from @/lib/metrics-store