// Global type definitions for the Omni Onboarding Portal

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profile?: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  address?: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  HEALTHCARE_PROFESSIONAL = 'HEALTHCARE_PROFESSIONAL',
  REVIEWER = 'REVIEWER',
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  order: number;
  required: boolean;
  completed: boolean;
}

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  size: number;
  uploadedAt: Date;
  status: DocumentStatus;
}

export enum DocumentType {
  LICENSE = 'LICENSE',
  CERTIFICATION = 'CERTIFICATION',
  IDENTIFICATION = 'IDENTIFICATION',
  EDUCATION = 'EDUCATION',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

// Registration and Onboarding Types
export interface RegistrationStep {
  id: string;
  name: string;
  completed: boolean;
  order: number;
}

export interface OnboardingProgress {
  currentStep: string;
  completedSteps: string[];
  totalSteps: number;
  progressPercentage: number;
}

// Gamification Types
export interface GamificationStats {
  points: number;
  level: number;
  badges: number;
  achievements: Achievement[];
  leaderboardPosition?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: Date;
  pointsAwarded: number;
}

export interface Activity {
  id: string;
  description: string;
  points: number;
  timestamp: Date;
  type: 'registration' | 'document_upload' | 'questionnaire' | 'interview' | 'other';
}

// Form Data Types
export interface CompanyInfoFormData {
  companyName: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  phone: string;
}

export interface HealthQuestionnaireFormData {
  responses: Record<string, string>;
  notes?: string;
}

export interface DocumentUploadFormData {
  documents: {
    [documentType: string]: File | null;
  };
}

// API Response Types
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Gamification Types
export interface GamificationProgress {
  total_points: number;
  current_level: GamificationLevel;
  next_level?: GamificationLevel;
  progress_percentage: number;
  streak_days: number;
  tasks_completed: number;
  perfect_forms: number;
  documents_uploaded: number;
  health_assessments_completed: number;
  engagement_score: number;
  last_activity_date?: string;
  profile_completed: boolean;
  onboarding_completed: boolean;
  badges_earned: number;
  achievements: Achievement[];
}

export interface GamificationLevel {
  id: string;
  level_number: number;
  name: string;
  title: string;
  points_required: number;
  points_to_next?: number;
  color_theme: string;
  icon: string;
  description: string;
  rewards: string[];
  unlocked_features: string[];
  discount_percentage?: number;
  points_remaining?: number;
}

export interface GamificationBadge {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_name: string;
  icon_color: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points_value: number;
  earned_at?: string;
  criteria?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
  points_awarded: number;
}

export interface LeaderboardEntry {
  beneficiary_id: string;
  name: string;
  avatar?: string;
  total_points: number;
  current_level: number;
  level_name: string;
  badges_count: number;
  engagement_score: number;
}

export interface GamificationStats {
  total_points: number;
  current_level: {
    number: number;
    name: string;
    color: string;
    icon: string;
  };
  next_level?: {
    number: number;
    name: string;
    points_required: number;
    points_remaining: number;
    progress_percentage: number;
  };
  streak_days: number;
  badges_earned: number;
  tasks_completed: number;
  engagement_score: number;
  last_activity?: string;
  member_since: string;
}

export interface ActivityFeedItem {
  type: 'badge_earned' | 'level_up' | 'points_awarded' | 'task_completed';
  timestamp: string;
  data: {
    badge_name?: string;
    badge_icon?: string;
    badge_color?: string;
    badge_rarity?: string;
    points_earned?: number;
    level_name?: string;
    task_name?: string;
  };
}

export interface DashboardSummary {
  stats: GamificationStats;
  recent_badges: Array<{
    name: string;
    icon: string;
    color: string;
    earned_at: string;
  }>;
  quick_stats: {
    points_today: number;
    streak_days: number;
    completion_rate: number;
    rank_in_company: number;
  };
}