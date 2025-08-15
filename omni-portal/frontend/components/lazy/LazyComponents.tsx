/**
 * Lazy-loaded components for better performance
 * CRITICAL FIX: Implement lazy loading for heavy components
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading component for better UX
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-2 text-gray-600">Carregando...</span>
  </div>
);

// Error boundary for lazy components
const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <h3 className="text-red-800 font-medium">Algo deu errado</h3>
    <p className="text-red-600 text-sm mt-1">{error.message}</p>
    <button 
      onClick={() => window.location.reload()} 
      className="mt-2 text-red-800 underline text-sm"
    >
      Reload page
    </button>
  </div>
);

// Lazy load heavy components with performance optimizations
export const LazyUnifiedHealthAssessment = dynamic(
  () => import('../health/UnifiedHealthAssessment').then(mod => ({ default: mod.UnifiedHealthAssessment })),
  {
    loading: () => <LoadingSpinner />,
    ssr: false, // Disable SSR for client-heavy components
  }
);

export const LazyEnhancedDocumentUpload = dynamic(
  () => import('../upload/EnhancedDocumentUpload').then(mod => ({ default: mod.EnhancedDocumentUpload })),
  {
    loading: () => <LoadingSpinner />,
    ssr: false, // OCR functionality is client-side only
  }
);

export const LazyProgressCard = dynamic(
  () => import('../gamification/ProgressCard').then(mod => ({ default: mod.ProgressCard })),
  {
    loading: () => (
      <div className="card-modern p-6">
        <div className="space-y-4">
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4 animate-pulse"></div>
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse"></div>
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    ),
    ssr: true, // Gamification can be SSR'd
  }
);

export const LazyBadgeDisplay = dynamic(
  () => import('../gamification/BadgeDisplay').then(mod => ({ default: mod.BadgeDisplay })),
  {
    loading: () => (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    ),
  }
);

export const LazyVideoConferencing = dynamic(
  () => import('../video/VideoConferencing').then(mod => ({ default: mod.VideoConferencing })),
  {
    loading: () => <LoadingSpinner />,
    ssr: false, // Video components are client-side only
  }
);

// Higher-order component for lazy loading with error boundary
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  options: {
    loading?: ComponentType;
    error?: ComponentType<{ error: Error }>;
    ssr?: boolean;
  } = {}
) {
  return dynamic(
    () => Promise.resolve({ default: Component }),
    {
      loading: () => React.createElement(options.loading || LoadingSpinner),
      ssr: options.ssr !== false,
    }
  );
}

// Preload components when they're likely to be needed
export const preloadComponents = {
  healthAssessment: () => import('../health/UnifiedHealthAssessment'),
  documentUpload: () => import('../upload/EnhancedDocumentUpload'),
  videoConferencing: () => import('../video/VideoConferencing'),
  gamification: () => Promise.all([
    import('../gamification/ProgressCard'),
    import('../gamification/BadgeDisplay'),
  ]),
};

// Preload based on route or user interaction
export function preloadForRoute(route: string) {
  switch (route) {
    case '/health-questionnaire':
      preloadComponents.healthAssessment();
      break;
    case '/document-upload':
      preloadComponents.documentUpload();
      break;
    case '/video-consultation':
      preloadComponents.videoConferencing();
      break;
    case '/home':
      preloadComponents.gamification();
      break;
  }
}