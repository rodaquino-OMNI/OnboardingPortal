/**
 * Analytics Type Definitions
 * Sprint 2B - Analytics Infrastructure
 *
 * Defines TypeScript interfaces for all analytics events based on ANALYTICS_SPEC v1.0.0
 * No PII/PHI data included - all sensitive data is hashed or excluded
 */

export interface BaseAnalyticsEvent {
  schema_version: string;
  event: string;
  timestamp: string;
  user_id?: string; // Hashed user ID
  session_id?: string;
  platform: 'web' | 'mobile' | 'api';
  properties: Record<string, any>;
  context: AnalyticsContext;
}

export interface AnalyticsContext {
  user_agent?: string;
  ip_address_hash?: string; // Hashed IP address
  screen_resolution?: string;
  timezone?: string;
  referrer?: string;
  environment?: string;
  server_timestamp?: string;
}

// Gamification Events
export interface GamificationPointsEarnedEvent extends BaseAnalyticsEvent {
  event: 'gamification.points_earned';
  properties: {
    action_type: string;
    points_amount: number;
    points_total_after: number;
    bonus_type?: string;
    related_entity_type?: string;
    related_entity_id?: number;
  };
}

export interface GamificationLevelUpEvent extends BaseAnalyticsEvent {
  event: 'gamification.level_up';
  properties: {
    old_level: string;
    new_level: string;
    points_at_levelup: number;
    time_to_levelup_seconds: number;
    benefits_unlocked: string[];
  };
}

export interface GamificationBadgeUnlockedEvent extends BaseAnalyticsEvent {
  event: 'gamification.badge_unlocked';
  properties: {
    badge_id: string;
    badge_name: string;
    badge_category: string;
    badge_rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    points_awarded: number;
  };
}

// Authentication Events
export interface AuthRegistrationStartedEvent extends BaseAnalyticsEvent {
  event: 'auth.registration_started';
  properties: {
    source: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
}

export interface AuthRegistrationCompletedEvent extends BaseAnalyticsEvent {
  event: 'auth.registration_completed';
  properties: {
    time_to_complete_seconds: number;
    cpf_validation_passed: boolean;
    email_domain: string; // Only domain, no local part
    phone_validated: boolean;
    lgpd_consent: boolean;
  };
}

export interface AuthEmailVerifiedEvent extends BaseAnalyticsEvent {
  event: 'auth.email_verified';
  properties: {
    verification_method: string;
    time_since_registration_seconds: number;
  };
}

// Document Events
export interface DocumentsUploadCompletedEvent extends BaseAnalyticsEvent {
  event: 'documents.upload_completed';
  properties: {
    document_id: number;
    document_type: string;
    upload_duration_ms: number;
    file_size_bytes: number;
  };
}

export interface DocumentsApprovedEvent extends BaseAnalyticsEvent {
  event: 'documents.approved';
  properties: {
    document_id: number;
    document_type: string;
    approved_by: string; // Hashed admin ID
    time_to_approval_hours: number;
    manual_review_required: boolean;
  };
}

export interface DocumentsUploadFailedEvent extends BaseAnalyticsEvent {
  event: 'documents.upload_failed';
  properties: {
    document_type: string;
    failure_reason: string;
    file_size_bytes?: number;
    retry_attempt?: number;
  };
}

// Union type for all analytics events
export type AnalyticsEvent =
  | GamificationPointsEarnedEvent
  | GamificationLevelUpEvent
  | GamificationBadgeUnlockedEvent
  | AuthRegistrationStartedEvent
  | AuthRegistrationCompletedEvent
  | AuthEmailVerifiedEvent
  | DocumentsUploadCompletedEvent
  | DocumentsApprovedEvent
  | DocumentsUploadFailedEvent;

// Analytics Error Types
export interface AnalyticsValidationError {
  event: string;
  field: string;
  message: string;
  value?: any;
}

export interface AnalyticsConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  strictValidation?: boolean;
}