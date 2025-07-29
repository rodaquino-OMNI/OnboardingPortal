// Contextual Fraud Detection Engine - Enhanced for Dual Pathways
// Designed by Fraud-Prevention-Specialist Agent
// Adapts fraud detection algorithms based on user context, pathway type, and assessment purpose

export interface ContextualFraudDetector {
  analyzeWithContext(
    responses: QuestionnaireResponse[],
    userContext: UserFraudContext,
    pathwayContext: PathwayFraudContext
  ): Promise<ContextualFraudAnalysis>;
}

export interface QuestionnaireResponse {
  questionId: string;
  value: any;
  timestamp: Date;
  responseTime: number; // milliseconds
  revisionCount: number;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  mouseMovements?: MouseMovement[];
  keystrokeDynamics?: KeystrokeDynamics;
  attentionMetrics?: AttentionMetrics;
  deviceFingerprint?: DeviceFingerprint;
  networkMetadata?: NetworkMetadata;
}

export interface MouseMovement {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number;
  velocity?: number;
}

export interface KeystrokeDynamics {
  dwellTime: number; // Key press duration
  flightTime: number; // Time between key releases
  typing_rhythm: number[]; // Pattern of typing intervals
  backspaceFrequency: number;
}

export interface AttentionMetrics {
  pageVisibility: VisibilityEvent[];
  scrollBehavior: ScrollPattern[];
  questionReadTime: number;
  hesitationMarkers: HesitationEvent[];
}

export interface VisibilityEvent {
  timestamp: Date;
  visibility: 'visible' | 'hidden';
  duration: number;
}

export interface ScrollPattern {
  direction: 'up' | 'down';
  speed: number;
  timestamp: Date;
  position: number;
}

export interface HesitationEvent {
  questionId: string;
  hesitationType: 'pause_before_answer' | 'multiple_changes' | 'long_read_time';
  duration: number;
  confidence: number;
}

export interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  touchSupport: boolean;
  hardwareConcurrency: number;
  deviceMemory?: number;
  webglRenderer?: string;
  audioFingerprint?: string;
}

export interface NetworkMetadata {
  ipAddress: string;
  connectionType: string;
  effectiveType: '2g' | '3g' | '4g' | '5g';
  downlink: number;
  rtt: number; // Round trip time
  vpnDetected: boolean;
  proxyDetected: boolean;
  torDetected: boolean;
}

export interface UserFraudContext {
  userType: 'first_time' | 'returning' | 'frequent';
  riskProfile: UserRiskProfile;
  historicalBehavior: HistoricalBehavior;
  demographicRisk: DemographicRisk;
  sessionContext: SessionContext;
}

export interface UserRiskProfile {
  previousFraudAttempts: number;
  suspiciousActivityHistory: SuspiciousActivity[];
  accountAge: number; // days
  verificationLevel: 'unverified' | 'basic' | 'enhanced' | 'clinical';
  trustScore: number; // 0-100
}

