'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  FileText,
  Award,
  CheckCircle,
  Loader2,
  ExternalLink,
  Share2,
  Trophy,
  Star,
  Calendar,
  Clock,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFGenerationService, PDFUtils, UserProfile, PDFGenerationOptions } from '@/lib/pdf-generation';
import { HealthAssessmentResults } from '@/lib/unified-health-flow';

interface PDFGenerationCenterProps {
  user: UserProfile;
  healthResults: HealthAssessmentResults;
  onComplete?: () => void;
  showImmediately?: boolean;
}

interface GenerationState {
  isGenerating: boolean;
  currentTask: string;
  progress: number;
  completedTasks: string[];
  error: string | null;
}

export function PDFGenerationCenter({
  user,
  healthResults,
  onComplete,
  showImmediately = false
}: PDFGenerationCenterProps) {
  const [summaryState, setSummaryState] = useState<GenerationState>({
    isGenerating: false,
    currentTask: '',
    progress: 0,
    completedTasks: [],
    error: null
  });

  const [certificateState, setCertificateState] = useState<GenerationState>({
    isGenerating: false,
    currentTask: '',
    progress: 0,
    completedTasks: [],
    error: null
  });

  const [showCenter, setShowCenter] = useState(showImmediately);
  const [celebrationMode, setCelebrationMode] = useState(false);

  // CRITICAL FIX: Ensure healthResults has required structure
  const safeHealthResults = React.useMemo(() => ({
    ...healthResults,
    completedDomains: healthResults?.completedDomains || [],
    riskLevel: healthResults?.riskLevel || 'low',
    totalRiskScore: healthResults?.totalRiskScore || 0,
    recommendations: healthResults?.recommendations || [],
    nextSteps: healthResults?.nextSteps || [],
    riskScores: healthResults?.riskScores || {},
    responses: healthResults?.responses || {}
  }), [healthResults]);

  // Show center automatically after completion
  useEffect(() => {
    if (!showImmediately && safeHealthResults.riskLevel) {
      const timer = setTimeout(() => {
        setShowCenter(true);
        setCelebrationMode(true);
        
        // Hide celebration after 3 seconds
        setTimeout(() => setCelebrationMode(false), 3000);
      }, 1000);

      return () => clearTimeout(timer);
    }
    // Return empty cleanup function for the else case
    return () => {};
  }, [safeHealthResults, showImmediately]);

  const simulateProgress = useCallback((
    setState: React.Dispatch<React.SetStateAction<GenerationState>>,
    tasks: string[]
  ) => {
    let currentTaskIndex = 0;
    let progress = 0;
    let stepCount = 0;

    const interval = setInterval(() => {
      // Use deterministic progress increments to avoid hydration issues
      stepCount++;
      const baseIncrement = 100 / (tasks.length * 3); // Divide total by expected steps
      const variation = (stepCount % 3) * 2; // Simple variation based on step count
      progress += baseIncrement + variation;
      
      if (progress >= 100) {
        progress = 100;
        setState(prev => ({
          ...prev,
          progress: 100,
          currentTask: 'Finalizando...',
          completedTasks: tasks,
          isGenerating: false
        }));
        clearInterval(interval);
        return;
      }

      const taskProgress = (progress / 100) * tasks.length;
      const newTaskIndex = Math.floor(taskProgress);
      
      if (newTaskIndex !== currentTaskIndex && newTaskIndex < tasks.length) {
        currentTaskIndex = newTaskIndex;
        setState(prev => ({
          ...prev,
          progress,
          currentTask: tasks[currentTaskIndex] || '',
          completedTasks: tasks.slice(0, currentTaskIndex)
        }));
      } else {
        setState(prev => ({ ...prev, progress }));
      }
    }, 200);

    return interval;
  }, []);

  const generateSummaryPDF = useCallback(async () => {
    setSummaryState(prev => ({ ...prev, isGenerating: true, error: null, progress: 0 }));

    const tasks = [
      'Analisando dados de saúde...',
      'Calculando riscos personalizados...',
      'Gerando gráficos e visualizações...',
      'Formatando recomendações...',
      'Integrando conquistas gamificadas...',
      'Aplicando design profissional...',
      'Preparando documento final...'
    ];

    const progressInterval = simulateProgress(setSummaryState, tasks);

    try {
      const options: PDFGenerationOptions = {
        includePersonalData: true,
        includeMedicalDetails: true,
        includeRiskAssessment: true,
        includeRecommendations: true,
        templateStyle: 'professional'
      };

      const pdfData = await PDFGenerationService.generateHealthSummary(user, healthResults, options);
      const filename = PDFUtils.generateFilename('summary', user.name);
      
      // Add small delay to show completion
      setTimeout(() => {
        PDFUtils.downloadPDF(pdfData, filename);
        clearInterval(progressInterval);
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);
      setSummaryState(prev => ({
        ...prev,
        isGenerating: false,
        error: 'Erro ao gerar relatório. Tente novamente.'
      }));
      console.error('Error generating summary PDF:', error);
    }
  }, [user, healthResults, simulateProgress]);

  const generateCertificatePDF = useCallback(async () => {
    setCertificateState(prev => ({ ...prev, isGenerating: true, error: null, progress: 0 }));

    const tasks = [
      'Verificando conquistas...',
      'Calculando nível de completude...',
      'Aplicando template universitário...',
      'Adicionando elementos decorativos...',
      'Personalizando certificado...',
      'Gerando documento colecionável...'
    ];

    const progressInterval = simulateProgress(setCertificateState, tasks);

    try {
      const options: PDFGenerationOptions = {
        includePersonalData: true,
        includeMedicalDetails: false,
        includeRiskAssessment: false,
        includeRecommendations: false,
        templateStyle: 'university'
      };

      const pdfData = await PDFGenerationService.generateCompletionCertificate(user, healthResults, options);
      const filename = PDFUtils.generateFilename('certificate', user.name);
      
      // Add small delay to show completion
      setTimeout(() => {
        PDFUtils.downloadPDF(pdfData, filename);
        clearInterval(progressInterval);
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);
      setCertificateState(prev => ({
        ...prev,
        isGenerating: false,
        error: 'Erro ao gerar certificado. Tente novamente.'
      }));
      console.error('Error generating certificate PDF:', error);
    }
  }, [user, healthResults, simulateProgress]);

  const openSummaryInNewTab = useCallback(async () => {
    try {
      const options: PDFGenerationOptions = {
        includePersonalData: true,
        includeMedicalDetails: true,
        includeRiskAssessment: true,
        includeRecommendations: true,
        templateStyle: 'professional'
      };

      const pdfData = await PDFGenerationService.generateHealthSummary(user, healthResults, options);
      PDFUtils.openPDFInNewTab(pdfData);
    } catch (error) {
      console.error('Error opening summary PDF:', error);
    }
  }, [user, healthResults]);

  const getRiskLevelBadge = (riskLevel: string) => {
    const configs = {
      low: { label: 'Baixo Risco', color: 'bg-green-100 text-green-800' },
      moderate: { label: 'Risco Moderado', color: 'bg-yellow-100 text-yellow-800' },
      high: { label: 'Alto Risco', color: 'bg-orange-100 text-orange-800' },
      critical: { label: 'Risco Crítico', color: 'bg-red-100 text-red-800' }
    };

    const config = configs[riskLevel as keyof typeof configs] || configs.low;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  if (!showCenter) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Celebration Header */}
        {celebrationMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 2
              }}
              className="inline-block mb-4"
            >
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
            </motion.div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              🎉 Parabéns, {user.name}!
            </h2>
            <p className="text-gray-600 mb-4">
              Você completou sua avaliação de saúde com sucesso!
            </p>
            <div className="flex justify-center items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {user.completionDate.toLocaleDateString('pt-BR')}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {user.sessionDuration} minutos
              </div>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                Nível {user.level}
              </div>
            </div>
          </motion.div>
        )}

        {/* Summary Statistics */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Resumo da Avaliação</h3>
            {getRiskLevelBadge(safeHealthResults.riskLevel)}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{safeHealthResults.completedDomains.length}</div>
              <div className="text-sm text-gray-600">Domínios Avaliados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{user.badges.length}</div>
              <div className="text-sm text-gray-600">Badges Conquistadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{user.totalPoints}</div>
              <div className="text-sm text-gray-600">Pontos Totais</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{safeHealthResults.recommendations.length}</div>
              <div className="text-sm text-gray-600">Recomendações</div>
            </div>
          </div>
        </Card>

        {/* PDF Generation Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Health Summary PDF */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Relatório Completo de Saúde
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Documento detalhado com análise completa dos resultados, recomendações 
                  personalizadas e conquistas gamificadas. Ideal para compartilhar com 
                  profissionais de saúde.
                </p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Análise detalhada por domínios
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Recomendações personalizadas
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Conquistas e gamificação
                  </div>
                </div>

                {summaryState.isGenerating && (
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {summaryState.currentTask}
                    </div>
                    <Progress value={summaryState.progress} className="h-2" />
                    
                    {summaryState.completedTasks.length > 0 && (
                      <div className="space-y-1">
                        {summaryState.completedTasks.map((task, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            {task}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {summaryState.error && (
                  <Alert className="mb-4">
                    <AlertDescription className="text-red-600">
                      {summaryState.error}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={generateSummaryPDF}
                    disabled={summaryState.isGenerating}
                    className="flex-1"
                  >
                    {summaryState.isGenerating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {summaryState.isGenerating ? 'Gerando...' : 'Baixar PDF'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={openSummaryInNewTab}
                    disabled={summaryState.isGenerating}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Completion Certificate */}
          <Card className="p-6 hover:shadow-lg transition-shadow border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-yellow-600" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Certificado de Conclusão
                  </h3>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <Star className="w-3 h-3 mr-1" />
                    Colecionável
                  </Badge>
                </div>
                
                <p className="text-gray-600 text-sm mb-4">
                  Certificado elegante no estilo universitário para comemorar sua 
                  dedicação ao bem-estar. Perfeito para imprimir e colecionar!
                </p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Design universitário elegante
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Personalizado com suas conquistas
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Formato ideal para impressão
                  </div>
                </div>

                {certificateState.isGenerating && (
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-yellow-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {certificateState.currentTask}
                    </div>
                    <Progress value={certificateState.progress} className="h-2" />
                    
                    {certificateState.completedTasks.length > 0 && (
                      <div className="space-y-1">
                        {certificateState.completedTasks.map((task, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            {task}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {certificateState.error && (
                  <Alert className="mb-4">
                    <AlertDescription className="text-red-600">
                      {certificateState.error}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={generateCertificatePDF}
                    disabled={certificateState.isGenerating}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                  >
                    {certificateState.isGenerating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Award className="w-4 h-4 mr-2" />
                    )}
                    {certificateState.isGenerating ? 'Gerando...' : 'Gerar Certificado'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="border-yellow-300 hover:bg-yellow-50"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Badges Showcase */}
        {user.badges.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Suas Conquistas Recentes
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {user.badges.slice(0, 8).map((badge, index) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {badge.name}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {badge.rarity}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pt-4">
          <Button variant="outline" onClick={onComplete}>
            Voltar ao Dashboard
          </Button>
          <Button onClick={() => window.print()}>
            Imprimir Página
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}