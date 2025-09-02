/**
 * Request Correlation Utilities for Frontend-Backend Communication
 * 
 * Provides utilities for:
 * - Generating unique request IDs
 * - Correlating requests across frontend and backend
 * - Error tracking and debugging
 * - Performance monitoring
 */

/**
 * Request ID header name (must match backend)
 */
export const REQUEST_ID_HEADER = 'X-Request-ID';

/**
 * Alternative header names for different services
 */
export const CORRELATION_HEADERS = {
  REQUEST_ID: 'X-Request-ID',
  CORRELATION_ID: 'X-Correlation-ID',
  TRACE_ID: 'X-Trace-ID',
} as const;

/**
 * Interface for request correlation data
 */
export interface RequestCorrelation {
  requestId: string;
  timestamp: string;
  userAgent: string;
  url: string;
  method: string;
  sessionId?: string;
  userId?: string;
}

/**
 * Interface for error with request correlation
 */
export interface CorrelatedError extends Error {
  requestId?: string;
  correlationData?: RequestCorrelation;
  originalError?: Error;
}

/**
 * Generate a unique request ID
 * Format: req_YYYYMMDDHHMMSS_randomString
 */
export function generateRequestId(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
  const random = Math.random().toString(36).substring(2, 10);
  
  return `req_${timestamp}_${random}`;
}

/**
 * Validate request ID format
 */
export function isValidRequestId(requestId: string): boolean {
  // Allow alphanumeric, dashes, underscores (max 64 chars)
  return /^[a-zA-Z0-9_-]{1,64}$/.test(requestId);
}

/**
 * Get request correlation headers for HTTP requests
 */
export function getCorrelationHeaders(requestId?: string): Record<string, string> {
  const id = requestId || generateRequestId();
  
  return {
    [CORRELATION_HEADERS.REQUEST_ID]: id,
    [CORRELATION_HEADERS.CORRELATION_ID]: id,
    [CORRELATION_HEADERS.TRACE_ID]: id,
  };
}

/**
 * Extract request ID from response headers
 */
export function extractRequestIdFromResponse(headers: Headers | Record<string, string>): string | null {
  if (headers instanceof Headers) {
    return headers.get(REQUEST_ID_HEADER);
  }
  
  // Check different possible header formats
  for (const headerName of Object.values(CORRELATION_HEADERS)) {
    const value = headers[headerName] || headers[headerName.toLowerCase()];
    if (value && isValidRequestId(value)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Create request correlation data
 */
export function createRequestCorrelation(
  requestId: string,
  method: string,
  url: string,
  additionalData?: Partial<RequestCorrelation>
): RequestCorrelation {
  return {
    requestId,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    method: method.toUpperCase(),
    url,
    sessionId: getSessionId(),
    ...additionalData,
  };
}

/**
 * Get session ID from storage or generate one
 */
function getSessionId(): string | undefined {
  try {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  } catch {
    // SessionStorage not available or disabled
    return undefined;
  }
}

/**
 * Log request with correlation data
 */
export function logRequest(
  level: 'info' | 'warn' | 'error',
  message: string,
  correlationData: RequestCorrelation,
  additionalData?: Record<string, any>
): void {
  const logData = {
    message,
    request_id: correlationData.requestId,
    timestamp: correlationData.timestamp,
    correlation: correlationData,
    ...additionalData,
  };

  console[level](`[${correlationData.requestId}] ${message}`, logData);
}

/**
 * Create a correlated error
 */
export function createCorrelatedError(
  message: string,
  originalError?: Error,
  correlationData?: RequestCorrelation
): CorrelatedError {
  const error = new Error(message) as CorrelatedError;
  error.name = 'CorrelatedError';
  error.requestId = correlationData?.requestId;
  error.correlationData = correlationData;
  error.originalError = originalError;
  
  if (originalError?.stack) {
    error.stack = `${error.stack}\nCaused by: ${originalError.stack}`;
  }
  
  return error;
}

/**
 * Request correlation manager for tracking active requests
 */
export class RequestCorrelationManager {
  private activeRequests = new Map<string, RequestCorrelation>();
  private requestMetrics = new Map<string, { startTime: number; endTime?: number }>();

  /**
   * Start tracking a request
   */
  startRequest(correlation: RequestCorrelation): void {
    this.activeRequests.set(correlation.requestId, correlation);
    this.requestMetrics.set(correlation.requestId, { startTime: performance.now() });
    
    logRequest('info', 'Request started', correlation);
  }

  /**
   * Complete tracking a request
   */
  completeRequest(requestId: string, success: boolean = true, additionalData?: Record<string, any>): void {
    const correlation = this.activeRequests.get(requestId);
    const metrics = this.requestMetrics.get(requestId);
    
    if (correlation && metrics) {
      metrics.endTime = performance.now();
      const duration = metrics.endTime - metrics.startTime;
      
      logRequest(
        success ? 'info' : 'error',
        `Request ${success ? 'completed' : 'failed'}`,
        correlation,
        {
          duration_ms: Math.round(duration * 100) / 100,
          success,
          ...additionalData,
        }
      );
    }
    
    this.activeRequests.delete(requestId);
    this.requestMetrics.delete(requestId);
  }

  /**
   * Get active request correlation data
   */
  getActiveRequest(requestId: string): RequestCorrelation | undefined {
    return this.activeRequests.get(requestId);
  }

  /**
   * Get all active requests
   */
  getActiveRequests(): RequestCorrelation[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Clean up old requests (prevent memory leaks)
   */
  cleanup(maxAge: number = 300000): void { // 5 minutes default
    const now = Date.now();
    const cutoff = now - maxAge;
    
    for (const [requestId, correlation] of this.activeRequests.entries()) {
      const timestamp = new Date(correlation.timestamp).getTime();
      if (timestamp < cutoff) {
        logRequest('warn', 'Cleaning up stale request', correlation);
        this.activeRequests.delete(requestId);
        this.requestMetrics.delete(requestId);
      }
    }
  }
}

/**
 * Global request correlation manager instance
 */
export const requestCorrelationManager = new RequestCorrelationManager();

/**
 * Auto-cleanup interval (runs every 5 minutes)
 */
if (typeof window !== 'undefined') {
  setInterval(() => {
    requestCorrelationManager.cleanup();
  }, 300000);
}

/**
 * Utility to wrap fetch with request correlation
 */
export async function correlatedFetch(
  url: string,
  options: RequestInit = {},
  requestId?: string
): Promise<Response> {
  const id = requestId || generateRequestId();
  const method = options.method || 'GET';
  
  // Create correlation data
  const correlation = createRequestCorrelation(id, method, url);
  
  // Add correlation headers
  const correlationHeaders = getCorrelationHeaders(id);
  const headers = new Headers(options.headers);
  
  Object.entries(correlationHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  // Start tracking
  requestCorrelationManager.startRequest(correlation);
  
  try {
    // Make request
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // Extract response request ID
    const responseRequestId = extractRequestIdFromResponse(response.headers);
    
    // Complete tracking
    requestCorrelationManager.completeRequest(id, response.ok, {
      status: response.status,
      response_request_id: responseRequestId,
    });
    
    return response;
  } catch (error) {
    // Complete tracking with error
    requestCorrelationManager.completeRequest(id, false, {
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Re-throw as correlated error
    throw createCorrelatedError(
      `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
      correlation
    );
  }
}

/**
 * Utility to add request correlation to any error
 */
export function addRequestCorrelation<T extends Error>(
  error: T,
  requestId?: string
): T & { requestId?: string } {
  (error as any).requestId = requestId;
  return error as T & { requestId?: string };
}