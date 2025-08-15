/**
 * ApiGateway - Unified API access pattern
 * Consolidates 3 different API patterns into single gateway
 */

import { boundaryValidator } from '@/docs/migration-toolkit/boundary-validator';
import { performanceBudgetGuard } from '@/docs/migration-toolkit/performance-budget-guard';
// import { parallelExecutor } from '@/docs/migration-toolkit/parallel-executor';
import { featureFlags } from '@/lib/feature-flags';

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  parallel?: boolean; // Run old and new implementations in parallel
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  headers?: Headers;
  cached?: boolean;
  executionTime?: number;
}

export interface ApiOperation<T = any> {
  request: ApiRequest;
  validate?: (data: any) => boolean;
  transform?: (data: any) => T;
  fallback?: T;
  onError?: (error: Error) => void;
}

/**
 * API Gateway - Single point of entry for all API calls
 */
export class ApiGateway {
  private readonly baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private activeRequests = new Map<string, AbortController>();
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    averageResponseTime: 0
  };

  /**
   * Execute an API operation
   */
  async execute<T>(operation: ApiOperation<T>): Promise<ApiResponse<T>> {
    const startTime = performance.now();
    const { request } = operation;
    
    // Validate API call pattern
    this.validateApiCall(request);

    // Check cache first
    if (request.cache) {
      const cached = this.getCached(request);
      if (cached) {
        this.metrics.cacheHits++;
        return {
          success: true,
          data: operation.transform ? operation.transform(cached) : cached,
          cached: true,
          executionTime: performance.now() - startTime
        };
      }
    }

    // Run parallel comparison if enabled
    if (request.parallel && featureFlags.get('PARALLEL_EXECUTION')) {
      return this.executeWithComparison(operation, startTime);
    }

    // Execute normal request
    return this.executeRequest(operation, startTime);
  }

  /**
   * Execute request with parallel comparison
   */
  private async executeWithComparison<T>(
    operation: ApiOperation<T>,
    startTime: number
  ): Promise<ApiResponse<T>> {
    // Parallel execution temporarily disabled
    // const comparison = await parallelExecutor.compareImplementations(
    //   () => this.executeLegacyRequest(operation.request),
    //   () => this.executeNewRequest(operation.request),
    //   `API: ${operation.request.endpoint}`
    // );

    // Use recommendation to decide which result to return
    // const result = comparison.recommendation === 'use_new' 
    //   ? comparison.newResult 
    //   : comparison.oldResult;
    
    // Fallback to legacy implementation for now
    const result = await this.executeLegacyRequest(operation.request);

    if (!result.success) {
      return this.handleError(result.error!, operation, startTime);
    }

    const data = operation.transform ? operation.transform(result.data) : result.data;
    
    return {
      success: true,
      data,
      executionTime: performance.now() - startTime
    };
  }

  /**
   * Execute single request
   */
  private async executeRequest<T>(
    operation: ApiOperation<T>,
    startTime: number
  ): Promise<ApiResponse<T>> {
    const { request } = operation;
    
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const requestId = this.generateRequestId(request);
      this.activeRequests.set(requestId, controller);

      // Set timeout
      const timeoutId = request.timeout 
        ? setTimeout(() => controller.abort(), request.timeout)
        : null;

      // Build request options
      const options: RequestInit = {
        method: request.method,
        headers: this.buildHeaders(request.headers),
        credentials: 'include',
        signal: controller.signal
      };

      if (request.body && request.method !== 'GET') {
        options.body = JSON.stringify(request.body);
      }

      // Make request with retries
      const response = await this.fetchWithRetries(
        `${this.baseUrl}${request.endpoint}`,
        options,
        request.retries || 0
      );

      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);

      // Handle response
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate response if validator provided
      if (operation.validate && !operation.validate(data)) {
        throw new Error('Response validation failed');
      }

      // Transform response if transformer provided
      const transformedData = operation.transform ? operation.transform(data) : data;

      // Cache if requested
      if (request.cache) {
        this.setCached(request, data);
      }

      // Update metrics
      this.updateMetrics(true, performance.now() - startTime);

      return {
        success: true,
        data: transformedData,
        status: response.status,
        headers: response.headers,
        executionTime: performance.now() - startTime
      };

    } catch (error) {
      this.activeRequests.delete(this.generateRequestId(request));
      return this.handleError(error as Error, operation, startTime);
    }
  }

  /**
   * Execute legacy request (for comparison)
   */
  private async executeLegacyRequest(request: ApiRequest): Promise<any> {
    // Simulate legacy API call pattern
    const response = await fetch(`${this.baseUrl}${request.endpoint}`, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers
      },
      credentials: 'include',
      body: request.body ? JSON.stringify(request.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Legacy API failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Execute new request pattern
   */
  private async executeNewRequest(request: ApiRequest): Promise<any> {
    return this.executeRequest({ request }, 0);
  }

  /**
   * Fetch with automatic retries
   */
  private async fetchWithRetries(
    url: string,
    options: RequestInit,
    retries: number
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, options);
        
        // Don't retry on success or client errors
        if (response.ok || response.status < 500) {
          return response;
        }

        lastError = new Error(`HTTP ${response.status}`);
        
        // Wait before retry with exponential backoff
        if (i < retries) {
          await this.delay(Math.pow(2, i) * 1000);
        }

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on abort
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }

        // Wait before retry
        if (i < retries) {
          await this.delay(Math.pow(2, i) * 1000);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Handle request error
   */
  private handleError<T>(
    error: Error,
    operation: ApiOperation<T>,
    startTime: number
  ): ApiResponse<T> {
    // Call error handler if provided
    if (operation.onError) {
      operation.onError(error);
    }

    // Update metrics
    this.updateMetrics(false, performance.now() - startTime);

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ApiGateway] Request failed:`, error);
    }

    // Return error response with fallback if provided
    return {
      success: false,
      error: error.message,
      data: operation.fallback,
      executionTime: performance.now() - startTime
    };
  }

  /**
   * Build headers for request
   */
  private buildHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...customHeaders
    };

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Get auth token from storage
   */
  private getAuthToken(): string | null {
    // Try multiple sources for backward compatibility
    return localStorage.getItem('auth_token') || 
           sessionStorage.getItem('auth_token') ||
           null;
  }

  /**
   * Validate API call pattern
   */
  private validateApiCall(request: ApiRequest): void {
    const enforcementLevel = featureFlags.get('ENFORCE_BOUNDARIES');
    if (enforcementLevel === 'off') return;

    // Determine which pattern is being used
    const pattern = this.isGatewayPattern(request) ? 'gateway' : 'legacy';
    
    // Get caller from stack trace
    const caller = this.getCallerInfo();
    
    boundaryValidator.validateApiCall(caller, pattern);
  }

  /**
   * Check if request follows gateway pattern
   */
  private isGatewayPattern(request: ApiRequest): boolean {
    // Gateway pattern has structured request object
    return !!(request.endpoint && request.method);
  }

  /**
   * Get caller information from stack trace
   */
  private getCallerInfo(): string {
    try {
      const stack = new Error().stack;
      const callerLine = stack?.split('\n')[3];
      const match = callerLine?.match(/at\s+(\S+)/);
      return match?.[1] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get cached data
   */
  private getCached(request: ApiRequest): any | null {
    const key = this.getCacheKey(request);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data
   */
  private setCached(request: ApiRequest, data: any): void {
    const key = this.getCacheKey(request);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 20 entries
      for (let i = 0; i < 20; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(request: ApiRequest): string {
    const body = request.body ? JSON.stringify(request.body) : '';
    return `${request.method}:${request.endpoint}:${body}`;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(request: ApiRequest): string {
    return `${request.method}-${request.endpoint}-${Date.now()}`;
  }

  /**
   * Update metrics
   */
  private updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const currentAvg = this.metrics.averageResponseTime;
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime = 
      (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel all active requests
   */
  cancelAll(): void {
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0
    };
  }
}

// Export singleton instance
export const apiGateway = new ApiGateway();