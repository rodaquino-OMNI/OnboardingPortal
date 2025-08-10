import { useCallback, useRef, useEffect } from 'react';

/**
 * Hook that returns a stable callback reference that always calls the latest function
 * Useful for fixing exhaustive-deps warnings without causing infinite re-renders
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef<T>(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}