export interface SuspiciousActivity {
  date: Date;
  type: 'response_inconsistency' | 'behavioral_anomaly' | 'technical_manipulation' | 'pattern_abuse';
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

export interface HistoricalBehavior {
  averageSessionDuration: number;
  typicalResponseTimes: ResponseTimeProfile;
  completionPatterns: CompletionPattern[];
  deviceUsagePattern: DeviceUsagePattern;
  timeOfDayPattern: TimePattern[];
}

export interface ResponseTimeProfile {
  mean: number;
  standardDeviation: number;
  distribution: 'normal' | 'bimodal' | 'skewed' | 'irregular';
  outlierThreshold: number;
}

export interface CompletionPattern {
  questionnairType: string;
  completionRate: number;
  averageDropoffPoint: number;
  seasonality: string[];
}

export interface DeviceUsagePattern {
  primaryDevice: 'mobile' | 'tablet' | 'desktop';
  deviceConsistency: number; // 0-1
  locationConsistency: number; // 0-1
  networkConsistency: number; // 0-1
}

export interface TimePattern {
  hour: number;
  dayOfWeek: number;
  frequency: number;
  consistency: number;
}

export interface DemographicRisk {
  ageGroupRisk: number; // 0-1
  geographicRisk: number; // 0-1
  socioeconomicRisk: number; // 0-1
  healthLiteracyRisk: number; // 0-1
}

export interface SessionContext {
  sessionId: string;
  startTime: Date;
  referralSource: string;
  motivationLevel: 'high' | 'medium' | 'low';
  urgency: 'emergency' | 'urgent' | 'routine';
  privacyMode: boolean;
}

export interface PathwayFraudContext {
  pathwayType: 'onboarding' | 'periodic' | 'emergency' | 'clinical';
  questionnairMode: 'enhanced' | 'clinical' | 'hybrid';
  expectedDuration: number; // minutes
  criticalQuestions: string[];
  validationPairs: ValidationPair[];
  clinicalRigor: 'screening' | 'assessment' | 'diagnostic';
}

export interface ValidationPair {
  questionA: string;
  questionB: string;
  expectedConsistency: number; // 0-1
  toleranceLevel: number;
  clinicalImportance: 'low' | 'medium' | 'high' | 'critical';
}

export interface ContextualFraudAnalysis {
  overallRiskScore: number; // 0-100
  confidence: number; // 0-1
  riskFactors: ContextualRiskFactor[];
  recommendation: FraudRecommendation;
  adaptedThresholds: AdaptedThresholds;
  interventions: FraudIntervention[];
  monitoring: ContinuousMonitoring;
}

export interface ContextualRiskFactor {
  factor: string;
  category: 'behavioral' | 'technical' | 'contextual' | 'clinical' | 'temporal';
  severity: number; // 0-1
  contextualWeight: number; // Adjusted based on context
  evidence: Evidence[];
  falsePositiveRate: number;
}

export interface Evidence {
  type: 'statistical' | 'pattern' | 'anomaly' | 'inconsistency';
  description: string;
  strength: number; // 0-1
  corroboration: string[];
}

export interface FraudRecommendation {
  action: 'accept' | 'flag' | 'escalate' | 'terminate' | 'adaptive_response';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string[];
  additionalVerification: VerificationStep[];
  humanReviewRequired: boolean;
}

export interface VerificationStep {
  type: 'additional_questions' | 'identity_verification' | 'clinical_review' | 'behavioral_challenge';
  description: string;
  expectedDuration: number; // minutes
  automatable: boolean;
}

export interface AdaptedThresholds {
  responseTimeThreshold: number;
  inconsistencyThreshold: number;
  behavioralAnomalyThreshold: number;
  attentionThreshold: number;
  reasoningAdjustments: ThresholdAdjustment[];
}

export interface ThresholdAdjustment {
  factor: string;
  originalThreshold: number;
  adjustedThreshold: number;
  adjustmentReason: string;
  contextualJustification: string;
}

export interface FraudIntervention {
  type: 'immediate' | 'progressive' | 'post_assessment';
  action: InterventionAction;
  trigger: InterventionTrigger;
  impact: InterventionImpact;
}

export interface InterventionAction {
  method: 'additional_validation' | 'pathway_modification' | 'enhanced_monitoring' | 'human_oversight';
  description: string;
  implementation: string;
  reversible: boolean;
}

export interface InterventionTrigger {
  condition: string;
  threshold: number;
  persistence: boolean;
  cooldownPeriod: number; // minutes
}

export interface InterventionImpact {
  userExperience: 'minimal' | 'moderate' | 'significant';
  clinicalAccuracy: 'improved' | 'maintained' | 'degraded';
  completionRate: 'improved' | 'maintained' | 'reduced';
  falsePositiveReduction: number; // 0-1
}

export interface ContinuousMonitoring {
  enabled: boolean;
  frequency: 'per_question' | 'per_section' | 'continuous';
  adaptiveSensitivity: boolean;
  learningEnabled: boolean;
  feedbackLoop: FeedbackLoop;
}

export interface FeedbackLoop {
  mechanism: 'supervised' | 'semi_supervised' | 'unsupervised';
  updateFrequency: 'realtime' | 'daily' | 'weekly';
  validationRequired: boolean;
  rollbackCapability: boolean;
}

// Enhanced Contextual Fraud Detector Implementation
export class EnhancedContextualFraudDetector implements ContextualFraudDetector {
  private behavioralAnalyzer: BehavioralPatternAnalyzer;
  private technicalAnalyzer: TechnicalFingerprintAnalyzer;
  private contextualAnalyzer: ContextualRiskAnalyzer;
  private adaptiveThresholder: AdaptiveThresholdManager;
  private interventionEngine: InterventionEngine;

