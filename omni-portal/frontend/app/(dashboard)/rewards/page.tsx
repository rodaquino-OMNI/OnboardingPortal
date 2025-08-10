'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { useRewards } from '@/hooks/useRewards';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import Link from 'next/link';
import { GAMIFICATION_POINTS, POINT_DESCRIPTIONS } from '@/lib/constants/gamification';
import { 
  Trophy, 
  Gift, 
  Lock, 
  Star, 
  Crown,
  Target,
  Zap,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  User,
  Heart,
  FileText,
  Calendar,
  Award,
  Sparkles,
  Loader2
} from 'lucide-react';

// Icon mapping for reward icons
const ICON_MAP: { [key: string]: any } = {
  'award': Award,
  'clock': Clock,
  'users': Users,
  'heart': Heart,
  'crown': Crown,
  'star': Star,
  'gift': Gift,
  'trophy': Trophy,
  'user': User,
  'file-text': FileText,
  'calendar': Calendar,
  'target': Target,
  'zap': Zap,
};

const POINT_ACTIONS = [
  { action: POINT_DESCRIPTIONS.PROFILE_COMPLETE, points: GAMIFICATION_POINTS.PROFILE_COMPLETE, icon: User, done: false },
  { action: POINT_DESCRIPTIONS.DOCUMENTS_COMPLETE, points: GAMIFICATION_POINTS.DOCUMENTS_COMPLETE, icon: FileText, done: false },
  { action: POINT_DESCRIPTIONS.HEALTH_QUESTIONNAIRE, points: GAMIFICATION_POINTS.HEALTH_QUESTIONNAIRE, icon: Heart, done: false },
  { action: POINT_DESCRIPTIONS.INTERVIEW_SCHEDULE, points: GAMIFICATION_POINTS.INTERVIEW_SCHEDULE, icon: Calendar, done: false },
  { action: POINT_DESCRIPTIONS.DAILY_LOGIN_STREAK_7, points: GAMIFICATION_POINTS.DAILY_LOGIN_STREAK_7, icon: Clock, done: false },
  { action: POINT_DESCRIPTIONS.ONBOARDING_COMPLETE, points: GAMIFICATION_POINTS.ONBOARDING_COMPLETE, icon: Trophy, done: false }
];

