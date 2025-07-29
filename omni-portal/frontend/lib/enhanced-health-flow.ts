// Enhanced Health Flow Engine - Collective Intelligence Design
// Combines conversational AI + progressive screening + emotional intelligence + advanced risk detection

export interface EnhancedHealthQuestion {
  id: string;
  text: string;
  type: 'scale' | 'select' | 'boolean' | 'multiselect' | 'text' | 'number';
  domain: 'demographics' | 'mental_health' | 'physical_health' | 'lifestyle' | 'family_history' | 'validation';
  priority: 'critical' | 'high' | 'medium' | 'low';
  emotionalWeight: number; // 1-10, how emotionally sensitive this question is
  riskIndicator: boolean; // Whether this question can indicate risk
  supportiveMode: boolean; // Whether to show extra emotional support
  
  // Enhanced options with emotional intelligence
  options?: Array<{
    value: any;
    label: string;
    emoji?: string;
    emotionalImpact?: 'positive' | 'neutral' | 'negative' | 'concerning';
    riskLevel?: number; // 0-10
    followUpTrigger?: string[]; // IDs of questions to trigger based on this response
  }>;
  
  // Intelligent branching
  conditionalLogic?: {
    showIf?: Array<{ questionId: string; operator: '==' | '!=' | '>' | '<' | 'includes'; value: any }>;
    skipIf?: Array<{ questionId: string; operator: '==' | '!=' | '>' | '<' | 'includes'; value: any }>;
    prioritizeIf?: Array<{ questionId: string; operator: '==' | '!=' | '>' | '<' | 'includes'; value: any }>;
  };
  
  // Clinical validation
  clinicalMetadata?: {
    instrument?: 'PHQ-9' | 'PHQ-2' | 'GAD-7' | 'GAD-2' | 'WHO-5' | 'PEG' | 'NRS' | 'Custom';
    clinicalCode?: string; // ICD-10, SNOMED, etc.
    validationPair?: string; // For consistency checking
    riskThreshold?: number;
  };
}

export interface EmotionalContext {
  anxietyLevel: number; // 0-10
  trustLevel: number; // 0-100
  engagementLevel: number; // 0-100
  supportNeeded: boolean;
  riskFlags: string[];
  personalityProfile: {
    prefersClinical: boolean; // True = direct medical language, False = conversational
    needsReassurance: boolean;
    respondsBetterToVisuals: boolean;
    prefersQuickQuestions: boolean;
  };
}

export interface IntelligentRiskProfile {
  overall: number; // 0-100
  categories: {
    mental_health: number;
    physical_health: number;
    substance_abuse: number;
    chronic_disease: number;
    family_history: number;
    lifestyle: number;
  };
  criticalFlags: string[];
  moderateFlags: string[];
  hiddenPatterns: Array<{
    pattern: string;
    confidence: number; // 0-100
    recommendation: string;
  }>;
  interventionNeeded: boolean;
  urgencyLevel: 'immediate' | 'urgent' | 'moderate' | 'routine';
}

export class EnhancedHealthFlowEngine {
  private responses: Record<string, any> = {};
  private emotionalContext: EmotionalContext;
  private questionQueue: EnhancedHealthQuestion[] = [];
  private completedQuestions: Set<string> = new Set();
  private riskAnalyzer: IntelligentRiskAnalyzer;
  private conversationPersonality: ConversationPersonality;

  constructor() {
    this.emotionalContext = {
      anxietyLevel: 3,
      trustLevel: 80,
      engagementLevel: 70,
      supportNeeded: false,
      riskFlags: [],
      personalityProfile: {
        prefersClinical: false,
        needsReassurance: true,
        respondsBetterToVisuals: true,
        prefersQuickQuestions: false
      }
    };
    
    this.riskAnalyzer = new IntelligentRiskAnalyzer();
    this.conversationPersonality = new ConversationPersonality();
    this.initializeQuestionFlow();
  }

