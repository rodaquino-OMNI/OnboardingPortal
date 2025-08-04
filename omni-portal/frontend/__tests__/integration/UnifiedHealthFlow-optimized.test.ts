import { UnifiedHealthFlow, FlowResult, HealthAssessmentResults } from '@/lib/unified-health-flow';

// Test data builders for efficient test setup
class FlowTestBuilder {
  private flow: UnifiedHealthFlow;
  private responses: Record<string, any> = {};

  constructor() {
    this.flow = new UnifiedHealthFlow();
  }

  withBasicDemographics(age = 30, sex = 'male') {
    this.responses.age = age;
    this.responses.biological_sex = sex;
    return this;
  }

  withEmergencyCheck(conditions: string[] = ['none']) {
    this.responses.emergency_check = conditions;
    return this;
  }

  withPainLevel(level = 0) {
    this.responses.pain_severity = level;
    return this;
  }

  withMoodLevel(level = 0) {
    this.responses.mood_interest = level;
    return this;
  }

  withChronicConditions(hasConditions = false) {
    this.responses.chronic_conditions_flag = hasConditions;
    return this;
  }

  async buildToTriageCompletion(): Promise<{ flow: UnifiedHealthFlow; result: FlowResult }> {
    let result = await this.flow.processResponse('_init', true);
    
    // Apply all responses in batch
    for (const [key, value] of Object.entries(this.responses)) {
      result = await this.flow.processResponse(key, value);
    }
    
    return { flow: this.flow, result };
  }

  async buildToCompletion(): Promise<{ flow: UnifiedHealthFlow; result: FlowResult }> {
    const { flow, result: triageResult } = await this.buildToTriageCompletion();
    
    // Fast-forward through remaining domains with default responses
    let currentResult = triageResult;
    while (currentResult.type !== 'complete') {
      if (currentResult.type === 'question') {
        currentResult = await this.flow.processResponse(currentResult.question!.id, this.getDefaultResponse(currentResult.question!));
      } else {
        currentResult = await this.flow.processResponse('_continue', true);
      }
    }
    
    return { flow, result: currentResult };
  }

  private getDefaultResponse(question: any): any {
    switch (question.type) {
      case 'boolean': return false;
      case 'scale': return 0;
      case 'number': return 25;
      case 'select': return question.options?.[0]?.value || 'test';
      case 'multiselect': return ['none'];
      case 'text': return 'test response';
      default: return null;
    }
  }
}

// Shared fixtures for common scenarios
const createHealthyProfile = () => new FlowTestBuilder()
  .withBasicDemographics(30, 'male')
  .withEmergencyCheck(['none'])
  .withPainLevel(0)
  .withMoodLevel(0)
  .withChronicConditions(false);

const createHighRiskProfile = () => new FlowTestBuilder()
  .withBasicDemographics(65, 'male')
  .withEmergencyCheck(['none'])
  .withPainLevel(8)
  .withMoodLevel(3)
  .withChronicConditions(true);

const createEmergencyProfile = () => new FlowTestBuilder()
  .withBasicDemographics(45, 'female')
  .withEmergencyCheck(['chest_pain', 'breathing_difficulty'])
  .withPainLevel(8)
  .withMoodLevel(2)
  .withChronicConditions(true);

