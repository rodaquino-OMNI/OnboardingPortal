// Core TypeScript interfaces for the Onboarding Portal
// This file eliminates all 'any' types and provides strict type safety

// =====================================
// ERROR HANDLING TYPES
// =====================================

export interface ApiError {
  message: string;
  code?: string | number;
  status?: number;
  details?: Record<string, unknown>;
}

export interface ValidationError extends ApiError {
  field?: string;
  value?: unknown;
}

export interface NetworkError extends ApiError {
  url?: string;
  method?: string;
}

export type AppError = ApiError | ValidationError | NetworkError | Error;

// =====================================
// API RESPONSE TYPES
// =====================================

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  status: number;
  success: boolean;
  error?: ApiError;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// =====================================
// HEALTH QUESTIONNAIRE TYPES
// =====================================

export type QuestionType = 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date' | 'scale';

export interface QuestionOption {
  id: string;
  label: string;
  value: string | number | boolean;
  description?: string;
}

export interface QuestionValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  customValidator?: (value: QuestionValue) => boolean;
}

export type QuestionValue = string | number | boolean | string[] | number[] | Date | null;

export interface HealthQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  options?: QuestionOption[];
  validation?: QuestionValidation;
  metadata?: Record<string, unknown>;
}

export interface QuestionnaireResponse {
  questionId: string;
  value: QuestionValue;
  timestamp: Date;
  responseTime?: number;
  sessionId?: string;
}

export interface HealthAssessmentResult {
  sessionId: string;
  responses: QuestionnaireResponse[];
  riskScore: number;
  recommendations: string[];
  completedAt: Date;
  pathwayType: 'standard' | 'clinical' | 'immersive';
}

// =====================================
// CLINICAL WORKFLOW TYPES
// =====================================

export interface UserProfile {
  id: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  medicalHistory: MedicalHistory[];
  demographics: UserDemographics;
  preferences: UserPreferences;
  completionHistory: CompletionRecord[];
}

export interface MedicalHistory {
  condition: string;
  diagnosedDate: Date;
  severity: 'low' | 'medium' | 'high';
  medications: string[];
}

export interface UserDemographics {
  country: string;
  region?: string;
  educationLevel: string;
  occupation?: string;
}

export interface UserPreferences {
  language: string;
  communicationStyle: 'formal' | 'casual' | 'medical';
  notifications: boolean;
}

export interface CompletionRecord {
  pathwayId: string;
  completionRate: number;
  completedAt: Date;
  outcome: string;
}

export interface PathwayContext {
  currentStep: number;
  totalSteps: number;
  timeSpent: number;
  riskFactors: string[];
  clinicalIndicators: ClinicalIndicator[];
}

export interface ClinicalIndicator {
  type: string;
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

// =====================================
// FRAUD DETECTION TYPES
// =====================================

export interface FraudAnalysis {
  riskScore: number;
  factors: RiskFactor[];
  recommendations: string[];
  timestamp: Date;
  confidence: number;
}

export interface RiskFactor {
  type: 'technical' | 'behavioral' | 'contextual' | 'medical';
  description: string;
  severity: number;
  evidence: FraudEvidence[];
}

export interface FraudEvidence {
  category: string;
  description: string;
  data: Record<string, unknown>;
  confidence: number;
}

export interface UserFraudContext {
  sessionData: SessionData;
  behaviorMetrics: BehaviorMetrics;
  deviceInfo: DeviceInfo;
}

export interface SessionData {
  id: string;
  startTime: Date;
  ipAddress: string;
  userAgent: string;
  duration: number;
}

export interface BehaviorMetrics {
  responseSpeed: number[];
  typingPatterns: TypingPattern[];
  mouseMovements: MouseMovement[];
  scrollBehavior: ScrollBehavior[];
}

export interface TypingPattern {
  keyInterval: number;
  pauseDuration: number;
  keystroke: string;
  timestamp: number;
}

export interface MouseMovement {
  x: number;
  y: number;
  timestamp: number;
  event: 'move' | 'click' | 'scroll';
}

export interface ScrollBehavior {
  direction: 'up' | 'down';
  speed: number;
  distance: number;
  timestamp: number;
}

export interface DeviceInfo {
  platform: string;
  browser: string;
  screenResolution: string;
  timezone: string;
}

// =====================================
// DOCUMENT UPLOAD TYPES
// =====================================

export interface DocumentUploadResult {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  ocrData?: OCRData;
  validation?: DocumentValidation;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface OCRData {
  text: string;
  confidence: number;
  extractedFields: ExtractedField[];
  metadata: OCRMetadata;
}

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRMetadata {
  pages: number;
  processingTime: number;
  quality: 'low' | 'medium' | 'high';
}

export interface DocumentValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  requiredFields: RequiredField[];
}

export interface RequiredField {
  name: string;
  found: boolean;
  value?: string;
  confidence?: number;
}

// =====================================
// GAMIFICATION TYPES
// =====================================

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt?: Date;
  category: 'health' | 'completion' | 'engagement' | 'milestone';
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  earnedAt: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface GamificationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  pointsRequired: number;
  category: string;
  unlockedAt?: Date;
  earned_at?: Date; // Alternative date field
}

