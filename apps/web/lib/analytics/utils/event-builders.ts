/**
 * Analytics Event Builders - Utility Functions
 * Sprint 2B - Analytics Infrastructure Development
 *
 * Type-safe builders for creating analytics events with proper defaults
 */

import type {
  AnalyticsContext,
  GamificationPointsEarnedEvent,
  GamificationLevelUpEvent,
  GamificationBadgeUnlockedEvent,
  AuthRegistrationStartedEvent,
  AuthRegistrationCompletedEvent,
  AuthEmailVerifiedEvent,
  DocumentsUploadCompletedEvent,
  DocumentsApprovedEvent,
  DocumentsUploadFailedEvent,
} from '../types';

import { AnalyticsEmitter } from '../emitter';

/**
 * Base event builder with common properties
 */
function createBaseEvent(
  event: string,
  userId?: string,
  context: Partial<AnalyticsContext> = {}
) {
  return {
    schema_version: '1.0.0',
    event,
    timestamp: new Date().toISOString(),
    user_id: userId,
    platform: 'web' as const,
    context: {
      environment: 'production',
      ...context,
    },
  };
}

/**
 * Gamification Events
 */
export function createPointsEarnedEvent({
  userId,
  actionType,
  pointsAmount,
  pointsTotalAfter,
  bonusType = null,
  relatedEntityType = null,
  relatedEntityId = null,
  context = {},
}: {
  userId: string;
  actionType: string;
  pointsAmount: number;
  pointsTotalAfter: number;
  bonusType?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  context?: Partial<AnalyticsContext>;
}): GamificationPointsEarnedEvent {
  return {
    ...createBaseEvent('gamification.points_earned', userId, context),
    properties: {
      action_type: actionType,
      points_amount: pointsAmount,
      points_total_after: pointsTotalAfter,
      bonus_type: bonusType,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
    },
  } as GamificationPointsEarnedEvent;
}

export function createLevelUpEvent({
  userId,
  oldLevel,
  newLevel,
  pointsAtLevelup,
  timeToLevelupSeconds,
  benefitsUnlocked,
  context = {},
}: {
  userId: string;
  oldLevel: string;
  newLevel: string;
  pointsAtLevelup: number;
  timeToLevelupSeconds: number;
  benefitsUnlocked: string[];
  context?: Partial<AnalyticsContext>;
}): GamificationLevelUpEvent {
  return {
    ...createBaseEvent('gamification.level_up', userId, context),
    properties: {
      old_level: oldLevel,
      new_level: newLevel,
      points_at_levelup: pointsAtLevelup,
      time_to_levelup_seconds: timeToLevelupSeconds,
      benefits_unlocked: benefitsUnlocked,
    },
  } as GamificationLevelUpEvent;
}

export function createBadgeUnlockedEvent({
  userId,
  badgeId,
  badgeName,
  badgeCategory,
  badgeRarity,
  pointsAwarded,
  context = {},
}: {
  userId: string;
  badgeId: string;
  badgeName: string;
  badgeCategory: string;
  badgeRarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  pointsAwarded: number;
  context?: Partial<AnalyticsContext>;
}): GamificationBadgeUnlockedEvent {
  return {
    ...createBaseEvent('gamification.badge_unlocked', userId, context),
    properties: {
      badge_id: badgeId,
      badge_name: badgeName,
      badge_category: badgeCategory,
      badge_rarity: badgeRarity,
      points_awarded: pointsAwarded,
    },
  } as GamificationBadgeUnlockedEvent;
}

/**
 * Authentication Events
 */
export function createRegistrationStartedEvent({
  source,
  utmSource,
  utmMedium,
  utmCampaign,
  context = {},
}: {
  source: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  context?: Partial<AnalyticsContext>;
}): AuthRegistrationStartedEvent {
  return {
    ...createBaseEvent('auth.registration_started', undefined, context),
    properties: {
      source,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
    },
  } as AuthRegistrationStartedEvent;
}

