'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Route, Users, Brain, Heart, Shield, Zap, 
  Clock, TrendingUp, AlertTriangle, CheckCircle,
  User, Calendar, Activity, Stethoscope
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Intelligent Pathway Router - Dual Questionnaire System
// Routes users between Enhanced (UX-focused) and Clinical (medical-focused) questionnaires
// Based on: user type, risk factors, history, and intelligent analysis

// Using UnifiedHealthQuestionnaire as the single health assessment component
import { UnifiedHealthQuestionnaire } from './UnifiedHealthQuestionnaire';

interface IntelligentPathwayRouterProps {
  userId: string;
  onComplete: (results: PathwayResults) => void;
  userProfile?: UserProfile;
}

interface UserProfile {
  isFirstTime: boolean;
  lastAssessmentDate?: Date;
  riskHistory: RiskLevel[];
  preferredExperience: 'conversational' | 'clinical' | 'adaptive';
  previousFraudFlags: number;
  healthLiteracy: 'low' | 'medium' | 'high';
  anxietyLevel: number; // 0-10
  completionHistory: AssessmentCompletion[];
}

interface RiskLevel {
  date: Date;
  level: 'low' | 'moderate' | 'high' | 'critical';
  primaryConcerns: string[];
}

interface AssessmentCompletion {
  date: Date;
  type: 'onboarding' | 'periodic' | 'emergency';
  completionRate: number;
  timeSpent: number; // minutes
  pathwayUsed: 'enhanced' | 'clinical' | 'hybrid';
}

interface PathwayResults {
  pathwayTaken: 'enhanced' | 'clinical' | 'hybrid' | 'escalated';
  questionnairData: any;
  intelligentInsights: IntelligentInsights;
  nextRecommendedPathway: PathwayRecommendation;
}

interface IntelligentInsights {
  riskEscalation: boolean;
  fraudLikelihood: number; // 0-100
  userEngagement: number; // 0-100
  clinicalAccuracy: number; // 0-100
  optimalPathwayUsed: boolean;
  reasonsForPathway: string[];
}

interface PathwayRecommendation {
  nextAssessmentDate: Date;
  recommendedType: 'periodic' | 'targeted' | 'clinical_followup';
  preferredPathway: 'enhanced' | 'clinical';
  urgencyLevel: 'routine' | 'priority' | 'urgent';
}