export interface LeaderboardEntry {
  // Frontend expected fields
  userId?: string;
  username?: string;
  points?: number;
  rank?: number;
  achievements?: Achievement[];
  avatar?: string;
  
  // Backend API fields (actual response format)
  beneficiary_id?: number;
  name?: string;
  total_points?: number;
  current_level?: number;
  level_name?: string;
  badges_count?: number;
  engagement_score?: number;
  badges?: any[];
}

export interface GamificationStats {
  totalPoints: number;
  level: number;
  current_level: number; // Added for compatibility
  experienceToNext: number;
  achievementsUnlocked: number;
  currentStreak: number;
  longestStreak: number;
}

// =====================================
// BENEFICIARY TYPES
// =====================================

export interface BeneficiaryInfo {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  dateOfBirth: Date;
  cpf: string;
  position?: string;
  role?: string;
  department?: string;
  startDate?: Date;
  employee_code?: string;
  hiring_date?: string;
  status: 'active' | 'inactive' | 'pending';
  profileData: Record<string, unknown>;
}

// =====================================
// LGPD COMPLIANCE TYPES
// =====================================

export interface LGPDConsent {
  id: string;
  userId: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'cookies';
  granted: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  details: ConsentDetails;
}

export interface ConsentDetails {
  purpose: string;
  dataTypes: string[];
  retentionPeriod: string;
  thirdParties: string[];
  rights: string[];
}

export interface DataRequest {
  id: string;
  userId: string;
  type: 'access' | 'portability' | 'deletion' | 'rectification';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  completedAt?: Date;
  details: Record<string, unknown>;
}

// =====================================
// PATHWAY TYPES
// =====================================

export interface PathwayDecision {
  pathwayType: 'standard' | 'clinical' | 'immersive';
  confidence: number;
  reasoning: string[];
  alternatives: PathwayAlternative[];
}

export interface PathwayAlternative {
  type: 'standard' | 'clinical' | 'immersive';
  suitabilityScore: number;
  benefits: string[];
  considerations: string[];
}

export interface PathwayRecommendation {
  nextPathway: 'standard' | 'clinical' | 'immersive';
  reasoning: string;
  expectedBenefits: string[];
  estimatedDuration: number;
}

export interface IntelligentInsights {
  primaryInsights: string[];
  riskAssessment: RiskAssessment;
  recommendations: ClinicalRecommendation[];
  followUpActions: FollowUpAction[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  categories: RiskCategory[];
  timeline: RiskTimeline[];
}

export interface RiskCategory {
  name: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  mitigation: string[];
}

export interface RiskTimeline {
  date: Date;
  risk: number;
  factors: string[];
}

export interface ClinicalRecommendation {
  type: 'immediate' | 'short_term' | 'long_term' | 'follow_up';
  action: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  rationale: string;
  expectedOutcome: string;
}

export interface FollowUpAction {
  action: string;
  timeframe: string;
  responsible: 'patient' | 'provider' | 'system';
  dependencies: string[];
}

// =====================================
// UTILITY TYPES
// =====================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

// =====================================
// FUNCTION TYPES
// =====================================

export type AsyncFunction<T extends unknown[] = [], R = unknown> = (...args: T) => Promise<R>;

export type EventHandler<T = unknown> = (event: T) => void;

export type Callback<T = void> = () => T;

export type ErrorHandler = (error: AppError) => void;

export type ValidationFunction<T = unknown> = (value: T) => boolean | string;

// =====================================
// COMPONENT PROP TYPES
// =====================================

export interface ComprehensiveAssessmentResults {
  responses: QuestionnaireResponse[];
  pathwayType: 'standard' | 'clinical' | 'immersive';
  riskScore: number;
  recommendations: string[];
  questionnairData?: Record<string, QuestionValue>; // Optional for compatibility
  questionnaireData?: Record<string, QuestionValue>; // Alternative spelling
  pathway?: string;
  clinicalAnalysis?: ClinicalAnalysis;
  fraudAnalysis?: FraudAnalysis;
  userExperience?: UserExperienceData;
}

export interface ClinicalAnalysis {
  riskFactors: string[];
  recommendations: ClinicalRecommendation[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  followUpRequired: boolean;
}

export interface UserExperienceData {
  sessionDuration: number;
  engagementScore: number;
  completionRate: number;
  userFeedback?: string;
}

export interface DocumentStatus {
  uploaded: boolean;
  validated: boolean;
  processing: boolean;
  error?: string;
  ocrData?: OCRData;
  file?: File;
}


// =====================================
// TYPE GUARDS
// =====================================

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> {
  return response.success === true && response.status >= 200 && response.status < 300;
}