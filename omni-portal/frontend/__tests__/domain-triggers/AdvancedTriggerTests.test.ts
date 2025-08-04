import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

describe('Advanced Domain Trigger Tests', () => {
  let flow: UnifiedHealthFlow;

  beforeEach(() => {
    flow = new UnifiedHealthFlow();
  });

  describe('Emergency Priority Testing', () => {
    it('should handle pregnancy complications as emergency', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 28);
      await flow.processResponse('biological_sex', 'female');
      
      // Pregnancy complications should be treated as emergency
      let result = await flow.processResponse('emergency_check', ['pregnancy_complications']);
      result = await flow.processResponse('pain_severity', 5);
      result = await flow.processResponse('mood_interest', 1);
      result = await flow.processResponse('chronic_conditions_flag', false);

      // Emergency should be flagged in responses
      const responses = flow.getResponses();
      expect(responses.emergency_check).toContain('pregnancy_complications');
      
      // Should still continue with assessment but with emergency flag
      expect(result.type).toBe('domain_transition');
    });

    it('should handle multiple emergency conditions', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 45);
      await flow.processResponse('biological_sex', 'male');
      
      // Multiple emergency conditions
      let result = await flow.processResponse('emergency_check', ['chest_pain', 'breathing_difficulty']);
      result = await flow.processResponse('pain_severity', 9);
      result = await flow.processResponse('mood_interest', 2);
      result = await flow.processResponse('chronic_conditions_flag', true);

      const responses = flow.getResponses();
      expect(responses.emergency_check).toContain('chest_pain');
      expect(responses.emergency_check).toContain('breathing_difficulty');
      
      // Should prioritize mental health despite emergencies in flow
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should handle suicide thoughts emergency', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 25);
      await flow.processResponse('biological_sex', 'female');
      
      let result = await flow.processResponse('emergency_check', ['suicide_thoughts']);
      result = await flow.processResponse('pain_severity', 2);
      result = await flow.processResponse('mood_interest', 3);
      result = await flow.processResponse('chronic_conditions_flag', false);

      const responses = flow.getResponses();
      expect(responses.emergency_check).toContain('suicide_thoughts');
      
      // Should still trigger mental health domain (highest priority)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });
  });

  describe('Complex Age-Based Scenarios', () => {
    it('should handle child with chronic conditions (rare but possible)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 12);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 1);
      await flow.processResponse('mood_interest', 0);
      
      // Child with chronic conditions (e.g., Type 1 diabetes)
      let result = await flow.processResponse('chronic_conditions_flag', true);

      // Should trigger chronic disease domain
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('chronic_disease');
    });

    it('should handle very elderly patient (age 90+)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 90);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 3);
      await flow.processResponse('mood_interest', 0);
      
      let result = await flow.processResponse('chronic_conditions_flag', false);

      // Should trigger lifestyle domain (age >= 18)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });

    it('should handle teenagers at boundary (age 17)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 17);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      
      let result = await flow.processResponse('chronic_conditions_flag', false);

      // Should skip lifestyle (age < 18) and go to validation
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('validation');
    });
  });

  describe('Multi-Domain Trigger Combinations', () => {
    it('should handle all domains triggered simultaneously', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 35); // Triggers lifestyle and family history
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      
      // Trigger pain (>= 4), mental health (>= 1), and chronic disease (true)
      let result = await flow.processResponse('pain_severity', 8);
      result = await flow.processResponse('mood_interest', 3);
      result = await flow.processResponse('chronic_conditions_flag', true);

      // Should prioritize mental health (priority 9) first
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should handle partial triggers (pain + lifestyle only)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30); // >= 25 for family history, >= 18 for lifestyle
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      
      // Only trigger pain (>= 4)
      let result = await flow.processResponse('pain_severity', 6);
      result = await flow.processResponse('mood_interest', 0); // No mental health trigger
      result = await flow.processResponse('chronic_conditions_flag', false); // No chronic trigger

      // Should trigger pain management (priority 8)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('pain_management');
    });

    it('should handle no high-priority triggers (lifestyle + family only)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 40); // >= 25 for family history, >= 18 for lifestyle
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      
      // No high-priority triggers
      let result = await flow.processResponse('pain_severity', 2); // < 4
      result = await flow.processResponse('mood_interest', 0); // < 1
      result = await flow.processResponse('chronic_conditions_flag', false); // false

      // Should trigger lifestyle (priority 5)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });
  });

  describe('Boundary Value Edge Cases', () => {
    it('should test exact pain threshold boundaries', async () => {
      const testCases = [
        { pain: 3, shouldTriggerPain: false },
        { pain: 4, shouldTriggerPain: true },
        { pain: 5, shouldTriggerPain: true },
      ];

      for (const testCase of testCases) {
        const testFlow = new UnifiedHealthFlow();
        await testFlow.processResponse('_init', true);
        await testFlow.processResponse('age', 30);
        await testFlow.processResponse('biological_sex', 'male');
        await testFlow.processResponse('emergency_check', ['none']);
        
        let result = await testFlow.processResponse('pain_severity', testCase.pain);
        await testFlow.processResponse('mood_interest', 0);
        result = await testFlow.processResponse('chronic_conditions_flag', false);

        if (testCase.shouldTriggerPain) {
          expect(result.domain?.id).toBe('pain_management');
        } else {
          expect(result.domain?.id).not.toBe('pain_management');
        }
      }
    });

    it('should test exact mood threshold boundaries', async () => {
      const testCases = [
        { mood: 0, shouldTriggerMentalHealth: false },
        { mood: 1, shouldTriggerMentalHealth: true },
        { mood: 2, shouldTriggerMentalHealth: true },
        { mood: 3, shouldTriggerMentalHealth: true },
      ];

      for (const testCase of testCases) {
        const testFlow = new UnifiedHealthFlow();
        await testFlow.processResponse('_init', true);
        await testFlow.processResponse('age', 30);
        await testFlow.processResponse('biological_sex', 'female');
        await testFlow.processResponse('emergency_check', ['none']);
        await testFlow.processResponse('pain_severity', 0);
        
        let result = await testFlow.processResponse('mood_interest', testCase.mood);
        result = await testFlow.processResponse('chronic_conditions_flag', false);

        if (testCase.shouldTriggerMentalHealth) {
          expect(result.domain?.id).toBe('mental_health');
        } else {
          expect(result.domain?.id).not.toBe('mental_health');
        }
      }
    });

    it('should test exact age threshold boundaries for family history', async () => {
      const testCases = [
        { age: 24, shouldTriggerFamilyHistory: false },
        { age: 25, shouldTriggerFamilyHistory: true },
        { age: 26, shouldTriggerFamilyHistory: true },
      ];

      for (const testCase of testCases) {
        const testFlow = new UnifiedHealthFlow();
        await testFlow.processResponse('_init', true);
        await testFlow.processResponse('age', testCase.age);
        await testFlow.processResponse('biological_sex', 'male');
        await testFlow.processResponse('emergency_check', ['none']);
        await testFlow.processResponse('pain_severity', 0);
        await testFlow.processResponse('mood_interest', 0);
        
        let result = await testFlow.processResponse('chronic_conditions_flag', false);
        
        // Navigate through lifestyle to check family history
        expect(result.domain?.id).toBe('lifestyle');
        result = await testFlow.processResponse('_continue', true);
        result = await testFlow.processResponse('exercise_frequency', 3);
        result = await testFlow.processResponse('smoking_status', 'never');
        result = await testFlow.processResponse('alcohol_consumption', 'monthly');

        if (testCase.shouldTriggerFamilyHistory) {
          expect(result.domain?.id).toBe('family_history');
        } else {
          expect(result.domain?.id).toBe('validation'); // Skip family history
        }
      }
    });

    it('should test exact age threshold boundaries for lifestyle', async () => {
      const testCases = [
        { age: 17, shouldTriggerLifestyle: false },
        { age: 18, shouldTriggerLifestyle: true },
        { age: 19, shouldTriggerLifestyle: true },
      ];

      for (const testCase of testCases) {
        const testFlow = new UnifiedHealthFlow();
        await testFlow.processResponse('_init', true);
        await testFlow.processResponse('age', testCase.age);
        await testFlow.processResponse('biological_sex', 'female');
        await testFlow.processResponse('emergency_check', ['none']);
        await testFlow.processResponse('pain_severity', 0);
        await testFlow.processResponse('mood_interest', 0);
        
        let result = await testFlow.processResponse('chronic_conditions_flag', false);

        if (testCase.shouldTriggerLifestyle) {
          expect(result.domain?.id).toBe('lifestyle');
        } else {
          expect(result.domain?.id).toBe('validation'); // Skip lifestyle
        }
      }
    });
  });

  describe('Domain Priority Validation', () => {
    it('should respect priority order: Mental Health (9) > Pain (8) > Chronic (7) > Validation (1)', async () => {
      // Test Mental Health (9) vs Pain (8)
      const flowMentalVsPain = new UnifiedHealthFlow();
      await flowMentalVsPain.processResponse('_init', true);
      await flowMentalVsPain.processResponse('age', 30);
      await flowMentalVsPain.processResponse('biological_sex', 'male');
      await flowMentalVsPain.processResponse('emergency_check', ['none']);
      
      let result = await flowMentalVsPain.processResponse('pain_severity', 7); // Triggers pain
      result = await flowMentalVsPain.processResponse('mood_interest', 2); // Triggers mental health
      result = await flowMentalVsPain.processResponse('chronic_conditions_flag', false);

      expect(result.domain?.id).toBe('mental_health'); // Higher priority

      // Test Pain (8) vs Chronic (7)
      const flowPainVsChronic = new UnifiedHealthFlow();
      await flowPainVsChronic.processResponse('_init', true);
      await flowPainVsChronic.processResponse('age', 30);
      await flowPainVsChronic.processResponse('biological_sex', 'female');
      await flowPainVsChronic.processResponse('emergency_check', ['none']);
      
      result = await flowPainVsChronic.processResponse('pain_severity', 6); // Triggers pain
      result = await flowPainVsChronic.processResponse('mood_interest', 0); // No mental health
      result = await flowPainVsChronic.processResponse('chronic_conditions_flag', true); // Triggers chronic

      expect(result.domain?.id).toBe('pain_management'); // Higher priority
    });

    it('should validate all domain trigger conditions are working', async () => {
      // Create a comprehensive test that validates each domain can be triggered
      const domainTests = [
        {
          name: 'pain_management',
          setup: async (flow: UnifiedHealthFlow) => {
            await flow.processResponse('_init', true);
            await flow.processResponse('age', 30);
            await flow.processResponse('biological_sex', 'male');
            await flow.processResponse('emergency_check', ['none']);
            let result = await flow.processResponse('pain_severity', 5); // >= 4
            await flow.processResponse('mood_interest', 0);
            return await flow.processResponse('chronic_conditions_flag', false);
          }
        },
        {
          name: 'mental_health',
          setup: async (flow: UnifiedHealthFlow) => {
            await flow.processResponse('_init', true);
            await flow.processResponse('age', 30);
            await flow.processResponse('biological_sex', 'female');
            await flow.processResponse('emergency_check', ['none']);
            await flow.processResponse('pain_severity', 2);
            let result = await flow.processResponse('mood_interest', 2); // >= 1
            return await flow.processResponse('chronic_conditions_flag', false);
          }
        },
        {
          name: 'chronic_disease',
          setup: async (flow: UnifiedHealthFlow) => {
            await flow.processResponse('_init', true);
            await flow.processResponse('age', 30);
            await flow.processResponse('biological_sex', 'male');
            await flow.processResponse('emergency_check', ['none']);
            await flow.processResponse('pain_severity', 2);
            await flow.processResponse('mood_interest', 0);
            return await flow.processResponse('chronic_conditions_flag', true); // = true
          }
        },
        {
          name: 'lifestyle',
          setup: async (flow: UnifiedHealthFlow) => {
            await flow.processResponse('_init', true);
            await flow.processResponse('age', 20); // >= 18
            await flow.processResponse('biological_sex', 'female');
            await flow.processResponse('emergency_check', ['none']);
            await flow.processResponse('pain_severity', 0);
            await flow.processResponse('mood_interest', 0);
            return await flow.processResponse('chronic_conditions_flag', false);
          }
        },
        {
          name: 'validation',
          setup: async (flow: UnifiedHealthFlow) => {
            await flow.processResponse('_init', true);
            await flow.processResponse('age', 15); // < 18 (no lifestyle)
            await flow.processResponse('biological_sex', 'male');
            await flow.processResponse('emergency_check', ['none']);
            await flow.processResponse('pain_severity', 0); // < 4
            await flow.processResponse('mood_interest', 0); // < 1
            return await flow.processResponse('chronic_conditions_flag', false);
          }
        }
      ];

      for (const test of domainTests) {
        const testFlow = new UnifiedHealthFlow();
        const result = await test.setup(testFlow);
        
        expect(result.type).toBe('domain_transition');
        expect(result.domain?.id).toBe(test.name);
      }
    });
  });
});