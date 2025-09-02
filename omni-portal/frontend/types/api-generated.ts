/**
 * Generated TypeScript types for OnboardingPortal API
 * Auto-generated from Laravel models and API responses
 * Last updated: 2025-09-02
 */

// =====================================
// BASE API TYPES
// =====================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  status?: number;
  error?: ApiError;
  performance?: {
    execution_time: number;
    memory_usage: string;
    queries_count: number;
  };
}

export interface ApiError {
  message: string;
  code?: string | number;
  details?: Record<string, any>;
  errors?: Record<string, string[]>; // Laravel validation errors
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
    last_page: number;
    from: number | null;
    to: number | null;
    next_page_url: string | null;
    prev_page_url: string | null;
  };
}

export interface MetaData {
  [key: string]: any;
}

// =====================================
// USER & AUTHENTICATION TYPES
// =====================================

export interface User {
  id: number;
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  department?: string;
  job_title?: string;
  employee_id?: string;
  start_date?: string; // ISO date string
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  registration_step: 'personal_info' | 'beneficiary_info' | 'documents' | 'completed';
  lgpd_consent: boolean;
  lgpd_consent_explicit: boolean;
  lgpd_consent_at?: string; // ISO datetime string
  lgpd_consent_ip?: string;
  role: 'super_admin' | 'company_admin' | 'beneficiary';
  preferred_language: 'pt-BR' | 'en-US' | 'es-ES';
  preferences?: Record<string, any>;
  google_id?: string;
  facebook_id?: string;
  instagram_id?: string;
  avatar_url?: string;
  social_provider?: 'google' | 'facebook' | 'instagram';
  social_login: boolean;
  is_active: boolean;
  email_verified_at?: string; // ISO datetime string
  last_login_at?: string; // ISO datetime string
  last_login_ip?: string;
  failed_login_attempts: number;
  locked_until?: string; // ISO datetime string
  company_id?: number;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
  formatted_cpf?: string; // Computed attribute
  
  // Relationships
  company?: Company;
  beneficiary?: Beneficiary;
  gamificationProgress?: GamificationProgress;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
  success: boolean;
  registration_step?: string;
  user_id?: number;
}

export interface LoginRequest {
  email?: string;
  cpf?: string;
  password: string;
  remember?: boolean;
}

export interface SocialAuthCallback {
  token: string;
  user: User;
  is_new_user: boolean;
  registration_required: boolean;
}

// =====================================
// COMPANY TYPES
// =====================================

export interface Company {
  id: number;
  name: string;
  slug: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  website?: string;
  logo?: string;
  primary_color?: string;
  secondary_color?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  contact_person_name?: string;
  contact_person_email?: string;
  contact_person_phone?: string;
  contract_start_date?: string; // ISO date string
  contract_end_date?: string; // ISO date string
  max_beneficiaries: number;
  is_active: boolean;
  settings?: Record<string, any>;
  onboarding_config?: Record<string, any>;
  features_enabled?: string[];
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  // Relationships
  beneficiaries?: Beneficiary[];
  users?: User[];
}

// =====================================
// BENEFICIARY TYPES
// =====================================

export interface Beneficiary {
  id: number;
  user_id: number;
  company_id?: number;
  cpf?: string;
  full_name?: string;
  birth_date?: string; // ISO date string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone?: string;
  mobile_phone?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'separated';
  occupation?: string;
  monthly_income?: number;
  has_health_insurance: boolean;
  health_insurance_provider?: string;
  health_insurance_number?: string;
  onboarding_status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  onboarding_step: number;
  onboarding_completed_at?: string; // ISO datetime string
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  // Relationships
  user?: User;
  company?: Company;
  gamificationProgress?: GamificationProgress;
  badges?: GamificationBadge[];
  documents?: Document[];
  healthQuestionnaires?: HealthQuestionnaire[];
  interviews?: Interview[];
}

