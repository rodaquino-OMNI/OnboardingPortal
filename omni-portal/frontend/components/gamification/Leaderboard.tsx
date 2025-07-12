'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGamification } from '@/hooks/useGamification';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Trophy, Crown, Medal, Star, TrendingUp } from 'lucide-react';

interface LeaderboardProps {
  className?: string;
  limit?: number;
  showCurrentUser?: boolean;
}

export function Leaderboard({ 
  className, 
  limit = 10 
}: LeaderboardProps) {
  const { 
    leaderboard, 
    isLoadingLeaderboard, 
    fetchLeaderboard 
  } = useGamification();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeaderboard(limit);
  }, [limit, fetchLeaderboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboard(limit);
    setRefreshing(false);
  };

  if (isLoadingLeaderboard) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                <div className="h-2 bg-gray-200 rounded w-1/4"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-gray-400" />;
      case 3: return <Trophy className="w-5 h-5 text-orange-500" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">#{rank}</span>;
    }
  };

  const getRankBackground = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200';
      case 2: return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200';
      case 3: return 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200';
      default: return 'bg-white border-gray-200';
    }
  };

  const getLevelBadgeColor = (level: number) => {
    if (level >= 10) return 'bg-purple-100 text-purple-800';
    if (level >= 5) return 'bg-blue-100 text-blue-800';
    if (level >= 3) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-lg">Leaderboard</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Leaderboard List */}
        <div className="space-y-3">
          {leaderboard.map((entry, index) => {
            const rank = index + 1;
            
            return (
              <div
                key={`${entry.beneficiary_id}-${index}`}
                className={`
                  flex items-center space-x-4 p-4 rounded-lg border transition-all
                  ${getRankBackground(rank)}
                  hover:shadow-md
                `}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {getRankIcon(rank)}
                </div>

                {/* Avatar */}
                <div className="flex-shrink-0">
                  {entry.avatar ? (
                    <Image
                      src={entry.avatar}
                      alt={entry.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {entry.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-sm truncate">{entry.name}</h4>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getLevelBadgeColor(entry.current_level)}`}
                    >
                      L{entry.current_level}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-gray-600">
                    <span>{entry.level_name}</span>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <span>{entry.badges_count}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span>{entry.engagement_score}%</span>
                    </div>
                  </div>
                </div>

                {/* Points */}
                <div className="flex-shrink-0 text-right" data-testid="points-display">
                  <div className="font-bold text-lg" data-testid="points-counter">
                    {entry.total_points.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {leaderboard.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No leaderboard data available</p>
            <p className="text-sm mt-1">
              Complete your onboarding to join the leaderboard!
            </p>
          </div>
        )}

        {/* Footer */}
        {leaderboard.length > 0 && (
          <div className="pt-4 border-t text-center">
            <p className="text-xs text-gray-500">
              Updated in real-time • Company leaderboard
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}