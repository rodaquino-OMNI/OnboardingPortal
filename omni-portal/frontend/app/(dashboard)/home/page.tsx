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
    <div className="min-h-screen bg-gray-50">
      <AchievementNotification />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getGreeting()}, {user?.fullName || 'User'}!
          </h1>
          <p className="text-gray-600">
            Bem-vindo ao seu painel de integração. Acompanhe seu progresso e conquistas.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Progress Overview */}
          <div className="lg:col-span-2">
            <ProgressCard className="mb-6" />
            
            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Ações Rápidas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/profile">
                  <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
                    <User className="w-6 h-6" />
                    <span className="text-sm">Perfil</span>
                  </Button>
                </Link>
                <Link href="/document-upload">
                  <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
                    <FileText className="w-6 h-6" />
                    <span className="text-sm">Documentos</span>
                  </Button>
                </Link>
                <Link href="/interview-schedule">
                  <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
                    <Calendar className="w-6 h-6" />
                    <span className="text-sm">Entrevista</span>
                  </Button>
                </Link>
                <Link href="/health-questionnaire">
                  <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
                    <CheckCircle className="w-6 h-6" />
                    <span className="text-sm">Questionário de Saúde</span>
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Estatísticas de Hoje</h3>
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
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Conquistas Recentes</h3>
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
              <h3 className="font-semibold text-lg mb-4">Próximos Passos</h3>
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
          <BadgeDisplay maxVisible={8} />
          
          {/* Leaderboard */}
          <Leaderboard limit={8} />
        </div>
      </div>
    </div>
  );
}