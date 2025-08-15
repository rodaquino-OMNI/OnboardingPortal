'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Trophy, 
  ArrowRight, 
  Sparkles,
  Heart,
  Brain,
  Shield,
  TrendingUp,
  Calendar,
  Clock,
  Target,
  FileText,
  Award
} from 'lucide-react';
import { PDFGenerationCenter } from '../pdf/PDFGenerationCenter';
import { usePDFGeneration, useBadgeEnhancement } from '@/hooks/usePDFGeneration';
import { useGamification } from '@/hooks/useGamification';
import { HealthAssessmentResults } from '@/lib/unified-health-flow';

interface HealthAssessmentCompleteProps {
  healthResults: HealthAssessmentResults;
  userName: string;
  userAge: number;
  sessionStartTime: Date;
  onNavigateHome: () => void;
  onNavigateNext?: () => void;
}

interface CompletionStat {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  description: string;
  color: string;
}

export function HealthAssessmentComplete({
  healthResults,
  userName,
  userAge,
  sessionStartTime,
  onNavigateHome,
  onNavigateNext
}: HealthAssessmentCompleteProps) {
  const [showPDFCenter, setShowPDFCenter] = useState(false);
  const [showCelebration, setShowCelebration] = useState(true);
  
  const sessionDuration = Math.round((Date.now() - sessionStartTime.getTime()) / (1000 * 60));
  
  // CRITICAL FIX: Ensure healthResults has required structure with defensive programming
  const safeHealthResults = useMemo(() => {
    console.log('[HealthAssessmentComplete] Raw healthResults received:', healthResults);
    
    // Deep defensive structure creation
    const safe = {
      completedDomains: Array.isArray(healthResults?.completedDomains) 
        ? healthResults.completedDomains 
        : [],
      riskLevel: ['low', 'moderate', 'high', 'critical'].includes(healthResults?.riskLevel) 
        ? healthResults.riskLevel 
        : 'low',
      totalRiskScore: typeof healthResults?.totalRiskScore === 'number' 
        ? healthResults.totalRiskScore 
        : 0,
      recommendations: Array.isArray(healthResults?.recommendations) 
        ? healthResults.recommendations 
        : ['Continuar com hábitos saudáveis', 'Realizar check-ups regulares'],
      nextSteps: Array.isArray(healthResults?.nextSteps) 
        ? healthResults.nextSteps 
        : ['Baixar relatório de saúde', 'Agendar consulta médica'],
      riskScores: typeof healthResults?.riskScores === 'object' && healthResults?.riskScores !== null
        ? healthResults.riskScores 
        : {
            cardiovascular: 0,
            mental_health: 0,
            substance_abuse: 0,
            chronic_disease: 0,
            allergy_risk: 0,
            safety_risk: 0
          },
      responses: typeof healthResults?.responses === 'object' && healthResults?.responses !== null
        ? healthResults.responses 
        : {},
      metadata: (healthResults as any)?.metadata || {},
      fraudDetectionScore: healthResults?.fraudDetectionScore || 0,
      timestamp: healthResults?.timestamp || new Date().toISOString()
    };
    
    console.log('[HealthAssessmentComplete] Safe healthResults created:', safe);
    return safe;
  }, [healthResults]);
  
  const gamificationStore = useGamification();
  const { getRecentBadges, getRareBadges } = useBadgeEnhancement();
  
  const { userProfile, isReady, error } = usePDFGeneration({
    healthResults: safeHealthResults,
    userName,
    userAge,
    completionDate: new Date(),
    sessionDuration
  });

  // Update completion progress (backend handles all point awarding)
  useEffect(() => {
    const updateCompletionProgress = async () => {
      try {
        // Gamification progress would be updated by the backend automatically
        console.log('Gamification progress tracking - completed domains:', safeHealthResults.completedDomains.length);

        // Backend automatically awards:
        // - 100-200 points for basic completion based on pathway
        // - 25 points per completed domain
        // - 50 points for engagement/honesty bonuses
        // - Risk-based bonuses (50 points for high risk disclosure)
        console.log('✨ Backend has awarded points for health assessment completion');
        console.log('Completed domains:', safeHealthResults.completedDomains.length);
        console.log('Risk level:', safeHealthResults.riskLevel);
        console.log('Session duration:', sessionDuration, 'minutes');

      } catch (error) {
        console.error('Error updating completion progress:', error);
      }
    };

    updateCompletionProgress();
  }, [safeHealthResults, sessionDuration]);

  // Hide celebration after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCelebration(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // Generate completion statistics
  const completionStats = useMemo((): CompletionStat[] => {
    return [
      {
        icon: Target as any,
        label: 'Domínios Avaliados',
        value: safeHealthResults.completedDomains.length,
        description: 'Áreas de saúde analisadas',
        color: 'text-blue-600'
      },
      {
        icon: Clock as any,
        label: 'Tempo de Sessão',
        value: `${sessionDuration}min`,
        description: 'Dedicado ao seu bem-estar',
        color: 'text-green-600'
      },
      {
        icon: Brain as any,
        label: 'Recomendações',
        value: healthResults.recommendations.length,
        description: 'Orientações personalizadas',
        color: 'text-purple-600'
      },
      {
        icon: Shield as any,
        label: 'Nível de Risco',
        value: getRiskLevelDisplay(healthResults.riskLevel),
        description: 'Avaliação geral de saúde',
        color: getRiskLevelColor(healthResults.riskLevel)
      },
      {
        icon: Trophy as any,
        label: 'Badges Conquistadas',
        value: userProfile?.badges.length || 0,
        description: 'Conquistas desbloqueadas',
        color: 'text-yellow-600'
      },
      {
        icon: TrendingUp as any,
        label: 'Pontos Totais',
        value: userProfile?.totalPoints || 0,
        description: 'Score de engajamento',
        color: 'text-orange-600'
      }
    ];
  }, [healthResults, sessionDuration, userProfile, safeHealthResults.completedDomains.length]);

  const recentBadges = getRecentBadges(3);
  const rareBadges = getRareBadges();

  if (showPDFCenter) {
    return (
      <PDFGenerationCenter
        user={userProfile!}
        healthResults={healthResults}
        onComplete={() => setShowPDFCenter(false)}
        showImmediately={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Celebration Header */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.8 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="text-center py-8"
            >
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
                className="inline-block mb-6"
              >
                <div className="relative">
                  <Trophy className="w-20 h-20 text-yellow-500 mx-auto" />
                  <motion.div
                    animate={{ 
                      scale: [0, 1, 0],
                      rotate: [0, 180, 360]
                    }}
                    transition={{ 
                      duration: 1,
                      repeat: Infinity,
                      repeatDelay: 2
                    }}
                    className="absolute -top-2 -right-2"
                  >
                    <Sparkles className="w-8 h-8 text-yellow-400" />
                  </motion.div>
                </div>
              </motion.div>
              
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                🎉 Parabéns, {userName}!
              </h1>
              <p className="text-xl text-gray-600 mb-2">
                Você completou sua avaliação de saúde com sucesso!
              </p>
              <p className="text-gray-500">
                Sua dedicação ao bem-estar é inspiradora
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completion Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <h2 className="text-2xl font-bold text-gray-900">
                  Avaliação Concluída
                </h2>
              </div>
              <p className="text-gray-600">
                Aqui está um resumo do que você conquistou
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {completionStats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index }}
                  className="text-center p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <stat.icon className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </div>
                  <div className="font-medium text-gray-700 mb-1">
                    {stat.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {stat.description}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Recent Achievements */}
        {recentBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Conquistas Recentes
                </h3>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4">
                {recentBadges.map((badge: any, index: number) => (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm"
                  >
                    <span className="text-2xl">{badge.displayIcon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">
                        {badge.displayName}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {badge.rarity}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* PDF Generation Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <FileText className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">
                  Seus Documentos Estão Prontos!
                </h3>
              </div>
              <p className="text-gray-600">
                Gere relatórios profissionais e certificados colecionáveis
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3 p-4 bg-white rounded-lg">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Relatório Completo</div>
                  <div className="text-sm text-gray-600">
                    Análise detalhada com recomendações
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-white rounded-lg">
                <Award className="w-8 h-8 text-yellow-600" />
                <div>
                  <div className="font-medium text-gray-900">Certificado de Conclusão</div>
                  <div className="text-sm text-gray-600">
                    Documento colecionável personalizado
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <Alert className="mb-4">
                <AlertDescription className="text-red-600">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="text-center">
              <Button
                onClick={() => setShowPDFCenter(true)}
                disabled={!isReady}
                size="lg"
                className="px-8"
              >
                <FileText className="w-5 h-5 mr-2" />
                {isReady ? 'Gerar Documentos' : 'Preparando dados...'}
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button
            variant="outline"
            onClick={onNavigateHome}
            size="lg"
            className="px-8"
          >
            <Heart className="w-5 h-5 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          {onNavigateNext && (
            <Button
              onClick={onNavigateNext}
              size="lg"
              className="px-8"
            >
              Próxima Etapa
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </motion.div>

        {/* Footer Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-center py-8"
        >
          <p className="text-gray-500 text-sm">
            Obrigado por se dedicar à sua saúde e bem-estar. 
            Seus documentos ficam disponíveis para download a qualquer momento.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// Helper functions
function getRiskLevelDisplay(riskLevel: string): string {
  const displays = {
    low: 'Baixo',
    moderate: 'Moderado',
    high: 'Alto',
    critical: 'Crítico'
  };
  return displays[riskLevel as keyof typeof displays] || 'N/A';
}

function getRiskLevelColor(riskLevel: string): string {
  const colors = {
    low: 'text-green-600',
    moderate: 'text-yellow-600',
    high: 'text-orange-600',
    critical: 'text-red-600'
  };
  return colors[riskLevel as keyof typeof colors] || 'text-gray-600';
}