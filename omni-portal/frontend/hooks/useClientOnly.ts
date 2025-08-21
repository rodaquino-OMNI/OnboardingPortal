'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect client-side rendering to prevent hydration mismatches
 * 
 * This hook ensures that client-only code (localStorage, window, etc.)
 * only runs after hydration is complete, preventing SSR/CSR mismatches.
 * 
 * @returns boolean indicating if we're in client-side environment
 */
export function useClientOnly(): boolean {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

/**
 * Hook to safely access client-only APIs
 * 
 * @param clientOnlyValue - Function that returns client-only value
 * @param fallback - Fallback value for server-side rendering
 * @returns The client value after hydration, fallback during SSR
 */
export function useClientValue<T>(
  clientOnlyValue: () => T,
  fallback: T
): T {
  const [value, setValue] = useState<T>(fallback);
  const isClient = useClientOnly();

  useEffect(() => {
    if (isClient) {
      setValue(clientOnlyValue());
    }
  }, [isClient, clientOnlyValue]);

  return value;
}

/**
 * Hook to safely access localStorage
 * 
 * @param key - localStorage key
 * @param defaultValue - Default value if key doesn't exist
 * @returns [value, setValue] tuple
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const isClient = useClientOnly();
  
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (isClient) {
      try {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
          setValue(JSON.parse(stored));
        }
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
      }
    }
  }, [key, isClient]);

  const setStoredValue = (newValue: T) => {
    setValue(newValue);
    if (isClient) {
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.warn(`Error writing localStorage key "${key}":`, error);
      }
    }
  };

  return [value, setStoredValue];
}

/**
 * Hook to safely detect mobile devices
 * 
 * @returns boolean indicating if user is on mobile device
 */
export function useIsMobile(): boolean {
  return useClientValue(
    () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    false
  );
}

/**
 * Hook to safely get current timestamp
 * Prevents hydration mismatches from Date.now() differences
 * 
 * @param refreshInterval - Optional interval to refresh timestamp (ms)
 * @returns current timestamp or null during SSR
 */
export function useTimestamp(refreshInterval?: number): number | null {
  const isClient = useClientOnly();
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef(refreshInterval);

  useEffect(() => {
    if (isClient) {
      setTimestamp(Date.now());
      
      // Only set up interval if refreshInterval is provided and not already running
      if (refreshIntervalRef.current && !intervalRef.current) {
        intervalRef.current = setInterval(() => {
          setTimestamp(Date.now());
        }, refreshIntervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isClient]); // FIX: Removed refreshInterval from dependencies to prevent re-creating intervals

  return timestamp;
}