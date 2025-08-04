'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { useEffect, useState } from 'react';
import { getDemoOnboardingProgress } from '@/lib/onboarding-demo';
import { 
  Calendar, 
  Lock, 
  Unlock, 
  Star, 
  Trophy, 
  Sparkles,
  CheckCircle,
  AlertCircle
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
  MINIMUM_POINTS: 250,
  PROFILE_POINTS: 50,
  DOCUMENTS_POINTS: 100, // 2 required documents × 50 points each
  HEALTH_POINTS: 100     // Adjusted to match total requirement of 250 points
};

export default function InterviewUnlockCard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { progress, fetchAll } = useGamification();
  
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingProgress();
      fetchAll(); // Load gamification data
    }
  }, [isAuthenticated, fetchAll]);

  const checkOnboardingProgress = async () => {
    try {
      setIsLoading(true);
      
      // Get demo progress for testing
      const demoProgress = getDemoOnboardingProgress();
      
      // Check completion status with fallbacks (combine real + demo data)
      const profileComplete = !!(user?.name && user?.email) || demoProgress.profileComplete;
      const documentsUploaded = !!localStorage.getItem('documents_uploaded') || demoProgress.documentsUploaded;
      const healthQuestionnaireCompleted = !!localStorage.getItem('health_questionnaire_completed') || demoProgress.healthQuestionnaireCompleted;

      // Calculate points based on completion
      let totalPoints = 0;
      const missingSteps: string[] = [];

      if (profileComplete) {
        totalPoints += UNLOCK_REQUIREMENTS.PROFILE_POINTS;
      } else {
        missingSteps.push('Complete seu perfil pessoal');
      }

      if (documentsUploaded) {
        totalPoints += UNLOCK_REQUIREMENTS.DOCUMENTS_POINTS;
      } else {
        missingSteps.push('Envie seus documentos');
      }

      if (healthQuestionnaireCompleted) {
        totalPoints += UNLOCK_REQUIREMENTS.HEALTH_POINTS;
      } else {
        missingSteps.push('Responda o questionário de saúde');
      }

      // Add gamification points if available
      if (progress?.total_points) {
        totalPoints += progress.total_points;
      }
      
      // Add demo points for testing
      if (demoProgress.totalPoints > 0) {
        totalPoints += demoProgress.totalPoints;
      }

      const isUnlocked = totalPoints >= UNLOCK_REQUIREMENTS.MINIMUM_POINTS;
      const pointsNeeded = Math.max(0, UNLOCK_REQUIREMENTS.MINIMUM_POINTS - totalPoints);
      const completionPercentage = Math.min(100, (totalPoints / UNLOCK_REQUIREMENTS.MINIMUM_POINTS) * 100);

      setOnboardingProgress({
        profileComplete,
        documentsUploaded,
        healthQuestionnaireCompleted,
        totalPoints,
        completionPercentage,
        isUnlocked,
        pointsNeeded,
        missingSteps
      });

      // Trigger unlock animation if just unlocked
      if (isUnlocked && !showUnlockAnimation) {
        setShowUnlockAnimation(true);
        setTimeout(() => setShowUnlockAnimation(false), 3000);
      }

    } catch (error) {
      console.error('Error checking onboarding progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockClick = () => {
    if (onboardingProgress?.isUnlocked) {
      router.push('/telemedicine-schedule');
    } else {
      // Navigate to next incomplete step
      if (!onboardingProgress?.profileComplete) {
        router.push('/welcome');
      } else if (!onboardingProgress?.documentsUploaded) {
        router.push('/document-upload');
      } else if (!onboardingProgress?.healthQuestionnaireCompleted) {
        router.push('/health-questionnaire');
      }
    }
  };

  const getActionMessage = () => {
    if (!onboardingProgress) return 'Carregando...';
    
    if (onboardingProgress.isUnlocked) {
      return '🎉 DESBLOQUEADO! Sua consulta premium está disponível';
    }
    
    if (onboardingProgress.pointsNeeded <= 50) {
      return `Faltam apenas ${onboardingProgress.pointsNeeded} pontos para desbloquear!`;
    }
    
    return 'Complete as etapas para ganhar pontos e desbloquear';
  };

  if (isLoading) {
    return (
      <div className="card-modern p-6 h-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-3"></div>
        <span className="text-sm text-gray-600">Verificando progresso...</span>
      </div>
    );
  }

  const isUnlocked = onboardingProgress?.isUnlocked ?? false;
  const completionPercentage = onboardingProgress?.completionPercentage ?? 0;

  return (
    <Card className={`
      relative overflow-hidden transition-all duration-500 cursor-pointer
      ${isUnlocked 
        ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200 shadow-lg hover:shadow-xl' 
        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
      }
      ${showUnlockAnimation ? 'animate-pulse shadow-2xl' : ''}
    `}>
      {/* Unlock Animation Overlay */}
      {showUnlockAnimation && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-ping z-10"></div>
      )}
      
      {/* Sparkle Effects for Unlocked State */}
      {isUnlocked && (
        <>
          <Sparkles className="absolute top-2 right-2 w-4 h-4 text-yellow-400 animate-pulse" />
          <Sparkles className="absolute bottom-2 left-2 w-3 h-3 text-purple-400 animate-pulse delay-1000" />
        </>
      )}

      <div 
        className="p-6 h-full flex flex-col items-center justify-center relative z-20"
        onClick={handleUnlockClick}
      >
        {/* Icon Section */}
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-300
          ${isUnlocked 
            ? 'bg-gradient-to-r from-purple-100 to-blue-100 group-hover:from-purple-200 group-hover:to-blue-200' 
            : 'bg-gray-200'
          }
        `}>
          {isUnlocked ? (
            <div className="relative">
              <Calendar className="w-8 h-8 text-purple-600" />
              <Trophy className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500" />
            </div>
          ) : (
            <div className="relative">
              <Calendar className="w-8 h-8 text-gray-400" />
              <Lock className="absolute -bottom-1 -right-1 w-4 h-4 text-gray-500 bg-white rounded-full p-0.5" />
            </div>
          )}
        </div>

        {/* Title Section */}
        <div className="text-center mb-4">
          <h3 className={`
            font-bold text-lg mb-2
            ${isUnlocked ? 'text-purple-800' : 'text-gray-600'}
          `}>
            {isUnlocked ? 'Consulta Premium' : 'Entrevista Personalizada'}
          </h3>
          
          <p className={`
            text-sm leading-tight
            ${isUnlocked ? 'text-purple-700' : 'text-gray-500'}
          `}>
            {isUnlocked 
              ? 'Consulta exclusiva com concierge de saúde especializado'
              : 'Desbloqueie sua entrevista e consulta personalizada ao acumular pontos'
            }
          </p>
        </div>

        {/* Progress Section */}
        {!isUnlocked && (
          <div className="w-full mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-600">Progresso</span>
              <span className="text-xs font-medium text-gray-700">
                {Math.round(completionPercentage)}%
              </span>
            </div>
            <Progress 
              value={completionPercentage} 
              className="h-2 bg-gray-200"
            />
            <div className="text-center mt-2">
              <span className="text-xs text-gray-600">
                {onboardingProgress?.pointsNeeded} pontos restantes
              </span>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className={`
          text-center text-xs p-3 rounded-lg mb-4 w-full
          ${isUnlocked 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
          }
        `}>
          {getActionMessage()}
        </div>

        {/* Missing Steps (Locked State) */}
        {!isUnlocked && onboardingProgress?.missingSteps && onboardingProgress.missingSteps.length > 0 && (
          <div className="w-full space-y-2 mb-4">
            <span className="text-xs font-medium text-gray-700">Para desbloquear:</span>
            {onboardingProgress.missingSteps.slice(0, 2).map((step, index) => (
              <div key={index} className="flex items-center gap-2 text-xs text-gray-600">
                <AlertCircle className="w-3 h-3 text-yellow-500" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <Button
          className={`
            w-full text-sm font-medium transition-all duration-300
            ${isUnlocked
              ? 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
            }
          `}
          disabled={!isUnlocked && isLoading}
        >
          {isUnlocked ? (
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              <span>Agendar Consulta</span>
              <Star className="w-4 h-4" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Desbloquear ({onboardingProgress?.pointsNeeded || 0} pts)</span>
            </div>
          )}
        </Button>

        {/* Premium Badge for Unlocked */}
        {isUnlocked && (
          <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
            PREMIUM
          </div>
        )}
      </div>
    </Card>
  );
}