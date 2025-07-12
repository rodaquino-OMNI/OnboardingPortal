'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    // Handle OAuth callback
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      // Redirect to login with error
      router.push(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      // Store token
      localStorage.setItem('authToken', token);
      
      // Redirect to dashboard or onboarding
      if (user?.registration_step === 'completed') {
        router.push('/dashboard');
      } else {
        router.push('/welcome');
      }
    } else {
      // No token or error, redirect to login
      router.push('/login');
    }
  }, [router, searchParams, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processando login...</p>
      </div>
    </div>
  );
}