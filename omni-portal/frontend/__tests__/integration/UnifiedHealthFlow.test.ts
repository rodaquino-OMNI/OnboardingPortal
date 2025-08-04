import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

describe('UnifiedHealthFlow Integration Tests', () => {
  let flow: UnifiedHealthFlow;

  beforeEach(() => {
    flow = new UnifiedHealthFlow();
  });

  describe('Complete Flow Scenarios', () => {
    it('should complete minimal healthy user flow', async () => {
      // Start flow
      let result = await flow.processResponse('_init', true);
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('age');

      // Answer age
      result = await flow.processResponse('age', 30);
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('biological_sex');

      // Answer biological sex
      result = await flow.processResponse('biological_sex', 'male');
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('emergency_check');

      // No emergency conditions
      result = await flow.processResponse('emergency_check', ['none']);
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('pain_severity');

      // No pain
      result = await flow.processResponse('pain_severity', 0);
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('mood_interest');

      // Good mood
      result = await flow.processResponse('mood_interest', 0);
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('chronic_conditions_flag');

      // No chronic conditions
      result = await flow.processResponse('chronic_conditions_flag', false);
      
      // Should transition to lifestyle domain (age >= 18)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });

    it('should trigger emergency flow for critical conditions', async () => {
      // Start flow
      let result = await flow.processResponse('_init', true);
      
      // Basic demographics
      result = await flow.processResponse('age', 45);
      result = await flow.processResponse('biological_sex', 'female');
      
      // Emergency condition
      result = await flow.processResponse('emergency_check', ['chest_pain', 'breathing_difficulty']);
      
      // Should still ask remaining triage questions but prioritize emergency
      expect(result.type).toBe('question');
      
      // Complete triage
      result = await flow.processResponse('pain_severity', 8);
      result = await flow.processResponse('mood_interest', 2);
      result = await flow.processResponse('chronic_conditions_flag', true);
      
      // Flow should be marked as critical risk
      const responses = flow.getResponses();
      expect(responses.emergency_check).toContain('chest_pain');
    });

    it('should adapt flow based on pain severity', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Basic info
      result = await flow.processResponse('age', 35);
      result = await flow.processResponse('biological_sex', 'male');
      result = await flow.processResponse('emergency_check', ['none']);
      
      // High pain score
      result = await flow.processResponse('pain_severity', 7);
      result = await flow.processResponse('mood_interest', 1);
      result = await flow.processResponse('chronic_conditions_flag', false);
      
      // Should transition to pain domain
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('pain_management');
      
      // Continue to pain questions
      result = await flow.processResponse('_continue', true);
      expect(result.type).toBe('question');
      expect(result.question?.domain).toBe('pain');
    });

    it('should handle mental health pathway', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Basic info
      result = await flow.processResponse('age', 28);
      result = await flow.processResponse('biological_sex', 'female');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 2);
      
      // Mental health indicator
      result = await flow.processResponse('mood_interest', 3); // Almost every day
      result = await flow.processResponse('chronic_conditions_flag', false);
      
      // Should transition to mental health domain
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should handle chronic disease pathway', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Basic info
      result = await flow.processResponse('age', 55);
      result = await flow.processResponse('biological_sex', 'male');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 3);
      result = await flow.processResponse('mood_interest', 0);
      
      // Has chronic conditions
      result = await flow.processResponse('chronic_conditions_flag', true);
      
      // Should eventually reach chronic disease domain
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('chronic_disease');
    });
  });

  describe('Progressive Disclosure', () => {
    it('should skip irrelevant domains for young healthy users', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Young user
      result = await flow.processResponse('age', 20);
      result = await flow.processResponse('biological_sex', 'male');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 0);
      result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);
      
      // Should go to lifestyle (age >= 18) but skip family history (age < 25)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });

    it('should include family history for older users', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Older user
      result = await flow.processResponse('age', 40);
      result = await flow.processResponse('biological_sex', 'female');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 0);
      result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);
      
      // Complete lifestyle domain
      result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('exercise_frequency', 3);
      result = await flow.processResponse('smoking_status', 'never');
      result = await flow.processResponse('alcohol_consumption', 'monthly');
      
      // Should include family history (age >= 25)
      const completedDomains: string[] = [];
      while (result.type !== 'complete') {
        if (result.type === 'domain_transition') {
          completedDomains.push(result.domain!.id);
        }
        result = await flow.processResponse('_continue', true);
      }
      
      expect(completedDomains).toContain('family_history');
    });
  });

  describe('Risk Scoring', () => {
    it('should calculate risk scores correctly', async () => {
      let result = await flow.processResponse('_init', true);
      
      // High risk profile
      result = await flow.processResponse('age', 65);
      result = await flow.processResponse('biological_sex', 'male');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 8);
      result = await flow.processResponse('mood_interest', 3);
      result = await flow.processResponse('chronic_conditions_flag', true);
      
      // Navigate to completion
      while (result.type !== 'complete') {
        if (result.type === 'question') {
          // Answer questions with moderate/high risk responses
          if (result.question?.type === 'boolean') {
            result = await flow.processResponse(result.question?.id, true);
          } else if (result.question?.type === 'scale') {
            result = await flow.processResponse(result.question?.id, 7);
          } else if (result.question?.type === 'select') {
            const options = result.question?.options || [];
            const highRiskOption! = options.find(o => o.riskScore && o.riskScore > 2) || options[0];
            result = await flow.processResponse(result.question?.id, highRiskOption!.value);
          } else if (result.question?.type === 'multiselect') {
            result = await flow.processResponse(result.question?.id, ['diabetes', 'hypertension']);
          } else {
            result = await flow.processResponse(result.question?.id, 'test response');
          }
        } else {
          result = await flow.processResponse('_continue', true);
        }
      }
      
      expect(result.results?.riskLevel).toBe('high');
      expect(result.results?.totalRiskScore).toBeGreaterThan(15);
    });
  });

  describe('Conditional Questions', () => {
    it('should show conditional questions when criteria met', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Setup to chronic disease domain
      result = await flow.processResponse('age', 50);
      result = await flow.processResponse('biological_sex', 'female');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 2);
      result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', true);
      
      // Navigate to chronic disease questions
      result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('chronic_conditions', ['diabetes']);
      
      // Say yes to medications
      result = await flow.processResponse('current_medications', true);
      
      // Should show medication list question (conditional)
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('medication_list');
    });

    it('should skip conditional questions when criteria not met', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Setup to chronic disease domain
      result = await flow.processResponse('age', 50);
      result = await flow.processResponse('biological_sex', 'male');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 2);
      result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', true);
      
      // Navigate to chronic disease questions
      result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('chronic_conditions', ['diabetes']);
      
      // Say no to medications
      result = await flow.processResponse('current_medications', false);
      
      // Should skip medication list and go to next question
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('hospitalizations');
    });
  });

  describe('Fraud Detection', () => {
    it('should detect inconsistent responses', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Young age
      result = await flow.processResponse('age', 20);
      result = await flow.processResponse('biological_sex', 'male');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 0);
      result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', true);
      
      // Navigate to chronic conditions
      result = await flow.processResponse('_continue', true);
      
      // Select many chronic conditions for young age
      result = await flow.processResponse('chronic_conditions', [
        'diabetes', 'heart_disease', 'cancer', 'kidney_disease', 'liver_disease'
      ]);
      
      // Complete flow
      while (result.type !== 'complete') {
        if (result.type === 'question') {
          result = await flow.processResponse(result.question?.id, false);
        } else {
          result = await flow.processResponse('_continue', true);
        }
      }
      
      // Should have elevated fraud score
      expect(result.results?.fraudDetectionScore).toBeGreaterThan(0);
    });

    it('should detect validation pair mismatches', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Basic flow
      result = await flow.processResponse('age', 35);
      result = await flow.processResponse('biological_sex', 'female');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 0);
      result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);
      
      // Navigate to lifestyle
      result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('exercise_frequency', 3);
      
      // Say never smoked
      result = await flow.processResponse('smoking_status', 'never');
      
      // But then say doctor advised to quit (inconsistent)
      if (result.question?.id === 'smoking_advice') {
        result = await flow.processResponse('smoking_advice', true);
      }
      
      // Complete flow
      while (result.type !== 'complete') {
        if (result.type === 'question') {
          result = await flow.processResponse(result.question?.id, 'test');
        } else {
          result = await flow.processResponse('_continue', true);
        }
      }
      
      // Should detect fraud from validation pair mismatch
      expect(result.results?.fraudDetectionScore).toBeGreaterThan(20);
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress accurately', async () => {
      let result = await flow.processResponse('_init', true);
      const progressValues: number[] = [];
      
      // Track progress through flow
      while (result.type !== 'complete') {
        progressValues.push(result.progress);
        
        if (result.type === 'question') {
          if (result.question?.type === 'boolean') {
            result = await flow.processResponse(result.question?.id, false);
          } else if (result.question?.type === 'scale') {
            result = await flow.processResponse(result.question?.id, 5);
          } else if (result.question?.type === 'select') {
            const firstOption = result.question?.options?.[0];
            result = await flow.processResponse(result.question?.id, firstOption?.value || 'test');
          } else if (result.question?.type === 'multiselect') {
            result = await flow.processResponse(result.question?.id, ['none']);
          } else {
            result = await flow.processResponse(result.question?.id, 'test');
          }
        } else {
          result = await flow.processResponse('_continue', true);
        }
      }
      
      // Progress should increase monotonically
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }
      
      // Should end at 100%
      expect(result.progress).toBe(100);
    });
  });

  describe('Time Estimation', () => {
    it('should estimate remaining time correctly', async () => {
      let result = await flow.processResponse('_init', true);
      const timeEstimates: number[] = [];
      
      // Track time estimates
      while (result.type !== 'complete') {
        timeEstimates.push(result.estimatedTimeRemaining);
        
        if (result.type === 'question') {
          result = await flow.processResponse(result.question?.id, false);
        } else {
          result = await flow.processResponse('_continue', true);
        }
      }
      
      // Time should generally decrease (may jump when new domains are triggered)
      expect(timeEstimates[timeEstimates.length - 1]).toBeLessThanOrEqual(timeEstimates[0]);
      
      // Should end at 0
      expect(result.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('Recommendations Generation', () => {
    it('should generate appropriate recommendations for high-risk users', async () => {
      let result = await flow.processResponse('_init', true);
      
      // Create high-risk profile
      result = await flow.processResponse('age', 60);
      result = await flow.processResponse('biological_sex', 'male');
      result = await flow.processResponse('emergency_check', ['none']);
      result = await flow.processResponse('pain_severity', 8);
      result = await flow.processResponse('mood_interest', 3);
      result = await flow.processResponse('chronic_conditions_flag', true);
      
      // Complete flow with high-risk answers
      while (result.type !== 'complete') {
        if (result.type === 'question') {
          if (result.question?.id === 'chronic_conditions') {
            result = await flow.processResponse(result.question?.id, ['diabetes', 'heart_disease']);
          } else if (result.question?.id === 'exercise_frequency') {
            result = await flow.processResponse(result.question?.id, 0);
          } else if (result.question?.id === 'smoking_status') {
            result = await flow.processResponse(result.question?.id, 'current');
          } else {
            result = await flow.processResponse(result.question?.id, true);
          }
        } else {
          result = await flow.processResponse('_continue', true);
        }
      }
      
      // Should have multiple recommendations
      expect(result.results?.recommendations.length).toBeGreaterThan(0);
      expect(result.results?.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('dor'),
          expect.stringContaining('mental')
        ])
      );
      
      // Should have urgent next steps
      expect(result.results?.nextSteps).toEqual(
        expect.arrayContaining([
          expect.stringContaining('prioritário')
        ])
      );
    });
  });
});