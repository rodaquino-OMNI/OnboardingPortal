/**
 * Performance optimization examples and patterns
 * CRITICAL FIX: Document and implement performance best practices
 */

import { memo, useMemo, useCallback, lazy, Suspense } from 'react';
import { usePerformanceMonitor } from './performance-monitor';

// Example 1: Optimized component with React.memo and proper dependency arrays
interface OptimizedComponentProps {
  data: any[];
  onAction: (id: string) => void;
  isLoading: boolean;
}

const OptimizedComponent = memo(function OptimizedComponent({
  data,
  onAction,
  isLoading
}: OptimizedComponentProps) {
  const { startTiming } = usePerformanceMonitor('OptimizedComponent');

  // Memoize expensive calculations
  const processedData = useMemo(() => {
    const endTiming = startTiming('render');
    
    const result = data.map(item => ({
      ...item,
      processed: true,
      displayValue: `${item.name} (${item.count})`
    }));
    
    endTiming();
    return result;
  }, [data, startTiming]);

  // Memoize event handlers to prevent child re-renders
  const handleAction = useCallback((id: string) => {
    onAction(id);
  }, [onAction]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {processedData.map(item => (
        <div key={item.id} onClick={() => handleAction(item.id)}>
          {item.displayValue}
        </div>
      ))}
    </div>
  );
});

// Example 2: Lazy loading with Suspense
const HeavyComponent = lazy(() => import('../components/heavy/HeavyComponent'));

export function LazyLoadingExample() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <HeavyComponent />
    </Suspense>
  );
}

// Example 3: Virtual scrolling for large lists
import { FixedSizeList as List } from 'react-window';

interface VirtualListProps {
  items: any[];
  itemHeight: number;
  height: number;
}

export function VirtualizedList({ items, itemHeight, height }: VirtualListProps) {
  const Row = memo(({ index, style }: { index: number; style: any }) => (
    <div style={style} className="border-b border-gray-200 p-2">
      {items[index].name}
    </div>
  ));

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      itemData={items}
    >
      {Row}
    </List>
  );
}

// Example 4: Image optimization
interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function OptimizedImage({ 
  src, 
  alt, 
  width, 
  height, 
  priority = false 
}: OptimizedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={{ 
        maxWidth: '100%', 
        height: 'auto',
        // Prevent layout shift
        aspectRatio: width && height ? `${width}/${height}` : undefined
      }}
    />
  );
}

// Example 5: Debounced search input
import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function DebouncedSearchInput({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch]);

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
      className="w-full p-2 border border-gray-300 rounded-lg"
    />
  );
}

// Example 6: Intersection Observer for lazy loading
import { useRef, useEffect, useState } from 'react';

function useIntersectionObserver(
  threshold = 0.1,
  rootMargin = '0px'
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  return { ref, isIntersecting };
}

export function LazyLoadOnScroll({ children }: { children: React.ReactNode }) {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <div ref={ref}>
      {isIntersecting ? children : (
        <div className="h-32 bg-gray-100 animate-pulse rounded" />
      )}
    </div>
  );
}

// Performance monitoring utilities
export function PerformanceReport() {
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    // Get performance metrics
    if ('performance' in window) {
      const navigationTiming = performance.getEntriesByType('navigation')[0] as any;
      const paintTiming = performance.getEntriesByType('paint');
      
      setMetrics([
        { name: 'DOM Content Loaded', value: navigationTiming?.domContentLoadedEventEnd - navigationTiming?.domContentLoadedEventStart },
        { name: 'Load Complete', value: navigationTiming?.loadEventEnd - navigationTiming?.loadEventStart },
        ...paintTiming.map(entry => ({ name: entry.name, value: entry.startTime }))
      ]);
    }
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg max-w-sm">
      <h4 className="font-semibold mb-2">Performance Metrics</h4>
      <div className="space-y-1 text-sm">
        {metrics.map((metric, index) => (
          <div key={index} className="flex justify-between">
            <span>{metric.name}:</span>
            <span className={metric.value > 100 ? 'text-red-600' : 'text-green-600'}>
              {metric.value?.toFixed(2)}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { OptimizedComponent };