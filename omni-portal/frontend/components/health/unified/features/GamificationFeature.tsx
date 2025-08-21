'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Star, Award, Target, Zap, TrendingUp, Medal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuestionnaire, QuestionnaireFeature, FeatureHooks } from '../BaseHealthQuestionnaire';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary, useErrorHandler } from '../../ErrorBoundary';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  points: number;
  unlocked: boolean;
  unlockedAt?: Date;
}

interface GamificationState {
  points: number;
  level: number;
  streak: number;
  achievements: Achievement[];
  completionBonus: number;
  perfectAnswers: number;
}

interface GamificationConfig {
  enabled: boolean;
  showPoints: boolean;
  showAchievements: boolean;
  showStreak: boolean;
  animations: boolean;
  motivationalMessages: boolean;
}

function GamificationFeatureInner({ config }: { config?: GamificationConfig }) {
  const { state, calculateProgress } = useQuestionnaire();
  const [gamificationState, setGamificationState] = useState<GamificationState>({
    points: 0,
    level: 1,
    streak: 0,
    achievements: initializeAchievements(),
    completionBonus: 0,
    perfectAnswers: 0
  });
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);
  const { captureError } = useErrorHandler();

  const progress = calculateProgress();
  const showAnimations = config?.animations !== false;

  // Check and unlock achievements - moved before useEffect
  const checkAchievements = useCallback((responseCount: number, points: number) => {
    try {
      const achievements = [...gamificationState.achievements];
      let newUnlock: Achievement | null = null;

      // First Response Achievement
      if (responseCount >= 1 && achievements[0] && !achievements[0].unlocked) {
        achievements[0].unlocked = true;
        achievements[0].unlockedAt = new Date();
        newUnlock = achievements[0];
      }

      // Quick Starter (5 responses total, regardless of section) - Fixed logic
      if (responseCount >= 5 && achievements[1] && !achievements[1].unlocked) {
        achievements[1].unlocked = true;
        achievements[1].unlockedAt = new Date();
        newUnlock = achievements[1];
      }

      // Half Way There
      if (progress >= 50 && achievements[2] && !achievements[2].unlocked) {
        achievements[2].unlocked = true;
        achievements[2].unlockedAt = new Date();
        newUnlock = achievements[2];
      }

    // Level Up
    if (gamificationState.level >= 3 && achievements[3] && !achievements[3].unlocked) {
      achievements[3].unlocked = true;
      achievements[3].unlockedAt = new Date();
      newUnlock = achievements[3];
    }

      setGamificationState(prev => ({ ...prev, achievements }));

      // Show achievement notification
      if (newUnlock && showAnimations) {
        setShowAchievement(newUnlock);
        setTimeout(() => setShowAchievement(null), 3000);
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
      captureError(error as Error);
    }
  }, [gamificationState.achievements, gamificationState.level, progress, showAnimations, captureError]);

  // Award points for responses
  useEffect(() => {
    const responseCount = Object.keys(state.responses).length;
    const basePoints = responseCount * 10;
    const streakBonus = gamificationState.streak * 5;
    const totalPoints = basePoints + streakBonus;

    setGamificationState(prev => ({
      ...prev,
      points: totalPoints,
      level: Math.floor(totalPoints / 100) + 1,
      streak: responseCount // Simplified streak calculation
    }));

    // Check for achievements
    checkAchievements(responseCount, totalPoints);
  }, [state.responses, checkAchievements, gamificationState.streak]);

  // Calculate XP for next level
  const currentLevelXP = (gamificationState.level - 1) * 100;
  const nextLevelXP = gamificationState.level * 100;
  const levelProgress = ((gamificationState.points - currentLevelXP) / 100) * 100;

  return (
    <div className="gamification-container space-y-4">
      {/* Main Stats Card */}
      {(config?.showPoints !== false || config?.showStreak !== false) && (
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50">
          <div className="grid grid-cols-3 gap-4">
            {config?.showPoints !== false && (
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {gamificationState.points}
                </div>
                <div className="text-xs text-gray-600">Pontos</div>
              </div>
            )}
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Trophy className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {gamificationState.level}
              </div>
              <div className="text-xs text-gray-600">Nível</div>
            </div>
            
            {config?.showStreak !== false && (
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {gamificationState.streak}
                </div>
                <div className="text-xs text-gray-600">Sequência</div>
              </div>
            )}
          </div>

          {/* Level Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Nível {gamificationState.level}</span>
              <span>{Math.round(levelProgress)}%</span>
              <span>Nível {gamificationState.level + 1}</span>
            </div>
            <Progress value={levelProgress} className="h-2" />
          </div>
        </Card>
      )}

      {/* Achievements Section */}
      {config?.showAchievements !== false && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Conquistas ({gamificationState.achievements.filter(a => a.unlocked).length}/{gamificationState.achievements.length})
          </h3>
          
          <div className="grid grid-cols-4 gap-2">
            {gamificationState.achievements.slice(0, 4).map((achievement) => (
              <div
                key={achievement.id}
                className={`relative p-3 rounded-lg border-2 transition-all ${
                  achievement.unlocked
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={achievement.unlocked ? 'text-purple-600' : 'text-gray-400'}>
                    {achievement.icon}
                  </div>
                  <span className="text-xs mt-1">{achievement.name}</span>
                </div>
                {achievement.unlocked && (
                  <div className="absolute -top-1 -right-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivational Messages */}
      {config?.motivationalMessages !== false && progress > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <p className="text-sm text-blue-800">
            {getMotivationalMessage(progress, gamificationState.level)}
          </p>
        </div>
      )}

      {/* Achievement Notification */}
      <AnimatePresence>
        {showAchievement && showAnimations && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          >
            <Card className="p-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-xl">
              <div className="flex items-center gap-3">
                <div className="text-white">{showAchievement.icon}</div>
                <div>
                  <div className="font-bold">Conquista Desbloqueada!</div>
                  <div className="text-sm opacity-90">{showAchievement.name}</div>
                  <div className="text-xs opacity-75">+{showAchievement.points} pontos</div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Initialize achievements
function initializeAchievements(): Achievement[] {
  return [
    {
      id: 'first-response',
      name: 'Primeiro Passo',
      description: 'Responda sua primeira pergunta',
      icon: <Star className="w-6 h-6" />,
      points: 10,
      unlocked: false
    },
    {
      id: 'quick-starter',
      name: 'Início Rápido',
      description: 'Complete 5 perguntas rapidamente',
      icon: <Zap className="w-6 h-6" />,
      points: 25,
      unlocked: false
    },
    {
      id: 'halfway',
      name: 'Meio Caminho',
      description: 'Complete 50% do questionário',
      icon: <Target className="w-6 h-6" />,
      points: 50,
      unlocked: false
    },
    {
      id: 'level-3',
      name: 'Subindo de Nível',
      description: 'Alcance o nível 3',
      icon: <Medal className="w-6 h-6" />,
      points: 75,
      unlocked: false
    }
  ];
}

// Get motivational message based on progress
function getMotivationalMessage(progress: number, level: number): string {
  if (progress < 25) {
    return 'Ótimo começo! Continue assim! 💪';
  } else if (progress < 50) {
    return 'Você está indo muito bem! Já passou de 1/4! 🌟';
  } else if (progress < 75) {
    return 'Incrível! Mais da metade concluída! 🎯';
  } else if (progress < 100) {
    return 'Quase lá! Você está arrasando! 🚀';
  } else {
    return `Parabéns! Questionário completo no nível ${level}! 🎉`;
  }
}

// Feature hooks for Gamification
export const gamificationHooks: FeatureHooks = {
  onInit: (state) => {
    // Initialize gamification state from localStorage if available
    const saved = localStorage.getItem('questionnaire-gamification');
    if (saved) {
      // Restore previous state
    }
  },
  
  onResponseSubmit: (questionId, value, state) => {
    // Award bonus points for quick responses
    return null;
  },
  
  onSectionComplete: (sectionId, state) => {
    // Award section completion bonus
    console.log(`[Gamification] Section ${sectionId} completed!`);
  },
  
  onComplete: (state) => {
    // Award completion bonus and final achievements
    console.log('[Gamification] Questionnaire completed!');
  }
};

// Main component with error boundary wrapper
export function GamificationFeature(props: { config?: GamificationConfig }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Gamification Feature error:', error, errorInfo);
        // Could send to error tracking service here
      }}
      resetKeys={[JSON.stringify(props.config || {})]}
      fallback={
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <Trophy className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
          <p className="text-sm text-yellow-700">
            Sistema de gamificação temporariamente indisponível
          </p>
        </div>
      }
    >
      <GamificationFeatureInner {...props} />
    </ErrorBoundary>
  );
}

// Export feature definition
export const GamificationFeatureDefinition: QuestionnaireFeature = {
  id: 'gamification',
  name: 'Gamification System',
  enabled: true,
  priority: 80,
  component: GamificationFeature,
  hooks: gamificationHooks,
  config: {
    enabled: true,
    showPoints: true,
    showAchievements: true,
    showStreak: true,
    animations: true,
    motivationalMessages: true
  }
};