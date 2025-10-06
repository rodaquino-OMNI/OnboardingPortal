/**
 * Registration Page - /register
 * Sprint 2C - Registration Flow Implementation
 *
 * ADR-003 COMPLIANCE: This page ORCHESTRATES, components RENDER
 * - Feature flag checking
 * - Analytics tracking (registration_started)
 * - API communication
 * - Navigation control
 *
 * ADR-002 COMPLIANCE: NO browser storage usage
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { RegistrationForm, RegistrationFormData } from '@austa/ui/components/registration';
import { useRegistrationFlag } from '@/lib/feature-flags/hooks/useRegistrationFlag';
import { trackEvent } from '@/lib/analytics';
import { createRegistrationStartedEvent } from '@/lib/analytics/utils/event-builders';

/**
 * Registration Page Component
 * Orchestrates the registration flow with feature flag checks and analytics
 */
export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enabled, loading } = useRegistrationFlag();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationStartTime] = useState(() => Date.now());

  // Extract UTM parameters from URL
  const utmParams = {
    source: searchParams.get('utm_source') || 'direct',
    medium: searchParams.get('utm_medium') || undefined,
    campaign: searchParams.get('utm_campaign') || undefined,
  };

  // Feature flag check - show 404 if disabled
  useEffect(() => {
    if (!loading && !enabled) {
      notFound();
    }
  }, [enabled, loading]);

  // Track registration_started event on page load
  useEffect(() => {
    if (enabled) {
      // Track registration started event (no user_id yet)
      trackEvent(
        createRegistrationStartedEvent({
          source: utmParams.source,
          utmSource: utmParams.source,
          utmMedium: utmParams.medium,
          utmCampaign: utmParams.campaign,
        })
      ).catch(err => {
        console.error('Failed to track registration_started event:', err);
      });
    }
  }, [enabled, utmParams.source, utmParams.medium, utmParams.campaign]);

  /**
   * Handle registration form submission
   * - POST to /api/register endpoint
   * - Store registration start time for analytics
   * - Navigate to verification page on success
   */
  const handleRegistrationSubmit = async (data: RegistrationFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          registration_start_time: registrationStartTime,
          utm_source: utmParams.source,
          utm_medium: utmParams.medium,
          utm_campaign: utmParams.campaign,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao criar conta');
      }

      // Success - navigate to email verification page
      // Pass verification token via URL (not localStorage per ADR-002)
      router.push(`/callback-verify?token=${result.verification_token}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking feature flag
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Don't render if feature is disabled (will trigger 404)
  if (!enabled) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <RegistrationForm
          onSubmit={handleRegistrationSubmit}
          isLoading={isSubmitting}
          error={error}
          utmParams={utmParams}
        />

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <a href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
              Fazer login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
