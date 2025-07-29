'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useGamification } from '@/hooks/useGamification';
import { useEffect } from 'react';
import { Trophy, Star, TrendingUp, Flame } from 'lucide-react';

interface ProgressCardProps {
  className?: string;
  showDetails?: boolean;
}

export function ProgressCard({ className, showDetails = true }: ProgressCardProps) {
  const { 
    progress, 
    stats, 
    isLoadingProgress, 
    isLoadingStats, 
    fetchProgress, 
    fetchStats 
  } = useGamification();

  useEffect(() => {
    if (!progress) fetchProgress();
    if (!stats) fetchStats();
  }, [progress, stats, fetchProgress, fetchStats]);

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
          <p>No progress data available</p>
        </div>
      </div>
    );
  }

  const currentLevel = stats.current_level || stats.level;
  const nextLevel = currentLevel + 1;
  const progressPercentage = Math.min((stats.totalPoints % 1000) / 10, 100); // Mock calculation

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
              <h3 className="section-title">Level {currentLevel}</h3>
              <p className="text-sm text-gray-600">
                {stats.totalPoints.toLocaleString()} points
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>{Math.min(Math.floor((stats.totalPoints / 100) * 10), 100)}%</span>
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Progress to Level {nextLevel}
            </span>
            <span className="font-medium">
              {stats.experienceToNext.toLocaleString()} points to go
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-3"
          />
          <p className="text-xs text-gray-500 text-center">
            {progressPercentage.toFixed(1)}% complete
          </p>
        </div>

        {/* Quick Stats */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-2xl font-bold text-orange-500">
                  {stats.currentStreak}
                </span>
              </div>
              <p className="text-xs text-gray-600">Day Streak</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-500">
                  {stats.achievementsUnlocked}
                </span>
              </div>
              <p className="text-xs text-gray-600">Badges Earned</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Trophy className="w-4 h-4 text-blue-500" />
                <span className="text-2xl font-bold text-blue-500">
                  {Math.floor(stats.totalPoints / 100)}
                </span>
              </div>
              <p className="text-xs text-gray-600">Tasks Done</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-2xl font-bold text-green-500">
                  {currentLevel}
                </span>
              </div>
              <p className="text-xs text-gray-600">Level</p>
            </div>
          </div>
        )}

        {/* Next Level Preview */}
        {showDetails && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-sm mb-2">Next Level Rewards:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Level {nextLevel}: Level {nextLevel}</p>
              <p>• {(currentLevel * 1000).toLocaleString()} points required</p>
              <p>• New features and benefits unlocked</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}