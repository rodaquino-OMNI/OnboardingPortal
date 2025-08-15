'use client';

import { useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import type { ApiError } from '@/lib/api/auth';
import type { ApiResponse } from '@/types';

interface UseApiOptions {
  onSuccess?: <T>(data: T) => void;
  onError?: (error: ApiError) => void;
}

export function useApi<T = unknown>(options?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (apiCall: () => Promise<T>) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiCall();
        setData(result);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err as AxiosError<ApiError>;
        const apiError: ApiError = {
          message: error.response?.data?.message || 'Ocorreu um erro inesperado',
          ...(error.response?.data?.errors && { errors: error.response.data.errors }),
        };
        setError(apiError);
        options?.onError?.(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    execute,
    reset,
  };
}