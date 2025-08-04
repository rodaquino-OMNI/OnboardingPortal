import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

describe('Domain Trigger Tests - Focused', () => {
  let flow: UnifiedHealthFlow;

  beforeEach(() => {
    flow = new UnifiedHealthFlow();
  });

  describe('Pain Management Triggers (>= 4)', () => {
    it('should trigger pain domain at threshold (pain = 4)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);

      let result = await flow.processResponse('pain_severity', 4);
      await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('pain_management');
    });

    it('should NOT trigger pain domain below threshold (pain = 3)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 25);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);

      let result = await flow.processResponse('pain_severity', 3);
      await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).not.toBe('pain_management');
      expect(result.domain?.id).toBe('lifestyle'); // Should skip to lifestyle
    });
  });

  describe('Mental Health Triggers (>= 1)', () => {
    it('should trigger mental health at threshold (mood = 1)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 28);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 2);

      let result = await flow.processResponse('mood_interest', 1);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should NOT trigger mental health below threshold (mood = 0)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 24);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 2);

      let result = await flow.processResponse('mood_interest', 0);
      result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).not.toBe('mental_health');
      expect(result.domain?.id).toBe('lifestyle');
    });
  });

  describe('Family History Triggers (age >= 25)', () => {
    it('should include family history at threshold (age = 25)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 25);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      
      // After triage completion, should transition to lifestyle domain
      let result = await flow.processResponse('chronic_conditions_flag', false);
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');

      // Continue to first lifestyle question
      result = await flow.processResponse('_continue', true);
      expect(result.type).toBe('question');
      expect(result.question?.id).toBe('exercise_frequency');

      // Complete lifestyle domain
      result = await flow.processResponse('exercise_frequency', 3);
      result = await flow.processResponse('smoking_status', 'never');
      result = await flow.processResponse('alcohol_consumption', 'monthly');

      // Should transition to family history (age >= 25)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('family_history');
    });

    it('should NOT include family history below threshold (age = 24)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 24);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      
      let result = await flow.processResponse('chronic_conditions_flag', false);
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');

      // Continue to lifestyle questions
      result = await flow.processResponse('_continue', true);
      result = await flow.processResponse('exercise_frequency', 3);
      result = await flow.processResponse('smoking_status', 'never');
      result = await flow.processResponse('alcohol_consumption', 'monthly');

      // Should skip family history and go to validation (age < 25)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('validation');
    });
  });

  describe('Age-Based Specializations', () => {
    it('should handle senior users (age >= 65)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 65);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      
      let result = await flow.processResponse('chronic_conditions_flag', false);

      // Should trigger lifestyle (age >= 18) and eventually family history (age >= 25)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });

    it('should handle pediatric users (age < 18)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 16);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      
      let result = await flow.processResponse('chronic_conditions_flag', false);

      // Should skip lifestyle (age < 18) and go to validation
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('validation');
    });

    it('should handle young adults (age = 18)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 18);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 0);
      await flow.processResponse('mood_interest', 0);
      
      let result = await flow.processResponse('chronic_conditions_flag', false);

      // Should trigger lifestyle (age >= 18) but NOT family history (age < 25)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('lifestyle');
    });
  });

  describe('Chronic Disease Triggers', () => {
    it('should trigger chronic disease when flag is true', async () => {
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

    it('should NOT trigger chronic disease when flag is false', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 55);
      await flow.processResponse('biological_sex', 'male');
      await flow.processResponse('emergency_check', ['none']);
      await flow.processResponse('pain_severity', 3);
      await flow.processResponse('mood_interest', 0);

      let result = await flow.processResponse('chronic_conditions_flag', false);

      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).not.toBe('chronic_disease');
      expect(result.domain?.id).toBe('lifestyle');
    });
  });

  describe('Multiple Trigger Priority', () => {
    it('should prioritize mental health over pain (higher priority)', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);

      // Trigger both: pain (priority 8) and mental health (priority 9)
      let result = await flow.processResponse('pain_severity', 6);
      result = await flow.processResponse('mood_interest', 2);
      result = await flow.processResponse('chronic_conditions_flag', false);

      // Should prioritize mental health (higher priority)
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should handle all triggers simultaneously', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 30);
      await flow.processResponse('biological_sex', 'female');
      await flow.processResponse('emergency_check', ['none']);

      // Trigger pain, mental health, AND chronic disease
      let result = await flow.processResponse('pain_severity', 7);
      result = await flow.processResponse('mood_interest', 3);
      result = await flow.processResponse('chronic_conditions_flag', true);

      // Should prioritize mental health (priority 9) over others
      expect(result.type).toBe('domain_transition');
      expect(result.domain?.id).toBe('mental_health');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exact boundary values', async () => {
      // Test pain threshold exactly at 4
      const flowPain = new UnifiedHealthFlow();
      await flowPain.processResponse('_init', true);
      await flowPain.processResponse('age', 30);
      await flowPain.processResponse('biological_sex', 'male');
      await flowPain.processResponse('emergency_check', ['none']);
      
      let result = await flowPain.processResponse('pain_severity', 4);
      await flowPain.processResponse('mood_interest', 0);
      result = await flowPain.processResponse('chronic_conditions_flag', false);
      
      expect(result.domain?.id).toBe('pain_management');

      // Test mood threshold exactly at 1
      const flowMood = new UnifiedHealthFlow();
      await flowMood.processResponse('_init', true);
      await flowMood.processResponse('age', 30);
      await flowMood.processResponse('biological_sex', 'female');
      await flowMood.processResponse('emergency_check', ['none']);
      await flowMood.processResponse('pain_severity', 0);
      
      result = await flowMood.processResponse('mood_interest', 1);
      result = await flowMood.processResponse('chronic_conditions_flag', false);
      
      expect(result.domain?.id).toBe('mental_health');
    });

    it('should handle emergency conditions', async () => {
      await flow.processResponse('_init', true);
      await flow.processResponse('age', 45);
      await flow.processResponse('biological_sex', 'male');

      // Emergency overrides all other considerations
      let result = await flow.processResponse('emergency_check', ['chest_pain']);
      result = await flow.processResponse('pain_severity', 8);
      result = await flow.processResponse('mood_interest', 3);
      result = await flow.processResponse('chronic_conditions_flag', true);

      // Emergency should be flagged in responses
      const responses = flow.getResponses();
      expect(responses.emergency_check).toContain('chest_pain');
    });
  });
});