/**
 * Registration Completion Page - /completion
 * Sprint 2C - Registration Flow Implementation
 *
 * ADR-003 COMPLIANCE: This page ORCHESTRATES completion flow
 * - Feature flag checking
 * - Analytics tracking (registration_completed, points_earned)
 * - Success messaging
 * - Navigation to dashboard
 *
 * ADR-002 COMPLIANCE: NO browser storage usage
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Card } from '@austa/ui/ui/card';
import { Button } from '@austa/ui/ui/button';
import { useRegistrationFlag } from '@/lib/feature-flags/hooks/useRegistrationFlag';
import { trackEvent } from '@/lib/analytics';
import {
  createRegistrationCompletedEvent,
  createPointsEarnedEvent,
  hashUserId,
  extractEmailDomain
} from '@/lib/analytics/utils/event-builders';

interface CompletionData {
  user_id: string;
  email: string;
  cpf_validated: boolean;
  phone_validated: boolean;
  lgpd_consent: boolean;
  registration_start_time: number;
  points_awarded: number;
  total_points: number;
}

/**
 * Completion Page Component
 * Shows success message and tracks final analytics events
 */
export default function CompletionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isEnabled, isLoading } = useRegistrationFlag();

  const [completionData, setCompletionData] = useState<CompletionData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = searchParams.get('user_id');

  // Feature flag check
  useEffect(() => {
    if (!isLoading && !isEnabled) {
      notFound();
    }
  }, [isEnabled, isLoading]);

  /**
   * Fetch completion data and track analytics events
   */
  useEffect(() => {
    if (!userId || !isEnabled) {
      if (!isLoading) {
        setError('Sessão inválida');
        setIsLoadingData(false);
      }
      return;
    }

    const fetchCompletionData = async () => {
      try {
        const response = await fetch(`/api/registration/completion?user_id=${userId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Falha ao carregar dados');
        }

        setCompletionData(data);

        // Track registration_completed event
        const hashedUserId = hashUserId(userId);
        const timeToComplete = data.registration_start_time
          ? Math.floor((Date.now() - data.registration_start_time) / 1000)
          : 0;

        await trackEvent(
          createRegistrationCompletedEvent({
            userId: hashedUserId,
            timeToCompleteSeconds: timeToComplete,
            cpfValidationPassed: data.cpf_validated,
            emailDomain: extractEmailDomain(data.email),
            phoneValidated: data.phone_validated,
            lgpdConsent: data.lgpd_consent,
          })
        );

        // Track points_earned event (registration completion reward)
        if (data.points_awarded > 0) {
          await trackEvent(
            createPointsEarnedEvent({
              userId: hashedUserId,
              actionType: 'registration_completed',
              pointsAmount: data.points_awarded,
              pointsTotalAfter: data.total_points,
              bonusType: 'first_time_registration',
              relatedEntityType: 'user',
              relatedEntityId: parseInt(userId, 10),
            })
          );
        }

        setIsLoadingData(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
        setError(errorMessage);
        setIsLoadingData(false);
        console.error('Completion data fetch error:', err);
      }
    };

    fetchCompletionData();
  }, [userId, isEnabled, isLoading]);

  // Loading state
  if (isLoading || isLoadingData) {
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

  // Error state
  if (error || !completionData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="text-red-600">
            <h2 className="text-xl font-bold mb-2">Erro</h2>
            <p className="mb-4">{error || 'Dados não encontrados'}</p>
            <Button onClick={() => router.push('/login')}>
              Ir para Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <svg
            className="h-20 w-20 text-green-500 mx-auto"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-green-600 mb-2">
          Cadastro Concluído!
        </h1>
        <p className="text-gray-600 mb-6">
          Bem-vindo(a) ao Portal de Onboarding! Sua conta foi criada com sucesso.
        </p>

        {/* Gamification Points */}
        {completionData.points_awarded > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <svg
                className="h-8 w-8 text-blue-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
              </svg>
              <span className="text-2xl font-bold text-blue-600">
                +{completionData.points_awarded} pontos
              </span>
            </div>
            <p className="text-sm text-gray-700">
              Você ganhou pontos por completar seu cadastro!
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Total de pontos: {completionData.total_points}
            </p>
          </div>
        )}

        {/* Next Steps */}
        <div className="mb-6 text-left">
          <h3 className="font-semibold text-gray-800 mb-3">Próximos Passos:</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Complete seu perfil para desbloquear mais recursos</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Faça upload de seus documentos</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Agende sua entrevista de admissão</span>
            </li>
          </ul>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex justify-center items-center space-x-2">
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          </div>
          <p className="text-xs text-gray-600 mt-2">Cadastro 100% completo</p>
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => router.push('/dashboard')}
          className="w-full"
          size="lg"
        >
          Ir para Dashboard
        </Button>

        {/* Additional Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Você receberá um email de confirmação em breve.
          </p>
        </div>
      </Card>
    </div>
  );
}
