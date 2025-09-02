'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGamification } from '@/hooks/useGamification';
import { useEffect, useState } from 'react';
import { Trophy, Star, Crown, Diamond } from 'lucide-react';
import type { GamificationBadge } from '@/types';

interface BadgeDisplayProps {
  className?: string;
  maxVisible?: number;
  showAvailable?: boolean;
}

export function BadgeDisplay({ 
  className, 
  maxVisible = 6, 
  showAvailable = true 
}: BadgeDisplayProps) {
  const { 
    badges, 
    isLoadingBadges, 
    fetchBadges 
  } = useGamification();
  const [activeTab, setActiveTab] = useState<'earned' | 'available'>('earned');

  useEffect(() => {
    if (!badges?.earned?.length && !badges?.available?.length) {
      fetchBadges();
    }
  }, [badges, fetchBadges]);

  if (isLoadingBadges) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const getRarityIcon = (rarity: GamificationBadge['rarity']) => {
    switch (rarity) {
      case 'common': return <Trophy className="w-4 h-4" />;
      case 'rare': return <Star className="w-4 h-4" />;
      case 'epic': return <Crown className="w-4 h-4" />;
      case 'legendary': return <Diamond className="w-4 h-4" />;
      default: return <Trophy className="w-4 h-4" />;
    }
  };

  const getRarityColor = (rarity: GamificationBadge['rarity']) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-600 border-gray-300';
      case 'rare': return 'bg-blue-100 text-blue-600 border-blue-300';
      case 'epic': return 'bg-purple-100 text-purple-600 border-purple-300';
      case 'legendary': return 'bg-yellow-100 text-yellow-600 border-yellow-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const displayBadges = activeTab === 'earned' ? (badges?.earned || []) : (badges?.available || []);
  const visibleBadges = displayBadges.slice(0, maxVisible);

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Conquistas</h3>
          <Badge variant="secondary">
            {badges?.earned?.length || 0} conquistadas
          </Badge>
        </div>

        {/* Tabs */}
        {showAvailable && (
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('earned')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'earned'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Conquistadas ({badges?.earned?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'available'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Disponíveis ({badges?.available?.length || 0})
            </button>
          </div>
        )}

        {/* Badges Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="badges-earned">
          {visibleBadges.map((badge) => (
            <div
              key={badge.id}
              className={`
                relative p-4 rounded-lg border-2 transition-all hover:shadow-md
                ${getRarityColor(badge.rarity)}
                ${activeTab === 'available' ? 'opacity-60' : ''}
              `}
            >
              {/* Badge Icon */}
              <div className="text-center mb-2">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2"
                  style={{ backgroundColor: '#4F46E5' }}
                >
                  <span className="text-white text-lg">
                    {badge.icon || '🏆'}
                  </span>
                </div>
                <div className="flex items-center justify-center space-x-1 mb-1">
                  {getRarityIcon(badge.rarity)}
                  <span className="text-xs font-medium capitalize">
                    {badge.rarity}
                  </span>
                </div>
              </div>

              {/* Badge Info */}
              <div className="text-center">
                <h4 className="font-medium text-sm mb-1">{badge.name}</h4>
                <p className="text-xs opacity-75 mb-2">{badge.description}</p>
                
                {badge.pointsRequired > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {badge.pointsRequired} pontos
                  </Badge>
                )}
              </div>

              {/* Earned Date */}
              {badge.earned_at && (
                <div className="absolute top-2 right-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
              )}

              {/* Criteria for available badges - removed as criteria not in interface */}
            </div>
          ))}
        </div>

        {/* Show More Button */}
        {displayBadges.length > maxVisible && (
          <div className="text-center">
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Mostrar mais {displayBadges.length - maxVisible}
            </button>
          </div>
        )}

        {/* Empty State */}
        {displayBadges.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>
              {activeTab === 'earned' 
                ? 'Nenhuma conquista ainda' 
                : 'Nenhuma conquista disponível'
              }
            </p>
            <p className="text-sm mt-1">
              {activeTab === 'earned' 
                ? 'Complete tarefas e marcos para ganhar sua primeira conquista!'
                : 'Volte mais tarde para novos desafios!'
              }
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}