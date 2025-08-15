'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCancellableRequest } from '@/lib/async-utils';

/**
 * Hook for managing async operations with automatic cleanup on unmount
 * Prevents race conditions by checking component mount status before state updates
 */
export function useAsyncSafeState() {
  const mountedRef = useRef(true);
  const { makeRequest, cancelAll } = useCancellableRequest();
  
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      cancelAll();
    };
  }, [cancelAll]);
  
  const isMounted = useCallback(() => mountedRef.current, [mountedRef]);
  
  const safeSetState = useCallback(<T>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: T | ((prev: T) => T)
  ) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);
  
  const safeAsyncOperation = useCallback(async <T>(
    operation: (signal: AbortSignal) => Promise<T>,
    options?: {
      timeout?: number;
      retries?: number;
      retryDelay?: number;
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
      onFinally?: () => void;
    }
  ): Promise<T | undefined> => {
    if (!mountedRef.current) {
      return undefined;
    }
    
    const request = makeRequest(operation, {
      ...(options?.timeout !== undefined && { timeout: options.timeout }),
      ...(options?.retries !== undefined && { retries: options.retries }),
      ...(options?.retryDelay !== undefined && { retryDelay: options.retryDelay }),
    });
    
    try {
      const result = await request.promise;
      
      if (mountedRef.current && !request.isCancelled()) {
        options?.onSuccess?.(result);
        return result;
      }
    } catch (error) {
      if (mountedRef.current && !request.isCancelled()) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        if (!errorObj.message.includes('cancelled')) {
          options?.onError?.(errorObj);
        }
      }
      throw error;
    } finally {
      if (mountedRef.current && !request.isCancelled()) {
        options?.onFinally?.();
      }
    }
    
    return undefined;
  }, [makeRequest]);
  
  return {
    isMounted,
    safeSetState,
    safeAsyncOperation,
    cancelAllRequests: cancelAll,
  };
}

/**
 * Hook for managing loading states with automatic cleanup
 */
export function useAsyncLoadingState<T = any>(initialValue?: T) {
  const [data, setData] = useState<T | undefined>(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isMounted, safeSetState, safeAsyncOperation } = useAsyncSafeState();
  
  const execute = useCallback(async (
    operation: (signal: AbortSignal) => Promise<T>,
    options?: {
      timeout?: number;
      retries?: number;
      retryDelay?: number;
      resetError?: boolean;
    }
  ): Promise<T | undefined> => {
    if (options?.resetError !== false) {
      safeSetState<string | null>(setError, null);
    }
    safeSetState<boolean>(setLoading, true);
    
    try {
      const result = await safeAsyncOperation(operation, {
        ...(options?.timeout !== undefined && { timeout: options.timeout }),
        ...(options?.retries !== undefined && { retries: options.retries }),
        ...(options?.retryDelay !== undefined && { retryDelay: options.retryDelay }),
        onSuccess: (result) => {
          safeSetState<T | undefined>(setData, result);
        },
        onError: (error) => {
          safeSetState<string | null>(setError, error.message);
        },
        onFinally: () => {
          safeSetState<boolean>(setLoading, false);
        },
      });
      
      return result;
    } catch (error) {
      // Error handling is done in safeAsyncOperation
      return undefined;
    }
  }, [safeAsyncOperation, safeSetState]);
  
  const reset = useCallback(() => {
    safeSetState<T | undefined>(setData, initialValue);
    safeSetState<boolean>(setLoading, false);
    safeSetState<string | null>(setError, null);
  }, [initialValue, safeSetState]);
  
  return {
    data,
    loading,
    error,
    execute,
    reset,
    isMounted,
  };
}

/**
 * Hook specifically for API calls with common patterns
 */
export function useApiCall<T = any>() {
  const { data, loading, error, execute, reset, isMounted } = useAsyncLoadingState<T>();
  
  const call = useCallback(async (
    apiCall: () => Promise<T>,
    options?: {
      timeout?: number;
      retries?: number;
      showLoadingAfter?: number;
    }
  ): Promise<T | undefined> => {
    return execute(
      async (signal) => {
        // Add a small delay before showing loading for fast requests
        if (options?.showLoadingAfter) {
          setTimeout(() => {
            if (isMounted() && !signal.aborted) {
              // Loading state is managed by execute
            }
          }, options.showLoadingAfter);
        }
        
        const result = await apiCall();
        
        if (signal.aborted) {
          throw new Error('API call cancelled');
        }
        
        return result;
      },
      {
        timeout: options?.timeout ?? 15000, // Default 15 second timeout
        retries: options?.retries ?? 2, // Default 2 retries
        retryDelay: 1000, // 1 second between retries
      }
    );
  }, [execute, isMounted]);
  
  return {
    data,
    loading,
    error,
    call,
    reset,
    isMounted,
  };
}

/**
 * Hook for handling file uploads with progress tracking
 */
export function useFileUpload() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const { data, loading, error, execute, reset } = useAsyncLoadingState();
  
  const upload = useCallback(async (
    file: File,
    uploadFn: (file: File, onProgress: (progress: number, status: string) => void, signal: AbortSignal) => Promise<any>,
    options?: {
      timeout?: number;
    }
  ) => {
    setProgress(0);
    setStatus('Preparando upload...');
    
    return execute(
      async (signal) => {
        const result = await uploadFn(
          file,
          (progress, status) => {
            if (!signal.aborted) {
              setProgress(progress);
              setStatus(status);
            }
          },
          signal
        );
        
        if (signal.aborted) {
          throw new Error('Upload cancelled');
        }
        
        return result;
      },
      {
        timeout: options?.timeout ?? 60000, // Default 60 second timeout for uploads
      }
    );
  }, [execute]);
  
  const resetUpload = useCallback(() => {
    setProgress(0);
    setStatus('');
    reset();
  }, [reset]);
  
  return {
    data,
    loading,
    error,
    progress,
    status,
    upload,
    reset: resetUpload,
  };
}