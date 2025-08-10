'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingProgress();
      fetchAll();
    }
  }, [isAuthenticated, fetchAll]);

  const checkOnboardingProgress = async () => {
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
        missingSteps.push('Questionário de saúde (+100 pontos)');
      }
      if (realPoints < 200) {
        missingSteps.push('Ganhe mais pontos com atividades diárias');
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

      // Trigger unlock animation if just unlocked
      const wasUnlocked = localStorage.getItem('premium_consultation_unlocked');
      if (isUnlocked && !wasUnlocked) {
        setShowUnlockAnimation(true);
        localStorage.setItem('premium_consultation_unlocked', 'true');
        setTimeout(() => setShowUnlockAnimation(false), 4000);
      }

    } catch (error) {
      console.error('Error checking onboarding progress:', error);
    }
  };

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
    <Card 
      className={`
        relative overflow-hidden transition-all duration-500 cursor-pointer
        ${isUnlocked 
          ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 text-white shadow-2xl hover:shadow-3xl transform hover:scale-105' 
          : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:border-purple-300 hover:shadow-lg'
        }
        ${showUnlockAnimation ? 'animate-pulse shadow-purple-500/50' : ''}
      `}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Premium Banner */}
      <div className="absolute top-0 left-0 right-0">
        <div className={`
          text-center py-2 text-xs font-bold tracking-wide
          ${isUnlocked 
            ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900' 
            : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700'
          }
        `}>
          {isUnlocked ? '⭐ PREMIUM DESBLOQUEADO ⭐' : '🔒 RECOMPENSA EXCLUSIVA'}
        </div>
      </div>

      {/* Sparkle Effects */}
      {isUnlocked && (
        <>
          <Sparkles className="absolute top-8 right-4 w-6 h-6 text-yellow-300 animate-pulse" />
          <Star className="absolute bottom-4 left-4 w-5 h-5 text-yellow-200 animate-pulse delay-500" />
          <Crown className="absolute top-12 left-6 w-4 h-4 text-pink-300 animate-bounce delay-1000" />
        </>
      )}

      <div 
        className="p-4 pt-8 flex flex-col items-center justify-center relative z-10"
        onClick={handleUnlockClick}
      >
        {/* Main Icon */}
        <div className={`
          relative mb-3 transition-all duration-300
          ${hovering ? 'transform scale-110' : ''}
        `}>
          <div className={`
            w-16 h-16 rounded-full flex items-center justify-center
            ${isUnlocked 
              ? 'bg-white/20 backdrop-blur-sm border-2 border-white/40' 
              : 'bg-purple-100 border-2 border-purple-200'
            }
          `}>
            {isUnlocked ? (
              <Gift className="w-8 h-8 text-white drop-shadow-lg" />
            ) : (
              <div className="relative">
                <Gift className="w-8 h-8 text-purple-500" />
                <Lock className="absolute -bottom-1 -right-1 w-4 h-4 text-gray-600 bg-white rounded-full p-0.5 shadow-lg" />
              </div>
            )}
          </div>
          
          {/* Points Badge */}
          <Badge className={`
            absolute -top-1 -right-1 px-2 py-0.5 text-xs font-bold
            ${isUnlocked 
              ? 'bg-green-500 text-white border-green-600' 
              : 'bg-purple-500 text-white border-purple-600'
            }
          `}>
            {onboardingProgress?.totalPoints || 0} pts
          </Badge>
        </div>

        {/* Title Only - Minimal */}
        <h3 className={`
          font-bold text-base mb-3
          ${isUnlocked ? 'text-white' : 'text-gray-800'}
        `}>
          Consulta Premium
        </h3>

        {/* Progress Section - Compact */}
        {!isUnlocked && (
          <div className="w-full mb-3">
            <Progress 
              value={completionPercentage} 
              className="h-2 bg-gray-200"
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500">
                {onboardingProgress?.totalPoints || 0}
              </span>
              <span className="text-xs font-medium text-purple-600">
                {UNLOCK_REQUIREMENTS.MINIMUM_POINTS}
              </span>
            </div>
          </div>
        )}

        {/* CTA Button - Clean */}
        <Button
          className={`
            w-full font-semibold transition-all duration-300 text-sm py-2
            ${isUnlocked
              ? 'bg-white text-purple-600 hover:bg-gray-100 shadow-lg'
              : 'bg-purple-500 hover:bg-purple-600 text-white'
            }
          `}
        >
          {isUnlocked ? (
            <>
              <Calendar className="w-4 h-4 mr-1" />
              Agendar
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-1" />
              {onboardingProgress?.pointsNeeded || 0} pts para desbloquear
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}