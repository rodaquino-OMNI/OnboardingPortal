/**
 * Analytics Library - Main Export
 * Sprint 2B - Analytics Infrastructure Development
 *
 * Centralized exports for the analytics infrastructure
 */

// Core emitter
export {
  AnalyticsEmitter,
  AnalyticsError,
  getAnalyticsEmitter,
  trackEvent,
  flushAnalytics,
} from './emitter';

// Type definitions
export type {
  AnalyticsEvent,
  AnalyticsConfig,
  AnalyticsValidationError,
  AnalyticsContext,
  BaseAnalyticsEvent,
  GamificationPointsEarnedEvent,
  GamificationLevelUpEvent,
  GamificationBadgeUnlockedEvent,
  AuthRegistrationStartedEvent,
  AuthRegistrationCompletedEvent,
  AuthEmailVerifiedEvent,
  DocumentsUploadCompletedEvent,
  DocumentsApprovedEvent,
  DocumentsUploadFailedEvent,
} from './types';

// Utility functions for creating events
export * from './utils/event-builders';

// Schema validation utilities
export * from './utils/validators';