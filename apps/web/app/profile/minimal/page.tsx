/**
 * Sprint 2C - Minimal Profile Page
 *
 * ADR-003 Compliant: Page orchestrates, component renders
 * Analytics: Tracks profile_minimal_completed event
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MinimalProfileForm } from '@onboarding/ui';
import type { ProfileData, ValidationErrors } from '@/types/registration';

export default function MinimalProfilePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors | undefined>();

  const handleSubmit = async (data: ProfileData) => {
    setIsSubmitting(true);
    setErrors(undefined);

    try {
      // POST /api/profile/minimal
      const response = await fetch('/api/profile/minimal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // httpOnly cookies
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors(errorData.errors);
        return;
      }

      const result = await response.json();

      // Track analytics: profile_minimal_completed
      trackAnalyticsEvent({
        event_type: 'onboarding.profile_minimal_completed',
        user_id: `hash_${result.userId}`, // Server returns hashed ID
        timestamp: new Date().toISOString(),
        profile_completion_percentage: result.completionPercentage,
        fields_completed: Object.keys(data),
      });

      // Redirect to completion page
      router.push('/completion');
    } catch (error) {
      setErrors({
        _form: 'Network error. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Profile
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Just a few more details to get started
          </p>
        </div>

        <MinimalProfileForm
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
          errors={errors}
        />
      </div>
    </div>
  );
}

function trackAnalyticsEvent(event: Record<string, unknown>): void {
  console.log('[Analytics]', event);
}
