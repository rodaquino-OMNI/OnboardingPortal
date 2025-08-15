'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useGamification } from '@/hooks/useGamification';
import { useEffect, memo, useMemo } from 'react';
import { Trophy, Star, TrendingUp, Flame } from 'lucide-react';

interface ProgressCardProps {
  className?: string;
  showDetails?: boolean;
}

// CRITICAL FIX: Add React.memo to prevent unnecessary re-renders
const ProgressCard = memo(function ProgressCard({ className, showDetails = true }: ProgressCardProps) {
  const { 
    progress, 
    stats, 
    isLoadingProgress, 
    isLoadingStats, 
    fetchProgress, 
    fetchStats 
  } = useGamification();

  // ARCHITECTURAL FIX: Removed individual fetching to prevent render-phase state updates
  // Data loading is now centralized in parent component (home/page.tsx)
  // This eliminates concurrent Zustand store updates during render phase

  // CRITICAL FIX: Move useMemo BEFORE conditional returns to ensure hooks are always called in the same order
  const calculatedData = useMemo(() => {
    // Safe extraction with null checks and defaults - ensure we get number, not object
    const currentLevel = (
      (typeof stats?.current_level === 'number' ? stats.current_level : (stats?.current_level as any)?.number) ||
      (progress?.current_level as any)?.number ||
      1
    );
    const nextLevel = currentLevel + 1;
    const totalPoints = (
      (typeof stats?.totalPoints === 'number' ? stats.totalPoints : 0) ||
      (typeof progress?.total_points === 'number' ? progress.total_points : 0) ||
      0
    );
    const experienceToNext = (
      (typeof progress?.next_level?.points_remaining === 'number' ? progress.next_level.points_remaining : 0) ||
      (1000 - (totalPoints % 1000))
    );
    const progressPercentage = Math.min(((totalPoints % 1000) / 1000) * 100, 100);
    
    return { currentLevel, nextLevel, totalPoints, experienceToNext, progressPercentage };
  }, [stats, progress]);
  
  const { currentLevel, nextLevel, totalPoints, experienceToNext, progressPercentage } = calculatedData;

  // Conditional returns AFTER all hooks
  if (isLoadingProgress || isLoadingStats) {
    return (
      <div className={`card-modern p-6 ${className || ''}`}>
        <div className="space-y-4">
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4 animate-pulse"></div>
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse"></div>
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!progress || !stats) {
    return (
      <div className={`card-modern p-6 ${className || ''}`}>
        <div className="text-center text-gray-500">
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum dado de progresso disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-modern p-6 ${className || ''}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: currentLevel >= 10 ? '#8B5CF6' : currentLevel >= 5 ? '#3B82F6' : '#10B981' }}
            >
              <span className="text-white font-bold text-lg">
                {currentLevel}
              </span>
            </div>
            <div>
              <h3 className="section-title">Nível {currentLevel}</h3>
              <p className="text-sm text-gray-600">
                {(totalPoints || 0).toLocaleString()} pontos
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>{Math.min(Math.floor((totalPoints / 100) * 10), 100)}%</span>
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Progresso para Nível {nextLevel}
            </span>
            <span className="font-medium">
              Faltam {(experienceToNext || 0).toLocaleString()} pontos
            </span>
          </div>
          <Progress 
            value={Math.max(0, Math.min(progressPercentage || 0, 100))} 
            className="h-3"
          />
          <p className="text-xs text-gray-500 text-center">
            {(progressPercentage || 0).toFixed(1)}% completo
          </p>
        </div>

        {/* Quick Stats */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-2xl font-bold text-orange-500">
                  {(typeof stats?.currentStreak === 'number' ? stats.currentStreak : 0) ||
                   (typeof progress?.streak_days === 'number' ? progress.streak_days : 0) ||
                   0}
                </span>
              </div>
              <p className="text-xs text-gray-600">Dias Consecutivos</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-500">
                  {(typeof stats?.achievementsUnlocked === 'number' ? stats.achievementsUnlocked : 0) || 0}
                </span>
              </div>
              <p className="text-xs text-gray-600">Conquistas Obtidas</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Trophy className="w-4 h-4 text-blue-500" />
                <span className="text-2xl font-bold text-blue-500">
                  {Math.floor((totalPoints || 0) / 100)}
                </span>
              </div>
              <p className="text-xs text-gray-600">Tarefas Concluídas</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-2xl font-bold text-green-500">
                  {typeof currentLevel === 'number' ? currentLevel : 1}
                </span>
              </div>
              <p className="text-xs text-gray-600">Nível</p>
            </div>
          </div>
        )}

        {/* Next Level Preview */}
        {showDetails && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-sm mb-2">Recompensas do Próximo Nível:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Conquista Nível {nextLevel} Desbloqueada</p>
              <p>• {((currentLevel || 1) * 1000).toLocaleString()} pontos necessários</p>
              <p>• Novos recursos e benefícios desbloqueados</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export { ProgressCard };