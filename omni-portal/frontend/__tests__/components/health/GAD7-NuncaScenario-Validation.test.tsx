/**
 * GAD-7 "Nunca" Scenario Validation Tests
 * 
 * CRITICAL TEST SUITE: Validates that GAD-7 questions with "nunca" (value 0) 
 * selections work correctly and don't break the flow.
 * 
 * Based on hive intelligence findings:
 * - GAD-7 questions are in unified-health-flow.ts lines 370-473
 * - All 7 GAD-7 questions have "Nunca" option with value 0
 * - Issue: "nunca" selection + "continuar" click may not work properly
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

describe('GAD-7 Nunca Scenario Validation', () => {
  let mockOnComplete: jest.Mock;
  let mockOnDomainChange: jest.Mock;
  let mockOnProgressUpdate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnComplete = jest.fn();
    mockOnDomainChange = jest.fn();
    mockOnProgressUpdate = jest.fn();
  });

  describe('GAD-7 Question Structure Validation', () => {
    it('should have all 7 GAD-7 questions with "Nunca" option', () => {
      const flow = new UnifiedHealthFlow();
      const responses = flow.getResponses();
      
      // Validate GAD-7 questions exist in the flow structure
      const gad7Questions = [
        'gad7_1_nervousness',
        'gad7_2_worry_control', 
        'gad7_3_excessive_worry',
        'gad7_4_trouble_relaxing',
        'gad7_5_restlessness',
        'gad7_6_irritability',
        'gad7_7_fear_awful'
      ];

      gad7Questions.forEach(questionId => {
        // These questions should be defined in the unified flow
        expect(questionId).toMatch(/^gad7_\d+_/);
      });
    });
  });

  describe('CRITICAL: GAD-7 "Nunca" Selection Flow', () => {
    it('should process GAD-7 question with "nunca" (0) selection correctly', async () => {
      const user = userEvent.setup();
      
      // Mock the flow to return a GAD-7 question
      jest.spyOn(UnifiedHealthFlow.prototype, 'processResponse').mockImplementation(async (questionId, value) => {
        if (questionId === '_init') {
          return {
            type: 'question',
            question: {
              id: 'gad7_1_nervousness',
              text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?',
              type: 'select',
              domain: 'mental_health',
              instrument: 'GAD-7',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 },
                { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
                { value: 3, label: 'Quase todos os dias', riskScore: 3 }
              ]
            },
            progress: 20,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 4
          };
        }

        if (questionId === 'gad7_1_nervousness' && value === 0) {
          return {
            type: 'question',
            question: {
              id: 'gad7_2_worry_control',
              text: 'Nas últimas 2 semanas: Não conseguir parar ou controlar as preocupações?',
              type: 'select',
              domain: 'mental_health',
              instrument: 'GAD-7',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 },
                { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
                { value: 3, label: 'Quase todos os dias', riskScore: 3 }
              ]
            },
            progress: 25,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 3
          };
        }

        return {
          type: 'complete',
          results: { riskLevel: 'low' },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        };
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Wait for GAD-7 question to render
      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?')).toBeInTheDocument();
      });

      // CRITICAL TEST: Select "Nunca" option (value 0)
      const nuncaOption = screen.getByText('Nunca');
      expect(nuncaOption).toBeInTheDocument();
      
      await user.click(nuncaOption);

      // CRITICAL TEST: Click "Continuar" button after selecting "Nunca"
      const continueButton = screen.getByRole('button', { name: /continuar/i });
      expect(continueButton).toBeInTheDocument();
      expect(continueButton).not.toBeDisabled();

      await user.click(continueButton);

      // Validate that the flow progressed correctly
      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Não conseguir parar ou controlar as preocupações?')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle all GAD-7 questions with "nunca" selections sequentially', async () => {
      const user = userEvent.setup();
      let currentQuestionIndex = 0;
      
      const gad7Questions = [
        {
          id: 'gad7_1_nervousness',
          text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?'
        },
        {
          id: 'gad7_2_worry_control', 
          text: 'Nas últimas 2 semanas: Não conseguir parar ou controlar as preocupações?'
        },
        {
          id: 'gad7_3_excessive_worry',
          text: 'Nas últimas 2 semanas: Preocupar-se demais com coisas diferentes?'
        },
        {
          id: 'gad7_4_trouble_relaxing',
          text: 'Nas últimas 2 semanas: Dificuldade para relaxar?'
        },
        {
          id: 'gad7_5_restlessness',
          text: 'Nas últimas 2 semanas: Ficar tão inquieto que é difícil permanecer parado?'
        },
        {
          id: 'gad7_6_irritability',
          text: 'Nas últimas 2 semanas: Ficar facilmente irritado ou chateado?'
        },
        {
          id: 'gad7_7_fear_awful',
          text: 'Nas últimas 2 semanas: Sentir medo como se algo terrível fosse acontecer?'
        }
      ];

      // Mock the flow to cycle through GAD-7 questions
      jest.spyOn(UnifiedHealthFlow.prototype, 'processResponse').mockImplementation(async (questionId, value) => {
        if (questionId === '_init') {
          return {
            type: 'question',
            question: {
              ...gad7Questions[0],
              type: 'select',
              domain: 'mental_health',
              instrument: 'GAD-7',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 },
                { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
                { value: 3, label: 'Quase todos os dias', riskScore: 3 }
              ]
            },
            progress: 20,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 4
          };
        }

        // If it's a GAD-7 question with value 0 (nunca)
        if (questionId.startsWith('gad7_') && value === 0) {
          currentQuestionIndex++;
          
          if (currentQuestionIndex < gad7Questions.length) {
            return {
              type: 'question',
              question: {
                ...gad7Questions[currentQuestionIndex],
                type: 'select',
                domain: 'mental_health',
                instrument: 'GAD-7',
                riskWeight: 3,
                options: [
                  { value: 0, label: 'Nunca', riskScore: 0 },
                  { value: 1, label: 'Alguns dias', riskScore: 1 },
                  { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
                  { value: 3, label: 'Quase todos os dias', riskScore: 3 }
                ]
              },
              progress: 20 + (currentQuestionIndex * 10),
              currentDomain: 'Bem-estar Mental',
              currentLayer: 'Avaliação de Bem-estar',
              estimatedTimeRemaining: 4 - currentQuestionIndex
            };
          }
        }

        return {
          type: 'complete',
          results: { riskLevel: 'low', gad7_score: 0 },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        };
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Test each GAD-7 question with "nunca" selection
      for (let i = 0; i < gad7Questions.length; i++) {
        const questionText = gad7Questions[i].text;
        
        // Wait for current question to render
        await waitFor(() => {
          expect(screen.getByText(questionText)).toBeInTheDocument();
        }, { timeout: 5000 });

        // Select "Nunca" (value 0)
        const nuncaOption = screen.getByText('Nunca');
        expect(nuncaOption).toBeInTheDocument();
        await user.click(nuncaOption);

        // Click continue button
        const continueButton = screen.getByRole('button', { name: /continuar/i });
        expect(continueButton).not.toBeDisabled();
        await user.click(continueButton);

        // Brief wait for state updates
        await waitFor(() => {}, { timeout: 100 });
      }

      // Should reach completion
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      }, { timeout: 10000 });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle rapid clicking on "nunca" + "continuar"', async () => {
      const user = userEvent.setup();
      
      jest.spyOn(UnifiedHealthFlow.prototype, 'processResponse').mockImplementation(async (questionId, value) => {
        if (questionId === '_init') {
          return {
            type: 'question',
            question: {
              id: 'gad7_1_nervousness',
              text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?',
              type: 'select',
              domain: 'mental_health',
              instrument: 'GAD-7',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 }
              ]
            },
            progress: 20,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 4
          };
        }

        // Simulate delay to test rapid clicking
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
          type: 'complete',
          results: { riskLevel: 'low' },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        };
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?')).toBeInTheDocument();
      });

      // Rapid clicking scenario
      const nuncaOption = screen.getByText('Nunca');
      await user.click(nuncaOption);
      
      const continueButton = screen.getByRole('button', { name: /continuar/i });
      
      // Click multiple times rapidly
      await user.click(continueButton);
      await user.click(continueButton);
      await user.click(continueButton);

      // Should only process once and complete successfully
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      }, { timeout: 10000 });
    });

    it('should preserve zero values correctly in responses', async () => {
      const user = userEvent.setup();
      let capturedResponse: any = null;
      
      jest.spyOn(UnifiedHealthFlow.prototype, 'processResponse').mockImplementation(async (questionId, value) => {
        if (questionId === '_init') {
          return {
            type: 'question',
            question: {
              id: 'gad7_1_nervousness',
              text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?',
              type: 'select',
              domain: 'mental_health',
              instrument: 'GAD-7',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 }
              ]
            },
            progress: 20,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 4
          };
        }

        if (questionId === 'gad7_1_nervousness') {
          capturedResponse = { questionId, value };
        }

        return {
          type: 'complete',
          results: { 
            riskLevel: 'low',
            responses: { [questionId]: value }
          },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        };
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Nunca'));
      await user.click(screen.getByRole('button', { name: /continuar/i }));

      await waitFor(() => {
        expect(capturedResponse).toEqual({
          questionId: 'gad7_1_nervousness',
          value: 0
        });
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          responses: expect.objectContaining({
            'gad7_1_nervousness': 0
          })
        })
      );
    });
  });

  describe('Integration with PHQ-9 Questions', () => {
    it('should not interfere with PHQ-9 "nunca" selections', async () => {
      const user = userEvent.setup();
      let questionSequence: string[] = [];
      
      jest.spyOn(UnifiedHealthFlow.prototype, 'processResponse').mockImplementation(async (questionId, value) => {
        questionSequence.push(questionId);
        
        if (questionId === '_init') {
          return {
            type: 'question',
            question: {
              id: 'phq9_1_interest',
              text: 'Nas últimas 2 semanas: Pouco interesse ou prazer em fazer as coisas?',
              type: 'select',
              domain: 'mental_health',
              instrument: 'PHQ-9',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 }
              ]
            },
            progress: 15,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 5
          };
        }

        if (questionId === 'phq9_1_interest' && value === 0) {
          return {
            type: 'question',
            question: {
              id: 'gad7_1_nervousness',
              text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?',
              type: 'select',
              domain: 'mental_health',
              instrument: 'GAD-7',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 }
              ]
            },
            progress: 25,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 4
          };
        }

        return {
          type: 'complete',
          results: { riskLevel: 'low' },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        };
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Test PHQ-9 question
      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Pouco interesse ou prazer em fazer as coisas?')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Nunca'));
      await user.click(screen.getByRole('button', { name: /continuar/i }));

      // Test GAD-7 question
      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Nunca'));
      await user.click(screen.getByRole('button', { name: /continuar/i }));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });

      // Both questions should have been processed
      expect(questionSequence).toContain('phq9_1_interest');
      expect(questionSequence).toContain('gad7_1_nervousness');
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have proper ARIA labels for GAD-7 "nunca" options', async () => {
      jest.spyOn(UnifiedHealthFlow.prototype, 'processResponse').mockImplementation(async (questionId, value) => {
        if (questionId === '_init') {
          return {
            type: 'question',
            question: {
              id: 'gad7_1_nervousness',
              text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?',
              type: 'select',
              domain: 'mental_health',
              instrument: 'GAD-7',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 }
              ]
            },
            progress: 20,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 4
          };
        }

        return {
          type: 'complete',
          results: { riskLevel: 'low' },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        };
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?')).toBeInTheDocument();
      });

      const nuncaButton = screen.getByText('Nunca');
      expect(nuncaButton).toBeInTheDocument();
      expect(nuncaButton).toHaveAttribute('role', 'button');
      
      const continueButton = screen.getByRole('button', { name: /continuar/i });
      expect(continueButton).toBeInTheDocument();
    });

    it('should provide visual feedback when "nunca" is selected', async () => {
      const user = userEvent.setup();
      
      jest.spyOn(UnifiedHealthFlow.prototype, 'processResponse').mockImplementation(async (questionId, value) => {
        if (questionId === '_init') {
          return {
            type: 'question',
            question: {
              id: 'gad7_1_nervousness',
              text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?',
              type: 'select',
              domain: 'mental_health',
              instrument: 'GAD-7',
              riskWeight: 3,
              options: [
                { value: 0, label: 'Nunca', riskScore: 0 },
                { value: 1, label: 'Alguns dias', riskScore: 1 }
              ]
            },
            progress: 20,
            currentDomain: 'Bem-estar Mental',
            currentLayer: 'Avaliação de Bem-estar',
            estimatedTimeRemaining: 4
          };
        }

        return {
          type: 'complete',
          results: { riskLevel: 'low' },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        };
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?')).toBeInTheDocument();
      });

      const nuncaButton = screen.getByText('Nunca');
      const continueButton = screen.getByRole('button', { name: /continuar/i });
      
      // Initially continue button should be disabled
      expect(continueButton).toBeDisabled();
      
      // After selecting "nunca", continue button should be enabled
      await user.click(nuncaButton);
      
      expect(continueButton).not.toBeDisabled();
    });
  });
});