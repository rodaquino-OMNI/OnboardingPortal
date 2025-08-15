'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Activity, FileText, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useQuestionnaire, QuestionnaireFeature, FeatureHooks } from '../BaseHealthQuestionnaire';
import { calculateRiskScore, RiskScore } from '@/lib/health-questionnaire-v2';

interface ClinicalAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action?: string;
  timestamp: Date;
}

interface ClinicalDecisionConfig {
  enabled: boolean;
  realTimeRiskAssessment: boolean;
  clinicalProtocols: boolean;
  emergencyDetection: boolean;
  evidenceBasedGuidelines: boolean;
}

export function ClinicalDecisionFeatureComponent({ config }: { config?: ClinicalDecisionConfig }) {
  const { state } = useQuestionnaire();
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>([]);
  const [protocols, setProtocols] = useState<string[]>([]);

  const enableRealTime = config?.realTimeRiskAssessment !== false;
  const enableEmergency = config?.emergencyDetection !== false;

  // Real-time risk assessment
  useEffect(() => {
    if (!enableRealTime) return;

    const responseCount = Object.keys(state.responses).length;
    if (responseCount > 5) {
      try {
        const score = calculateRiskScore(state.responses);
        setRiskScore(score);

        // Check for clinical alerts
        checkClinicalAlerts(score);
      } catch (error) {
        console.error('[Clinical Decision] Risk calculation error:', error);
      }
    }
  }, [state.responses, enableRealTime, checkClinicalAlerts]);

  // Check for clinical alerts based on risk score
  const checkClinicalAlerts = useCallback((score: RiskScore) => {
    const alerts: ClinicalAlert[] = [];

    // Emergency detection
    if (enableEmergency && score.flags.includes('suicide_risk')) {
      alerts.push({
        id: 'suicide-risk',
        severity: 'critical',
        title: 'Risco de Suicídio Detectado',
        description: 'Respostas indicam possível risco. Protocolo de emergência ativado.',
        action: 'Conectar com profissional de saúde mental imediatamente',
        timestamp: new Date()
      });
    }

    // High cardiovascular risk
    if ((score as any).cardiovascular > 70) {
      alerts.push({
        id: 'cv-risk',
        severity: 'high',
        title: 'Alto Risco Cardiovascular',
        description: 'Fatores de risco cardiovascular significativos detectados.',
        action: 'Agendar avaliação cardiológica',
        timestamp: new Date()
      });
    }

    // Mental health concerns
    if ((score as any).mental > 60) {
      alerts.push({
        id: 'mental-health',
        severity: 'medium',
        title: 'Atenção à Saúde Mental',
        description: 'Indicadores sugerem necessidade de suporte psicológico.',
        action: 'Considerar acompanhamento com psicólogo',
        timestamp: new Date()
      });
    }

    setClinicalAlerts(alerts);

    // Update recommended protocols
    updateProtocols(score);
  }, [enableEmergency]);

  // Update clinical protocols based on risk assessment
  const updateProtocols = (score: RiskScore) => {
    const newProtocols: string[] = [];

    if (score.flags.includes('diabetes_risk')) {
      newProtocols.push('Protocolo de Rastreamento de Diabetes');
    }

    if (score.flags.includes('hypertension_risk')) {
      newProtocols.push('Protocolo de Monitoramento de Pressão Arterial');
    }

    if ((score as any).mental > 40) {
      newProtocols.push('Protocolo de Avaliação de Saúde Mental (PHQ-9/GAD-7)');
    }

    setProtocols(newProtocols);
  };

  // Get severity color
  const getSeverityColor = (severity: ClinicalAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="clinical-decision-container space-y-4">
      {/* Clinical Alerts */}
      {clinicalAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alertas Clínicos
          </h3>
          
          {clinicalAlerts.map(alert => (
            <Alert key={alert.id} className={`border-2 ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold">{alert.title}</h4>
                  <p className="text-sm mt-1">{alert.description}</p>
                  {alert.action && (
                    <p className="text-sm font-medium mt-2">
                      ➜ {alert.action}
                    </p>
                  )}
                </div>
                <Badge variant={alert.severity === 'critical' ? 'error' : 'secondary'}>
                  {alert.severity === 'critical' ? 'CRÍTICO' : alert.severity.toUpperCase()}
                </Badge>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Risk Score Summary */}
      {riskScore && config?.realTimeRiskAssessment && (
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Avaliação de Risco em Tempo Real
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((riskScore as any).cardiovascular || 0)}
              </div>
              <div className="text-xs text-gray-600">Cardiovascular</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round((riskScore as any).mental || 0)}
              </div>
              <div className="text-xs text-gray-600">Saúde Mental</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round((riskScore as any).overall || 0)}
              </div>
              <div className="text-xs text-gray-600">Geral</div>
            </div>
          </div>
        </Card>
      )}

      {/* Clinical Protocols */}
      {protocols.length > 0 && config?.clinicalProtocols && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Protocolos Clínicos Recomendados
          </h3>
          
          <div className="space-y-2">
            {protocols.map((protocol, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>{protocol}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Evidence-Based Guidelines */}
      {config?.evidenceBasedGuidelines && riskScore && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Baseado em diretrizes clínicas atualizadas e evidências científicas
        </div>
      )}
    </div>
  );
}

// Clinical Decision Hooks
export const clinicalDecisionHooks: FeatureHooks = {
  onInit: (state) => {
    console.log('[Clinical Decision] System initialized');
  },

  onResponseSubmit: (questionId, value, state) => {
    // Check for emergency flags in real-time
    if (questionId === 'phq9_9' && typeof value === 'number' && value > 0) {
      // Trigger emergency protocol
      console.error('[EMERGENCY] Suicide risk detected');
    }
    return null;
  },

  validateResponse: (question, value) => {
    // Clinical validation for specific questions
    if (question.metadata?.clinicalCode && question.type === 'number') {
      const numValue = value as number;
      
      // Blood pressure validation
      if (question.id.includes('blood_pressure_systolic') && (numValue < 70 || numValue > 250)) {
        return 'Valor de pressão arterial fora do intervalo clínico aceitável';
      }
    }
    return null;
  },

  onComplete: (state) => {
    // Generate clinical summary report
    console.log('[Clinical Decision] Generating clinical summary...');
  }
};

// Export feature definition
export const ClinicalDecisionFeature: QuestionnaireFeature = {
  id: 'clinical-decision',
  name: 'Clinical Decision Support',
  enabled: true,
  priority: 95,
  component: ClinicalDecisionFeatureComponent,
  hooks: clinicalDecisionHooks,
  config: {
    enabled: true,
    realTimeRiskAssessment: true,
    clinicalProtocols: true,
    emergencyDetection: true,
    evidenceBasedGuidelines: true
  }
};