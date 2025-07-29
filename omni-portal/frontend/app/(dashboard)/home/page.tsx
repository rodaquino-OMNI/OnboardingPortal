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
import Link from 'next/link';
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
  }, [fetchAll]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 17) return 'Boa tarde';
    return 'Boa noite';
  };

  const quickStats = dashboardSummary?.quick_stats;
  const recentBadges = dashboardSummary?.recent_badges || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <AchievementNotification />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <h1 className="dashboard-title mb-3">
            {getGreeting()}, {user?.fullName || 'User'}!
          </h1>
          <p className="text-gray-600 text-lg">
            Bem-vindo ao seu painel de integração. Acompanhe seu progresso e conquistas.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Progress Overview */}
          <div className="lg:col-span-2 space-y-6">
            <ProgressCard className="card-modern" />
            
            {/* Quick Actions */}
            <Card className="card-modern p-8">
              <h3 className="section-title mb-6">Ações Rápidas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/profile" className="block">
                  <div className="action-button border border-gray-200 rounded-lg p-6 h-full flex flex-col items-center justify-center cursor-pointer group">
                    <div className="action-button-icon bg-blue-50 group-hover:bg-blue-100">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Perfil</span>
                  </div>
                </Link>
                <Link href="/document-upload" className="block">
                  <div className="action-button border border-gray-200 rounded-lg p-6 h-full flex flex-col items-center justify-center cursor-pointer group">
                    <div className="action-button-icon bg-green-50 group-hover:bg-green-100">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Documentos</span>
                  </div>
                </Link>
                <Link href="/interview-schedule" className="block">
                  <div className="action-button border border-gray-200 rounded-lg p-6 h-full flex flex-col items-center justify-center cursor-pointer group">
                    <div className="action-button-icon bg-purple-50 group-hover:bg-purple-100">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Entrevista</span>
                  </div>
                </Link>
                <Link href="/health-questionnaire" className="block">
                  <div className="action-button border border-gray-200 rounded-lg p-6 h-full flex flex-col items-center justify-center cursor-pointer group">
                    <div className="action-button-icon bg-red-50 group-hover:bg-red-100">
                      <CheckCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center leading-tight max-w-[80px]">Questionário de Saúde</span>
                  </div>
                </Link>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="card-modern p-6">
              <h3 className="section-title mb-5">Estatísticas de Hoje</h3>
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
              <Card className="card-modern p-6">
                <h3 className="section-title mb-5">Conquistas Recentes</h3>
                <div className="space-y-3">
                  {recentBadges.map((badge: { color: string; icon: string; name: string; earned_at: string }, index: number) => (
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
            <Card className="card-modern p-6">
              <h3 className="section-title mb-5">Próximos Passos</h3>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Badges */}
          <div className="card-modern p-6">
            <BadgeDisplay maxVisible={8} />
          </div>
          
          {/* Leaderboard */}
          <div className="card-modern p-6">
            <Leaderboard limit={8} />
          </div>
        </div>
      </div>
    </div>
  );
}