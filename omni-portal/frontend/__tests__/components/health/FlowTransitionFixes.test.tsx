import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

// Mock the UnifiedHealthFlow
jest.mock('@/lib/unified-health-flow', () => ({
  UnifiedHealthFlow: jest.fn(),
  UNIVERSAL_TRIAGE: {
    id: 'universal_triage',
    name: 'Avaliação Inicial',
    description: 'Test description',
    estimatedSeconds: 60,
    questions: []
  }
}));

describe('Flow Transition Fixes Test Suite', () => {
  let mockFlow: any;
  let mockOnComplete: jest.Mock;
  let mockOnDomainChange: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock flow instance
    mockFlow = {
      processResponse: jest.fn(),
      getCurrentDomain: jest.fn().mockReturnValue('Avaliação Inicial'),
      getCurrentLayer: jest.fn().mockReturnValue('Triage'),
      getResponses: jest.fn().mockReturnValue({})
    };

    (UnifiedHealthFlow as jest.Mock).mockImplementation(() => mockFlow);

    mockOnComplete = jest.fn();
    mockOnDomainChange = jest.fn();
  });

  describe('1. Scale Questions with Continue Button Fix', () => {
    it('should render scale question with continue button and handle responses correctly', async () => {
      const scaleQuestion = {
        id: 'pain_severity',
        text: 'Em uma escala de 0 a 10, qual é sua dor AGORA?',
        type: 'scale' as const,
        domain: 'pain',
        instrument: 'NRS',
        riskWeight: 2,
        options: Array.from({ length: 11 }, (_, i) => ({
          value: i,
          label: i.toString(),
          emoji: i === 0 ? '😊' : i <= 3 ? '😐' : i <= 6 ? '😣' : i <= 9 ? '😫' : '😭'
        }))
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: scaleQuestion,
        progress: 20,
        currentDomain: 'Avaliação de Dor',
        currentLayer: 'Triage',
        estimatedTimeRemaining: 4
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Em uma escala de 0 a 10, qual é sua dor AGORA?')).toBeInTheDocument();
      });

      // Check that the scale slider is present
      const slider = screen.getByRole('slider');
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('type', 'range');
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '10');

      // Check that the Continue button is present (this was missing before the fix)
      const continueButton = screen.getByText('Continuar');
      expect(continueButton).toBeInTheDocument();
      
      // Test interaction - change scale value
      fireEvent.change(slider, { target: { value: '7' } });
      
      // Check that emoji updates based on value
      await waitFor(() => {
        expect(screen.getByText('😫')).toBeInTheDocument();
      });

      // Mock next response for when Continue is clicked
      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'complete',
        results: { riskLevel: 'moderate' },
        progress: 100,
        currentDomain: 'Complete',
        currentLayer: 'Done',
        estimatedTimeRemaining: 0
      });

      // Click the Continue button
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('pain_severity', 7);
      });
    });

    it('should handle scale question edge cases correctly', async () => {
      const edgeCaseScaleQuestion = {
        id: 'custom_scale',
        text: 'Rate from 1 to 5',
        type: 'scale' as const,
        domain: 'test',
        riskWeight: 1,
        options: [
          { value: 1, label: 'Very Low', emoji: '😊' },
          { value: 2, label: 'Low', emoji: '😐' },
          { value: 3, label: 'Medium', emoji: '😔' },
          { value: 4, label: 'High', emoji: '😫' },
          { value: 5, label: 'Very High', emoji: '😭' }
        ]
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: edgeCaseScaleQuestion,
        progress: 25,
        currentDomain: 'Test',
        currentLayer: 'Test',
        estimatedTimeRemaining: 3
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('min', '1');
        expect(slider).toHaveAttribute('max', '5');
      });

      // Test with custom range
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '3' } });
      
      await waitFor(() => {
        expect(screen.getByText('😔')).toBeInTheDocument();
        expect(screen.getByText('Medium')).toBeInTheDocument();
      });
    });
  });

  describe('2. Domain Transition Guards Against Infinite Loops', () => {
    it('should handle domain transitions without infinite loops', async () => {
      let callCount = 0;
      mockFlow.processResponse.mockImplementation((questionId, value) => {
        callCount++;
        
        if (callCount === 1) {
          // First call (_init) - return domain transition
          return Promise.resolve({
            type: 'domain_transition',
            domain: { id: 'pain_management', name: 'Avaliação de Dor' },
            message: 'Agora vamos falar sobre avaliação de dor',
            progress: 25,
            currentDomain: 'Avaliação de Dor',
            currentLayer: 'Initial',
            estimatedTimeRemaining: 3
          });
        } else if (callCount === 2) {
          // Second call (_continue) - return next question to prevent loop
          return Promise.resolve({
            type: 'question',
            question: {
              id: 'pain_duration',
              text: 'Há quanto tempo você tem essa dor?',
              type: 'select',
              domain: 'pain',
              riskWeight: 2,
              options: [
                { value: 'acute', label: 'Menos de 3 meses' },
                { value: 'chronic', label: 'Mais de 6 meses' }
              ]
            },
            progress: 30,
            currentDomain: 'Avaliação de Dor',
            currentLayer: 'Assessment',
            estimatedTimeRemaining: 3
          });
        }
        
        return Promise.resolve({
          type: 'complete',
          results: { riskLevel: 'low' },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        });
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      // Wait for domain transition to occur
      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('pain_management');
      }, { timeout: 3000 });

      // Wait for the next question to appear (proving no infinite loop)
      await waitFor(() => {
        expect(screen.getByText('Há quanto tempo você tem essa dor?')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify processResponse was called exactly twice (not infinite)
      expect(mockFlow.processResponse).toHaveBeenCalledTimes(2);
      expect(mockFlow.processResponse).toHaveBeenNthCalledWith(1, '_init', true);
      expect(mockFlow.processResponse).toHaveBeenNthCalledWith(2, '_continue', true);
    });

    it('should handle error in domain transition gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      mockFlow.processResponse
        .mockResolvedValueOnce({
          type: 'domain_transition',
          domain: { id: 'mental_health', name: 'Bem-estar Mental' },
          message: 'Transitioning to mental health',
          progress: 50,
          currentDomain: 'Bem-estar Mental',
          currentLayer: 'Initial',
          estimatedTimeRemaining: 2
        })
        .mockRejectedValueOnce(new Error('Domain transition error'));

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('mental_health');
      });

      // Wait for error handling
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error in domain transition:', expect.any(Error));
      }, { timeout: 3000 });

      // Check error message appears
      await waitFor(() => {
        expect(screen.getByText('Houve um erro ao continuar. Por favor, tente novamente.')).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });

  describe('3. Risk Behaviors Domain UI Support', () => {
    it('should properly display Risk Behaviors domain with correct icon and color', async () => {
      const riskBehaviorQuestion = {
        id: 'substance_use_screening',
        text: 'Nos últimos 12 meses, você usou alguma dessas substâncias?',
        type: 'multiselect' as const,
        domain: 'risk_behaviors',
        instrument: 'ASSIST',
        riskWeight: 4,
        options: [
          { value: 'none', label: 'Nenhuma das listadas', riskScore: 0 },
          { value: 'cannabis', label: 'Maconha/Cannabis', riskScore: 2 },
          { value: 'cocaine', label: 'Cocaína', riskScore: 4 }
        ]
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: riskBehaviorQuestion,
        progress: 70,
        currentDomain: 'Comportamentos de Risco',
        currentLayer: 'Avaliação de Substâncias',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Comportamentos de Risco')).toBeInTheDocument();
        expect(screen.getByText('Avaliação de Substâncias')).toBeInTheDocument();
      });

      // Check that the question renders correctly
      expect(screen.getByText('Nos últimos 12 meses, você usou alguma dessas substâncias?')).toBeInTheDocument();
      
      // Check multiselect helper text
      expect(screen.getByText('Selecione todas as opções que se aplicam:')).toBeInTheDocument();

      // Check options are present
      expect(screen.getByText('Nenhuma das listadas')).toBeInTheDocument();
      expect(screen.getByText('Maconha/Cannabis')).toBeInTheDocument();
      expect(screen.getByText('Cocaína')).toBeInTheDocument();

      // Verify instrument badge shows
      expect(screen.getByText('ASSIST')).toBeInTheDocument();
    });

    it('should handle Risk Behaviors multiselect interactions correctly', async () => {
      const riskBehaviorQuestion = {
        id: 'substance_use_screening',
        text: 'Test multiselect question',
        type: 'multiselect' as const,
        domain: 'risk_behaviors',
        riskWeight: 4,
        options: [
          { value: 'none', label: 'None' },
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' }
        ]
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: riskBehaviorQuestion,
        progress: 70,
        currentDomain: 'Comportamentos de Risco',
        currentLayer: 'Test',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test multiselect question')).toBeInTheDocument();
      });

      // Test selecting non-"none" option
      fireEvent.click(screen.getByText('Option 1'));
      
      // Check that option shows as selected (button should change appearance)
      await waitFor(() => {
        const button = screen.getByText('Option 1').closest('button');
        expect(button).not.toHaveClass('border-gray-200');
      });

      // Continue button should appear when options are selected
      await waitFor(() => {
        expect(screen.getByText('Continuar')).toBeInTheDocument();
      });

      // Test selecting "none" which should clear other selections
      fireEvent.click(screen.getByText('None'));
      
      // Verify the behavior works correctly
      const continueButton = screen.getByText('Continuar');
      
      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'complete',
        results: { riskLevel: 'low' },
        progress: 100,
        currentDomain: 'Complete',
        currentLayer: 'Done',
        estimatedTimeRemaining: 0
      });

      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('substance_use_screening', ['none']);
      });
    });
  });

  describe('4. Complete Flow from Triage to Validation', () => {
    it('should complete entire flow from start to finish', async () => {
      let questionCount = 0;
      const questions = [
        {
          id: 'age',
          text: 'Qual é sua idade?',
          type: 'number' as const,
          domain: 'demographics',
          riskWeight: 1
        },
        {
          id: 'pain_severity',
          text: 'Em uma escala de 0 a 10, qual é sua dor AGORA?',
          type: 'scale' as const,
          domain: 'pain',
          riskWeight: 2,
          options: Array.from({ length: 11 }, (_, i) => ({
            value: i,
            label: i.toString(),
            emoji: i === 0 ? '😊' : '😣'
          }))
        },
        {
          id: 'height_confirmation',
          text: 'Por favor, confirme sua altura em centímetros',
          type: 'number' as const,
          domain: 'validation',
          riskWeight: 0
        }
      ];

      mockFlow.processResponse.mockImplementation((questionId, value) => {
        if (questionId === '_init') {
          questionCount = 0;
          return Promise.resolve({
            type: 'question',
            question: questions[questionCount],
            progress: 10,
            currentDomain: 'Avaliação Inicial',
            currentLayer: 'Triage',
            estimatedTimeRemaining: 5
          });
        }

        questionCount++;
        
        if (questionCount < questions.length) {
          return Promise.resolve({
            type: 'question',
            question: questions[questionCount],
            progress: 33 + (questionCount * 33),
            currentDomain: questionCount === 1 ? 'Avaliação de Dor' : 'Validação',
            currentLayer: questionCount === 1 ? 'Assessment' : 'Confirmation',
            estimatedTimeRemaining: Math.max(1, 3 - questionCount)
          });
        }

        return Promise.resolve({
          type: 'complete',
          results: {
            responses: { age: 30, pain_severity: 7, height_confirmation: 175 },
            riskScores: { demographics: 1, pain: 9, validation: 0 },
            completedDomains: ['demographics', 'pain', 'validation'],
            totalRiskScore: 10,
            riskLevel: 'moderate' as const,
            recommendations: ['Considere consultar um especialista em manejo da dor'],
            nextSteps: ['Recomendações personalizadas de saúde'],
            fraudDetectionScore: 0,
            timestamp: new Date().toISOString()
          },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        });
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      // First question: Age
      await waitFor(() => {
        expect(screen.getByText('Qual é sua idade?')).toBeInTheDocument();
      });

      const ageInput = screen.getByPlaceholderText('Digite um número');
      fireEvent.change(ageInput, { target: { value: '30' } });
      fireEvent.click(screen.getByText('Continuar'));

      // Second question: Pain Scale
      await waitFor(() => {
        expect(screen.getByText('Em uma escala de 0 a 10, qual é sua dor AGORA?')).toBeInTheDocument();
      });

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '7' } });
      fireEvent.click(screen.getByText('Continuar'));

      // Third question: Height validation
      await waitFor(() => {
        expect(screen.getByText('Por favor, confirme sua altura em centímetros')).toBeInTheDocument();
      });

      const heightInput = screen.getByPlaceholderText('Digite um número');
      fireEvent.change(heightInput, { target: { value: '175' } });
      fireEvent.click(screen.getByText('Continuar'));

      // Completion
      await waitFor(() => {
        expect(screen.getByText('Avaliação Concluída')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Continuar para Próxima Etapa'));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(expect.objectContaining({
          riskLevel: 'moderate',
          totalRiskScore: 10,
          completedDomains: ['demographics', 'pain', 'validation']
        }));
      });
    });
  });

  describe('5. Question Type Button Handling', () => {
    it('should handle boolean questions correctly', async () => {
      const booleanQuestion = {
        id: 'chronic_conditions_flag',
        text: 'Você tem alguma condição crônica de saúde?',
        type: 'boolean' as const,
        domain: 'chronic_disease',
        riskWeight: 4
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: booleanQuestion,
        progress: 40,
        currentDomain: 'Condições Crônicas',
        currentLayer: 'Screening',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Você tem alguma condição crônica de saúde?')).toBeInTheDocument();
        expect(screen.getByText('✅ Sim')).toBeInTheDocument();
        expect(screen.getByText('❌ Não')).toBeInTheDocument();
      });

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'complete',
        results: { riskLevel: 'low' },
        progress: 100,
        currentDomain: 'Complete',
        currentLayer: 'Done',
        estimatedTimeRemaining: 0
      });

      fireEvent.click(screen.getByText('✅ Sim'));

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('chronic_conditions_flag', true);
      });
    });

    it('should handle select questions with proper button interactions', async () => {
      const selectQuestion = {
        id: 'smoking_status',
        text: 'Qual é sua situação em relação ao cigarro?',
        type: 'select' as const,
        domain: 'lifestyle',
        riskWeight: 4,
        options: [
          { value: 'never', label: 'Nunca fumei', emoji: '🚭' },
          { value: 'former', label: 'Ex-fumante', emoji: '🚬' },
          { value: 'current', label: 'Fumante atual', emoji: '🚬' }
        ]
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: selectQuestion,
        progress: 60,
        currentDomain: 'Estilo de Vida',
        currentLayer: 'Behaviors',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Qual é sua situação em relação ao cigarro?')).toBeInTheDocument();
        expect(screen.getByText('Nunca fumei')).toBeInTheDocument();
        expect(screen.getByText('Ex-fumante')).toBeInTheDocument();
        expect(screen.getByText('Fumante atual')).toBeInTheDocument();
      });

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'complete',
        results: { riskLevel: 'low' },
        progress: 100,
        currentDomain: 'Complete',
        currentLayer: 'Done',
        estimatedTimeRemaining: 0
      });

      fireEvent.click(screen.getByText('Nunca fumei'));

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('smoking_status', 'never');
      });
    });

    it('should handle text and number input questions with continue buttons', async () => {
      const textQuestion = {
        id: 'medication_list',
        text: 'Quais medicamentos você toma? (Liste os principais)',
        type: 'text' as const,
        domain: 'chronic_disease',
        riskWeight: 1
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: textQuestion,
        progress: 80,
        currentDomain: 'Condições Crônicas',
        currentLayer: 'Medications',
        estimatedTimeRemaining: 1
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Quais medicamentos você toma? (Liste os principais)')).toBeInTheDocument();
      });

      const textInput = screen.getByPlaceholderText('Digite sua resposta');
      const continueButton = screen.getByText('Continuar');
      
      // Button should be disabled initially
      expect(continueButton).toBeDisabled();

      // Type some text
      fireEvent.change(textInput, { target: { value: 'Paracetamol, Ibuprofeno' } });
      
      // Button should be enabled now
      expect(continueButton).not.toBeDisabled();

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'complete',
        results: { riskLevel: 'low' },
        progress: 100,
        currentDomain: 'Complete',
        currentLayer: 'Done',
        estimatedTimeRemaining: 0
      });

      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('medication_list', 'Paracetamol, Ibuprofeno');
      });
    });
  });

  describe('6. Edge Cases and Error Handling', () => {
    it('should handle missing question options gracefully', async () => {
      const malformedQuestion = {
        id: 'malformed',
        text: 'Test question without proper options',
        type: 'select' as const,
        domain: 'test',
        riskWeight: 1,
        options: undefined // Missing options
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: malformedQuestion,
        progress: 50,
        currentDomain: 'Test',
        currentLayer: 'Test',
        estimatedTimeRemaining: 1
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test question without proper options')).toBeInTheDocument();
      });

      // Should not crash even with missing options
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('should display sensitive info alert correctly', async () => {
      const sensitiveQuestion = {
        id: 'sensitive_data',
        text: 'Sensitive health information',
        type: 'text' as const,
        domain: 'risk_behaviors',
        riskWeight: 1,
        metadata: { sensitiveInfo: true }
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: sensitiveQuestion,
        progress: 70,
        currentDomain: 'Risk Behaviors',
        currentLayer: 'Sensitive',
        estimatedTimeRemaining: 1
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sensitive health information')).toBeInTheDocument();
        expect(screen.getByText('Esta informação é protegida e usada apenas para cálculos médicos')).toBeInTheDocument();
      });
    });

    it('should handle processing state correctly across all question types', async () => {
      const question = {
        id: 'test_processing',
        text: 'Test processing state',
        type: 'boolean' as const,
        domain: 'test',
        riskWeight: 1
      };

      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: question,
        progress: 50,
        currentDomain: 'Test',
        currentLayer: 'Test',
        estimatedTimeRemaining: 1
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test processing state')).toBeInTheDocument();
      });

      // Simulate slow processing
      mockFlow.processResponse.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            type: 'complete',
            results: { riskLevel: 'low' },
            progress: 100,
            currentDomain: 'Complete',
            currentLayer: 'Done',
            estimatedTimeRemaining: 0
          }), 100)
        )
      );

      fireEvent.click(screen.getByText('✅ Sim'));

      // Should show processing state
      await waitFor(() => {
        expect(screen.getByText('Processando sua resposta...')).toBeInTheDocument();
      });

      // Should eventually complete
      await waitFor(() => {
        expect(screen.getByText('Avaliação Concluída')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('7. Progress and Time Tracking', () => {
    it('should track progress correctly throughout flow', async () => {
      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: {
          id: 'progress_test',
          text: 'Test progress tracking',
          type: 'boolean',
          domain: 'test',
          riskWeight: 1
        },
        progress: 75,
        currentDomain: 'Test Domain',
        currentLayer: 'Test Layer',
        estimatedTimeRemaining: 1
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('~1min')).toBeInTheDocument();
      });
    });
  });
});