// =====================================
// GAMIFICATION TYPES
// =====================================

export interface GamificationProgress {
  id: number;
  beneficiary_id: number;
  total_points: number;
  current_level: number;
  points_to_next_level: number;
  streak_days: number;
  last_activity_date?: string; // ISO date string
  tasks_completed: number;
  perfect_forms: number;
  documents_uploaded: number;
  health_assessments_completed: number;
  profile_completed: boolean;
  onboarding_completed: boolean;
  badges_earned?: string[];
  achievements?: GamificationAchievement[];
  daily_challenges?: DailyChallenge[];
  weekly_goals?: WeeklyGoal[];
  engagement_score?: number;
  last_badge_earned_at?: string; // ISO datetime string
  last_level_up_at?: string; // ISO datetime string
  created_at: string;
  updated_at: string;
  
  // Relationships
  beneficiary?: Beneficiary;
}

export interface GamificationAchievement {
  action: string;
  points: number;
  date: string; // ISO date string
}

export interface DailyChallenge {
  id: string;
  name: string;
  description: string;
  points: number;
  completed: boolean;
  expires_at: string; // ISO datetime string
}

export interface WeeklyGoal {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  points: number;
  completed: boolean;
  week_start: string; // ISO date string
}

export interface GamificationBadge {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon_name: string;
  icon_color: string;
  category: 'onboarding' | 'health' | 'engagement' | 'social' | 'achievement' | 'special';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points_value: number;
  criteria?: BadgeCriteria[];
  is_active: boolean;
  is_secret: boolean;
  sort_order: number;
  max_per_user: number;
  available_from?: string; // ISO datetime string
  available_until?: string; // ISO datetime string
  created_at: string;
  updated_at: string;
  
  // Pivot data when earned
  earned_at?: string; // ISO datetime string
  notified_at?: string; // ISO datetime string
}

export interface BadgeCriteria {
  type: 'total_points' | 'documents_uploaded' | 'health_assessments_completed' | 'streak_days' | 
        'perfect_forms' | 'profile_completed' | 'onboarding_completed' | 'tasks_completed' | 
        'current_level' | 'engagement_score' | 'completion_time' | 'early_bird';
  value: number | boolean;
  operator: '>=' | '>' | '=' | '==' | '<' | '<=' | '!=';
}

export interface GamificationLevel {
  id: number;
  level_number: number;
  name: string;
  title: string;
  points_required: number;
  points_to_next?: number;
  color_theme: string;
  icon: string;
  rewards?: string[];
  unlocked_features?: string[];
  description: string;
  discount_percentage?: number;
  priority_support_level?: number;
  created_at: string;
  updated_at: string;
}

export interface GamificationStats {
  total_points: number;
  current_level: GamificationLevel;
  next_level?: GamificationLevel;
  progress_to_next: number; // percentage
  badges_earned: GamificationBadge[];
  recent_achievements: GamificationAchievement[];
  streak_days: number;
  engagement_score: number;
  rank?: number;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  user_rank?: number;
  total_participants: number;
  last_updated: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_name: string;
  total_points: number;
  current_level: number;
  badges_count: number;
  is_current_user: boolean;
}

// =====================================
// REWARD TYPES
// =====================================

export interface Reward {
  id: number;
  code: string;
  name: string;
  description: string;
  benefits?: string[];
  points_required: number;
  type: 'badge' | 'discount' | 'service_upgrade' | 'physical_item' | 'digital_item' | 
        'feature_unlock' | 'priority_access';
  delivery_config?: Record<string, any>;
  icon?: string;
  color_scheme?: string;
  is_premium: boolean;
  is_active: boolean;
  is_limited: boolean;
  quantity_available?: number;
  quantity_claimed: number;
  valid_from?: string; // ISO date string
  valid_until?: string; // ISO date string
  sort_order: number;
  created_at: string;
  updated_at: string;
  
  // Computed properties
  is_available?: boolean;
  can_be_claimed?: boolean;
}

