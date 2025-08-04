import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock the UnifiedHealthFlow
const mockUnifiedHealthFlow = {
  processResponse: jest.fn(),
  getResponses: jest.fn(() => ({})),
  getCurrentDomain: jest.fn(() => 'Triage'),
  getCurrentLayer: jest.fn(() => 'Initial Assessment')
};

// Mock component that tests risk behaviors domain triggering
const RiskBehaviorsDomainTest: React.FC<{
  onDomainTriggered: (domain: string) => void;
  initialResponses?: Record<string, any>;
}> = ({ onDomainTriggered, initialResponses = {} }) => {
  const [responses, setResponses] = React.useState<Record<string, any>>(initialResponses);
  const [triggeredDomains, setTriggeredDomains] = React.useState<string[]>([]);

  // Risk behavior trigger conditions based on unified-health-flow.ts
  const riskBehaviorTriggers = [
    {
      condition: { questionId: 'substance_use', operator: '=', value: true },
      action: 'enter_domain',
      targetDomain: 'substance_monitoring'
    },
    {
      condition: { questionId: 'pain_medications', operator: 'includes', value: 'opioids' },
      action: 'enter_domain', 
      targetDomain: 'substance_monitoring'
    },
    {
      condition: { questionId: 'smoking_status', operator: '=', value: 'current' },
      action: 'enter_domain',
      targetDomain: 'substance_monitoring'
    },
    {
      condition: { questionId: 'alcohol_consumption', operator: '>=', value: 'frequent' },
      action: 'enter_domain',
      targetDomain: 'substance_monitoring'
    },
    {
      condition: { questionId: 'driving_unsafe', operator: '=', value: true },
      action: 'enter_domain',
      targetDomain: 'risk_behaviors'
    },
    {
      condition: { questionId: 'risky_sexual_behavior', operator: '=', value: true },
      action: 'enter_domain',
      targetDomain: 'risk_behaviors'
    }
  ];

  const evaluateCondition = (condition: any, value: any): boolean => {
    switch (condition.operator) {
      case '>=': return value >= condition.value;
      case '>': return value > condition.value;
      case '=': return value === condition.value;
      case '<=': return value <= condition.value;
      case '<': return value < condition.value;
      case 'includes': return Array.isArray(value) && value.includes(condition.value);
      case 'excludes': return Array.isArray(value) && !value.includes(condition.value);
      default: return false;
    }
  };

  const handleResponseChange = (questionId: string, value: any) => {
    const newResponses = { ...responses, [questionId]: value };
    setResponses(newResponses);

    // Check for domain triggers
    for (const trigger of riskBehaviorTriggers) {
      const responseValue = newResponses[trigger.condition.questionId];
      if (responseValue !== undefined && evaluateCondition(trigger.condition, responseValue)) {
        if (!triggeredDomains.includes(trigger.targetDomain)) {
          const newDomains = [...triggeredDomains, trigger.targetDomain];
          setTriggeredDomains(newDomains);
          onDomainTriggered(trigger.targetDomain);
        }
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6" role="main" aria-label="Risk behaviors assessment">
      <h1 className="text-2xl font-bold mb-6">Risk Behaviors Assessment</h1>
      
      {/* Substance Use Questions */}
      <div className="space-y-6 mb-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Substance Use</h2>
          <fieldset>
            <legend className="text-base font-medium mb-3">
              Você já usou substâncias não prescritas para lidar com stress ou problemas?
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleResponseChange('substance_use', true)}
                className={`p-3 border rounded ${responses.substance_use === true ? 'bg-red-500 text-white' : 'bg-white'}`}
                role="radio"
                aria-checked={responses.substance_use === true}
                data-testid="substance-use-yes"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => handleResponseChange('substance_use', false)}
                className={`p-3 border rounded ${responses.substance_use === false ? 'bg-green-500 text-white' : 'bg-white'}`}
                role="radio"
                aria-checked={responses.substance_use === false}
                data-testid="substance-use-no"
              >
                Não
              </button>
            </div>
          </fieldset>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Pain Medications</h2>
          <fieldset>
            <legend className="text-base font-medium mb-3">
              Você toma algum medicamento para dor?
            </legend>
            <div className="space-y-2">
              {[
                { value: 'none', label: 'Não tomo medicamentos' },
                { value: 'otc_analgesics', label: 'Analgésicos sem receita' },
                { value: 'prescription_pain', label: 'Medicamentos prescritos para dor' },
                { value: 'opioids', label: 'Opioides (morfina, codeína, tramadol)' },
                { value: 'topical', label: 'Pomadas e géis' }
              ].map(option => {
                const selectedMeds = responses.pain_medications || [];
                const isSelected = selectedMeds.includes(option.value);
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      let newMeds;
                      if (option.value === 'none') {
                        newMeds = ['none'];
                      } else if (selectedMeds.includes('none')) {
                        newMeds = [option.value];
                      } else {
                        newMeds = isSelected
                          ? selectedMeds.filter((m: string) => m !== option.value)
                          : [...selectedMeds, option.value];
                      }
                      handleResponseChange('pain_medications', newMeds);
                    }}
                    className={`w-full p-3 text-left border rounded ${isSelected ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    role="checkbox"
                    aria-checked={isSelected}
                    data-testid={`pain-med-${option.value}`}
                  >
                    {isSelected && <span className="mr-2">✓</span>}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Smoking Status</h2>
          <fieldset>
            <legend className="text-base font-medium mb-3">
              Qual é sua situação em relação ao cigarro?
            </legend>
            <div className="space-y-2">
              {[
                { value: 'never', label: 'Nunca fumei' },
                { value: 'former', label: 'Ex-fumante' },
                { value: 'current', label: 'Fumante atual' }
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleResponseChange('smoking_status', option.value)}
                  className={`w-full p-3 text-left border rounded ${responses.smoking_status === option.value ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  role="radio"
                  aria-checked={responses.smoking_status === option.value}
                  data-testid={`smoking-${option.value}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Alcohol Consumption</h2>
          <fieldset>
            <legend className="text-base font-medium mb-3">
              Com que frequência você consome bebidas alcoólicas?
            </legend>
            <div className="space-y-2">
              {[
                { value: 'never', label: 'Nunca' },
                { value: 'monthly', label: 'Mensalmente ou menos' },
                { value: 'weekly', label: '2-4 vezes por mês' },
                { value: 'frequent', label: '2-3 vezes por semana' },
                { value: 'daily', label: '4 ou mais vezes por semana' }
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleResponseChange('alcohol_consumption', option.value)}
                  className={`w-full p-3 text-left border rounded ${responses.alcohol_consumption === option.value ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  role="radio"
                  aria-checked={responses.alcohol_consumption === option.value}
                  data-testid={`alcohol-${option.value}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Driving Safety</h2>
          <fieldset>
            <legend className="text-base font-medium mb-3">
              Você dirige sob efeito de álcool ou substâncias, ou não usa cinto de segurança?
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleResponseChange('driving_unsafe', true)}
                className={`p-3 border rounded ${responses.driving_unsafe === true ? 'bg-red-500 text-white' : 'bg-white'}`}
                role="radio"
                aria-checked={responses.driving_unsafe === true}
                data-testid="driving-unsafe-yes"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => handleResponseChange('driving_unsafe', false)}
                className={`p-3 border rounded ${responses.driving_unsafe === false ? 'bg-green-500 text-white' : 'bg-white'}`}
                role="radio"
                aria-checked={responses.driving_unsafe === false}
                data-testid="driving-unsafe-no"
              >
                Não
              </button>
            </div>
          </fieldset>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Sexual Health</h2>
          <fieldset>
            <legend className="text-base font-medium mb-3">
              Você pratica comportamentos sexuais de risco (múltiplos parceiros sem proteção)?
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleResponseChange('risky_sexual_behavior', true)}
                className={`p-3 border rounded ${responses.risky_sexual_behavior === true ? 'bg-red-500 text-white' : 'bg-white'}`}
                role="radio"
                aria-checked={responses.risky_sexual_behavior === true}
                data-testid="risky-sexual-yes"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => handleResponseChange('risky_sexual_behavior', false)}
                className={`p-3 border rounded ${responses.risky_sexual_behavior === false ? 'bg-green-500 text-white' : 'bg-white'}`}
                role="radio"
                aria-checked={responses.risky_sexual_behavior === false}
                data-testid="risky-sexual-no"
              >
                Não
              </button>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Display triggered domains */}
      {triggeredDomains.length > 0 && (
        <div className="mt-8 p-4 border border-yellow-300 bg-yellow-50 rounded" data-testid="triggered-domains">
          <h3 className="font-semibold text-yellow-800 mb-2">Domínios Acionados:</h3>
          <ul className="list-disc list-inside text-yellow-700">
            {triggeredDomains.map(domain => (
              <li key={domain} data-testid={`triggered-domain-${domain}`}>
                {domain === 'substance_monitoring' ? 'Monitoramento de Substâncias' : 'Comportamentos de Risco'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Display current responses for debugging */}
      <div className="mt-8 p-4 bg-gray-50 rounded" data-testid="current-responses">
        <h3 className="font-semibold mb-2">Respostas Atuais:</h3>
        <pre className="text-xs">{JSON.stringify(responses, null, 2)}</pre>
      </div>
    </div>
  );
};

describe('RiskBehaviorsDomainTrigger', () => {
  const mockOnDomainTriggered = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Substance Use Triggers', () => {
    it('should trigger substance monitoring domain when substance use is confirmed', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Answer yes to substance use
      await user.click(screen.getByTestId('substance-use-yes'));

      // Should trigger substance monitoring domain
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
      expect(screen.getByTestId('triggered-domains')).toBeInTheDocument();
      expect(screen.getByTestId('triggered-domain-substance_monitoring')).toBeInTheDocument();
    });

    it('should not trigger domain when substance use is denied', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Answer no to substance use
      await user.click(screen.getByTestId('substance-use-no'));

      // Should not trigger any domain
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
      expect(screen.queryByTestId('triggered-domains')).not.toBeInTheDocument();
    });
  });

  describe('Opioid Medication Triggers', () => {
    it('should trigger substance monitoring when opioids are selected', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select opioids for pain medication
      await user.click(screen.getByTestId('pain-med-opioids'));

      // Should trigger substance monitoring domain
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
      expect(screen.getByTestId('triggered-domain-substance_monitoring')).toBeInTheDocument();
    });

    it('should not trigger when only non-opioid medications are selected', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select only non-opioid medications
      await user.click(screen.getByTestId('pain-med-otc_analgesics'));
      await user.click(screen.getByTestId('pain-med-topical'));

      // Should not trigger substance monitoring domain
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
      expect(screen.queryByTestId('triggered-domains')).not.toBeInTheDocument();
    });

    it('should trigger when opioids are selected along with other medications', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select multiple medications including opioids
      await user.click(screen.getByTestId('pain-med-otc_analgesics'));
      await user.click(screen.getByTestId('pain-med-opioids'));

      // Should trigger substance monitoring domain
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
    });
  });

  describe('Smoking Status Triggers', () => {
    it('should trigger substance monitoring for current smokers', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select current smoker
      await user.click(screen.getByTestId('smoking-current'));

      // Should trigger substance monitoring domain
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
      expect(screen.getByTestId('triggered-domain-substance_monitoring')).toBeInTheDocument();
    });

    it('should not trigger for never smokers', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select never smoker
      await user.click(screen.getByTestId('smoking-never'));

      // Should not trigger any domain
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
    });

    it('should not trigger for former smokers', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select former smoker
      await user.click(screen.getByTestId('smoking-former'));

      // Should not trigger substance monitoring (different risk level)
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
    });
  });

  describe('Alcohol Consumption Triggers', () => {
    it('should trigger substance monitoring for frequent drinking', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select frequent alcohol consumption
      await user.click(screen.getByTestId('alcohol-frequent'));

      // Should trigger substance monitoring domain
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
      expect(screen.getByTestId('triggered-domain-substance_monitoring')).toBeInTheDocument();
    });

    it('should trigger substance monitoring for daily drinking', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select daily alcohol consumption
      await user.click(screen.getByTestId('alcohol-daily'));

      // Should trigger substance monitoring domain
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
    });

    it('should not trigger for occasional drinking', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select monthly drinking
      await user.click(screen.getByTestId('alcohol-monthly'));

      // Should not trigger domain
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
    });

    it('should not trigger for never drinking', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select never drinking
      await user.click(screen.getByTestId('alcohol-never'));

      // Should not trigger domain
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
    });
  });

  describe('Driving Safety Triggers', () => {
    it('should trigger risk behaviors domain for unsafe driving', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Answer yes to unsafe driving
      await user.click(screen.getByTestId('driving-unsafe-yes'));

      // Should trigger risk behaviors domain
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('risk_behaviors');
      expect(screen.getByTestId('triggered-domain-risk_behaviors')).toBeInTheDocument();
    });

    it('should not trigger for safe driving', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Answer no to unsafe driving
      await user.click(screen.getByTestId('driving-unsafe-no'));

      // Should not trigger domain
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
    });
  });

  describe('Sexual Health Triggers', () => {
    it('should trigger risk behaviors domain for risky sexual behavior', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Answer yes to risky sexual behavior
      await user.click(screen.getByTestId('risky-sexual-yes'));

      // Should trigger risk behaviors domain
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('risk_behaviors');
      expect(screen.getByTestId('triggered-domain-risk_behaviors')).toBeInTheDocument();
    });

    it('should not trigger for safe sexual behavior', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Answer no to risky sexual behavior
      await user.click(screen.getByTestId('risky-sexual-no'));

      // Should not trigger domain
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Domain Triggers', () => {
    it('should trigger multiple domains for different risk behaviors', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Answer yes to substance use (triggers substance_monitoring)
      await user.click(screen.getByTestId('substance-use-yes'));
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');

      // Answer yes to unsafe driving (triggers risk_behaviors)
      await user.click(screen.getByTestId('driving-unsafe-yes'));
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('risk_behaviors');

      // Should show both triggered domains
      expect(screen.getByTestId('triggered-domain-substance_monitoring')).toBeInTheDocument();
      expect(screen.getByTestId('triggered-domain-risk_behaviors')).toBeInTheDocument();
    });

    it('should not trigger duplicate domains', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Trigger substance monitoring twice with different conditions
      await user.click(screen.getByTestId('substance-use-yes'));
      await user.click(screen.getByTestId('smoking-current'));

      // Should only trigger once
      expect(mockOnDomainTriggered).toHaveBeenCalledTimes(1);
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
    });
  });

  describe('Domain Priority and Logic', () => {
    it('should handle complex medication selection logic', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // First select "none"
      await user.click(screen.getByTestId('pain-med-none'));

      // Then select opioids - should clear "none" and trigger domain
      await user.click(screen.getByTestId('pain-med-opioids'));

      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
    });

    it('should properly evaluate array-based conditions', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select multiple medications including opioids
      await user.click(screen.getByTestId('pain-med-prescription_pain'));
      await user.click(screen.getByTestId('pain-med-opioids'));
      await user.click(screen.getByTestId('pain-med-topical'));

      // Should trigger because opioids is included in the array
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper radio group behavior', async () => {
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      const yesRadio = screen.getByTestId('substance-use-yes');
      const noRadio = screen.getByTestId('substance-use-no');

      expect(yesRadio).toHaveAttribute('role', 'radio');
      expect(noRadio).toHaveAttribute('role', 'radio');
      expect(yesRadio).toHaveAttribute('aria-checked', 'false');
      expect(noRadio).toHaveAttribute('aria-checked', 'false');
    });

    it('should have proper checkbox behavior for multiselect', async () => {
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      const opioidCheckbox = screen.getByTestId('pain-med-opioids');
      
      expect(opioidCheckbox).toHaveAttribute('role', 'checkbox');
      expect(opioidCheckbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Tab to first interactive element
      await user.tab();
      expect(screen.getByTestId('substance-use-yes')).toHaveFocus();

      // Use keyboard to select
      await user.keyboard('{Enter}');
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid successive clicks', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      const button = screen.getByTestId('substance-use-yes');
      
      // Click rapidly multiple times
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should only trigger once
      expect(mockOnDomainTriggered).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined/null responses gracefully', () => {
      render(
        <RiskBehaviorsDomainTest 
          onDomainTriggered={mockOnDomainTriggered} 
          initialResponses={{ undefined_field: undefined, null_field: null }}
        />
      );

      // Should render without errors
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(mockOnDomainTriggered).not.toHaveBeenCalled();
    });

    it('should handle component unmounting gracefully', () => {
      const { unmount } = render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Response State Management', () => {
    it('should maintain response state correctly', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // Select substance use
      await user.click(screen.getByTestId('substance-use-yes'));
      
      // Select smoking status
      await user.click(screen.getByTestId('smoking-current'));

      // Check that both responses are maintained
      const responsesDiv = screen.getByTestId('current-responses');
      expect(responsesDiv).toHaveTextContent('substance_use');
      expect(responsesDiv).toHaveTextContent('smoking_status');
    });

    it('should update state when changing selections', async () => {
      const user = userEvent.setup();
      render(
        <RiskBehaviorsDomainTest onDomainTriggered={mockOnDomainTriggered} />
      );

      // First select yes
      await user.click(screen.getByTestId('substance-use-yes'));
      expect(mockOnDomainTriggered).toHaveBeenCalledWith('substance_monitoring');

      // Then change to no - domain should remain triggered (once triggered, stays triggered)
      await user.click(screen.getByTestId('substance-use-no'));
      
      // Check current response reflects the change
      const responsesDiv = screen.getByTestId('current-responses');
      expect(responsesDiv).toHaveTextContent('"substance_use": false');
    });
  });
});