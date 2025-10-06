/**
 * Sprint 2C - Registration Page
 *
 * ADR-003 Compliant: Page orchestrates, component renders
 * Feature flag: sliceA_registration
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRegistrationFlag } from '@/lib/feature-flags/hooks/useRegistrationFlag';
import { RegistrationForm } from '@onboarding/ui';
import type { RegisterData, ValidationErrors } from '@/types/registration';

export default function RegisterPage() {
  const router = useRouter();
  const { isEnabled, isLoading: flagLoading } = useRegistrationFlag();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors | undefined>();

  // Feature flag guard
  if (flagLoading) {
    return <div>Loading...</div>;
  }

  if (!isEnabled) {
    router.push('/404');
    return null;
  }

  const handleSubmit = async (data: RegisterData) => {
    setIsSubmitting(true);
    setErrors(undefined);

    try {
      // Track analytics: registration_started
      trackAnalyticsEvent({
        event_type: 'registration_started',
        user_id: undefined, // No user ID yet
        timestamp: new Date().toISOString(),
        registration_method: 'email',
      });

      // POST /api/register
      const response = await fetch('/api/register', {
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

      // Redirect to email verification
      router.push(`/callback-verify?email=${encodeURIComponent(data.email)}`);
    } catch (error) {
      setErrors({
        _form: 'Network error. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join our onboarding portal
          </p>
        </div>

        <RegistrationForm
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
          errors={errors}
        />
      </div>
    </div>
  );
}

// Analytics tracking helper (orchestration layer only)
function trackAnalyticsEvent(event: Record<string, unknown>): void {
  // TODO: Implement analytics tracking with hashed user_id
  console.log('[Analytics]', event);
}
