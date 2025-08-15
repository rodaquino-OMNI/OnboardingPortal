// Dynamic Import Manager for Bundle Size Optimization
// Handles all heavy dependencies with lazy loading and proper code splitting

import dynamic from 'next/dynamic';
import React, { ComponentType, LazyExoticComponent } from 'react';

// Tesseract.js dynamic import with proper loading states
export const loadTesseract = async () => {
  const { createWorker } = await import('tesseract.js');
  return { createWorker };
};

// jsPDF dynamic import with minimal bundle impact
export const loadJsPDF = async () => {
  const { jsPDF } = await import('jspdf');
  return { jsPDF };
};

// Chart.js dynamic imports for analytics
export const loadChartJS = async () => {
  const [
    { Chart, registerables },
    { default: LineChart },
    { default: BarChart },
    { default: PieChart }
  ] = await Promise.all([
    import('chart.js'),
    import('react-chartjs-2').then(mod => ({ default: mod.Line })),
    import('react-chartjs-2').then(mod => ({ default: mod.Bar })),
    import('react-chartjs-2').then(mod => ({ default: mod.Pie }))
  ]);
  
  Chart.register(...registerables);
  
  return {
    Chart,
    LineChart,
    BarChart,
    PieChart
  };
};

// Framer Motion dynamic import for animations
export const loadFramerMotion = async () => {
  const { motion, AnimatePresence } = await import('framer-motion');
  return { motion, AnimatePresence };
};

// React Query dynamic import
export const loadReactQuery = async () => {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  return { QueryClient, QueryClientProvider };
};

// Heavy form validation dynamic import
export const loadFormValidation = async () => {
  const { z } = await import('zod');
  const { zodResolver } = await import('@hookform/resolvers/zod');
  return { z, zodResolver };
};

// Date manipulation dynamic import
export const loadDateUtils = async () => {
  const { format, parseISO, addDays } = await import('date-fns');
  return { format, parseISO, addDays };
};

// Lodash utilities dynamic import
export const loadLodashUtils = async () => {
  const { debounce, throttle, cloneDeep } = await import('lodash-es');
  return { debounce, throttle, cloneDeep };
};

// Dynamic component loader with better error boundaries and loading states
export function createDynamicComponent<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: {
    displayName?: string;
    ssr?: boolean;
    loading?: ComponentType;
  } = {}
): LazyExoticComponent<ComponentType<T>> {
  const DefaultLoading = () => {
    return React.createElement('div', {
      className: 'flex items-center justify-center p-4'
    }, React.createElement('div', {
      className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-primary'
    }));
  };

  return dynamic(importFn, {
    ssr: options.ssr ?? false,
    loading: options.loading || DefaultLoading
  });
}

// Heavy component dynamic imports
export const DynamicHealthQuestionnaire = createDynamicComponent(
  () => import('@/components/health/UnifiedHealthQuestionnaire'),
  { displayName: 'HealthQuestionnaire' }
);

export const DynamicPDFGenerator = createDynamicComponent(
  () => import('@/components/pdf/PDFGenerationCenter'),
  { displayName: 'PDFGenerator' }
);

export const DynamicVideoChat = createDynamicComponent(
  () => import('@/components/video/VideoChat'),
  { displayName: 'VideoChat' }
);

export const DynamicAdminDashboard = createDynamicComponent(
  () => import('@/components/admin/AdminDashboard'),
  { displayName: 'AdminDashboard' }
);

export const DynamicDocumentUpload = createDynamicComponent(
  () => import('@/components/upload/EnhancedDocumentUpload'),
  { displayName: 'DocumentUpload' }
);

export const DynamicGamificationFeatures = createDynamicComponent(
  () => import('@/components/gamification/ProgressCard'),
  { displayName: 'GamificationFeatures' }
);

// Preload critical components on user interaction
export const preloadCriticalComponents = () => {
  // Preload commonly used heavy components
  setTimeout(() => {
    import('@/components/health/UnifiedHealthQuestionnaire');
    import('@/components/upload/EnhancedDocumentUpload');
  }, 100);
};

// Preload on route change
export const preloadRouteComponents = (route: string) => {
  switch (route) {
    case '/health-questionnaire':
      import('@/components/health/UnifiedHealthQuestionnaire');
      import('@/components/gamification/ProgressCard');
      break;
    case '/admin':
      import('@/components/admin/AdminDashboard');
      break;
    case '/profile':
      import('@/components/pdf/PDFGenerationCenter');
      break;
    case '/video-call':
      import('@/components/video/VideoChat');
      break;
  }
};

// Bundle analyzer helper for development
export const getBundleInfo = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Dynamic imports configured for:');
    console.log('- Tesseract.js (OCR)');
    console.log('- jsPDF (PDF generation)');
    console.log('- Chart.js (Analytics)');
    console.log('- Framer Motion (Animations)');
    console.log('- Heavy React components');
  }
};