  private initializeQuestionFlow() {
    // Start with universal triage questions that adapt based on responses
    this.questionQueue = [
      {
        id: 'initial_wellbeing',
        text: 'Como você está se sentindo hoje em uma escala de 1 a 10?',
        type: 'scale',
        domain: 'demographics',
        priority: 'critical',
        emotionalWeight: 3,
        riskIndicator: true,
        supportiveMode: true,
        options: Array.from({length: 10}, (_, i) => ({
          value: i + 1,
          label: (i + 1).toString(),
          emoji: i <= 2 ? '😢' : i <= 4 ? '😔' : i <= 6 ? '😐' : i <= 8 ? '🙂' : '😊',
          emotionalImpact: i <= 3 ? 'concerning' : i <= 5 ? 'negative' : i <= 7 ? 'neutral' : 'positive',
          riskLevel: i <= 3 ? 8 : i <= 5 ? 5 : 2
        })),
        clinicalMetadata: {
          instrument: 'Custom',
          riskThreshold: 4
        }
      },
      {
        id: 'energy_level',
        text: 'Como está seu nível de energia ultimamente?',
        type: 'select',
        domain: 'physical_health',
        priority: 'high',
        emotionalWeight: 2,
        riskIndicator: true,
        supportiveMode: false,
        options: [
          { value: 'very_low', label: 'Muito baixo', emoji: '⚡️', emotionalImpact: 'concerning', riskLevel: 7 },
          { value: 'low', label: 'Baixo', emoji: '🔋', emotionalImpact: 'negative', riskLevel: 5 },
          { value: 'normal', label: 'Normal', emoji: '⚡️', emotionalImpact: 'neutral', riskLevel: 2 },
          { value: 'high', label: 'Alto', emoji: '⚡️⚡️', emotionalImpact: 'positive', riskLevel: 1 },
          { value: 'very_high', label: 'Muito alto', emoji: '⚡️⚡️⚡️', emotionalImpact: 'positive', riskLevel: 1 }
        ]
      },
      {
        id: 'sleep_quality',
        text: 'Como tem sido a qualidade do seu sono?',
        type: 'select',
        domain: 'lifestyle',
        priority: 'medium',
        emotionalWeight: 2,
        riskIndicator: true,
        supportiveMode: false,
        options: [
          { value: 'very_poor', label: 'Muito ruim', emoji: '😴', emotionalImpact: 'concerning', riskLevel: 6 },
          { value: 'poor', label: 'Ruim', emoji: '😪', emotionalImpact: 'negative', riskLevel: 4 },
          { value: 'fair', label: 'Regular', emoji: '😌', emotionalImpact: 'neutral', riskLevel: 2 },
          { value: 'good', label: 'Bom', emoji: '😊', emotionalImpact: 'positive', riskLevel: 1 },
          { value: 'excellent', label: 'Excelente', emoji: '✨', emotionalImpact: 'positive', riskLevel: 0 }
        ]
      }
    ];
  }

  public processResponse(questionId: string, response: any): EnhancedHealthQuestion | null {
    // Store response
    this.responses[questionId] = response;
    this.completedQuestions.add(questionId);

    // Update emotional context based on response
    this.updateEmotionalContext(questionId, response);

    // Analyze risk in real-time
    this.riskAnalyzer.updateRiskProfile(this.responses, questionId, response);

    // Determine next question using intelligent flow
    return this.getNextIntelligentQuestion();
  }

  private updateEmotionalContext(questionId: string, response: any) {
    const question = this.findQuestionById(questionId);
    if (!question) return;

    // Update anxiety level
    if (question.emotionalWeight >= 7) {
      this.emotionalContext.anxietyLevel = Math.min(this.emotionalContext.anxietyLevel + 1, 10);
    }

    // Update based on response emotional impact
    const option = question.options?.find(opt => opt.value === response);
    if (option) {
      switch (option.emotionalImpact) {
        case 'concerning':
          this.emotionalContext.anxietyLevel = Math.min(this.emotionalContext.anxietyLevel + 2, 10);
          this.emotionalContext.supportNeeded = true;
          break;
        case 'negative':
          this.emotionalContext.anxietyLevel = Math.min(this.emotionalContext.anxietyLevel + 1, 10);
          break;
        case 'positive':
          this.emotionalContext.engagementLevel = Math.min(this.emotionalContext.engagementLevel + 5, 100);
          this.emotionalContext.anxietyLevel = Math.max(this.emotionalContext.anxietyLevel - 1, 0);
          break;
      }
    }

    // Build trust through consistent interaction
    this.emotionalContext.trustLevel = Math.min(this.emotionalContext.trustLevel + 2, 100);
  }

  private getNextIntelligentQuestion(): EnhancedHealthQuestion | null {
    // Priority 1: Critical risk follow-ups
    const criticalFollowUp = this.getCriticalRiskFollowUp();
    if (criticalFollowUp) return criticalFollowUp;

    // Priority 2: Adaptive questions based on previous responses
    const adaptiveQuestion = this.getAdaptiveQuestion();
    if (adaptiveQuestion) return adaptiveQuestion;

    // Priority 3: Standard flow questions
    const nextStandardQuestion = this.getNextStandardQuestion();
    if (nextStandardQuestion) return nextStandardQuestion;

    // No more questions - complete
    return null;
  }