  constructor() {
    this.behavioralAnalyzer = new BehavioralPatternAnalyzer();
    this.technicalAnalyzer = new TechnicalFingerprintAnalyzer();
    this.contextualAnalyzer = new ContextualRiskAnalyzer();
    this.adaptiveThresholder = new AdaptiveThresholdManager();
    this.interventionEngine = new InterventionEngine();
  }

  public async analyzeWithContext(
    responses: QuestionnaireResponse[],
    userContext: UserFraudContext,
    pathwayContext: PathwayFraudContext
  ): Promise<ContextualFraudAnalysis> {
    // Phase 1: Individual Analysis Components
    const behavioralAnalysis = await this.behavioralAnalyzer.analyze(responses, userContext, pathwayContext);
    const technicalAnalysis = await this.technicalAnalyzer.analyze(responses, userContext);
    const contextualAnalysis = await this.contextualAnalyzer.analyze(userContext, pathwayContext);

    // Phase 2: Adaptive Threshold Calculation
    const adaptedThresholds = await this.adaptiveThresholder.calculateThresholds(
      userContext,
      pathwayContext,
      [behavioralAnalysis, technicalAnalysis, contextualAnalysis]
    );

    // Phase 3: Contextual Risk Aggregation
    const aggregatedRisk = await this.aggregateContextualRisk(
      [behavioralAnalysis, technicalAnalysis, contextualAnalysis],
      adaptedThresholds,
      pathwayContext
    );

    // Phase 4: Recommendation Generation
    const recommendation = await this.generateContextualRecommendation(
      aggregatedRisk,
      userContext,
      pathwayContext
    );

    // Phase 5: Intervention Planning
    const interventions = await this.interventionEngine.planInterventions(
      aggregatedRisk,
      recommendation,
      pathwayContext
    );

    // Phase 6: Continuous Monitoring Setup
    const monitoring = this.setupContinuousMonitoring(
      userContext,
      pathwayContext,
      aggregatedRisk.overallRiskScore
    );

    return {
      overallRiskScore: aggregatedRisk.overallRiskScore,
      confidence: aggregatedRisk.confidence,
      riskFactors: aggregatedRisk.riskFactors,
      recommendation,
      adaptedThresholds,
      interventions,
      monitoring
    };
  }

  private async aggregateContextualRisk(
    analyses: any[],
    thresholds: AdaptedThresholds,
    pathwayContext: PathwayFraudContext
  ): Promise<AggregatedRisk> {
    let overallRiskScore = 0;
    let confidence = 1.0;
    const riskFactors: ContextualRiskFactor[] = [];

    // Weight adjustments based on pathway context
    const weights = this.calculateContextualWeights(pathwayContext);

    for (const analysis of analyses) {
      const weightedScore = analysis.riskScore * (weights[analysis.type] || 0.1);
      overallRiskScore += weightedScore;
      confidence *= analysis.confidence;

      // Add contextually weighted risk factors
      for (const factor of analysis.riskFactors) {
        const contextualWeight = this.calculateContextualWeight(factor, pathwayContext);
        riskFactors.push({
          ...factor,
          contextualWeight,
          severity: factor.severity * contextualWeight
        });
      }
    }

    // Normalize risk score (0-100)
    overallRiskScore = Math.min(overallRiskScore, 100);

    // Apply pathway-specific adjustments
    overallRiskScore = this.applyPathwayAdjustments(overallRiskScore, pathwayContext);

    return {
      overallRiskScore,
      confidence,
      riskFactors: riskFactors.sort((a, b) => b.severity - a.severity)
    };
  }

