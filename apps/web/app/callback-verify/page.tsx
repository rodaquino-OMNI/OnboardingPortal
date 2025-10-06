/**
 * Sprint 2C - Email Verification Callback Page
 *
 * ADR-003 Compliant: Server-side verification, client-side orchestration
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CallbackVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid verification link');
      return;
    }

    verifyEmail(token, email);
  }, [searchParams]);

  const verifyEmail = async (token: string, email: string | null) => {
    try {
      // GET /api/callback-verify?token=xxx
      const response = await fetch(`/api/callback-verify?token=${token}`, {
        method: 'GET',
        credentials: 'include', // httpOnly cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        setStatus('error');
        setErrorMessage(errorData.message || 'Verification failed');
        return;
      }

      const result = await response.json();

      // Track analytics: email_verified
      trackAnalyticsEvent({
        event_type: 'email_verified',
        user_id: `hash_${result.userId}`, // Server should return hashed ID
        timestamp: new Date().toISOString(),
        verification_method: 'email_link',
      });

      setStatus('success');

      // Redirect to minimal profile after 2 seconds
      setTimeout(() => {
        router.push('/profile/minimal');
      }, 2000);
    } catch (error) {
      setStatus('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">✕</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick={() => router.push('/register')}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-green-500 text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
        <p className="text-gray-600">Redirecting to complete your profile...</p>
      </div>
    </div>
  );
}

function trackAnalyticsEvent(event: Record<string, unknown>): void {
  console.log('[Analytics]', event);
}
