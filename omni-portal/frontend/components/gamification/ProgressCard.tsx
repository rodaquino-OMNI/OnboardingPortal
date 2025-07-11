'use client';

import { Card } from '@/components/ui/card';
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
      <Card className={`p-6 animate-pulse ${className}`}>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  if (!progress || !stats) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No progress data available</p>
        </div>
      </Card>
    );
  }

  const currentLevel = stats.current_level;
  const nextLevel = stats.next_level;
  const progressPercentage = nextLevel ? nextLevel.progress_percentage : 100;

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: currentLevel.color }}
            >
              <span className="text-white font-bold text-lg">
                {currentLevel.number}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-lg">{currentLevel.name}</h3>
              <p className="text-sm text-gray-600">
                {stats.total_points.toLocaleString()} points
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>{stats.engagement_score}%</span>
          </Badge>
        </div>

        {/* Progress Bar */}
        {nextLevel && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Progress to {nextLevel.name}
              </span>
              <span className="font-medium">
                {nextLevel.points_remaining.toLocaleString()} points to go
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-3"
              style={{ 
                background: `linear-gradient(to right, ${currentLevel.color}, ${currentLevel.color}20)` 
              }}
            />
            <p className="text-xs text-gray-500 text-center">
              {progressPercentage.toFixed(1)}% complete
            </p>
          </div>
        )}

        {/* Quick Stats */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-2xl font-bold text-orange-500">
                  {stats.streak_days}
                </span>
              </div>
              <p className="text-xs text-gray-600">Day Streak</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-500">
                  {stats.badges_earned}
                </span>
              </div>
              <p className="text-xs text-gray-600">Badges Earned</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Trophy className="w-4 h-4 text-blue-500" />
                <span className="text-2xl font-bold text-blue-500">
                  {stats.tasks_completed}
                </span>
              </div>
              <p className="text-xs text-gray-600">Tasks Done</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-2xl font-bold text-green-500">
                  {currentLevel.number}
                </span>
              </div>
              <p className="text-xs text-gray-600">Level</p>
            </div>
          </div>
        )}

        {/* Next Level Preview */}
        {nextLevel && showDetails && (
          <div className="bg-gray-50 rounded-lg p-3 mt-4">
            <h4 className="font-medium text-sm mb-2">Next Level Rewards:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Level {nextLevel.number}: {nextLevel.name}</p>
              <p>• {nextLevel.points_required.toLocaleString()} points required</p>
              <p>• New features and benefits unlocked</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}