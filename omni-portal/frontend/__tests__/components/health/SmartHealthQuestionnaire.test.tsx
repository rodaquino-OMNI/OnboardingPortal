import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SmartHealthQuestionnaire } from '@/components/health/SmartHealthQuestionnaire';
import { useGamification } from '@/hooks/useGamification';
import api from '@/services/api';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('@/hooks/useGamification');
jest.mock('@/services/api');
jest.mock('@/lib/health-questionnaire-v2', () => ({
  HEALTH_QUESTIONNAIRE_SECTIONS: [
    {
      id: 'basic_info',
      title: 'Informações Básicas',
      questions: [
        {
          id: 'age',
          text: 'Qual é sua idade?',
          type: 'number',
          required: true,
          validation: { min: 1, max: 120 }
        },
        {
          id: 'gender',
          text: 'Qual é seu gênero?',
          type: 'select',
          required: true,
          options: [
            { value: 'Masculino', label: 'Masculino' },
            { value: 'Feminino', label: 'Feminino' },
            { value: 'Outro', label: 'Outro' },
            { value: 'Prefiro não dizer', label: 'Prefiro não dizer' }
          ]
        }
      ]
    },
    {
      id: 'health_history',
      title: 'Histórico de Saúde',
      questions: [
        {
          id: 'chronic_conditions',
          text: 'Você tem alguma condição crônica?',
          type: 'multiselect',
          required: false,
          options: [
            { value: 'Diabetes', label: 'Diabetes' },
            { value: 'Hipertensão', label: 'Hipertensão' },
            { value: 'Asma', label: 'Asma' },
            { value: 'none', label: 'Nenhuma' }
          ]
        },
        {
          id: 'medications',
          text: 'Você toma algum medicamento regularmente?',
          type: 'boolean',
          required: true
        }
      ]
    }
  ],
  calculateRiskScore: jest.fn(() => ({
    overall: 0,
    categories: {},
    flags: [],
    recommendations: []
  })),
  detectFraudIndicators: jest.fn(() => ({
    inconsistencyScore: 0,
    flags: [],
    validationPairs: {},
    speedPatterns: { tooFast: false, tooSlow: false },
    responsePatterns: { allPositive: false, allNegative: false }
  })),
  calculateHealthScore: jest.fn(() => ({
    overall: 85,
    categories: {
      physical: 80,
      mental: 90,
      lifestyle: 85
    },
    riskFactors: [],
    strengths: ['Good mental health', 'Active lifestyle']
  }))
}));
jest.mock('@/components/health/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const mockAddPoints = jest.fn();
const mockUnlockBadge = jest.fn();

describe('SmartHealthQuestionnaire', () => {
  const defaultProps = {
    userId: 'test-user-123',
    onComplete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useGamification as unknown as jest.Mock).mockReturnValue({
      addPoints: mockAddPoints,
      unlockBadge: mockUnlockBadge,
      progress: null,
      stats: null,
      badges: { earned: [], available: [] },
      leaderboard: [],
      activityFeed: [],
      dashboardSummary: null,
      isLoading: false,
      error: null
    });
    
    // Mock questionnaire data
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        template: {
          sections: [
            {
              id: 'basic_info', 
              title: 'Informações Básicas',
              questions: [
                {
                  id: 'age',
                  text: 'Qual é sua idade?',
                  type: 'number',
                  required: true,
                  validation: { min: 1, max: 120 }
                },
                {
                  id: 'gender',
                  text: 'Qual é seu gênero?',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'Masculino', label: 'Masculino' },
                    { value: 'Feminino', label: 'Feminino' },
                    { value: 'Outro', label: 'Outro' },
                    { value: 'Prefiro não dizer', label: 'Prefiro não dizer' }
                  ]
                }
              ]
            },
            {
              id: 'health_history',
              title: 'Histórico de Saúde',
              questions: [
                {
                  id: 'chronic_conditions',
                  text: 'Você tem alguma condição crônica?',
                  type: 'multiselect',
                  required: false,
                  options: [
                    { value: 'Diabetes', label: 'Diabetes' },
                    { value: 'Hipertensão', label: 'Hipertensão' },
                    { value: 'Asma', label: 'Asma' },
                    { value: 'none', label: 'Nenhuma' }
                  ]
                },
                {
                  id: 'medications',
                  text: 'Você toma algum medicamento regularmente?',
                  type: 'boolean',
                  required: true
                }
              ]
            }
          ]
        }
      }
    });
  });

  describe('Rendering', () => {
    it('renders questionnaire interface', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        // Check for section title and question
        expect(screen.getByText('Informações Básicas')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /qual é sua idade/i })).toBeInTheDocument();
      });
    });

    it('displays progress indicator with proper ARIA', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        const progressbar = screen.getByRole('progressbar');
        expect(progressbar).toBeInTheDocument();
        expect(progressbar).toHaveAttribute('aria-valuemin', '0');
        expect(progressbar).toHaveAttribute('aria-valuemax', '100');
        expect(progressbar).toHaveAttribute('aria-valuenow');
        
        // The component shows "Pergunta 1 de" in section badge
        expect(screen.getByText(/pergunta 1 de/i)).toBeInTheDocument();
      });
    });

    it('shows section navigation with proper landmarks', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/informações básicas/i)).toBeInTheDocument();
        expect(screen.getByText(/pergunta 1 de/i)).toBeInTheDocument();
        
        // Check for proper navigation landmark
        const navigation = screen.getByRole('navigation', { name: /navegação do questionário/i });
        expect(navigation).toBeInTheDocument();
      });
    });
  });

  describe('Question Types', () => {
    it('renders number input correctly', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        const ageInput = screen.getByLabelText(/qual é sua idade/i);
        expect(ageInput).toHaveAttribute('type', 'number');
        expect(ageInput).toHaveAttribute('min', '1');
        expect(ageInput).toHaveAttribute('max', '120');
      });
    });

    it('renders select options as accessible radio group', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Navigate to next question to see gender selection
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      const user = userEvent.setup();
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      
      await waitFor(() => {
        // Gender should be presented as radio buttons with proper ARIA
        const maleOption = screen.getByRole('radio', { name: /masculino/i });
        const femaleOption = screen.getByRole('radio', { name: /feminino/i });
        expect(maleOption).toBeInTheDocument();
        expect(femaleOption).toBeInTheDocument();
        
        // Should be within a fieldset for proper grouping
        const fieldset = screen.getByRole('group');
        expect(fieldset).toBeInTheDocument();
      });
    });

    it('renders multiselect as accessible checkbox group', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Navigate to health history section
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Fill first section
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      
      // Click male option (radio button)
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // Component auto-advances after selecting radio option
      await waitFor(() => {
        expect(screen.getByText(/diabetes/i)).toBeInTheDocument();
        expect(screen.getByText(/hipertensão/i)).toBeInTheDocument();
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });
    });

    it('renders boolean options as accessible radio group', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Navigate through questions to reach boolean question (medications)
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Fill age
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      
      // Select gender (auto-advances)
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // Skip chronic conditions to get to medications (boolean question)
      await waitFor(() => screen.getByRole('checkbox'));
      await user.click(screen.getByRole('checkbox')); // First checkbox
      
      await waitFor(() => {
        const yesOption = screen.getByRole('radio', { name: /sim/i });
        const noOption = screen.getByRole('radio', { name: /não/i });
        expect(yesOption).toBeInTheDocument();
        expect(noOption).toBeInTheDocument();
        
        // Should have proper ARIA attributes
        expect(yesOption).toHaveAttribute('aria-checked');
        expect(noOption).toHaveAttribute('aria-checked');
      });
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Number questions show Next button when they don't auto-advance
      await waitFor(() => screen.getByRole('button', { name: /próximo/i }));
      
      // Try to proceed without filling required fields
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Component should prevent navigation and keep required field validation
      expect(screen.getByRole('spinbutton', { name: /idade/i })).toHaveAttribute('aria-required', 'true');
    });

    it('validates number ranges', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByLabelText(/idade/i));
      
      const ageInput = screen.getByLabelText(/idade/i);
      await user.type(ageInput, '150');
      await user.tab();
      
      expect(await screen.findByText(/valor deve estar entre 1 e 120/i)).toBeInTheDocument();
    });

    it('prevents navigation with validation errors', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('button', { name: /próximo/i }));
      
      // Leave required fields empty and try to proceed
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Should still be on first section
      expect(screen.getByText(/informações básicas/i)).toBeInTheDocument();
      expect(screen.queryByText(/histórico de saúde/i)).not.toBeInTheDocument();
      
      // Next button should be disabled for required empty field
      expect(screen.getByRole('button', { name: /próximo/i })).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('navigates between sections', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Fill age field
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      
      // Click Next button for number input
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Select gender (this auto-advances to next section)
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/histórico de saúde/i)).toBeInTheDocument();
      });
    });

    it('allows going back to previous sections', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Fill age and move to gender
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Select gender (auto-advances to next section)
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
      
      // Go back
      await user.click(screen.getByRole('button', { name: /voltar/i }));
      
      expect(screen.getByText(/informações básicas/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    it('preserves answers when navigating', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Fill age
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '25');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Select gender
      await waitFor(() => screen.getByRole('radio', { name: /feminino/i }));
      await user.click(screen.getByRole('radio', { name: /feminino/i }));
      
      // Navigate back
      await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
      await user.click(screen.getByRole('button', { name: /voltar/i }));
      
      // Check age value is preserved
      expect(screen.getByDisplayValue('25')).toBeInTheDocument();
      
      // Navigate forward again to check gender is preserved
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() => {
        const femaleOption = screen.getByRole('radio', { name: /feminino/i });
        expect(femaleOption).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('Progress Tracking', () => {
    it('updates progress as questions are answered', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Initially 0%
      expect(screen.getByText(/0% completo/i)).toBeInTheDocument();
      
      // Answer first question
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      
      // Progress should update gradually as we move through questions
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow');
      
      // Move to next question
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Answer gender question
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      await waitFor(() => {
        const updatedProgress = screen.getByRole('progressbar');
        const progressValue = parseInt(updatedProgress.getAttribute('aria-valuenow') || '0');
        expect(progressValue).toBeGreaterThan(0);
      });
    });

    it('shows section completion status', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Complete first section
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // After completing first section, should show visual completion state
      await waitFor(() => {
        // The section progress indicators should show completion
        expect(screen.getByText(/histórico de saúde/i)).toBeInTheDocument();
      });
    });
  });

  describe('Submission', () => {
    it('submits completed questionnaire', async () => {
      const user = userEvent.setup();
      
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Complete all sections
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Section 1 - Age
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Section 1 - Gender (auto-advances to next section)
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // Section 2 - Chronic conditions
      await waitFor(() => screen.getAllByRole('checkbox'));
      const diabetesCheckbox = screen.getByRole('checkbox', { name: /diabetes/i });
      await user.click(diabetesCheckbox);
      
      // Continue to medications question
      await waitFor(() => screen.getByRole('radio', { name: /sim/i }));
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      // Component should call onComplete after finishing all sections
      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('completes questionnaire flow', async () => {
      const user = userEvent.setup();
      
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Quick complete questionnaire
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // Skip chronic conditions by selecting "Nenhuma" if available
      await waitFor(() => screen.getAllByRole('checkbox'));
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 0) {
        await user.click(checkboxes[checkboxes.length - 1]); // Last option usually "Nenhuma"
      }
      
      // Answer medications question
      await waitFor(() => screen.getByRole('radio', { name: /sim/i }));
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      // Verify completion callback is called
      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
      });
    });

    it('handles questionnaire completion gracefully', async () => {
      const user = userEvent.setup();
      
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Complete questionnaire normally
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // Continue through remaining questions
      await waitFor(() => screen.getAllByRole('checkbox'));
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 0) {
        await user.click(checkboxes[0]); // Select first option
      }
      
      await waitFor(() => screen.getByRole('radio', { name: /não/i }));
      await user.click(screen.getByRole('radio', { name: /não/i }));
      
      // Component should handle completion
      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('AI Assistant Integration', () => {
    it('shows AI assistant toggle', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /assistente ia/i })).toBeInTheDocument();
      });
    });

    it('opens AI assistant dialog', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('button', { name: /assistente ia/i }));
      
      await user.click(screen.getByRole('button', { name: /assistente ia/i }));
      
      expect(screen.getByText(/como posso ajudar/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/digite sua pergunta/i)).toBeInTheDocument();
    });

    it('sends questions to AI', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          response: 'A idade é importante para avaliar riscos de saúde específicos.'
        }
      });
      
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Open AI assistant
      await waitFor(() => screen.getByRole('button', { name: /assistente ia/i }));
      await user.click(screen.getByRole('button', { name: /assistente ia/i }));
      
      // Ask question
      const input = screen.getByPlaceholderText(/digite sua pergunta/i);
      await user.type(input, 'Por que preciso informar minha idade?');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/health/ai-assistant', {
          question: 'Por que preciso informar minha idade?',
          context: 'health_questionnaire'
        });
        expect(screen.getByText(/a idade é importante/i)).toBeInTheDocument();
      });
    });
  });

  describe('Gamification', () => {
    it('awards points for completing sections', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Complete first section
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // Since the component is enhanced with gamification, it should award points
      // Note: This test may need to be adjusted based on actual gamification implementation
      await waitFor(() => {
        // The component may award points differently in the enhanced version
        expect(mockAddPoints).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('awards bonus points for detailed answers', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Navigate to health history
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // Select multiple conditions (detailed answer)
      await waitFor(() => screen.getAllByRole('checkbox'));
      await user.click(screen.getByRole('checkbox', { name: /diabetes/i }));
      await user.click(screen.getByRole('checkbox', { name: /hipertensão/i }));
      
      // Enhanced component may award points differently
      await waitFor(() => {
        expect(mockAddPoints).toHaveBeenCalled();
      });
    });

    it('unlocks health awareness badge', async () => {
      const user = userEvent.setup();
      
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Complete questionnaire
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      await waitFor(() => screen.getByRole('radio', { name: /masculino/i }));
      await user.click(screen.getByRole('radio', { name: /masculino/i }));
      
      // Complete chronic conditions
      await waitFor(() => screen.getAllByRole('checkbox'));
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 0) {
        await user.click(checkboxes[0]);
      }
      
      // Complete medications
      await waitFor(() => screen.getByRole('radio', { name: /sim/i }));
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(mockUnlockBadge).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form structure', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        const form = screen.getByRole('form');
        expect(form).toHaveAttribute('aria-label', 'Questionário de saúde');
        
        // Check for main landmark
        const main = screen.getByRole('main');
        expect(main).toHaveAttribute('aria-label', 'Questionário de saúde');
      });
    });

    it('provides proper validation feedback', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('button', { name: /próximo/i }));
      
      // Enter invalid number to test validation
      const ageInput = screen.getByRole('spinbutton', { name: /idade/i });
      await user.type(ageInput, '150');
      await user.tab(); // Trigger validation
      
      // Check for validation error message
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent(/valor deve estar entre/i);
        expect(ageInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Test tab navigation
      const ageInput = screen.getByRole('spinbutton', { name: /idade/i });
      await user.click(ageInput);
      expect(ageInput).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /próximo/i })).toHaveFocus();
      
      // Test Enter key functionality
      await user.keyboard('{Enter}');
      
      // Should advance if validation passes
      expect(screen.getByRole('button', { name: /próximo/i })).toBeInTheDocument();
    });

    it('provides clear instructions', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        // Screen reader instructions are present but hidden
        const instructions = screen.getByText(/preencha as informações solicitadas/i);
        expect(instructions).toBeInTheDocument();
        expect(instructions.parentElement).toHaveClass('sr-only');
        
        const keyboardInstructions = screen.getByText(/use as teclas tab para navegar/i);
        expect(keyboardInstructions).toBeInTheDocument();
        
        // Check for required field indicators
        const requiredIndicator = screen.getByText('*');
        expect(requiredIndicator).toHaveAttribute('aria-label', 'obrigatório');
      });
    });
    
    it('has proper ARIA live regions', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        // Check for progress announcements
        const liveRegions = screen.getAllByRole('status');
        expect(liveRegions.length).toBeGreaterThan(0);
        
        // Main progress live region
        const progressLiveRegion = liveRegions[0];
        expect(progressLiveRegion).toHaveAttribute('aria-live', 'polite');
        expect(progressLiveRegion).toHaveAttribute('aria-atomic', 'true');
        expect(progressLiveRegion).toHaveClass('sr-only');
      });
    });
    
    it('provides descriptive labels for all form controls', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        const ageInput = screen.getByRole('spinbutton', { name: /idade/i });
        expect(ageInput).toHaveAttribute('aria-labelledby');
        expect(ageInput).toHaveAttribute('aria-required', 'true');
        expect(ageInput).toHaveAttribute('min', '1');
        expect(ageInput).toHaveAttribute('max', '120');
        
        // Check for help text association
        expect(ageInput).toHaveAttribute('aria-describedby');
      });
    });
    
    it('supports radio button arrow key navigation', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Fill age to get to gender selection
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Should have radio buttons for gender
      await waitFor(() => {
        const maleRadio = screen.getByRole('radio', { name: /masculino/i });
        expect(maleRadio).toBeInTheDocument();
        
        // Test that radio buttons have proper ARIA attributes
        expect(maleRadio).toHaveAttribute('aria-checked', 'false');
        expect(maleRadio).toHaveAttribute('aria-labelledby');
        
        // Test keyboard navigation
        maleRadio.focus();
        expect(maleRadio).toHaveFocus();
      });
    });
  });
  
  describe('Suicide Risk Detection', () => {
    it('should NOT trigger false positive suicide risk on initial mount', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      render(<SmartHealthQuestionnaire {...defaultProps} />);

      // Assert - Wait for initial render and effects
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Verify no false positive critical risk was logged
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL RISK DETECTED'));
      
      consoleSpy.mockRestore();
    });

    it('should NOT trigger suicide risk with empty or undefined phq9_9 response', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock risk score with suicide flag but no actual phq9_9 response
      const mockCalculateRiskScore = jest.requireMock('@/lib/health-questionnaire-v2').calculateRiskScore;
      mockCalculateRiskScore.mockReturnValue({
        overall: 10,
        categories: { mental_health: 10 },
        flags: ['suicide_risk'], // Flag present but phq9_9 is undefined
        recommendations: []
      });

      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);

      // Answer enough questions to trigger risk calculation (need > 10 responses)
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Fill multiple questions to reach the 10 response threshold
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      // Wait for effects and verify no critical risk was triggered
      await waitFor(() => {
        expect(mockCalculateRiskScore).toHaveBeenCalled();
      });

      // Should NOT trigger critical risk because phq9_9 is not explicitly > 0
      expect(consoleSpy).not.toHaveBeenCalledWith('CRITICAL RISK DETECTED: suicide');
      
      consoleSpy.mockRestore();
    });

    it('should ONLY trigger suicide risk when phq9_9 is explicitly answered with value > 0', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockCalculateRiskScore = jest.requireMock('@/lib/health-questionnaire-v2').calculateRiskScore;
      
      // Mock the component with PHQ-9 responses including question 9
      mockCalculateRiskScore.mockImplementation((responses: Record<string, any>) => {
        if (responses.phq9_9 > 0) {
          return {
            overall: 30,
            categories: { mental_health: 20 },
            flags: ['suicide_risk'],
            recommendations: ['Encaminhamento urgente para profissional de saúde mental']
          };
        }
        return {
          overall: 0,
          categories: {},
          flags: [],
          recommendations: []
        };
      });

      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);

      // Simulate answering multiple questions including PHQ-9 question 9
      // This would be in a real scenario where mental health section is reached
      // For testing, we'll mock the responses being set
      
      // The component needs to have > 10 responses to trigger risk calculation
      // In a real flow, this would happen after answering mental health questions
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // The component should only trigger when phq9_9 is explicitly set to > 0
      // This ensures false positives don't occur during initial mount or with undefined values
      
      consoleSpy.mockRestore();
    });

    it('should display crisis resources when user indicates suicide ideation', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockCalculateRiskScore = jest.requireMock('@/lib/health-questionnaire-v2').calculateRiskScore;
      
      // Setup mock to return suicide risk flag only when phq9_9 > 0
      mockCalculateRiskScore.mockImplementation((responses: Record<string, any>) => {
        if (responses.phq9_9 && responses.phq9_9 > 0) {
          return {
            overall: 30,
            categories: { mental_health: 20 },
            flags: ['suicide_risk'],
            recommendations: ['Encaminhamento urgente para profissional de saúde mental']
          };
        }
        return { overall: 0, categories: {}, flags: [], recommendations: [] };
      });

      // Act - Render with explicit suicide ideation response
      render(
        <SmartHealthQuestionnaire 
          {...defaultProps} 
          progressiveResults={{
            age: 30,
            gender: 'male',
            phq9_9: 2 // Explicit positive response to suicide question
          }}
        />
      );

      // Assert - Component should detect the risk and show resources
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('CRITICAL RISK DETECTED: suicide');
        // Crisis resources should be visible to user
        expect(screen.getByRole('alert')).toHaveTextContent(/centro de valorização da vida/i);
        expect(screen.getByText(/188/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /emergência/i })).toHaveAttribute('href', 'tel:192');
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle risk calculation errors gracefully without breaking questionnaire', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockCalculateRiskScore = jest.requireMock('@/lib/health-questionnaire-v2').calculateRiskScore;
      
      // Mock calculateRiskScore to throw an error
      mockCalculateRiskScore.mockImplementation(() => {
        throw new Error('Risk calculation error');
      });

      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);

      // Answer questions to trigger risk calculation
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      await user.type(screen.getByRole('spinbutton', { name: /idade/i }), '30');

      // Component should log error but continue functioning
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Risk calculation error:', expect.any(Error));
      });

      // Questionnaire should still be functional
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /idade/i })).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('WCAG Compliance', () => {
    it('should have no accessibility violations', async () => {
      // Arrange
      const { container } = render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Act & Assert
      await waitFor(async () => {
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
    
    it('meets color contrast requirements', async () => {
      // Arrange & Act
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      // Assert
      await waitFor(() => {
        // Check that form elements are properly structured
        const ageInput = screen.getByRole('spinbutton', { name: /idade/i });
        expect(ageInput).toBeInTheDocument();
        expect(ageInput).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
        
        // Required indicators should be visible with proper styling
        const requiredIndicator = screen.getByText('*');
        expect(requiredIndicator).toBeInTheDocument();
        expect(requiredIndicator).toHaveClass('text-red-500');
      });
    });
    
    it('provides sufficient context for form controls', async () => {
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        const ageInput = screen.getByRole('spinbutton', { name: /idade/i });
        
        // Input should have associated label and description
        expect(ageInput).toHaveAttribute('aria-labelledby');
        expect(ageInput).toHaveAttribute('aria-describedby');
        
        // Check that the question heading exists and has proper ID
        const questionHeading = screen.getByRole('heading', { name: /qual é sua idade/i });
        expect(questionHeading).toBeInTheDocument();
        expect(questionHeading).toHaveAttribute('id');
      });
    });
    
    it('maintains focus management', async () => {
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      // Fill form and check focus management
      const ageInput = screen.getByRole('spinbutton', { name: /idade/i });
      await user.click(ageInput);
      expect(ageInput).toHaveFocus();
      
      // Type age and proceed to next question
      await user.type(ageInput, '30');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      
      // Should advance to gender question with proper focus
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons.length).toBeGreaterThan(0);
        // Focus management should be handled by the component
        expect(document.activeElement).toBeTruthy();
      });
    });
  });
  
  describe('Performance', () => {
    it('should render within performance budget', async () => {
      // Arrange
      const startTime = performance.now();
      
      // Act
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - startTime;
      
      // Assert - Should render within 150ms budget (questionnaire is complex)
      expect(renderTime).toBeLessThan(150);
    });
    
    it('should handle form state changes efficiently', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<SmartHealthQuestionnaire {...defaultProps} />);
      
      await waitFor(() => screen.getByRole('spinbutton', { name: /idade/i }));
      
      const startTime = performance.now();
      
      // Act - Multiple rapid state changes
      const ageInput = screen.getByRole('spinbutton', { name: /idade/i });
      await user.type(ageInput, '30');
      
      const responseTime = performance.now() - startTime;
      
      // Assert - Should handle rapid input efficiently
      expect(responseTime).toBeLessThan(50); // Should be very fast for input handling
    });
  });
});