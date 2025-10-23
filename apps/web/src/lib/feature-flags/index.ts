/**
 * Feature Flags - Main Export
 * Sprint 2C - Registration Flow Feature Flag Setup
 *
 * Centralized exports for feature flag configuration and hooks
 */

// Core configuration
export {
  sliceA_registration,
  isFeatureFlagEnabled,
  getFeatureFlag,
  trackFeatureFlagExposure,
  featureFlags,
  type FeatureFlagConfig,
  type FeatureFlagKey,
} from './registration-flags';

// React hooks
export {
  useRegistrationFlag,
  useRegistrationFlagSSR,
  useTrackFlagExposure,
  withRegistrationFlag,
  FeatureFlagErrorBoundary,
  type UseRegistrationFlagResult,
  type WithFeatureFlagProps,
} from './hooks/useRegistrationFlag';