export interface UserReward {
  id: number;
  user_id: number;
  reward_id: number;
  status: 'unlocked' | 'claimed' | 'delivered' | 'expired' | 'cancelled';
  unlocked_at?: string; // ISO datetime string
  claimed_at?: string; // ISO datetime string
  delivered_at?: string; // ISO datetime string
  expires_at?: string; // ISO datetime string
  delivery_details?: Record<string, any>;
  usage_data?: Record<string, any>;
  redemption_code?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Relationships
  reward?: Reward;
}

// =====================================
// DOCUMENT TYPES
// =====================================

export interface Document {
  id: number;
  beneficiary_id: number;
  company_id?: number;
  uploaded_by?: number;
  document_type?: string;
  type: 'rg' | 'cnh' | 'cpf' | 'comprovante_residencia' | 'foto_3x4' | 'rg_cnh';
  document_category?: string;
  description?: string;
  original_name: string;
  original_filename?: string;
  stored_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  file_extension: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'expired';
  rejection_reason?: string;
  verified_by?: number;
  verified_at?: string; // ISO datetime string
  expiration_date?: string; // ISO date string
  is_encrypted: boolean;
  encryption_key?: string;
  metadata?: Record<string, any>;
  ocr_data?: Record<string, any>;
  extracted_data?: Record<string, any>;
  validation_results?: Record<string, any>;
  validation_status?: 'pending' | 'valid' | 'invalid' | 'needs_review';
  processing_method?: 'ocr' | 'ai' | 'manual';
  processing_options?: Record<string, any>;
  quality_score?: number;
  confidence_score?: number;
  processing_started_at?: string; // ISO datetime string
  processing_completed_at?: string; // ISO datetime string
  processed_at?: string; // ISO datetime string
  error_message?: string;
  is_sensitive: boolean;
  checksum?: string;
  version: number;
  parent_document_id?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string; // ISO datetime string
  
  // Relationships
  beneficiary?: Beneficiary;
  documentType?: DocumentType;
  verifier?: User;
  uploader?: User;
}

export interface DocumentType {
  id: number;
  name: string;
  slug: string;
  description?: string;
  required_fields?: string[];
  validation_rules?: Record<string, any>;
  max_file_size?: number;
  allowed_mime_types?: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentUploadResponse {
  document: Document;
  upload_url?: string;
  processing_id?: string;
}

// =====================================
// HEALTH QUESTIONNAIRE TYPES
// =====================================

export interface HealthQuestionnaire {
  id: number;
  beneficiary_id: number;
  company_id?: number;
  template_id?: number;
  questionnaire_type: string;
  responses?: Record<string, any>;
  score?: number;
  risk_level?: 'low' | 'moderate' | 'high' | 'critical';
  completed_at?: string; // ISO datetime string
  reviewed_by?: number;
  reviewed_at?: string; // ISO datetime string
  notes?: string;
  recommendations?: string[];
  follow_up_required: boolean;
  follow_up_date?: string; // ISO date string
  status: 'draft' | 'in_progress' | 'completed' | 'reviewed' | 'archived';
  current_section?: string;
  started_at?: string; // ISO datetime string
  last_saved_at?: string; // ISO datetime string
  ai_insights?: Record<string, any>;
  risk_scores?: Record<string, any>;
  metadata?: Record<string, any>;
  fraud_detection_score?: number;
  consistency_score?: number;
  response_time_analysis?: Record<string, any>;
  progressive_layer?: number;
  progressive_scores?: Record<string, any>;
  progressive_actions?: string[];
  progressive_next_steps?: string[];
  created_at: string;
  updated_at: string;
  
  // Relationships
  beneficiary?: Beneficiary;
  template?: QuestionnaireTemplate;
  reviewer?: User;
  