export function createRegistrationCompletedEvent({
  userId,
  timeToCompleteSeconds,
  cpfValidationPassed,
  emailDomain,
  phoneValidated,
  lgpdConsent,
  context = {},
}: {
  userId: string;
  timeToCompleteSeconds: number;
  cpfValidationPassed: boolean;
  emailDomain: string;
  phoneValidated: boolean;
  lgpdConsent: boolean;
  context?: Partial<AnalyticsContext>;
}): AuthRegistrationCompletedEvent {
  return {
    ...createBaseEvent('auth.registration_completed', userId, context),
    properties: {
      time_to_complete_seconds: timeToCompleteSeconds,
      cpf_validation_passed: cpfValidationPassed,
      email_domain: emailDomain,
      phone_validated: phoneValidated,
      lgpd_consent: lgpdConsent,
    },
  } as AuthRegistrationCompletedEvent;
}

export function createEmailVerifiedEvent({
  userId,
  verificationMethod,
  timeSinceRegistrationSeconds,
  context = {},
}: {
  userId: string;
  verificationMethod: string;
  timeSinceRegistrationSeconds: number;
  context?: Partial<AnalyticsContext>;
}): AuthEmailVerifiedEvent {
  return {
    ...createBaseEvent('auth.email_verified', userId, context),
    properties: {
      verification_method: verificationMethod,
      time_since_registration_seconds: timeSinceRegistrationSeconds,
    },
  } as AuthEmailVerifiedEvent;
}

/**
 * Document Events
 */
export function createDocumentUploadCompletedEvent({
  userId,
  documentId,
  documentType,
  uploadDurationMs,
  fileSizeBytes,
  context = {},
}: {
  userId: string;
  documentId: number;
  documentType: string;
  uploadDurationMs: number;
  fileSizeBytes: number;
  context?: Partial<AnalyticsContext>;
}): DocumentsUploadCompletedEvent {
  return {
    ...createBaseEvent('documents.upload_completed', userId, context),
    properties: {
      document_id: documentId,
      document_type: documentType,
      upload_duration_ms: uploadDurationMs,
      file_size_bytes: fileSizeBytes,
    },
  } as DocumentsUploadCompletedEvent;
}

export function createDocumentApprovedEvent({
  userId,
  documentId,
  documentType,
  approvedBy,
  timeToApprovalHours,
  manualReviewRequired,
  context = {},
}: {
  userId: string;
  documentId: number;
  documentType: string;
  approvedBy: string;
  timeToApprovalHours: number;
  manualReviewRequired: boolean;
  context?: Partial<AnalyticsContext>;
}): DocumentsApprovedEvent {
  return {
    ...createBaseEvent('documents.approved', userId, context),
    properties: {
      document_id: documentId,
      document_type: documentType,
      approved_by: approvedBy,
      time_to_approval_hours: timeToApprovalHours,
      manual_review_required: manualReviewRequired,
    },
  } as DocumentsApprovedEvent;
}

export function createDocumentUploadFailedEvent({
  userId,
  documentType,
  failureReason,
  fileSizeBytes,
  retryAttempt,
  context = {},
}: {
  userId?: string;
  documentType: string;
  failureReason: string;
  fileSizeBytes?: number;
  retryAttempt?: number;
  context?: Partial<AnalyticsContext>;
}): DocumentsUploadFailedEvent {
  return {
    ...createBaseEvent('documents.upload_failed', userId, context),
    properties: {
      document_type: documentType,
      failure_reason: failureReason,
      file_size_bytes: fileSizeBytes,
      retry_attempt: retryAttempt,
    },
  } as DocumentsUploadFailedEvent;
}

/**
 * Convenience functions for automatic user ID hashing
 */
export function hashUserId(userId: number | string): string {
  return AnalyticsEmitter.hashValue(String(userId), 'hash');
}

export function hashAdminId(adminId: number | string): string {
  return `admin_${AnalyticsEmitter.hashValue(String(adminId), '').substring(0, 8)}`;
}

export function extractEmailDomain(email: string): string {
  return AnalyticsEmitter.extractEmailDomain(email);
}