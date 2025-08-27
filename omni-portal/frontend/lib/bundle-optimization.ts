// Bundle Optimization Utilities
// Provides runtime optimization and monitoring for bundle performance

interface BundleMetrics {
  totalSize: number;
  chunkCount: number;
  loadTime: number;
  memoryUsage: number;
}

interface LazyLoadOptions {
  preload?: boolean;
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
}

class BundleOptimizer {
  private loadedChunks = new Set<string>();
  private loadingChunks = new Map<string, Promise<any>>();
  private metrics: Partial<BundleMetrics> = {};

  /**
   * Intelligent chunk loading with priority and caching
   */
  async loadChunk<T>(
    chunkName: string,
    importFn: () => Promise<T>,
    options: LazyLoadOptions = {}
  ): Promise<T> {
    const { priority = 'medium', timeout = 10000 } = options;

    // Return cached chunk if already loaded
    if (this.loadedChunks.has(chunkName)) {
      return importFn();
    }

    // Return existing loading promise if chunk is currently being loaded
    if (this.loadingChunks.has(chunkName)) {
      return this.loadingChunks.get(chunkName);
    }

    // Create new loading promise with timeout
    const loadingPromise = this.createTimedImport(importFn, timeout, chunkName);
    this.loadingChunks.set(chunkName, loadingPromise);

    try {
      const result = await loadingPromise;
      this.loadedChunks.add(chunkName);
      this.loadingChunks.delete(chunkName);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Chunk loaded: ${chunkName} (priority: ${priority})`);
      }
      
      return result;
    } catch (error) {
      this.loadingChunks.delete(chunkName);
      console.error(`❌ Failed to load chunk: ${chunkName}`, error);
      throw error;
    }
  }

  /**
   * Create import with timeout protection
   */
  private async createTimedImport<T>(
    importFn: () => Promise<T>,
    timeout: number,
    chunkName: string
  ): Promise<T> {
    const startTime = performance.now();
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout loading chunk: ${chunkName}`));
      }, timeout);
    });

    try {
      const result = await Promise.race([importFn(), timeoutPromise]);
      
      // Record load time metric
      const loadTime = performance.now() - startTime;
      this.recordMetric('loadTime', loadTime);
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Preload chunks based on user behavior
   */
  preloadChunks(chunkNames: string[]): void {
    const preloadWithDelay = (chunks: string[], delay: number) => {
      setTimeout(() => {
        chunks.forEach(chunkName => {
          if (!this.loadedChunks.has(chunkName)) {
            this.loadChunkByName(chunkName);
          }
        });
      }, delay);
    };

    // Stagger preloading to avoid overwhelming the network
    const chunkBatches = this.chunkArray(chunkNames, 3);
    chunkBatches.forEach((batch, index) => {
      preloadWithDelay(batch, index * 500);
    });
  }

  /**
   * Load chunk by predefined name mapping
   */
  private async loadChunkByName(chunkName: string): Promise<void> {
    const chunkMap: Record<string, () => Promise<any>> = {
      'health-questionnaire': () => import('@/components/health/UnifiedHealthQuestionnaire'),
      'pdf-generator': () => import('@/components/pdf/PDFGenerationCenter'),
      'document-upload': () => import('@/components/upload/EnhancedDocumentUpload'),
      'video-chat': () => import('@/components/video/VideoChat'),
      'admin-dashboard': () => import('@/components/admin/AdminDashboard'),
      'gamification': () => import('@/components/gamification/ProgressCard'),
      'charts': () => import('chart.js'),
      'tesseract': () => import('tesseract.js'),
      'jspdf': () => import('jspdf'),
      'framer-motion': () => import('framer-motion')
    };

    const importFn = chunkMap[chunkName];
    if (importFn) {
      try {
        await this.loadChunk(chunkName, importFn, { priority: 'low' });
      } catch (error) {
        console.warn(`Failed to preload chunk: ${chunkName}`, error);
      }
    }
  }

  /**
   * Monitor bundle performance
   */
  startPerformanceMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor memory usage
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.recordMetric('memoryUsage', memoryInfo.usedJSHeapSize);
    }

    // Monitor resource loading
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('chunk') || entry.name.includes('.js')) {
          this.recordMetric('totalSize', (entry as any).transferSize || 0);
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  /**
   * Get current bundle metrics
   */
  getMetrics(): BundleMetrics {
    return {
      totalSize: this.metrics.totalSize || 0,
      chunkCount: this.loadedChunks.size,
      loadTime: this.metrics.loadTime || 0,
      memoryUsage: this.metrics.memoryUsage || 0
    };
  }

  /**
   * Record performance metric
   */
  private recordMetric(key: keyof BundleMetrics, value: number): void {
    if (key === 'totalSize') {
      this.metrics[key] = (this.metrics[key] || 0) + value;
    } else {
      this.metrics[key] = value;
    }
  }

  /**
   * Utility to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Clear all loaded chunks (for development/testing)
   */
  clearCache(): void {
    this.loadedChunks.clear();
    this.loadingChunks.clear();
    this.metrics = {};
  }
}

// Singleton instance
export const bundleOptimizer = new BundleOptimizer();

// Route-based chunk preloading strategies
export const RoutePreloadStrategies = {
  '/': ['health-questionnaire'], // Home page preloads health questionnaire
  '/health-questionnaire': ['pdf-generator', 'gamification'],
  '/admin': ['admin-dashboard', 'charts'],
  '/profile': ['pdf-generator', 'document-upload'],
  '/video-call': ['video-chat'],
  '/onboarding': ['health-questionnaire', 'gamification']
};

// Intelligent preloading based on user interaction
export const setupIntelligentPreloading = (): void => {
  if (typeof window === 'undefined') return;

  // Preload on hover (for desktop)
  document.addEventListener('mouseenter', (event) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a[href]') as HTMLAnchorElement;
    
    if (link && link.href) {
      const route = new URL(link.href).pathname;
      const chunks = RoutePreloadStrategies[route as keyof typeof RoutePreloadStrategies];
      
      if (chunks) {
        bundleOptimizer.preloadChunks(chunks);
      }
    }
  }, { passive: true });

  // Preload on focus (for keyboard navigation)
  document.addEventListener('focusin', (event) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a[href]') as HTMLAnchorElement;
    
    if (link && link.href) {
      const route = new URL(link.href).pathname;
      const chunks = RoutePreloadStrategies[route as keyof typeof RoutePreloadStrategies];
      
      if (chunks) {
        bundleOptimizer.preloadChunks(chunks);
      }
    }
  }, { passive: true });

  // Start performance monitoring
  bundleOptimizer.startPerformanceMonitoring();
};

// Bundle size analysis for development
export const analyzeBundleSize = (): void => {
  if (process.env.NODE_ENV !== 'development') return;

  const metrics = bundleOptimizer.getMetrics();
  
  console.group('📦 Bundle Analysis');
  console.log(`Total chunks loaded: ${metrics.chunkCount}`);
  console.log(`Total bundle size: ${(metrics.totalSize / 1024).toFixed(2)} KB`);
  console.log(`Average load time: ${metrics.loadTime.toFixed(2)}ms`);
  console.log(`Memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
  console.groupEnd();
};

// Export utilities for easy integration
export {
  bundleOptimizer as default,
  BundleOptimizer
};