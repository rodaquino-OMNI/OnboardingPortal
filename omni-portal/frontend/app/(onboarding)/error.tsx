'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log error to monitoring service
    console.error('Onboarding Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
      <div className="max-w-md w-full p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Erro no Onboarding
          </h2>
          
          <p className="text-gray-600 mb-6">
            Ocorreu um erro durante o processo de onboarding. 
            Por favor, tente novamente ou retorne à página inicial.
          </p>
          
          <div className="flex flex-col gap-3">
            <Button
              onClick={reset}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
            
            <Button
              variant="outline"
              onClick={() => router.push('/home')}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Ir para Dashboard
            </Button>
          </div>
          
          {error.digest && (
            <p className="text-xs text-gray-400 mt-4">
              ID do erro: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}