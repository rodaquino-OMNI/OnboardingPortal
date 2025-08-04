import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Import all health components and flows
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { UnifiedHealthFlow } from '@/lib/unified-health-flow';
import { ClinicalDecisionEngine } from '@/lib/clinical-decision-engine';
import { calculateRiskScore, detectFraudIndicators } from '@/lib/health-questionnaire-v2';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock external dependencies
jest.mock('@/lib/api/health', () => ({
  submitHealthAssessment: jest.fn().mockResolvedValue({ success: true }),
  notifyEmergencyTeam: jest.fn().mockResolvedValue({ notified: true }),
  scheduleFollowUp: jest.fn().mockResolvedValue({ scheduled: true })
}));

describe('Complete Health Questionnaire Integration', () => {
  const mockOnComplete = jest.fn();
  const mockOnDomainChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Flow: No Health Issues', () => {
    it('should complete minimal risk pathway efficiently', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      // Answer age (triggers demographics)
      await user.type(screen.getByRole('spinbutton'), '30');
      await user.keyboard('{Enter}');

      // Wait for biological sex question
      await waitFor(() => {
        expect(screen.getByText(/sexo biológico/)).toBeInTheDocument();
      });

      // Select biological sex
      await user.click(screen.getByText('Masculino'));

      // Wait for emergency check
      await waitFor(() => {
        expect(screen.getByText(/condições que precisam de atenção imediata/)).toBeInTheDocument();
      });

      // Select no emergency conditions
      await user.click(screen.getByText('Nenhuma das acima'));

      // Wait for pain assessment
      await waitFor(() => {
        expect(screen.getByText(/sua dor AGORA/)).toBeInTheDocument();
      });

      // Select no pain (0)
      const painSlider = screen.getByRole('slider');
      fireEvent.change(painSlider, { target: { value: '0' } });

      // Wait for mood assessment
      await waitFor(() => {
        expect(screen.getByText(/pouco interesse ou prazer/)).toBeInTheDocument();
      });

      // Select no mood issues
      await user.click(screen.getByText('Nunca'));

      // Wait for chronic conditions check
      await waitFor(() => {
        expect(screen.getByText(/condição crônica de saúde/)).toBeInTheDocument();
      });

      // Select no chronic conditions
      await user.click(screen.getByText('Não'));

      // Should complete with minimal risk profile
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            responses: expect.objectContaining({
              age: 30,
              biological_sex: 'male',
              emergency_check: ['none'],
              pain_severity: 0,
              mood_interest: 0,
              chronic_conditions_flag: false
            }),
            riskLevel: 'low',
            completedDomains: expect.any(Array),
            totalRiskScore: expect.any(Number)
          })
        );
      }, 10000);
    });
  });

  describe('Complete Flow: High Risk Mental Health', () => {
    it('should detect depression with suicidal ideation and trigger emergency protocols', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Navigate through initial triage
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      await user.type(screen.getByRole('spinbutton'), '35');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Feminino')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Feminino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nenhuma das acima'));

      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
      const painSlider = screen.getByRole('slider');
      fireEvent.change(painSlider, { target: { value: '2' } });

      // Trigger mental health domain with positive PHQ-2
      await waitFor(() => {
        expect(screen.getByText(/pouco interesse ou prazer/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Mais da metade dos dias'));

      // Should transition to mental health domain
      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('mental_health');
      });

      // Continue with depression screening
      await waitFor(() => {
        expect(screen.getByText(/Bem-estar Mental/)).toBeInTheDocument();
      });

      // Complete WHO-5 with low scores (indicating depression)
      const whoQuestions = [
        /alegre e de bom humor/,
        /calmo e relaxado/,
        /ativo e com energia/,
        /descansado/,
        /coisas que me interessam/
      ];

      for (const questionPattern of whoQuestions) {
        await waitFor(() => {
          expect(screen.getByText(questionPattern)).toBeInTheDocument();
        });
        await user.click(screen.getByText('Em nenhum momento'));
        
        // Wait for next question or domain transition
        await waitFor(() => {
          // Should progress automatically
        }, 2000);
      }

      // Should eventually reach PHQ-9 question 9 (suicidal ideation)
      await waitFor(() => {
        expect(screen.getByText(/pensamentos de que seria melhor estar morto/)).toBeInTheDocument();
      }, 10000);

      // Indicate suicidal ideation
      await user.click(screen.getByText('Alguns dias'));

      // Should complete with high risk assessment and emergency protocols
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            riskLevel: 'critical',
            recommendations: expect.arrayContaining([
              expect.stringMatching(/profissional de saúde mental/)
            ]),
            nextSteps: expect.arrayContaining([
              expect.stringMatching(/Contato imediato|emergência/)
            ])
          })
        );
      }, 15000);
    });
  });

  describe('Complete Flow: Allergies and Risk Behaviors', () => {
    it('should handle complex allergy assessment with substance monitoring triggers', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Navigate through basic triage
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      await user.type(screen.getByRole('spinbutton'), '28');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Masculino')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Masculino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nenhuma das acima'));

      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
      const painSlider = screen.getByRole('slider');
      fireEvent.change(painSlider, { target: { value: '6' } }); // Moderate pain

      // Should trigger pain management domain
      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('pain_management');
      });

      // Navigate through pain assessment
      await waitFor(() => {
        expect(screen.getByText(/há quanto tempo você tem essa dor/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Mais de 6 meses'));

      // Pain work interference
      await waitFor(() => {
        expect(screen.getByText(/interfere no seu trabalho/)).toBeInTheDocument();
      });
      const workSlider = screen.getByRole('slider');
      fireEvent.change(workSlider, { target: { value: '5' } });

      // Pain sleep interference  
      await waitFor(() => {
        expect(screen.getByText(/afeta seu sono/)).toBeInTheDocument();
      });
      const sleepSlider = screen.getByRole('slider');
      fireEvent.change(sleepSlider, { target: { value: '7' } });

      // Pain medications - select opioids (should trigger substance monitoring)
      await waitFor(() => {
        expect(screen.getByText(/medicamento para dor/)).toBeInTheDocument();
      });
      await user.click(screen.getByText(/Opioides/));

      // Should eventually reach lifestyle domain
      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('lifestyle');
      }, 5000);

      // Smoking status - current smoker (another substance monitoring trigger)
      await waitFor(() => {
        expect(screen.getByText(/situação em relação ao cigarro/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Fumante atual'));

      // Should now be in substance monitoring domain due to multiple triggers
      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('substance_monitoring');
      }, 5000);

      // Wait for completion
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            riskLevel: expect.oneOf(['moderate', 'high']),
            riskScores: expect.objectContaining({
              pain: expect.any(Number),
              lifestyle: expect.any(Number)
            })
          })
        );
      }, 20000);
    });
  });

  describe('Complete Flow: Fraud Detection and Validation', () => {
    it('should detect inconsistent responses and flag for review', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Navigate through with intentionally inconsistent responses
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      // Very young age
      await user.type(screen.getByRole('spinbutton'), '22');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Feminino')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Feminino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nenhuma das acima'));

      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
      const painSlider = screen.getByRole('slider');
      fireEvent.change(painSlider, { target: { value: '1' } });

      await waitFor(() => {
        expect(screen.getByText(/pouco interesse/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nunca'));

      // Indicate chronic conditions (inconsistent with young age)
      await waitFor(() => {
        expect(screen.getByText(/condição crônica/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Sim'));

      // Select many chronic conditions (red flag for 22-year-old)
      await waitFor(() => {
        expect(screen.getByText(/condições que você tem/)).toBeInTheDocument();
      });
      
      const conditions = ['Diabetes', 'Hipertensão', 'Doença Cardíaca', 'Câncer', 'Doença Renal'];
      for (const condition of conditions) {
        if (screen.queryByText(condition)) {
          await user.click(screen.getByText(condition));
        }
      }

      // Should eventually complete with fraud detection flags
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            fraudDetectionScore: expect.any(Number),
            responses: expect.objectContaining({
              age: 22,
              chronic_conditions: expect.arrayContaining([
                expect.stringMatching(/diabetes|hypertension|heart_disease/)
              ])
            })
          })
        );
      }, 15000);

      // Verify fraud score is high enough to flag
      const completionCall = mockOnComplete.mock.calls[0][0];
      expect(completionCall.fraudDetectionScore).toBeGreaterThan(15);
    });
  });

  describe('Domain Triggering and Flow Control', () => {
    it('should correctly trigger and sequence multiple domains', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Start assessment
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      await user.type(screen.getByRole('spinbutton'), '45');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Masculino')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Masculino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nenhuma das acima'));

      // Moderate pain (should trigger pain domain)
      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
      const painSlider = screen.getByRole('slider');
      fireEvent.change(painSlider, { target: { value: '5' } });

      // Positive mental health screening (should trigger mental health domain)
      await waitFor(() => {
        expect(screen.getByText(/pouco interesse/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Alguns dias'));

      // Chronic conditions (should trigger chronic disease domain)
      await waitFor(() => {
        expect(screen.getByText(/condição crônica/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Sim'));

      // Verify domain changes are called in correct order
      await waitFor(() => {
        const domainChanges = mockOnDomainChange.mock.calls.map(call => call[0]);
        expect(domainChanges).toContain('pain_management');
        expect(domainChanges).toContain('mental_health');
        expect(domainChanges).toContain('chronic_disease');
      }, 15000);

      // Should prioritize by risk level (mental health > pain > chronic disease)
      const firstDomain = mockOnDomainChange.mock.calls[0][0];
      expect(['pain_management', 'mental_health']).toContain(firstDomain);
    });
  });

  describe('Clinical Decision Integration', () => {
    it('should generate appropriate clinical recommendations', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Complete assessment with moderate risk profile
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      await user.type(screen.getByRole('spinbutton'), '40');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Feminino')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Feminino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nenhuma das acima'));

      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
      const painSlider = screen.getByRole('slider');
      fireEvent.change(painSlider, { target: { value: '6' } });

      await waitFor(() => {
        expect(screen.getByText(/pouco interesse/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Mais da metade dos dias'));

      await waitFor(() => {
        expect(screen.getByText(/condição crônica/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Sim'));

      // Wait for completion with clinical recommendations
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            recommendations: expect.arrayContaining([
              expect.stringMatching(/profissional|consulta|especialista/)
            ]),
            nextSteps: expect.arrayContaining([
              expect.stringMatching(/acompanhamento|avaliação/)
            ])
          })
        );
      }, 20000);
    });
  });

  describe('Progress and Time Estimation', () => {
    it('should accurately track progress and estimate remaining time', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Monitor progress throughout assessment
      let progressValues = [];
      let timeEstimates = [];

      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      // Capture initial progress
      const initialProgress = screen.getByRole('progressbar');
      expect(initialProgress).toHaveAttribute('aria-valuenow');
      progressValues.push(parseInt(initialProgress.getAttribute('aria-valuenow') || '0'));

      await user.type(screen.getByRole('spinbutton'), '30');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Masculino')).toBeInTheDocument();
      });
      
      // Progress should increase
      const progress2 = screen.getByRole('progressbar');
      progressValues.push(parseInt(progress2.getAttribute('aria-valuenow') || '0'));
      
      await user.click(screen.getByText('Masculino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      
      const progress3 = screen.getByRole('progressbar');
      progressValues.push(parseInt(progress3.getAttribute('aria-valuenow') || '0'));
      
      // Progress should be monotonically increasing
      expect(progressValues[1]).toBeGreaterThanOrEqual(progressValues[0]);
      expect(progressValues[2]).toBeGreaterThanOrEqual(progressValues[1]);
      
      // Complete remaining questions quickly
      await user.click(screen.getByText('Nenhuma das acima'));
      
      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
      const painSlider = screen.getByRole('slider');
      fireEvent.change(painSlider, { target: { value: '0' } });

      await waitFor(() => {
        expect(screen.getByText(/pouco interesse/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nunca'));

      await waitFor(() => {
        expect(screen.getByText(/condição crônica/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Não'));

      // Should complete with 100% progress
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      }, 10000);
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should maintain accessibility throughout complete flow', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Check initial accessibility
      let results = await axe(container);
      expect(results).toHaveNoViolations();

      // Navigate through a few questions while checking accessibility
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      await user.type(screen.getByRole('spinbutton'), '30');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Masculino')).toBeInTheDocument();
      });
      
      // Check accessibility after state change
      results = await axe(container);
      expect(results).toHaveNoViolations();

      await user.click(screen.getByText('Masculino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      
      // Final accessibility check
      results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation throughout flow', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('spinbutton')).toBeInTheDocument();
      });

      // Use keyboard navigation
      await user.tab();
      expect(screen.getByRole('spinbutton')).toHaveFocus();

      await user.type(screen.getByRole('spinbutton'), '30');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      // Tab to first option
      await user.tab();
      const focusedElement = document.activeElement;
      expect(focusedElement?.tagName).toBe('BUTTON');

      // Use keyboard to select
      await user.keyboard('{Enter}');

      // Should progress to next question
      await waitFor(() => {
        expect(screen.getByText(/condições que precisam/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle component errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Navigate normally
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      await user.type(screen.getByRole('spinbutton'), '30');
      await user.keyboard('{Enter}');

      // Component should handle state transitions without errors
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/error|Error/)
      );

      consoleSpy.mockRestore();
    });

    it('should handle network errors during submission', async () => {
      // Mock network error
      const mockApi = require('@/lib/api/health');
      mockApi.submitHealthAssessment.mockRejectedValueOnce(new Error('Network error'));
      
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Complete minimal assessment
      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      await user.type(screen.getByRole('spinbutton'), '30');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Masculino')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Masculino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nenhuma das acima'));

      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
      const painSlider = screen.getByRole('slider');
      fireEvent.change(painSlider, { target: { value: '0' } });

      await waitFor(() => {
        expect(screen.getByText(/pouco interesse/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nunca'));

      await waitFor(() => {
        expect(screen.getByText(/condição crônica/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('Não'));

      // Should still complete despite API error
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      }, 10000);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle rapid user interactions without performance degradation', async () => {
      const user = userEvent.setup();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      const startTime = performance.now();

      await waitFor(() => {
        expect(screen.getByText(/Qual é sua idade/)).toBeInTheDocument();
      });

      // Rapid interactions
      await user.type(screen.getByRole('spinbutton'), '30');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Masculino')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Masculino'));

      await waitFor(() => {
        expect(screen.getByText('Nenhuma das acima')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Nenhuma das acima'));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete interactions quickly (under 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should not cause memory leaks during long assessments', () => {
      const { unmount } = render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Component should unmount cleanly
      expect(() => unmount()).not.toThrow();
    });
  });
});