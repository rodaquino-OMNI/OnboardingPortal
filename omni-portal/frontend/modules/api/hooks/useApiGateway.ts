/**
 * useApiGateway - React hooks for API Gateway
 * Provides type-safe API access through unified gateway
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiGateway, ApiRequest, ApiResponse, ApiOperation } from '../ApiGateway';

/**
 * Hook for making API requests through the gateway
 */
export function useApiRequest<T = any>(
  request: ApiRequest,
  options?: {
    immediate?: boolean;
    cache?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    transform?: (data: any) => T;
    validate?: (data: any) => boolean;
  }
) {
  const [data, setData] = useState<T | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const execute = useCallback(async (overrides?: Partial<ApiRequest>) => {
    setLoading(true);
    setError(null);

    const operation: ApiOperation<T> = {
      request: { ...request, ...overrides, cache: options?.cache },
      transform: options?.transform,
      validate: options?.validate,
      onError: (err) => {
        const errorMessage = err.message || 'Request failed';
        setError(errorMessage);
        options?.onError?.(errorMessage);
      }
    };

    try {
      const response = await apiGateway.execute<T>(operation);

      if (response.success && response.data !== undefined) {
        setData(response.data);
        options?.onSuccess?.(response.data);
      } else if (response.error) {
        setError(response.error);
        options?.onError?.(response.error);
      }

      return response;
    } finally {
      setLoading(false);
    }
  }, [request, options]);

  // Execute immediately if specified
  useEffect(() => {
    if (options?.immediate) {
      execute();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current();
      }
    };
  }, []);

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset
  };
}

/**
 * Hook for paginated API requests
 */
export function usePaginatedApi<T = any>(
  baseRequest: Omit<ApiRequest, 'endpoint'>,
  endpoint: (page: number) => string,
  options?: {
    initialPage?: number;
    pageSize?: number;
    transform?: (data: any) => T[];
  }
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(options?.initialPage || 1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (pageNumber: number) => {
    setLoading(true);
    setError(null);

    const operation: ApiOperation = {
      request: {
        ...baseRequest,
        endpoint: endpoint(pageNumber)
      },
      transform: options?.transform
    };

    try {
      const response = await apiGateway.execute(operation);

      if (response.success && response.data) {
        const newItems = Array.isArray(response.data) ? response.data : response.data.items || [];
        
        if (pageNumber === 1) {
          setItems(newItems);
        } else {
          setItems(prev => [...prev, ...newItems]);
        }

        setHasMore(newItems.length === (options?.pageSize || 10));
        setPage(pageNumber);
      } else if (response.error) {
        setError(response.error);
      }
    } finally {
      setLoading(false);
    }
  }, [baseRequest, endpoint, options]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadPage(page + 1);
    }
  }, [loading, hasMore, page, loadPage]);

  const refresh = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    loadPage(1);
  }, [loadPage]);

  // Load first page on mount
  useEffect(() => {
    loadPage(1);
  }, []);

  return {
    items,
    loading,
    error,
    hasMore,
    page,
    loadMore,
    refresh
  };
}

/**
 * Hook for CRUD operations
 */
export function useCrudApi<T extends { id: string | number }>(
  resource: string,
  options?: {
    transform?: (data: any) => T;
    validate?: (data: any) => boolean;
  }
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List all items
  const list = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await apiGateway.execute<T[]>({
      request: {
        method: 'GET',
        endpoint: `/api/${resource}`
      },
      transform: options?.transform ? 
        (data) => data.map(options.transform!) : 
        undefined
    });

    if (response.success && response.data) {
      setItems(response.data);
    } else if (response.error) {
      setError(response.error);
    }

    setLoading(false);
    return response;
  }, [resource, options]);

  // Get single item
  const get = useCallback(async (id: string | number) => {
    const response = await apiGateway.execute<T>({
      request: {
        method: 'GET',
        endpoint: `/api/${resource}/${id}`
      },
      transform: options?.transform,
      validate: options?.validate
    });

    return response;
  }, [resource, options]);

  // Create item
  const create = useCallback(async (data: Omit<T, 'id'>) => {
    setLoading(true);
    setError(null);

    const response = await apiGateway.execute<T>({
      request: {
        method: 'POST',
        endpoint: `/api/${resource}`,
        body: data
      },
      transform: options?.transform,
      validate: options?.validate
    });

    if (response.success && response.data) {
      setItems(prev => [...prev, response.data!]);
    } else if (response.error) {
      setError(response.error);
    }

    setLoading(false);
    return response;
  }, [resource, options]);

  // Update item
  const update = useCallback(async (id: string | number, data: Partial<T>) => {
    setLoading(true);
    setError(null);

    const response = await apiGateway.execute<T>({
      request: {
        method: 'PUT',
        endpoint: `/api/${resource}/${id}`,
        body: data
      },
      transform: options?.transform,
      validate: options?.validate
    });

    if (response.success && response.data) {
      setItems(prev => prev.map(item => 
        item.id === id ? response.data! : item
      ));
    } else if (response.error) {
      setError(response.error);
    }

    setLoading(false);
    return response;
  }, [resource, options]);

  // Delete item
  const remove = useCallback(async (id: string | number) => {
    setLoading(true);
    setError(null);

    const response = await apiGateway.execute({
      request: {
        method: 'DELETE',
        endpoint: `/api/${resource}/${id}`
      }
    });

    if (response.success) {
      setItems(prev => prev.filter(item => item.id !== id));
    } else if (response.error) {
      setError(response.error);
    }

    setLoading(false);
    return response;
  }, [resource]);

  // Load items on mount
  useEffect(() => {
    list();
  }, []);

  return {
    items,
    loading,
    error,
    list,
    get,
    create,
    update,
    remove
  };
}

/**
 * Hook for real-time API subscriptions (polling-based)
 */
export function useApiSubscription<T = any>(
  request: ApiRequest,
  options?: {
    interval?: number; // Polling interval in ms
    enabled?: boolean;
    transform?: (data: any) => T;
    onUpdate?: (data: T) => void;
  }
) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    const operation: ApiOperation<T> = {
      request: { ...request, cache: false },
      transform: options?.transform
    };

    const response = await apiGateway.execute<T>(operation);

    if (response.success && response.data !== undefined) {
      setData(response.data);
      setError(null);
      options?.onUpdate?.(response.data);
    } else if (response.error) {
      setError(response.error);
    }
  }, [request, options]);

  useEffect(() => {
    if (options?.enabled !== false) {
      // Initial fetch
      poll();

      // Set up polling
      intervalRef.current = setInterval(poll, options?.interval || 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [poll, options?.enabled, options?.interval]);

  return {
    data,
    error,
    refresh: poll
  };
}

/**
 * Hook for file upload through API gateway
 */
export function useFileUpload(
  endpoint: string,
  options?: {
    onProgress?: (progress: number) => void;
    onSuccess?: (response: any) => void;
    onError?: (error: string) => void;
  }
) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, additionalData?: Record<string, any>) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    try {
      // For file uploads, we need to bypass the JSON formatting
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${endpoint}`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      options?.onSuccess?.(data);
      
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      
      return { success: false, error: errorMessage };
    } finally {
      setUploading(false);
      setProgress(100);
    }
  }, [endpoint, options]);

  return {
    upload,
    uploading,
    progress,
    error
  };
}