describe('UnifiedHealthFlow Optimized Integration Tests', () => {
  describe('Complete Flow Scenarios', () => {
    test.concurrent('should complete minimal healthy user flow quickly', async () => {
      const { result } = await createHealthyProfile().buildToTriageCompletion();
      
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
      expect(result.progress).toBeGreaterThan(0);
    });

    test.concurrent('should trigger emergency flow for critical conditions', async () => {
      const { flow, result } = await createEmergencyProfile().buildToTriageCompletion();
      
      const responses = flow.getResponses();
      expect(responses.emergency_check).toContain('chest_pain');
      expect(result.type).toBe('question');
    });

    test.concurrent('should adapt flow based on pain severity', async () => {
      const { result } = await new FlowTestBuilder()
        .withBasicDemographics(35, 'male')
        .withEmergencyCheck(['none'])
        .withPainLevel(7)
        .withMoodLevel(1)
        .withChronicConditions(false)
        .buildToTriageCompletion();
      
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('pain_management');
    });

    test.concurrent('should handle mental health pathway', async () => {
      const { result } = await new FlowTestBuilder()
        .withBasicDemographics(28, 'female')
        .withEmergencyCheck(['none'])
        .withPainLevel(2)
        .withMoodLevel(3)
        .withChronicConditions(false)
        .buildToTriageCompletion();
      
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    test.concurrent('should handle chronic disease pathway', async () => {
      const { result } = await new FlowTestBuilder()
        .withBasicDemographics(55, 'male')
        .withEmergencyCheck(['none'])
        .withPainLevel(3)
        .withMoodLevel(0)
        .withChronicConditions(true)
        .buildToTriageCompletion();
      
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('chronic_disease');
    });
  });

  describe('Progressive Disclosure', () => {
    test.concurrent('should skip irrelevant domains for young healthy users', async () => {
      const { result } = await new FlowTestBuilder()
        .withBasicDemographics(20, 'male')
        .withEmergencyCheck(['none'])
        .withPainLevel(0)
        .withMoodLevel(0)
        .withChronicConditions(false)
        .buildToTriageCompletion();
      
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });

    test.concurrent('should include family history for older users', async () => {
      const flow = new UnifiedHealthFlow();
      
      // Fast-forward through triage
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 40);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      let result = await flow.processResponse('chronic_conditions_flag', false);
      
      // Should eventually encounter family history domain
      const domainIds: string[] = [];
      while (result.type !== 'complete' && domainIds.length < 10) {
        if (result.type === 'domain_transition') {
          domainIds.push(result.domain!.id);
        }
        result = await flow.processResponse('_continue', true);
      }
      
      expect(domainIds).toContain('family_history');
    });
  });

  describe('Risk Scoring', () => {
    test.concurrent('should calculate risk scores correctly for high-risk users', async () => {
      const { result } = await createHighRiskProfile().buildToCompletion();
      
      expect(result.type).toBe('complete');
      expect(result.results?.riskLevel).toBe('high');
      expect(result.results?.totalRiskScore).toBeGreaterThan(15);
    });

    test.concurrent('should calculate low risk for healthy users', async () => {
      const { result } = await createHealthyProfile().buildToCompletion();
      
      expect(result.type).toBe('complete');
      expect(result.results?.riskLevel).toBe('low');
      expect(result.results?.totalRiskScore).toBeLessThan(10);
    });
  });

  describe('Conditional Questions', () => {
    test.concurrent('should show conditional questions when criteria met', async () => {
      const flow = new UnifiedHealthFlow();
      
      // Setup to chronic disease domain quickly
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 50);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 2);
      await flow.processResponse('mood_interest', 0);
      await flow.processResponse('chronic_conditions_flag', true);
      
      // Navigate to chronic disease questions
      await flow.processResponse('_continue', true);
      await flow.processResponse('chronic_conditions', ['diabetes']);
      
      // Say yes to medications
      const result = await flow.processResponse('current_medications', true);
      
      // Should show medication list question (conditional)
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('medication_list');
    });

    test.concurrent('should skip conditional questions when criteria not met', async () => {
      const flow = new UnifiedHealthFlow();
      
      // Fast setup
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 50);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 2);
      await flow.processResponse('mood_interest', 0);
      await flow.processResponse('chronic_conditions_flag', true);
      
      await flow.processResponse('_continue', true);
      await flow.processResponse('chronic_conditions', ['diabetes']);
      
      // Say no to medications
      const result = await flow.processResponse('current_medications', false);
      
      // Should skip medication list and go to next question
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('hospitalizations');
    });
  });

  describe('Fraud Detection', () => {
    test.concurrent('should detect inconsistent responses for age/conditions', async () => {
      const { result } = await new FlowTestBuilder()
        .withBasicDemographics(20, 'male')
        .withEmergencyCheck(['none'])
        .withPainLevel(0)
        .withMoodLevel(0)
        .withChronicConditions(true)
        .buildToCompletion();
      
      // Young age with many chronic conditions should trigger fraud detection
      expect(result.results?.fraudDetectionScore).toBeGreaterThan(0);
    });

    test.concurrent('should detect validation pair mismatches', async () => {
      const flow = new UnifiedHealthFlow();
      
      // Basic flow setup
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 35);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      await flow.processResponse('chronic_conditions_flag', false);
      
      // Navigate to lifestyle
      await flow.processResponse('_continue', true);
      await flow.processResponse('exercise_frequency', 3);
      
      // Say never smoked
      let result = await flow.processResponse('smoking_status', 'never');
      
      // Force inconsistent response if smoking_advice appears
      if (result.question?.id === 'smoking_advice') {
        result = await flow.processResponse('smoking_advice', true);
      }
      
      // Complete remaining flow quickly
      while (result.type !== 'complete') {
        if (result.type === 'question') {
          result = await flow.processResponse(result.question?.id || '', 'test');
        } else {
          result = await flow.processResponse('_continue', true);
        }
      }
      
      // Should detect fraud from validation pair mismatch
      expect(result.results?.fraudDetectionScore).toBeGreaterThan(20);
    });
  });

  describe('Progress and Time Tracking', () => {
    test.concurrent('should track progress accurately', async () => {
      const flow = new UnifiedHealthFlow();
      let result = await flow.processResponse('_init', true);
      const progressValues: number[] = [result.progress];
      
      // Track progress through first few steps only
      for (let i = 0; i < 5 && result.type !== 'complete'; i++) {
        if (result.type === 'question') {
          result = await flow.processResponse(result.question?.id || '', false);
        } else {
          result = await flow.processResponse('_continue', true);
        }
        progressValues.push(result.progress);
      }
      
      // Progress should increase
      expect(progressValues[progressValues.length - 1]).toBeGreaterThanOrEqual(progressValues[0] || 0);
    });

    test.concurrent('should estimate remaining time correctly', async () => {
      const { result } = await createHealthyProfile().buildToTriageCompletion();
      
      expect(result.estimatedTimeRemaining).toBeGreaterThan(0);
      expect(typeof result.estimatedTimeRemaining).toBe('number');
    });
  });

  describe('Recommendations Generation', () => {
    test.concurrent('should generate appropriate recommendations for high-risk users', async () => {
      const flow = new UnifiedHealthFlow();
      
      // Create high-risk profile quickly
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 60);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 8);
      await flow.processResponse('mood_interest', 3);
      let result = await flow.processResponse('chronic_conditions_flag', true);
      
      // Fast-forward to completion with high-risk answers
      while (result.type !== 'complete') {
        if (result.type === 'question') {
          let response;
          switch (result.question?.id) {
            case 'chronic_conditions':
              response = ['diabetes', 'heart_disease'];
              break;
            case 'exercise_frequency':
              response = 0;
              break;
            case 'smoking_status':
              response = 'current';
              break;
            default:
              response = result.question?.type === 'boolean' ? true : 
                        result.question?.type === 'scale' ? 7 :
                        result.question?.type === 'multiselect' ? ['diabetes'] : 'test';
          }
          result = await flow.processResponse(result.question?.id || '', response);
        } else {
          result = await flow.processResponse('_continue', true);
        }
      }
      
      // Should have multiple recommendations
      expect(result.results?.recommendations.length).toBeGreaterThan(0);
      expect(result.results?.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('dor')
        ])
      );
      
      // Should have urgent next steps
      expect(result.results?.nextSteps).toEqual(
        expect.arrayContaining([
          expect.stringContaining('prioritário')
        ])
      );
    });

    test.concurrent('should generate minimal recommendations for healthy users', async () => {
      const { result } = await createHealthyProfile().buildToCompletion();
      
      expect(result.results?.recommendations.length).toBe(0);
      expect(result.results?.nextSteps).toEqual(
        expect.arrayContaining([
          expect.stringContaining('bons hábitos')
        ])
      );
    });
  });

  describe('Flow State Management', () => {
    test.concurrent('should maintain correct domain and layer state', async () => {
      const { flow, result } = await createHealthyProfile().buildToTriageCompletion();
      
      expect(flow.getCurrentDomain()).toBe('Estilo de Vida');
      expect(result.currentDomain).toBeTruthy();
      expect(result.currentLayer).toBeTruthy();
    });

    test.concurrent('should track completed domains correctly', async () => {
      const { result } = await createHealthyProfile().buildToCompletion();
      
      expect(result.results?.completedDomains).toContain('lifestyle');
      expect(result.results?.completedDomains.length).toBeGreaterThan(1);
    });

    test.concurrent('should preserve responses throughout flow', async () => {
      const builder = createHighRiskProfile();
      const { flow } = await builder.buildToCompletion();
      
      const responses = flow.getResponses();
      expect(responses.age).toBe(65);
      expect(responses.biological_sex).toBe('male');
      expect(responses.pain_severity).toBe(8);
    });
  });
});