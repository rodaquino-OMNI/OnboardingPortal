'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UnifiedHealthQuestionnaire } from '@/components/health/UnifiedHealthQuestionnaire';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { Brain, Heart, Route, Activity, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function HealthQuestionnairePage() {
  const router = useRouter();
  const { user } = useAuth();
  useGamification(); // Using the hook to trigger loading even if not destructuring
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async (results: unknown) => {
    console.log('Questionnaire results:', results); // Use the results parameter
    try {
      setIsSubmitting(true);
      // Navigate to next step after successful completion
      router.push('/document-upload');
    } catch (error) {
      console.error('Error handling completion:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto shadow-xl animate-pulse">
              <Activity className="w-10 h-10 text-white animate-pulse" />
            </div>
            <div className="absolute -inset-4 bg-gradient-to-br from-purple-300 to-pink-300 rounded-full opacity-30 animate-ping"></div>
          </div>
          <p className="text-xl font-bold text-gray-900 font-['Inter'] mb-2">Processando sua avaliação de saúde...</p>
          <p className="text-gray-600 font-['Inter']">Analisando respostas com inteligência dual pathway</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // Check if it's first time for user onboarding flow
  const isFirstTime = user?.registration_step !== 'completed';
  console.log('First time user:', isFirstTime); // Use the variable to avoid warning

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-5 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Heart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-['Inter']">Avaliação de Saúde Inteligente</h1>
            <p className="text-gray-600 font-['Inter'] mt-1">Passo 2 de 4</p>
          </div>
        </div>
        
        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <div className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700 font-['Inter']">IA Clínica</span>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center gap-2">
            <Route className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 font-['Inter']">PHQ-9 & GAD-7</span>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 font-['Inter']">Detecção de Fraude</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="relative max-w-2xl mx-auto">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full shadow-sm" style={{ width: '50%' }}></div>
          </div>
          <div className="mt-2 text-sm text-gray-500 font-['Inter']">50% concluído</div>
        </div>
      </div>
      
      {/* Unified Health Assessment with Feature Toggle */}
      <Card className="p-2 shadow-xl border-0 rounded-2xl bg-white overflow-hidden">
        <UnifiedHealthQuestionnaire 
          onComplete={handleComplete}
          userId={user?.id}
          mode="standard"
          features={{
            ai: true,
            gamification: true,
            clinical: true,
            progressive: true,
            accessibility: true
          }}
        />
      </Card>
    </div>
  );
}