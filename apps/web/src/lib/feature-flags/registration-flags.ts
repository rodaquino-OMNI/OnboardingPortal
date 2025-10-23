/**
 * Sprint 2C - Registration Flow Feature Flags
 *
 * ADR-002 Compliant: Server-driven flags, no browser storage
 * Analytics: Tracks flag exposure events
 */

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  variant?: 'control' | 'treatment';
  metadata?: Record<string, unknown>;
}

export interface RegistrationFlags {
  sliceA_registration: FeatureFlag;
}

/**
 * Get feature flag configuration
 * Server-side evaluation only, never cached client-side
 */
export function getRegistrationFlags(): RegistrationFlags {
  const env = process.env.NODE_ENV;
  const deploymentStage = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE || 'development';

  // Development: Always enabled
  if (env === 'development') {
    return {
      sliceA_registration: {
        key: 'sliceA_registration',
        enabled: true,
        variant: 'treatment',
        metadata: { env: 'development' }
      }
    };
  }

  // Staging: Canary rollout (50%)
  if (deploymentStage === 'staging') {
    const isCanary = Math.random() < 0.5;
    return {
      sliceA_registration: {
        key: 'sliceA_registration',
        enabled: isCanary,
        variant: isCanary ? 'treatment' : 'control',
        metadata: { env: 'staging', canary: isCanary }
      }
    };
  }

  // Production: Gradual rollout (20%)
  if (deploymentStage === 'production') {
    const isEnabled = Math.random() < 0.2;
    return {
      sliceA_registration: {
        key: 'sliceA_registration',
        enabled: isEnabled,
        variant: isEnabled ? 'treatment' : 'control',
        metadata: { env: 'production', rollout: '20%' }
      }
    };
  }

  // Default: Disabled
  return {
    sliceA_registration: {
      key: 'sliceA_registration',
      enabled: false,
      variant: 'control',
      metadata: { env: 'unknown' }
    }
  };
}

/**
 * Track feature flag exposure event
 * Analytics schema: feature_flag.exposed
 */
export function trackFlagExposure(flag: FeatureFlag, userId?: string): void {
  // Analytics tracking would go here
  // Must use SHA-256 hashed user_id if provided
  const event = {
    event_type: 'feature_flag.exposed',
    flag_key: flag.key,
    flag_enabled: flag.enabled,
    flag_variant: flag.variant,
    user_id: userId ? `hash_${hashUserId(userId)}` : undefined,
    timestamp: new Date().toISOString(),
    metadata: flag.metadata
  };

  // Server-side analytics emission
  if (typeof window === 'undefined') {
    // TODO: Emit to analytics service
    console.log('[Analytics] Flag exposure:', event);
  }
}

/**
 * Hash user ID with SHA-256 for privacy
 * ADR-004 compliant
 */
function hashUserId(userId: string): string {
  // TODO: Implement SHA-256 hashing
  // For now, placeholder
  return 'placeholder_hash';
}
