'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, ChevronLeft, ChevronRight, Video, Award, Star, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import apiService from '@/services/api';

interface OnboardingStatus {
  profileComplete: boolean;
  documentsUploaded: boolean;
  healthQuestionnaireCompleted: boolean;
  onboardingComplete: boolean;
  completionPercentage: number;
  missingSteps: string[];
}

export default function InterviewSchedulePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [isCountdownActive, setIsCountdownActive] = useState(false);

  // Define checkOnboardingStatus before using it in useEffect
  const checkOnboardingStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Check various completion statuses with fallbacks
      const [profileResponse, documentsResponse, healthResponse] = await Promise.allSettled([
        apiService.get('/api/profile/status').catch(() => ({ data: { profile_complete: false } })),
        apiService.get('/api/documents/status').catch(() => ({ data: { required_documents_uploaded: false } })), 
        apiService.get('/api/health-questionnaires/status').catch(() => ({ data: { questionnaire_completed: false } }))
      ]);

      // Fallback logic - check localStorage for partial progress
      const partialProgress = localStorage.getItem('onboarding_partial_progress');
      const localData = partialProgress ? JSON.parse(partialProgress) : null;

      const profileComplete = Boolean((profileResponse.status === 'fulfilled' && 
        profileResponse.value?.data && 
        typeof profileResponse.value.data === 'object' &&
        'profile_complete' in profileResponse.value.data &&
        (profileResponse.value.data as any).profile_complete === true) || 
        (user?.name && user?.email)); // Basic profile exists
      
      const documentsUploaded = Boolean((documentsResponse.status === 'fulfilled' && 
        documentsResponse.value?.data && 
        typeof documentsResponse.value.data === 'object' &&
        'required_documents_uploaded' in documentsResponse.value.data &&
        (documentsResponse.value.data as any).required_documents_uploaded === true) ||
        (localData?.documentUploads && Object.keys(localData.documentUploads).length > 0));
      
      const healthQuestionnaireCompleted = Boolean((healthResponse.status === 'fulfilled' && 
        healthResponse.value?.data && 
        typeof healthResponse.value.data === 'object' &&
        'questionnaire_completed' in healthResponse.value.data &&
        (healthResponse.value.data as any).questionnaire_completed === true) ||
        (localStorage.getItem('health_questionnaire_completed') === 'true'));

      const onboardingComplete = profileComplete && documentsUploaded && healthQuestionnaireCompleted;
      
      // Calculate completion percentage
      const completedSteps = [profileComplete, documentsUploaded, healthQuestionnaireCompleted].filter(Boolean).length;
      const completionPercentage = Math.round((completedSteps / 3) * 100);
      
      // Identify missing steps
      const missingSteps = [];
      if (!profileComplete) missingSteps.push('Completar perfil');
      if (!documentsUploaded) missingSteps.push('Enviar documentos obrigatórios');
      if (!healthQuestionnaireCompleted) missingSteps.push('Completar questionário de saúde');

      setOnboardingStatus({
        profileComplete,
        documentsUploaded,
        healthQuestionnaireCompleted,
        onboardingComplete,
        completionPercentage,
        missingSteps
      });

      // Only enable countdown if onboarding is complete
      if (onboardingComplete) {
        setIsCountdownActive(true);
      }
      
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Default to incomplete status on error
      setOnboardingStatus({
        profileComplete: false,
        documentsUploaded: false,
        healthQuestionnaireCompleted: false,
        onboardingComplete: false,
        completionPercentage: 0,
        missingSteps: ['Erro ao verificar status - tente novamente']
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, user?.name]);

  useEffect(() => {
    if (!isCountdownActive) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsCountdownActive(false);
          router.push('/telemedicine-schedule');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCountdownActive, router]);

  const handleProceedNow = () => {
    if (onboardingStatus?.onboardingComplete) {
      setIsCountdownActive(false);
      router.push('/telemedicine-schedule');
    }
  };

  const handleCancelCountdown = () => {
    setIsCountdownActive(false);
  };

  const handleCompleteStep = (step: string) => {
    switch (step) {
      case 'profile':
        router.push('/welcome'); // Start from welcome to complete profile
        break;
      case 'documents':
        router.push('/document-upload');
        break;
      case 'health':
        router.push('/health-questionnaire');
        break;
      default:
        router.push('/welcome');
    }
  };

  const timeSlots = [
    { time: '09:00', available: true },
    { time: '10:00', available: false },
    { time: '11:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: false },
    { time: '16:00', available: true },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 flex items-center justify-center">
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando seu progresso...</p>
        </Card>
      </div>
    );
  }

  if (!onboardingStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Erro ao verificar seu progresso</p>
          <Button onClick={() => checkOnboardingStatus()}>Tentar Novamente</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
      <div className="mb-8 animate-fade-in text-center">
        <div className={`w-20 h-20 ${onboardingStatus.onboardingComplete ? 'bg-gradient-to-r from-green-100 to-emerald-100' : 'bg-gradient-to-r from-yellow-100 to-orange-100'} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg`}>
          {onboardingStatus.onboardingComplete ? (
            <CheckCircle className="w-10 h-10 text-green-600" />
          ) : (
            <AlertTriangle className="w-10 h-10 text-yellow-600" />
          )}
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {onboardingStatus.onboardingComplete 
              ? 'Consulta de Telemedicina Desbloqueada!' 
              : 'Complete seu Onboarding'
            }
          </h1>
          <p className="text-gray-600">
            {onboardingStatus.onboardingComplete 
              ? 'Parabéns! Você desbloqueou sua recompensa de conclusão' 
              : 'Você precisa completar algumas etapas antes de agendar sua consulta'
            }
          </p>
        </div>
        <Progress value={onboardingStatus.completionPercentage} className="h-3 bg-gray-200 mb-4" />
        <div className="text-sm text-gray-600">
          <span className={`font-semibold ${onboardingStatus.onboardingComplete ? 'text-green-600' : 'text-yellow-600'}`}>
            {onboardingStatus.completionPercentage}%
          </span> concluído • {onboardingStatus.onboardingComplete ? 'Recompensa disponível!' : 'Continue para desbloquear'}
        </div>
      </div>

      <Card className="card-modern p-6 sm:p-8 text-center">
        {onboardingStatus.onboardingComplete ? (
          // COMPLETED ONBOARDING - Show reward unlock
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">🎉 Recompensa Especial Desbloqueada!</h2>
            <p className="text-gray-600 mb-6">
              Como você completou todos os passos do onboarding com excelência, 
              ganhou acesso exclusivo à nossa <strong>Consulta de Telemedicina</strong> 
              com nosso concierge de saúde!
            </p>
          </div>
        ) : (
          // INCOMPLETE ONBOARDING - Show missing steps
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Etapas Pendentes</h2>
            <p className="text-gray-600 mb-6">
              Complete as etapas abaixo para desbloquear sua consulta de telemedicina:
            </p>
            
            <div className="space-y-3 mb-6">
              {!onboardingStatus.profileComplete && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <X className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">Completar perfil pessoal</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleCompleteStep('profile')}
                    className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                  >
                    Completar
                  </Button>
                </div>
              )}
              
              {!onboardingStatus.documentsUploaded && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <X className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">Enviar documentos obrigatórios</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleCompleteStep('documents')}
                    className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                  >
                    Enviar
                  </Button>
                </div>
              )}
              
              {!onboardingStatus.healthQuestionnaireCompleted && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <X className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">Completar questionário de saúde</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleCompleteStep('health')}
                    className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                  >
                    Responder
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {onboardingStatus.onboardingComplete && (
          <>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-4 flex items-center justify-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Benefícios Exclusivos
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-3 rounded-lg">
                  <div className="font-medium text-gray-900">Consulta Prioritária</div>
                  <div className="text-gray-600">Agendamento com prioridade especial</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="font-medium text-gray-900">Pontos Extras</div>
                  <div className="text-gray-600">Bonificação dobrada de gamificação</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="font-medium text-gray-900">Concierge de Saúde</div>
                  <div className="text-gray-600">Profissional especializado exclusivo</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="font-medium text-gray-900">Sem Custo</div>
                  <div className="text-gray-600">Totalmente gratuito como recompensa</div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-amber-900 mb-2">✨ Recursos Inclusos</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Consulta por vídeo em alta qualidade</li>
                <li>• Avaliação completa de saúde personalizada</li>
                <li>• Plano de cuidados individualizados</li>
                <li>• Acompanhamento contínuo opcional</li>
              </ul>
            </div>
          </>
        )}

        {onboardingStatus.onboardingComplete ? (
          // Show countdown and telemedicine buttons only if completed
          isCountdownActive ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-blue-800 font-medium">
                  Redirecionamento automático em {countdown} segundos...
                </p>
                <button
                  onClick={handleCancelCountdown}
                  className="text-blue-600 hover:text-blue-800 p-1"
                  title="Cancelar redirecionamento automático"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleProceedNow}
                  className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Ir Agora para Telemedicina
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelCountdown}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Ficar nesta página
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <Button
                onClick={handleProceedNow}
                className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 w-full sm:w-auto"
              >
                <Video className="w-4 h-4 mr-2" />
                Agendar Consulta de Telemedicina
              </Button>
            </div>
          )
        ) : (
          // Show helpful message for incomplete onboarding
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-center">
              Complete todas as etapas acima para desbloquear sua consulta de telemedicina
            </p>
          </div>
        )}

        {isCountdownActive && (
          <div className="animate-pulse text-blue-600">
            <div className="inline-flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-col sm:flex-row justify-between gap-4 mt-10">
        <Button
          variant="outline"
          onClick={() => router.push('/home')}
          className="flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl border-2 hover:bg-gray-50 transition-all group order-2 sm:order-1"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar ao Dashboard
        </Button>
        
        {onboardingStatus.onboardingComplete ? (
          <Button
            onClick={handleProceedNow}
            className="flex items-center gap-2 px-6 py-3 min-h-[44px] bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 group order-1 sm:order-2"
          >
            <Video className="w-4 h-4" />
            {isCountdownActive ? 'Prosseguir para Telemedicina' : 'Agendar Consulta de Telemedicina'}
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        ) : (
          <Button
            onClick={() => handleCompleteStep('profile')}
            className="flex items-center gap-2 px-6 py-3 min-h-[44px] bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 group order-1 sm:order-2"
          >
            <CheckCircle className="w-4 h-4" />
            Completar Onboarding
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}
      </div>
      </div>
    </div>
  );
}