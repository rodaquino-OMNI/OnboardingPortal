import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

describe('Crisis Intervention and Emergency Protocols', () => {
  let flow: UnifiedHealthFlow;

  beforeEach(() => {
    flow = new UnifiedHealthFlow();
  });

  describe('Crisis Intervention Domain Triggers', () => {
    it('should trigger for severe allergy reactions', () => {
      flow.saveResponse('allergy_history', 'yes');
      flow.saveResponse('allergy_medications', ['penicillin']);
      flow.saveResponse('medication_allergy_reaction', 'anaphylaxis');
      flow.saveResponse('medication_allergy_severity', 'life_threatening');

      const domains = flow.evaluateDomainTriggers();
      expect(domains.crisis_intervention).toBe(true);
    });

    it('should trigger for suicide ideation', () => {
      // Answer PHQ-9 questions
      flow.saveResponse('phq9_1_interest', 0);
      flow.saveResponse('phq9_2_depression', 0);
      flow.saveResponse('phq9_3_sleep', 0);
      flow.saveResponse('phq9_4_tired', 0);
      flow.saveResponse('phq9_5_appetite', 0);
      flow.saveResponse('phq9_6_failure', 0);
      flow.saveResponse('phq9_7_concentration', 0);
      flow.saveResponse('phq9_8_movement', 0);
      flow.saveResponse('phq9_9_suicide', 2); // Several days

      const questions = flow.getAllQuestions();
      const crisisQuestions = questions.filter(q => q.domain === 'crisis_intervention');
      
      expect(crisisQuestions.length).toBeGreaterThan(0);
      expect(crisisQuestions.find(q => q.id === 'suicide_safety_plan')).toBeDefined();
    });

    it('should trigger for domestic violence', () => {
      flow.saveResponse('domestic_violence', 'yes');

      const questions = flow.getAllQuestions();
      const safetyQuestion = questions.find(q => q.id === 'safety_planning');
      
      expect(safetyQuestion).toBeDefined();
      expect(safetyQuestion?.domain).toBe('crisis_intervention');
    });
  });

  describe('Emergency Contact Protocol', () => {
    it('should include emergency contact verification', () => {
      flow.saveResponse('medication_allergy_severity', 'life_threatening');

      const questions = flow.getAllQuestions();
      const contactQuestion = questions.find(q => q.id === 'emergency_contact_protocol');
      
      expect(contactQuestion).toBeDefined();
      expect(contactQuestion?.type).toBe('multiselect');
      expect(contactQuestion?.options).toContain('Emergency contact information verified');
    });

    it('should show emergency access question for severe cases', () => {
      flow.saveResponse('medication_allergy_severity', 'severe');

      const questions = flow.getAllQuestions();
      const accessQuestion = questions.find(q => q.id === 'emergency_access');
      
      expect(accessQuestion).toBeDefined();
      expect(accessQuestion?.options).toContain('24/7 emergency contact available');
    });
  });

  describe('Crisis Response Planning', () => {
    it('should include comprehensive crisis response options', () => {
      const questions = flow.getAllQuestions();
      const crisisResponseQuestion = questions.find(q => q.id === 'crisis_response_plan');
      
      expect(crisisResponseQuestion).toBeDefined();
      expect(crisisResponseQuestion?.options).toHaveLength(5);
      expect(crisisResponseQuestion?.options).toContain('Call emergency services immediately');
      expect(crisisResponseQuestion?.options).toContain('Contact mental health crisis line');
    });

    it('should include safety planning for violence', () => {
      flow.saveResponse('domestic_violence', 'yes');

      const questions = flow.getAllQuestions();
      const safetyQuestion = questions.find(q => q.id === 'safety_planning');
      
      expect(safetyQuestion).toBeDefined();
      expect(safetyQuestion?.options).toContain('Safe place identified');
      expect(safetyQuestion?.options).toContain('Emergency contacts programmed in phone');
    });
  });

  describe('24/7 Support Resources', () => {
    it('should include 24/7 support availability question', () => {
      const questions = flow.getAllQuestions();
      const supportQuestion = questions.find(q => q.id === 'support_24_7');
      
      expect(supportQuestion).toBeDefined();
      expect(supportQuestion?.options).toContain('CVV - 188 (24/7)');
      expect(supportQuestion?.options).toContain('SAMU - 192');
      expect(supportQuestion?.options).toContain('Women\'s Support - 180');
    });
  });

  describe('Risk Scoring with Crisis Factors', () => {
    it('should assign high risk weight to crisis questions', () => {
      const questions = flow.getAllQuestions();
      const crisisQuestions = questions.filter(q => q.domain === 'crisis_intervention');
      
      crisisQuestions.forEach(question => {
        expect(question.riskWeight).toBeGreaterThanOrEqual(8);
      });
    });

    it('should include crisis interventions in risk assessment', () => {
      flow.saveResponse('medication_allergy_severity', 'life_threatening');
      flow.saveResponse('emergency_contact_protocol', ['Emergency contact information verified']);
      flow.saveResponse('crisis_response_plan', ['Call emergency services immediately']);

      const results = flow.generateResults();
      const crisisScore = results.riskScores.crisis_intervention || 0;
      
      expect(crisisScore).toBeGreaterThan(0);
    });
  });

  describe('Suicide Safety Protocol', () => {
    it('should trigger comprehensive safety plan for suicide ideation', () => {
      flow.saveResponse('phq9_9_suicide', 1); // Several days

      const questions = flow.getAllQuestions();
      const safetyPlan = questions.find(q => q.id === 'suicide_safety_plan');
      
      expect(safetyPlan).toBeDefined();
      expect(safetyPlan?.required).toBe(true);
      expect(safetyPlan?.options).toContain('Remove access to means');
      expect(safetyPlan?.options).toContain('24/7 crisis hotline saved');
      expect(safetyPlan?.options).toContain('Support person identified');
      expect(safetyPlan?.options).toContain('Safety plan documented');
    });

    it('should require immediate professional contact for high suicide risk', () => {
      flow.saveResponse('phq9_9_suicide', 3); // Nearly every day

      const questions = flow.getAllQuestions();
      const professionalQuestion = questions.find(q => q.id === 'immediate_professional_contact');
      
      expect(professionalQuestion).toBeDefined();
      expect(professionalQuestion?.required).toBe(true);
      expect(professionalQuestion?.riskWeight).toBe(10);
    });
  });

  describe('Anaphylaxis Protocol', () => {
    it('should include EpiPen availability for anaphylaxis history', () => {
      flow.saveResponse('allergy_history', 'yes');
      flow.saveResponse('allergy_medications', ['penicillin']);
      flow.saveResponse('medication_allergy_reaction', 'anaphylaxis');
      flow.saveResponse('anaphylaxis_history', 'yes');

      const questions = flow.getAllQuestions();
      const epipenQuestion = questions.find(q => q.id === 'epipen_available');
      
      expect(epipenQuestion).toBeDefined();
      expect(epipenQuestion?.options).toContain('Always carry EpiPen');
      expect(epipenQuestion?.options).toContain('Family/friends trained to use EpiPen');
    });

    it('should include allergy action plan', () => {
      flow.saveResponse('medication_allergy_severity', 'life_threatening');

      const questions = flow.getAllQuestions();
      const actionPlanQuestion = questions.find(q => q.id === 'allergy_action_plan');
      
      expect(actionPlanQuestion).toBeDefined();
      expect(actionPlanQuestion?.options).toContain('Written action plan available');
      expect(actionPlanQuestion?.options).toContain('Wear medical alert bracelet');
    });
  });

  describe('Integration with Results', () => {
    it('should include crisis intervention in completed domains', () => {
      flow.saveResponse('medication_allergy_severity', 'life_threatening');
      flow.saveResponse('emergency_contact_protocol', ['Emergency contact information verified']);
      flow.saveResponse('crisis_response_plan', ['Call emergency services immediately']);

      const results = flow.generateResults();
      
      expect(results.completedDomains).toContain('crisis_intervention');
      expect(results.totalRiskScore).toBeGreaterThan(0);
    });

    it('should flag high-risk cases requiring immediate attention', () => {
      flow.saveResponse('phq9_9_suicide', 3); // Nearly every day
      flow.saveResponse('suicide_safety_plan', ['Remove access to means', '24/7 crisis hotline saved']);
      flow.saveResponse('immediate_professional_contact', 'yes');

      const results = flow.generateResults();
      
      // Total risk score should be high due to suicide ideation
      expect(results.totalRiskScore).toBeGreaterThan(20);
      expect(results.riskScores.mental_health).toBeGreaterThan(10);
    });
  });

  describe('Emergency Resources Display', () => {
    it('should provide Brazilian emergency numbers', () => {
      const questions = flow.getAllQuestions();
      const supportQuestion = questions.find(q => q.id === 'support_24_7');
      
      const brazilianResources = [
        'CVV - 188 (24/7)',
        'SAMU - 192',
        'Women\'s Support - 180',
        'Police - 190'
      ];
      
      brazilianResources.forEach(resource => {
        expect(supportQuestion?.options).toContain(resource);
      });
    });
  });
});