  // Computed properties
  sections_completed?: QuestionnaireSection[];
}

export interface QuestionnaireTemplate {
  id: number;
  name: string;
  code: string;
  description?: string;
  type: 'health_screening' | 'mental_health' | 'lifestyle' | 'medical_history' | 'follow_up';
  estimated_minutes: number;
  sections?: Record<string, QuestionnaireTemplateSection>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireTemplateSection {
  name: string;
  description?: string;
  questions: QuestionnaireQuestion[];
  required?: boolean;
  order?: number;
}

export interface QuestionnaireQuestion {
  id: string;
  key?: string;
  type: 'text' | 'number' | 'select' | 'multiple_choice' | 'boolean' | 'scale' | 'date';
  question: string;
  description?: string;
  required: boolean;
  options?: QuestionnaireOption[];
  validation?: Record<string, any>;
  order?: number;
}

export interface QuestionnaireOption {
  value: string | number;
  label: string;
  score?: number;
}

export interface QuestionnaireSection {
  section: string;
  name: string;
  completed_questions: number;
  total_questions: number;
  completion_percentage: number;
}

// =====================================
// INTERVIEW TYPES
// =====================================

export interface Interview {
  id: number;
  beneficiary_id: number;
  interview_slot_id?: number;
  healthcare_professional_id?: number;
  appointment_type_id?: number;
  recurring_appointment_id?: number;
  booking_reference?: string;
  status: 'scheduled' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed' | 'no_show';
  scheduled_at: string; // ISO datetime string
  started_at?: string; // ISO datetime string
  ended_at?: string; // ISO datetime string
  actual_duration_minutes?: number;
  interview_type: 'initial' | 'follow_up' | 'emergency' | 'routine';
  meeting_type: 'in_person' | 'video' | 'phone';
  meeting_link?: string;
  meeting_platform?: 'zoom' | 'google_meet' | 'microsoft_teams' | 'custom';
  notes?: string;
  session_notes?: string;
  rating?: number;
  feedback?: string;
  cancellation_reason?: string;
  cancelled_at?: string; // ISO datetime string
  cancelled_by?: number;
  reschedule_reason?: string;
  reschedule_count: number;
  rescheduled_at?: string; // ISO datetime string
  rescheduled_by?: number;
  reminder_sent_at?: string; // ISO datetime string
  confirmation_sent_at?: string; // ISO datetime string
  follow_up_required: boolean;
  follow_up_notes?: string;
  emergency_contact?: Record<string, any>;
  preparation_confirmed: boolean;
  punctuality_score?: number;
  booked_at?: string; // ISO datetime string
  confirmed_at?: string; // ISO datetime string
  timezone?: string;
  beneficiary_timezone?: string;
  professional_timezone?: string;
  is_telemedicine: boolean;
  telemedicine_setup_checklist?: Record<string, any>;
  setup_checklist_completed: boolean;
  setup_completed_at?: string; // ISO datetime string
  vital_signs_data?: Record<string, any>;
  prescription_reviewed: boolean;
  prescription_changes?: Record<string, any>;
  requires_in_person_followup: boolean;
  suggested_followup_date?: string; // ISO date string
  consultation_outcome?: string;
  patient_satisfaction_score?: number;
  patient_satisfaction_feedback?: string;
  consultation_cost?: number;
  insurance_covered: boolean;
  insurance_claim_id?: string;
  created_at: string;
  updated_at: string;
  
  // Relationships
  beneficiary?: Beneficiary;
  slot?: InterviewSlot;
  healthcareProfessional?: User;
  cancelledBy?: User;
  rescheduledBy?: User;
  rescheduleHistory?: InterviewRescheduleHistory[];
  documents?: Document[];
  appointmentType?: TelemedicineAppointmentType;
  recurringAppointment?: TelemedicineRecurringAppointment;
  telemedicineNotifications?: TelemedicineNotification[];
  
