/**
 * Minimal Profile Completion Page - /profile/minimal
 * Sprint 2C - Registration Flow Implementation
 *
 * ADR-003 COMPLIANCE: This page ORCHESTRATES profile completion
 * - Feature flag checking
 * - Analytics tracking (profile_minimal_completed)
 * - API communication
 * - Navigation control
 *
 * ADR-002 COMPLIANCE: NO browser storage - user_id from URL params only
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { MinimalProfileForm, MinimalProfileData } from '@austa/ui/components/registration';
import { useRegistrationFlag } from '@/lib/feature-flags/hooks/useRegistrationFlag';
import { trackEvent } from '@/lib/analytics';
import { hashUserId } from '@/lib/analytics/utils/event-builders';

/**
 * Minimal Profile Page Component
 * Collects essential user information after email verification
 */
export default function MinimalProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isEnabled, isLoading } = useRegistrationFlag();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = searchParams.get('user_id');

  // Feature flag check
  useEffect(() => {
    if (!isLoading && !isEnabled) {
      notFound();
    }
  }, [isEnabled, isLoading]);

  // Validate user_id parameter
  useEffect(() => {
    if (!isLoading && isEnabled && !userId) {
      setError('Sessão inválida. Por favor, faça login novamente.');
    }
  }, [userId, isEnabled, isLoading]);

  /**
   * Handle profile completion form submission
   * - POST to /api/profile/minimal
   * - Track profile_minimal_completed event
   * - Navigate to completion page
   */
  const handleProfileSubmit = async (data: MinimalProfileData) => {
    if (!userId) {
      setError('ID de usuário não encontrado');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/minimal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          ...data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao salvar perfil');
      }

      // Track profile_minimal_completed event
      const hashedUserId = hashUserId(userId);

      await trackEvent({
        schema_version: '1.0.0',
        event: 'auth.profile_minimal_completed',
        timestamp: new Date().toISOString(),
        user_id: hashedUserId,
        platform: 'web' as const,
        properties: {
          profile_completion_time_seconds: result.completion_time_seconds || 0,
          fields_completed: Object.keys(data).length,
          has_address: !!data.address,
        },
        context: {
          environment: process.env.NODE_ENV || 'production',
        },
      });

      // Success - navigate to completion page
      router.push(`/completion?user_id=${userId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Profile completion error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Don't render if feature is disabled
  if (!isEnabled) {
    return null;
  }

  // Show error if no user_id
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="text-red-600 text-center">
            <h2 className="text-xl font-bold mb-2">Sessão Inválida</h2>
            <p className="mb-4">Por favor, faça login novamente.</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ir para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="mb-8 text-center">
          <div className="mb-4">
            <div className="flex justify-center items-center space-x-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Passo 3 de 4</p>
          </div>
        </div>

        <MinimalProfileForm
          onSubmit={handleProfileSubmit}
          isLoading={isSubmitting}
          error={error}
        />

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Suas informações estão protegidas de acordo com a LGPD
          </p>
        </div>
      </div>
    </div>
  );
}
