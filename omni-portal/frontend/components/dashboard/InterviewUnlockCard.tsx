'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { useEffect, useState, useCallback } from 'react';
import { 
  Calendar, 
  Lock, 
  Unlock, 
  Star, 
  Trophy, 
  Sparkles,
  CheckCircle,
  AlertCircle,
  Gift,
  Crown,
  Target,
  Zap
} from 'lucide-react';

interface OnboardingProgress {
  profileComplete: boolean;
  documentsUploaded: boolean;
  healthQuestionnaireCompleted: boolean;
  totalPoints: number;
  completionPercentage: number;
  isUnlocked: boolean;
  pointsNeeded: number;
  missingSteps: string[];
}

const UNLOCK_REQUIREMENTS = {
  MINIMUM_POINTS: 500,  // Increased to make it more valuable
  PROFILE_POINTS: 50,
  DOCUMENTS_POINTS: 100,
  HEALTH_POINTS: 100
};

export default function InterviewUnlockCard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { progress, stats, fetchAll, isLoadingProgress } = useGamification();
  
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress | null>(null);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [hovering, setHovering] = useState(false);

  const checkOnboardingProgress = useCallback(async () => {
    try {
      // Use ONLY real data - no demo contamination
      const profileComplete = !!(user?.name && user?.email);
      const documentsUploaded = !!localStorage.getItem('documents_uploaded');
      const healthQuestionnaireCompleted = !!localStorage.getItem('health_questionnaire_completed');

      // Calculate points from real gamification system only
      const realPoints = progress?.total_points || 0;
      const isUnlocked = realPoints >= UNLOCK_REQUIREMENTS.MINIMUM_POINTS;
      const pointsNeeded = Math.max(0, UNLOCK_REQUIREMENTS.MINIMUM_POINTS - realPoints);
      const completionPercentage = Math.min(100, (realPoints / UNLOCK_REQUIREMENTS.MINIMUM_POINTS) * 100);

      // Build missing steps with point values
      const missingSteps: string[] = [];
      if (!profileComplete) {
        missingSteps.push('Complete seu perfil (+50 pontos)');
      }
      if (!documentsUploaded) {
        missingSteps.push('Envie seus documentos (+100 pontos)');
      }
      if (!healthQuestionnaireCompleted) {
        missingSteps.push('Complete o questionário de saúde (+100 pontos)');
      }

      setOnboardingProgress({
        profileComplete,
        documentsUploaded,
        healthQuestionnaireCompleted,
        totalPoints: realPoints,
        completionPercentage,
        isUnlocked,
        pointsNeeded,
        missingSteps
      });

      // Trigger unlock animation if newly unlocked
      if (isUnlocked && !showUnlockAnimation) {
        setShowUnlockAnimation(true);
        setTimeout(() => setShowUnlockAnimation(false), 3000);
      }
    } catch (error) {
      console.error('Failed to check onboarding progress:', error);
    }
  }, [user?.name, user?.email, progress?.total_points, showUnlockAnimation]);

  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingProgress();
      fetchAll();
    }
  }, [isAuthenticated, fetchAll, checkOnboardingProgress]);

  const handleUnlockClick = () => {
    if (onboardingProgress?.isUnlocked) {
      router.push('/telemedicine-schedule');
    } else {
      // Show modal or tooltip with requirements
      router.push('/rewards');
    }
  };

  const getMotivationalMessage = () => {
    if (!onboardingProgress) return '';
    
    const percentage = onboardingProgress.completionPercentage;
    
    if (percentage === 0) {
      return 'Comece sua jornada e desbloqueie recompensas exclusivas!';
    } else if (percentage < 25) {
      return 'Ótimo começo! Continue assim para desbloquear benefícios premium.';
    } else if (percentage < 50) {
      return 'Você está no caminho certo! Metade do caminho para sua consulta exclusiva.';
    } else if (percentage < 75) {
      return 'Impressionante! Você está quase lá, continue conquistando pontos!';
    } else if (percentage < 100) {
      return `Incrível! Faltam apenas ${onboardingProgress.pointsNeeded} pontos para desbloquear!`;
    } else {
      return '🎉 Parabéns! Sua consulta premium está disponível!';
    }
  };

  if (isLoadingProgress) {
    return (
      <div className="card-modern p-6 h-full flex flex-col items-center justify-center min-h-[280px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-4"></div>
        <span className="text-sm text-gray-600">Verificando seus pontos...</span>
      </div>
    );
  }

  const isUnlocked = onboardingProgress?.isUnlocked ?? false;
  const completionPercentage = onboardingProgress?.completionPercentage ?? 0;

  return (
    <div 
      className="block group"
      onClick={handleUnlockClick}
    >
      <div className={`
        card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer 
        group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48
        ${!isUnlocked ? 'opacity-75' : ''}
      `}>
        {/* Lock indicator overlay for locked state */}
        {!isUnlocked && (
          <div className="absolute top-2 right-2">
            <Lock className="w-4 h-4 text-gray-400" />
          </div>
        )}
        
        <div className={`
          w-12 h-12 rounded-full flex items-center justify-center mb-3 
          transition-colors duration-300 relative
          ${isUnlocked 
            ? 'bg-purple-100 group-hover:bg-purple-200' 
            : 'bg-gray-100 group-hover:bg-gray-200'
          }
        `}>
          <Calendar className={`
            w-6 h-6
            ${isUnlocked ? 'text-purple-600' : 'text-gray-400'}
          `} />
          {!isUnlocked && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center border border-gray-200">
              <Lock className="w-3 h-3 text-gray-400" />
            </div>
          )}
        </div>
        
        <span className={`
          text-sm font-medium text-center
          ${isUnlocked ? 'text-gray-700' : 'text-gray-500'}
        `}>
          Entrevista
        </span>
        
        <span className="text-xs text-gray-500 mt-1">
          {isUnlocked 
            ? 'Agendar agora'
            : `${onboardingProgress?.pointsNeeded || UNLOCK_REQUIREMENTS.MINIMUM_POINTS} pts necessários`
          }
        </span>
        
        {/* Small progress indicator */}
        {!isUnlocked && onboardingProgress && (
          <div className="w-full mt-2 px-2">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-400 rounded-full transition-all duration-500"
                style={{width: `${completionPercentage}%`}}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}