  // Computed properties
  display_time?: string;
  is_overdue?: boolean;
  can_be_rescheduled?: boolean;
  can_be_cancelled?: boolean;
}

export interface InterviewSlot {
  id: number;
  healthcare_professional_id: number;
  date: string; // ISO date string
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  duration_minutes: number;
  is_available: boolean;
  timezone: string;
  max_bookings: number;
  current_bookings: number;
  slot_type: 'regular' | 'emergency' | 'follow_up';
  created_at: string;
  updated_at: string;
  
  // Relationships
  healthcareProfessional?: User;
  interviews?: Interview[];
}

export interface InterviewRescheduleHistory {
  id: number;
  interview_id: number;
  original_scheduled_at: string; // ISO datetime string
  new_scheduled_at: string; // ISO datetime string
  reason: string;
  rescheduled_by: number;
  rescheduled_at: string; // ISO datetime string
  created_at: string;
  updated_at: string;
  
  // Relationships
  interview?: Interview;
  rescheduledBy?: User;
}

export interface TelemedicineAppointmentType {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  is_active: boolean;
  requires_preparation: boolean;
  preparation_checklist?: string[];
  created_at: string;
  updated_at: string;
}

export interface TelemedicineRecurringAppointment {
  id: number;
  beneficiary_id: number;
  appointment_type_id: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  start_date: string; // ISO date string
  end_date?: string; // ISO date string
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Relationships
  beneficiary?: Beneficiary;
  appointmentType?: TelemedicineAppointmentType;
  interviews?: Interview[];
}

export interface TelemedicineNotification {
  id: number;
  interview_id: number;
  type: 'reminder' | 'confirmation' | 'cancellation' | 'rescheduling' | 'follow_up';
  message: string;
  sent_at?: string; // ISO datetime string
  delivery_method: 'email' | 'sms' | 'push' | 'whatsapp';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  created_at: string;
  updated_at: string;
  
  // Relationships
  interview?: Interview;
}

// =====================================
// CLINICAL ALERT TYPES
// =====================================

export interface ClinicalAlert {
  id: number;
  alert_uuid: string;
  beneficiary_id: number;
  questionnaire_id?: number;
  alert_type: string;
  category: 'mental_health' | 'physical_health' | 'lifestyle' | 'medication' | 'emergency';
  priority: 'emergency' | 'urgent' | 'high' | 'medium' | 'low';
  risk_score?: number;
  risk_factors?: Record<string, any>;
  risk_scores_detail?: Record<string, any>;
  title: string;
  message: string;
  clinical_recommendations?: string[];
  intervention_options?: string[];
  status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'escalated' | 'dismissed';
  assigned_to?: number;
  acknowledged_by?: number;
  resolved_by?: number;
  acknowledged_at?: string; // ISO datetime string
  started_at?: string; // ISO datetime string
  resolved_at?: string; // ISO datetime string
  escalated_at?: string; // ISO datetime string
  sla_hours: number;
  sla_deadline: string; // ISO datetime string
  sla_breached: boolean;
  clinical_notes?: string;
  resolution_notes?: string;
  metadata?: Record<string, any>;
  audit_trail?: AuditTrailEntry[];
  created_at: string;
  updated_at: string;
  
  // Relationships
  beneficiary?: Beneficiary;
  questionnaire?: HealthQuestionnaire;
  assignedTo?: User;
  acknowledgedBy?: User;
  resolvedBy?: User;
  workflows?: AlertWorkflow[];
  
