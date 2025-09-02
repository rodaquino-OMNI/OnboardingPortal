'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import apiService from '@/services/api';

/**
 * Feature flag configuration matching backend service
 */
const FEATURE_FLAGS = {
  'admin.role_management_ui': {
    name: 'Role Management UI',
    default: false,
  },
  'admin.security_audit_ui': {
    name: 'Security Audit UI',
    default: false,
  },
  'admin.system_settings_ui': {
    name: 'System Settings UI', 
    default: false,
  },
  'admin.user_management_enhanced': {
    name: 'Enhanced User Management',
    default: false,
  },
  'admin.custom_role_system': {
    name: 'Custom Role System',
    default: false,
  },
  'admin.real_time_analytics': {
    name: 'Real-time Analytics',
    default: false,
  },
  'admin.bulk_operations': {
    name: 'Bulk Operations',
    default: false,
  },
  'admin.advanced_security': {
    name: 'Advanced Security Features',
    default: false,
  },
};

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

interface FeatureFlagResponse {
  enabled: boolean;
  rollout_percentage: number;
  user_enabled: boolean;
}

/**
 * Hook to check if a feature flag is enabled
 * Uses backend API with caching and fallback to defaults
 */
export function useFeatureFlag(flagKey: FeatureFlagKey): boolean {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState<boolean>(
    FEATURE_FLAGS[flagKey]?.default || false
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        // Skip API call if no user or invalid flag
        if (!user || !FEATURE_FLAGS[flagKey]) {
          setIsEnabled(FEATURE_FLAGS[flagKey]?.default || false);
          setLoading(false);
          return;
        }

        // Check localStorage cache first
        const cacheKey = `feature_flag:${flagKey}:${user.id}`;
        const cachedValue = localStorage.getItem(cacheKey);
        if (cachedValue !== null) {
          const cached = JSON.parse(cachedValue);
          if (cached.expires > Date.now()) {
            setIsEnabled(cached.enabled);
            setLoading(false);
            return;
          }
        }

        // Call backend API
        const response = await apiService.get<FeatureFlagResponse>(
          `/api/admin/feature-flags/${flagKey}`
        );

        if (response.success && response.data) {
          const enabled = response.data.user_enabled || response.data.enabled;
          setIsEnabled(enabled);
          
          // Cache for 5 minutes
          localStorage.setItem(cacheKey, JSON.stringify({
            enabled,
            expires: Date.now() + 300000
          }));
        } else {
          // Fallback to default
          setIsEnabled(FEATURE_FLAGS[flagKey]?.default || false);
        }
      } catch (error) {
        console.error(`Failed to check feature flag ${flagKey}:`, error);
        // Fallback to default on error
        setIsEnabled(FEATURE_FLAGS[flagKey]?.default || false);
      } finally {
        setLoading(false);
      }
    };

    checkFeatureFlag();
  }, [flagKey, user]);

  return isEnabled;
}

/**
 * Hook to get all feature flags for the current user
 */
export function useFeatureFlags() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<Record<FeatureFlagKey, boolean>>({} as any);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllFlags = async () => {
      try {
        if (!user) {
          // Set all to defaults
          const defaultFlags: Record<string, boolean> = {};
          Object.entries(FEATURE_FLAGS).forEach(([key, config]) => {
            defaultFlags[key] = config.default;
          });
          setFlags(defaultFlags as Record<FeatureFlagKey, boolean>);
          setLoading(false);
          return;
        }

        // Check cache
        const cacheKey = `feature_flags:all:${user.id}`;
        const cachedValue = localStorage.getItem(cacheKey);
        if (cachedValue) {
          const cached = JSON.parse(cachedValue);
          if (cached.expires > Date.now()) {
            setFlags(cached.flags);
            setLoading(false);
            return;
          }
        }

        // Call API
        const response = await apiService.get<Record<string, FeatureFlagResponse>>(
          '/api/admin/feature-flags'
        );

        if (response.success && response.data) {
          const enabledFlags: Record<string, boolean> = {};
          Object.entries(response.data).forEach(([key, flag]) => {
            enabledFlags[key] = flag.user_enabled || flag.enabled;
          });
          setFlags(enabledFlags as Record<FeatureFlagKey, boolean>);
          
          // Cache for 5 minutes
          localStorage.setItem(cacheKey, JSON.stringify({
            flags: enabledFlags,
            expires: Date.now() + 300000
          }));
        } else {
          // Use defaults
          const defaultFlags: Record<string, boolean> = {};
          Object.entries(FEATURE_FLAGS).forEach(([key, config]) => {
            defaultFlags[key] = config.default;
          });
          setFlags(defaultFlags as Record<FeatureFlagKey, boolean>);
        }
      } catch (error) {
        console.error('Failed to load feature flags:', error);
        // Use defaults on error
        const defaultFlags: Record<string, boolean> = {};
        Object.entries(FEATURE_FLAGS).forEach(([key, config]) => {
          defaultFlags[key] = config.default;
        });
        setFlags(defaultFlags as Record<FeatureFlagKey, boolean>);
      } finally {
        setLoading(false);
      }
    };

    loadAllFlags();
  }, [user]);

  return { flags, loading };
}

/**
 * Utility to clear feature flag cache
 */
export function clearFeatureFlagCache() {
  const keys = Object.keys(localStorage).filter(key => 
    key.startsWith('feature_flag:') || key.startsWith('feature_flags:')
  );
  keys.forEach(key => localStorage.removeItem(key));
}

/**
 * Component wrapper that conditionally renders based on feature flag
 */
export function FeatureFlag({ 
  flag, 
  children, 
  fallback = null 
}: {
  flag: FeatureFlagKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = useFeatureFlag(flag);
  
  if (isEnabled) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}
