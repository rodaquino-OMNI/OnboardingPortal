// Performance optimization utilities for health questionnaire

import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (lastArgs) {
        func(...lastArgs);
      }
    }, wait);
  };
  
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debounced;
}

// Simple throttle implementation
function throttle<T extends (...args: any[]) => any>(func: T, wait: number) {
  let lastTime = 0;
  let timeout: NodeJS.Timeout | null = null;
  
  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - lastTime);
    
    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastTime = now;
      func(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastTime = Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  };
  
  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return throttled;
}

/**
 * Performance configuration for health questionnaire
 */
export const PERFORMANCE_CONFIG = {
  // Debounce delays
  AUTOSAVE_DEBOUNCE: 2000, // 2 seconds
  VALIDATION_DEBOUNCE: 500, // 500ms
  SEARCH_DEBOUNCE: 300, // 300ms
  
  // Throttle delays
  PROGRESS_UPDATE_THROTTLE: 1000, // 1 second
  ANALYTICS_THROTTLE: 2000, // 2 seconds
  
  // Animation durations
  TRANSITION_DURATION: 200, // 200ms for smooth but snappy
  FADE_DURATION: 150, // 150ms for fades
  
  // Lazy loading
  INTERSECTION_THRESHOLD: 0.1, // 10% visible before loading
  PRELOAD_SECTIONS: 2, // Preload next 2 sections
  
  // Memory management
  MAX_CACHED_RESPONSES: 100, // Max responses to keep in memory
  CLEANUP_INTERVAL: 60000, // Clean up every minute
};

/**
 * Optimize re-renders by memoizing question components
 */
export const optimizeQuestionRender = (Component: React.ComponentType<any>) => {
  return memo(Component, (prevProps, nextProps) => {
    // Only re-render if essential props change
    return (
      prevProps.question.id === nextProps.question.id &&
      prevProps.value === nextProps.value &&
      prevProps.error === nextProps.error &&
      prevProps.isProcessing === nextProps.isProcessing
    );
  });
};

/**
 * Create optimized callbacks with proper memoization
 */
export function useOptimizedCallbacks() {
  const callbackCache = useRef(new Map());
  
  const createOptimizedCallback = useCallback((key: string, callback: Function, deps: any[]) => {
    const cacheKey = `${key}-${JSON.stringify(deps)}`;
    
    if (!callbackCache.current.has(cacheKey)) {
      callbackCache.current.set(cacheKey, callback);
    }
    
    return callbackCache.current.get(cacheKey);
  }, []);
  
  // Cleanup old callbacks periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (callbackCache.current.size > 50) {
        callbackCache.current.clear();
      }
    }, PERFORMANCE_CONFIG.CLEANUP_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);
  
  return { createOptimizedCallback };
}

/**
 * Debounced auto-save hook
 */
export function useAutoSave(
  saveFunction: (data: any) => Promise<void>,
  data: any,
  enabled: boolean = true
) {
  const debouncedSave = useMemo(
    () => debounce(saveFunction, PERFORMANCE_CONFIG.AUTOSAVE_DEBOUNCE),
    [saveFunction]
  );
  
  useEffect(() => {
    if (enabled && data) {
      debouncedSave(data);
    }
    
    return () => {
      debouncedSave.cancel();
    };
  }, [data, enabled, debouncedSave]);
}

/**
 * Throttled progress updates
 */
export function useThrottledProgress(
  updateFunction: (progress: number) => void,
  progress: number
) {
  const throttledUpdate = useMemo(
    () => throttle(updateFunction, PERFORMANCE_CONFIG.PROGRESS_UPDATE_THROTTLE),
    [updateFunction]
  );
  
  useEffect(() => {
    throttledUpdate(progress);
    
    return () => {
      throttledUpdate.cancel();
    };
  }, [progress, throttledUpdate]);
}

/**
 * Virtual scrolling for long questionnaires
 */
export function useVirtualQuestions(questions: any[], containerHeight: number) {
  const ITEM_HEIGHT = 400; // Average question height
  const BUFFER_SIZE = 3; // Extra items to render
  
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const endIndex = Math.min(
      questions.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, questions.length]);
  
  const visibleQuestions = questions.slice(visibleRange.startIndex, visibleRange.endIndex);
  const totalHeight = questions.length * ITEM_HEIGHT;
  const offsetY = visibleRange.startIndex * ITEM_HEIGHT;
  
  return {
    visibleQuestions,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };
}

/**
 * Lazy load sections with intersection observer
 */
export function useLazySection(sectionId: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      {
        threshold: PERFORMANCE_CONFIG.INTERSECTION_THRESHOLD
      }
    );
    
    observer.observe(ref.current);
    
    return () => observer.disconnect();
  }, []);
  
  return { ref, isLoaded };
}

/**
 * Optimize animations with CSS instead of JS
 */
export const transitionStyles = {
  fadeIn: {
    opacity: 0,
    transition: `opacity ${PERFORMANCE_CONFIG.FADE_DURATION}ms ease-in-out`,
    '&.loaded': {
      opacity: 1
    }
  },
  
  slideIn: {
    transform: 'translateX(20px)',
    opacity: 0,
    transition: `all ${PERFORMANCE_CONFIG.TRANSITION_DURATION}ms ease-out`,
    '&.loaded': {
      transform: 'translateX(0)',
      opacity: 1
    }
  },
  
  scaleIn: {
    transform: 'scale(0.95)',
    opacity: 0,
    transition: `all ${PERFORMANCE_CONFIG.TRANSITION_DURATION}ms ease-out`,
    '&.loaded': {
      transform: 'scale(1)',
      opacity: 1
    }
  }
};

/**
 * Preload next sections for smooth navigation
 */
export function usePreloadSections(
  currentSectionIndex: number,
  sections: any[],
  loadSection: (index: number) => void
) {
  useEffect(() => {
    // Preload next sections
    for (let i = 1; i <= PERFORMANCE_CONFIG.PRELOAD_SECTIONS; i++) {
      const nextIndex = currentSectionIndex + i;
      if (nextIndex < sections.length) {
        // Use requestIdleCallback for non-critical preloading
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => loadSection(nextIndex));
        } else {
          setTimeout(() => loadSection(nextIndex), 100);
        }
      }
    }
  }, [currentSectionIndex, sections.length, loadSection]);
}

/**
 * Memory-efficient response storage
 */
export class ResponseCache {
  private cache: Map<string, any>;
  private accessOrder: string[];
  
  constructor(private maxSize: number = PERFORMANCE_CONFIG.MAX_CACHED_RESPONSES) {
    this.cache = new Map();
    this.accessOrder = [];
  }
  
  set(key: string, value: any) {
    // Remove from access order if exists
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    
    // Add to end (most recent)
    this.accessOrder.push(key);
    this.cache.set(key, value);
    
    // Evict oldest if over limit
    if (this.cache.size > this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }
  
  get(key: string) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recent)
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
        this.accessOrder.push(key);
      }
    }
    return value;
  }
  
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }
}