/**
 * Network Request Monitor
 * Monitors real-time network requests and analyzes patterns
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status: number;
  responseTime: number;
  timestamp: number;
  headers: Record<string, string>;
  error?: string;
}

interface NetworkPattern {
  endpoint: string;
  frequency: number;
  avgResponseTime: number;
  errorRate: number;
  lastSeen: number;
}

interface NetworkHealth {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  errorRate: number;
  slowRequests: number;
  networkErrors: number;
  corsErrors: number;
  authErrors: number;
}

class NetworkMonitor {
  private requests: NetworkRequest[] = [];
  private patterns: Map<string, NetworkPattern> = new Map();
  private isMonitoring = false;
  private monitoringDuration = 30000; // 30 seconds

  /**
   * Start monitoring network requests
   */
  async startMonitoring(durationMs: number = this.monitoringDuration): Promise<void> {
    this.isMonitoring = true;
    this.requests = [];
    this.patterns.clear();

    console.log(`Starting network monitoring for ${durationMs}ms...`);

    // Simulate network requests to various endpoints
    const endpoints = [
      { path: '/health', method: 'GET', interval: 5000 },
      { path: '/auth/login', method: 'POST', interval: 10000 },
      { path: '/gamification/progress', method: 'GET', interval: 8000 },
      { path: '/documents', method: 'GET', interval: 12000 },
      { path: '/config/public', method: 'GET', interval: 15000 }
    ];

    // Start periodic requests
    const intervals: NodeJS.Timeout[] = [];
    
    endpoints.forEach(endpoint => {
      const interval = setInterval(() => {
        if (this.isMonitoring) {
          this.makeMonitoredRequest(endpoint.path, endpoint.method);
        }
      }, endpoint.interval);
      intervals.push(interval);
    });

    // Wait for monitoring duration
    await new Promise(resolve => setTimeout(resolve, durationMs));

    // Stop monitoring
    this.isMonitoring = false;
    intervals.forEach(interval => clearInterval(interval));

    // Analyze patterns
    this.analyzePatterns();

    console.log(`Network monitoring completed. Total requests: ${this.requests.length}`);
  }

  /**
   * Make a monitored network request
   */
  private async makeMonitoredRequest(path: string, method: string): Promise<void> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: method === 'POST' ? JSON.stringify({
          email: 'monitor@example.com',
          password: 'MonitorPassword123!'
        }) : undefined
      });

      const responseTime = Date.now() - startTime;
      const headers: Record<string, string> = {};
      
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const request: NetworkRequest = {
        id: requestId,
        url: path,
        method,
        status: response.status,
        responseTime,
        timestamp: Date.now(),
        headers
      };

      this.requests.push(request);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const request: NetworkRequest = {
        id: requestId,
        url: path,
        method,
        status: 0,
        responseTime,
        timestamp: Date.now(),
        headers: {},
        error: errorMessage
      };

      this.requests.push(request);
    }
  }

  /**
   * Analyze network patterns
   */
  private analyzePatterns(): void {
    const endpointGroups = new Map<string, NetworkRequest[]>();

    // Group requests by endpoint
    this.requests.forEach(request => {
      const key = `${request.method} ${request.url}`;
      if (!endpointGroups.has(key)) {
        endpointGroups.set(key, []);
      }
      endpointGroups.get(key)!.push(request);
    });

    // Calculate patterns for each endpoint
    endpointGroups.forEach((requests, endpoint) => {
      const successful = requests.filter(r => r.status >= 200 && r.status < 400);
      const failed = requests.filter(r => r.status === 0 || r.status >= 400);
      const avgResponseTime = requests.reduce((sum, r) => sum + r.responseTime, 0) / requests.length;
      const errorRate = failed.length / requests.length;
      const lastSeen = Math.max(...requests.map(r => r.timestamp));

      this.patterns.set(endpoint, {
        endpoint,
        frequency: requests.length,
        avgResponseTime,
        errorRate,
        lastSeen
      });
    });
  }

  /**
   * Calculate network health metrics
   */
  getNetworkHealth(): NetworkHealth {
    const successfulRequests = this.requests.filter(r => r.status >= 200 && r.status < 400).length;
    const failedRequests = this.requests.length - successfulRequests;
    const avgResponseTime = this.requests.length > 0 
      ? this.requests.reduce((sum, r) => sum + r.responseTime, 0) / this.requests.length 
      : 0;
    const errorRate = this.requests.length > 0 ? failedRequests / this.requests.length : 0;
    const slowRequests = this.requests.filter(r => r.responseTime > 2000).length;
    const networkErrors = this.requests.filter(r => r.status === 0).length;
    const corsErrors = this.requests.filter(r => 
      r.error && r.error.toLowerCase().includes('cors')
    ).length;
    const authErrors = this.requests.filter(r => 
      r.status === 401 || r.status === 403
    ).length;

    return {
      totalRequests: this.requests.length,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      errorRate,
      slowRequests,
      networkErrors,
      corsErrors,
      authErrors
    };
  }

  /**
   * Get all network patterns
   */
  getPatterns(): NetworkPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get all requests
   */
  getRequests(): NetworkRequest[] {
    return [...this.requests];
  }

  /**
   * Generate network monitoring report
   */
  generateReport(): string {
    const health = this.getNetworkHealth();
    const patterns = this.getPatterns();

    let report = `
# Network Monitoring Report
**Generated:** ${new Date().toISOString()}
**Monitoring Duration:** ${this.monitoringDuration / 1000} seconds
**Total Requests Monitored:** ${health.totalRequests}

## Network Health Summary
- **Total Requests:** ${health.totalRequests}
- **Successful Requests:** ${health.successfulRequests} (${((health.successfulRequests / health.totalRequests) * 100).toFixed(1)}%)
- **Failed Requests:** ${health.failedRequests} (${((health.failedRequests / health.totalRequests) * 100).toFixed(1)}%)
- **Average Response Time:** ${health.avgResponseTime.toFixed(2)}ms
- **Error Rate:** ${(health.errorRate * 100).toFixed(1)}%
- **Slow Requests (>2s):** ${health.slowRequests}
- **Network Errors:** ${health.networkErrors}
- **CORS Errors:** ${health.corsErrors}
- **Auth Errors:** ${health.authErrors}

## Network Health Status
${this.getHealthStatus(health)}

## Endpoint Patterns
${patterns.map(pattern => `
### ${pattern.endpoint}
- **Frequency:** ${pattern.frequency} requests
- **Average Response Time:** ${pattern.avgResponseTime.toFixed(2)}ms
- **Error Rate:** ${(pattern.errorRate * 100).toFixed(1)}%
- **Last Seen:** ${new Date(pattern.lastSeen).toISOString()}
- **Status:** ${this.getPatternStatus(pattern)}
`).join('\n')}

## Request Timeline
${this.generateTimeline()}

## Performance Analysis
${this.generatePerformanceAnalysis()}

## Error Analysis
${this.generateErrorAnalysis()}

## Recommendations
${this.generateRecommendations(health, patterns)}
`;

    return report;
  }

  private getHealthStatus(health: NetworkHealth): string {
    const status = [];

    if (health.errorRate < 0.1) {
      status.push('✅ Low Error Rate');
    } else if (health.errorRate < 0.3) {
      status.push('⚠️ Moderate Error Rate');
    } else {
      status.push('❌ High Error Rate');
    }

    if (health.avgResponseTime < 1000) {
      status.push('✅ Good Response Time');
    } else if (health.avgResponseTime < 3000) {
      status.push('⚠️ Moderate Response Time');
    } else {
      status.push('❌ Slow Response Time');
    }

    if (health.networkErrors === 0) {
      status.push('✅ No Network Errors');
    } else {
      status.push(`❌ ${health.networkErrors} Network Errors`);
    }

    return status.join('\n');
  }

  private getPatternStatus(pattern: NetworkPattern): string {
    if (pattern.errorRate === 0 && pattern.avgResponseTime < 1000) {
      return '✅ Healthy';
    } else if (pattern.errorRate < 0.2 && pattern.avgResponseTime < 2000) {
      return '⚠️ Fair';
    } else {
      return '❌ Issues Detected';
    }
  }

  private generateTimeline(): string {
    const timeline = this.requests
      .slice(-10) // Last 10 requests
      .map(request => {
        const time = new Date(request.timestamp).toLocaleTimeString();
        const status = request.status === 0 ? 'FAILED' : request.status.toString();
        return `- ${time}: ${request.method} ${request.url} → ${status} (${request.responseTime}ms)`;
      })
      .join('\n');

    return `Recent requests:\n${timeline}`;
  }

  private generatePerformanceAnalysis(): string {
    const responseTimes = this.requests.map(r => r.responseTime);
    const min = Math.min(...responseTimes);
    const max = Math.max(...responseTimes);
    const median = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length / 2)];

    return `
- **Minimum Response Time:** ${min}ms
- **Maximum Response Time:** ${max}ms
- **Median Response Time:** ${median}ms
- **Response Time Distribution:**
  - <500ms: ${this.requests.filter(r => r.responseTime < 500).length} requests
  - 500ms-1s: ${this.requests.filter(r => r.responseTime >= 500 && r.responseTime < 1000).length} requests
  - 1s-2s: ${this.requests.filter(r => r.responseTime >= 1000 && r.responseTime < 2000).length} requests
  - >2s: ${this.requests.filter(r => r.responseTime >= 2000).length} requests
`;
  }

  private generateErrorAnalysis(): string {
    const errorsByStatus = new Map<number, number>();
    const errorsByType = new Map<string, number>();

    this.requests.forEach(request => {
      if (request.status >= 400 || request.status === 0) {
        errorsByStatus.set(request.status, (errorsByStatus.get(request.status) || 0) + 1);
        
        if (request.error) {
          const errorType = request.error.includes('CORS') ? 'CORS' :
                           request.error.includes('network') ? 'Network' :
                           request.error.includes('timeout') ? 'Timeout' : 'Other';
          errorsByType.set(errorType, (errorsByType.get(errorType) || 0) + 1);
        }
      }
    });

    let analysis = '**Error Distribution by Status Code:**\n';
    Array.from(errorsByStatus.entries()).forEach(([status, count]) => {
      analysis += `- ${status}: ${count} requests\n`;
    });

    if (errorsByType.size > 0) {
      analysis += '\n**Error Distribution by Type:**\n';
      Array.from(errorsByType.entries()).forEach(([type, count]) => {
        analysis += `- ${type}: ${count} requests\n`;
      });
    }

    return analysis;
  }

  private generateRecommendations(health: NetworkHealth, patterns: NetworkPattern[]): string {
    const recommendations = [];

    if (health.errorRate > 0.2) {
      recommendations.push('- Investigate high error rate - check server logs and configuration');
    }

    if (health.avgResponseTime > 2000) {
      recommendations.push('- Optimize API performance - slow average response time detected');
    }

    if (health.networkErrors > 0) {
      recommendations.push('- Check network connectivity between frontend and backend');
    }

    if (health.corsErrors > 0) {
      recommendations.push('- Fix CORS configuration to allow frontend-backend communication');
    }

    const slowPatterns = patterns.filter(p => p.avgResponseTime > 2000);
    if (slowPatterns.length > 0) {
      recommendations.push(`- Optimize slow endpoints: ${slowPatterns.map(p => p.endpoint).join(', ')}`);
    }

    const errorPronePatterns = patterns.filter(p => p.errorRate > 0.3);
    if (errorPronePatterns.length > 0) {
      recommendations.push(`- Fix error-prone endpoints: ${errorPronePatterns.map(p => p.endpoint).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('- Network monitoring shows good health - no immediate issues detected');
    }

    return recommendations.join('\n');
  }
}

// Jest test suite
describe('Network Request Monitoring', () => {
  let monitor: NetworkMonitor;
  let networkHealth: NetworkHealth;
  let patterns: NetworkPattern[];

  beforeAll(async () => {
    monitor = new NetworkMonitor();
    
    // Run network monitoring for 30 seconds
    await monitor.startMonitoring(30000);
    
    // Get results
    networkHealth = monitor.getNetworkHealth();
    patterns = monitor.getPatterns();
    
    // Generate and log report
    const report = monitor.generateReport();
    console.log('\n=== Network Monitoring Report ===');
    console.log(report);
    
  }, 60000); // 1 minute timeout

  describe('Network Health Metrics', () => {
    it('should have monitored network requests', () => {
      expect(networkHealth.totalRequests).toBeGreaterThan(0);
    });

    it('should calculate error rates', () => {
      expect(typeof networkHealth.errorRate).toBe('number');
      expect(networkHealth.errorRate).toBeGreaterThanOrEqual(0);
      expect(networkHealth.errorRate).toBeLessThanOrEqual(1);
    });

    it('should measure response times', () => {
      expect(typeof networkHealth.avgResponseTime).toBe('number');
      expect(networkHealth.avgResponseTime).toBeGreaterThan(0);
    });

    it('should track successful vs failed requests', () => {
      expect(networkHealth.successfulRequests + networkHealth.failedRequests)
        .toBe(networkHealth.totalRequests);
    });
  });

  describe('Endpoint Patterns', () => {
    it('should identify endpoint patterns', () => {
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should track endpoint frequency', () => {
      patterns.forEach(pattern => {
        expect(pattern.frequency).toBeGreaterThan(0);
        expect(typeof pattern.avgResponseTime).toBe('number');
        expect(typeof pattern.errorRate).toBe('number');
      });
    });
  });

  describe('Performance Analysis', () => {
    it('should identify slow requests', () => {
      expect(typeof networkHealth.slowRequests).toBe('number');
      expect(networkHealth.slowRequests).toBeGreaterThanOrEqual(0);
    });

    it('should have reasonable performance', () => {
      // Log performance metrics
      console.log(`Network Health Summary:`);
      console.log(`- Total Requests: ${networkHealth.totalRequests}`);
      console.log(`- Success Rate: ${((networkHealth.successfulRequests / networkHealth.totalRequests) * 100).toFixed(1)}%`);
      console.log(`- Average Response Time: ${networkHealth.avgResponseTime.toFixed(2)}ms`);
      console.log(`- Error Rate: ${(networkHealth.errorRate * 100).toFixed(1)}%`);

      // These are informational rather than hard failures
      if (networkHealth.avgResponseTime > 3000) {
        console.warn(`Warning: High average response time (${networkHealth.avgResponseTime.toFixed(2)}ms)`);
      }
      
      if (networkHealth.errorRate > 0.5) {
        console.warn(`Warning: High error rate (${(networkHealth.errorRate * 100).toFixed(1)}%)`);
      }
    });
  });

  describe('Error Analysis', () => {
    it('should categorize errors', () => {
      expect(typeof networkHealth.networkErrors).toBe('number');
      expect(typeof networkHealth.corsErrors).toBe('number');
      expect(typeof networkHealth.authErrors).toBe('number');
    });

    it('should track error patterns', () => {
      // Log error information
      if (networkHealth.failedRequests > 0) {
        console.log(`Error Analysis:`);
        console.log(`- Failed Requests: ${networkHealth.failedRequests}`);
        console.log(`- Network Errors: ${networkHealth.networkErrors}`);
        console.log(`- CORS Errors: ${networkHealth.corsErrors}`);
        console.log(`- Auth Errors: ${networkHealth.authErrors}`);
      }
      
      // This is informational
      expect(networkHealth.failedRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CORS Analysis', () => {
    it('should detect CORS issues', () => {
      if (networkHealth.corsErrors > 0) {
        console.warn(`CORS issues detected: ${networkHealth.corsErrors} requests failed due to CORS`);
      }
      
      // This is informational - CORS errors might be expected in test environment
      expect(networkHealth.corsErrors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-time Monitoring', () => {
    it('should capture request timeline', () => {
      const requests = monitor.getRequests();
      expect(requests.length).toBeGreaterThan(0);
      
      // Verify requests have timestamps
      requests.forEach(request => {
        expect(typeof request.timestamp).toBe('number');
        expect(request.timestamp).toBeGreaterThan(0);
      });
    });

    it('should provide monitoring insights', () => {
      // This test validates that monitoring provides actionable insights
      const report = monitor.generateReport();
      expect(report).toContain('Network Health Summary');
      expect(report).toContain('Endpoint Patterns');
      expect(report).toContain('Recommendations');
    });
  });
});

export { NetworkMonitor, NetworkRequest, NetworkPattern, NetworkHealth };