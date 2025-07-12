'use client';

import { Trophy } from 'lucide-react';
import { useGamification } from '@/hooks/useGamification';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { progress } = useGamification();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header with Points Counter */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="text-lg font-semibold text-gray-800">
              Portal de Onboarding
            </div>
            <div className="flex items-center gap-2" data-testid="points-display">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold text-yellow-600" data-testid="points-counter">
                {progress?.points || 0} pontos
              </span>
            </div>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}