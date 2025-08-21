'use client';

import { useCallback } from 'react';

/**
 * Hook for managing onboarding session cookies
 * Provides utilities to set, clear, and check onboarding session state
 */
export function useOnboardingSession() {
  
  /**
   * Set onboarding session cookie with specific stage
   */
  const setOnboardingSession = useCallback((stage: string) => {
    if (typeof document !== 'undefined') {
      const cookieString = `onboarding_session=${stage}; path=/; max-age=7200; SameSite=Lax`;
      document.cookie = cookieString;
      console.log('[OnboardingSession] Set session:', stage);
    }
  }, []);

  /**
   * Clear onboarding session cookie
   */
  const clearOnboardingSession = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.cookie = 'onboarding_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      console.log('[OnboardingSession] Session cleared');
    }
  }, []);

  /**
   * Check if onboarding session exists
   */
  const hasOnboardingSession = useCallback(() => {
    if (typeof document === 'undefined') return false;
    return document.cookie.includes('onboarding_session=');
  }, []);

  /**
   * Get current onboarding session stage
   */
  const getOnboardingStage = useCallback(() => {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'onboarding_session') {
        return value;
      }
    }
    return null;
  }, []);

  /**
   * Set basic auth cookie for onboarding access
   */
  const setBasicAuth = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.cookie = 'basic_auth=true; path=/; max-age=7200; SameSite=Lax';
      console.log('[OnboardingSession] Basic auth set');
    }
  }, []);

  /**
   * Initialize onboarding session on component mount
   */
  const initializeOnboardingSession = useCallback((stage: string = 'started') => {
    if (!hasOnboardingSession()) {
      setOnboardingSession(stage);
      setBasicAuth();
    }
  }, [hasOnboardingSession, setOnboardingSession, setBasicAuth]);

  return {
    setOnboardingSession,
    clearOnboardingSession,
    hasOnboardingSession,
    getOnboardingStage,
    setBasicAuth,
    initializeOnboardingSession,
  };
}