  private calculateContextualWeights(pathwayContext: PathwayFraudContext): Record<string, number> {
    const baseWeights = {
      behavioral: 0.4,
      technical: 0.3,
      contextual: 0.3
    };

    // Adjust weights based on pathway type
    switch (pathwayContext.pathwayType) {
      case 'onboarding':
        // Higher emphasis on technical fraud for new users
        return {
          behavioral: 0.3,
          technical: 0.5,
          contextual: 0.2
        };
      case 'clinical':
        // Higher emphasis on behavioral consistency for clinical assessments
        return {
          behavioral: 0.6,
          technical: 0.2,
          contextual: 0.2
        };
      case 'emergency':
        // Balanced but with reduced technical emphasis (urgency matters)
        return {
          behavioral: 0.4,
          technical: 0.2,
          contextual: 0.4
        };
      default:
        return baseWeights;
    }
  }

  private calculateContextualWeight(factor: any, pathwayContext: PathwayFraudContext): number {
    let weight = 1.0;

    // Adjust based on questionnaire mode
    if (pathwayContext.questionnairMode === 'clinical') {
      if (factor.category === 'clinical') {
        weight *= 1.5; // Clinical inconsistencies more important in clinical mode
      }
    } else if (pathwayContext.questionnairMode === 'enhanced') {
      if (factor.category === 'behavioral') {
        weight *= 1.3; // Behavioral patterns more relevant in enhanced mode
      }
    }

    // Adjust based on clinical rigor
    if (pathwayContext.clinicalRigor === 'diagnostic') {
      if (factor.category === 'clinical' || factor.category === 'contextual') {
        weight *= 1.4;
      }
    }

    // Consider false positive rates
    const falsePositiveAdjustment = 1.0 - (factor.falsePositiveRate * 0.5);
    weight *= falsePositiveAdjustment;

    return Math.max(weight, 0.1); // Minimum weight of 0.1
  }

  private applyPathwayAdjustments(riskScore: number, pathwayContext: PathwayFraudContext): number {
    let adjustedScore = riskScore;

    // Emergency pathway adjustment - be more lenient due to urgency
    if (pathwayContext.pathwayType === 'emergency') {
      adjustedScore *= 0.8;
    }

    // First-time onboarding - be more vigilant
    if (pathwayContext.pathwayType === 'onboarding') {
      adjustedScore *= 1.1;
    }

    // Clinical pathway - balance vigilance with clinical necessity
    if (pathwayContext.pathwayType === 'clinical') {
      adjustedScore *= 1.05;
    }

    return Math.min(adjustedScore, 100);
  }