  private getCriticalRiskFollowUp(): EnhancedHealthQuestion | null {
    // Check for high-risk responses that need immediate follow-up
    if (this.responses.initial_wellbeing <= 3 && !this.completedQuestions.has('mental_health_crisis')) {
      return {
        id: 'mental_health_crisis',
        text: 'Você tem pensado em se machucar ou já teve pensamentos sobre não querer mais viver?',
        type: 'boolean',
        domain: 'mental_health',
        priority: 'critical',
        emotionalWeight: 10,
        riskIndicator: true,
        supportiveMode: true,
        clinicalMetadata: {
          instrument: 'PHQ-9',
          clinicalCode: 'R45.851',
          riskThreshold: 1
        }
      };
    }

    return null;
  }

  private getAdaptiveQuestion(): EnhancedHealthQuestion | null {
    // Mental health pathway
    if ((this.responses.initial_wellbeing <= 6 || this.responses.energy_level === 'very_low') 
        && !this.completedQuestions.has('phq2_interest')) {
      return {
        id: 'phq2_interest',
        text: 'Nas últimas 2 semanas, você teve pouco interesse ou prazer em fazer as coisas?',
        type: 'select',
        domain: 'mental_health',
        priority: 'high',
        emotionalWeight: 6,
        riskIndicator: true,
        supportiveMode: true,
        options: [
          { value: 0, label: 'Nunca', emoji: '✅', emotionalImpact: 'positive', riskLevel: 0 },
          { value: 1, label: 'Vários dias', emoji: '🤔', emotionalImpact: 'neutral', riskLevel: 3 },
          { value: 2, label: 'Mais da metade dos dias', emoji: '😔', emotionalImpact: 'negative', riskLevel: 6 },
          { value: 3, label: 'Quase todos os dias', emoji: '😢', emotionalImpact: 'concerning', riskLevel: 8 }
        ],
        clinicalMetadata: {
          instrument: 'PHQ-2',
          riskThreshold: 1
        }
      };
    }

    // Physical health pathway
    if (this.responses.energy_level === 'very_low' && !this.completedQuestions.has('pain_assessment')) {
      return {
        id: 'pain_assessment',
        text: 'Você tem sentido alguma dor física que interfere nas suas atividades?',
        type: 'boolean',
        domain: 'physical_health',
        priority: 'high',
        emotionalWeight: 4,
        riskIndicator: true,
        supportiveMode: false
      };
    }

    return null;
  }

  private getNextStandardQuestion(): EnhancedHealthQuestion | null {
    // Find next uncompeted question in queue
    return this.questionQueue.find(q => !this.completedQuestions.has(q.id)) || null;
  }

  private findQuestionById(id: string): EnhancedHealthQuestion | undefined {
    return this.questionQueue.find(q => q.id === id);
  }

  public getEmotionalContext(): EmotionalContext {
    return this.emotionalContext;
  }

  public getRiskProfile(): IntelligentRiskProfile {
    return this.riskAnalyzer.getCurrentRiskProfile();
  }

  public getConversationalResponse(questionId: string, response: any): string {
    return this.conversationPersonality.generateResponse(
      questionId, 
      response, 
      this.emotionalContext,
      this.riskAnalyzer.getCurrentRiskProfile()
    );
  }
}

class IntelligentRiskAnalyzer {
  private riskProfile: IntelligentRiskProfile;
  private patternDetectors: PatternDetector[];

  constructor() {
    this.riskProfile = {
      overall: 0,
      categories: {
        mental_health: 0,
        physical_health: 0,
        substance_abuse: 0,
        chronic_disease: 0,
        family_history: 0,
        lifestyle: 0
      },
      criticalFlags: [],
      moderateFlags: [],
      hiddenPatterns: [],
      interventionNeeded: false,
      urgencyLevel: 'routine'
    };

    this.patternDetectors = [
      new SuicideRiskDetector(),
      new SubstanceAbuseDetector(),
      new ChronicDiseaseDetector(),
      new MentalHealthDetector(),
      new LifestyleRiskDetector()
    ];
  }

  public updateRiskProfile(responses: Record<string, any>, lastQuestionId: string, lastResponse: any) {
    // Real-time risk calculation
    this.calculateCategoricalRisks(responses);
    
    // Pattern detection
    this.detectHiddenPatterns(responses);
    
    // Update flags
    this.updateRiskFlags(responses);
    
    // Calculate overall risk
    this.calculateOverallRisk();
    
    // Determine intervention needs
    this.determineInterventionNeeds();
  }

