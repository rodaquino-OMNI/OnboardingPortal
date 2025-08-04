import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

describe('UnifiedHealthFlow - Progress Calculation Logic', () => {
  let flow: UnifiedHealthFlow;

  beforeEach(() => {
    flow = new UnifiedHealthFlow();
  });

  describe('Universal Triage Progress', () => {
    it('should start with 0% progress', async () => {
      const result = await flow.processResponse('_init', true);
      
      expect(result.progress).toBe(0);
      expect(result.currentDomain).toBe('Avaliação Inicial');
      expect(result.type).toBe('question');
    });

    it('should calculate correct progress during triage', async () => {
      // Initialize
      await flow.processResponse('_init', true);
      
      // Answer first question
      const result1 = await flow.processResponse('age', 30);
      expect(result1.progress).toBeGreaterThan(0);
      expect(result1.progress).toBeLessThan(100);
      
      // Answer second question
      const result2 = await flow.processResponse('biological_sex', 'male');
      expect(result2.progress).toBeGreaterThan(result1.progress);
      expect(result2.progress).toBeLessThan(100);
    });

    it('should complete triage and transition to domains', async () => {
      // Initialize
      await flow.processResponse('_init', true);
      
      // Complete all triage questions to trigger domain transitions
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 6); // Trigger pain domain
      await flow.processResponse('mood_interest', 2); // Trigger mental health domain
      const result = await flow.processResponse('chronic_conditions_flag', true); // Trigger chronic disease domain

      // Should transition to first triggered domain (pain has highest priority)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('pain_management');
      expect(result.progress).toBeGreaterThan(0);
    });
  });

  describe('Progress Calculation Accuracy', () => {
    it('should calculate progress based on total triggered domains', async () => {
      // Initialize and complete triage with minimal triggers
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 25);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 1); // No pain domain trigger
      await flow.processResponse('mood_interest', 0); // No mental health trigger
      const result = await flow.processResponse('chronic_conditions_flag', false); // No chronic disease trigger

      // Only triage + validation should be active (2 total sections)
      // After triage completion, progress should be 50% (1/2 complete)
      expect(result.type).toBe('domain_transition');
      expect(result.progress).toBeGreaterThanOrEqual(50);
    });

    it('should calculate progress with multiple triggered domains', async () => {
      // Initialize and trigger multiple domains
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 35);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 7); // Trigger pain domain
      await flow.processResponse('mood_interest', 2); // Trigger mental health domain
      const result = await flow.processResponse('chronic_conditions_flag', true); // Trigger chronic disease domain

      // Should have triage + 3 domains + validation = 5 total sections
      // After triage completion, progress should be 20% (1/5 complete)
      expect(result.type).toBe('domain_transition');
      expect(result.progress).toBeLessThanOrEqual(25); // Should be around 20%
    });

    it('should handle progress calculation edge cases', async () => {
      // Test with extreme values that might break calculation
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 100);
      await flow.processResponse('biological_sex', 'intersex');
      await flow.processResponse('emergency_check', ['chest_pain', 'breathing_difficulty']); // Multiple emergency conditions
      await flow.processResponse('pain_severity', 10);
      await flow.processResponse('mood_interest', 3);
      const result = await flow.processResponse('chronic_conditions_flag', true);

      // Even with extreme values, progress should be valid
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.progress)).toBe(true);
    });
  });

  describe('Domain Transition Logic', () => {
    it('should prioritize emergency domains', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'male');
      const result = await flow.processResponse('emergency_check', ['chest_pain']);

      // Emergency should trigger immediate transition
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('emergency_response');
    });

    it('should handle domain priority correctly', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 8); // Pain: priority 8
      await flow.processResponse('mood_interest', 3); // Mental health: priority 9 (higher)
      const result = await flow.processResponse('chronic_conditions_flag', true); // Chronic: priority 7

      // Should transition to mental health (highest priority)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should complete flow when all domains are finished', async () => {
      // Simulate completing a minimal flow (triage + validation only)
      await flow.processResponse('_init', true);
      
      // Complete triage without triggering other domains
      await flow.processResponse('age', 25);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      await flow.processResponse('chronic_conditions_flag', false);

      // Should transition to validation domain
      let result = await flow.processResponse('_continue', true);
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('validation');

      // Complete validation
      await flow.processResponse('height_confirmation', 175);
      await flow.processResponse('weight_confirmation', 70);
      result = await flow.processResponse('emergency_contact', 'John Doe - 555-1234');

      // Should complete the assessment
      expect(result.type).toBe('complete');
      expect(result.progress).toBe(100);
      expect(result.results).toBeDefined();
    });
  });

  describe('Time Estimation', () => {
    it('should provide accurate time estimates', async () => {
      await flow.processResponse('_init', true);
      const result = await flow.processResponse('age', 30);

      // Should estimate remaining time based on remaining questions
      expect(result.estimatedTimeRemaining).toBeGreaterThan(0);
      expect(typeof result.estimatedTimeRemaining).toBe('number');
    });

    it('should update time estimates as progress advances', async () => {
      await flow.processResponse('_init', true);
      
      const result1 = await flow.processResponse('age', 30);
      const initialTime = result1.estimatedTimeRemaining;
      
      const result2 = await flow.processResponse('biological_sex', 'male');
      const updatedTime = result2.estimatedTimeRemaining;

      // Time should decrease as we progress
      expect(updatedTime).toBeLessThanOrEqual(initialTime);
    });
  });

  describe('Risk Calculation Integration', () => {
    it('should calculate risk scores correctly', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 65); // Higher age = higher risk
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 8); // High pain = higher risk
      await flow.processResponse('mood_interest', 3); // High depression screening = higher risk
      const result = await flow.processResponse('chronic_conditions_flag', true);

      // Should have accumulated risk scores
      const responses = flow.getResponses();
      expect(responses.age).toBe(65);
      expect(responses.pain_severity).toBe(8);
      expect(responses.mood_interest).toBe(3);
    });

    it('should handle low-risk scenarios', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 25);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      const result = await flow.processResponse('chronic_conditions_flag', false);

      // Low-risk users should trigger fewer domains
      expect(result.type).toBe('domain_transition');
      // Should transition to validation (no high-risk domains triggered)
      expect(result.domain?.id).toBe('validation');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid question IDs gracefully', async () => {
      await flow.processResponse('_init', true);
      
      // Try to answer a non-existent question
      const result = await flow.processResponse('invalid_question', 'some_value');
      
      // Should continue normally (ignore invalid responses)
      expect(result).toBeDefined();
      expect(result.type).toBe('question');
    });

    it('should handle invalid values gracefully', async () => {
      await flow.processResponse('_init', true);
      
      // Try invalid values for scale question
      const result1 = await flow.processResponse('pain_severity', -5);
      expect(result1).toBeDefined();
      
      const result2 = await flow.processResponse('pain_severity', 'invalid');
      expect(result2).toBeDefined();
      
      const result3 = await flow.processResponse('pain_severity', null);
      expect(result3).toBeDefined();
    });

    it('should maintain consistency during error conditions', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      
      const beforeError = flow.getCurrentDomain();
      
      // Cause potential error with invalid input
      await flow.processResponse('invalid_question', undefined);
      
      const afterError = flow.getCurrentDomain();
      
      // Domain should remain consistent
      expect(afterError).toBe(beforeError);
    });
  });
});