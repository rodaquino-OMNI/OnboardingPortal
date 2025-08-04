/**
 * Async utilities for handling race conditions and cancellation
 */

import React from 'react';

export interface CancellableRequest<T> {
  promise: Promise<T>;
  cancel: () => void;
  isCancelled: () => boolean;
}

export interface RequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Creates a cancellable promise with AbortController
 */
export function makeCancellable<T>(
  promiseFactory: (abortSignal: AbortSignal) => Promise<T>,
  config: RequestConfig = {}
): CancellableRequest<T> {
  const abortController = new AbortController();
  let cancelled = false;

  const promise = new Promise<T>(async (resolve, reject) => {
    try {
      // Add timeout if specified
      const timeoutId = config.timeout 
        ? setTimeout(() => {
            if (!cancelled) {
              cancelled = true;
              abortController.abort();
              reject(new Error(`Request timeout after ${config.timeout}ms`));
            }
          }, config.timeout)
        : null;

      // Execute the promise with retries
      let lastError: Error | null = null;
      const maxRetries = config.retries || 0;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (cancelled || abortController.signal.aborted) {
          reject(new Error('Request cancelled'));
          return;
        }

        try {
          const result = await promiseFactory(abortController.signal);
          
          if (timeoutId) clearTimeout(timeoutId);
          
          if (!cancelled) {
            resolve(result);
          } else {
            reject(new Error('Request cancelled'));
          }
          return;
        } catch (error) {
          lastError = error as Error;
          
          // Don't retry on abort
          if (abortController.signal.aborted || cancelled) {
            break;
          }
          
          // Wait before retry
          if (attempt < maxRetries && config.retryDelay) {
            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
          }
        }
      }

      if (timeoutId) clearTimeout(timeoutId);
      reject(lastError || new Error('Request failed'));
      
    } catch (error) {
      reject(error);
    }
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      abortController.abort();
    },
    isCancelled: () => cancelled || abortController.signal.aborted
  };
}

/**
 * Hook for managing cancellable requests in React components
 */
export function useCancellableRequest() {
  const activeRequests = React.useRef<Set<CancellableRequest<any>>>(new Set());

  React.useEffect(() => {
    // Cleanup all active requests on unmount
    return () => {
      activeRequests.current.forEach(request => {
        if (!request.isCancelled()) {
          request.cancel();
        }
      });
      activeRequests.current.clear();
    };
  }, []);

  const makeRequest = React.useCallback(<T>(
    promiseFactory: (abortSignal: AbortSignal) => Promise<T>,
    config?: RequestConfig
  ): CancellableRequest<T> => {
    const request = makeCancellable(promiseFactory, config);
    
    activeRequests.current.add(request);
    
    // Remove from active requests when completed
    request.promise
      .finally(() => {
        activeRequests.current.delete(request);
      })
      .catch(() => {
        // Ignore cancellation errors
      });

    return request;
  }, []);

  const cancelAll = React.useCallback(() => {
    activeRequests.current.forEach(request => {
      if (!request.isCancelled()) {
        request.cancel();
      }
    });
    activeRequests.current.clear();
  }, []);

  return { makeRequest, cancelAll };
}

/**
 * Utility for debouncing async operations with cancellation
 */
export class AsyncDebouncer<T> {
  private timeoutId: NodeJS.Timeout | null = null;
  private currentRequest: CancellableRequest<T> | null = null;

  constructor(
    private readonly delay: number,
    private readonly requestFactory: (abortSignal: AbortSignal) => Promise<T>
  ) {}

  debounce(config?: RequestConfig): Promise<T> {
    // Cancel previous timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Cancel previous request
    if (this.currentRequest && !this.currentRequest.isCancelled()) {
      this.currentRequest.cancel();
    }

    return new Promise((resolve, reject) => {
      this.timeoutId = setTimeout(() => {
        this.currentRequest = makeCancellable(this.requestFactory, config);
        
        this.currentRequest.promise
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.currentRequest = null;
          });
      }, this.delay);
    });
  }

  cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    if (this.currentRequest && !this.currentRequest.isCancelled()) {
      this.currentRequest.cancel();
      this.currentRequest = null;
    }
  }
}

/**
 * Utility for throttling async operations
 */
export class AsyncThrottler<T> {
  private lastExecution = 0;
  private currentRequest: CancellableRequest<T> | null = null;

  constructor(
    private readonly delay: number,
    private readonly requestFactory: (abortSignal: AbortSignal) => Promise<T>
  ) {}

  throttle(config?: RequestConfig): Promise<T> | null {
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecution;

    if (timeSinceLastExecution < this.delay) {
      return null; // Too soon, throttled
    }

    // Cancel previous request if still running
    if (this.currentRequest && !this.currentRequest.isCancelled()) {
      this.currentRequest.cancel();
    }

    this.lastExecution = now;
    this.currentRequest = makeCancellable(this.requestFactory, config);

    this.currentRequest.promise.finally(() => {
      this.currentRequest = null;
    });

    return this.currentRequest.promise;
  }

  cancel() {
    if (this.currentRequest && !this.currentRequest.isCancelled()) {
      this.currentRequest.cancel();
      this.currentRequest = null;
    }
  }
}

/**
 * Sequential executor that ensures operations run in order
 */
export class SequentialExecutor<T> {
  private queue: Array<() => Promise<T>> = [];
  private running = false;
  private currentRequest: CancellableRequest<T> | null = null;

  async execute(
    promiseFactory: (abortSignal: AbortSignal) => Promise<T>,
    config?: RequestConfig
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const request = makeCancellable(promiseFactory, config);
          this.currentRequest = request;
          
          const result = await request.promise;
          this.currentRequest = null;
          resolve(result);
          return result;
        } catch (error) {
          this.currentRequest = null;
          reject(error);
          throw error;
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.running || this.queue.length === 0) {
      return;
    }

    this.running = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          // Error handling is done in individual tasks
        }
      }
    }

    this.running = false;
  }

  cancel() {
    this.queue = [];
    if (this.currentRequest && !this.currentRequest.isCancelled()) {
      this.currentRequest.cancel();
    }
  }
}

/**
 * Race condition safe state setter
 */
export function createStateSetter<T>(
  initialValue: T,
  onStateChange?: (value: T) => void
) {
  let currentVersion = 0;
  let currentValue = initialValue;

  return {
    setValue: (newValue: T | ((prev: T) => T)) => {
      const version = ++currentVersion;
      
      const finalValue = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(currentValue)
        : newValue;

      // Only update if this is still the latest version
      if (version === currentVersion) {
        currentValue = finalValue;
        onStateChange?.(finalValue);
      }
    },
    getValue: () => currentValue,
    getVersion: () => currentVersion
  };
}