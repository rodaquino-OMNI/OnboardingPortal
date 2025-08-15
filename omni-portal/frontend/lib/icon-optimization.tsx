// Icon Optimization Utilities
// Provides lightweight alternatives to react-icons with better performance

import React from 'react';

export interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

// Common SVG icons optimized for bundle size
export const ChevronRightIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export const XMarkIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export const HomeIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

export const DocumentIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export const CameraIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const CloudUploadIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

export const SpinnerIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke={color} strokeWidth="4"></circle>
    <path className="opacity-75" fill={color} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const HeartIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill={color} viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const AlertTriangleIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Gaming/Gamification icons
export const TrophyIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill={color} viewBox="0 0 24 24">
    <path d="M6 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2.5l1.5 1.5 1.5-1.5H14c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2H6zm1 3c0-.6.4-1 1-1s1 .4 1 1-.4 1-1 1-1-.4-1-1zm4 0c0-.6.4-1 1-1s1 .4 1 1-.4 1-1 1-1-.4-1-1z" />
  </svg>
);

export const StarIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor", filled = false }) => (
  <svg className={className} fill={filled ? color : "none"} viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

export const BadgeIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill={color} viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

// Chart/Analytics icons
export const ChartBarIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export const TrendingUpIcon: React.FC<IconProps> = ({ className = "h-5 w-5", color = "currentColor" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

// Icon mapping for easy migration from react-icons
export const IconMap = {
  // Navigation
  'chevron-right': ChevronRightIcon,
  'chevron-left': ChevronLeftIcon,
  
  // Actions
  'check': CheckIcon,
  'x-mark': XMarkIcon,
  'upload': CloudUploadIcon,
  'camera': CameraIcon,
  
  // Common
  'user': UserIcon,
  'home': HomeIcon,
  'document': DocumentIcon,
  'spinner': SpinnerIcon,
  'heart': HeartIcon,
  
  // Status
  'alert-triangle': AlertTriangleIcon,
  'info': InfoIcon,
  
  // Gamification
  'trophy': TrophyIcon,
  'star': StarIcon,
  'badge': BadgeIcon,
  
  // Analytics
  'chart-bar': ChartBarIcon,
  'trending-up': TrendingUpIcon,
};

// Utility to get icon by name
export const getIcon = (name: keyof typeof IconMap) => {
  return IconMap[name];
};

// HOC for icon optimization
export const withIconOptimization = <P extends object>(
  Component: React.ComponentType<P & IconProps>
) => {
  const OptimizedIcon = React.memo((props: P & IconProps) => {
    return <Component {...props} />;
  });
  OptimizedIcon.displayName = `withIconOptimization(${Component.displayName || Component.name})`;
  return OptimizedIcon;
};

// Utility for social media icons (since they're commonly used)
export const SocialIcons = {
  Google: ({ className = "h-5 w-5" }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  ),
  
  Facebook: ({ className = "h-5 w-5" }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  
  Instagram: ({ className = "h-5 w-5" }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
};