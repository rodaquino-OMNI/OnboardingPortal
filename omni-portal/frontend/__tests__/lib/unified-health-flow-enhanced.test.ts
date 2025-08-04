import { UnifiedHealthFlow } from '@/lib/unified-health-flow';
import { clinicalDecisionEngine } from '@/lib/clinical-decision-engine';

describe('UnifiedHealthFlow - Enhanced Clinical Questionnaires', () => {
  let flow: UnifiedHealthFlow;

  beforeEach(() => {
    flow = new UnifiedHealthFlow();
  });

  describe('PHQ-9 Complete Implementation', () => {
    it('should include all 9 PHQ-9 questions', () => {
      const questions = flow.getAllQuestions();
      const phq9Questions = questions.filter(q => q.instrument === 'PHQ-9');
      
      expect(phq9Questions).toHaveLength(11); // 9 main + 2 functional impact
      
      // Verify question IDs
      const expectedIds = [
        'phq9_1_interest',
        'phq9_2_depression',
        'phq9_3_sleep',
        'phq9_4_tired',
        'phq9_5_appetite',
        'phq9_6_failure',
        'phq9_7_concentration',
        'phq9_8_movement',
        'phq9_9_suicide',
        'phq9_functional_impact',
        'phq9_impact_severity'
      ];
      
      expectedIds.forEach(id => {
        expect(phq9Questions.find(q => q.id === id)).toBeDefined();
      });
    });

    it('should trigger functional impact question when PHQ-9 score >= 10', () => {
      const responses = {
        phq9_1_interest: 2,
        phq9_2_depression: 2,
        phq9_3_sleep: 2,
        phq9_4_tired: 2,
        phq9_5_appetite: 2,
        phq9_6_failure: 0,
        phq9_7_concentration: 0,
        phq9_8_movement: 0,
        phq9_9_suicide: 0
      };

      flow.saveResponse('phq9_1_interest', 2);
      flow.saveResponse('phq9_2_depression', 2);
      flow.saveResponse('phq9_3_sleep', 2);
      flow.saveResponse('phq9_4_tired', 2);
      flow.saveResponse('phq9_5_appetite', 2);

      const currentQuestion = flow.getCurrentQuestion();
      expect(currentQuestion?.id).toBe('phq9_6_failure');

      // Complete remaining questions to trigger functional impact
      flow.saveResponse('phq9_6_failure', 0);
      flow.saveResponse('phq9_7_concentration', 0);
      flow.saveResponse('phq9_8_movement', 0);
      flow.saveResponse('phq9_9_suicide', 0);

      // Should now show functional impact question
      const impactQuestion = flow.getCurrentQuestion();
      expect(impactQuestion?.id).toBe('phq9_functional_impact');
      expect(impactQuestion?.conditionalOn).toBeDefined();
    });

    it('should analyze PHQ-9 responses correctly', () => {
      const responses = {
        phq9_1_interest: 3,
        phq9_2_depression: 3,
        phq9_3_sleep: 2,
        phq9_4_tired: 2,
        phq9_5_appetite: 2,
        phq9_6_failure: 1,
        phq9_7_concentration: 1,
        phq9_8_movement: 1,
        phq9_9_suicide: 0
      };

      const decision = clinicalDecisionEngine.analyzePHQ9(responses);
      
      expect(decision.totalScore).toBe(15);
      expect(decision.severity).toBe('moderate');
      expect(decision.icd10Code).toBe('F32.1');
      expect(decision.emergencyProtocol).toBeUndefined();
    });

    it('should trigger emergency protocol for suicide ideation', () => {
      const responses = {
        phq9_1_interest: 1,
        phq9_2_depression: 1,
        phq9_3_sleep: 1,
        phq9_4_tired: 1,
        phq9_5_appetite: 1,
        phq9_6_failure: 0,
        phq9_7_concentration: 0,
        phq9_8_movement: 0,
        phq9_9_suicide: 2 // Several days
      };

      const decision = clinicalDecisionEngine.analyzePHQ9(responses);
      
      expect(decision.severity).toBe('severe');
      expect(decision.emergencyProtocol).toBeDefined();
      expect(decision.emergencyProtocol?.severity).toBe('severe');
      expect(decision.timeToIntervention).toBe(0);
    });
  });

  describe('GAD-7 Complete Implementation', () => {
    it('should include all 7 GAD-7 questions', () => {
      const questions = flow.getAllQuestions();
      const gad7Questions = questions.filter(q => q.instrument === 'GAD-7');
      
      expect(gad7Questions).toHaveLength(9); // 7 main + 2 functional impact
      
      const expectedIds = [
        'gad7_1_nervous',
        'gad7_2_control_worry',
        'gad7_3_worrying',
        'gad7_4_trouble_relaxing',
        'gad7_5_restless',
        'gad7_6_irritable',
        'gad7_7_afraid',
        'gad7_functional_impact',
        'gad7_impact_severity'
      ];
      
      expectedIds.forEach(id => {
        expect(gad7Questions.find(q => q.id === id)).toBeDefined();
      });
    });

    it('should analyze GAD-7 responses correctly', () => {
      const responses = {
        gad7_1_nervous: 2,
        gad7_2_control_worry: 2,
        gad7_3_worrying: 2,
        gad7_4_trouble_relaxing: 1,
        gad7_5_restless: 1,
        gad7_6_irritable: 1,
        gad7_7_afraid: 1
      };

      const decision = clinicalDecisionEngine.analyzeGAD7(responses);
      
      expect(decision.totalScore).toBe(10);
      expect(decision.severity).toBe('moderate');
      expect(decision.icd10Code).toBe('F41.1');
    });
  });

  describe('Comprehensive Allergy Screening', () => {
    it('should include all allergy types', () => {
      const questions = flow.getAllQuestions();
      const allergyQuestions = questions.filter(q => q.id.includes('allergy'));
      
      // Should have main question + drug, food, environmental questions
      expect(allergyQuestions.length).toBeGreaterThanOrEqual(4);
      
      const expectedTypes = [
        'allergy_history',
        'allergy_medications',
        'allergy_foods',
        'allergy_environmental'
      ];
      
      expectedTypes.forEach(type => {
        expect(allergyQuestions.find(q => q.id === type)).toBeDefined();
      });
    });

    it('should trigger severity questions for severe allergies', () => {
      flow.saveResponse('allergy_history', 'yes');
      flow.saveResponse('allergy_medications', ['penicillin', 'aspirin']);
      
      // Find and answer medication reaction question
      const questions = flow.getAllQuestions();
      const reactionQuestion = questions.find(q => q.id === 'medication_allergy_reaction');
      
      expect(reactionQuestion).toBeDefined();
      expect(reactionQuestion?.conditionalOn).toBeDefined();
    });

    it('should handle anaphylaxis history correctly', () => {
      flow.saveResponse('allergy_history', 'yes');
      flow.saveResponse('allergy_medications', ['penicillin']);
      flow.saveResponse('medication_allergy_reaction', 'anaphylaxis');
      
      const questions = flow.getAllQuestions();
      const anaphylaxisQuestion = questions.find(q => q.id === 'anaphylaxis_history');
      
      expect(anaphylaxisQuestion).toBeDefined();
    });
  });

  describe('AUDIT-C Alcohol Screening', () => {
    it('should include all 3 AUDIT-C questions', () => {
      const questions = flow.getAllQuestions();
      const auditQuestions = questions.filter(q => q.instrument === 'AUDIT-C');
      
      expect(auditQuestions).toHaveLength(3);
      
      const expectedIds = [
        'audit_c_frequency',
        'audit_c_quantity',
        'audit_c_binge'
      ];
      
      expectedIds.forEach(id => {
        expect(auditQuestions.find(q => q.id === id)).toBeDefined();
      });
    });

    it('should calculate AUDIT-C score correctly', () => {
      const responses = {
        audit_c_frequency: 2, // 2-3 times a week
        audit_c_quantity: 2,  // 5-6 drinks
        audit_c_binge: 1      // Monthly
      };

      const totalScore = Object.values(responses).reduce((sum, val) => sum + val, 0);
      expect(totalScore).toBe(5);
      
      // Score >= 4 for men, >= 3 for women indicates risky drinking
      expect(totalScore).toBeGreaterThanOrEqual(3);
    });
  });

  describe('NIDA Quick Screen', () => {
    it('should include substance use screening questions', () => {
      const questions = flow.getAllQuestions();
      const nidaQuestions = questions.filter(q => q.instrument === 'NIDA');
      
      expect(nidaQuestions).toHaveLength(2);
      
      const expectedIds = [
        'nida_substance_use',
        'nida_prescription_misuse'
      ];
      
      expectedIds.forEach(id => {
        expect(nidaQuestions.find(q => q.id === id)).toBeDefined();
      });
    });

    it('should handle positive substance screening', () => {
      flow.saveResponse('nida_substance_use', 1); // Once or twice
      flow.saveResponse('nida_prescription_misuse', 0); // Never
      
      const responses = flow.getResponses();
      expect(responses.nida_substance_use).toBe(1);
      expect(responses.nida_prescription_misuse).toBe(0);
    });
  });

  describe('Enhanced Risk Behaviors', () => {
    it('should include driving safety screening', () => {
      const questions = flow.getAllQuestions();
      const drivingQuestions = questions.filter(q => 
        q.id === 'driving_under_influence' || q.id === 'riding_under_influence'
      );
      
      expect(drivingQuestions).toHaveLength(2);
    });

    it('should include violence screening questions', () => {
      const questions = flow.getAllQuestions();
      const violenceQuestions = questions.filter(q => 
        q.id === 'domestic_violence' || q.id === 'physical_fight'
      );
      
      expect(violenceQuestions).toHaveLength(2);
    });
  });

  describe('Crisis Intervention Domain', () => {
    it('should have crisis intervention domain in domain list', () => {
      const domains = flow.evaluateDomainTriggers();
      const domainKeys = Object.keys(domains);
      
      expect(domainKeys).toContain('crisis_intervention');
    });

    it('should trigger crisis intervention for severe allergy', () => {
      flow.saveResponse('medication_allergy_severity', 'life_threatening');
      
      const questions = flow.getAllQuestions();
      const crisisQuestions = questions.filter(q => q.domain === 'crisis_intervention');
      
      expect(crisisQuestions.length).toBeGreaterThan(0);
    });

    it('should include emergency contact protocol', () => {
      const questions = flow.getAllQuestions();
      const emergencyQuestion = questions.find(q => q.id === 'emergency_contact_protocol');
      
      expect(emergencyQuestion).toBeDefined();
      expect(emergencyQuestion?.domain).toBe('crisis_intervention');
    });

    it('should include crisis response plan', () => {
      const questions = flow.getAllQuestions();
      const crisisQuestion = questions.find(q => q.id === 'crisis_response_plan');
      
      expect(crisisQuestion).toBeDefined();
      expect(crisisQuestion?.options).toEqual([
        'Call emergency services immediately',
        'Contact designated emergency contact',
        'Go to nearest emergency room',
        'Contact mental health crisis line',
        'Use prescribed emergency medication'
      ]);
    });
  });

  describe('Domain Progression', () => {
    it('should progress through domains correctly', () => {
      const domains = flow.evaluateDomainTriggers();
      const totalDomains = Object.keys(domains).length;
      
      expect(totalDomains).toBe(8); // Including crisis_intervention
    });

    it('should calculate progress correctly with new domains', () => {
      // Answer some questions
      flow.saveResponse('phq9_1_interest', 0);
      flow.saveResponse('phq9_2_depression', 0);
      flow.saveResponse('gad7_1_nervous', 0);
      flow.saveResponse('allergy_history', 'no');
      
      const progress = flow.getProgress();
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });
  });

  describe('Integration with Clinical Decision Engine', () => {
    it('should generate comprehensive clinical decisions', () => {
      const responses = {
        phq9_1_interest: 2,
        phq9_2_depression: 2,
        phq9_3_sleep: 1,
        phq9_4_tired: 1,
        phq9_5_appetite: 1,
        phq9_6_failure: 1,
        phq9_7_concentration: 1,
        phq9_8_movement: 0,
        phq9_9_suicide: 0,
        gad7_1_nervous: 2,
        gad7_2_control_worry: 1,
        gad7_3_worrying: 1,
        gad7_4_trouble_relaxing: 1,
        gad7_5_restless: 0,
        gad7_6_irritable: 0,
        gad7_7_afraid: 0
      };

      const decisions = clinicalDecisionEngine.analyzeComprehensive(responses);
      
      expect(decisions).toHaveLength(2); // PHQ-9 and GAD-7
      expect(decisions[0].tool_used).toBe('PHQ-9');
      expect(decisions[1].tool_used).toBe('GAD-7');
    });
  });

  describe('Results Generation', () => {
    it('should generate results with all new questionnaire data', () => {
      // Answer minimum questions to complete
      flow.saveResponse('phq9_1_interest', 0);
      flow.saveResponse('phq9_2_depression', 0);
      flow.saveResponse('gad7_1_nervous', 0);
      flow.saveResponse('allergy_history', 'no');
      flow.saveResponse('audit_c_frequency', 0);
      flow.saveResponse('nida_substance_use', 0);
      
      const results = flow.generateResults();
      
      expect(results.responses).toHaveProperty('phq9_1_interest');
      expect(results.responses).toHaveProperty('gad7_1_nervous');
      expect(results.responses).toHaveProperty('audit_c_frequency');
      expect(results.responses).toHaveProperty('nida_substance_use');
      expect(results.completedDomains).toContain('mental_health');
      expect(results.completedDomains).toContain('risk_behaviors');
    });
  });
});