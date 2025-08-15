/**
 * useProfile - Clean hook for profile management
 * Bridges UI components with business logic
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { ProfileService, Profile, ProfileMetrics } from './ProfileService';
import { apiGateway } from '@/modules/api/ApiGateway';
import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { unifiedState } from '@/modules/state/UnifiedStateAdapter';

const profileService = new ProfileService();

export interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  metrics: ProfileMetrics | null;
  updateProfile: (data: Partial<Profile>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  validateField: (field: keyof Profile, value: any) => string | null;
  needsCompletion: boolean;
  suggestions: string[];
}

/**
 * Hook for profile management
 */
export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ProfileMetrics | null>(null);

  /**
   * Load profile from API
   */
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiGateway.execute<any>({
        request: {
          method: 'GET',
          endpoint: '/api/auth/profile',
          cache: true
        }
      });

      if (response.success && response.data) {
        const transformedProfile = profileService.transformProfile(response.data);
        setProfile(transformedProfile);
        setMetrics(profileService.calculateMetrics(transformedProfile));
        
        // Store in unified state
        unifiedState.set('user', 'profile', transformedProfile);
        
        // Emit event for other components
        eventBus.emit(EventTypes.USER_PROFILE_UPDATED, transformedProfile);
      } else {
        throw new Error(response.error || 'Failed to load profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
      console.error('[useProfile] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update profile
   */
  const updateProfile = useCallback(async (data: Partial<Profile>): Promise<boolean> => {
    if (!profile) return false;

    // Validate before submission
    const validation = profileService.validateProfile({ ...profile, ...data });
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      setError(firstError);
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const submissionData = profileService.prepareForSubmission(data);
      
      const response = await apiGateway.execute<any>({
        request: {
          method: 'PUT',
          endpoint: '/api/auth/profile',
          body: submissionData
        }
      });

      if (response.success && response.data) {
        const updatedProfile = profileService.transformProfile(response.data);
        setProfile(updatedProfile);
        setMetrics(profileService.calculateMetrics(updatedProfile));
        
        // Update unified state
        unifiedState.set('user', 'profile', updatedProfile);
        
        // Emit update event
        eventBus.emit(EventTypes.USER_PROFILE_UPDATED, updatedProfile);
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to update profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      console.error('[useProfile] Update failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [profile]);

  /**
   * Validate single field
   */
  const validateField = useCallback((field: keyof Profile, value: any): string | null => {
    const tempProfile = { [field]: value } as Partial<Profile>;
    const validation = profileService.validateProfile(tempProfile);
    return validation.errors[field] || null;
  }, []);

  /**
   * Refresh profile
   */
  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  // Load profile on mount
  useEffect(() => {
    // Check if profile exists in unified state first
    const cachedProfile = unifiedState.get<Profile>('user', 'profile');
    if (cachedProfile) {
      setProfile(cachedProfile);
      setMetrics(profileService.calculateMetrics(cachedProfile));
      setLoading(false);
    } else {
      loadProfile();
    }
  }, [loadProfile]);

  // Listen for profile updates from other components
  useEffect(() => {
    const unsubscribe = eventBus.on<Profile>(
      EventTypes.USER_PROFILE_UPDATED,
      (event) => {
        if (event.payload && event.source !== 'useProfile') {
          setProfile(event.payload);
          setMetrics(profileService.calculateMetrics(event.payload));
        }
      }
    );

    return unsubscribe;
  }, []);

  // Calculate derived values
  const needsCompletion = profile ? profileService.needsCompletion(profile) : false;
  const suggestions = profile ? profileService.getCompletionSuggestions(profile) : [];

  return {
    profile,
    loading,
    error,
    metrics,
    updateProfile,
    refreshProfile,
    validateField,
    needsCompletion,
    suggestions
  };
}

/**
 * Hook for profile display formatting
 */
export function useProfileDisplay(profile: Profile | null) {
  if (!profile) return null;
  return profileService.formatForDisplay(profile);
}