  private calculateCategoricalRisks(responses: Record<string, any>) {
    // Mental Health Risk Calculation
    let mentalHealthRisk = 0;
    
    if (responses.initial_wellbeing <= 4) mentalHealthRisk += 20;
    if (responses.phq2_interest >= 2) mentalHealthRisk += 30;
    if (responses.mental_health_crisis) mentalHealthRisk += 50;
    if (responses.sleep_quality === 'very_poor') mentalHealthRisk += 15;
    
    this.riskProfile.categories.mental_health = Math.min(mentalHealthRisk, 100);

    // Physical Health Risk Calculation
    let physicalRisk = 0;
    
    if (responses.energy_level === 'very_low') physicalRisk += 20;
    if (responses.pain_assessment) physicalRisk += 25;
    if (responses.sleep_quality === 'very_poor') physicalRisk += 15;
    
    this.riskProfile.categories.physical_health = Math.min(physicalRisk, 100);

    // Lifestyle Risk Calculation
    let lifestyleRisk = 0;
    
    if (responses.sleep_quality === 'very_poor' || responses.sleep_quality === 'poor') lifestyleRisk += 20;
    if (responses.exercise_frequency < 2) lifestyleRisk += 15;
    if (responses.alcohol_consumption > 14) lifestyleRisk += 25;
    
    this.riskProfile.categories.lifestyle = Math.min(lifestyleRisk, 100);
  }

  private detectHiddenPatterns(responses: Record<string, any>) {
    this.riskProfile.hiddenPatterns = [];

    // Pattern: Hidden depression indicators
    if (responses.energy_level === 'very_low' && 
        responses.sleep_quality === 'poor' && 
        responses.initial_wellbeing <= 5) {
      this.riskProfile.hiddenPatterns.push({
        pattern: 'hidden_depression_triad',
        confidence: 85,
        recommendation: 'Consider comprehensive mental health screening'
      });
    }

    // Pattern: Chronic fatigue syndrome indicators
    if (responses.energy_level === 'very_low' && 
        responses.sleep_quality === 'poor' && 
        responses.pain_assessment) {
      this.riskProfile.hiddenPatterns.push({
        pattern: 'chronic_fatigue_indicators',
        confidence: 70,
        recommendation: 'Evaluate for chronic fatigue syndrome or fibromyalgia'
      });
    }

    // Pattern: Anxiety masquerading as physical symptoms
    if (responses.energy_level === 'low' && 
        responses.initial_wellbeing <= 6 && 
        !responses.phq2_interest) {
      this.riskProfile.hiddenPatterns.push({
        pattern: 'somatic_anxiety_presentation',
        confidence: 60,
        recommendation: 'Consider anxiety screening despite normal depression screening'
      });
    }
  }

  private updateRiskFlags(responses: Record<string, any>) {
    this.riskProfile.criticalFlags = [];
    this.riskProfile.moderateFlags = [];

    // Critical flags
    if (responses.mental_health_crisis) {
      this.riskProfile.criticalFlags.push('suicide_risk');
    }

    // Moderate flags
    if (responses.initial_wellbeing <= 3) {
      this.riskProfile.moderateFlags.push('severe_distress');
    }
    
    if (responses.phq2_interest >= 2) {
      this.riskProfile.moderateFlags.push('depression_screening_positive');
    }
  }

  private calculateOverallRisk() {
    const categoryScores = Object.values(this.riskProfile.categories);
    const averageRisk = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
    
    // Weight critical flags heavily
    let riskMultiplier = 1;
    if (this.riskProfile.criticalFlags.length > 0) riskMultiplier = 2;
    else if (this.riskProfile.moderateFlags.length > 2) riskMultiplier = 1.5;
    
    this.riskProfile.overall = Math.min(averageRisk * riskMultiplier, 100);
  }

  private determineInterventionNeeds() {
    if (this.riskProfile.criticalFlags.length > 0) {
      this.riskProfile.interventionNeeded = true;
      this.riskProfile.urgencyLevel = 'immediate';
    } else if (this.riskProfile.overall >= 70) {
      this.riskProfile.interventionNeeded = true;
      this.riskProfile.urgencyLevel = 'urgent';
    } else if (this.riskProfile.overall >= 40) {
      this.riskProfile.interventionNeeded = true;
      this.riskProfile.urgencyLevel = 'moderate';
    } else {
      this.riskProfile.interventionNeeded = false;
      this.riskProfile.urgencyLevel = 'routine';
    }
  }