  private async generateContextualRecommendation(
    aggregatedRisk: AggregatedRisk,
    userContext: UserFraudContext,
    pathwayContext: PathwayFraudContext
  ): Promise<FraudRecommendation> {
    const { overallRiskScore, confidence, riskFactors } = aggregatedRisk;

    // Base recommendation logic
    let action: string = 'accept';
    let urgency: string = 'low';
    const reasoning: string[] = [];
    const additionalVerification: VerificationStep[] = [];
    let humanReviewRequired = false;

    // Contextual decision making
    if (overallRiskScore >= 80) {
      action = 'terminate';
      urgency = 'critical';
      humanReviewRequired = true;
      reasoning.push('Score de risco crítico detectado');
    } else if (overallRiskScore >= 60) {
      action = 'escalate';
      urgency = 'high';
      humanReviewRequired = true;
      reasoning.push('Score de risco alto requer revisão humana');
    } else if (overallRiskScore >= 40) {
      action = 'flag';
      urgency = 'medium';
      reasoning.push('Score de risco moderado detectado');
      
      // Add contextual verification
      additionalVerification.push({
        type: 'additional_questions',
        description: 'Perguntas de validação adicional',
        expectedDuration: 2,
        automatable: true
      });
    } else if (overallRiskScore >= 25) {
      action = 'adaptive_response';
      urgency = 'low';
      reasoning.push('Score de risco baixo, monitoramento adaptativo');
    }

    // Pathway-specific adjustments
    if (pathwayContext.pathwayType === 'emergency') {
      if (action === 'terminate' || action === 'escalate') {
        action = 'flag'; // Don't block emergency assessments
        reasoning.push('Avaliação de emergência - reduzindo severidade da ação');
      }
    }

    if (pathwayContext.pathwayType === 'clinical' && action === 'accept') {
      // Always add some verification for clinical pathways
      additionalVerification.push({
        type: 'clinical_review',
        description: 'Revisão automática de consistência clínica',
        expectedDuration: 1,
        automatable: true
      });
    }

    // Consider user context
    if (userContext.userType === 'first_time' && action === 'flag') {
      reasoning.push('Usuário novo - padrões ainda sendo estabelecidos');
    }

    if (userContext.riskProfile.trustScore > 80 && action === 'escalate') {
      action = 'flag'; // Reduce severity for trusted users
      reasoning.push('Usuário com alto score de confiança');
    }

    return {
      action: action as any,
      urgency: urgency as any,
      reasoning,
      additionalVerification,
      humanReviewRequired
    };
  }

  private setupContinuousMonitoring(
    userContext: UserFraudContext,
    pathwayContext: PathwayFraudContext,
    riskScore: number
  ): ContinuousMonitoring {
    const enabled = riskScore > 20 || userContext.riskProfile.previousFraudAttempts > 0;
    
    let frequency: 'per_question' | 'per_section' | 'continuous' = 'per_section';
    if (riskScore > 60) {
      frequency = 'continuous';
    } else if (riskScore > 40) {
      frequency = 'per_question';
    }

    const adaptiveSensitivity = pathwayContext.pathwayType === 'clinical' || riskScore > 50;
    const learningEnabled = userContext.userType !== 'first_time';

    return {
      enabled,
      frequency,
      adaptiveSensitivity,
      learningEnabled,
      feedbackLoop: {
        mechanism: learningEnabled ? 'semi_supervised' : 'supervised',
        updateFrequency: 'daily',
        validationRequired: true,
        rollbackCapability: true
      }
    };
  }
}

// Supporting Classes
class BehavioralPatternAnalyzer {
  async analyze(
    responses: QuestionnaireResponse[],
    userContext: UserFraudContext,
    pathwayContext: PathwayFraudContext
  ): Promise<any> {
    const riskScore = this.calculateBehavioralRisk(responses, userContext);
    const confidence = this.calculateConfidence(responses);
    const riskFactors = this.identifyBehavioralRiskFactors(responses, userContext);

    return {
      type: 'behavioral',
      riskScore,
      confidence,
      riskFactors
    };
  }

  private calculateBehavioralRisk(responses: QuestionnaireResponse[], userContext: UserFraudContext): number {
    let risk = 0;

    // Response time analysis
    const responseTimes = responses.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    if (userContext.historicalBehavior?.averageSessionDuration) {
      const expectedTime = userContext.historicalBehavior.averageSessionDuration / responses.length;
      const timeDeviation = Math.abs(avgResponseTime - expectedTime) / expectedTime;
      if (timeDeviation > 0.5) {
        risk += 15 * Math.min(timeDeviation, 2);
      }
    }

    // Pattern consistency analysis
    const revisionCounts = responses.map(r => r.revisionCount);
    const highRevisionRate = revisionCounts.filter(count => count > 3).length / responses.length;
    if (highRevisionRate > 0.3) {
      risk += 20 * highRevisionRate;
    }

    // Attention pattern analysis
    let attentionRisk = 0;
    for (const response of responses) {
      if (response.metadata.attentionMetrics) {
        const { questionReadTime, hesitationMarkers } = response.metadata.attentionMetrics;
        if (questionReadTime < 1000) { // Less than 1 second
          attentionRisk += 5;
        }
        if (hesitationMarkers.length > 2) {
          attentionRisk += 3;
        }
      }
    }
    risk += Math.min(attentionRisk, 25);

    return Math.min(risk, 100);
  }

