'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { CheckCircle, Trophy, Star, Award, Target, TrendingUp, Video, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRegistration } from '@/hooks/useRegistration';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import apiService, { GamificationProgress } from '@/services/api';

export default function CompletionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { reset } = useRegistration();
  const searchParams = useSearchParams();
  const isTelemedicineCompletion = searchParams.get('telemedicine') === 'true';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
      <div className="mb-8 animate-fade-in">
        <div className={`w-20 h-20 ${isTelemedicineCompletion ? 'bg-purple-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg`}>
          {isTelemedicineCompletion ? (
            <Video className="w-12 h-12 text-purple-600" />
          ) : (
            <CheckCircle className="w-12 h-12 text-green-600" />
          )}
        </div>
        <h1 className="dashboard-title mb-4 text-2xl sm:text-3xl">
          {isTelemedicineCompletion ? '🎉 Consulta Agendada!' : 'Parabéns,'} {user?.fullName?.split(' ')[0] || 'Candidato'}!
        </h1>
        <p className="text-base sm:text-lg text-gray-600">
          {isTelemedicineCompletion 
            ? 'Sua consulta de telemedicina foi agendada com sucesso! Você desbloqueou uma recompensa especial.'
            : 'Você completou todos os passos do processo de onboarding com sucesso!'
          }
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="card-modern p-6">
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
        
        <Card className="card-modern p-6">
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
        <Card className="card-modern p-6 mb-8">
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
        <Card className="card-modern p-6 mb-8">
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

      {isTelemedicineCompletion && (
        <Card className="card-modern p-6 mb-8 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-purple-900">Detalhes da Consulta</h3>
          </div>
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Tipo:</span>
                <div className="text-gray-600">Consulta com Concierge de Saúde</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Modalidade:</span>
                <div className="text-gray-600">Telemedicina (Vídeo)</div>
              </div>
            </div>
          </div>
          <p className="text-purple-800 text-sm">
            📧 Você receberá um email com os detalhes completos da consulta e instruções para se preparar.
          </p>
        </Card>
      )}

      <div className={`card-modern ${isTelemedicineCompletion ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'} p-6 mb-8`}>
        <h3 className={`font-semibold ${isTelemedicineCompletion ? 'text-purple-900' : 'text-blue-900'} mb-2`}>Próximos Passos</h3>
        <ul className={`text-sm ${isTelemedicineCompletion ? 'text-purple-800' : 'text-blue-800'} space-y-1`}>
          {isTelemedicineCompletion ? (
            <>
              <li>• Complete o checklist de preparação técnica</li>
              <li>• Teste sua câmera e microfone antes da consulta</li>
              <li>• Tenha seus documentos de saúde em mãos</li>
              <li>• Entre na sala virtual 10 minutos antes do horário</li>
            </>
          ) : (
            <>
              <li>• Acesse sua área exclusiva de telemedicina</li>
              <li>• Verifique seu dashboard para acompanhar o progresso</li>
              <li>• Continue ganhando pontos completando tarefas</li>
            </>
          )}
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
    </div>
  );
}