  // Computed properties
  time_to_sla_breach?: string;
  formatted_risk_factors?: FormattedRiskFactor[];
  can_be_escalated?: boolean;
}

export interface AuditTrailEntry {
  timestamp: string; // ISO datetime string
  action: string;
  description: string;
  user_id?: number;
  metadata?: Record<string, any>;
}

export interface FormattedRiskFactor {
  factor: string;
  value: any;
  severity: 'low' | 'medium' | 'high' | 'unknown';
}

export interface AlertWorkflow {
  id: number;
  alert_id: number;
  step_name: string;
  step_type: 'notification' | 'assignment' | 'escalation' | 'auto_resolve';
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  config?: Record<string, any>;
  executed_at?: string; // ISO datetime string
  result?: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  // Relationships
  alert?: ClinicalAlert;
}

// =====================================
// ADMIN TYPES
// =====================================

export interface AdminDashboardStats {
  total_users: number;
  active_users: number;
  pending_registrations: number;
  completed_onboardings: number;
  pending_documents: number;
  active_alerts: number;
  high_priority_alerts: number;
  scheduled_interviews: number;
  avg_onboarding_time: number;
  user_growth_rate: number;
  health_risk_distribution: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
  recent_activities: AdminActivity[];
}

export interface AdminActivity {
  id: number;
  type: 'user_registration' | 'document_upload' | 'questionnaire_completion' | 
        'interview_scheduled' | 'alert_created' | 'system_event';
  description: string;
  user_id?: number;
  metadata?: Record<string, any>;
  created_at: string;
  
  // Relationships
  user?: User;
}

export interface AdminHealthRiskData {
  beneficiary_id: number;
  beneficiary_name: string;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  risk_score: number;
  last_assessment: string; // ISO datetime string
  active_alerts: number;
  pending_interventions: number;
  factors: string[];
}

// =====================================
// ANALYTICS & REPORTING TYPES
// =====================================

export interface AnalyticsData {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  metrics: Record<string, number | string>;
  trends: TrendData[];
}

export interface TrendData {
  date: string; // ISO date string
  value: number;
  change_percentage?: number;
}

export interface PerformanceMetrics {
  api_response_time: number;
  database_query_time: number;
  memory_usage: string;
  active_connections: number;
  error_rate: number;
  uptime_percentage: number;
}

// =====================================
// NOTIFICATION TYPES
// =====================================

export interface Notification {
  id: number;
  type: 'achievement' | 'badge_earned' | 'level_up' | 'reminder' | 'alert' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  read_at?: string; // ISO datetime string
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  achievement_notifications: boolean;
  health_alerts: boolean;
  appointment_reminders: boolean;
  marketing_communications: boolean;
}

// =====================================
// WEBSOCKET TYPES
// =====================================

export interface WebSocketMessage {
  type: 'notification' | 'achievement' | 'alert' | 'system_update' | 'realtime_data';
  data: any;
  timestamp: string; // ISO datetime string
  user_id?: number;
  channel?: string;
}

export interface RealTimeUpdate {
  entity: 'user' | 'beneficiary' | 'document' | 'questionnaire' | 'interview' | 'alert';
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  id: number;
  data?: any;
  timestamp: string; // ISO datetime string
}

// =====================================
// FEATURE FLAG TYPES
// =====================================

export interface FeatureFlag {
  id: number;
  name: string;
  key: string;
  description?: string;
  is_active: boolean;
  rollout_percentage: number;
  target_audience?: string[];
  conditions?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserFeatureAccess {
  user_id: number;
  features: Record<string, boolean>;
  last_updated: string; // ISO datetime string
}

// =====================================
// EXPORT TYPES
// =====================================

export interface ExportRequest {
  type: 'users' | 'beneficiaries' | 'documents' | 'questionnaires' | 'interviews' | 'alerts';
  format: 'csv' | 'excel' | 'pdf' | 'json';
  filters?: Record<string, any>;
  date_range?: {
    start_date: string;
    end_date: string;
  };
  columns?: string[];
}

export interface ExportResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  file_size?: number;
  created_at: string;
  completed_at?: string;
  expires_at: string;
  error_message?: string;
}

// =====================================
// UTILITY TYPES
// =====================================

export type EntityStatus = 'active' | 'inactive' | 'pending' | 'suspended' | 'deleted';
export type Priority = 'low' | 'medium' | 'high' | 'critical' | 'emergency';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Re-export commonly used types
export type { MetaData as Metadata };