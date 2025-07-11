// Application constants

export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Omni Onboarding Portal',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  version: '1.0.0',
  description: 'Healthcare professional onboarding platform',
};

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  version: process.env.NEXT_PUBLIC_API_VERSION || 'v1',
  timeout: 30000,
};

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  dashboard: '/dashboard',
  onboarding: '/onboarding',
  profile: '/profile',
  documents: '/documents',
  settings: '/settings',
} as const;

export const ONBOARDING_STEPS = [
  { id: 'personal-info', title: 'Personal Information', order: 1 },
  { id: 'professional-info', title: 'Professional Information', order: 2 },
  { id: 'documents', title: 'Document Upload', order: 3 },
  { id: 'emergency-contact', title: 'Emergency Contact', order: 4 },
  { id: 'review', title: 'Review & Submit', order: 5 },
] as const;

export const FILE_CONFIG = {
  maxSize: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760'), // 10MB
  allowedTypes: (process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,application/pdf').split(','),
  imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  documentTypes: ['application/pdf'],
};

export const SESSION_CONFIG = {
  timeout: parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT || '1800000'), // 30 minutes
  warningTime: parseInt(process.env.NEXT_PUBLIC_SESSION_WARNING_TIME || '300000'), // 5 minutes
};

export const REGEX_PATTERNS = {
  email: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  phone: /^\+?[1-9]\d{1,14}$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  npi: /^\d{10}$/,
  dea: /^[A-Z]{2}\d{7}$/,
};

export const ERROR_MESSAGES = {
  required: 'This field is required',
  invalidEmail: 'Please enter a valid email address',
  invalidPhone: 'Please enter a valid phone number',
  passwordMismatch: 'Passwords do not match',
  passwordTooShort: 'Password must be at least 8 characters',
  fileTooLarge: 'File size exceeds the maximum allowed size',
  invalidFileType: 'File type is not allowed',
  genericError: 'An error occurred. Please try again.',
  networkError: 'Network error. Please check your connection.',
};

export const SUCCESS_MESSAGES = {
  profileUpdated: 'Profile updated successfully',
  documentUploaded: 'Document uploaded successfully',
  onboardingComplete: 'Onboarding completed successfully',
  passwordReset: 'Password reset successfully',
};

export const BREAKPOINTS = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  '3xl': 1920,
} as const;