export default function RewardsPage() {
  const { user } = useAuth();
  const { progress, fetchAll } = useGamification();
  const { 
    rewards, 
    userPoints, 
    isLoadingRewards, 
    isClaimingReward,
    error,
    fetchRewards, 
    claimReward,
    clearError 
  } = useRewards();
  const [actions, setActions] = useState(POINT_ACTIONS);

  useEffect(() => {
    fetchAll();
    fetchRewards();
  }, [fetchAll, fetchRewards]);

  useEffect(() => {
    if (progress) {
      // Update actions completion status based on actual progress
      const updatedActions = POINT_ACTIONS.map(action => {
        if (action.action.includes('perfil') && progress.profile_completed) {
          return { ...action, done: true };
        }
        if (action.action.includes('documentos') && progress.documents_uploaded > 0) {
          return { ...action, done: true };
        }
        if (action.action.includes('saúde') && progress.health_assessments_completed > 0) {
          return { ...action, done: true };
        }
        if (action.action.includes('entrevista') && progress.tasks_completed > 0) {
          return { ...action, done: true };
        }
        if (action.action.includes('onboarding') && progress.onboarding_completed) {
          return { ...action, done: true };
        }
        return action;
      });
      setActions(updatedActions);
    }
  }, [progress]);

  const handleClaimReward = async (rewardId: number) => {
    try {
      clearError();
      const response = await claimReward(rewardId);
      
      if (response.success) {
        toast.success(response.message || 'Recompensa resgatada com sucesso!', {
          description: response.data.bonus_points > 0 
            ? `Você ganhou ${response.data.bonus_points} pontos extras!` 
            : undefined
        });
      }
    } catch (error: any) {
      toast.error('Erro ao resgatar recompensa', {
        description: error.message || 'Tente novamente mais tarde.'
      });
    }
  };

  // Use actual user points from API, fallback to gamification progress
  const currentPoints = userPoints || progress?.total_points || 0;
  const premiumReward = rewards?.find(r => r.is_premium);
  const premiumProgress = premiumReward ? (currentPoints / premiumReward.points_required) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Central de Recompensas
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Ganhe pontos completando atividades e desbloqueie recompensas exclusivas. 
            Quanto mais você participa, maiores são os benefícios!
          </p>
        </div>

        {/* Current Points Card */}
        <Card className="mb-8 p-6 bg-gradient-to-r from-purple-500 to-pink-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Seus Pontos</h2>
              <p className="text-5xl font-bold">{currentPoints}</p>
              <p className="text-white/80 mt-2">Continue conquistando!</p>
            </div>
            <Trophy className="w-24 h-24 text-white/20" />
          </div>
        </Card>

        {/* Loading State */}
        {isLoadingRewards && (
          <Card className="mb-8 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600">Carregando suas recompensas...</p>
          </Card>
        )}

        {/* Error State */}
        {error && !isLoadingRewards && (
          <Card className="mb-8 p-6 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700">
              <span>⚠️</span>
              <p>Erro ao carregar recompensas: {error}</p>
            </div>
            <Button 
              onClick={() => fetchRewards()} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
              Tentar Novamente
            </Button>
          </Card>
        )}

        {/* Premium Reward Highlight */}
        {premiumReward && !isLoadingRewards && (
          <Card className="mb-8 p-8 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
                {ICON_MAP[premiumReward.icon] ? 
                  React.createElement(ICON_MAP[premiumReward.icon], { className: "w-8 h-8 text-white" }) :
                  <Crown className="w-8 h-8 text-white" />
                }
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Recompensa Premium</h2>
                <p className="text-gray-600">O maior benefício do programa</p>
              </div>
              <Badge className="ml-auto bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2">
                EXCLUSIVO
              </Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">{premiumReward.name}</h3>
                <p className="text-gray-600 mb-4">{premiumReward.description}</p>
                
                <div className="space-y-2">
                  {premiumReward.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-700">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Progresso para desbloquear</span>
                    <span className="text-sm font-bold text-purple-600">
                      {Math.round(premiumProgress)}%
                    </span>
                  </div>
                  <Progress value={premiumProgress} className="h-4" />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">{currentPoints} pontos</span>
                    <span className="text-xs font-medium text-purple-600">
                      Meta: {premiumReward.points_required} pontos
                    </span>
                  </div>
                </div>

                {premiumReward.is_unlocked ? (
                  premiumReward.can_claim ? (
                    <Button 
                      onClick={() => handleClaimReward(premiumReward.id)}
                      disabled={isClaimingReward}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                    >
                      {isClaimingReward ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Resgatando...
                        </>
                      ) : (
                        <>
                          <Gift className="w-4 h-4 mr-2" />
                          Resgatar Recompensa
                        </>
                      )}
                    </Button>
                  ) : premiumReward.user_status === 'claimed' ? (
                    <Link href="/telemedicine-schedule">
                      <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                        <Calendar className="w-4 h-4 mr-2" />
                        Agendar Consulta Premium
                      </Button>
                    </Link>
                  ) : (
                    <Badge className="w-full justify-center py-2 bg-green-100 text-green-700">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Já Resgatado
                    </Badge>
                  )
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-3">
                      Faltam {premiumReward.points_required - currentPoints} pontos
                    </p>
                    <Link href="#como-ganhar">
                      <Button variant="outline" className="w-full">
                        <Target className="w-4 h-4 mr-2" />
                        Ver Como Ganhar Pontos
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* All Rewards Grid */}
        {rewards && !isLoadingRewards && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Todas as Recompensas</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rewards.map((reward) => {
                const Icon = ICON_MAP[reward.icon] || Award;
                return (
                  <Card 
                    key={reward.id}
                    className={`p-6 transition-all duration-300 ${
                      reward.is_unlocked 
                        ? 'border-green-200 shadow-lg' 
                        : 'border-gray-200 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center
                        ${reward.color_scheme ? `bg-gradient-to-r ${reward.color_scheme}` : 'bg-gradient-to-r from-gray-400 to-gray-600'}
                      `}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      {reward.user_status === 'claimed' || reward.user_status === 'delivered' ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resgatado
                        </Badge>
                      ) : reward.is_unlocked ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          <Star className="w-3 h-3 mr-1" />
                          Disponível
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Lock className="w-3 h-3 mr-1" />
                          {reward.points_required} pts
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-semibold mb-2">{reward.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{reward.description}</p>
                    
                    {reward.benefits.slice(0, 2).map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Star className="w-3 h-3" />
                        <span>{benefit}</span>
                      </div>
                    ))}

                    {reward.can_claim && (
                      <Button 
                        onClick={() => handleClaimReward(reward.id)}
                        disabled={isClaimingReward}
                        className="w-full mt-4 bg-gradient-to-r from-green-500 to-blue-600 text-white"
                        size="sm"
                      >
                        {isClaimingReward ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            Resgatando...
                          </>
                        ) : (
                          <>
                            <Gift className="w-3 h-3 mr-2" />
                            Resgatar
                          </>
                        )}
                      </Button>
                    )}

                    {reward.redemption_code && (
                      <div className="mt-3 p-2 bg-gray-100 rounded text-center">
                        <p className="text-xs text-gray-600">Código:</p>
                        <p className="font-mono text-sm font-bold">{reward.redemption_code}</p>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* How to Earn Points */}
        <Card id="como-ganhar" className="p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Como Ganhar Pontos
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <div 
                  key={index}
                  className={`
                    flex items-center gap-4 p-4 rounded-lg transition-all
                    ${action.done 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-gray-50 border border-gray-200 hover:border-purple-300'
                    }
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${action.done ? 'bg-green-500' : 'bg-gray-300'}
                  `}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${action.done ? 'text-green-700' : 'text-gray-700'}`}>
                      {action.action}
                    </p>
                    <p className="text-sm text-gray-500">+{action.points} pontos</p>
                  </div>
                  {action.done && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">Dica:</span> Complete atividades diariamente para ganhar bônus extras!
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}