'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { ProgressCard } from '@/components/gamification/ProgressCard';
import { BadgeDisplay } from '@/components/gamification/BadgeDisplay';
import { Leaderboard } from '@/components/gamification/Leaderboard';
import { AchievementNotification } from '@/components/gamification/AchievementNotification';
import { PendingTasksReminder } from '@/components/onboarding/PendingTasksReminder';
import InterviewUnlockCard from '@/components/dashboard/InterviewUnlockCard';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { demoPresets } from '@/lib/onboarding-demo';
import { 
  User, 
  Calendar, 
  FileText, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Target,
  Activity
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { 
    dashboardSummary, 
    fetchAll 
  } = useGamification();

  useEffect(() => {
    // Fetch all gamification data when dashboard loads
    fetchAll();
  }, []); // Only fetch on mount

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 17) return 'Boa tarde';
    return 'Boa noite';
  };

  const quickStats = dashboardSummary?.quick_stats;
  const recentBadges = Array.isArray(dashboardSummary?.recent_badges) 
    ? dashboardSummary.recent_badges 
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <AchievementNotification />
      <PendingTasksReminder className="mx-4 mt-4" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <h1 className="dashboard-title mb-3 text-2xl sm:text-3xl lg:text-4xl">
            {getGreeting()}, {user?.fullName || 'Usuário'}!
          </h1>
          <p className="text-gray-600 text-base sm:text-lg">
            Bem-vindo ao seu painel de integração. Acompanhe seu progresso e conquistas.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 px-2 sm:px-0">
          {/* Progress Overview */}
          <div className="lg:col-span-2 space-y-6">
            <ProgressCard className="card-modern" />
            
            {/* Quick Actions */}
            <Card className="card-modern p-4 sm:p-6 lg:p-8">
              <h3 className="section-title mb-4 sm:mb-6 text-base sm:text-lg">Ações Rápidas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/profile" className="block group">
                  <div className="card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors duration-300">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Perfil</span>
                  </div>
                </Link>
                <Link href="/document-upload" className="block group">
                  <div className="card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors duration-300">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Documentos</span>
                  </div>
                </Link>
                <InterviewUnlockCard />
                <Link href="/health-questionnaire" className="block group">
                  <div className="card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-red-200 transition-colors duration-300">
                      <CheckCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center leading-tight">Questionário de Saúde</span>
                  </div>
                </Link>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="card-modern p-4 sm:p-6">
              <h3 className="section-title mb-4 sm:mb-5 text-base sm:text-lg">Estatísticas de Hoje</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Pontos Hoje</span>
                  </div>
                  <Badge variant="secondary">
                    +{quickStats?.points_today || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Taxa de Conclusão</span>
                  </div>
                  <Badge variant="secondary">
                    {quickStats?.completion_rate || 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">Ranking da Empresa</span>
                  </div>
                  <Badge variant="secondary">
                    #{quickStats?.rank_in_company || 'N/A'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Recent Achievements */}
            {recentBadges.length > 0 && (
              <Card className="card-modern p-4 sm:p-6">
                <h3 className="section-title mb-4 sm:mb-5 text-base sm:text-lg">Conquistas Recentes</h3>
                <div className="space-y-3">
                  {recentBadges.map((badge: { color?: string; icon?: string; name?: string; earned_at?: string }, index: number) => {
                    if (!badge) return null;
                    return (
                      <div key={index} className="flex items-center space-x-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: badge.color || '#6B7280' }}
                        >
                          <span className="text-white text-sm">{badge.icon || '🏆'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{badge.name || 'Achievement'}</p>
                          <p className="text-xs text-gray-500">
                            {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Next Steps */}
            <Card className="card-modern p-4 sm:p-6">
              <h3 className="section-title mb-4 sm:mb-5 text-base sm:text-lg">Próximos Passos</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Completar Questionário de Saúde</p>
                    <p className="text-xs text-gray-500">Ganhe 100 pontos</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <FileText className="w-3 h-3 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Enviar Documentos Obrigatórios</p>
                    <p className="text-xs text-gray-500">Ganhe 50 pontos cada</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                    <Calendar className="w-3 h-3 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Agendar Entrevista</p>
                    <p className="text-xs text-gray-500">Ganhe 150 pontos</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-2 sm:px-0">
          {/* Badges */}
          <div className="card-modern p-4 sm:p-6">
            <BadgeDisplay maxVisible={6} />
          </div>
          
          {/* Leaderboard */}
          <div className="card-modern p-4 sm:p-6">
            <Leaderboard limit={6} />
          </div>
        </div>
      </div>

      {/* Development Controls - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="card-modern p-4 mt-6 bg-gray-50 border-2 border-dashed border-gray-300">
          <h3 className="text-sm font-medium text-gray-700 mb-3">🎮 Interview Unlock Demo Controls</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { demoPresets.locked(); window.location.reload(); }}
              className="text-xs"
            >
              🔒 Locked
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { demoPresets.partial(); window.location.reload(); }}
              className="text-xs"
            >
              🔶 Partial
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { demoPresets.almostComplete(); window.location.reload(); }}
              className="text-xs"
            >
              🔸 Almost
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { demoPresets.unlocked(); window.location.reload(); }}
              className="text-xs"
            >
              🔓 Unlocked
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { demoPresets.reset(); window.location.reload(); }}
              className="text-xs"
            >
              🔄 Reset
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Click buttons to test different unlock states. Page will refresh to apply changes.
          </p>
        </Card>
      )}
    </div>
  );
}