  private calculateConfidence(responses: QuestionnaireResponse[]): number {
    const sampleSize = responses.length;
    const baseConfidence = Math.min(sampleSize / 20, 1); // Full confidence at 20+ responses
    
    const metadataCompleteness = responses.filter(r => 
      r.metadata.mouseMovements || r.metadata.keystrokeDynamics || r.metadata.attentionMetrics
    ).length / responses.length;

    return baseConfidence * (0.7 + 0.3 * metadataCompleteness);
  }

  private identifyBehavioralRiskFactors(
    responses: QuestionnaireResponse[],
    userContext: UserFraudContext
  ): any[] {
    const factors = [];

    // Quick completion pattern
    const avgTime = responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length;
    if (avgTime < 2000) { // Less than 2 seconds average
      factors.push({
        factor: 'rapid_completion_pattern',
        category: 'behavioral',
        severity: 0.7,
        evidence: [{
          type: 'statistical',
          description: `Tempo médio de resposta muito baixo: ${avgTime}ms`,
          strength: 0.8,
          corroboration: ['response_times', 'attention_metrics']
        }],
        falsePositiveRate: 0.15
      });
    }

    return factors;
  }
}

class TechnicalFingerprintAnalyzer {
  async analyze(responses: QuestionnaireResponse[], userContext: UserFraudContext): Promise<any> {
    const riskScore = this.calculateTechnicalRisk(responses, userContext);
    const confidence = 0.9; // Technical analysis typically high confidence
    const riskFactors = this.identifyTechnicalRiskFactors(responses);

    return {
      type: 'technical',
      riskScore,
      confidence,
      riskFactors
    };
  }

  private calculateTechnicalRisk(responses: QuestionnaireResponse[], userContext: UserFraudContext): number {
    let risk = 0;

    // Device fingerprint analysis
    const devices = new Set();
    for (const response of responses) {
      if (response.metadata.deviceFingerprint) {
        const fingerprint = this.generateFingerprint(response.metadata.deviceFingerprint);
        devices.add(fingerprint);
      }
    }

    if (devices.size > 1) {
      risk += 30; // Multiple devices in single session
    }

    // Network analysis
    const networkRisks = this.analyzeNetworkPatterns(responses);
    risk += networkRisks;

    return Math.min(risk, 100);
  }

  private generateFingerprint(device: DeviceFingerprint): string {
    return `${device.userAgent}_${device.screenResolution}_${device.timezone}_${device.language}`;
  }

  private analyzeNetworkPatterns(responses: QuestionnaireResponse[]): number {
    let risk = 0;

    for (const response of responses) {
      if (response.metadata.networkMetadata) {
        const network = response.metadata.networkMetadata;
        if (network.vpnDetected) risk += 15;
        if (network.proxyDetected) risk += 20;
        if (network.torDetected) risk += 40;
      }
    }

    return Math.min(risk, 60);
  }

  private identifyTechnicalRiskFactors(responses: QuestionnaireResponse[]): any[] {
    const factors = [];

    // Check for automation indicators
    const automationScore = this.detectAutomation(responses);
    if (automationScore > 0.3) {
      factors.push({
        factor: 'automation_detected',
        category: 'technical',
        severity: automationScore,
        evidence: [{
          type: 'pattern',
          description: 'Padrões consistentes com automação detectados',
          strength: automationScore,
          corroboration: ['mouse_movements', 'keystroke_dynamics', 'timing_patterns']
        }],
        falsePositiveRate: 0.1
      });
    }

    return factors;
  }

