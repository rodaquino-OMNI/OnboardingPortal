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

describe('UnifiedHealthAssessment - Progress Validation Tests', () => {
  let mockFlow: any;
  let mockOnComplete: jest.Mock;
  let mockOnDomainChange: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFlow = {
      processResponse: jest.fn(),
      getCurrentDomain: jest.fn(),
      getCurrentLayer: jest.fn(),
      getResponses: jest.fn().mockReturnValue({})
    };

    (UnifiedHealthFlow as jest.Mock).mockImplementation(() => mockFlow);
    mockOnComplete = jest.fn();
    mockOnDomainChange = jest.fn();
  });

  describe('Universal Triage Progress Calculation', () => {
    it('should start Universal Triage at 0% progress', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'age',
          text: 'Qual é sua idade?',
          type: 'number',
          domain: 'demographics',
          riskWeight: 1
        },
        progress: 0, // Should start at 0% for Universal Triage
        currentDomain: 'Avaliação Inicial',
        currentLayer: 'Triage',
        estimatedTimeRemaining: 5
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
        expect(screen.getByText('Avaliação Inicial')).toBeInTheDocument();
      });
    });

    it('should progress correctly through Universal Triage questions', async () => {
      // Mock sequence of triage questions with incremental progress
      const triageSequence = [
        {
          type: 'question',
          question: { id: 'age', text: 'Qual é sua idade?', type: 'number', domain: 'demographics', riskWeight: 1 },
          progress: 0,
          currentDomain: 'Avaliação Inicial',
          currentLayer: 'Triage',
          estimatedTimeRemaining: 5
        },
        {
          type: 'question',
          question: { id: 'biological_sex', text: 'Qual é seu sexo biológico?', type: 'select', domain: 'demographics', riskWeight: 0 },
          progress: 16, // Should be around 16% (1/6 questions complete)
          currentDomain: 'Avaliação Inicial',
          currentLayer: 'Triage',
          estimatedTimeRemaining: 4
        },
        {
          type: 'question',
          question: { id: 'emergency_check', text: 'Você tem condições de emergência?', type: 'multiselect', domain: 'emergency', riskWeight: 10 },
          progress: 33, // Should be around 33% (2/6 questions complete)
          currentDomain: 'Avaliação Inicial',
          currentLayer: 'Triage',
          estimatedTimeRemaining: 3
        }
      ];

      mockFlow.processResponse
        .mockResolvedValueOnce(triageSequence[0])
        .mockResolvedValueOnce(triageSequence[1])
        .mockResolvedValueOnce(triageSequence[2]);

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      // Initial state
      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });

      // Answer first question - check if input field exists
      const ageInput = screen.queryByPlaceholderText('Digite um número');
      if (ageInput) {
        fireEvent.change(ageInput, { target: { value: '30' } });
        const continueButton = screen.queryByText('Continuar');
        if (continueButton) {
          fireEvent.click(continueButton);
        }
      }

      await waitFor(() => {
        expect(screen.getByText('16%')).toBeInTheDocument();
      });

      // The second question should render automatically based on mock sequence
      await waitFor(() => {
        expect(screen.getByText('Qual é seu sexo biológico?')).toBeInTheDocument();
      });
    });

    it('should complete Universal Triage and transition to first domain', async () => {
      // Mock triage completion and domain transition
      mockFlow.processResponse
        .mockResolvedValueOnce({
          type: 'question',
          question: { id: 'chronic_conditions_flag', text: 'Você tem condições crônicas?', type: 'boolean', domain: 'chronic_disease', riskWeight: 4 },
          progress: 83, // Near completion of triage
          currentDomain: 'Avaliação Inicial',
          currentLayer: 'Triage',
          estimatedTimeRemaining: 1
        })
        .mockResolvedValueOnce({
          type: 'domain_transition',
          domain: { id: 'chronic_disease', name: 'Condições Crônicas' },
          message: 'Agora vamos falar sobre condições crônicas',
          progress: 100, // Triage complete, but overall progress should reset based on triggered domains
          currentDomain: 'Condições Crônicas',
          currentLayer: 'Histórico Médico',
          estimatedTimeRemaining: 5
        });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('83%')).toBeInTheDocument();
      });

      // Complete triage
      fireEvent.click(screen.getByText('✅ Sim'));

      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('chronic_disease');
        expect(screen.getByText('Condições Crônicas')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Calculation Edge Cases', () => {
    it('should handle progress calculation with no triggered domains', async () => {
      // Mock scenario where no domains are triggered (only triage + validation)
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: { id: 'age', text: 'Qual é sua idade?', type: 'number', domain: 'demographics', riskWeight: 1 },
        progress: 0,
        currentDomain: 'Avaliação Inicial',
        currentLayer: 'Triage',
        estimatedTimeRemaining: 2 // Only triage + validation remaining
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
        expect(screen.getByText('~2min')).toBeInTheDocument();
      });
    });

    it('should handle progress calculation with multiple triggered domains', async () => {
      // Mock scenario where multiple domains are triggered
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: { id: 'pain_severity', text: 'Qual é sua dor?', type: 'scale', domain: 'pain', riskWeight: 2 },
        progress: 25, // 1 out of 4 total sections complete (triage + 3 domains)
        currentDomain: 'Avaliação de Dor',
        currentLayer: 'Impacto da Dor',
        estimatedTimeRemaining: 8 // Multiple domains remaining
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('25%')).toBeInTheDocument();
        expect(screen.getByText('~8min')).toBeInTheDocument();
      });
    });

    it('should handle progress calculation near completion', async () => {
      // Mock near-completion scenario
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: { id: 'height_confirmation', text: 'Confirme sua altura', type: 'number', domain: 'validation', riskWeight: 0 },
        progress: 90, // Near completion
        currentDomain: 'Validação',
        currentLayer: 'Confirmação de Dados',
        estimatedTimeRemaining: 1
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('90%')).toBeInTheDocument();
        expect(screen.getByText('~1min')).toBeInTheDocument();
      });
    });
  });

  describe('Domain Transition Flow', () => {
    it('should handle transitions between domains correctly', async () => {
      // Mock transition from pain domain to mental health domain
      mockFlow.processResponse
        .mockResolvedValueOnce({
          type: 'domain_transition',
          domain: { id: 'pain_management', name: 'Avaliação de Dor' },
          message: 'Agora vamos falar sobre dor',
          progress: 33,
          currentDomain: 'Avaliação de Dor',
          currentLayer: 'Impacto da Dor',
          estimatedTimeRemaining: 5
        })
        .mockResolvedValueOnce({
          type: 'question',
          question: { id: 'pain_duration', text: 'Há quanto tempo você tem dor?', type: 'select', domain: 'pain', riskWeight: 2 },
          progress: 33,
          currentDomain: 'Avaliação de Dor',
          currentLayer: 'Impacto da Dor',
          estimatedTimeRemaining: 5
        });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('pain_management');
        expect(screen.getByText('Avaliação de Dor')).toBeInTheDocument();
        expect(screen.getByText('33%')).toBeInTheDocument();
      });
    });

    it('should handle automatic progression after domain transition', async () => {
      // Mock automatic progression after transition message
      mockFlow.processResponse
        .mockResolvedValueOnce({
          type: 'domain_transition',
          domain: { id: 'mental_health', name: 'Bem-estar Mental' },
          message: 'Agora vamos falar sobre bem-estar mental',
          progress: 66,
          currentDomain: 'Bem-estar Mental',
          currentLayer: 'Avaliação de Bem-estar',
          estimatedTimeRemaining: 3
        });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bem-estar Mental')).toBeInTheDocument();
        expect(screen.getByText('66%')).toBeInTheDocument();
      });

      // Wait for automatic progression (after 1.5 seconds)
      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('_continue', true);
      }, { timeout: 2000 });
    });
  });

  describe('Completion Flow Validation', () => {
    it('should handle completion with correct final progress', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'complete',
        results: {
          riskLevel: 'low',
          riskScores: { demographics: 1, lifestyle: 1 },
          recommendations: ['Maintain healthy habits'],
          nextSteps: ['Schedule routine checkup']
        },
        progress: 100, // Should be exactly 100% at completion
        currentDomain: 'Completo',
        currentLayer: 'Finalizado',
        estimatedTimeRemaining: 0
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Avaliação Concluída')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Continuar para Próxima Etapa'));
      
      expect(mockOnComplete).toHaveBeenCalledWith({
        riskLevel: 'low',
        riskScores: { demographics: 1, lifestyle: 1 },
        recommendations: ['Maintain healthy habits'],
        nextSteps: ['Schedule routine checkup']
      });
    });

    it('should handle early completion for low-risk users', async () => {
      // Mock scenario where user triggers minimal domains
      mockFlow.processResponse.mockResolvedValue({
        type: 'complete',
        results: {
          riskLevel: 'low',
          completedDomains: ['universal_triage', 'validation'],
          totalRiskScore: 2
        },
        progress: 100,
        currentDomain: 'Completo',
        currentLayer: 'Finalizado',
        estimatedTimeRemaining: 0
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Avaliação Concluída')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle progress calculation errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock initial successful response
      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: { id: 'age', text: 'Idade?', type: 'number', domain: 'demographics', riskWeight: 1 },
        progress: 0,
        currentDomain: 'Avaliação Inicial',
        currentLayer: 'Triage',
        estimatedTimeRemaining: 5
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });

      // Mock error on next response
      mockFlow.processResponse.mockRejectedValueOnce(new Error('Progress calculation error'));

      fireEvent.change(screen.getByPlaceholderText('Digite um número'), { target: { value: '25' } });
      fireEvent.click(screen.getByText('Continuar'));

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error processing response:', expect.any(Error));
      });

      consoleError.mockRestore();
    });

    it('should maintain consistent progress during state transitions', async () => {
      // Mock inconsistent progress values to test stability
      mockFlow.processResponse
        .mockResolvedValueOnce({
          type: 'question',
          question: { id: 'test1', text: 'Test 1', type: 'boolean', domain: 'test', riskWeight: 1 },
          progress: 25,
          currentDomain: 'Test Domain',
          currentLayer: 'Test Layer',
          estimatedTimeRemaining: 3
        })
        .mockResolvedValueOnce({
          type: 'question',
          question: { id: 'test2', text: 'Test 2', type: 'boolean', domain: 'test', riskWeight: 1 },
          progress: 25, // Same progress - should be consistent
          currentDomain: 'Test Domain',
          currentLayer: 'Test Layer',
          estimatedTimeRemaining: 3
        });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('25%')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('✅ Sim'));

      await waitFor(() => {
        expect(screen.getByText('25%')).toBeInTheDocument(); // Should remain consistent
      });
    });
  });

  describe('Time Estimation Validation', () => {
    it('should provide accurate time estimates based on triggered domains', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: { id: 'emergency_check', text: 'Emergência?', type: 'multiselect', domain: 'emergency', riskWeight: 10 },
        progress: 16,
        currentDomain: 'Avaliação Inicial',
        currentLayer: 'Triage',
        estimatedTimeRemaining: 12 // Multiple domains triggered
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('~12min')).toBeInTheDocument();
      });
    });

    it('should update time estimates as domains are completed', async () => {
      mockFlow.processResponse
        .mockResolvedValueOnce({
          type: 'question',
          question: { id: 'test', text: 'Test', type: 'boolean', domain: 'test', riskWeight: 1 },
          progress: 50,
          currentDomain: 'Test',
          currentLayer: 'Test',
          estimatedTimeRemaining: 5
        })
        .mockResolvedValueOnce({
          type: 'question',
          question: { id: 'test2', text: 'Test 2', type: 'boolean', domain: 'test', riskWeight: 1 },
          progress: 75,
          currentDomain: 'Test',
          currentLayer: 'Test',
          estimatedTimeRemaining: 2 // Reduced time as progress increases
        });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('~5min')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('✅ Sim'));

      await waitFor(() => {
        expect(screen.getByText('~2min')).toBeInTheDocument();
      });
    });
  });
});