  public getCurrentRiskProfile(): IntelligentRiskProfile {
    return this.riskProfile;
  }
}

class ConversationPersonality {
  public generateResponse(
    questionId: string, 
    response: any, 
    emotionalContext: EmotionalContext,
    riskProfile: IntelligentRiskProfile
  ): string {
    const supportive = emotionalContext.supportNeeded;
    const highRisk = riskProfile.overall >= 50;

    // Customize response based on emotional context
    if (questionId === 'initial_wellbeing') {
      if (response >= 8) {
        return supportive 
          ? "Que maravilha saber que você está se sentindo tão bem! 😊 Isso me deixa muito feliz. Vamos continuar para garantir que tudo está indo bem."
          : "Ótimo! É maravilhoso que você esteja se sentindo bem. Vamos continuar.";
      } else if (response >= 5) {
        return supportive
          ? "Entendo, um dia comum. Obrigada por ser honesta comigo! 🤗 Vamos ver como posso ajudar você a se sentir ainda melhor."
          : "Obrigada por compartilhar. Vamos continuar explorando como você está.";
      } else {
        return "Sinto muito que você não esteja se sentindo bem hoje. 💙 Quero que saiba que suas respostas vão me ajudar a entender melhor como posso apoiá-la. Você não está sozinha nessa.";
      }
    }

    if (questionId === 'mental_health_crisis') {
      if (response) {
        return "Obrigada por confiar em mim com essa informação tão importante. 💙 Sua coragem em compartilhar isso mostra muita força. Vou garantir que você receba o apoio que merece. Lembre-se: você não está sozinha e existe ajuda disponível.";
      } else {
        return supportive
          ? "Que alívio saber disso! 😌 Obrigada por responder com sinceridade. Vamos continuar."
          : "Obrigada pela resposta. Vamos continuar.";
      }
    }

    // Default responses based on emotional context
    if (highRisk && supportive) {
      return "Obrigada por compartilhar. Suas respostas são muito importantes e vão me ajudar a conectar você com os recursos certos. 💙";
    } else if (supportive) {
      return "Obrigada! 🤗 Vamos para a próxima pergunta.";
    } else {
      return "Entendido. Próxima pergunta.";
    }
  }
}

// Pattern detector interfaces (simplified for this example)
abstract class PatternDetector {
  abstract detect(responses: Record<string, any>): boolean;
  abstract getPattern(): string;
  abstract getConfidence(): number;
}

class SuicideRiskDetector extends PatternDetector {
  detect(responses: Record<string, any>): boolean {
    return responses.mental_health_crisis === true || 
           (responses.initial_wellbeing <= 2 && responses.phq2_interest >= 2);
  }
  
  getPattern(): string {
    return 'suicide_risk';
  }
  
  getConfidence(): number {
    return 95;
  }
}

class SubstanceAbuseDetector extends PatternDetector {
  detect(responses: Record<string, any>): boolean {
    return responses.alcohol_consumption > 21 || responses.substance_use === true;
  }
  
  getPattern(): string {
    return 'substance_abuse_risk';
  }
  
  getConfidence(): number {
    return 80;
  }
}

class ChronicDiseaseDetector extends PatternDetector {
  detect(responses: Record<string, any>): boolean {
    const chronicIndicators = [
      responses.energy_level === 'very_low',
      responses.pain_assessment === true,
      responses.sleep_quality === 'very_poor'
    ].filter(Boolean).length;
    
    return chronicIndicators >= 2;
  }
  
  getPattern(): string {
    return 'chronic_disease_indicators';
  }
  
  getConfidence(): number {
    return 65;
  }
}

class MentalHealthDetector extends PatternDetector {
  detect(responses: Record<string, any>): boolean {
    return responses.phq2_interest >= 1 || responses.initial_wellbeing <= 4;
  }
  
  getPattern(): string {
    return 'mental_health_concern';
  }
  
  getConfidence(): number {
    return 75;
  }
}

class LifestyleRiskDetector extends PatternDetector {
  detect(responses: Record<string, any>): boolean {
    const riskFactors = [
      responses.exercise_frequency < 2,
      responses.sleep_quality === 'poor' || responses.sleep_quality === 'very_poor',
      responses.alcohol_consumption > 14,
      responses.smoking_status === 'current'
    ].filter(Boolean).length;
    
    return riskFactors >= 2;
  }
  
  getPattern(): string {
    return 'lifestyle_risk_cluster';
  }
  
  getConfidence(): number {
    return 70;
  }
}