  private detectAutomation(responses: QuestionnaireResponse[]): number {
    let automationScore = 0;
    let indicators = 0;

    for (const response of responses) {
      // Perfect timing patterns
      if (response.responseTime % 1000 === 0) { // Exactly X seconds
        automationScore += 0.1;
        indicators++;
      }

      // Missing human behavioral data
      if (!response.metadata.mouseMovements && !response.metadata.keystrokeDynamics) {
        automationScore += 0.05;
        indicators++;
      }

      // Unnatural mouse patterns
      if (response.metadata.mouseMovements) {
        const movements = response.metadata.mouseMovements;
        if (movements.length > 0) {
          const straightLines = this.detectStraightLines(movements);
          if (straightLines > 0.8) {
            automationScore += 0.15;
            indicators++;
          }
        }
      }
    }

    return indicators > 0 ? automationScore / Math.sqrt(indicators) : 0;
  }

  private detectStraightLines(movements: MouseMovement[]): number {
    if (movements.length < 3) return 0;

    let straightLineRatio = 0;
    for (let i = 0; i < movements.length - 2; i++) {
      const current = movements[i];
      const next = movements[i + 1];
      const afterNext = movements[i + 2];
      
      if (!current || !next || !afterNext) continue;
      
      const deltaX1 = next.x - current.x;
      const deltaY1 = next.y - current.y;
      const deltaX2 = afterNext.x - next.x;
      const deltaY2 = afterNext.y - next.y;

      // Check if movements are collinear (straight line)
      const crossProduct = Math.abs(deltaX1 * deltaY2 - deltaY1 * deltaX2);
      if (crossProduct < 1) { // Very small cross product indicates straight line
        straightLineRatio += 1;
      }
    }

    return straightLineRatio / (movements.length - 2);
  }
}

class ContextualRiskAnalyzer {
  async analyze(userContext: UserFraudContext, pathwayContext: PathwayFraudContext): Promise<any> {
    const riskScore = this.calculateContextualRisk(userContext, pathwayContext);
    const confidence = 0.7; // Contextual analysis moderate confidence
    const riskFactors = this.identifyContextualRiskFactors(userContext, pathwayContext);

    return {
      type: 'contextual',
      riskScore,
      confidence,
      riskFactors
    };
  }

  private calculateContextualRisk(userContext: UserFraudContext, pathwayContext: PathwayFraudContext): number {
    let risk = 0;

    // User risk profile
    risk += userContext.riskProfile.previousFraudAttempts * 20;
    risk += (100 - userContext.riskProfile.trustScore) * 0.3;

    // Session context risks
    if (userContext.sessionContext.motivationLevel === 'low' && pathwayContext.pathwayType === 'onboarding') {
      risk += 15; // Low motivation for onboarding is suspicious
    }

    // Demographic risks
    const demoRisk = (
      userContext.demographicRisk.ageGroupRisk +
      userContext.demographicRisk.geographicRisk +
      userContext.demographicRisk.socioeconomicRisk
    ) / 3;
    risk += demoRisk * 20;

    return Math.min(risk, 100);
  }

