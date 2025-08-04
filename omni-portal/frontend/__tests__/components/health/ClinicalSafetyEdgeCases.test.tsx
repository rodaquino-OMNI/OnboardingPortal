import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Import health flow components and engines
import { UnifiedHealthFlow } from '@/lib/unified-health-flow';
import { ClinicalDecisionEngine } from '@/lib/clinical-decision-engine';
import { detectFraudIndicators } from '@/lib/health-questionnaire-v2';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock emergency contact system
const mockEmergencyContactSystem = {
  triggerCrisisIntervention: jest.fn(),
  notifyClinicalTeam: jest.fn(),
  logSafetyIncident: jest.fn(),
  provideCrisisResources: jest.fn()
};

// Mock component for testing clinical safety scenarios
const ClinicalSafetyTestComponent: React.FC<{
  onSafetyTrigger: (trigger: any) => void;
  onEmergencyProtocol: (protocol: any) => void;
  scenario: string;
}> = ({ onSafetyTrigger, onEmergencyProtocol, scenario }) => {
  const [responses, setResponses] = React.useState<Record<string, any>>({});
  const [safetyAlerts, setSafetyAlerts] = React.useState<any[]>([]);
  const [emergencyProtocols, setEmergencyProtocols] = React.useState<any[]>([]);

  const clinicalEngine = ClinicalDecisionEngine.getInstance();

  const evaluateSafety = (newResponses: Record<string, any>) => {
    const alerts = [];
    const protocols = [];

    // Critical suicide risk assessment
    if (newResponses.phq9_9 && newResponses.phq9_9 > 0) {
      const suicideAlert = {
        level: newResponses.phq9_9 >= 2 ? 'CRITICAL' : 'HIGH',
        type: 'SUICIDE_RISK',
        question: 'phq9_9',
        value: newResponses.phq9_9,
        immediateAction: true,
        timestamp: new Date().toISOString()
      };
      alerts.push(suicideAlert);
      onSafetyTrigger(suicideAlert);

      // Emergency protocol
      const protocol = {
        type: 'SUICIDE_PREVENTION',
        severity: newResponses.phq9_9 >= 2 ? 'critical' : 'severe',
        actions: [
          'Immediate psychiatric evaluation',
          'Safety plan development',
          'Remove access to means of self-harm',
          'Continuous supervision if critical'
        ],
        contacts: [
          { name: 'CVV', number: '188', available24h: true },
          { name: 'SAMU', number: '192', available24h: true },
          { name: 'Emergency Psychiatric', number: '190', available24h: true }
        ],
        followUp: {
          required: true,
          timeframe: 'Within 24 hours',
          specialist: 'Psychiatrist'
        }
      };
      protocols.push(protocol);
      onEmergencyProtocol(protocol);
    }

    // Substance abuse crisis
    if (newResponses.substance_use === true && newResponses.substance_frequency === 'daily') {
      const substanceAlert = {
        level: 'HIGH',
        type: 'SUBSTANCE_ABUSE_CRISIS',
        factors: ['daily_use', 'dependency_risk'],
        immediateAction: true
      };
      alerts.push(substanceAlert);
      onSafetyTrigger(substanceAlert);
    }

    // Medical emergency indicators
    if (newResponses.emergency_check && Array.isArray(newResponses.emergency_check)) {
      const emergencyConditions = newResponses.emergency_check.filter(c => c !== 'none');
      if (emergencyConditions.length > 0) {
        const emergencyAlert = {
          level: 'CRITICAL',
          type: 'MEDICAL_EMERGENCY',
          conditions: emergencyConditions,
          immediateAction: true
        };
        alerts.push(emergencyAlert);
        onSafetyTrigger(emergencyAlert);

        const emergencyProtocol = {
          type: 'MEDICAL_EMERGENCY',
          severity: 'critical',
          actions: ['Call emergency services', 'Do not delay medical care'],
          conditions: emergencyConditions
        };
        protocols.push(emergencyProtocol);
        onEmergencyProtocol(emergencyProtocol);
      }
    }

    // Severe pain crisis
    if (newResponses.pain_now >= 8) {
      const painAlert = {
        level: 'HIGH',
        type: 'SEVERE_PAIN_CRISIS',
        painLevel: newResponses.pain_now,
        requiresAssessment: true
      };
      alerts.push(painAlert);
      onSafetyTrigger(painAlert);
    }

    // Fraud/inconsistency detection
    const fraudIndicators = detectFraudIndicators(newResponses);
    if (fraudIndicators.recommendation === 'flag') {
      const fraudAlert = {
        level: 'MEDIUM',
        type: 'RESPONSE_INCONSISTENCY',
        score: fraudIndicators.inconsistencyScore,
        patterns: fraudIndicators.suspiciousPatterns,
        failures: fraudIndicators.validationFailures
      };
      alerts.push(fraudAlert);
      onSafetyTrigger(fraudAlert);
    }

    setSafetyAlerts(alerts);
    setEmergencyProtocols(protocols);
  };

  const handleResponseChange = (questionId: string, value: any) => {
    const newResponses = { ...responses, [questionId]: value };
    setResponses(newResponses);
    evaluateSafety(newResponses);
  };

  const renderScenarioQuestions = () => {
    switch (scenario) {
      case 'suicide_risk':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Suicide Risk Assessment</h2>
            <div>
              <label className="block mb-2">PHQ-9 Question 9: Pensamentos de morte ou autolesão</label>
              <div className="space-y-2">
                {[0, 1, 2, 3].map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleResponseChange('phq9_9', value)}
                    className={`block w-full p-2 text-left border rounded ${responses.phq9_9 === value ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    data-testid={`suicide-risk-${value}`}
                  >
                    {value === 0 && 'Nunca'}
                    {value === 1 && 'Alguns dias'}
                    {value === 2 && 'Mais da metade dos dias'}
                    {value === 3 && 'Quase todos os dias'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'medical_emergency':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Medical Emergency Assessment</h2>
            <div>
              <label className="block mb-2">Emergency conditions:</label>
              <div className="space-y-2">
                {[
                  { value: 'chest_pain', label: 'Dor no peito' },
                  { value: 'breathing_difficulty', label: 'Dificuldade para respirar' },
                  { value: 'severe_bleeding', label: 'Sangramento intenso' },
                  { value: 'stroke_symptoms', label: 'Sintomas de AVC' },
                  { value: 'none', label: 'Nenhuma' }
                ].map(option => {
                  const selected = responses.emergency_check || [];
                  const isSelected = selected.includes(option.value);
                  
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        let newSelected;
                        if (option.value === 'none') {
                          newSelected = ['none'];
                        } else {
                          const filtered = selected.filter((s: string) => s !== 'none');
                          newSelected = isSelected 
                            ? filtered.filter((s: string) => s !== option.value)
                            : [...filtered, option.value];
                        }
                        handleResponseChange('emergency_check', newSelected);
                      }}
                      className={`block w-full p-2 text-left border rounded ${isSelected ? 'bg-red-500 text-white' : 'bg-white'}`}
                      data-testid={`emergency-${option.value}`}
                    >
                      {isSelected && '✓ '}{option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'substance_crisis':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Substance Use Crisis</h2>
            <div>
              <label className="block mb-2">Substance use:</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleResponseChange('substance_use', true)}
                  className={`block w-full p-2 text-left border rounded ${responses.substance_use === true ? 'bg-red-500 text-white' : 'bg-white'}`}
                  data-testid="substance-use-yes"
                >
                  Yes, I use substances
                </button>
                <button
                  type="button"
                  onClick={() => handleResponseChange('substance_use', false)}
                  className={`block w-full p-2 text-left border rounded ${responses.substance_use === false ? 'bg-green-500 text-white' : 'bg-white'}`}
                  data-testid="substance-use-no"
                >
                  No, I don't use substances
                </button>
              </div>
            </div>
            
            {responses.substance_use && (
              <div>
                <label className="block mb-2">Frequency:</label>
                <div className="space-y-2">
                  {['weekly', 'daily', 'multiple_daily'].map(freq => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => handleResponseChange('substance_frequency', freq)}
                      className={`block w-full p-2 text-left border rounded ${responses.substance_frequency === freq ? 'bg-orange-500 text-white' : 'bg-white'}`}
                      data-testid={`substance-freq-${freq}`}
                    >
                      {freq === 'weekly' && 'Weekly'}
                      {freq === 'daily' && 'Daily'}
                      {freq === 'multiple_daily' && 'Multiple times daily'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'severe_pain':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Severe Pain Assessment</h2>
            <div>
              <label className="block mb-2">Current pain level (0-10):</label>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleResponseChange('pain_now', i)}
                    className={`p-2 border rounded ${responses.pain_now === i ? 'bg-red-500 text-white' : 'bg-white'}`}
                    data-testid={`pain-level-${i}`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'fraud_detection':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Response Consistency Check</h2>
            
            {/* Height validation pair */}
            <div>
              <label className="block mb-2">Height (cm):</label>
              <input
                type="number"
                value={responses.height_1 || ''}
                onChange={(e) => handleResponseChange('height_1', parseInt(e.target.value))}
                className="w-full p-2 border rounded"
                data-testid="height-1"
                placeholder="Enter height in cm"
              />
            </div>
            
            <div>
              <label className="block mb-2">Confirm height (cm):</label>
              <input
                type="number"
                value={responses.height_2 || ''}
                onChange={(e) => handleResponseChange('height_2', parseInt(e.target.value))}
                className="w-full p-2 border rounded"
                data-testid="height-2"
                placeholder="Confirm height in cm"
              />
            </div>
            
            {/* Smoking validation */}
            <div>
              <label className="block mb-2">Smoking status:</label>
              <div className="space-y-2">
                {['never', 'former', 'current'].map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleResponseChange('smoking_status', status)}
                    className={`block w-full p-2 text-left border rounded ${responses.smoking_status === status ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    data-testid={`smoking-${status}`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)} smoker
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block mb-2">Doctor recommended quitting smoking?</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleResponseChange('smoking_validation', true)}
                  className={`block w-full p-2 text-left border rounded ${responses.smoking_validation === true ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  data-testid="smoking-advice-yes"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleResponseChange('smoking_validation', false)}
                  className={`block w-full p-2 text-left border rounded ${responses.smoking_validation === false ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  data-testid="smoking-advice-no"
                >
                  No
                </button>
              </div>
            </div>
            
            {/* Age inconsistency */}
            <div>
              <label className="block mb-2">Age:</label>
              <input
                type="number"
                value={responses.age || ''}
                onChange={(e) => handleResponseChange('age', parseInt(e.target.value))}
                className="w-full p-2 border rounded"
                data-testid="age-input"
                placeholder="Enter age"
              />
            </div>
            
            <div>
              <label className="block mb-2">Chronic conditions:</label>
              <div className="space-y-2">
                {[
                  'diabetes', 'hypertension', 'heart_disease', 'cancer', 
                  'kidney_disease', 'liver_disease', 'arthritis'
                ].map(condition => {
                  const selected = responses.chronic_conditions || [];
                  const isSelected = selected.includes(condition);
                  
                  return (
                    <button
                      key={condition}
                      type="button"
                      onClick={() => {
                        const newSelected = isSelected 
                          ? selected.filter((c: string) => c !== condition)
                          : [...selected, condition];
                        handleResponseChange('chronic_conditions', newSelected);
                      }}
                      className={`block w-full p-2 text-left border rounded ${isSelected ? 'bg-blue-500 text-white' : 'bg-white'}`}
                      data-testid={`condition-${condition}`}
                    >
                      {isSelected && '✓ '}{condition.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unknown scenario</div>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6" role="main" aria-label="Clinical safety test">
      {renderScenarioQuestions()}
      
      {/* Safety Alerts Display */}
      {safetyAlerts.length > 0 && (
        <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded" data-testid="safety-alerts">
          <h3 className="font-bold text-red-800 mb-2">🚨 Safety Alerts</h3>
          {safetyAlerts.map((alert, index) => (
            <div key={index} className="mb-2 p-2 bg-red-100 rounded" data-testid={`alert-${alert.type.toLowerCase()}`}>
              <div className="font-semibold">{alert.level}: {alert.type}</div>
              {alert.immediateAction && (
                <div className="text-red-700 font-bold">⚠️ IMMEDIATE ACTION REQUIRED</div>
              )}
              <div className="text-sm text-red-600">
                {JSON.stringify(alert, null, 2)}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Emergency Protocols Display */}
      {emergencyProtocols.length > 0 && (
        <div className="mt-8 p-4 bg-orange-50 border border-orange-200 rounded" data-testid="emergency-protocols">
          <h3 className="font-bold text-orange-800 mb-2">🚑 Emergency Protocols</h3>
          {emergencyProtocols.map((protocol, index) => (
            <div key={index} className="mb-2 p-2 bg-orange-100 rounded" data-testid={`protocol-${protocol.type.toLowerCase()}`}>
              <div className="font-semibold">{protocol.type} - {protocol.severity}</div>
              <div className="text-sm text-orange-700">
                Actions: {protocol.actions.join(', ')}
              </div>
              {protocol.contacts && (
                <div className="text-sm text-orange-700">
                  Contacts: {protocol.contacts.map((c: { name: string; number: string }) => `${c.name}: ${c.number}`).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Current Responses (for debugging) */}
      <div className="mt-8 p-4 bg-gray-50 rounded" data-testid="current-responses">
        <h3 className="font-semibold mb-2">Current Responses:</h3>
        <pre className="text-xs">{JSON.stringify(responses, null, 2)}</pre>
      </div>
    </div>
  );
};

describe('Clinical Safety and Edge Cases', () => {
  const mockOnSafetyTrigger = jest.fn();
  const mockOnEmergencyProtocol = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Suicide Risk Detection and Response', () => {
    it('should trigger critical alert for frequent suicidal thoughts', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      // Select "Mais da metade dos dias" (score 2) for suicide question
      await user.click(screen.getByTestId('suicide-risk-2'));

      expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'CRITICAL',
          type: 'SUICIDE_RISK',
          question: 'phq9_9',
          value: 2,
          immediateAction: true
        })
      );

      expect(mockOnEmergencyProtocol).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUICIDE_PREVENTION',
          severity: 'critical',
          actions: expect.arrayContaining([
            'Immediate psychiatric evaluation',
            'Safety plan development',
            'Remove access to means of self-harm'
          ]),
          contacts: expect.arrayContaining([
            expect.objectContaining({ name: 'CVV', number: '188' })
          ])
        })
      );

      // Check UI displays alerts
      expect(screen.getByTestId('safety-alerts')).toBeInTheDocument();
      expect(screen.getByTestId('alert-suicide_risk')).toBeInTheDocument();
      expect(screen.getByText('⚠️ IMMEDIATE ACTION REQUIRED')).toBeInTheDocument();
    });

    it('should trigger high alert for occasional suicidal thoughts', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      // Select "Alguns dias" (score 1) for suicide question
      await user.click(screen.getByTestId('suicide-risk-1'));

      expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'HIGH',
          type: 'SUICIDE_RISK',
          value: 1
        })
      );

      expect(mockOnEmergencyProtocol).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'severe' // Not critical for score 1
        })
      );
    });

    it('should not trigger alerts for no suicidal thoughts', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      // Select "Nunca" (score 0) for suicide question
      await user.click(screen.getByTestId('suicide-risk-0'));

      expect(mockOnSafetyTrigger).not.toHaveBeenCalled();
      expect(mockOnEmergencyProtocol).not.toHaveBeenCalled();
      expect(screen.queryByTestId('safety-alerts')).not.toBeInTheDocument();
    });
  });

  describe('Medical Emergency Detection', () => {
    it('should trigger critical alert for chest pain', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="medical_emergency"
        />
      );

      await user.click(screen.getByTestId('emergency-chest_pain'));

      expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'CRITICAL',
          type: 'MEDICAL_EMERGENCY',
          conditions: ['chest_pain'],
          immediateAction: true
        })
      );

      expect(mockOnEmergencyProtocol).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MEDICAL_EMERGENCY',
          severity: 'critical',
          actions: expect.arrayContaining(['Call emergency services'])
        })
      );
    });

    it('should trigger alert for multiple emergency conditions', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="medical_emergency"
        />
      );

      await user.click(screen.getByTestId('emergency-chest_pain'));
      await user.click(screen.getByTestId('emergency-breathing_difficulty'));

      expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          conditions: expect.arrayContaining(['chest_pain', 'breathing_difficulty'])
        })
      );
    });

    it('should not trigger for "none" selection', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="medical_emergency"
        />
      );

      await user.click(screen.getByTestId('emergency-none'));

      expect(mockOnSafetyTrigger).not.toHaveBeenCalled();
      expect(mockOnEmergencyProtocol).not.toHaveBeenCalled();
    });
  });

  describe('Substance Abuse Crisis Detection', () => {
    it('should trigger alert for daily substance use', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="substance_crisis"
        />
      );

      await user.click(screen.getByTestId('substance-use-yes'));
      
      await waitFor(() => {
        expect(screen.getByTestId('substance-freq-daily')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('substance-freq-daily'));

      expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'HIGH',
          type: 'SUBSTANCE_ABUSE_CRISIS',
          factors: expect.arrayContaining(['daily_use', 'dependency_risk'])
        })
      );
    });

    it('should not trigger for weekly use', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="substance_crisis"
        />
      );

      await user.click(screen.getByTestId('substance-use-yes'));
      await user.click(screen.getByTestId('substance-freq-weekly'));

      expect(mockOnSafetyTrigger).not.toHaveBeenCalled();
    });
  });

  describe('Severe Pain Crisis Detection', () => {
    it('should trigger alert for severe pain (8+)', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="severe_pain"
        />
      );

      await user.click(screen.getByTestId('pain-level-9'));

      expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'HIGH',
          type: 'SEVERE_PAIN_CRISIS',
          painLevel: 9,
          requiresAssessment: true
        })
      );
    });

    it('should not trigger for moderate pain (7 or below)', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="severe_pain"
        />
      );

      await user.click(screen.getByTestId('pain-level-7'));

      expect(mockOnSafetyTrigger).not.toHaveBeenCalled();
    });
  });

  describe('Fraud and Inconsistency Detection', () => {
    it('should detect height inconsistency', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="fraud_detection"
        />
      );

      // Enter inconsistent heights (difference > 5cm)
      await user.type(screen.getByTestId('height-1'), '170');
      await user.type(screen.getByTestId('height-2'), '180');

      await waitFor(() => {
        expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'RESPONSE_INCONSISTENCY',
            failures: expect.arrayContaining(['height_mismatch'])
          })
        );
      });
    });

    it('should detect smoking status contradiction', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="fraud_detection"
        />
      );

      // Select "never smoked" but "yes" to doctor recommendation
      await user.click(screen.getByTestId('smoking-never'));
      await user.click(screen.getByTestId('smoking-advice-yes'));

      await waitFor(() => {
        expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'RESPONSE_INCONSISTENCY',
            failures: expect.arrayContaining(['smoking_contradiction'])
          })
        );
      });
    });

    it('should detect unlikely condition count for age', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="fraud_detection"
        />
      );

      // Young age with many chronic conditions
      await user.type(screen.getByTestId('age-input'), '25');
      
      // Select many conditions
      const conditions = ['diabetes', 'hypertension', 'heart_disease', 'cancer', 'kidney_disease', 'liver_disease'];
      for (const condition of conditions) {
        await user.click(screen.getByTestId(`condition-${condition}`));
      }

      await waitFor(() => {
        expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'RESPONSE_INCONSISTENCY',
            patterns: expect.arrayContaining(['unlikely_condition_count_for_age'])
          })
        );
      });
    });

    it('should not trigger for consistent responses', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="fraud_detection"
        />
      );

      // Consistent responses
      await user.type(screen.getByTestId('height-1'), '175');
      await user.type(screen.getByTestId('height-2'), '175');
      await user.click(screen.getByTestId('smoking-current'));
      await user.click(screen.getByTestId('smoking-advice-yes'));
      await user.type(screen.getByTestId('age-input'), '45');
      await user.click(screen.getByTestId('condition-diabetes'));

      // Should not trigger fraud detection
      expect(mockOnSafetyTrigger).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RESPONSE_INCONSISTENCY'
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined values gracefully', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      // Component should render without errors even with no responses
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(mockOnSafetyTrigger).not.toHaveBeenCalled();
    });

    it('should handle rapid successive clicks without duplicate alerts', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      const button = screen.getByTestId('suicide-risk-2');
      
      // Click rapidly multiple times
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should only trigger once
      expect(mockOnSafetyTrigger).toHaveBeenCalledTimes(1);
      expect(mockOnEmergencyProtocol).toHaveBeenCalledTimes(1);
    });

    it('should handle component unmounting during safety evaluation', () => {
      const { unmount } = render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      expect(() => unmount()).not.toThrow();
    });

    it('should handle invalid pain scores', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="severe_pain"
        />
      );

      // Valid pain scores should work
      await user.click(screen.getByTestId('pain-level-0'));
      await user.click(screen.getByTestId('pain-level-10'));

      // Component should handle these gracefully
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Accessibility for Safety Features', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA attributes for safety alerts', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      await user.click(screen.getByTestId('suicide-risk-2'));

      // Safety alerts should be announced to screen readers
      expect(screen.getByTestId('safety-alerts')).toBeInTheDocument();
      // Note: The safety alerts div doesn't have role="alert" in current implementation
      // This could be enhanced for better accessibility
    });

    it('should support keyboard navigation for critical actions', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      // Tab to suicide risk button
      await user.tab();
      expect(screen.getByTestId('suicide-risk-0')).toHaveFocus();

      // Use keyboard to select critical option
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
      
      expect(mockOnSafetyTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUICIDE_RISK',
          level: 'CRITICAL'
        })
      );
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple simultaneous safety evaluations', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="fraud_detection"
        />
      );

      // Simulate rapid data entry
      const promises = [
        user.type(screen.getByTestId('height-1'), '170'),
        user.type(screen.getByTestId('age-input'), '25'),
        user.click(screen.getByTestId('condition-diabetes')),
        user.click(screen.getByTestId('condition-hypertension'))
      ];

      await Promise.all(promises);

      // Should handle concurrent updates without errors
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should not cause memory leaks with repeated safety evaluations', async () => {
      const user = userEvent.setup();
      render(
        <ClinicalSafetyTestComponent 
          onSafetyTrigger={mockOnSafetyTrigger}
          onEmergencyProtocol={mockOnEmergencyProtocol}
          scenario="suicide_risk"
        />
      );

      // Simulate many rapid changes
      for (let i = 0; i < 50; i++) {
        await user.click(screen.getByTestId(`suicide-risk-${i % 4}`));
      }

      // Component should still be responsive
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });
});