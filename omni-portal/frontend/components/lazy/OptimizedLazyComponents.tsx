// Optimized Lazy Loading Components
// Replaces heavy imports with dynamic loading for better bundle optimization

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Loading components for better UX
const ComponentSkeleton = ({ className = "h-64 w-full" }: { className?: string }) => (
  <div className="animate-pulse space-y-4 p-4">
    <Skeleton className={className} />
    <div className="space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

const SmallComponentSkeleton = () => (
  <div className="animate-pulse">
    <Skeleton className="h-32 w-full" />
  </div>
);

// Health Questionnaire Components - Heavy, should be lazy loaded
export const LazyHealthQuestionnaire = dynamic(
  () => import('@/components/health/UnifiedHealthQuestionnaire').then(mod => ({ default: mod.UnifiedHealthQuestionnaire })),
  {
    loading: () => <ComponentSkeleton className="h-96 w-full" />,
    ssr: false
  }
);

export const LazyHealthAssessment = dynamic(
  () => import('@/components/health/UnifiedHealthAssessment').then(mod => ({ default: mod.UnifiedHealthAssessment })),
  {
    loading: () => <ComponentSkeleton className="h-80 w-full" />,
    ssr: false
  }
);

// PDF Generation - Heavy dependency, definitely lazy
export const LazyPDFGenerator = dynamic(
  () => import('@/components/pdf/PDFGenerationCenter').then(mod => ({ default: mod.PDFGenerationCenter })),
  {
    loading: () => <ComponentSkeleton className="h-48 w-full" />,
    ssr: false
  }
);

// Document Upload with OCR - Very heavy, lazy load
export const LazyDocumentUpload = dynamic(
  () => import('@/components/upload/EnhancedDocumentUpload').then(mod => ({ default: mod.EnhancedDocumentUpload })),
  {
    loading: () => <ComponentSkeleton className="h-64 w-full" />,
    ssr: false
  }
);

// Video Components - Heavy WebRTC dependencies
export const LazyVideoChat = dynamic(
  () => import('@/components/video/VideoChat').then(mod => ({ default: mod.VideoChat })),
  {
    loading: () => <ComponentSkeleton className="h-96 w-full" />,
    ssr: false
  }
);

export const LazyVideoConferencing = dynamic(
  () => import('@/components/video/VideoConferencing').then(mod => ({ default: mod.VideoConferencing })),
  {
    loading: () => <ComponentSkeleton className="h-96 w-full" />,
    ssr: false
  }
);

// Admin Dashboard - Charts and heavy components
export const LazyAdminDashboard = dynamic(
  () => import('@/components/admin/AdminDashboard').then(mod => ({ default: mod.AdminDashboard })),
  {
    loading: () => <ComponentSkeleton className="h-screen w-full" />,
    ssr: false
  }
);

export const LazyUserManagementTable = dynamic(
  () => import('@/components/admin/UserManagementTable').then(mod => ({ default: mod.UserManagementTable })),
  {
    loading: () => <ComponentSkeleton className="h-96 w-full" />,
    ssr: false
  }
);

// Charts and Analytics - Chart.js dependencies
export const LazyPerformanceChart = dynamic(
  () => import('@/components/admin/dashboard/PerformanceChart').then(mod => ({ default: mod.PerformanceChart })),
  {
    loading: () => <SmallComponentSkeleton />,
    ssr: false
  }
);

export const LazyUserAnalyticsChart = dynamic(
  () => import('@/components/admin/dashboard/UserAnalyticsChart').then(mod => ({ default: mod.UserAnalyticsChart })),
  {
    loading: () => <SmallComponentSkeleton />,
    ssr: false
  }
);

// Gamification Features - Animation heavy
// export const LazyProgressCard = dynamic(
//   () => import('@/components/gamification/ProgressCard'),
//   {
//     loading: () => <SmallComponentSkeleton />,
//     ssr: false
//   }
// );

// export const LazyBadgeDisplay = dynamic(
//   () => import('@/components/gamification/BadgeDisplay'),
//   {
//     loading: () => <SmallComponentSkeleton />,
//     ssr: false
//   }
// );

// export const LazyLeaderboard = dynamic(
//   () => import('@/components/gamification/Leaderboard'),
//   {
//     loading: () => <ComponentSkeleton className="h-80 w-full" />,
//     ssr: false
//   }
// );

// Auth Components - Can be lazy loaded for better initial page load
// export const LazyTwoFactorAuth = dynamic(
//   () => import('@/components/auth/TwoFactorAuth'),
//   {
//     loading: () => <SmallComponentSkeleton />,
//     ssr: false
//   }
// );

// export const LazySocialAuth = dynamic(
//   () => import('@/components/auth/SocialAuth'),
//   {
//     loading: () => <SmallComponentSkeleton />,
//     ssr: false
//   }
// );

// LGPD Components - Legal compliance, not critical for initial load
// export const LazyLGPDPrivacySettings = dynamic(
//   () => import('@/components/lgpd/LGPDPrivacySettings'),
//   {
//     loading: () => <ComponentSkeleton />,
//     ssr: false
//   }
// );

// export const LazyLGPDDataExport = dynamic(
//   () => import('@/components/lgpd/LGPDDataExport'),
//   {
//     loading: () => <ComponentSkeleton />,
//     ssr: false
//   }
// );

// Health Risk Analysis - Admin heavy features
export const LazyPredictiveAnalyticsDashboard = dynamic(
  () => import('@/components/admin/health-risks/PredictiveAnalyticsDashboard'),
  {
    loading: () => <ComponentSkeleton className="h-screen w-full" />,
    ssr: false
  }
);

export const LazyExecutiveSummaryDashboard = dynamic(
  () => import('@/components/admin/health-risks/ExecutiveSummaryDashboard'),
  {
    loading: () => <ComponentSkeleton className="h-96 w-full" />,
    ssr: false
  }
);

// Profile and Onboarding - Medium priority
// export const LazyProfileSetup = dynamic(
//   () => import('@/components/profile/ProfileSetup'),
//   {
//     loading: () => <ComponentSkeleton />,
//     ssr: false
//   }
// );

// export const LazyPendingTasksReminder = dynamic(
//   () => import('@/components/onboarding/PendingTasksReminder'),
//   {
//     loading: () => <SmallComponentSkeleton />,
//     ssr: false
//   }
// );

// Utility wrapper for conditional lazy loading
interface ConditionalLazyProps {
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ConditionalLazy: React.FC<ConditionalLazyProps> = ({
  condition,
  children,
  fallback = <SmallComponentSkeleton />
}) => {
  if (!condition) {
    return <>{fallback}</>;
  }

  return <Suspense fallback={fallback}>{children}</Suspense>;
};

// Route-based preloading utility
export const preloadRouteComponents = (route: string) => {
  const preloadMap: Record<string, () => void> = {
    '/health-questionnaire': () => {
      import('@/components/health/UnifiedHealthQuestionnaire');
      import('@/components/gamification/ProgressCard');
    },
    '/admin': () => {
      import('@/components/admin/AdminDashboard');
      import('@/components/admin/UserManagementTable');
    },
    '/profile': () => {
      import('@/components/pdf/PDFGenerationCenter');
      import('@/components/upload/EnhancedDocumentUpload');
    },
    '/video-call': () => {
      import('@/components/video/VideoChat');
    },
    '/onboarding': () => {
      import('@/components/health/UnifiedHealthAssessment');
    }
  };

  const preloadFn = preloadMap[route];
  if (preloadFn) {
    // Preload after a small delay to avoid blocking initial render
    setTimeout(preloadFn, 100);
  }
};

// Performance monitoring for lazy components
export const withLoadingMetrics = <T,>(
  Component: React.ComponentType<T>,
  componentName: string
) => {
  const WithLoadingMetrics = React.forwardRef<any, T>((props, ref) => {
    React.useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Lazy component ${componentName} loaded`);
      }
    }, []);

    return <Component {...props} ref={ref} />;
  });
  
  WithLoadingMetrics.displayName = `withLoadingMetrics(${componentName})`;
  return WithLoadingMetrics;
};