'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { CheckCircle, Trophy, Star, Award, Target, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRegistration } from '@/hooks/useRegistration';
import { useEffect, useState } from 'react';
import apiService, { GamificationProgress } from '@/services/api';

export default function CompletionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { reset } = useRegistration();
  const [gamificationData, setGamificationData] = useState<GamificationProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchGamificationData = async () => {
      try {
        const response = await apiService.getGamificationProgress();
        if (response.success && response.data) {
          setGamificationData(response.data);
        }
      } catch (error) {
        console.error('Error fetching gamification data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      fetchGamificationData();
    } else {
      setIsLoading(false);
    }
  }, [user]);
  
  const handleGoToDashboard = () => {
    // Clear registration data since process is complete
    reset();
    router.push('/home');
  };
  
  const handleRestartOnboarding = () => {
    reset();
    router.push('/welcome');
  };
  
  const totalPointsEarned = gamificationData?.points || 0;
  const currentLevel = gamificationData?.level || 1;
  const badgesEarned = gamificationData?.badges_earned || 0;
  const progressPercentage = gamificationData?.progress_percentage || 0;
  
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Parabéns, {user?.fullName?.split(' ')[0] || 'Candidato'}!
        </h1>
        <p className="text-lg text-gray-600">
          Você completou todos os passos do processo de onboarding com sucesso!
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              {totalPointsEarned} Pontos Ganhos!
            </h2>
          </div>
          <div className="flex justify-center space-x-1 mb-4">
            {[...Array(Math.min(5, Math.floor(totalPointsEarned / 100)))].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
            ))}
          </div>
          <p className="text-gray-600 text-center">
            Processo concluído com excelência!
          </p>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Nível {currentLevel}
            </h2>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progresso do Nível</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          <p className="text-gray-600 text-center">
            Continue ganhando pontos para subir de nível!
          </p>
        </Card>
      </div>
      
      {badgesEarned > 0 && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-center mb-4">
            <Award className="w-8 h-8 text-purple-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              {badgesEarned} Conquista{badgesEarned > 1 ? 's' : ''} Desbloqueada{badgesEarned > 1 ? 's' : ''}!
            </h2>
          </div>
          <p className="text-gray-600 text-center">
            Você desbloqueou conquistas especiais durante o onboarding!
          </p>
        </Card>
      )}
      
      {!isLoading && gamificationData?.recent_activities && gamificationData.recent_activities.length > 0 && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-green-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">
              Atividades Recentes
            </h3>
          </div>
          <div className="space-y-2">
            {gamificationData.recent_activities.slice(0, 3).map((activity, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{activity.action}</span>
                <span className="text-sm font-medium text-green-600">+{activity.points_earned} pts</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-2">Próximos Passos</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Aguarde a confirmação da sua entrevista por email</li>
          <li>• Verifique seu dashboard para acompanhar o progresso</li>
          <li>• Continue ganhando pontos completando tarefas</li>
        </ul>
      </div>

      <div className="space-y-4">
        <Button
          onClick={handleGoToDashboard}
          size="lg"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Carregando...' : 'Ir para Dashboard'}
        </Button>
        <Button
          variant="outline"
          onClick={handleRestartOnboarding}
          className="w-full"
          disabled={isLoading}
        >
          Refazer Onboarding
        </Button>
      </div>
    </div>
  );
}