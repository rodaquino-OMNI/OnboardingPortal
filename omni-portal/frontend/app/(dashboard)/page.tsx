'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { ProgressCard } from '@/components/gamification/ProgressCard';
import { BadgeDisplay } from '@/components/gamification/BadgeDisplay';
import { Leaderboard } from '@/components/gamification/Leaderboard';
import { AchievementNotification } from '@/components/gamification/AchievementNotification';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Calendar, 
  FileText, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Target,
  Activity,
  Award
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { 
    dashboardSummary, 
    fetchDashboardSummary, 
    fetchAll,
    isLoadingDashboard 
  } = useGamification();

  useEffect(() => {
    // Fetch all gamification data when dashboard loads
    fetchAll();
  }, [fetchAll]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const quickStats = dashboardSummary?.quick_stats;
  const recentBadges = dashboardSummary?.recent_badges || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AchievementNotification />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getGreeting()}, {user?.profile?.firstName || 'User'}!
          </h1>
          <p className="text-gray-600">
            Welcome to your onboarding dashboard. Track your progress and achievements.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Progress Overview */}
          <div className="lg:col-span-2">
            <ProgressCard className="mb-6" />
            
            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
                  <User className="w-6 h-6" />
                  <span className="text-sm">Profile</span>
                </Button>
                <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
                  <FileText className="w-6 h-6" />
                  <span className="text-sm">Documents</span>
                </Button>
                <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
                  <Calendar className="w-6 h-6" />
                  <span className="text-sm">Interview</span>
                </Button>
                <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
                  <CheckCircle className="w-6 h-6" />
                  <span className="text-sm">Health Form</span>
                </Button>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Today's Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Points Today</span>
                  </div>
                  <Badge variant="secondary">
                    +{quickStats?.points_today || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Completion Rate</span>
                  </div>
                  <Badge variant="secondary">
                    {quickStats?.completion_rate || 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">Company Rank</span>
                  </div>
                  <Badge variant="secondary">
                    #{quickStats?.rank_in_company || 'N/A'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Recent Achievements */}
            {recentBadges.length > 0 && (
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Recent Achievements</h3>
                <div className="space-y-3">
                  {recentBadges.map((badge, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: badge.color }}
                      >
                        <span className="text-white text-sm">{badge.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{badge.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(badge.earned_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Next Steps */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Next Steps</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Complete Health Questionnaire</p>
                    <p className="text-xs text-gray-500">Earn 100 points</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <FileText className="w-3 h-3 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Upload Required Documents</p>
                    <p className="text-xs text-gray-500">Earn 50 points each</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                    <Calendar className="w-3 h-3 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Schedule Interview</p>
                    <p className="text-xs text-gray-500">Earn 150 points</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Badges */}
          <BadgeDisplay maxVisible={8} />
          
          {/* Leaderboard */}
          <Leaderboard limit={8} />
        </div>
      </div>
    </div>
  );
}