'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGamification } from '@/hooks/useGamification';
import { Trophy, Star, X, Sparkles, TrendingUp } from 'lucide-react';
import type { GamificationBadge } from '@/types';

interface AchievementNotificationProps {
  className?: string;
  autoHide?: boolean;
  hideDelay?: number;
}

interface NotificationData {
  id: string;
  type: 'badge' | 'level_up' | 'points' | 'streak';
  title: string;
  description: string;
  icon?: string;
  color?: string;
  points?: number;
  badge?: GamificationBadge;
  level?: number;
  timestamp: Date;
}

export function AchievementNotification({ 
  className, 
  autoHide = true, 
  hideDelay = 5000 
}: AchievementNotificationProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const { badgesData, stats } = useGamification();

  const hideNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notifications.length <= 1) {
      setIsVisible(false);
    }
  }, [notifications.length]);

  const showNotification = useCallback((notification: NotificationData) => {
    setNotifications(prev => {
      // Prevent duplicates
      const exists = prev.some(n => n.id === notification.id);
      if (exists) return prev;
      
      return [...prev, notification];
    });
    setIsVisible(true);

    if (autoHide) {
      setTimeout(() => {
        hideNotification(notification.id);
      }, hideDelay);
    }
  }, [autoHide, hideDelay, hideNotification]);

  // Mock function to simulate achievement notifications
  // In real implementation, this would come from WebSocket or polling
  useEffect(() => {
    const checkForNewAchievements = () => {
      // Simulate new badge earned
      const newBadgeEarned = badgesData?.earned?.find(badge => 
        badge.earned_at && 
        new Date(badge.earned_at) > new Date(Date.now() - 10000)
      );

      if (newBadgeEarned) {
        showNotification({
          id: `badge-${newBadgeEarned.id}`,
          type: 'badge',
          title: 'Nova Conquista Desbloqueada!',
          description: `Você conquistou o emblema "${newBadgeEarned.name}"!`,
          icon: newBadgeEarned.icon,
          color: '#4F46E5', // Default color since icon_color doesn't exist in type
          points: newBadgeEarned.pointsRequired,
          badge: newBadgeEarned,
          timestamp: new Date()
        });
      }

      // Check for level up
      if (stats?.current_level && stats.current_level > 1) {
        const lastLevelUp = localStorage.getItem('lastLevelUp');
        const currentLevel = stats.current_level;
        
        if (!lastLevelUp || parseInt(lastLevelUp) < currentLevel) {
          showNotification({
            id: `level-${currentLevel}`,
            type: 'level_up',
            title: 'Subiu de Nível!',
            description: `Você alcançou o nível ${currentLevel}!`,
            icon: '🎉', // Default level up icon since current_level is just a number
            color: '#10B981', // Default level up color
            level: currentLevel,
            timestamp: new Date()
          });
          localStorage.setItem('lastLevelUp', currentLevel.toString());
        }
      }

      // Check for streak milestones
      if (stats?.currentStreak && stats.currentStreak > 0 && stats.currentStreak % 7 === 0) {
        const lastStreakNotification = localStorage.getItem('lastStreakNotification');
        const currentStreak = stats.currentStreak;
        
        if (!lastStreakNotification || parseInt(lastStreakNotification) < currentStreak) {
          showNotification({
            id: `streak-${currentStreak}`,
            type: 'streak',
            title: 'Marco de Sequência!',
            description: `${currentStreak} dias consecutivos! Continue assim!`,
            icon: '🔥',
            color: '#FF6B35',
            timestamp: new Date()
          });
          localStorage.setItem('lastStreakNotification', currentStreak.toString());
        }
      }
    };

    // Check for achievements every 30 seconds
    const interval = setInterval(checkForNewAchievements, 30000);
    
    // Check immediately on mount
    checkForNewAchievements();

    return () => clearInterval(interval);
  }, [badgesData, stats, showNotification, hideNotification]);

  const getIcon = (notification: NotificationData) => {
    switch (notification.type) {
      case 'badge':
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 'level_up':
        return <TrendingUp className="w-6 h-6 text-green-500" />;
      case 'streak':
        return <Sparkles className="w-6 h-6 text-orange-500" />;
      case 'points':
        return <Star className="w-6 h-6 text-blue-500" />;
      default:
        return <Trophy className="w-6 h-6 text-gray-500" />;
    }
  };

  const getBackgroundColor = (notification: NotificationData) => {
    switch (notification.type) {
      case 'badge':
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200';
      case 'level_up':
        return 'bg-gradient-to-r from-green-50 to-green-100 border-green-200';
      case 'streak':
        return 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200';
      case 'points':
        return 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {notifications.map((notification) => (
        <Card 
          key={notification.id}
          className={`
            p-4 shadow-lg border-2 animate-in slide-in-from-right duration-300
            ${getBackgroundColor(notification)}
          `}
        >
          <div className="flex items-start space-x-3">
            {/* Icon */}
            <div className="flex-shrink-0">
              {notification.icon && notification.color ? (
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: notification.color }}
                >
                  <span className="text-white text-lg">
                    {notification.icon}
                  </span>
                </div>
              ) : (
                getIcon(notification)
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-semibold text-sm">{notification.title}</h4>
                {notification.points && (
                  <Badge variant="secondary" className="text-xs">
                    +{notification.points} pontos
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">{notification.description}</p>
              
              {/* Badge details */}
              {notification.badge && (
                <div className="mt-2 flex items-center space-x-2">
                  <Badge 
                    variant="outline" 
                    className="text-xs capitalize"
                  >
                    {notification.badge.rarity}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {notification.badge.category}
                  </span>
                </div>
              )}
              
              {/* Level details */}
              {notification.level && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    Nível {notification.level}
                  </Badge>
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => hideNotification(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Hook for programmatically showing achievements
export function useAchievementNotification() {
  const showAchievement = (data: Partial<NotificationData>) => {
    // This would typically dispatch to a global notification system
    const event = new CustomEvent('achievement-notification', {
      detail: {
        id: data.id || Date.now().toString(),
        type: data.type || 'badge',
        title: data.title || 'Conquista Desbloqueada!',
        description: data.description || 'Você conquistou uma nova conquista!',
        ...data,
        timestamp: new Date()
      }
    });
    window.dispatchEvent(event);
  };

  return { showAchievement };
}