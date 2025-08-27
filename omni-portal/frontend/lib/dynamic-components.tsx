import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

// Core UI components with lazy loading
export const DynamicChart = dynamic(() => 
  import('react-chartjs-2').then(mod => ({ default: mod.Line })), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-200 h-64 w-full rounded"></div>
  }
);

export const DynamicFramerMotion = dynamic(() => 
  import('framer-motion').then(mod => ({ default: mod.motion.div })), 
  { 
    ssr: false,
    loading: () => <div className="opacity-0"></div>
  }
);

export const DynamicTesseract = dynamic(() => 
  import('../components/upload/EnhancedDocumentUpload'), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-100 h-32 w-full rounded">Loading OCR...</div>
  }
);

export const DynamicPDF = dynamic(() => 
  import('jspdf').then(mod => ({ default: mod.default })), 
  { 
    ssr: false
  }
);

// Admin components - only load when needed
export const DynamicAdminDashboard = dynamic(() => 
  import('../components/admin/AdminDashboard'), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-100 h-screen w-full">Loading Admin Panel...</div>
  }
);

export const DynamicHealthRisks = dynamic(() => 
  import('../components/admin/health-risks/ExecutiveSummaryDashboard'), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-100 h-64 w-full rounded">Loading Health Analytics...</div>
  }
);

// Gamification - lazy load to reduce initial bundle
export const DynamicGamification = dynamic(() => 
  import('../components/gamification/GamificationTester'), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gradient-to-r from-blue-100 to-purple-100 h-32 w-full rounded">Loading Rewards...</div>
  }
);

// Video conferencing - only load when needed
export const DynamicVideo = dynamic(() => 
  import('../components/video/VideoConferencing'), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-900 h-64 w-full rounded flex items-center justify-center"><span className="text-white">Starting Video...</span></div>
  }
);

// Interview scheduling - lazy load
export const DynamicInterviewScheduler = dynamic(() => 
  import('../components/interview/InterviewScheduler'), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-blue-50 h-64 w-full rounded">Loading Calendar...</div>
  }
);

// Health questionnaire - optimized loading
export const DynamicHealthQuestionnaire = dynamic(() => 
  import('../components/health/SmartHealthQuestionnaire'), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-green-50 h-96 w-full rounded">Loading Health Assessment...</div>
  }
);

// Profile components
export const DynamicProfileView = dynamic(() => 
  import('../components/profile/ProfileView'), 
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-50 h-64 w-full rounded">Loading Profile...</div>
  }
);

// Lightweight telemetry - only load when explicitly needed
export const DynamicTelemetry = dynamic(() => 
  import('../lib/lazy-telemetry').then(mod => ({ default: mod.LazyTelemetry })), 
  { 
    ssr: false
  }
);

// Bundle analyzer helper - development only
export const DynamicBundleAnalyzer = dynamic(() => 
  import('../lib/bundle-analyzer-helper').then(mod => ({ default: mod.BundleVisualization })), 
  { 
    ssr: false
  }
);