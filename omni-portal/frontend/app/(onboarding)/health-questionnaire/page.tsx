'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UnifiedHealthQuestionnaire } from '@/components/health/UnifiedHealthQuestionnaire';
import { HealthNavigationHeader, SessionRestorationBanner } from '@/components/health/HealthNavigationHeader';
import { HealthAssessmentComplete } from '@/components/health/HealthAssessmentComplete';
import { useHealthSessionPersistence } from '@/hooks/useHealthSessionPersistence';
import '@/styles/health-questionnaire-mobile.css';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { HealthAssessmentResults } from '@/lib/unified-health-flow';
import { Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function HealthQuestionnairePage() {
  const router = useRouter();
  const { user } = useAuth();
  useGamification(); // Using the hook to trigger loading even if not destructuring
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionnaireProgress, setQuestionnaireProgress] = useState(0);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(15); // Default 15 minutes
  const [isCompleted, setIsCompleted] = useState(false);
  const [healthResults, setHealthResults] = useState<HealthAssessmentResults | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState(new Date());

  // Session persistence
  const {
    session,
    isLoading: isLoadingSession,
    updateResponse,
    updateProgress,
    saveSession,
    clearSession,
    hasExistingSession,
    getSessionStats
  } = useHealthSessionPersistence({
    userId: user?.id || `guest-${Date.now()}`,
    autoSaveInterval: 10000, // Auto-save every 10 seconds
    onAutoSave: (success) => {
      if (!success) {
        console.warn('Auto-save failed');
      }
    },
    onRestoreSession: (restoredSession) => {
      setQuestionnaireProgress(restoredSession.progress);
      setEstimatedTimeRemaining(restoredSession.metadata.estimatedTimeRemaining || 15);
    }
  });

  // Initialize session start time and check for existing session
  useEffect(() => {
    setSessionStartTime(new Date());
    
    const checkExistingSession = async () => {
      if (user?.id) {
        const hasSession = await hasExistingSession();
        setShowRestoreBanner(hasSession && !session);
      }
    };
    
    checkExistingSession();
  }, [user?.id, hasExistingSession, session]);

  // Update estimated time based on progress
  useEffect(() => {
    if (questionnaireProgress > 0) {
      const stats = getSessionStats();
      if (stats?.sessionDuration && questionnaireProgress > 10) {
        // Calculate estimated time based on current pace
        const timePerPercent = stats.sessionDuration / questionnaireProgress;
        const remainingTime = Math.ceil(timePerPercent * (100 - questionnaireProgress));
        setEstimatedTimeRemaining(Math.max(1, remainingTime));
      }
    }
  }, [questionnaireProgress, getSessionStats]);

  const handleComplete = async (results: unknown) => {
    console.log('Questionnaire results:', results);
    try {
      setIsSubmitting(true);
      
      // Cast results to HealthAssessmentResults type
      const healthAssessmentResults = results as HealthAssessmentResults;
      
      // Store results and show completion screen
      setHealthResults(healthAssessmentResults);
      setIsCompleted(true);
      
      // Clear the saved session as questionnaire is complete
      await clearSession();
      
    } catch (error) {
      console.error('Error handling completion:', error);
      // Still show completion screen even if there's an error
      setIsCompleted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNavigateHome = () => {
    router.push('/home');
  };

  const handleNavigateNext = () => {
    router.push('/document-upload');
  };

  const handleProgressUpdate = (progress: number) => {
    setQuestionnaireProgress(progress);
    // Update session with current progress
    if (session) {
      updateProgress(
        session.currentSectionIndex,
        session.currentQuestionIndex,
        progress,
        estimatedTimeRemaining
      );
    }
  };

  const handleSaveAndExit = async (): Promise<boolean> => {
    try {
      return await saveSession();
    } catch (error) {
      console.error('Failed to save session:', error);
      return false;
    }
  };

  const handleRestoreSession = () => {
    setShowRestoreBanner(false);
    // Session will be automatically restored by the hook
  };

  const handleStartNewSession = async () => {
    await clearSession();
    setShowRestoreBanner(false);
    setQuestionnaireProgress(0);
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

  // Show completion screen if questionnaire is finished
  if (isCompleted && healthResults) {
    return (
      <HealthAssessmentComplete
        healthResults={healthResults}
        userName={user?.name || 'Usuário'}
        userAge={user?.age || 25}
        sessionStartTime={sessionStartTime}
        onNavigateHome={handleNavigateHome}
        onNavigateNext={handleNavigateNext}
      />
    );
  }

  // Check if it's first time for user onboarding flow
  const isFirstTime = user?.registration_step !== 'completed';
  console.log('First time user:', isFirstTime); // Use the variable to avoid warning

  // Show loading state for session
  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando questionário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
      {/* Navigation Header with Dashboard Button and Auto-Save */}
      <HealthNavigationHeader
        progress={questionnaireProgress}
        onSave={handleSaveAndExit}
        title="Avaliação de Saúde Inteligente"
        subtitle="Passo 2 de 4 - Informações de saúde mental e bem-estar"
        estimatedTimeRemaining={estimatedTimeRemaining}
        showHomeButton={true}
        showSaveButton={true}
      />

      {/* Session Restoration Banner */}
      {showRestoreBanner && session && (
        <SessionRestorationBanner
          lastSavedAt={session.lastSavedAt}
          progress={session.progress}
          onRestore={handleRestoreSession}
          onStartNew={handleStartNewSession}
        />
      )}

      
      {/* Unified Health Assessment with Feature Toggle */}
      <Card className="health-questionnaire p-2 shadow-xl border-0 rounded-2xl bg-white/95 backdrop-blur-sm overflow-hidden card-modern">
        <UnifiedHealthQuestionnaire 
          onComplete={handleComplete}
          onProgressUpdate={handleProgressUpdate}
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
      </div>
    </div>
  );
}