  private identifyContextualRiskFactors(userContext: UserFraudContext, pathwayContext: PathwayFraudContext): any[] {
    const factors = [];

    if (userContext.riskProfile.previousFraudAttempts > 0) {
      factors.push({
        factor: 'fraud_history',
        category: 'contextual',
        severity: Math.min(userContext.riskProfile.previousFraudAttempts * 0.3, 1),
        evidence: [{
          type: 'statistical',
          description: `${userContext.riskProfile.previousFraudAttempts} tentativas de fraude anteriores`,
          strength: 0.9,
          corroboration: ['user_history', 'verification_records']
        }],
        falsePositiveRate: 0.05
      });
    }

    return factors;
  }
}

class AdaptiveThresholdManager {
  async calculateThresholds(
    userContext: UserFraudContext,
    pathwayContext: PathwayFraudContext,
    analyses: any[]
  ): Promise<AdaptedThresholds> {
    const base = this.getBaseThresholds();
    const adjustments: ThresholdAdjustment[] = [];

    // Adjust for pathway type
    if (pathwayContext.pathwayType === 'emergency') {
      base.responseTimeThreshold *= 1.5; // More lenient for emergency
      base.inconsistencyThreshold *= 1.3;
      adjustments.push({
        factor: 'emergency_pathway',
        originalThreshold: base.responseTimeThreshold / 1.5,
        adjustedThreshold: base.responseTimeThreshold,
        adjustmentReason: 'Emergency context requires more lenient thresholds',
        contextualJustification: 'User urgency may affect normal response patterns'
      });
    }

    // Adjust for user type
    if (userContext.userType === 'first_time') {
      base.behavioralAnomalyThreshold *= 1.4; // More lenient for new users
      adjustments.push({
        factor: 'first_time_user',
        originalThreshold: base.behavioralAnomalyThreshold / 1.4,
        adjustedThreshold: base.behavioralAnomalyThreshold,
        adjustmentReason: 'First-time users lack behavioral baseline',
        contextualJustification: 'No historical data available for comparison'
      });
    }

    // Adjust for clinical rigor
    if (pathwayContext.clinicalRigor === 'diagnostic') {
      base.inconsistencyThreshold *= 0.8; // More strict for diagnostic
      adjustments.push({
        factor: 'diagnostic_rigor',
        originalThreshold: base.inconsistencyThreshold / 0.8,
        adjustedThreshold: base.inconsistencyThreshold,
        adjustmentReason: 'Diagnostic assessments require higher consistency',
        contextualJustification: 'Clinical accuracy is paramount for diagnostic pathways'
      });
    }

    return {
      ...base,
      reasoningAdjustments: adjustments
    };
  }

  private getBaseThresholds(): AdaptedThresholds {
    return {
      responseTimeThreshold: 30000, // 30 seconds
      inconsistencyThreshold: 0.3,
      behavioralAnomalyThreshold: 0.4,
      attentionThreshold: 0.5,
      reasoningAdjustments: []
    };
  }
}

class InterventionEngine {
  async planInterventions(
    aggregatedRisk: AggregatedRisk,
    recommendation: FraudRecommendation,
    pathwayContext: PathwayFraudContext
  ): Promise<FraudIntervention[]> {
    const interventions: FraudIntervention[] = [];

    if (recommendation.action === 'flag' || recommendation.action === 'escalate') {
      interventions.push({
        type: 'progressive',
        action: {
          method: 'additional_validation',
          description: 'Adicionar perguntas de validação contextual',
          implementation: 'Insert validation questions at strategic points',
          reversible: true
        },
        trigger: {
          condition: 'risk_score_threshold',
          threshold: 40,
          persistence: false,
          cooldownPeriod: 10
        },
        impact: {
          userExperience: 'moderate',
          clinicalAccuracy: 'improved',
          completionRate: 'maintained',
          falsePositiveReduction: 0.3
        }
      });
    }

    if (aggregatedRisk.overallRiskScore > 60) {
      interventions.push({
        type: 'immediate',
        action: {
          method: 'enhanced_monitoring',
          description: 'Ativar monitoramento comportamental aprimorado',
          implementation: 'Increase data collection frequency and depth',
          reversible: true
        },
        trigger: {
          condition: 'high_risk_detected',
          threshold: 60,
          persistence: true,
          cooldownPeriod: 0
        },
        impact: {
          userExperience: 'minimal',
          clinicalAccuracy: 'improved',
          completionRate: 'maintained',
          falsePositiveReduction: 0.2
        }
      });
    }

    return interventions;
  }
}

// Supporting Interfaces
interface AggregatedRisk {
  overallRiskScore: number;
  confidence: number;
  riskFactors: ContextualRiskFactor[];
}