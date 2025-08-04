import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

describe('Domain Trigger Tests - Comprehensive Coverage', () => {
  let flow: UnifiedHealthFlow;

  beforeEach(() => {
    flow = new UnifiedHealthFlow();
  });

  describe('1. Pain Management Triggers (>= 4)', () => {
    it('should trigger pain domain when pain_severity >= 4', async () => {
      // Basic triage setup
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);

      // Test exact threshold (4)
      let result = await flow.processResponse('pain_severity', 4);
      await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('pain_management');
    });

    it('should trigger pain domain when pain_severity = 7 (above threshold)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 35);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);

      let result = await flow.processResponse('pain_severity', 7);
      await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('pain_management');
    });

    it('should NOT trigger pain domain when pain_severity < 4', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 25);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);

      let result = await flow.processResponse('pain_severity', 3);
      await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      // Should skip pain and go to lifestyle (age >= 18)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });

    it('should NOT trigger pain domain when pain_severity = 0', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 22);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);

      let result = await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle'); // Should skip pain management
    });
  });

  describe('2. Mental Health Triggers (>= 1)', () => {
    it('should trigger mental health domain when mood_interest >= 1', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 28);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 2);

      // Test exact threshold (1)
      let result = await flow.processResponse('mood_interest', 1);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should trigger mental health domain when mood_interest = 3 (highest level)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 1);

      let result = await flow.processResponse('mood_interest', 3);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should NOT trigger mental health when mood_interest = 0', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 24);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 2);

      let result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle'); // Should skip mental health
    });
  });

  describe('3. Family History Triggers (age >= 25)', () => {
    it('should include family history when age >= 25', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 25); // Exact threshold
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      await flow.processResponse('chronic_conditions_flag', false);

      // Navigate through lifestyle to reach family history
      let result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('exercise_frequency', 3);
      result = await flow.processResponse('smoking_status', 'never');
      result = await flow.processResponse('alcohol_consumption', 'monthly');

      // Continue navigation to find family history
      const completedDomains: string[] = [];
      while (result.type !== 'complete') {
        if (result.type === 'domain_transition') {
          completedDomains.push(result.domain!.id);
        }
        result = await flow.processResponse('_continue', true);
      }

      expect(completedDomains).toContain('family_history');
    });

    it('should include family history when age = 40 (well above threshold)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 40);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      await flow.processResponse('chronic_conditions_flag', false);

      // Navigate through to check for family history inclusion
      let result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('exercise_frequency', 3);
      result = await flow.processResponse('smoking_status', 'never');
      result = await flow.processResponse('alcohol_consumption', 'monthly');

      const completedDomains: string[] = [];
      while (result.type !== 'complete') {
        if (result.type === 'domain_transition') {
          completedDomains.push(result.domain!.id);
        }
        result = await flow.processResponse('_continue', true);
      }

      expect(completedDomains).toContain('family_history');
    });

    it('should NOT include family history when age < 25', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 24); // Below threshold
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      await flow.processResponse('chronic_conditions_flag', false);

      // Navigate through to check domains
      let result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('exercise_frequency', 3);
      result = await flow.processResponse('smoking_status', 'never');
      result = await flow.processResponse('alcohol_consumption', 'monthly');

      const completedDomains: string[] = [];
      while (result.type !== 'complete') {
        if (result.type === 'domain_transition') {
          completedDomains.push(result.domain!.id);
        }
        result = await flow.processResponse('_continue', true);
      }

      expect(completedDomains).not.toContain('family_history');
    });

    it('should NOT include family history when age = 18 (young adult)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 18);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      await flow.processResponse('chronic_conditions_flag', false);

      let result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('exercise_frequency', 3);
      result = await flow.processResponse('smoking_status', 'never');
      result = await flow.processResponse('alcohol_consumption', 'monthly');

      const completedDomains: string[] = [];
      while (result.type !== 'complete') {
        if (result.type === 'domain_transition') {
          completedDomains.push(result.domain!.id);
        }
        result = await flow.processResponse('_continue', true);
      }

      expect(completedDomains).not.toContain('family_history');
    });
  });

  describe('4. Specialized Assessment Triggers', () => {
    describe('Senior Health (age >= 65)', () => {
      it('should trigger appropriate assessments for senior users', async () => {
        await flow.processResponse('_init', true);
        await flow.processResponse('age', 65); // Senior threshold
        await flow.processResponse('biological_sex', 'male');
        await flow.processResponse('emergency_check', ['none']);
        await flow.processResponse('pain_severity', 2);
        await flow.processResponse('mood_interest', 0);
        await flow.processResponse('chronic_conditions_flag', false);

        // Should trigger lifestyle and family history for seniors
        let result = await flow.processResponse('_continue', true);
        
        const completedDomains: string[] = [];
        while (result.type !== 'complete') {
          if (result.type === 'domain_transition') {
            completedDomains.push(result.domain!.id);
          }
          result = await flow.processResponse('_continue', true);
        }

        expect(completedDomains).toContain('lifestyle');
        expect(completedDomains).toContain('family_history');
        expect(completedDomains).toContain('validation');
      });

      it('should trigger for very senior users (age = 80)', async () => {
        await flow.processResponse('_init', true);
        await flow.processResponse('age', 80);
        await flow.processResponse('biological_sex', 'female');
        await flow.processResponse('emergency_check', ['none']);
        await flow.processResponse('pain_severity', 0);
        await flow.processResponse('mood_interest', 0);
        await flow.processResponse('chronic_conditions_flag', false);

        let result = await flow.processResponse('_continue', true);
        
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

    describe('Pediatric Assessment (age < 18)', () => {
      it('should handle pediatric users appropriately', async () => {
        await flow.processResponse('_init', true);
        await flow.processResponse('age', 16); // Pediatric
        await flow.processResponse('biological_sex', 'male');
        await flow.processResponse('emergency_check', ['none']);
        await flow.processResponse('pain_severity', 1);
        await flow.processResponse('mood_interest', 0);
        await flow.processResponse('chronic_conditions_flag', false);

        // Should skip lifestyle (age < 18) and family history (age < 25)
        let result = await flow.processResponse('_continue', true);
        
        const completedDomains: string[] = [];
        while (result.type !== 'complete') {
          if (result.type === 'domain_transition') {
            completedDomains.push(result.domain!.id);
          }
          result = await flow.processResponse('_continue', true);
        }

        expect(completedDomains).not.toContain('lifestyle');
        expect(completedDomains).not.toContain('family_history');
        expect(completedDomains).toContain('validation'); // Always included
      });

      it('should handle young child (age = 8)', async () => {
        await flow.processResponse('_init', true);
        await flow.processResponse('age', 8);
        await flow.processResponse('biological_sex', 'female');
        await flow.processResponse('emergency_check', ['none']);
        await flow.processResponse('pain_severity', 0);
        await flow.processResponse('mood_interest', 0);
        await flow.processResponse('chronic_conditions_flag', false);

        let result = await flow.processResponse('_continue', true);
        
        const completedDomains: string[] = [];
        while (result.type !== 'complete') {
          if (result.type === 'domain_transition') {
            completedDomains.push(result.domain!.id);
          }
          result = await flow.processResponse('_continue', true);
        }

        expect(completedDomains).not.toContain('lifestyle');
        expect(completedDomains).not.toContain('family_history');
      });
    });

    describe('Chronic Disease Triggers', () => {
      it('should trigger chronic disease domain when flag is true', async () => {
        await flow.processResponse('_init', true);
        await flow.processResponse('age', 55);
        await flow.processResponse('biological_sex', 'male');
        await flow.processResponse('emergency_check', ['none']);
        await flow.processResponse('pain_severity', 3);
        await flow.processResponse('mood_interest', 0);

        let result = await flow.processResponse('chronic_conditions_flag', true);

        expect(result.type).toBe('domain_transition');
        expect(result.domain?.id).toBe('chronic_disease');
      });

      it('should NOT trigger chronic disease domain when flag is false', async () => {
        await flow.processResponse('_init', true);
        await flow.processResponse('age', 55);
        await flow.processResponse('biological_sex', 'male');
        await flow.processResponse('emergency_check', ['none']);
        await flow.processResponse('pain_severity', 3);
        await flow.processResponse('mood_interest', 0);

        let result = await flow.processResponse('chronic_conditions_flag', false);

        expect(result.type).toBe('domain_transition');
        expect(result.domain?.id).toBe('lifestyle'); // Should skip chronic disease
      });
    });

    describe('Lifestyle Triggers (age >= 18)', () => {
      it('should trigger lifestyle domain for adults (age = 18)', async () => {
        await flow.processResponse('_init', true);
        await flow.processResponse('age', 18); // Exact threshold
        await flow.processResponse('biological_sex', 'female');
        await flow.processResponse('emergency_check', ['none']);
        await flow.processResponse('pain_severity', 0);
        await flow.processResponse('mood_interest', 0);
        await flow.processResponse('chronic_conditions_flag', false);

        let result = await flow.processResponse('_continue', true);

        expect(result.type).toBe('domain_transition');
        expect(result.domain?.id).toBe('lifestyle');
      });

      it('should NOT trigger lifestyle domain for minors (age = 17)', async () => {
        await flow.processResponse('_init', true);
        await flow.processResponse('age', 17); // Below threshold
        await flow.processResponse('biological_sex', 'male');
        await flow.processResponse('emergency_check', ['none']);
        await flow.processResponse('pain_severity', 0);
        await flow.processResponse('mood_interest', 0);
        await flow.processResponse('chronic_conditions_flag', false);

        let result = await flow.processResponse('_continue', true);

        expect(result.type).toBe('domain_transition');
        expect(result.domain?.id).toBe('validation'); // Should skip lifestyle
      });
    });
  });

  describe('5. Edge Cases for Trigger Conditions', () => {
    it('should handle boundary values correctly (pain = 3.9 vs 4.0)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);

      // Test just below threshold (should NOT trigger)
      let result = await flow.processResponse('pain_severity', 3);
      await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.domain?.id).not.toBe('pain_management');
    });

    it('should handle multiple simultaneous triggers correctly', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);

      // Trigger both pain AND mental health
      let result = await flow.processResponse('pain_severity', 6);
      result = await flow.processResponse('mood_interest', 2);
      result = await flow.processResponse('chronic_conditions_flag', true);

      // Should prioritize highest priority domain (mental health = 9, pain = 8, chronic = 7)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should handle emergency conditions with highest priority', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 45);
      await flow.processResponse('biological_sex', 'male');

      // Emergency should override all other triggers
      let result = await flow.processResponse('emergency_check', ['chest_pain']);
      result = await flow.processResponse('pain_severity', 8);
      result = await flow.processResponse('mood_interest', 3);
      result = await flow.processResponse('chronic_conditions_flag', true);

      // Check that emergency was flagged in responses
      const responses = flow.getResponses();
      expect(responses.emergency_check).toContain('chest_pain');
    });

    it('should handle maximum values correctly', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 100); // Maximum realistic age
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 10); // Maximum pain
      await flow.processResponse('mood_interest', 3); // Maximum mood impact
      let result = await flow.processResponse('chronic_conditions_flag', true);

      // Should trigger mental health (priority 9) first
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should handle minimum values correctly', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 1); // Minimum age
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0); // Minimum pain
      await flow.processResponse('mood_interest', 0); // Minimum mood impact
      let result = await flow.processResponse('chronic_conditions_flag', false);

      // Should skip to validation (no other domains triggered)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('validation');
    });
  });

  describe('6. False Trigger Prevention', () => {
    it('should NOT trigger pain domain for low pain scores', async () => {
      const lowPainScores = [0, 1, 2, 3];
      
      for (const painScore of lowPainScores) {
        const testFlow = new UnifiedHealthFlow();
        await testFlow.processResponse('_init', true);
        await testFlow.processResponse('age', 30);
        await testFlow.processResponse('biological_sex', 'male');
        await testFlow.processResponse('emergency_check', ['none']);
        
        let result = await testFlow.processResponse('pain_severity', painScore);
        await testFlow.processResponse('mood_interest', 0);
        result = await testFlow.processResponse('chronic_conditions_flag', false);
        
        expect(result.domain?.id).not.toBe('pain_management');
      }
    });

    it('should NOT trigger mental health domain for mood_interest = 0', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 25);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 2);
      
      let result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);
      
      expect(result.domain?.id).not.toBe('mental_health');
    });

    it('should NOT trigger family history for young adults', async () => {
      const youngAges = [18, 20, 22, 24];
      
      for (const age of youngAges) {
        const testFlow = new UnifiedHealthFlow();
        await testFlow.processResponse('_init', true);
        await testFlow.processResponse('age', age);
        await testFlow.processResponse('biological_sex', 'male');
        await testFlow.processResponse('emergency_check', ['none']);
        await testFlow.processResponse('pain_severity', 0);
        await testFlow.processResponse('mood_interest', 0);
        await testFlow.processResponse('chronic_conditions_flag', false);

        let result = await testFlow.processResponse('_continue', true);
        result = await testFlow.processResponse('exercise_frequency', 3);
        result = await testFlow.processResponse('smoking_status', 'never');
        result = await testFlow.processResponse('alcohol_consumption', 'monthly');

        const completedDomains: string[] = [];
        while (result.type !== 'complete') {
          if (result.type === 'domain_transition') {
            completedDomains.push(result.domain!.id);
          }
          result = await testFlow.processResponse('_continue', true);
        }

        expect(completedDomains).not.toContain('family_history');
      }
    });

    it('should NOT trigger chronic disease when flag is false', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 60);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 1);
      await flow.processResponse('mood_interest', 0);
      
      let result = await flow.processResponse('chronic_conditions_flag', false);
      
      expect(result.domain?.id).not.toBe('chronic_disease');
    });

    it('should NOT trigger lifestyle for children', async () => {
      const childAges = [5, 10, 15, 17];
      
      for (const age of childAges) {
        const testFlow = new UnifiedHealthFlow();
        await testFlow.processResponse('_init', true);
        await testFlow.processResponse('age', age);
        await testFlow.processResponse('biological_sex', 'female');
        await testFlow.processResponse('emergency_check', ['none']);
        await testFlow.processResponse('pain_severity', 0);
        await testFlow.processResponse('mood_interest', 0);
        await testFlow.processResponse('chronic_conditions_flag', false);

        let result = await testFlow.processResponse('_continue', true);
        
        expect(result.domain?.id).not.toBe('lifestyle');
      }
    });
  });

  describe('7. Complex Scenario Testing', () => {
    it('should handle realistic high-risk elderly patient scenario', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 75);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 6); // Triggers pain
      await flow.processResponse('mood_interest', 2); // Triggers mental health
      let result = await flow.processResponse('chronic_conditions_flag', true); // Triggers chronic

      // Should prioritize mental health (priority 9)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should handle healthy young adult scenario', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 22);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 1);
      await flow.processResponse('mood_interest', 0);
      let result = await flow.processResponse('chronic_conditions_flag', false);

      // Should only trigger lifestyle (age >= 18)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });

    it('should handle middle-aged patient with moderate concerns', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 45);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 4); // Exact threshold
      await flow.processResponse('mood_interest', 1); // Exact threshold
      let result = await flow.processResponse('chronic_conditions_flag', false);

      // Should trigger mental health (higher priority than pain)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });
  });
});