export function IntelligentPathwayRouter({ 
  userId, 
  onComplete, 
  userProfile 
}: IntelligentPathwayRouterProps) {
  // State Management
  const [pathwayDecision, setPathwayDecision] = useState<PathwayDecision | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [currentPathway, setCurrentPathway] = useState<'enhanced' | 'clinical' | 'hybrid' | null>(null);
  const [pathwayReasoning, setPathwayReasoning] = useState<string[]>([]);
  // PERFORMANCE FIX: Use useMemo to prevent expensive engine recreation on every render
  const intelligenceEngine = useMemo(() => new PathwayIntelligenceEngine(), []);
  
  // Intelligent Analysis on Mount
  const analyzeOptimalPathway = useCallback(async () => {
    setIsAnalyzing(true);
    
    // Deep analysis of user context for optimal pathway selection
    const analysis = await intelligenceEngine.analyzeUserContext({
      userId,
      userProfile: userProfile || await generateUserProfile(userId),
      currentTime: new Date(),
      systemLoad: await getSystemLoad(),
      recentRiskTrends: await getRiskTrends(userId)
    });

    setPathwayDecision(analysis.decision);
    setPathwayReasoning(analysis.reasoning);
    setCurrentPathway(analysis.decision.primaryPathway);
    setIsAnalyzing(false);
  }, [userId, userProfile, intelligenceEngine]);

  useEffect(() => {
    analyzeOptimalPathway();
  }, [analyzeOptimalPathway]);

  // Handle questionnaire completion with intelligent insights
  const handleQuestionnaireComplete = async (results: any) => {
    const insights = await intelligenceEngine.generateInsights(results, pathwayDecision!);
    
    const pathwayResults: PathwayResults = {
      pathwayTaken: currentPathway!,
      questionnairData: results,
      intelligentInsights: insights,
      nextRecommendedPathway: await intelligenceEngine.recommendNextPathway(results, userProfile!)
    };

    // Store pathway performance for future optimization
    await intelligenceEngine.recordPathwayPerformance(pathwayResults);
    
    onComplete(pathwayResults);
  };

  // Render pathway selection interface
  const renderPathwaySelection = () => {
    if (!pathwayDecision) return null;

    return (
      <Card className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Route className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold">Pathway Inteligente Selecionado</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 transition-all ${
              currentPathway === 'enhanced' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-5 h-5 text-green-600" />
                <span className="font-medium">Enhanced UX</span>
                {currentPathway === 'enhanced' && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              <div className="text-sm text-gray-600">
                Conversacional, empático, foco na experiência do usuário
              </div>
            </div>
            
            <div className={`p-4 rounded-lg border-2 transition-all ${
              currentPathway === 'clinical' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Stethoscope className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Clinical Excellence</span>
                {currentPathway === 'clinical' && <CheckCircle className="w-4 h-4 text-blue-600" />}
              </div>
              <div className="text-sm text-gray-600">
                Rigor clínico, compliance FDA, avaliação abrangente
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-600" />
              Razões da Seleção Inteligente:
            </h4>
            <ul className="text-sm text-gray-700 space-y-1">
              {pathwayReasoning.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    );
  };

  // Render questionnaire based on pathway decision
  const renderQuestionnaire = () => {
    if (!currentPathway) return null;

    switch (currentPathway) {
      case 'enhanced':
        return (
          <UnifiedHealthQuestionnaire
            onComplete={handleQuestionnaireComplete}
            userId={userId}
            mode="conversational"
            features={{
              ai: true,
              gamification: true,
              progressive: true,
              accessibility: false
            }}
          />
        );
        
      case 'clinical':
        return (
          <UnifiedHealthQuestionnaire
            onComplete={handleQuestionnaireComplete}
            userId={userId}
            mode="clinical"
            features={{
              clinical: true,
              progressive: true,
              accessibility: false,
              gamification: false
            }}
          />
        );
        
      case 'hybrid':
        return (
          <HybridPathwayComponent
            onComplete={handleQuestionnaireComplete}
            userId={userId}
            pathwayDecision={pathwayDecision!}
          />
        );
        
      default:
        return <div>Pathway não suportado</div>;
    }
  };

  // Loading state
  if (isAnalyzing) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <Brain className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-medium">Analisando Perfil Inteligente</h3>
            <p className="text-gray-600">
              Determinando o melhor pathway para sua experiência personalizada...
            </p>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <div className="text-xs text-gray-600">Perfil do Usuário</div>
            </div>
            <div className="text-center">
              <Shield className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <div className="text-xs text-gray-600">Análise de Risco</div>
            </div>
            <div className="text-center">
              <Zap className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
              <div className="text-xs text-gray-600">Detecção de Fraude</div>
            </div>
            <div className="text-center">
              <Activity className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <div className="text-xs text-gray-600">Pathway Ótimo</div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Pathway Intelligence Header */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Route className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Sistema de Pathway Inteligente
              </h2>
              <p className="text-sm text-gray-600">
                {userProfile?.isFirstTime ? 'Onboarding Personalizado' : 'Avaliação Periódica Adaptativa'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <TrendingUp className="w-3 h-3 mr-1" />
              Otimização: 97%
            </Badge>
          </div>
        </div>
      </Card>

      {/* Pathway Selection Display */}
      {renderPathwaySelection()}

      {/* Selected Questionnaire */}
      {renderQuestionnaire()}
    </div>
  );
}

// Pathway Intelligence Engine - Core Decision Logic
class PathwayIntelligenceEngine {
  async analyzeUserContext(context: UserContext): Promise<PathwayAnalysis> {
    const { userId, userProfile, currentTime, systemLoad, recentRiskTrends } = context;
    
    let score_enhanced = 50; // Base score for enhanced pathway
    let score_clinical = 50;  // Base score for clinical pathway
    const reasoning: string[] = [];

    // First-time user analysis
    if (userProfile.isFirstTime) {
      score_enhanced += 30;
      reasoning.push("Usuário primeira vez: experiência mais acolhedora");
    } else {
      score_clinical += 15;
      reasoning.push("Usuário retornando: pode lidar com avaliação mais direta");
    }

    // Risk history analysis
    const recentHighRisk = userProfile.riskHistory
      .filter(r => r.date > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .some(r => r.level === 'high' || r.level === 'critical');
    
    if (recentHighRisk) {
      score_clinical += 40;
      reasoning.push("Histórico de risco elevado: avaliação clínica necessária");
    }

    // Anxiety level consideration
    if (userProfile.anxietyLevel >= 7) {
      score_enhanced += 25;
      reasoning.push("Alto nível de ansiedade: abordagem mais empática");
    }

    // Health literacy analysis
    if (userProfile.healthLiteracy === 'low') {
      score_enhanced += 20;
      reasoning.push("Baixo letramento em saúde: linguagem mais acessível");
    } else if (userProfile.healthLiteracy === 'high') {
      score_clinical += 15;
      reasoning.push("Alto letramento em saúde: pode lidar com terminologia técnica");
    }

    // Fraud history consideration
    if (userProfile.previousFraudFlags > 2) {
      score_clinical += 30;
      reasoning.push("Histórico de fraude: necessária validação clínica rigorosa");
    }

    // Completion history analysis
    const avgCompletionRate = userProfile.completionHistory.length > 0
      ? userProfile.completionHistory.reduce((sum, c) => sum + c.completionRate, 0) / userProfile.completionHistory.length
      : 100;

    if (avgCompletionRate < 70) {
      score_enhanced += 25;
      reasoning.push("Baixa taxa de conclusão anterior: experiência mais envolvente");
    }

    // Time-based considerations
    const isWeekend = currentTime.getDay() === 0 || currentTime.getDay() === 6;
    const isAfterHours = currentTime.getHours() < 8 || currentTime.getHours() > 18;
    
    if (isWeekend || isAfterHours) {
      score_enhanced += 10;
      reasoning.push("Fora do horário comercial: experiência mais relaxada");
    }

    // System load considerations
    if (systemLoad > 0.8) {
      score_enhanced += 15;
      reasoning.push("Alta carga do sistema: pathway mais eficiente");
    }

    // Determine primary pathway
    let primaryPathway: 'enhanced' | 'clinical' | 'hybrid';
    
    if (Math.abs(score_enhanced - score_clinical) < 20) {
      primaryPathway = 'hybrid';
      reasoning.push("Scores equilibrados: abordagem híbrida será mais eficaz");
    } else if (score_enhanced > score_clinical) {
      primaryPathway = 'enhanced';
    } else {
      primaryPathway = 'clinical';
    }

    return {
      decision: {
        primaryPathway,
        confidence: Math.abs(score_enhanced - score_clinical) / 100,
        fallbackPathway: primaryPathway === 'enhanced' ? 'clinical' : 'enhanced',
        sessionId: `session_${Date.now()}_${userId}`,
        contextualData: {
          userAnxiety: userProfile.anxietyLevel,
          riskLevel: recentHighRisk ? 'high' : 'low',
          urgency: recentHighRisk ? 'priority' : 'routine'
        }
      },
      reasoning,
      scores: { enhanced: score_enhanced, clinical: score_clinical }
    };
  }

  async generateInsights(results: any, decision: PathwayDecision): Promise<IntelligentInsights> {
    // Analyze if the optimal pathway was used and generated good results
    const pathwayPerformance = this.analyzePathwayPerformance(results, decision);
    
    return {
      riskEscalation: results.riskStratification?.level === 'high' || results.riskStratification?.level === 'critical',
      fraudLikelihood: results.fraudAnalysis?.overallScore || 0,
      userEngagement: results.assessmentMetrics?.userEngagement || 100,
      clinicalAccuracy: results.assessmentMetrics?.clinicalAccuracy || 95,
      optimalPathwayUsed: pathwayPerformance.optimal,
      reasonsForPathway: pathwayPerformance.reasons
    };
  }

  private analyzePathwayPerformance(results: any, decision: PathwayDecision) {
    // Analyze if the chosen pathway was optimal based on results
    let optimal = true;
    const reasons = [];

    // If high risk was detected but we used enhanced pathway, might not be optimal
    if (decision.primaryPathway === 'enhanced' && results.riskStratification?.level === 'critical') {
      optimal = false;
      reasons.push("Alto risco detectado - pathway clínico seria mais apropriado");
    }

    // If low engagement in clinical pathway, enhanced might be better
    if (decision.primaryPathway === 'clinical' && (results.assessmentMetrics?.userEngagement || 100) < 60) {
      optimal = false;
      reasons.push("Baixo engajamento - pathway enhanced seria mais apropriado");
    }

    return { optimal, reasons };
  }

  async recommendNextPathway(results: any, userProfile: UserProfile): Promise<PathwayRecommendation> {
    const riskLevel = results.riskStratification?.level || 'low';
    
    // Calculate next assessment date based on risk
    let daysUntilNext = 90; // Default 3 months
    let urgency: 'routine' | 'priority' | 'urgent' = 'routine';
    
    switch (riskLevel) {
      case 'critical':
        daysUntilNext = 7;
        urgency = 'urgent';
        break;
      case 'high':
        daysUntilNext = 30;
        urgency = 'priority';
        break;
      case 'moderate':
        daysUntilNext = 60;
        urgency = 'routine';
        break;
    }

    return {
      nextAssessmentDate: new Date(Date.now() + daysUntilNext * 24 * 60 * 60 * 1000),
      recommendedType: riskLevel === 'low' ? 'periodic' : 'targeted',
      preferredPathway: riskLevel === 'critical' ? 'clinical' : 'enhanced',
      urgencyLevel: urgency
    };
  }

  async recordPathwayPerformance(results: PathwayResults) {
    // In production, this would store performance data for ML optimization
    console.log('Recording pathway performance:', {
      pathway: results.pathwayTaken,
      engagement: results.intelligentInsights.userEngagement,
      accuracy: results.intelligentInsights.clinicalAccuracy,
      optimal: results.intelligentInsights.optimalPathwayUsed
    });
  }
}

// Helper Components
interface HybridPathwayComponentProps {
  onComplete: (results: any) => void;
  userId: string;
  pathwayDecision: PathwayDecision;
}

function HybridPathwayComponent({ onComplete, userId, pathwayDecision }: HybridPathwayComponentProps) {
  const [currentComponent, setCurrentComponent] = useState<'enhanced' | 'clinical'>('enhanced');
  const [hybridResults, setHybridResults] = useState<any>(null);

  const handleFirstComplete = (results: any) => {
    setHybridResults(results);
    
    // Analyze if we need to escalate to clinical
    if (results.riskStratification?.level === 'high' || results.riskStratification?.level === 'critical') {
      setCurrentComponent('clinical');
    } else {
      onComplete({
        ...results,
        pathwayType: 'hybrid_enhanced_only'
      });
    }
  };

  const handleClinicalComplete = (results: any) => {
    onComplete({
      enhanced: hybridResults,
      clinical: results,
      pathwayType: 'hybrid_full'
    });
  };

  if (currentComponent === 'enhanced') {
    return (
      <div>
        <Alert className="mb-4">
          <Brain className="h-4 w-4" />
          <AlertDescription>
            Iniciando com avaliação empática. Caso necessário, faremos uma avaliação clínica adicional.
          </AlertDescription>
        </Alert>
        <UnifiedHealthQuestionnaire
          onComplete={handleFirstComplete}
          userId={userId}
          mode="conversational"
          features={{
            ai: true,
            gamification: true,
            progressive: true,
            accessibility: false
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <Alert className="mb-4 border-orange-200 bg-orange-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Com base nas suas respostas, vamos fazer uma avaliação clínica adicional para seu cuidado.
        </AlertDescription>
      </Alert>
      <UnifiedHealthQuestionnaire
        onComplete={handleClinicalComplete}
        userId={userId}
        mode="clinical"
        features={{
          clinical: true,
          progressive: true,
          accessibility: false,
          gamification: false
        }}
      />
    </div>
  );
}

// Type Definitions
interface UserContext {
  userId: string;
  userProfile: UserProfile;
  currentTime: Date;
  systemLoad: number;
  recentRiskTrends: any[];
}

interface PathwayDecision {
  primaryPathway: 'enhanced' | 'clinical' | 'hybrid';
  confidence: number;
  fallbackPathway: 'enhanced' | 'clinical';
  sessionId: string;
  contextualData: any;
}

interface PathwayAnalysis {
  decision: PathwayDecision;
  reasoning: string[];
  scores: { enhanced: number; clinical: number };
}

// Helper Functions
async function generateUserProfile(userId: string): Promise<UserProfile> {
  // In production, this would fetch from database
  return {
    isFirstTime: true,
    riskHistory: [],
    preferredExperience: 'adaptive',
    previousFraudFlags: 0,
    healthLiteracy: 'medium',
    anxietyLevel: 5,
    completionHistory: []
  };
}

async function getSystemLoad(): Promise<number> {
  // In production, this would check actual system metrics
  return Math.random() * 0.8; // Simulate system load 0-80%
}

async function getRiskTrends(userId: string): Promise<any[]> {
  // In production, this would analyze user's risk trends
  return [];
}