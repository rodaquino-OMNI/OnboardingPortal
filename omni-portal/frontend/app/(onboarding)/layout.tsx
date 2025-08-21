'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Home, ChevronLeft } from 'lucide-react';
import { useOnboardingSession } from '@/hooks/useOnboardingSession';
import { ClientOnly } from '@/components/ClientOnly';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initializeOnboardingSession } = useOnboardingSession();
  
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        {/* Consistent Navigation Header */}
        <ClientOnly fallback={
          <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-4">
                  <Link 
                    href="/home"
                    className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors duration-200"
                    aria-label="Voltar ao início"
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <Home className="w-5 h-5" />
                    </div>
                    <span className="hidden sm:inline font-medium">Início</span>
                  </Link>
                </div>
                <div className="text-sm text-gray-500">
                  Portal de Onboarding
                </div>
              </div>
            </div>
          </header>
        }>
          <OnboardingHeader initializeOnboardingSession={initializeOnboardingSession} />
        </ClientOnly>
        
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Client-only component that uses usePathname
function OnboardingHeader({ initializeOnboardingSession }: { initializeOnboardingSession: (stage: string) => void }) {
  const pathname = usePathname();
  
  // Initialize onboarding session when layout mounts
  useEffect(() => {
    const stage = pathname?.replace('/', '') || 'unknown';
    initializeOnboardingSession(stage);
  }, [pathname, initializeOnboardingSession]);
  
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link 
              href="/home"
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors duration-200"
              aria-label="Voltar ao início"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Home className="w-5 h-5" />
              </div>
              <span className="hidden sm:inline font-medium">Início</span>
            </Link>
            {pathname !== '/home' && (
              <>
                <div className="w-4 h-4 flex items-center justify-center text-gray-400">
                  <ChevronLeft className="w-4 h-4" />
                </div>
                <span className="text-gray-600 font-medium">
                  {pathname?.includes('document-upload') && 'Upload de Documentos'}
                  {pathname?.includes('health-questionnaire') && 'Questionário de Saúde'}
                  {pathname?.includes('interview-schedule') && 'Agendamento de Entrevista'}
                  {pathname?.includes('telemedicine-schedule') && 'Telemedicina'}
                  {pathname?.includes('completion') && 'Conclusão'}
                </span>
              </>
            )}
          </div>
          <div className="text-sm text-gray-500">
            Portal de Onboarding
          </div>
        </div>
      </div>
    </header>
  );
}