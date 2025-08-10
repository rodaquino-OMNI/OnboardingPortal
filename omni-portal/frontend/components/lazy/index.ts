import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading component
const Loading = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
  </div>
);

// Lazy load heavy components
export const LazyHealthQuestionnaire = dynamic(
  () => import('@/components/health/UnifiedHealthQuestionnaire'),
  { 
    loading: () => <Loading />,
    ssr: false 
  }
);

export const LazyDocumentUpload = dynamic(
  () => import('@/components/upload/EnhancedDocumentUpload'),
  { 
    loading: () => <Loading />,
    ssr: false 
  }
);