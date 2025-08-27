'use client';

import { lazy, Suspense, ComponentType, memo, ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { logger } from './logger';
import { usePerformanceMonitor } from './react-performance-utils';

/**
 * Enhanced lazy loading with error boundaries and loading states
 */

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ComponentType<{ error: Error; resetError: () => void }>;
  componentName?: string;
}

const DefaultLoadingFallback = memo(function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
});

const DefaultErrorFallback = memo(function DefaultErrorFallback({ 
  error, 
  resetError 
}: { 
  error: Error; 
  resetError: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-4">
      <div className="text-red-600 mb-4">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.768 0L3.046 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Ops! Algo deu errado
      </h3>
      <p className="text-gray-600 text-center mb-4">
        Ocorreu um erro ao carregar este componente. Você pode tentar novamente.
      </p>
      <button
        onClick={resetError}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        Tentar Novamente
      </button>
    </div>
  );
});

const LazyWrapper = memo(function LazyWrapper({
  children,
  fallback,
  errorFallback,
  componentName
}: LazyWrapperProps) {
  const { renderStats } = usePerformanceMonitor(componentName || 'LazyComponent');

  const handleError = (error: Error, errorInfo: any) => {
    logger.error(`Lazy component error: ${componentName}`, error, errorInfo, 'LazyWrapper');
  };

  const ErrorComponent = errorFallback || DefaultErrorFallback;
  const LoadingComponent = fallback || <DefaultLoadingFallback />;

  return (
    <ErrorBoundary
      FallbackComponent={ErrorComponent}
      onError={handleError}
      onReset={() => window.location.reload()}
    >
      <Suspense fallback={LoadingComponent}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
});

/**
 * Enhanced lazy loading function with performance tracking
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    componentName?: string;
    fallback?: ReactNode;
    errorFallback?: ComponentType<{ error: Error; resetError: () => void }>;
    preload?: boolean;
    retryCount?: number;
  } = {}
) {
  const {
    componentName = 'LazyComponent',
    fallback,
    errorFallback,
    preload = false,
    retryCount = 3
  } = options;

  // Enhanced import function with retry logic
  const importWithRetry = async (retries = retryCount): Promise<{ default: T }> => {
    const startTime = performance.now();
    
    try {
      const module = await importFn();
      const loadTime = performance.now() - startTime;
      
      logger.info(`Lazy loaded ${componentName}`, {
        loadTime,
        retries: retryCount - retries
      }, 'LazyLoader');
      
      // Track performance
      if (loadTime > 1000) {
        logger.warn(`Slow lazy load: ${componentName} took ${loadTime}ms`, {
          loadTime
        }, 'LazyLoader');
      }
      
      return module;
    } catch (error) {
      logger.error(`Failed to load ${componentName}`, error, null, 'LazyLoader');
      
      if (retries > 0) {
        logger.info(`Retrying ${componentName} load (${retryCount - retries + 1}/${retryCount})`, null, 'LazyLoader');
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - retries) * 1000));
        return importWithRetry(retries - 1);
      }
      
      throw error;
    }
  };

  const LazyComponent = lazy(importWithRetry);

  // Preload component if requested
  if (preload) {
    // Preload after a short delay to not block initial render
    setTimeout(() => {
      importWithRetry().catch(() => {
        // Preload failures are non-critical
      });
    }, 100);
  }

  return memo(function LazyComponentWrapper(props: any) {
    return (
      <LazyWrapper
        componentName={componentName}
        fallback={fallback}
        errorFallback={errorFallback}
      >
        <LazyComponent {...props} />
      </LazyWrapper>
    );
  });
}

/**
 * Preload a lazy component
 */
export function preloadComponent(importFn: () => Promise<any>) {
  return importFn().catch(error => {
    logger.warn('Failed to preload component', error, null, 'LazyLoader');
  });
}

/**
 * Batch preload multiple components
 */
export function preloadComponents(importFns: Array<() => Promise<any>>) {
  return Promise.allSettled(
    importFns.map(importFn => preloadComponent(importFn))
  );
}

// Pre-defined lazy components for common use cases
export const LazyHealthQuestionnaire = createLazyComponent(
  () => import('@/components/health/UnifiedHealthAssessment'),
  {
    componentName: 'HealthQuestionnaire',
    preload: true // High priority component
  }
);

export const LazyInterviewScheduler = createLazyComponent(
  () => import('@/components/interview/InterviewScheduler'),
  {
    componentName: 'InterviewScheduler'
  }
);

export const LazyDocumentUpload = createLazyComponent(
  () => import('@/components/upload/EnhancedDocumentUpload'),
  {
    componentName: 'DocumentUpload'
  }
);

export const LazyVideoConferencing = createLazyComponent(
  () => import('@/components/video/VideoConferencing'),
  {
    componentName: 'VideoConferencing'
  }
);

export const LazyAdminDashboard = createLazyComponent(
  () => import('@/components/admin/AdminDashboard'),
  {
    componentName: 'AdminDashboard'
  }
);

// Chart components - heavy libraries
export const LazyChartComponents = {
  PerformanceChart: createLazyComponent(
    () => import('@/components/admin/dashboard/PerformanceChart'),
    {
      componentName: 'PerformanceChart'
    }
  ),
  
  MetricCard: createLazyComponent(
    () => import('@/components/admin/dashboard/MetricCard'),
    {
      componentName: 'MetricCard'
    }
  )
};

// Utility components
export const LazyPDFGeneration = createLazyComponent(
  () => import('@/components/pdf/PDFGenerationCenter'),
  {
    componentName: 'PDFGeneration'
  }
);

export const LazyOCRUpload = createLazyComponent(
  () => import('@/components/upload/EnhancedDocumentUpload'),
  {
    componentName: 'OCRUpload'
  }
);

/**
 * Route-based lazy loading
 */
export const LazyPages = {
  Dashboard: createLazyComponent(
    () => import('@/app/(dashboard)/page'),
    {
      componentName: 'DashboardPage',
      preload: true
    }
  ),
  
  HealthQuestionnaire: createLazyComponent(
    () => import('@/app/(onboarding)/health-questionnaire/page'),
    {
      componentName: 'HealthQuestionnairePage'
    }
  ),
  
  InterviewSchedule: createLazyComponent(
    () => import('@/app/(onboarding)/interview-schedule/page'),
    {
      componentName: 'InterviewSchedulePage'
    }
  ),
  
  DocumentUpload: createLazyComponent(
    () => import('@/app/(onboarding)/document-upload/page'),
    {
      componentName: 'DocumentUploadPage'
    }
  ),
  
  AdminHealthRisks: createLazyComponent(
    () => import('@/app/(admin)/health-risks/page'),
    {
      componentName: 'AdminHealthRisksPage'
    }
  )
};

/**
 * Progressive loading for multi-step components
 */
export class ProgressiveLoader {
  private loadedComponents = new Set<string>();
  private loadPromises = new Map<string, Promise<any>>();

  async loadStep(stepId: string, importFn: () => Promise<any>) {
    if (this.loadedComponents.has(stepId)) {
      return;
    }

    if (this.loadPromises.has(stepId)) {
      return this.loadPromises.get(stepId);
    }

    const promise = importFn().then(module => {
      this.loadedComponents.add(stepId);
      this.loadPromises.delete(stepId);
      return module;
    }).catch(error => {
      this.loadPromises.delete(stepId);
      throw error;
    });

    this.loadPromises.set(stepId, promise);
    return promise;
  }

  preloadNextStep(stepId: string, importFn: () => Promise<any>) {
    // Preload without waiting
    this.loadStep(stepId, importFn).catch(() => {
      // Ignore preload failures
    });
  }

  reset() {
    this.loadedComponents.clear();
    this.loadPromises.clear();
  }
}

export const globalProgressiveLoader = new ProgressiveLoader();

/**
 * Hook for managing lazy component loading state
 */
export function useLazyLoading() {
  const [loadingComponents, setLoadingComponents] = useState<Set<string>>(new Set());
  
  const startLoading = useCallback((componentName: string) => {
    setLoadingComponents(prev => new Set(prev).add(componentName));
  }, []);
  
  const stopLoading = useCallback((componentName: string) => {
    setLoadingComponents(prev => {
      const next = new Set(prev);
      next.delete(componentName);
      return next;
    });
  }, []);
  
  const isLoading = useCallback((componentName: string) => {
    return loadingComponents.has(componentName);
  }, [loadingComponents]);
  
  return {
    startLoading,
    stopLoading,
    isLoading,
    loadingCount: loadingComponents.size
  };
}

export { LazyWrapper, DefaultLoadingFallback, DefaultErrorFallback };