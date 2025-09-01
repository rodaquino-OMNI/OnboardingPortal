'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  Clock, 
  PlayCircle, 
  AlertTriangle,
  Trophy,
  Star,
  ChevronRight,
  Info,
  Brain,
  Heart,
  User,
  Activity,
  Home,
  Shield
} from 'lucide-react';
import { HealthSessionManager, type HealthSession, type DetectionReport } from '@/lib/session-based-health-assessment';
import { ConversationalSessionComponent } from './ConversationalSessionComponent';

interface HealthSessionDashboardProps {
  onAllSessionsComplete: (detectionReport: DetectionReport) => void;
}

export function HealthSessionDashboard({ onAllSessionsComplete }: HealthSessionDashboardProps) {
  const [sessionManager] = useState(new HealthSessionManager());
  const [sessions, setSessions] = useState<HealthSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [completionStatus, setCompletionStatus] = useState({
    completed: 0,
    total: 0,
    percentage: 0,
    requiredRemaining: 0
  });

  useEffect(() => {
    // Initialize sessions
    const availableSessions = sessionManager.getAvailableSessions();
    setSessions(availableSessions);
    updateCompletionStatus();
  }, []);

  const updateCompletionStatus = () => {
    const status = sessionManager.calculateOverallCompletionStatus();
    setCompletionStatus(status);
    
    // Check if all required sessions are complete
    if (status.requiredRemaining === 0) {
      const detectionReport = sessionManager.getDetectionReport();
      onAllSessionsComplete(detectionReport);
    }
  };

  const handleSessionComplete = (sessionId: string) => {
    // Update session status
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, status: 'completed' as const }
        : session
    ));
    
    setActiveSession(null);
    updateCompletionStatus();
  };

  const getSessionIcon = (category: string) => {
    switch (category) {
      case 'emergency': return <User className="w-5 h-5" />;
      case 'physical': return <Heart className="w-5 h-5" />;
      case 'mental': return <Brain className="w-5 h-5" />;
      case 'history': return <Clock className="w-5 h-5" />;
      case 'lifestyle': return <Activity className="w-5 h-5" />;
      case 'validation': return <Shield className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: HealthSession['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'flagged': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: HealthSession['priority']) => {
    switch (priority) {
      case 'required': return 'text-red-600';
      case 'recommended': return 'text-orange-600';
      case 'optional': return 'text-gray-600';
    }
  };

  const canStartSession = (session: HealthSession): boolean => {
    if (!session.prerequisites) return true;
    
    return session.prerequisites.every(prereqId => 
      sessions.find(s => s.id === prereqId)?.status === 'completed'
    );
  };

  const getRecommendedNextSession = (): HealthSession | null => {
    // Find the next logical session based on priority and prerequisites
    const availableSessions = sessions.filter(s => 
      s.status === 'not_started' && 
      canStartSession(s)
    );

    // Prioritize required sessions first
    const requiredSession = availableSessions.find(s => s.priority === 'required');
    if (requiredSession) return requiredSession;

    // Then recommended sessions
    const recommendedSession = availableSessions.find(s => s.priority === 'recommended');
    if (recommendedSession) return recommendedSession;

    return availableSessions[0] || null;
  };

  if (activeSession) {
    const session = sessions.find(s => s.id === activeSession);
    if (session) {
      return (
        <ConversationalSessionComponent
          session={session}
          sessionManager={sessionManager}
          onComplete={() => handleSessionComplete(activeSession)}
          onBack={() => setActiveSession(null)}
        />
      );
    }
  }

  const recommendedNext = getRecommendedNextSession();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Avaliação de Saúde Personalizada
          </h1>
          <p className="text-gray-600 mb-4">
            Complete as sessões no seu ritmo. Você pode escolher a ordem e salvar o progresso.
          </p>
          
          {/* Overall Progress */}
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-600" />
                <div>
                  <h3 className="font-semibold">Progresso Geral</h3>
                  <p className="text-sm text-gray-600">
                    {completionStatus.completed} de {completionStatus.total} sessões completas
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {completionStatus.percentage}%
                </div>
                <div className="text-xs text-gray-500">
                  {completionStatus.requiredRemaining} obrigatórias restantes
                </div>
              </div>
            </div>
            <Progress value={completionStatus.percentage} className="h-3" />
          </Card>
        </div>

        {/* Recommended Next Session */}
        {recommendedNext && (
          <Alert className="mb-6">
            <Star className="h-4 w-4" />
            <AlertDescription>
              <strong>Sugestão:</strong> Continue com &ldquo;{recommendedNext.title}&rdquo; - é uma sessão {recommendedNext.priority === 'required' ? 'obrigatória' : 'recomendada'} e levará cerca de {recommendedNext.estimatedMinutes} minutos.
            </AlertDescription>
          </Alert>
        )}

        {/* Sessions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => {
            const canStart = canStartSession(session);
            const isRecommended = session.id === recommendedNext?.id;
            
            return (
              <Card key={session.id} className={`p-6 relative ${isRecommended ? 'ring-2 ring-blue-500' : ''}`}>
                {isRecommended && (
                  <Badge className="absolute -top-2 -right-2 bg-blue-600">
                    Recomendado
                  </Badge>
                )}
                
                {/* Session Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getStatusColor(session.status)}`}>
                      {session.status === 'completed' ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        getSessionIcon(session.category)
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {session.icon} {session.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        ~{session.estimatedMinutes} min
                      </p>
                    </div>
                  </div>
                  
                  <Badge variant="outline" className={getPriorityColor(session.priority)}>
                    {session.priority === 'required' ? 'Obrigatória' : 
                     session.priority === 'recommended' ? 'Recomendada' : 'Opcional'}
                  </Badge>
                </div>

                {/* Session Description */}
                <p className="text-sm text-gray-600 mb-4">
                  {session.description}
                </p>

                {/* Session Status */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    {session.status === 'completed' && (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-green-600 font-medium">Completa</span>
                      </>
                    )}
                    {session.status === 'in_progress' && (
                      <>
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-600 font-medium">Em andamento</span>
                      </>
                    )}
                    {session.status === 'not_started' && (
                      <>
                        <PlayCircle className="w-4 h-4 text-gray-600" />
                        <span className="text-gray-600">Não iniciada</span>
                      </>
                    )}
                    {session.status === 'flagged' && (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-red-600 font-medium">Requer revisão</span>
                      </>
                    )}
                  </div>
                  
                  {session.completionRewards && (
                    <div className="text-xs text-gray-500">
                      +{session.completionRewards.points} pontos
                    </div>
                  )}
                </div>

                {/* Prerequisites Check */}
                {session.prerequisites && session.prerequisites.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Requer conclusão de:</p>
                    <div className="flex flex-wrap gap-1">
                      {session.prerequisites.map(prereqId => {
                        const prereqSession = sessions.find(s => s.id === prereqId);
                        const isCompleted = prereqSession?.status === 'completed';
                        return (
                          <Badge 
                            key={prereqId} 
                            variant="outline" 
                            className={isCompleted ? 'text-green-600' : 'text-gray-400'}
                          >
                            {prereqSession?.title}
                            {isCompleted && <CheckCircle className="w-3 h-3 ml-1" />}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  onClick={() => setActiveSession(session.id)}
                  disabled={!canStart}
                  variant={session.status === 'completed' ? 'outline' : 'default'}
                  className="w-full"
                >
                  {session.status === 'completed' ? (
                    'Revisar Respostas'
                  ) : session.status === 'in_progress' ? (
                    <>
                      Continuar
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  ) : canStart ? (
                    <>
                      Iniciar Sessão
                      <PlayCircle className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    'Pré-requisitos pendentes'
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}