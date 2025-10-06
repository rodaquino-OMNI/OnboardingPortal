/**
 * Email Verification Callback Page - /callback-verify
 * Sprint 2C - Registration Flow Implementation
 *
 * ADR-003 COMPLIANCE: This page ORCHESTRATES verification logic
 * - Token validation from URL params
 * - Analytics tracking (email_verified)
 * - API communication
 * - Navigation control
 *
 * ADR-002 COMPLIANCE: NO browser storage usage - token from URL only
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Card } from '@austa/ui/ui/card';
import { Button } from '@austa/ui/ui/button';
import { useRegistrationFlag } from '@/lib/feature-flags/hooks/useRegistrationFlag';
import { trackEvent } from '@/lib/analytics';
import { createEmailVerifiedEvent, hashUserId } from '@/lib/analytics/utils/event-builders';

type VerificationState = 'verifying' | 'success' | 'error' | 'expired';

/**
 * Email Verification Page Component
 * Handles email verification token validation and tracking
 */
export default function CallbackVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enabled, loading } = useRegistrationFlag();

  const [verificationState, setVerificationState] = useState<VerificationState>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const token = searchParams.get('token');

  // Feature flag check
  useEffect(() => {
    if (!loading && !enabled) {
      notFound();
    }
  }, [enabled, loading]);

  /**
   * Verify email token on component mount
   */
  useEffect(() => {
    if (!token || !enabled) {
      setVerificationState('error');
      setError('Token de verificação não encontrado');
      return;
    }

    const verifyEmail = async () => {
      try {
        const verificationStartTime = Date.now();

        const response = await fetch('/api/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 410) {
            setVerificationState('expired');
            setError('Token expirado. Solicite um novo email de verificação.');
          } else {
            throw new Error(result.error || 'Falha na verificação');
          }
          return;
        }

        // Success - track email_verified event
        const hashedUserId = hashUserId(result.user_id);
        setUserId(hashedUserId);

        const timeSinceRegistration = result.registration_time
          ? Math.floor((Date.now() - result.registration_time) / 1000)
          : Math.floor((Date.now() - verificationStartTime) / 1000);

        await trackEvent(
          createEmailVerifiedEvent({
            userId: hashedUserId,
            verificationMethod: 'email_link',
            timeSinceRegistrationSeconds: timeSinceRegistration,
          })
        );

        setVerificationState('success');

        // Auto-redirect to profile completion after 2 seconds
        setTimeout(() => {
          router.push(`/profile/minimal?user_id=${result.user_id}`);
        }, 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro na verificação';
        setError(errorMessage);
        setVerificationState('error');
        console.error('Email verification error:', err);
      }
    };

    verifyEmail();
  }, [token, enabled, router]);

  const handleResendEmail = async () => {
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        setError('Email de verificação reenviado!');
      } else {
        throw new Error('Falha ao reenviar email');
      }
    } catch (err) {
      setError('Erro ao reenviar email de verificação');
    }
  };

  // Loading state
  if (loading || verificationState === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Verificando seu email...</h2>
          <p className="text-gray-600">Por favor, aguarde.</p>
        </Card>
      </div>
    );
  }

  // Success state
  if (verificationState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <svg
              className="h-16 w-16 text-green-500 mx-auto"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Email Verificado!</h2>
          <p className="text-gray-600 mb-4">
            Seu email foi verificado com sucesso. Redirecionando para completar seu perfil...
          </p>
          <div className="animate-pulse text-sm text-gray-500">
            Aguarde...
          </div>
        </Card>
      </div>
    );
  }

  // Error or expired state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="p-8 max-w-md w-full text-center">
        <div className="mb-4">
          <svg
            className="h-16 w-16 text-red-500 mx-auto"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-red-600 mb-2">
          {verificationState === 'expired' ? 'Token Expirado' : 'Erro na Verificação'}
        </h2>
        <p className="text-gray-600 mb-6">{error}</p>

        <div className="space-y-3">
          {verificationState === 'expired' && (
            <Button onClick={handleResendEmail} className="w-full">
              Reenviar Email de Verificação
            </Button>
          )}
          <Button
            onClick={() => router.push('/register')}
            variant="outline"
            className="w-full"
          >
            Voltar para Registro
          </Button>
        </div>
      </Card>
    </div>
  );
}
