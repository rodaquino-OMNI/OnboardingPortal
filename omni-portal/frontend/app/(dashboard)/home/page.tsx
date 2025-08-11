'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { GAMIFICATION_POINTS } from '@/lib/constants/gamification';
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
  Activity,
  Check
} from 'lucide-react';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { 
    dashboardSummary, 
    fetchAll,
    progress
  } = useGamification();
  
  // Track if we've already fetched to prevent duplicate calls
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch gamification data if authenticated and haven't fetched yet
    // This prevents 401 errors from triggering redirects and duplicate fetches
    if (isAuthenticated && !hasFetchedRef.current) {
      console.log('[DashboardPage] Fetching gamification data - user is authenticated');
      hasFetchedRef.current = true;
      
      // Debounce the fetch to prevent rapid re-fetches
      const timer = setTimeout(() => {
        fetchAll();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isAuthenticated) {
      console.log('[DashboardPage] Skipping gamification fetch - user not authenticated yet');
      hasFetchedRef.current = false; // Reset if user logs out
    }
  }, [isAuthenticated, fetchAll]); // Properly include fetchAll in dependencies

  // State for onboarding progress to avoid hydration issues
  const [onboardingStatus, setOnboardingStatus] = useState({
    currentStep: 1,
    completedSteps: 0,
    totalSteps: 6,
    progressPercentage: 0,
    healthCompleted: false,
    documentsUploaded: false
  });

  // Calculate onboarding progress safely on client-side only
  useEffect(() => {
    const calculateOnboardingStep = () => {
      let currentStep = 1;
      let completedSteps = 0;
      
      // Check profile completion (Step 1)
      if (user?.name && user?.email) {
        completedSteps++;
        currentStep = 2;
      }
      
      // Check health questionnaire (Step 2) - Safe client-side check
      const healthCompleted = typeof window !== 'undefined' 
        ? localStorage.getItem('health_questionnaire_completed') === 'true'
        : false;
      if (healthCompleted) {
        completedSteps++;
        currentStep = 3;
      }
      
      // Check documents (Step 3) - Safe client-side check
      const documentsUploaded = typeof window !== 'undefined'
        ? localStorage.getItem('documents_uploaded') === 'true'
        : false;
      if (documentsUploaded) {
        completedSteps++;
        currentStep = 4;
      }
      
      // Check if interview is unlocked (Step 4)
      const totalPoints = progress?.total_points || 0;
      if (totalPoints >= 500) {
        completedSteps++;
        currentStep = 5;
      }
      
      // Check rewards accessed (Step 5)
      if (completedSteps >= 4) {
        currentStep = 6;
      }
      
      return {
        currentStep,
        completedSteps,
        totalSteps: 6,
        progressPercentage: (completedSteps / 6) * 100,
        healthCompleted,
        documentsUploaded
      };
    };

    setOnboardingStatus(calculateOnboardingStep());
  }, [user, progress]); // Update when user or progress changes

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
            
            {/* Quick Actions - Onboarding Journey Steps */}
            <Card className="card-modern p-4 sm:p-6 lg:p-8">
              <h3 className="section-title mb-4 sm:mb-6 text-base sm:text-lg">Jornada de Integração</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Step 1: Profile */}
                <Link href="/profile" className="block group relative">
                  <div className={`absolute -top-2 -left-2 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-md ${
                    user?.name && user?.email ? 'bg-green-600' : 'bg-blue-600'
                  }`}>
                    {user?.name && user?.email ? <Check className="w-5 h-5" /> : '1'}
                  </div>
                  <div className={`card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48 ${
                    user?.name && user?.email ? '' : ''
                  }`}>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors duration-300">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Perfil</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {user?.name && user?.email ? 'Completo' : 'Complete seu perfil'}
                    </span>
                  </div>
                </Link>
                
                {/* Step 2: Health Questionnaire */}
                <Link href="/health-questionnaire" className="block group relative">
                  <div className={`absolute -top-2 -left-2 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-md ${
                    onboardingStatus.healthCompleted ? 'bg-green-600' : 'bg-red-600'
                  }`}>
                    {onboardingStatus.healthCompleted ? <Check className="w-5 h-5" /> : '2'}
                  </div>
                  <div className="card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-red-200 transition-colors duration-300">
                      <CheckCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center leading-tight">Questionário de Saúde</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {onboardingStatus.healthCompleted ? 'Completo' : 'Avaliação médica'}
                    </span>
                  </div>
                </Link>
                
                {/* Step 3: Documents */}
                <Link href="/document-upload" className="block group relative">
                  <div className={`absolute -top-2 -left-2 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-md ${
                    onboardingStatus.documentsUploaded ? 'bg-green-600' : 'bg-green-600'
                  }`}>
                    {onboardingStatus.documentsUploaded ? <Check className="w-5 h-5" /> : '3'}
                  </div>
                  <div className="card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors duration-300">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Documentos</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {onboardingStatus.documentsUploaded ? 'Enviados' : 'Envie seus documentos'}
                    </span>
                  </div>
                </Link>
                
                {/* Step 4: Interview (Unlockable) */}
                <div className="relative">
                  <div className={`absolute -top-2 -left-2 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-md ${
                    (progress?.total_points || 0) >= 500 ? 'bg-green-600' : 'bg-purple-600'
                  }`}>
                    {(progress?.total_points || 0) >= 500 ? <Check className="w-5 h-5" /> : '4'}
                  </div>
                  <InterviewUnlockCard />
                </div>
                
                {/* Step 5: Rewards (Available after completion) */}
                <Link href="/rewards" className="block group relative">
                  <div className={`absolute -top-2 -left-2 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-md ${
                    onboardingStatus.completedSteps >= 4 ? 'bg-green-600' : 'bg-yellow-600'
                  }`}>
                    {onboardingStatus.completedSteps >= 4 ? <Check className="w-5 h-5" /> : '5'}
                  </div>
                  <div className={`card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48 ${
                    onboardingStatus.completedSteps < 4 ? 'opacity-75' : ''
                  }`}>
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-yellow-200 transition-colors duration-300">
                      <Target className="w-6 h-6 text-yellow-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Recompensas</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {onboardingStatus.completedSteps >= 4 ? 'Disponível' : 'Resgate benefícios'}
                    </span>
                  </div>
                </Link>
                
                {/* Step 6: Telemedicine Consultation (Final reward) */}
                <Link href="/telemedicine-schedule" className="block group relative">
                  <div className={`absolute -top-2 -left-2 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-md ${
                    onboardingStatus.completedSteps >= 5 ? 'bg-green-600' : 'bg-indigo-600'
                  }`}>
                    {onboardingStatus.completedSteps >= 5 ? <Check className="w-5 h-5" /> : '6'}
                  </div>
                  <div className={`card-modern p-6 h-full flex flex-col items-center justify-center cursor-pointer group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 touch-target-48 ${
                    (progress?.total_points || 0) < 500 ? 'opacity-75' : ''
                  }`}>
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-indigo-200 transition-colors duration-300">
                      <Calendar className="w-6 h-6 text-indigo-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Consulta Premium</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {(progress?.total_points || 0) >= 500 ? 'Disponível' : 'Alcance 500 pontos'}
                    </span>
                  </div>
                </Link>
              </div>
              
              {/* Progress Indicator */}
              <div className="mt-6 px-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">Progresso da Jornada</span>
                  <span className="text-xs font-medium text-gray-800">
                    Passo {onboardingStatus.currentStep} de {onboardingStatus.totalSteps}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500" 
                    style={{width: `${onboardingStatus.progressPercentage}%`}}
                  ></div>
                </div>
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
                    <p className="text-xs text-gray-500">Ganhe {GAMIFICATION_POINTS.HEALTH_QUESTIONNAIRE} pontos</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <FileText className="w-3 h-3 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Enviar Documentos Obrigatórios</p>
                    <p className="text-xs text-gray-500">Ganhe {GAMIFICATION_POINTS.DOCUMENT_UPLOAD} pontos cada</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                    <Calendar className="w-3 h-3 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Agendar Entrevista</p>
                    <p className="text-xs text-gray-500">Ganhe {GAMIFICATION_POINTS.INTERVIEW_SCHEDULE} pontos</p>
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

      {/* Development Controls - Only show in development with explicit debug flag */}
      {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEBUG_CONTROLS === 'true' && (
        <Card className="card-modern p-4 mt-6 mb-4 mx-4 bg-yellow-50 border-2 border-dashed border-yellow-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">🎮 Development Controls</h3>
            <Badge variant="outline" className="text-xs bg-yellow-100">DEBUG MODE</Badge>
          </div>
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
            ⚠️ Debug controls enabled. Set NEXT_PUBLIC_ENABLE_DEBUG_CONTROLS=false to hide.
          </p>
        </Card>
      )}
    </div>
  );
}