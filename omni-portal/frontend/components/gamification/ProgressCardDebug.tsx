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

  // Debug logging
  console.log('[ProgressCard] Render state:', {
    stats,
    isLoadingStats,
    progress,
    isLoadingProgress
  });

  useEffect(() => {
    console.log('[ProgressCard] Effect triggered');
    try {
      if (!progress) {
        console.log('[ProgressCard] Fetching progress...');
        fetchProgress().catch(err => console.error('[ProgressCard] Progress fetch error:', err));
      }
      if (!stats) {
        console.log('[ProgressCard] Fetching stats...');
        fetchStats().catch(err => console.error('[ProgressCard] Stats fetch error:', err));
      }
    } catch (error) {
      console.error('[ProgressCard] Error in effect:', error);
    }
  }, [progress, stats, fetchProgress, fetchStats]);

  if (isLoadingProgress || isLoadingStats) {
    console.log('[ProgressCard] Showing loading state');
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
    console.log('[ProgressCard] No data available', { progress, stats });
    return (
      <div className={`card-modern p-6 ${className || ''}`}>
        <div className="text-center text-gray-500">
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No progress data available</p>
        </div>
      </div>
    );
  }

  // Safe value extraction with detailed logging - ULTRA THINKING OBJECT SAFETY
  console.log('[ProgressCard] Extracting values from stats:', stats);
  
  const currentLevel = (() => {
    // CRITICAL FIX: Extract number from potential object {number, name, color, icon}
    const level = (
      (typeof stats?.current_level === 'number' ? stats.current_level : stats?.current_level?.number) ||
      (typeof stats?.level === 'number' ? stats.level : stats?.level?.number) ||
      1
    );
    console.log('[ProgressCard] currentLevel (safe):', level, 'type:', typeof level);
    return level;
  })();
  
  const nextLevel = currentLevel + 1;
  
  const totalPoints = (() => {
    // TECHNICAL EXCELLENCE: Ensure points is always a number
    const points = (
      (typeof stats?.totalPoints === 'number' ? stats.totalPoints : 0) ||
      0
    );
    console.log('[ProgressCard] totalPoints (safe):', points, 'type:', typeof points);
    return points;
  })();
  
  const experienceToNext = (() => {
    // ULTRA THINKING: Safe calculation with type checking
    const exp = (
      (typeof stats?.experienceToNext === 'number' ? stats.experienceToNext : 0) ||
      (1000 - (totalPoints % 1000))
    );
    console.log('[ProgressCard] experienceToNext (safe):', exp);
    return exp;
  })();
  
  const progressPercentage = (() => {
    const percentage = Math.min(((totalPoints % 1000) / 1000) * 100, 100);
    console.log('[ProgressCard] progressPercentage:', percentage);
    return percentage;
  })();

  // Check for NaN or Infinity
  if (isNaN(currentLevel) || !isFinite(currentLevel)) {
    console.error('[ProgressCard] Invalid currentLevel:', currentLevel);
    return <div>Error: Invalid level data</div>;
  }
  if (isNaN(totalPoints) || !isFinite(totalPoints)) {
    console.error('[ProgressCard] Invalid totalPoints:', totalPoints);
    return <div>Error: Invalid points data</div>;
  }
  if (isNaN(experienceToNext) || !isFinite(experienceToNext)) {
    console.error('[ProgressCard] Invalid experienceToNext:', experienceToNext);
    return <div>Error: Invalid experience data</div>;
  }
  if (isNaN(progressPercentage) || !isFinite(progressPercentage)) {
    console.error('[ProgressCard] Invalid progressPercentage:', progressPercentage);
    return <div>Error: Invalid progress data</div>;
  }

  console.log('[ProgressCard] Rendering with values:', {
    currentLevel,
    nextLevel,
    totalPoints,
    experienceToNext,
    progressPercentage
  });

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
                {String(typeof currentLevel === 'number' ? currentLevel : 1)}
              </span>
            </div>
            <div>
              <h3 className="section-title">Level {typeof currentLevel === 'number' ? currentLevel : 1}</h3>
              <p className="text-sm text-gray-600">
                {String((totalPoints || 0).toLocaleString())} points
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>{String(Math.min(Math.floor((totalPoints / 100) * 10), 100))}%</span>
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Progress to Level {nextLevel}
            </span>
            <span className="font-medium">
              {String((experienceToNext || 0).toLocaleString())} points to go
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-3"
          />
          <p className="text-xs text-gray-500 text-center">
            {String((progressPercentage || 0).toFixed(1))}% complete
          </p>
        </div>

        {/* Quick Stats */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-2xl font-bold text-orange-500">
                  {String(stats.currentStreak || 0)}
                </span>
              </div>
              <p className="text-xs text-gray-600">Day Streak</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-500">
                  {String(stats.achievementsUnlocked || 0)}
                </span>
              </div>
              <p className="text-xs text-gray-600">Badges Earned</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Trophy className="w-4 h-4 text-blue-500" />
                <span className="text-2xl font-bold text-blue-500">
                  {String(Math.floor(totalPoints / 100))}
                </span>
              </div>
              <p className="text-xs text-gray-600">Tasks Done</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-2xl font-bold text-green-500">
                  {String(currentLevel)}
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
              <p>• Level {nextLevel} Badge Unlocked</p>
              <p>• {String(((typeof currentLevel === 'number' ? currentLevel : 1) * 1000).toLocaleString())} points required</p>
              <p>• New features and benefits unlocked</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}